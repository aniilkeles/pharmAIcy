const { app, BrowserWindow, ipcMain, dialog, safeStorage, session } = require('electron')
const path = require('path')
const { spawn } = require('child_process')
const http = require('http')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow
let pythonProcess
const SESSION_FILE = path.join(app.getPath('userData'), 'session.enc')

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

function startPythonBackend() {
  const projectRoot = isDev ? __dirname.replace(/[\\/]electron$/, '') : path.dirname(app.getPath('exe'))
  const backendDir = isDev ? projectRoot : path.join(process.resourcesPath, 'backend')

  const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'

  pythonProcess = spawn(pythonCmd, [
    '-m', 'uvicorn',
    'backend.main:app',
    '--port', '8000',
    '--host', '127.0.0.1'
  ], {
    cwd: isDev ? projectRoot : backendDir,
    env: { ...process.env },
    shell: true
  })

  pythonProcess.stdout.on('data', (data) => {
    console.log('[Python]', data.toString())
  })

  pythonProcess.stderr.on('data', (data) => {
    console.error('[Python ERR]', data.toString())
  })

  pythonProcess.on('close', (code) => {
    console.log(`Python process exited with code ${code}`)
  })
}

async function createWindow() {
  startPythonBackend()

  try {
    await waitForBackend('http://127.0.0.1:8000/agent-status')
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
    titleBarOverlay: {
      color: '#0F0F0F',
      symbolColor: '#EDEDEC',
      height: 32
    },
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

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:5173 ws://localhost:5173 http://127.0.0.1:8000 https://*.supabase.co wss://*.supabase.co; media-src 'self' mediastream: blob:; connect-src 'self' http://127.0.0.1:8000 https://*.supabase.co wss://*.supabase.co ws://localhost:5173"
        ]
      }
    })
  })

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
