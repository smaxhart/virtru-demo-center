const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')

const jwtIssuer = require('./jwt-issuer')
const sidecar   = require('./sidecar')
const seeder    = require('./seeder')

const isDev = !app.isPackaged

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
