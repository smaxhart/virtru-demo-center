const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const fs = require('fs')
const { autoUpdater } = require('electron-updater')
const log = require('electron-log')

// Route electron-log to file + console
log.transports.file.level = 'info'
log.transports.console.level = 'info'
autoUpdater.logger = log

const jwtIssuer = require('./jwt-issuer')
const sidecar   = require('./sidecar')
const seeder    = require('./seeder')

const isDev = !app.isPackaged

// ── Auto-updater ──────────────────────────────────────────────────────────────
//
// The repo is private, so the feed needs a token, and the token has to travel inside the
// build: a .app launched from Finder or the Dock inherits no shell environment, so
// process.env is empty in the only case that matters. An env-var-only design silently
// never updates for real users. That constraint is real and is why this is embedded.
//
// The safety comes from the token's *scope*, not from hiding it: a fine-grained PAT,
// Contents read-only, this repository only, with an expiry. Someone who unzips a build can
// read the repo the build came from and nothing else.
//
// Until v1.7.4 this line read `process.env.GH_TOKEN || 'ghp_…'` with a classic PAT inline.
// Classic `repo` scope is read-write across every private repository on the account, so every
// .dmg handed to a seller also handed out push access to all ten of them — including this one,
// which auto-updates onto every seller's machine. isClassicPat() now refuses them outright
// rather than trusting this comment to be read.

let pendingUpdateZip = null

const isClassicPat = t => /^(ghp|gho|ghu|ghs|ghr)_/.test(t)

/**
 * Resolves the feed token: environment first, then the packed file, skipping classic PATs.
 *
 * The file is an untracked `electron/update-token.js`. electron-builder packs from the
 * filesystem, not from git, so the token still ships in the .app — but it never enters git
 * history, never trips secret scanning, and rotating it is a file edit rather than a commit.
 *
 * GH_TOKEN is checked first for terminal-launched builds, but `gh auth token` returns a
 * classic `gho_` token, so a classic value there is skipped in favour of the packed one
 * rather than disabling updates outright.
 */
function feedToken() {
  const candidates = []
  if (process.env.GH_TOKEN) candidates.push(['GH_TOKEN', process.env.GH_TOKEN.trim()])
  try {
    const t = require('./update-token.js')
    if (typeof t === 'string' && t.trim()) candidates.push(['update-token.js', t.trim()])
  } catch {
    // untracked and absent — expected on a fresh clone
  }

  for (const [source, value] of candidates) {
    if (isClassicPat(value)) {
      log.warn(`[updater] Ignoring the classic PAT from ${source} — see the note in main.js`)
      continue
    }
    log.info(`[updater] Feed token from ${source}`)
    return value
  }
  return null
}

function setupUpdater() {
  if (isDev) return  // don't check for updates in dev

  const token = feedToken()
  if (!token) {
    log.info('[updater] No usable feed token — updates disabled')
    return
  }

  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'smaxhart',
    repo: 'virtru-demo-center',
    private: true,
    token,
  })

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = false  // we install via shell script, not Squirrel

  autoUpdater.on('update-available', info => {
    log.info(`[updater] Update available: v${info.version}`)
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    log.info('[updater] App is up to date')
  })

  autoUpdater.on('download-progress', progress => {
    const mbps = (progress.bytesPerSecond / 1024 / 1024).toFixed(1)
    const transferred = (progress.transferred / 1024 / 1024).toFixed(1)
    const total = (progress.total / 1024 / 1024).toFixed(0)
    const pct = Math.round(progress.percent)
    log.info(`[updater] Downloading ${pct}% — ${transferred}MB / ${total}MB @ ${mbps} MB/s`)
    if (mainWindow) mainWindow.webContents.send('update-status', {
      state: 'downloading',
      percent: pct,
      transferred: parseFloat(transferred),
      total: parseFloat(total),
      mbps: parseFloat(mbps),
    })
  })

  autoUpdater.on('update-downloaded', info => {
    const current = app.getVersion()
    const isNewer = info.version.localeCompare(current, undefined, { numeric: true, sensitivity: 'base' }) > 0
    if (!isNewer) {
      log.info(`[updater] Downloaded v${info.version} is not newer than current v${current} — ignoring`)
      return
    }
    pendingUpdateZip = info.downloadedFile
    // Always install back to wherever this app is running from.
    const appBundlePath = path.dirname(path.dirname(path.dirname(process.execPath)))
    writeInstallerScript(pendingUpdateZip, appBundlePath)
    log.info(`[updater] Download complete — v${info.version} ready, installer written to ${INSTALLER_SCRIPT_PATH}`)
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'ready', version: info.version })
  })

  autoUpdater.on('error', err => {
    log.error('[updater] Error:', err.message)
    // A fine-grained PAT expires, and when it does every installed copy starts 401ing with
    // nothing to say why. Name it in the log so the next person does not go hunting.
    if (/401|403|Bad credentials/i.test(err.message)) {
      log.error('[updater] Feed token looks expired or revoked — rotate it and cut a new release')
    }
    if (mainWindow) mainWindow.webContents.send('update-status', { state: 'error', message: err.message })
  })
}

// The installer script is written to a fixed path on every launch, so when a quit
// happens the script on disk is always the CURRENT version's code — no bootstrap lag.
const INSTALLER_SCRIPT_PATH = path.join(app.getPath('home'), '.virtru', 'updater.sh')

function buildInstallScript(zipPath, destPath) {
  // Bake paths as single-quoted literals — no arg passing, no word-split risk on spaces
  const safeZip  = zipPath.replace(/'/g, "'\\''")
  const safeDest = destPath.replace(/'/g, "'\\''")
  return [
    '#!/bin/bash',
    'exec > /tmp/virtru-update.log 2>&1',
    'set -e',
    `ZIP='${safeZip}'`,
    `DEST='${safeDest}'`,
    'LOCK=/tmp/virtru-update.lock',
    'echo "=== virtru updater v1.5.4 ==="',
    'echo "PID: $$  ZIP: $ZIP  DEST: $DEST"',
    'if [ -f "$LOCK" ]; then echo "Another install in progress — exiting"; exit 0; fi',
    'echo $$ > "$LOCK"',
    'trap \'rm -f "$LOCK"\' EXIT',
    'echo "Waiting for app to quit..."',
    'sleep 5',
    'echo "Extracting..."',
    'WORKDIR=$(mktemp -d)',
    'ditto -x -k "$ZIP" "$WORKDIR"',
    'NEW_APP=$(find "$WORKDIR" -maxdepth 1 -name "*.app" -type d | head -1)',
    'echo "Found app: $NEW_APP"',
    'if [ -z "$NEW_APP" ]; then echo "ERROR: no .app in zip"; exit 1; fi',
    // Atomic swap: copy to Dest.new first, then rename — old app stays intact until copy is done
    'DEST_NEW="${DEST}.new"',
    'echo "Copying to staging area..."',
    'rm -rf "$DEST_NEW"',
    'ditto "$NEW_APP" "$DEST_NEW"',
    'xattr -cr "$DEST_NEW"',
    'echo "Swapping in new app..."',
    'rm -rf "$DEST"',
    'mv "$DEST_NEW" "$DEST"',
    'echo "Launching..."',
    'open "$DEST"',
    'rm -rf "$WORKDIR"',
    'echo "Done."',
  ].join('\n')
}

function writeInstallerScript(zipPath, destPath) {
  const dir = path.dirname(INSTALLER_SCRIPT_PATH)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const script = buildInstallScript(zipPath, destPath)
  fs.writeFileSync(INSTALLER_SCRIPT_PATH, script, { mode: 0o755 })
}

function runInstaller() {
  if (!fs.existsSync(INSTALLER_SCRIPT_PATH)) {
    log.error('[updater] Installer script missing — cannot install')
    return false
  }
  const { spawn } = require('child_process')
  spawn('bash', [INSTALLER_SCRIPT_PATH], { detached: true, stdio: 'ignore' }).unref()
  log.info(`[updater] Launched installer: ${INSTALLER_SCRIPT_PATH}`)
  return true
}

ipcMain.handle('install-update', () => {
  if (!pendingUpdateZip) { log.error('[updater] install-update called but no pending zip'); return }
  if (runInstaller()) { sidecar.stop(app); jwtIssuer.stop(); app.exit(0) }
})

ipcMain.handle('get-app-version', () => app.getVersion())
ipcMain.handle('get-log-path', () => log.transports.file.getFile().path)

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
      // In dev, the page loads via file:// and onHeadersReceived never fires,
      // so external tile fetches (Carto, OSM) are blocked by default same-origin
      // policy. Disable webSecurity only in dev to allow those requests through.
      webSecurity: !isDev,
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
          "img-src 'self' file: data: https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org; " +
          "font-src 'self' file: data:; " +
          "connect-src 'self' http://localhost:7777 http://localhost:7779 https://developer-ai-gateway.virtru.com;",
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
    log.info('[main] Platform ready')
  } catch (err) {
    platformStatus = 'error'
    log.error('[main] Platform failed to start:', err.message)
    if (mainWindow) mainWindow.webContents.send('platform-status', { state: 'error', message: err.message })
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

  // 6. Check for updates (packaged builds only) — on launch + every 30 minutes
  setupUpdater()
  if (!isDev) {
    autoUpdater.checkForUpdates()
    setInterval(() => autoUpdater.checkForUpdates(), 30 * 60 * 1000)
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

app.whenReady().then(boot)

app.on('before-quit', (e) => {
  if (pendingUpdateZip) {
    e.preventDefault()
    log.info(`[updater] Installing on quit via ${INSTALLER_SCRIPT_PATH}`)
    pendingUpdateZip = null
    if (runInstaller()) { sidecar.stop(app); jwtIssuer.stop(); app.exit(0); return }
  }
  sidecar.stop(app)
  jwtIssuer.stop()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
