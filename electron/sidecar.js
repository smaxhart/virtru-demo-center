/**
 * OpenTDF platform sidecar — starts embedded Postgres, then spawns the Go binary.
 */

const { spawn, execFileSync } = require('child_process')
const http = require('http')
const net = require('net')
const path = require('path')
const fs = require('fs')

const PLATFORM_PORT = 7777
const PG_PORT = 7778
const PG_USER = 'postgres'
const PG_PASSWORD = 'demo'
const PG_DATABASE = 'opentdf'

const HEALTH_URL = `http://localhost:${PLATFORM_PORT}/healthz`
const MAX_RESTARTS = 3
const HEALTH_POLL_MS = 500
const HEALTH_TIMEOUT_MS = 30000
const HEALTH_REQ_TIMEOUT_MS = 1500

let pgProc = null
let platformProc = null
let restarts = 0
let stopped = false
let lastStderr = ''

function getPostgresBinDir(app) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'postgres', 'bin')
  }
  return path.join(__dirname, '..', 'resources', 'postgres', 'bin')
}

function getBinaryPath(app) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'opentdf-platform')
  }
  return path.join(__dirname, '..', 'resources', 'bin', 'opentdf-platform-darwin-arm64')
}

function getConfigPath(app) {
  return path.join(app.getPath('userData'), 'opentdf.yaml')
}

function checkPortFree(port) {
  return new Promise(resolve => {
    const test = net.createServer()
    test.once('error', () => resolve(false))
    test.once('listening', () => { test.close(); resolve(true) })
    test.listen(port, '127.0.0.1')
  })
}

function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    function check() {
      if (Date.now() > deadline) return reject(new Error(`Timed out waiting for port ${port}`))
      const sock = net.createConnection(port, '127.0.0.1')
      sock.once('connect', () => { sock.destroy(); resolve() })
      sock.once('error', () => setTimeout(check, 300))
    }
    check()
  })
}

/**
 * Sends a single SQL statement to Postgres via the wire protocol (no psql needed).
 * Uses trust auth — only works after pg_hba.conf is set to trust for 127.0.0.1.
 */
function pgExec(database, sql) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection(PG_PORT, '127.0.0.1')
    let done = false
    const finish = (err) => { if (!done) { done = true; sock.destroy(); err ? reject(err) : resolve() } }

    // Build startup message: user + database
    function buildStartup() {
      const params = `user\0${PG_USER}\0database\0${database}\0\0`
      const len = 4 + 4 + params.length
      const buf = Buffer.allocUnsafe(len)
      buf.writeInt32BE(len, 0)
      buf.writeInt32BE(196608, 4) // protocol 3.0
      Buffer.from(params).copy(buf, 8)
      return buf
    }

    // Build simple query message
    function buildQuery(q) {
      const str = q + '\0'
      const buf = Buffer.allocUnsafe(1 + 4 + str.length)
      buf.write('Q', 0)
      buf.writeInt32BE(4 + str.length, 1)
      Buffer.from(str).copy(buf, 5)
      return buf
    }

    let phase = 'startup'
    let buf = Buffer.alloc(0)

    sock.on('connect', () => sock.write(buildStartup()))
    sock.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      while (buf.length >= 5) {
        const type = String.fromCharCode(buf[0])
        const msgLen = buf.readInt32BE(1)
        if (buf.length < 1 + msgLen) break
        const body = buf.slice(5, 1 + msgLen)
        buf = buf.slice(1 + msgLen)

        if (type === 'E') { // ErrorResponse
          const msg = body.toString('utf8')
          if (msg.includes('already exists')) return finish()
          return finish(new Error(`pgExec error: ${msg}`))
        }
        if (phase === 'startup' && type === 'R') { // AuthenticationOk (should be 0 for trust)
          phase = 'ready'
        }
        if (type === 'Z') { // ReadyForQuery
          if (phase === 'ready') {
            phase = 'query'
            sock.write(buildQuery(sql))
          } else if (phase === 'query') {
            finish()
          }
        }
      }
    })
    sock.on('error', finish)
    sock.setTimeout(5000, () => finish(new Error('pgExec timed out')))
  })
}

async function startPostgres(app) {
  const pgBin = getPostgresBinDir(app)
  const initdb = path.join(pgBin, 'initdb')
  const pgCtl = path.join(pgBin, 'pg_ctl')
  const dataDir = path.join(app.getPath('userData'), 'pgdata')
  const pgLog = path.join(app.getPath('userData'), 'postgres.log')

  // Fix permissions on binaries — xattr stripping can remove exec bit on some machines
  for (const bin of [initdb, pgCtl, path.join(pgBin, 'postgres')]) {
    try { fs.chmodSync(bin, 0o755) } catch (_) {}
  }

  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log('[sidecar] Initializing Postgres cluster...')
    fs.mkdirSync(dataDir, { recursive: true })
    execFileSync(initdb, [
      '-D', dataDir,
      '-U', PG_USER,
      '--auth=trust',
      '--encoding=UTF8',
    ], { env: { ...process.env, LC_ALL: 'en_US.UTF-8' } })

    // Use trust for all local connections — this is a loopback-only embedded DB
    const hba = [
      'local   all             all                                     trust',
      'host    all             all             127.0.0.1/32            trust',
      'host    all             all             ::1/128                 trust',
    ].join('\n') + '\n'
    fs.writeFileSync(path.join(dataDir, 'pg_hba.conf'), hba)
    const pgConf = path.join(dataDir, 'postgresql.conf')
    fs.appendFileSync(pgConf, `\nport = ${PG_PORT}\n`)
  }

  console.log(`[sidecar] Starting Postgres on port ${PG_PORT}...`)
  pgProc = spawn(pgCtl, [
    'start',
    '-D', dataDir,
    '-l', pgLog,
    '-o', `-p ${PG_PORT}`,
    '-w',
  ], {
    stdio: 'pipe',
    env: { ...process.env },
  })

  pgProc.stdout.on('data', d => console.log(`[postgres] ${d.toString().trim()}`))
  pgProc.stderr.on('data', d => console.error(`[postgres] ${d.toString().trim()}`))

  pgProc.on('exit', (code) => {
    // pg_ctl start -w exits 0 after the server is ready — that's normal
    if (!stopped && code !== 0) console.warn(`[sidecar] pg_ctl exited with code ${code}`)
  })

  // pg_ctl -w waits until the server is ready, but wait for port just in case
  await waitForPort(PG_PORT, 20000)
  console.log('[sidecar] Postgres is ready')

  // Create the opentdf database — required before OpenTDF's runMigrations runs.
  // No psql is bundled, so use the minimal PG wire protocol directly.
  await pgExec('postgres', `CREATE DATABASE ${PG_DATABASE}`)
}

function stopPostgres(app) {
  const pgBin = getPostgresBinDir(app)
  const pgCtl = path.join(pgBin, 'pg_ctl')
  const dataDir = path.join(app.getPath('userData'), 'pgdata')
  try {
    execFileSync(pgCtl, ['stop', '-D', dataDir, '-m', 'fast'], { stdio: 'pipe' })
  } catch (_) {}
}

function writeRuntimeConfig(app, issuerUrl) {
  const keyDir = path.join(app.getPath('userData'), 'keys')
  const kasPriv = path.join(keyDir, 'kas-private.pem')
  const kasCert = path.join(keyDir, 'kas-cert.pem')

  if (!fs.existsSync(kasPriv)) {
    fs.mkdirSync(keyDir, { recursive: true })
    const OPENSSL = '/usr/bin/openssl'
    execFileSync(OPENSSL, ['genrsa', '-out', kasPriv, '2048'])
    fs.chmodSync(kasPriv, 0o600)
    execFileSync(OPENSSL, [
      'req', '-new', '-x509',
      '-key', kasPriv, '-out', kasCert,
      '-days', '3650', '-subj', '/CN=kas-demo/O=Virtru/C=US',
    ])
  }

  const config = `
mode: all

logger:
  level: info
  type: json
  output: stdout

db:
  host: "127.0.0.1"
  port: ${PG_PORT}
  database: "${PG_DATABASE}"
  user: "${PG_USER}"
  password: "${PG_PASSWORD}"
  sslmode: "disable"
  runMigrations: true

server:
  port: ${PLATFORM_PORT}
  grpcGatewayEnabled: true
  auth:
    enabled: true
    publicRoutes:
      - "/healthz"
      - "/kas/v2/kas_public_key"
    issuer: "${issuerUrl}"
    audience: "demo-client"
    policy:
      groups_claim: "realm_access.roles"
      extension: |
        g, opentdf-admin, role:admin
        g, opentdf-standard, role:standard
  cryptoProvider:
    type: standard
    standard:
      keys:
        - kid: r1
          alg: rsa:2048
          private: "${kasPriv}"
          cert: "${kasCert}"

services:
  entityresolution:
    mode: claims
  kas:
    keyring:
      - kid: r1
        alg: rsa:2048
      - kid: r1
        alg: rsa:2048
        legacy: true
`.trim()

  fs.writeFileSync(getConfigPath(app), config)
}

function pollHealth(timeoutMs) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + timeoutMs
    function check() {
      if (Date.now() > deadline) {
        const detail = lastStderr ? `\n\nPlatform output:\n${lastStderr.slice(-800)}` : ''
        return reject(new Error(`Platform health check timed out after ${timeoutMs / 1000}s${detail}`))
      }
      const req = http.get(HEALTH_URL, res => {
        res.resume()
        if (res.statusCode === 200) return resolve()
        setTimeout(check, HEALTH_POLL_MS)
      })
      req.setTimeout(HEALTH_REQ_TIMEOUT_MS, () => {
        req.destroy()
        setTimeout(check, HEALTH_POLL_MS)
      })
      req.on('error', () => setTimeout(check, HEALTH_POLL_MS))
    }
    check()
  })
}

function spawnPlatform(binaryPath, configPath) {
  console.log(`[sidecar] Spawning: ${binaryPath}`)
  platformProc = spawn(binaryPath, ['start', '--config-file', configPath], {
    stdio: 'pipe',
    env: { ...process.env, GOMAXPROCS: '2' },
  })

  platformProc.stdout.on('data', d => process.stdout.write(`[platform] ${d}`))
  platformProc.stderr.on('data', d => {
    const s = d.toString()
    lastStderr += s
    if (lastStderr.length > 2048) lastStderr = lastStderr.slice(-2048)
    process.stderr.write(`[platform] ${s}`)
  })

  platformProc.on('exit', (code, signal) => {
    if (stopped) return
    console.warn(`[sidecar] Platform exited (code=${code} signal=${signal}), restart ${restarts + 1}/${MAX_RESTARTS}`)
    if (restarts < MAX_RESTARTS) {
      restarts++
      setTimeout(() => spawnPlatform(binaryPath, configPath), 1000)
    }
  })
}

async function start(app, issuerUrl) {
  const binaryPath = getBinaryPath(app)
  if (!fs.existsSync(binaryPath)) {
    throw new Error(
      `OpenTDF platform binary not found at:\n${binaryPath}\n\nRun: npm run build:platform`
    )
  }

  const platformPortFree = await checkPortFree(PLATFORM_PORT)
  if (!platformPortFree) {
    throw new Error(
      `Port ${PLATFORM_PORT} is already in use.\n\nAnother process is occupying the port the platform needs. ` +
      `Close the conflicting app, then relaunch Virtru Demo Center.`
    )
  }

  const pgPortFree = await checkPortFree(PG_PORT)
  if (!pgPortFree) {
    throw new Error(
      `Port ${PG_PORT} is already in use.\n\nThis port is needed for the embedded database. ` +
      `Close any conflicting app, then relaunch Virtru Demo Center.`
    )
  }

  await startPostgres(app)

  writeRuntimeConfig(app, issuerUrl)
  spawnPlatform(binaryPath, getConfigPath(app))

  console.log('[sidecar] Waiting for platform health check...')
  await pollHealth(HEALTH_TIMEOUT_MS)
  console.log('[sidecar] Platform is healthy')
}

function stop(app) {
  stopped = true
  if (platformProc && !platformProc.killed) {
    platformProc.kill('SIGTERM')
    platformProc = null
  }
  if (app) {
    try { stopPostgres(app) } catch (_) {}
  }
}

module.exports = { start, stop, PLATFORM_PORT }
