const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Token issuance — returns { access_token, token_type, expires_in }
  getUserToken:    (personaId)           => ipcRenderer.invoke('get-user-token', personaId),
  getPlatformToken: ()                   => ipcRenderer.invoke('get-platform-token'),

  // Platform status
  getPlatformStatus: ()                  => ipcRenderer.invoke('get-platform-status'),

  // File I/O
  saveTdf: (bytes, filename)             => ipcRenderer.invoke('save-tdf', { bytes, filename }),
  openTdf: ()                            => ipcRenderer.invoke('open-tdf'),
  saveFile: (bytes, filename, ext)       => ipcRenderer.invoke('save-file', { bytes, filename, ext }),

  // Listen for platform status updates
  onPlatformStatus: (callback) => {
    ipcRenderer.on('platform-status', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('platform-status')
  },

  // Auto-updater
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, info) => callback(info))
    return () => ipcRenderer.removeAllListeners('update-status')
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
})
