const { shell } = require('electron')
const fs = require('fs')
const path = require('path')

module.exports = function registerHandlers(ipcMain, { dialog, mainWindow, saveSafeSession, loadSafeSession, clearSafeSession }) {
  ipcMain.on('minimize', () => mainWindow().minimize())
  ipcMain.on('maximize', () => {
    const win = mainWindow()
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('close-app', () => mainWindow().close())

  ipcMain.handle('open-file-dialog', async () => {
    const win = mainWindow()
    const result = await dialog.showOpenDialog(win, {
      properties: ['openFile'],
      filters: [{ name: 'Data Files', extensions: ['csv', 'xls', 'xlsx'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    const ext = path.extname(filePath).toLowerCase()
    // Always read as binary — let the backend detect encoding
    return { path: filePath, content: fs.readFileSync(filePath).toString('base64'), ext }
  })

  ipcMain.handle('save-file-dialog', async (_event, data) => {
    const win = mainWindow()
    const result = await dialog.showSaveDialog(win, {
      defaultPath: 'pharmacy_export.csv',
      filters: [{ name: 'CSV Files', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return false
    fs.writeFileSync(result.filePath, data, 'utf8')
    return true
  })

  ipcMain.handle('get-saved-session', () => {
    return loadSafeSession()
  })

  ipcMain.handle('save-session', (_event, token) => {
    saveSafeSession(token)
    return true
  })

  ipcMain.handle('clear-session', () => {
    clearSafeSession()
    return true
  })
}
