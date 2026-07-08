const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')

const jwtIssuer = require('./jwt-issuer')
const sidecar   = require('./sidecar')
const seeder    = require('./seeder')

const isDev = !app.isPackaged

// ── Auto-updater ──────────────────────────────────────────────────────────────

function setupUpdater() {
  if (isDev) return  // don't check for updates in dev

  // Private repo — token required for releases API (GH_TOKEN not available outside terminal)
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'smaxhart',
    repo: 'virtru-demo-center',
    private: true,
    token: process.env.GH_TOKEN || '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',
  })

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-available', info => {
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'available', version: info.version })
  })

  autoUpdater.on('download-progress', progress => {
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', info => {
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'ready', version: info.version })
  })

  autoUpdater.on('error', err => {
    console.warn('[updater] Error:', err.message)
  })
}

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall()
})

ipcMain.handle('get-app-version', () => app.getVersion())

let mainWindow = null
let platformStatus = 'starting' // 'starting' | 'ready' | 'error'

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 23 },
    backgroundColor: '#0a1628',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  })

  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' file:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' file:; " +
          "style-src 'self' 'unsafe-inline' file:; " +
          "img-src 'self' file: data:; " +
          "font-src 'self' file: data:; " +
          "connect-src 'self' http://localhost:7777 http://localhost:7779;",
        ],
      },
    })
  })

  if (isDev) {
    // In dev, Vite rebuilds to dist/ — load that file directly
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html')
    mainWindow.loadFile(indexPath)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

ipcMain.handle('get-user-token', (_event, personaId) => {
  return jwtIssuer.issueToken(personaId)
})

ipcMain.handle('get-platform-token', () => {
  return jwtIssuer.issueToken('admin')
})

ipcMain.handle('get-platform-status', () => {
  return platformStatus
})

ipcMain.handle('save-tdf', async (_event, { bytes, filename }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename || 'document.tdf',
    filters: [
      { name: 'TDF Archive', extensions: ['tdf'] },
      { name: 'All Files',   extensions: ['*'] },
    ],
  })
  if (canceled || !filePath) return null
  fs.writeFileSync(filePath, Buffer.from(bytes))
  return filePath
})

ipcMain.handle('open-tdf', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open TDF File',
    filters: [
      { name: 'TDF Archive', extensions: ['tdf', 'zip'] },
      { name: 'All Files',   extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return null
  const buf = fs.readFileSync(filePaths[0])
  // Return as plain array so it crosses the context bridge (Uint8Array doesn't serialize)
  return { bytes: Array.from(buf), filename: path.basename(filePaths[0]) }
})

ipcMain.handle('save-file', async (_event, { bytes, filename, ext }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename || `file.${ext || 'bin'}`,
  })
  if (canceled || !filePath) return null
  fs.writeFileSync(filePath, Buffer.from(bytes))
  return filePath
})

// ── Boot sequence ─────────────────────────────────────────────────────────────

async function boot() {
  const userDataPath = app.getPath('userData')

  // 1. Generate/load JWT issuer keypair
  jwtIssuer.loadOrGenerateKeys(userDataPath)

  // 2. Start JWT issuer HTTP server
  await jwtIssuer.startServer()

  // 3. Create window early (shows loading state via platform-status events)
  createWindow()
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.send('platform-status', 'starting')
  })

  // 4. Start OpenTDF platform sidecar
  try {
    await sidecar.start(app, jwtIssuer.ISSUER)
    platformStatus = 'ready'
    if (mainWindow) mainWindow.webContents.send('platform-status', 'ready')
    console.log('[main] Platform ready')
  } catch (err) {
    platformStatus = 'error'
    if (mainWindow) mainWindow.webContents.send('platform-status', 'error')
    console.error('[main] Platform failed to start:', err.message)
    // App still opens — shows error state rather than crashing
    return
  }

  // 5. Seed platform on first launch
  try {
    const adminToken = jwtIssuer.issueToken('admin').access_token
    const markerPath = path.join(userDataPath, 'seeded.txt')
    await seeder.seed(adminToken, markerPath)
  } catch (err) {
    console.warn('[main] Seed warning (non-fatal):', err.message)
  }

  // 6. Check for updates (packaged builds only)
  setupUpdater()
  if (!isDev) autoUpdater.checkForUpdates()
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

app.whenReady().then(boot)

app.on('before-quit', () => {
  sidecar.stop()
  jwtIssuer.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
