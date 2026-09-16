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

  getLogPath: () => ipcRenderer.invoke('get-log-path'),

  // Auto-updater
  onUpdateStatus: (callback) => {
    ipcRenderer.on('update-status', (_event, info) => callback(info))
    return () => ipcRenderer.removeAllListeners('update-status')
  },
  installUpdate: () => ipcRenderer.invoke('install-update'),
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  // ── AI Protection ─────────────────────────────────────────────────────────
  //
  // Only the AI Protection page calls these. Everything above is unchanged, including `saveFile`:
  // that page's own helper is `aiSaveFile`, which takes its arguments in the opposite order, and
  // giving it a separate name is what let the existing signature stay as it is.

  // Whether the AI page's vocabulary is seeded and its scenarios are activated. Distinct from
  // getPlatformStatus, which goes true earlier — see the note on aiStatus in electron/main.js.
  getAiStatus: () => ipcRenderer.invoke('get-ai-status'),
  onAiStatus: (callback) => {
    ipcRenderer.on('ai-status', (_event, status) => callback(status))
    return () => ipcRenderer.removeAllListeners('ai-status')
  },

  // The entity attribute FQNs the KAS will resolve a persona to
  getEntityAttributes: (personaId) => ipcRenderer.invoke('get-entity-attributes', personaId),

  // File I/O — used to export a corpus document as a real .tdf.
  // Argument order follows fs.writeFile: destination first, payload second.
  aiSaveFile: (filename, bytes) => ipcRenderer.invoke('save-file', { filename, bytes }),

  // Adding your own documents. openFile returns { filename, bytes } or null if cancelled;
  // the renderer sniffs the bytes to decide whether it is a TDF, and whose TDF it is.
  openFile:         ()        => ipcRenderer.invoke('open-file'),
  // modeId is optional; passing a user-built scenario's id adds the vocabulary it invented.
  getAttributeDefs: (modeId)  => ipcRenderer.invoke('get-attribute-defs', modeId),
  listUploads:      (modeId)  => ipcRenderer.invoke('list-uploads', modeId),
  readUpload:       (id)      => ipcRenderer.invoke('read-upload', id),
  deleteUpload:     (id)      => ipcRenderer.invoke('delete-upload', id),
  addUpload:        (record, payload) => ipcRenderer.invoke('add-upload', { record, payload }),

  // Scenarios the user built. save/import both seed the platform before they return, so a
  // scenario is enterable the moment the promise resolves rather than after a restart.
  // validateScenario is the same check save runs, exposed so the builder can show problems
  // before the user commits — there is only one set of rules, in electron/ai-scenarios.js.
  listScenarios:    ()          => ipcRenderer.invoke('list-scenarios'),
  newScenarioId:    ()          => ipcRenderer.invoke('new-scenario-id'),
  validateScenario: (scenario)  => ipcRenderer.invoke('validate-scenario', scenario),
  saveScenario:     (scenario)  => ipcRenderer.invoke('save-scenario', scenario),
  deleteScenario:   (id)        => ipcRenderer.invoke('delete-scenario', id),
  exportScenario:   (scenario)  => ipcRenderer.invoke('export-scenario', scenario),
  importScenario:   ()          => ipcRenderer.invoke('import-scenario'),
})
