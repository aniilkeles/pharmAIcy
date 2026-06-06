const { app, BrowserWindow, ipcMain, dialog, safeStorage, session } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const net = require('net')
const os = require('os')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

process.stdout.on('error', (err) => { if (err.code === 'EPIPE') process.exit(0) })
process.stderr.on('error', (err) => { if (err.code === 'EPIPE') process.exit(0) })

let mainWindow
let pythonProcess
let backendPort = 8000
const SESSION_FILE = path.join(app.getPath('userData'), 'session.enc')
const PORT_FILE = path.join(os.tmpdir(), 'pharmaicy.port')

function checkPortFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })
}

async function findFreePort() {
  for (const p of [8000, 8001, 8002]) {
    if (await checkPortFree(p)) return p
  }
  return 8002
}

function saveSafeSession(token) {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token)
      fs.writeFileSync(SESSION_FILE, encrypted)
    }
  } catch (e) {
    console.error('Failed to save session:', e)
  }
}

function loadSafeSession() {
  try {
    if (safeStorage.isEncryptionAvailable() && fs.existsSync(SESSION_FILE)) {
      const encrypted = fs.readFileSync(SESSION_FILE)
      return safeStorage.decryptString(encrypted)
    }
  } catch (e) {
    console.error('Failed to load session:', e)
  }
  return null
}

function clearSafeSession() {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE)
    }
  } catch (e) {
    console.error('Failed to clear session:', e)
  }
}

function waitForBackend(url, maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0
    const check = () => {
      attempts++
      http.get(url, (res) => {
        if (res.statusCode < 500) resolve()
        else retry()
      }).on('error', () => {
        if (attempts >= maxAttempts) reject(new Error('Backend failed to start'))
        else setTimeout(check, 1000)
      })
    }
    const retry = () => setTimeout(check, 1000)
    check()
  })
}

function startPythonBackend(port) {
  const projectRoot = isDev ? __dirname.replace(/[\\/]electron$/, '') : path.dirname(app.getPath('exe'))
  const backendDir = isDev ? projectRoot : path.join(process.resourcesPath, 'backend')

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

  pythonProcess = spawn(pythonCmd, [
    '-m', 'uvicorn',
    'backend.main:app',
    '--port', String(port),
    '--host', '127.0.0.1'
  ], {
    cwd: isDev ? projectRoot : backendDir,
    env: { ...process.env },
    shell: true
  })

  pythonProcess.stdout.on('data', (data) => {
    try {
      process.stdout.write(`[Python]: ${data}`)
    } catch (e) {
      // pipe closed, ignore
    }
  })

  pythonProcess.stderr.on('data', (data) => {
    try {
      process.stderr.write(`[Python ERR]: ${data}`)
    } catch (e) {
      // pipe closed, ignore
    }
  })

  pythonProcess.on('close', (code) => {
    try {
      process.stdout.write(`Python process exited with code ${code}\n`)
    } catch (e) {
      // pipe closed, ignore
    }
  })

  pythonProcess.on('error', (err) => {
    if (err.code !== 'EPIPE') console.error(err)
  })
}

async function createWindow() {
  backendPort = await findFreePort()
  console.log(`[Electron] Using backend port ${backendPort}`)
  fs.writeFileSync(PORT_FILE, String(backendPort))
  startPythonBackend(backendPort)

  try {
    await waitForBackend(`http://127.0.0.1:${backendPort}/agent-status`)
    console.log('Backend ready')
  } catch (e) {
    console.error('Backend did not start in time:', e.message)
  }

  const savedSession = loadSafeSession()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0F0F0F',
    titleBarStyle: 'hidden',
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
    if (savedSession) {
      mainWindow.webContents.send('saved-session', savedSession)
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  require('./ipc/handlers')(ipcMain, {
    dialog,
    mainWindow: () => mainWindow,
    saveSafeSession,
    loadSafeSession,
    clearSafeSession
  })
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler(
    (webContents, permission, callback) => {
      if (permission === 'media') callback(true)
      else callback(false)
    }
  )

  // Use URL filter so this handler never fires for backend/API responses
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['http://localhost:5173/*', 'file://*'] },
    (details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            `default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 ws://localhost:5173 http://127.0.0.1:${backendPort} https://*.supabase.co wss://*.supabase.co https://fonts.googleapis.com https://fonts.gstatic.com; style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; media-src 'self' mediastream: blob:; connect-src 'self' http://127.0.0.1:${backendPort} https://*.supabase.co wss://*.supabase.co ws://localhost:5173`
          ]
        }
      })
    }
  )

  createWindow()
})

function killPythonProcess() {
  if (!pythonProcess) return
  if (process.platform === 'win32') {
    spawn('taskkill', ['/pid', pythonProcess.pid, '/f', '/t'], { shell: true })
  } else {
    pythonProcess.kill()
  }
  pythonProcess = null
}

app.on('window-all-closed', () => {
  killPythonProcess()
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('before-quit', () => {
  killPythonProcess()
})
