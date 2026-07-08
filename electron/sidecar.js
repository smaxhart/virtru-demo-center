/**
 * OpenTDF platform sidecar — spawns the Go binary, monitors health, restarts on crash.
 */

const { spawn } = require('child_process')
const http = require('http')
const path = require('path')
const fs = require('fs')

const PLATFORM_PORT = 7777
const HEALTH_URL = `http://localhost:${PLATFORM_PORT}/healthz`
const MAX_RESTARTS = 3
const HEALTH_POLL_MS = 500
const HEALTH_TIMEOUT_MS = 30000

let proc = null
let restarts = 0
let stopped = false

function getBinaryPath(app) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin', 'opentdf-platform')
  }
  return path.join(__dirname, '..', 'resources', 'bin', 'opentdf-platform-darwin-arm64')
}

function getConfigPath(app) {
  // At runtime we write a resolved config to userData (so key paths are absolute)
  return path.join(app.getPath('userData'), 'opentdf.yaml')
}

function writeRuntimeConfig(app, issuerUrl) {
  const keyDir = path.join(app.getPath('userData'), 'keys')
  const kasPriv = path.join(keyDir, 'kas-private.pem')
  const kasCert = path.join(keyDir, 'kas-cert.pem')

  // Generate KAS keypair + self-signed cert if not present
  if (!fs.existsSync(kasPriv)) {
    fs.mkdirSync(keyDir, { recursive: true })
    const { execFileSync } = require('child_process')
    const OPENSSL = '/usr/bin/openssl'
    // Generate private key
    execFileSync(OPENSSL, [
      'genrsa', '-out', kasPriv, '2048',
    ])
    fs.chmodSync(kasPriv, 0o600)
    // Self-signed certificate
    execFileSync(OPENSSL, [
      'req', '-new', '-x509',
      '-key', kasPriv,
      '-out', kasCert,
      '-days', '3650',
      '-subj', '/CN=kas-demo/O=Virtru/C=US',
    ])
  }

  const dbPath = path.join(app.getPath('userData'), 'platform.db')

  const config = `
mode: all

logger:
  level: info
  type: json
  output: stdout

db:
  file: "${dbPath}"

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
      if (Date.now() > deadline) return reject(new Error('Platform health check timed out'))
      http.get(HEALTH_URL, res => {
        if (res.statusCode === 200) return resolve()
        setTimeout(check, HEALTH_POLL_MS)
      }).on('error', () => setTimeout(check, HEALTH_POLL_MS))
    }
    check()
  })
}

function spawnPlatform(binaryPath, configPath) {
  console.log(`[sidecar] Spawning: ${binaryPath}`)
  proc = spawn(binaryPath, ['start', '--config-file', configPath], {
    stdio: 'pipe',
    env: { ...process.env, GOMAXPROCS: '2' },
  })

  proc.stdout.on('data', d => process.stdout.write(`[platform] ${d}`))
  proc.stderr.on('data', d => process.stderr.write(`[platform] ${d}`))

  proc.on('exit', (code, signal) => {
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

  writeRuntimeConfig(app, issuerUrl)
  spawnPlatform(binaryPath, getConfigPath(app))

  console.log('[sidecar] Waiting for platform health check...')
  await pollHealth(HEALTH_TIMEOUT_MS)
  console.log('[sidecar] Platform is healthy')
}

function stop() {
  stopped = true
  if (proc && !proc.killed) {
    proc.kill('SIGTERM')
    proc = null
  }
}

module.exports = { start, stop, PLATFORM_PORT }
