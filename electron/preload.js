const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
  saveFileDialog: (data) => ipcRenderer.invoke('save-file-dialog', data),
  getSavedSession: () => ipcRenderer.invoke('get-saved-session'),
  saveSession: (token) => ipcRenderer.invoke('save-session', token),
  clearSession: () => ipcRenderer.invoke('clear-session'),
  onSavedSession: (callback) => ipcRenderer.on('saved-session', (_event, token) => callback(token))
})
