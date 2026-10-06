import { useState } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import Icon from '../components/Icon.jsx'
import UiIcon from '../components/UiIcon.jsx'

// ── Node definitions ───────────────────────────────────────────────────────────
// Each node: x/y = top-left corner of the 160×88 card
const NODES = {
  client:    { id: 'client',    x: 60,  y: 200, label: 'Client App',        subtitle: 'Encrypts at source', icon: 'computer', desc: 'The application your users work in — browser, desktop, or mobile. This is where data gets encrypted before it ever leaves the device.' },
  kas:       { id: 'kas',       x: 370, y: 60,  label: 'KAS',               subtitle: 'Key Access Server',  icon: 'key', desc: 'Key Access Server — the enforcement point for every decrypt attempt. Supports three key management modes: Software (platform-managed keys), Envelope (HSM/KMS-wrapped keys with in-memory caching), and Delegated (all crypto in HSM/KMS). Compatible with AWS KMS, Thales Luna HSMs, and Entrust HSMs. Validates the user\'s JWT, checks entitlements, and either unwraps the DEK or returns 403.' },
  platform:  { id: 'platform',  x: 660, y: 200, label: 'Platform',          subtitle: 'Policy engine',      icon: 'gear', desc: 'OpenTDF Policy Engine — stores attribute definitions, subject mappings, and key management configuration. Supports three attribute rule types: HIERARCHY (clearance levels), ALL_OF (compartments), and ANY_OF (coalition groups). KAS calls here on every key request to evaluate entitlements.' },
  keycloak:  { id: 'keycloak',  x: 370, y: 340, label: 'IdP / Entitlements',subtitle: 'Identity provider',  icon: 'shield', desc: 'Identity Provider & Entitlement Service — issues signed JWTs and provides entity resolution data. Any OIDC IdP works: Keycloak, Okta, Ping, Entra ID, or ADFS. Subject Mappings link entities to Attribute Values via condition sets.' },
  datastore: { id: 'datastore', x: 60,  y: 340, label: 'Data Store',        subtitle: 'Any storage',        icon: 'server', desc: 'Where your encrypted TDF files live — S3, SharePoint, email, a database, or any storage. The data is worthless without the key, so the storage layer has zero ability to read content.' },
  tdf:       { id: 'tdf',       x: 660, y: 340, label: 'TDF Envelope',      subtitle: 'Encrypted container', icon: 'tdf-doc', desc: 'Trusted Data Format — a portable, self-describing encrypted container. Bundles the ciphertext, the policy binding, and the wrapped key object in one portable package. The same TDF enforces the same rules in S3, email, SharePoint, or on a USB drive.' },
  // Coalition KAS nodes (multi-KAS flow only)
  kas_usa:   { id: 'kas_usa',   x: 10,  y: 50,  label: 'USA KAS',      subtitle: 'FBI',   icon: 'key', desc: 'FBI Key Access Server — origin KAS that unwraps the DEK, then provides it to client for rewrapping to coalition partners.' },
  kas_uk:    { id: 'kas_uk',    x: 190, y: 50,  label: 'UK KAS',       subtitle: 'GCHQ',  icon: 'key', desc: 'GCHQ Key Access Server — DEK wrapped with UK public key for FVEY coalition sharing.' },
  kas_can:   { id: 'kas_can',   x: 370, y: 50,  label: 'CAN KAS',      subtitle: 'CSE',   icon: 'key', desc: 'CSE Key Access Server — DEK wrapped with Canada public key for FVEY coalition sharing.' },
  kas_aus:   { id: 'kas_aus',   x: 550, y: 50,  label: 'AUS KAS',      subtitle: 'ASD',   icon: 'key', desc: 'ASD Key Access Server — DEK wrapped with Australia public key for FVEY coalition sharing.' },
  kas_nzl:   { id: 'kas_nzl',   x: 730, y: 50,  label: 'NZL KAS',      subtitle: 'GCSB',  icon: 'key', desc: 'GCSB Key Access Server — DEK wrapped with New Zealand public key for FVEY coalition sharing.' },
}

// Node card dimensions
const NW = 160, NH = 86

const EDGES = [
  ['client',    'kas',       'Key request'],
  ['client',    'datastore', 'Store TDF'],
  ['kas',       'platform',  'Check entitlements'],
  ['kas',       'keycloak',  'Validate JWT'],
  ['client',    'tdf',       'Build TDF'],
  ['datastore', 'client',    'Retrieve TDF'],
  ['client',    'keycloak',  'Authenticate'],
  ['platform',  'client',    'Attribute policy'],
]

// ── Flow definitions ──────────────────────────────────────────────────────────
const ENCRYPT_FLOW = [
  { edge: ['client','kas'],       step: 1, label: 'Fetch KAS public key',    detail: 'Before encrypting anything, the client asks KAS for its public key — like asking for a padlock you can lock yourself. Only KAS holds the key to open it. This public key will wrap the data encryption key so only KAS can ever recover it.',                                                                       technical: 'GET /kas/v2/kas_public_key — returns RSA-2048 or EC P-256 public key. No auth required.' },
  { edge: ['kas','client'],       step: 2, label: 'KAS returns public key',  detail: 'KAS responds with its public key. The client now has everything it needs to lock data in a way only KAS can unlock. This key can be cached safely.',                                                                                                                                                                  technical: 'Response includes the public key PEM and a key identifier (kid) embedded in the TDF manifest.' },
  { edge: ['client','tdf'],       step: 3, label: 'Encrypt locally + wrap key', detail: 'The real work happens entirely on the client. A random 256-bit DEK is generated, data is encrypted with AES-256-GCM, then the DEK is wrapped with the KAS public key. Plaintext and the unprotected DEK never leave the device.',                                                                             technical: 'AES-256-GCM with random 96-bit IV. RSA-OAEP or ECDH for DEK wrapping. Assembled into a TDF (ZIP) container.' },
  { edge: ['client','datastore'], step: 4, label: 'Store encrypted TDF',     detail: 'The TDF is stored anywhere — S3, SharePoint, email, a database. The file is completely useless without KAS, which will only cooperate for users who satisfy the policy. Storage has zero ability to read the content.',                                                                                               technical: 'TDF archive contains manifest.json (policy binding, key access objects) and 0.payload (raw ciphertext).' },
]

const DECRYPT_FLOW = [
  { edge: ['datastore','client'], step: 1, label: 'Retrieve TDF from storage',     detail: 'A user tries to open the file. Their app fetches the TDF — still completely encrypted. The manifest tells the app what policy is bound to this data and which KAS instance holds the key.',                                                                                                                    technical: 'Client unzips TDF, parses manifest.json, extracts keyAccess object and base64-encoded policy.' },
  { edge: ['client','kas'],       step: 2, label: 'Send wrapped key + JWT to KAS', detail: 'The client sends the wrapped key to KAS along with a signed JWT — proof of who is asking. KAS uses this to decide whether the user deserves the key.',                                                                                                                                                         technical: 'POST /kas/v2/rewrap — body includes signedRequestToken, wrapped DEK, and policy binding.' },
  { edge: ['kas','keycloak'],     step: 3, label: 'KAS validates user JWT',        detail: 'KAS does not blindly trust the JWT — it verifies the token is genuine, not expired, and was actually issued for this user. This prevents forged tokens from unlocking data.',                                                                                                                                   technical: 'KAS verifies JWT signature using Keycloak\'s JWKS. Checks iss, exp, and aud claims.' },
  { edge: ['kas','platform'],     step: 4, label: 'KAS checks entitlements',       detail: 'With identity confirmed, KAS asks the Policy Engine: does this user\'s attributes satisfy the data\'s policy? The Platform checks the user\'s attribute values against the required attributes bound to this TDF.',                                                                                             technical: 'gRPC: authorization.AuthorizationService/GetEntitlements with entity JWT and required attribute FQNs.' },
  { edge: ['kas','client'],       step: 5, label: 'KAS unwraps and returns DEK',   detail: 'If the user satisfies all required attributes, KAS unwraps the DEK and returns it. If any attribute is missing, KAS refuses and the data stays locked. Access can be revoked at any moment by removing an attribute.',                                                                                         technical: 'RSA-OAEP decrypt or ECDH key derivation. DEK re-encrypted for requesting entity before sending.' },
  { edge: ['client','client'],    step: 6, label: 'Client decrypts data locally',  detail: 'The client uses the DEK to decrypt the ciphertext entirely on the local device. Plaintext never touches any server. Even Virtru and the storage provider cannot read this data.',                                                                                                                              technical: 'AES-256-GCM decrypt using recovered DEK and IV from manifest. 128-bit auth tag verified to detect tampering.' },
]

const ABAC_FLOW = [
  { edge: ['client','keycloak'],  step: 1, label: 'User authenticates',                    detail: 'Everything starts with identity. The user logs in through their application. Any OIDC-compliant IdP works: Keycloak, Ping, Okta, Entra ID, or ADFS.',                                                                                                                                               technical: 'POST /realms/opentdf/protocol/openid-connect/token with grant_type=password or authorization_code.' },
  { edge: ['keycloak','client'],  step: 2, label: 'IdP issues JWT with attributes',        detail: 'The IdP returns a signed JWT containing the user\'s claims — department, clearance level, role, and any other attributes your organization tracks. These claims drive the access decision.',                                                                                                           technical: 'JWT contains standard claims plus custom claims from protocol mappers translating group memberships to attribute FQNs.' },
  { edge: ['client','platform'],  step: 3, label: 'Query required attributes for this data', detail: 'Before requesting access, the client asks the Platform: what attributes does this TDF require? This lets the app give a meaningful message like "you need Finance clearance" rather than a generic error.',                                                                                          technical: 'gRPC: authorization.AuthorizationService/GetEntitlements with entity JWT and attribute FQNs from TDF manifest.' },
  { edge: ['platform','client'],  step: 4, label: 'Platform returns entitlement decision', detail: 'The Platform evaluates the user\'s JWT claims against subject mappings. It returns which required attributes the user satisfies. The client now knows whether to attempt the key request.',                                                                                                            technical: 'Platform walks subject condition sets (AND/OR trees of JWT claim matchers) linked to attribute values.' },
  { edge: ['client','kas'],       step: 5, label: 'Request key with JWT',                  detail: 'The client sends the wrapped key to KAS with the user\'s JWT. KAS performs its own independent verification — it does not trust the client\'s assessment. This defense-in-depth ensures the client cannot lie about entitlements.',                                                                    technical: 'POST /kas/v2/rewrap — includes signedRequestToken, wrapped DEK, and policy binding.' },
  { edge: ['kas','keycloak'],     step: 6, label: 'KAS validates JWT signature',           detail: 'KAS independently verifies the JWT was genuinely issued by your IdP and has not been tampered with or expired. A forged or stolen token is rejected here.',                                                                                                                                           technical: 'KAS fetches JWKS from /realms/opentdf/protocol/openid-connect/certs. Verifies signature, iss, aud, exp.' },
  { edge: ['kas','platform'],     step: 7, label: 'KAS checks entitlements (independently)', detail: 'KAS makes its own call to the Platform — independent of anything the client said. This is the real enforcement point. No matter how the client behaves, access can only be granted if the Platform confirms entitlements right now.',                                                               technical: 'Same GetEntitlements call as step 3, but initiated by KAS. Catches attribute changes made after JWT was issued.' },
  { edge: ['kas','client'],       step: 8, label: 'KAS grants or denies access',           detail: 'With identity verified and entitlements confirmed, KAS unwraps the DEK and returns it. If any check failed — bad JWT, missing attribute, expired access — KAS returns 403 and the data stays permanently locked.',                                                                                    technical: 'On success: KAS decrypts wrapped DEK, returns it. On denial: HTTP 403 with reason code.' },
]

const MULTI_KAS_FLOW = [
  { edge: ['client','kas_usa'],   step: 1, label: 'Send wrapped key to origin KAS',          detail: 'To share data across coalition, the client first sends the wrapped key to the origin KAS (USA). The origin KAS validates entitlements and unwraps the DEK.',                                                                                                                                       technical: 'POST https://kas.fbi.gov/v2/rewrap — validates entitlements with Platform, then unwraps the DEK.' },
  { edge: ['kas_usa','client'],   step: 2, label: 'Origin KAS returns unwrapped DEK',        detail: 'If authorized, the origin KAS returns the unwrapped DEK. The client now has the plaintext DEK temporarily in memory — this is the only moment it exists unprotected.',                                                                                                                             technical: 'Origin KAS responds with DEK re-encrypted for the requesting entity. Raw 256-bit AES key in memory.' },
  { edge: ['client','kas_uk'],    step: 3, label: 'Wrap DEK for each coalition KAS (parallel)', detail: 'The client fetches each coalition KAS\'s public key and wraps the DEK for all of them in parallel. Each KAS gets its own unique wrapped copy of the same DEK.',                                                                                                                                technical: 'GET kas_public_key from UK, CAN, AUS, NZL KAS endpoints. RSA-OAEP wrap for each. Parallel operations.' },
  { edge: ['client','tdf'],       step: 4, label: 'Update TDF with 5 keyAccess objects',     detail: 'The TDF manifest is updated to include all 5 wrapped keys. Now any FVEY partner can decrypt using their own KAS — no single point of control.',                                                                                                                                                    technical: 'keyAccess array gets 5 entries: [{url: "https://kas.fbi.gov", wrappedKey: "..."}, ...]. Each partner decrypts independently.' },
  { edge: ['tdf','datastore'],    step: 5, label: 'Store coalition-enabled TDF',             detail: 'The updated TDF is stored. All 5 coalition partners can now decrypt it using their own KAS. The data sharing is decentralized across the coalition.',                                                                                                                                                technical: 'TDF size increases slightly (~256 bytes per wrapped key). Storage sees a single file; 5 KAS instances can unlock it.' },
]

const FLOWS = [
  { key: 'encrypt',  label: 'Encrypt flow',   color: '#004987', bg: 'rgba(0,73,135,0.08)',    data: ENCRYPT_FLOW  },
  { key: 'decrypt',  label: 'Decrypt flow',   color: '#0f7a3e', bg: 'rgba(15,122,62,0.08)',   data: DECRYPT_FLOW  },
  { key: 'abac',     label: 'ABAC flow',      color: '#5b3fb0', bg: 'rgba(91,63,176,0.08)',   data: ABAC_FLOW     },
  { key: 'multikas', label: 'Multi-KAS flow', color: '#b45309', bg: 'rgba(180,83,9,0.08)',    data: MULTI_KAS_FLOW},
]

// Persona chip helpers — same rules as the topbar persona strip.
const initialsOf = (p) => p.name.trim().split(/\s+/).slice(-2).map(s => s[0]).join('').toUpperCase()
const inkOn = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.62 ? '#0a1a33' : '#ffffff'
}

const techBlock = {
  marginTop: 12, padding: '8px 10px', borderRadius: 8,
  background: 'var(--c-surface-2)', color: 'var(--c-text-2)', border: '1px solid var(--c-border)',
  fontSize: 11, fontFamily: 'var(--font-mono)', lineHeight: 1.7,
}

function nodeCenter(node) {
  return { x: node.x + NW / 2, y: node.y + NH / 2 }
}

function clipToBorder(cx, cy, tx, ty) {
  // Returns point on the border of the node centered at (cx,cy), toward (tx,ty)
  const dx = tx - cx, dy = ty - cy
  const len = Math.sqrt(dx*dx + dy*dy)
  if (len === 0) return { x: cx, y: cy }
  const ux = dx/len, uy = dy/len
  const hw = NW/2 + 8, hh = NH/2 + 8  // half-dims + gap
  const tx2 = ux !== 0 ? hw / Math.abs(ux) : Infinity
  const ty2 = uy !== 0 ? hh / Math.abs(uy) : Infinity
  const t = Math.min(tx2, ty2)
  return { x: cx + ux*t, y: cy + uy*t }
}

function getEdgePoints(from, to) {
  const a = nodeCenter(NODES[from])
  const b = nodeCenter(NODES[to])
  const p1 = clipToBorder(a.x, a.y, b.x, b.y)
  const p2 = clipToBorder(b.x, b.y, a.x, a.y)
  return { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y }
}

// Bezier control points — offset perpendicular to give curves a gentle arc
function bezierPath(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  // Perpendicular offset scaled to distance
  const len = Math.sqrt(dx * dx + dy * dy)
  const bend = Math.min(len * 0.25, 60)
  const nx = -dy / len * bend, ny = dx / len * bend
  return `M${x1},${y1} Q${mx + nx},${my + ny} ${x2},${y2}`
}

export default function ArchitecturePage() {
  const { techMode, activePersona, sector } = useDemo()

  const [selected, setSelected]     = useState(null)
  const [activeFlow, setActiveFlow] = useState(null)
  const [flowStep, setFlowStep]     = useState(-1)
  const [scenarioEdge, setScenarioEdge]           = useState(null)
  const [scenarioColorType, setScenarioColorType] = useState(null)

  const flowDef  = FLOWS.find(f => f.key === activeFlow)
  const flow     = flowDef?.data ?? []
  const dotColor = flowDef?.color ?? 'var(--c-accent)'

  // ABAC persona-awareness
  const isCoalitionPersona = sector === 'federal' && activePersona.nationality && activePersona.nationality !== 'USA'
  const REQUIRED_ATTRS = sector === 'federal'
    ? isCoalitionPersona ? ['clearance:secret', 'relto:fvey'] : ['clearance:ts-sci', 'mission:intel']
    : ['clearance:top-secret', 'department:finance']
  const DEMO_DOC_NAME = sector === 'federal'
    ? isCoalitionPersona ? 'FVEY Intelligence Summary — SECRET // REL TO FVEY' : 'Intel Briefing Q3 — TS/SCI NOFORN'
    : 'Q3 Financial Threat Assessment — Top Secret/Finance'
  const isAbacGranted  = REQUIRED_ATTRS.every(r => activePersona.attributes.includes(r))
  const missingAttrs   = REQUIRED_ATTRS.filter(r => !activePersona.attributes.includes(r))

  function getAbacDetail(stepNum) {
    const name = activePersona.id === 'generic' ? 'the user' : activePersona.name
    const attrs = activePersona.attributes
    switch (stepNum) {
      case 1: return `${name} logs in. DSP's ABAC model is only as strong as the identity provider — it is the authoritative source of who ${name} is and what attributes they carry.`
      case 2: return attrs.length > 0
        ? `The IdP returns a signed JWT for ${name} containing: ${attrs.join(', ')}.`
        : `The IdP returns a JWT for ${name} with no special attribute claims. Without the right attributes, access will be denied at KAS.`
      case 3: return `The client asks the Platform: can ${name} access "${DEMO_DOC_NAME}"? Required policy: ${REQUIRED_ATTRS.join(' AND ')}.`
      case 4: return isAbacGranted
        ? `Platform confirms ${name} satisfies all requirements: ${REQUIRED_ATTRS.join(', ')}.`
        : `Platform check: ${name} has [${attrs.length > 0 ? attrs.join(', ') : 'no attributes'}]. Missing: ${missingAttrs.join(', ')}.`
      case 5: return `${name}'s client sends the wrapped key to KAS with their signed JWT. KAS independently verifies everything.`
      case 6: return `KAS verifies the JWT was genuinely issued by your IdP for ${name}, is not expired, and was not tampered with.`
      case 7: return isAbacGranted
        ? `KAS confirms ${name} satisfies all required attributes (${REQUIRED_ATTRS.join(', ')}). Unwrapping DEK…`
        : `KAS checks ${name}'s entitlements. Has: [${attrs.length > 0 ? attrs.join(', ') : 'none'}]. Required: ${REQUIRED_ATTRS.join(' AND ')}. Missing: ${missingAttrs.join(', ')} → 403.`
      case 8: return isAbacGranted
        ? `KAS unwraps the DEK and returns it to ${name}'s client. All required attributes were satisfied.`
        : `KAS returns HTTP 403 to ${name}'s client. Missing: ${missingAttrs.join(', ')}. The file remains permanently encrypted.`
      default: return null
    }
  }

  function startFlow(key) {
    setActiveFlow(key)
    setFlowStep(0)
    setScenarioEdge(null)
    setScenarioColorType(null)
    setSelected(null)
  }

  function stepForward() { setFlowStep(i => Math.min(flow.length - 1, i + 1)) }
  function stepBack()    { setFlowStep(i => Math.max(0, i - 1)) }

  function reset() {
    setActiveFlow(null)
    setFlowStep(-1)
    setSelected(null)
    setScenarioEdge(null)
    setScenarioColorType(null)
  }

  const activeEdge   = scenarioEdge ?? (flowStep >= 0 && flow[flowStep] ? flow[flowStep].edge : null)
  const selectedNode = selected ? NODES[selected] : null
  const currentStep  = flowStep >= 0 && flow[flowStep] ? flow[flowStep] : null

  function isNodeActive(id) {
    if (!activeEdge) return false
    return activeEdge[0] === id || activeEdge[1] === id
  }
  function isEdgeActive(from, to) {
    if (!activeEdge) return false
    return (activeEdge[0] === from && activeEdge[1] === to) ||
           (activeEdge[0] === to   && activeEdge[1] === from)
  }

  const PRINCIPLE_CARDS = [
    { title: 'Zero Trust Encryption',  body: 'Data is encrypted at the source before it leaves the client. Even your storage provider and Virtru cannot read it — only KAS can unlock it.' },
    { title: 'Policy-Bound Data',       body: 'Policies bind to the data itself using HIERARCHY, ALL_OF, and ANY_OF rules — not to the network perimeter. The same TDF enforces rules in S3, email, or a USB drive.' },
    { title: 'Persistent Protection',   body: 'The policy travels with the data. KAS validates entitlements on every access attempt — revoking one attribute instantly locks out a user from all copies.' },
    sector === 'federal'
      ? { title: 'Coalition-Aware Sharing', body: 'relto:fvey and relto:nato attributes use ANY_OF rules — any FVEY or NATO member satisfies the policy without listing each nationality individually.' }
      : { title: 'Compliance Evidence',     body: 'Every access attempt is cryptographically logged — granted, denied, and revoked. Tamper-evident records ready for CMMC, FedRAMP, SOC 2, or HIPAA review.' },
  ]

  const LEGEND = [
    { color: 'var(--c-diagram-edge)', dashed: true, label: 'Idle connection' },
    ...FLOWS.map(f => ({ color: f.color, label: f.label })),
  ]

  const ringColor = flowDef ? dotColor : 'var(--c-accent)'
  const svgText = { fontFamily: 'var(--font-ui)' }

  return (
    <div className="page">

      {/* ── Page hero ──────────────────────────────────────────────────── */}
      <div className="page-hero">
        <div>
          <h2 className="page-title">Architecture</h2>
          <p className="page-subtitle">
            Six components, one data protection boundary. Click any node to learn its role, or select a flow to watch how data moves through the system.
          </p>
        </div>
        <div className="page-actions">
          <div className="seg" role="group" aria-label="Select a flow">
            {FLOWS.map(f => (
              <button
                key={f.key}
                type="button"
                aria-pressed={activeFlow === f.key}
                onClick={() => startFlow(f.key)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}
              >
                <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: f.color, opacity: activeFlow === f.key ? 1 : 0.55 }} />
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={reset}
            style={{ visibility: activeFlow || selected ? 'visible' : 'hidden' }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 28, alignItems: 'start' }}>

        {/* Left: diagram + step strip */}
        <div style={{ minWidth: 0 }}>

          {/* SVG diagram */}
          <div className="card" style={{ overflow: 'hidden', borderRadius: 12 }}>
            <svg viewBox="0 30 900 420" style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Architecture diagram">
              <defs>
                {/* Subtle dot grid */}
                <pattern id="dotgrid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <circle cx="16" cy="16" r="1.2" fill="var(--c-border-2)" opacity="0.6" />
                </pattern>
                {/* Active node glow */}
                <filter id="node-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                {/* Edge glow for active paths */}
                <filter id="edge-glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
                {/* Arrowhead markers */}
                {[
                  { id: 'arr',        color: 'var(--c-diagram-edge)' },
                  { id: 'arr-blue',   color: FLOWS[0].color },
                  { id: 'arr-green',  color: FLOWS[1].color },
                  { id: 'arr-purple', color: FLOWS[2].color },
                  { id: 'arr-amber',  color: FLOWS[3].color },
                ].map(({ id, color }) => (
                  <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                    <path d="M0,0.5 L0,6.5 L6,3.5 z" fill={color} />
                  </marker>
                ))}
              </defs>

              {/* Background */}
              <rect width="900" height="490" fill="var(--c-diagram-bg)" />
              <rect width="900" height="490" fill="url(#dotgrid)" />

              {/* ── Edges ── */}
              {EDGES.map(([from, to, label]) => {
                if (!NODES[from] || !NODES[to]) return null
                const pts = getEdgePoints(from, to)
                const active = isEdgeActive(from, to)
                const reversed = active && activeEdge && activeEdge[0] === to && activeEdge[1] === from
                const sx = reversed ? pts.x2 : pts.x1, sy = reversed ? pts.y2 : pts.y1
                const ex = reversed ? pts.x1 : pts.x2, ey = reversed ? pts.y1 : pts.y2
                const path = bezierPath(sx, sy, ex, ey)
                const arrowId = active
                  ? activeFlow === 'decrypt'  ? 'url(#arr-green)'
                  : activeFlow === 'abac'     ? 'url(#arr-purple)'
                  : activeFlow === 'multikas' ? 'url(#arr-amber)'
                  : 'url(#arr-blue)'
                  : 'url(#arr)'
                const dotStart = active && activeEdge ? nodeCenter(NODES[activeEdge[0]]) : null
                const dotEnd   = active && activeEdge && NODES[activeEdge[1]] ? nodeCenter(NODES[activeEdge[1]]) : null
                const animPath = dotStart && dotEnd ? bezierPath(dotStart.x, dotStart.y, dotEnd.x, dotEnd.y) : null
                const midX = (pts.x1 + pts.x2) / 2, midY = (pts.y1 + pts.y2) / 2

                return (
                  <g key={`${from}-${to}`}>
                    {/* Glow layer for active edges */}
                    {active && (
                      <path d={path} fill="none"
                        stroke={dotColor} strokeWidth="6" strokeOpacity="0.2"
                        filter="url(#edge-glow)" />
                    )}
                    <path d={path} fill="none"
                      stroke={active ? dotColor : 'var(--c-diagram-edge)'}
                      strokeWidth={active ? 2 : 1.5}
                      strokeDasharray={active ? 'none' : '5 4'}
                      strokeOpacity={active ? 1 : 0.8}
                      markerEnd={arrowId}
                      style={{ transition: 'stroke 0.35s, stroke-width 0.25s' }}
                    />
                    {/* Animated packet dot */}
                    {active && animPath && (
                      <>
                        <circle r="4.5" fill={dotColor} opacity="0.9">
                          <animateMotion dur="1.4s" repeatCount="indefinite" path={animPath} />
                        </circle>
                        <circle r="2" fill="white" opacity="0.95">
                          <animateMotion dur="1.4s" repeatCount="indefinite" path={animPath} />
                        </circle>
                      </>
                    )}
                    {techMode && (
                      <text x={midX} y={midY - 8} textAnchor="middle" fontSize="10"
                        fill={active ? 'var(--c-text-2)' : 'var(--c-text-4)'}
                        stroke="var(--c-diagram-bg)" strokeWidth="3" paintOrder="stroke"
                        style={svgText}>
                        {label}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* ── Nodes ── */}
              {Object.values(NODES).filter(node => {
                if (node.id.startsWith('kas_') && activeFlow !== 'multikas') return false
                if (node.id === 'kas' && activeFlow === 'multikas') return false
                return true
              }).map(node => {
                const active = isNodeActive(node.id)
                const sel    = selected === node.id
                const { x, y } = node
                const hue = active ? ringColor : 'var(--c-accent)'

                return (
                  <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(sel ? null : node.id)}>
                    {/* Outer glow when active */}
                    {active && (
                      <rect x={x - 4} y={y - 4} width={NW + 8} height={NH + 8} rx="16"
                        fill={ringColor} opacity="0.15" filter="url(#node-glow)">
                        <animate attributeName="opacity" values="0.1;0.25;0.1" dur="2s" repeatCount="indefinite" />
                      </rect>
                    )}

                    {/* Card body */}
                    <rect x={x} y={y} width={NW} height={NH} rx="10"
                      fill="var(--c-diagram-node)"
                      stroke={active ? ringColor : sel ? 'var(--c-accent)' : 'var(--c-border-2)'}
                      strokeWidth={active ? 2.5 : sel ? 1.75 : 1}
                      style={{ transition: 'stroke 0.3s' }}
                    />

                    {/* Icon tile */}
                    <rect x={x + 14} y={y + 12} width="28" height="28" rx="7" fill="var(--c-info-bg)" />
                    <image
                      href={`${import.meta.env.BASE_URL}icons/${node.icon}.svg`}
                      x={x + 18} y={y + 16} width="20" height="20"
                    />

                    {/* Label */}
                    <text x={x + 14} y={y + 60}
                      fontSize="13" fontWeight="650"
                      fill="var(--c-text-1)"
                      style={svgText}>
                      {node.label.length > 20 ? node.label.slice(0, 19) + '…' : node.label}
                    </text>

                    {/* Subtitle */}
                    <text x={x + 14} y={y + 75}
                      fontSize="10.5"
                      fill={active ? hue : 'var(--c-text-5)'}
                      style={{ ...svgText, transition: 'fill 0.3s' }}>
                      {node.subtitle}
                    </text>

                    {/* Tech mode hostname */}
                    {techMode && (
                      <text x={x + NW - 14} y={y + 33}
                        textAnchor="end" fontSize="8.5"
                        fill="var(--c-text-5)"
                        style={{ fontFamily: 'var(--font-mono)' }}>
                        {node.id === 'kas' ? 'localhost:7777/kas' : node.id === 'platform' ? 'localhost:7777' : node.id === 'keycloak' ? 'localhost:7779' : ''}
                      </text>
                    )}

                    {/* Active pulse dot */}
                    {active && (
                      <circle cx={x + NW - 12} cy={y + 12} r="5" fill={ringColor}>
                        <animate attributeName="r" values="4;6;4" dur="1.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Selected ring */}
                    {sel && !active && (
                      <rect x={x - 3} y={y - 3} width={NW + 6} height={NH + 6} rx="13"
                        fill="none" stroke="var(--c-accent)" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Step strip */}
          {activeFlow && flow.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', marginTop: 14, paddingBottom: 4 }}>
              <button
                type="button"
                className="btn btn-sm"
                aria-label="Previous step"
                onClick={stepBack}
                disabled={flowStep <= 0}
                style={{ width: 30, padding: 0, flexShrink: 0 }}
              >
                <UiIcon name="chevron" size={14} style={{ transform: 'rotate(90deg)' }} />
              </button>
              <button
                type="button"
                className="btn btn-sm"
                aria-label="Next step"
                onClick={stepForward}
                disabled={flowStep >= flow.length - 1}
                style={{ width: 30, padding: 0, flexShrink: 0 }}
              >
                <UiIcon name="chevron" size={14} style={{ transform: 'rotate(-90deg)' }} />
              </button>
              <span className="num" style={{ fontSize: 12, color: 'var(--c-text-4)', minWidth: 44, textAlign: 'center', flexShrink: 0 }}>
                {flowStep + 1} / {flow.length}
              </span>
              {flow.map((s, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setFlowStep(i)}
                  aria-current={i === flowStep ? 'step' : undefined}
                  style={{
                    flexShrink: 0,
                    height: 30,
                    padding: '0 12px',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: i === flowStep ? 650 : 500,
                    cursor: 'pointer',
                    border: `1px solid ${i === flowStep ? flowDef.color : 'var(--c-border)'}`,
                    background: i === flowStep ? flowDef.bg : 'var(--c-surface)',
                    color: i === flowStep ? flowDef.color : i < flowStep ? 'var(--c-text-3)' : 'var(--c-text-5)',
                    display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background-color .12s, border-color .12s',
                  }}
                >
                  <span className="num" style={{ fontWeight: 700, fontSize: 11 }}>{s.step}</span>
                  {s.label}
                  {i < flowStep && <UiIcon name="check" size={12} strokeWidth={2.2} style={{ color: 'var(--c-grant)' }} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: unified context panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Selected node */}
          {selectedNode && !currentStep && (
            <div className="card step-in" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span className="demo-icon" style={{ width: 40, height: 40 }}>
                  <Icon name={selectedNode.icon} size={26} raw />
                </span>
                <div style={{ fontWeight: 650, fontSize: 15, color: 'var(--c-text-1)', letterSpacing: '-0.01em' }}>
                  {selectedNode.label.replace('\n', ' / ')}
                </div>
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-text-3)', margin: 0 }}>
                {selectedNode.desc}
              </p>
              {techMode && selectedNode.id === 'kas' && (
                <div style={techBlock}>
                  GET /kas/v2/kas_public_key<br />POST /kas/v2/rewrap
                </div>
              )}
              {techMode && selectedNode.id === 'platform' && (
                <div style={techBlock}>
                  authorization.AuthorizationService<br />/GetEntitlements<br />policy.attributes.AttributesService<br />/ListAttributes
                </div>
              )}
              {techMode && selectedNode.id === 'tdf' && (
                <div style={{ ...techBlock, fontSize: 10.5, whiteSpace: 'pre-wrap' }}>
                  {`{\n  "payload": { "type": "reference" },\n  "encryptionInformation": {\n    "keyAccess": [...],\n    "policy": "...(base64)"\n  }\n}`}
                </div>
              )}
            </div>
          )}

          {/* ABAC active persona callout */}
          {activeFlow === 'abac' && (
            <div className="card" style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span aria-hidden="true" style={{
                width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
                background: activePersona.id === 'generic' ? 'var(--c-surface-3)' : activePersona.color,
                color: activePersona.id === 'generic' ? 'var(--c-text-4)' : inkOn(activePersona.color),
              }}>
                {activePersona.id === 'generic' ? <UiIcon name="user" size={15} strokeWidth={1.9} /> : initialsOf(activePersona)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: 13, color: 'var(--c-text-1)' }}>{activePersona.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                  {activePersona.fqns.slice(0, 4).map(fqn => (
                    <span key={fqn} className="chip chip-mono">{fqn.split('/value/')[1]}</span>
                  ))}
                  {activePersona.fqns.length === 0 && (
                    <span style={{ fontSize: 12, color: 'var(--c-text-5)' }}>No attributes</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step detail card */}
          {currentStep && (
            <div key={`${activeFlow}-${flowStep}`} className="card step-in" style={{ padding: 18 }}>
              <div className="num" style={{ fontSize: 12, fontWeight: 650, color: flowDef?.color, marginBottom: 6 }}>
                Step {currentStep.step} of {flow.length}
              </div>
              <div style={{ fontSize: 15, fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--c-text-1)', marginBottom: 8 }}>
                {currentStep.label}
              </div>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-text-3)', margin: 0 }}>
                {techMode ? currentStep.technical : (activeFlow === 'abac' ? getAbacDetail(currentStep.step) : currentStep.detail)}
              </p>
              {techMode && (
                <div style={{ ...techBlock, marginTop: 10 }}>
                  {currentStep.edge[0]} → {currentStep.edge[1]}
                </div>
              )}
              {/* ABAC result banner */}
              {activeFlow === 'abac' && flowStep === ABAC_FLOW.length - 1 && (
                <div role="status" style={{
                  marginTop: 14, borderRadius: 8, padding: '10px 12px',
                  background: isAbacGranted ? 'var(--c-grant-bg)' : 'var(--c-deny-bg)',
                  border: `1px solid ${isAbacGranted ? 'var(--c-grant-br)' : 'var(--c-deny-br)'}`,
                  color: isAbacGranted ? 'var(--c-grant)' : 'var(--c-deny)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 650, fontSize: 13, marginBottom: 6 }}>
                    <UiIcon name={isAbacGranted ? 'check' : 'x'} size={14} strokeWidth={2.2} />
                    {isAbacGranted ? 'Access granted' : 'Access denied'}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--c-text-2)' }}>
                    <span style={{ color: 'var(--c-text-5)' }}>User: </span>
                    {activePersona.id === 'generic' ? 'Generic (no attributes)' : `${activePersona.name} — ${activePersona.attributes.join(', ') || 'no attributes'}`}
                  </div>
                  <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--c-text-2)' }}>
                    <span style={{ color: 'var(--c-text-5)' }}>Required: </span>{REQUIRED_ATTRS.join(' AND ')}
                  </div>
                  {!isAbacGranted && (
                    <div style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--c-deny)' }}>
                      <span style={{ color: 'var(--c-text-5)' }}>Missing: </span>{missingAttrs.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Principles — shown when no flow active; dividers, not cards */}
          {!activeFlow && (
            <div style={{ borderTop: '1px solid var(--c-border-2)' }}>
              {PRINCIPLE_CARDS.map((c, i) => (
                <div key={c.title} style={{ padding: '14px 0', borderTop: i ? '1px solid var(--c-border)' : 'none' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--c-text-1)', marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--c-text-4)', lineHeight: 1.55 }}>{c.body}</div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 16px' }}>
            {LEGEND.map(({ color, dashed, label }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--c-text-4)' }}>
                <svg width="20" height="6" viewBox="0 0 20 6" aria-hidden="true">
                  <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth="2"
                    strokeDasharray={dashed ? '4,3' : '0'} />
                </svg>
                {label}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  )
}
