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
  'sarah':    { sub: 'sarah',    name: 'Maj. Sarah Williams',  'clearance': 'ts-sci', 'mission': 'intel',    'role': 'analyst',    'nationality': 'USA', 'relto': ['fvey', 'nato'], ...STD },
  'james':    { sub: 'james',    name: 'CPT. James Rivera',    'clearance': 'secret', 'mission': 'external', 'role': 'contractor', 'nationality': 'USA', 'relto': ['fvey', 'nato'], ...STD },
  'patricia': { sub: 'patricia', name: 'Col. Patricia Lee',    'clearance': 'secret', 'mission': 'legal',    'role': 'counsel',    'nationality': 'USA', 'relto': ['fvey', 'nato'], ...STD },
  'marcus':   { sub: 'marcus',   name: 'CW3 Marcus Johnson',   'clearance': 'secret', 'mission': 'cyber',    'role': 'admin',      'nationality': 'USA', 'relto': ['fvey', 'nato'], ...STD },
  'fvey-uk':  { sub: 'fvey-uk',  name: 'Flt Lt Emma Clarke',   'clearance': 'secret', 'nationality': 'GBR',  'relto': ['fvey', 'nato'], ...STD },
  'nato-fr':  { sub: 'nato-fr',  name: 'Maj. Henri Dubois',    'clearance': 'secret', 'nationality': 'FRA',  'relto': ['nato'], ...STD },
  'nato-de':  { sub: 'nato-de',  name: 'Maj. Klaus Richter',   'clearance': 'secret', 'nationality': 'DEU',  'relto': ['nato'], ...STD },
  'generic':      { sub: 'generic',      name: 'Generic User', ...STD },
  'admin':        { sub: 'admin',        name: 'Platform Admin', azp: 'demo-client', 'clearance': 'ts-sci', 'mission': 'admin', 'role': 'admin', 'nationality': 'USA', 'realm_access': { roles: ['opentdf-admin', 'opentdf-standard'] } },
  'ai-intel':     { sub: 'ai-intel',     name: 'Intel Analyst AI',  'clearance': 'ts-sci', 'mission': 'intel',  ...STD },
  'ai-ops':       { sub: 'ai-ops',       name: 'Ops Assistant AI',  'clearance': 'secret', 'mission': 'ops',    ...STD },
  'ai-logistics': { sub: 'ai-logistics', name: 'Logistics AI', ...STD },
}

// ── AI Protection identities ──────────────────────────────────────────────────
//
// The AI Protection page carries its own people and its own agents — five scenarios' worth, plus
// whatever a user-built scenario invents at runtime. They are folded into the same table so there
// is still exactly one issuer, one keypair and one JWKS the platform validates against.
//
// Two things keep this from touching what the rest of the app does:
//
//   Ids cannot collide. Every identity below is prefixed with its mode (`dow-`, `fc-`, `ic-`,
//   `le-`) and every scenario identity with its scenario id, so none of them can be the `sarah`
//   or `fvey-uk` the other pages issue. The loop skips an id that is already taken anyway, so the
//   table above wins on principle rather than by luck — `admin` is the one overlap, and its claims
//   stay exactly as they were.
//
//   Entity attributes are computed differently, and stay that way. The identities above resolve
//   through `buildEntityAttributes`, which reads a fixed set of claim fields. These resolve through
//   `grantsToFqns`, which walks the AI vocabulary's own definitions and knows which of them rank.
//   `PERSONA_FQNS` is what distinguishes the two: an id with an entry takes the new path, an id
//   without one takes the old, so every token the app issued before this page existed comes out
//   byte-for-byte the same.
const aiIdentities = require('./ai-identities.js')

/** Precomputed entity attribute FQNs, for AI and scenario identities only. */
const PERSONA_FQNS = {}

for (const [id, { name, grants }] of Object.entries(aiIdentities.IDENTITIES)) {
  if (PERSONA_CLAIMS[id]) {
    console.warn(`[jwt-issuer] AI identity "${id}" is already defined — keeping the existing claims`)
    continue
  }
  PERSONA_CLAIMS[id] = { sub: id, name, ...grants, ...STD }
  PERSONA_FQNS[id] = aiIdentities.grantsToFqns(grants)
}

// Neither table may be redefined by a scenario. Ids are prefixed, so a collision is already
// structurally impossible; this is the check that says so out loud, and it covers the pages that
// existed before the AI one as well as the AI one itself.
const RESERVED_IDENTITY_IDS = new Set([
  ...Object.keys(PERSONA_CLAIMS),
  ...aiIdentities.RESERVED_IDENTITY_IDS,
])

/**
 * Add an identity a user-built scenario brought with it.
 *
 * Called for every persona and agent in every saved scenario at launch, and again when one is
 * created or imported, so a scenario's people can be issued tokens without the app restarting.
 * The claims and the entity FQNs are built by the same two lines the built-in AI identities go
 * through, which is what keeps a scenario persona from being a second-class subject — the KAS has
 * no way to tell that this one was typed in this morning.
 *
 * Refuses to overwrite anything shipped. A scenario that could redefine `dow-sarah`, or `sarah`,
 * would silently change what an existing page does, and the failure would surface as a demo that
 * used to work and now does not.
 *
 * @param {string} id
 * @param {{name: string, grants: object}} identity
 * @param {Array} defs  the scenario's definitions, so HIERARCHY grants expand correctly
 */
function registerIdentity(id, { name, grants }, defs = undefined) {
  if (RESERVED_IDENTITY_IDS.has(id)) {
    throw new Error(`"${id}" is a built-in identity and cannot be redefined by a scenario`)
  }
  PERSONA_CLAIMS[id] = { sub: id, name, ...grants, ...STD }
  PERSONA_FQNS[id] = aiIdentities.grantsToFqns(grants, defs)
}

/**
 * Identities whose account has been disabled at the issuer.
 *
 * This is revocation as an identity provider does it: the account stops resolving to anything.
 * The token is still signed and still authenticates, but its subject is one no mapping names and
 * its entity attributes are empty, so the KAS has no entitlement to rewrap against. It does *not*
 * reach into a bearer token that was issued earlier — that stays valid until it expires, which is
 * why the GCAP talk track says so out loud. Only `gcap-` identities may be revoked, so a stray
 * request cannot disable a persona another page depends on.
 */
const REVOKED = new Set()
const REVOCABLE_PREFIX = 'gcap-'

function revokeIdentity(id) {
  if (!id.startsWith(REVOCABLE_PREFIX) || !PERSONA_CLAIMS[id]) return false
  REVOKED.add(id)
  return true
}

function restoreIdentity(id) {
  return REVOKED.delete(id)
}

function restoreAllIdentities() {
  const had = [...REVOKED]
  REVOKED.clear()
  return had
}

function revokedIdentities() {
  return [...REVOKED]
}

/**
 * GCAP free play: change what a `gcap-` identity's token carries, or create one that was never
 * shipped. The KAS does not read this (it resolves through subject mappings, see gcap-grants.js);
 * what this keeps honest is the issuer's own table, which the UI reads to explain a verdict.
 * Confined to the `gcap-` prefix so it can never touch another page's persona.
 */
function setGcapIdentity(id, { name, grants }) {
  if (!id.startsWith(REVOCABLE_PREFIX)) throw new Error(`"${id}" is not a GCAP identity`)
  PERSONA_CLAIMS[id] = { sub: id, name, ...grants, ...STD }
  PERSONA_FQNS[id] = aiIdentities.grantsToFqns(grants)
  return true
}

function dropGcapIdentity(id) {
  if (!id.startsWith(REVOCABLE_PREFIX) || aiIdentities.IDENTITIES[id]) return false
  delete PERSONA_CLAIMS[id]
  delete PERSONA_FQNS[id]
  REVOKED.delete(id)
  return true
}

/** Drop a scenario's identities when it is deleted, so its tokens stop being issuable. */
function unregisterIdentity(id) {
  if (RESERVED_IDENTITY_IDS.has(id)) return false
  delete PERSONA_CLAIMS[id]
  delete PERSONA_FQNS[id]
  return true
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
  const base = PERSONA_CLAIMS[personaId]
  if (!base) throw new Error(`Unknown persona: ${personaId}`)
  const revoked = REVOKED.has(personaId)
  // A revoked account keeps authenticating under a subject nothing maps, with nothing attached.
  const claims = revoked ? { ...base, sub: `${personaId}#revoked` } : base

  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT', kid: KID }
  const payload = {
    ...claims,
    iss: ISSUER,
    aud: ['demo-client', 'opentdf-sdk'],
    iat: now,
    exp: now + expiresInSeconds,
    jti: crypto.randomUUID(),
    // OpenTDF SDK / KAS uses these for entitlement resolution.
    // An AI or scenario identity has its FQNs precomputed from its grants; everyone else is
    // derived from their claim fields the way they always were. See PERSONA_FQNS above.
    'tdf_claims': {
      entitlements: [{
        entity_identifier: claims.sub,
        entity_attributes: revoked
          ? []
          : PERSONA_FQNS[personaId]
            ? PERSONA_FQNS[personaId].map(attribute => ({ attribute }))
            : buildEntityAttributes(claims),
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
  if (claims.nationality) attrs.push({ attribute: `${NS}/nationality/value/${claims.nationality.toLowerCase()}` })
  if (claims.relto)       claims.relto.forEach(r => attrs.push({ attribute: `${NS}/relto/value/${r}` }))

  return attrs
}

/**
 * The entity attribute FQNs the KAS will resolve a persona to, as plain strings.
 *
 * For the UI to render entitlements next to a persona. Both paths are covered so this answers for
 * any id in the table, not just the AI ones.
 */
function getEntityAttributes(personaId) {
  if (REVOKED.has(personaId)) return []
  if (PERSONA_FQNS[personaId]) return PERSONA_FQNS[personaId]
  const claims = PERSONA_CLAIMS[personaId]
  if (!claims) return []
  return buildEntityAttributes(claims).map(a => a.attribute)
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
      } else if ((req.url === '/revoke' || req.url === '/restore') && req.method === 'POST') {
        // Same trust level as /token above, which already mints a token for any persona by name.
        let body = ''
        req.on('data', d => { body += d })
        req.on('end', () => {
          const id = new URLSearchParams(body).get('username') || ''
          const ok = req.url === '/revoke'
            ? revokeIdentity(id)
            : (id === '*' ? (restoreAllIdentities(), true) : restoreIdentity(id))
          res.statusCode = ok ? 200 : 400
          res.end(JSON.stringify({ ok, revoked: revokedIdentities() }))
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

module.exports = {
  loadOrGenerateKeys, startServer, issueToken, stop,
  getEntityAttributes, registerIdentity, unregisterIdentity, setGcapIdentity, dropGcapIdentity,
  revokeIdentity, restoreIdentity, restoreAllIdentities, revokedIdentities,
  ISSUER, PORT, PERSONA_CLAIMS,
}
