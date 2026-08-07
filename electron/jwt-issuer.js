/**
 * In-process OIDC/JWT issuer — replaces Keycloak entirely.
 * Generates an RSA-2048 keypair on first launch, persists it to userData,
 * serves a JWKS + OIDC discovery endpoint, and issues signed JWTs per persona.
 */

const crypto = require('crypto')
const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = 7779
const ISSUER = `http://localhost:${PORT}`
const KID = 'demo-key-1'

// Persona → attribute claims the JWT will carry
// Keys must match persona.id values in sectors.js FEDERAL_PERSONAS
// All personas need realm_access.roles: ["opentdf-standard"] so the platform's
// Casbin RBAC middleware allows them to call the KAS rewrap endpoint.
// The actual attribute-based access control happens after that check.
// All personas need:
//   realm_access.roles: ["opentdf-standard"] — passes Casbin RBAC gate on the platform API
//   azp: "demo-client"                       — required by authz v2 to contextualize the decision
const STD = { azp: 'demo-client', realm_access: { roles: ['opentdf-standard'] } }

const PERSONA_CLAIMS = {
  'sarah':    { sub: 'sarah',    name: 'Maj. Sarah Williams',  'clearance': 'ts-sci', 'mission': 'intel',    'role': 'analyst',    'nationality': 'USA', 'relto': 'fvey', ...STD },
  'james':    { sub: 'james',    name: 'CPT. James Rivera',    'clearance': 'secret', 'mission': 'external', 'role': 'contractor', 'nationality': 'USA', 'relto': 'fvey', ...STD },
  'patricia': { sub: 'patricia', name: 'Col. Patricia Lee',    'clearance': 'secret', 'mission': 'legal',    'role': 'counsel',    'nationality': 'USA', 'relto': 'fvey', ...STD },
  'marcus':   { sub: 'marcus',   name: 'CW3 Marcus Johnson',   'clearance': 'secret', 'mission': 'cyber',    'role': 'admin',      'nationality': 'USA', 'relto': 'fvey', ...STD },
  'fvey-uk':  { sub: 'fvey-uk',  name: 'Flt Lt Emma Clarke',   'clearance': 'secret', 'nationality': 'GBR',  'relto': 'fvey', ...STD },
  'nato-fr':  { sub: 'nato-fr',  name: 'Maj. Henri Dubois',    'clearance': 'secret', 'nationality': 'FRA',  'relto': 'nato', ...STD },
  'nato-de':  { sub: 'nato-de',  name: 'Maj. Klaus Richter',   'clearance': 'secret', 'nationality': 'DEU',  'relto': 'nato', ...STD },
  'generic':      { sub: 'generic',      name: 'Generic User', ...STD },
  'admin':        { sub: 'admin',        name: 'Platform Admin', azp: 'demo-client', 'clearance': 'ts-sci', 'mission': 'admin', 'role': 'admin', 'nationality': 'USA', 'realm_access': { roles: ['opentdf-admin', 'opentdf-standard'] } },
  'ai-intel':     { sub: 'ai-intel',     name: 'Intel Analyst AI',  'clearance': 'ts-sci', 'mission': 'intel',  'relto': 'fvey', ...STD },
  'ai-ops':       { sub: 'ai-ops',       name: 'Ops Assistant AI',  'clearance': 'secret', 'mission': 'ops',   'relto': 'nato', ...STD },
  'ai-logistics': { sub: 'ai-logistics', name: 'Logistics AI', ...STD },
}

let privateKey = null
let publicKey = null
let server = null

function loadOrGenerateKeys(userDataPath) {
  const keyDir = path.join(userDataPath, 'keys')
  const privPath = path.join(keyDir, 'issuer-private.pem')
  const pubPath = path.join(keyDir, 'issuer-public.pem')

  if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
    privateKey = crypto.createPrivateKey(fs.readFileSync(privPath))
    publicKey = crypto.createPublicKey(fs.readFileSync(pubPath))
    console.log('[jwt-issuer] Loaded existing keypair')
    return
  }

  fs.mkdirSync(keyDir, { recursive: true })
  const pair = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding:  { type: 'spki',  format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  fs.writeFileSync(privPath, pair.privateKey, { mode: 0o600 })
  fs.writeFileSync(pubPath,  pair.publicKey)
  privateKey = crypto.createPrivateKey(pair.privateKey)
  publicKey  = crypto.createPublicKey(pair.publicKey)
  console.log('[jwt-issuer] Generated new RSA-2048 keypair')
}

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function getJwks() {
  const pub = publicKey.export({ type: 'spki', format: 'der' })
  // Parse SPKI to extract modulus and exponent
  // SPKI = SEQUENCE { SEQUENCE { OID, NULL }, BIT STRING { 0x00, SEQUENCE { INTEGER n, INTEGER e } } }
  const parsed = crypto.createPublicKey({ key: pub, format: 'der', type: 'spki' })
  const jwk = parsed.export({ format: 'jwk' })
  return {
    keys: [{
      kty: 'RSA',
      use: 'sig',
      alg: 'RS256',
      kid: KID,
      n: jwk.n,
      e: jwk.e,
    }]
  }
}

function issueToken(personaId, expiresInSeconds = 3600) {
  const claims = PERSONA_CLAIMS[personaId]
  if (!claims) throw new Error(`Unknown persona: ${personaId}`)

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid: KID }
  const payload = {
    ...claims,
    iss: ISSUER,
    aud: ['demo-client', 'opentdf-sdk'],
    iat: now,
    exp: now + expiresInSeconds,
    jti: crypto.randomUUID(),
    // OpenTDF SDK / KAS uses these for entitlement resolution
    'tdf_claims': {
      entitlements: [{
        entity_identifier: claims.sub,
        entity_attributes: buildEntityAttributes(claims),
      }]
    },
  }

  const headerB64  = base64url(Buffer.from(JSON.stringify(header)))
  const payloadB64 = base64url(Buffer.from(JSON.stringify(payload)))
  const signing    = `${headerB64}.${payloadB64}`
  const sig = crypto.sign('sha256', Buffer.from(signing), { key: privateKey, padding: crypto.constants.RSA_PKCS1_PADDING })

  return {
    access_token: `${signing}.${base64url(sig)}`,
    token_type: 'Bearer',
    expires_in: expiresInSeconds,
  }
}

// Clearance ranks highest→lowest; a holder gets this level and everything below it
const CLEARANCE_HIERARCHY = ['ts-sci', 'secret', 'cui', 'unclassified']

const FVEY_NATIONS = new Set(['USA', 'AUS', 'CAN', 'GBR', 'NZL'])
const NATO_NATIONS = new Set([
  'USA', 'CAN', 'GBR', 'FRA', 'BEL', 'NLD', 'LUX', 'NOR', 'DNK', 'ISL', 'ITA', 'PRT',
  'GRC', 'TUR', 'DEU', 'ESP', 'HUN', 'POL', 'CZE', 'BGR', 'EST', 'LVA', 'LTU', 'ROU',
  'SVK', 'SVN', 'ALB', 'HRV', 'MNE', 'MKD', 'FIN', 'SWE',
])

function buildEntityAttributes(claims) {
  const NS = 'https://demo.com/attr'
  const attrs = []

  // Expand clearance downward so KAS string-matching honors hierarchy
  if (claims.clearance) {
    const idx = CLEARANCE_HIERARCHY.indexOf(claims.clearance)
    for (let i = idx >= 0 ? idx : 0; i < CLEARANCE_HIERARCHY.length; i++) {
      attrs.push({ attribute: `${NS}/clearance/value/${CLEARANCE_HIERARCHY[i]}` })
    }
  }

  if (claims.mission)     attrs.push({ attribute: `${NS}/mission/value/${claims.mission}` })
  if (claims.role)        attrs.push({ attribute: `${NS}/role/value/${claims.role}` })
  if (claims.nationality) attrs.push({ attribute: `${NS}/nationality/value/${claims.nationality}` })

  // Derive coalition access from nationality; fall back to explicit relto for personas without one
  const coalitions = new Set()
  const nat = claims.nationality
  if (nat && FVEY_NATIONS.has(nat)) coalitions.add('fvey')
  if (nat && NATO_NATIONS.has(nat)) coalitions.add('nato')
  if (claims.relto && !coalitions.size) coalitions.add(claims.relto)
  for (const c of coalitions) {
    attrs.push({ attribute: `${NS}/relto/value/${c}` })
  }

  return attrs
}

function startServer() {
  return new Promise((resolve, reject) => {
    server = http.createServer((req, res) => {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Content-Type', 'application/json')

      if (req.url === '/.well-known/jwks.json') {
        res.end(JSON.stringify(getJwks()))
      } else if (req.url === '/.well-known/openid-configuration') {
        res.end(JSON.stringify({
          issuer: ISSUER,
          jwks_uri: `${ISSUER}/.well-known/jwks.json`,
          token_endpoint: `${ISSUER}/token`,
          response_types_supported: ['token'],
          subject_types_supported: ['public'],
          id_token_signing_alg_values_supported: ['RS256'],
        }))
      } else if (req.url === '/token' && req.method === 'POST') {
        // Simple token endpoint — reads persona from form body
        let body = ''
        req.on('data', d => { body += d })
        req.on('end', () => {
          const params = new URLSearchParams(body)
          const personaId = params.get('username') || params.get('client_id') || 'admin'
          try {
            res.end(JSON.stringify(issueToken(personaId)))
          } catch (e) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: e.message }))
          }
        })
      } else {
        res.statusCode = 404
        res.end('{}')
      }
    })

    server.listen(PORT, '127.0.0.1', () => {
      console.log(`[jwt-issuer] Listening on ${ISSUER}`)
      resolve()
    })
    server.on('error', reject)
  })
}

function stop() {
  return new Promise(resolve => {
    if (server) server.close(resolve)
    else resolve()
  })
}

module.exports = { loadOrGenerateKeys, startServer, issueToken, stop, ISSUER, PERSONA_CLAIMS }
