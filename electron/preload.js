const { contextBridge, ipcRenderer } = require('electron')
const fs = require('fs')
const path = require('path')
const os = require('os')

let backendPort = 8000
try {
  const raw = fs.readFileSync(path.join(os.tmpdir(), 'pharmaicy.port'), 'utf8')
  backendPort = parseInt(raw.trim(), 10) || 8000
} catch (_) {}

contextBridge.exposeInMainWorld('api', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (data) => ipcRenderer.invoke('save-file-dialog', data),
  getSavedSession: () => ipcRenderer.invoke('get-saved-session'),
  saveSession: (token) => ipcRenderer.invoke('save-session', token),
  clearSession: () => ipcRenderer.invoke('clear-session'),
  onSavedSession: (callback) => ipcRenderer.on('saved-session', (_event, token) => callback(token)),
  backendPort,
  minimize: () => ipcRenderer.send('minimize'),
  maximize: () => ipcRenderer.send('maximize'),
  close: () => ipcRenderer.send('close-app'),
})
