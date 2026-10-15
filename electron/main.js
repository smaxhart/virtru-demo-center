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
const { isNewerVersion } = require('./update-version')

// The AI Protection page brings its own vocabulary, its own uploads, and the scenarios a user
// builds. All four are additive — nothing above changes because they exist.
const aiSeeder     = require('./ai-seeder')
const gcapGrants   = require('./gcap-grants')
const aiIdentities = require('./ai-identities')
const aiScenarios  = require('./ai-scenarios')
const aiUploads    = require('./ai-uploads')

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
    if (!isNewerVersion(info.version, current)) {
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
          "img-src 'self' file: data: https://basemaps.cartocdn.com https://*.basemaps.cartocdn.com https://*.tile.openstreetmap.org; " +
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

// GCAP: disable / re-enable a `gcap-` account at the issuer. See `revokeIdentity` for what this is
// and is not — it withdraws the account, it does not reach into a token already issued.
ipcMain.handle('gcap-revoke',  (_e, id) => jwtIssuer.revokeIdentity(id))
ipcMain.handle('gcap-restore', (_e, id) => (id === '*' ? (jwtIssuer.restoreAllIdentities(), true) : jwtIssuer.restoreIdentity(id)))

// GCAP free play: edit who holds what, for real (subject mappings on the platform). See gcap-grants.js.
const gcapAdmin = () => jwtIssuer.issueToken('admin').access_token
ipcMain.handle('gcap-people',        () => ({ people: gcapGrants.people(), vocab: gcapGrants.VOCAB }))
ipcMain.handle('gcap-set-person',    (_e, id, grants) => gcapGrants.setPerson(gcapAdmin(), jwtIssuer, id, grants))
ipcMain.handle('gcap-add-person',    (_e, spec) => gcapGrants.addPerson(gcapAdmin(), jwtIssuer, spec))
ipcMain.handle('gcap-remove-person', (_e, id) => gcapGrants.removePerson(gcapAdmin(), jwtIssuer, id))
ipcMain.handle('gcap-reset-people',  () => gcapGrants.reset(gcapAdmin(), jwtIssuer))

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
  // Buffer.from() happily accepts a string, so swapped arguments would silently write the filename
  // as the file body. Fail loudly instead — a corrupt .tdf looks like a platform bug, and someone
  // would spend an afternoon on it. Array-likes and typed arrays are both allowed, because the two
  // callers of this channel cross the bridge differently.
  const usable = Array.isArray(bytes) || typeof bytes?.byteLength === 'number'
  if (!usable || typeof bytes === 'string') {
    throw new Error(`save-file expects bytes, received ${typeof bytes}`)
  }

  const isTdf = (filename || '').toLowerCase().endsWith('.tdf')
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename || `file.${ext || 'bin'}`,
    ...(isTdf ? { filters: [
      { name: 'TDF Archive', extensions: ['tdf'] },
      { name: 'All Files',   extensions: ['*'] },
    ] } : {}),
  })
  if (canceled || !filePath) return null
  fs.writeFileSync(filePath, Buffer.from(bytes))
  return filePath
})

// ── AI Protection ─────────────────────────────────────────────────────────────
//
// Everything below is reached only from the AI Protection page. It is deliberately additive: not
// one handler above was changed, and the channels the rest of the app already uses
// (`get-user-token`, `get-platform-token`, `get-platform-status`, `save-file`, …) are reused as
// they are rather than reshaped to suit this page.
//
// The one place that took care is `save-file`. This page and the pages before it both want to write
// bytes to a path the user picks, but their renderer-side helpers take the arguments in opposite
// orders. The handler above is the only one, and it stays as it is; the preload exposes a second
// name for this page, so no existing call site moved.

/**
 * Whether the AI page can be used yet.
 *
 * Its own signal, separate from `platform-status`, because the two become true at different times.
 * The platform is reported ready as soon as the sidecar answers — which is what every page that
 * shipped before this one waits on, and that timing is left exactly alone. This page needs more
 * than a live platform: it needs its attributes defined and its subject mappings written, or the
 * first question asked would come back denied for everyone and look like a bug in the KAS.
 */
let aiStatus = 'starting'
let aiError = null

ipcMain.handle('get-ai-status', () =>
  aiStatus === 'error' ? { state: 'error', message: aiError } : aiStatus
)

ipcMain.handle('get-entity-attributes', (_e, personaId) => jwtIssuer.getEntityAttributes(personaId))

/**
 * The seeded vocabulary, for the attribute picker.
 *
 * Read from the same ATTRIBUTE_DEFS the AI seeder used, so the picker can only ever offer values
 * the platform actually created. Offering one it did not would produce a policy that denies
 * everybody, with nothing in the UI to explain why.
 *
 * `modeId` is optional and only matters inside a user-built scenario: that scenario's own
 * vocabulary is appended, so uploading into it can tag with the attributes it invented. Other
 * scenarios' vocabulary is deliberately left out — it exists on the platform, but offering it
 * here would let a DoW upload be tagged with a caveat nobody in DoW has ever heard of.
 */
ipcMain.handle('get-attribute-defs', (_e, modeId = undefined) => {
  const own = modeId
    ? (aiScenarios.list(app).find(s => s.id === modeId)?.vocabulary ?? [])
        .filter(d => !aiIdentities.BUILTIN_DEFS_BY_NAME.has(d.name))
    : []
  return {
    namespace: aiIdentities.NS,
    hierarchy: aiIdentities.CLEARANCE_HIERARCHY,
    defs: [...aiIdentities.ATTRIBUTE_DEFS, ...own].map(d => ({
      name: d.name,
      values: d.values,
      hierarchy: d.rule.endsWith('HIERARCHY'),
    })),
  }
})

ipcMain.handle('open-file', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'TDF or text', extensions: ['tdf', 'txt', 'md', 'json', 'csv'] },
      { name: 'TDF Archive', extensions: ['tdf'] },
      { name: 'All Files',   extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths?.length) return null
  const filePath = filePaths[0]
  // Bytes, not text: the renderer has to sniff the format before it knows how to decode.
  return { filename: path.basename(filePath), bytes: new Uint8Array(fs.readFileSync(filePath)) }
})

ipcMain.handle('list-uploads',  (_e, modeId)               => aiUploads.list(app, modeId))
ipcMain.handle('read-upload',   (_e, id)                   => aiUploads.read(app, id))
ipcMain.handle('delete-upload', (_e, id)                   => aiUploads.remove(app, id))
ipcMain.handle('add-upload',    (_e, { record, payload })  => aiUploads.add(app, record, payload))

// ── Scenarios the user built ──────────────────────────────────────────────────
//
// Two things have to happen for a scenario to be usable, and both are idempotent so they can be
// run on save, on import, and on every launch:
//
//   the platform learns its vocabulary   — attribute definitions and subject mappings, written by
//                                          the same seeder functions the shipped modes go through
//   the issuer learns its identities     — so its personas and agents can be handed real tokens
//
// `activateScenario` does both. It is deliberately not gated on a version marker the way the
// built-in seeds are: a scenario is created at a moment the user chose and has to work at that
// moment, and re-running it costs a few hundred milliseconds of already-exists responses.

/**
 * Teach the platform and the issuer about one scenario.
 *
 * Identity registration is attempted per subject rather than all-or-nothing, so one bad id cannot
 * cost a scenario its other nine personas — the failure is logged and that subject simply has no
 * token, which surfaces in the UI as a persona who cannot decrypt anything.
 */
async function activateScenario(scenario) {
  const defs = aiScenarios.scenarioDefs(scenario)
  const identityTable = aiScenarios.scenarioIdentities(scenario)

  for (const [id, identity] of Object.entries(identityTable)) {
    try {
      jwtIssuer.registerIdentity(id, identity, defs)
    } catch (err) {
      log.warn(`[main] Scenario ${scenario.id}: could not register "${id}": ${err.message}`)
    }
  }

  const adminToken = jwtIssuer.issueToken('admin').access_token
  return aiSeeder.seedScenario(adminToken, { ...scenario, identities: identityTable })
}

ipcMain.handle('list-scenarios',    ()            => aiScenarios.list(app))
ipcMain.handle('new-scenario-id',   ()            => aiScenarios.newId())
ipcMain.handle('validate-scenario', (_e, scenario) => aiScenarios.validate(scenario))

ipcMain.handle('save-scenario', async (_e, scenario) => {
  const stored = aiScenarios.save(app, scenario)
  await activateScenario(stored)
  return stored
})

ipcMain.handle('delete-scenario', (_e, id) => {
  const identityIds = aiScenarios.remove(app, id)
  if (!identityIds) return false
  // The platform keeps the definitions and mappings on purpose — see electron/ai-scenarios.js.
  // What does go away is the ability to be issued a token as one of these subjects.
  for (const identityId of identityIds) jwtIssuer.unregisterIdentity(identityId)
  return true
})

/**
 * Write a scenario out as a shareable file.
 *
 * The bundle is the scenario itself: vocabulary, personas, agents, and documents as **plaintext
 * plus policy**. No ciphertext, because a TDF's key is wrapped to the KAS that made it and would
 * be undecryptable on the recipient's machine. Import re-encrypts against their KAS, which is
 * what lets a scenario be shared at all.
 */
ipcMain.handle('export-scenario', async (_e, scenario) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: `${scenario.name?.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'scenario'}.vsai-scenario.json`,
    filters: [{ name: 'Scenario bundle', extensions: ['json'] }],
  })
  if (canceled || !filePath) return null
  fs.writeFileSync(filePath, JSON.stringify(scenario, null, 2))
  return filePath
})

/**
 * Read a scenario bundle, re-id it, and activate it.
 *
 * The re-id itself lives in electron/ai-scenarios.js, next to the validation it has to satisfy.
 */
ipcMain.handle('import-scenario', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Scenario bundle', extensions: ['json'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  if (canceled || !filePaths?.length) return null

  let bundle
  try {
    bundle = JSON.parse(fs.readFileSync(filePaths[0], 'utf8'))
  } catch (err) {
    throw new Error(`That file is not readable JSON: ${err.message}`)
  }
  if (bundle?.format !== aiScenarios.FORMAT) {
    throw new Error('That file is not a Virtru Secure AI scenario bundle.')
  }
  if (bundle.formatVersion > aiScenarios.FORMAT_VERSION) {
    throw new Error(
      `That bundle was written by a newer version of this app (format ${bundle.formatVersion}, ` +
      `this build understands ${aiScenarios.FORMAT_VERSION}). Update and try again.`
    )
  }

  const reIded = aiScenarios.reId(bundle, aiScenarios.newId())
  const problems = aiScenarios.validate(reIded)
  if (problems.length) {
    throw new Error(`That bundle is not valid:\n• ${problems.join('\n• ')}`)
  }

  const stored = aiScenarios.save(app, reIded)
  await activateScenario(stored)
  return stored
})

/**
 * Seed the AI vocabulary and re-teach the platform every scenario the user has built.
 *
 * Runs after the seed every other page depends on, and reports through its own status channel, so
 * a failure in here leaves the rest of the app exactly as it would have been.
 */
async function bootAi(userDataPath) {
  try {
    const adminToken = jwtIssuer.issueToken('admin').access_token
    await aiSeeder.seedAi(adminToken, path.join(userDataPath, 'seeded-ai.txt'))
  } catch (err) {
    aiStatus = 'error'
    aiError = err.message
    log.error('[main] AI seed failed:', err.message)
    mainWindow?.webContents.send('ai-status', { state: 'error', message: err.message })
    return
  }

  // Scenarios the user built have to be re-taught to the platform and the issuer on every launch:
  // the issuer's identity tables are in memory, and the policy store may have been reset out from
  // under us. Each is activated independently so one broken scenario cannot cost the others — and
  // a failure here never blocks anything, because the four shipped modes do not depend on any of it.
  for (const scenario of aiScenarios.list(app)) {
    try {
      await activateScenario(scenario)
    } catch (err) {
      log.warn(`[main] Could not activate scenario "${scenario.name}" (${scenario.id}): ${err.message}`)
    }
  }

  // Free-play edits live in the platform's database and outlive the session that made them, so every
  // launch puts the GCAP people back on their shipped grants. Never fatal: at worst a demo starts
  // with last session's edits, which the in-page reset clears.
  try {
    const r = await gcapGrants.reset(jwtIssuer.issueToken('admin').access_token, jwtIssuer)
    log.info(`[main] GCAP people reconciled — ${r.created} mapping(s) created, ${r.deleted} removed`)
  } catch (err) {
    log.warn('[main] GCAP reconcile failed:', err.message)
  }

  aiStatus = 'ready'
  mainWindow?.webContents.send('ai-status', 'ready')
  log.info('[main] AI Protection ready')
}

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
    mainWindow.webContents.send('ai-status', aiStatus)
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
    // Nothing downstream can succeed without a platform, so the AI page is told too rather than
    // being left waiting on a 'starting' that will never resolve.
    aiStatus = 'error'
    aiError = err.message
    if (mainWindow) mainWindow.webContents.send('ai-status', { state: 'error', message: err.message })
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

  // 6. Seed what the AI Protection page needs, then activate any scenarios the user built.
  //    Deliberately after step 5 and behind its own status channel — see bootAi.
  await bootAi(userDataPath)

  // 7. Check for updates (packaged builds only) — on launch + every 30 minutes
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
