import { useState } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import Icon from '../components/Icon.jsx'

// ── Node definitions ───────────────────────────────────────────────────────────
// Each node: x/y = top-left corner of the 160×88 card
const NODES = {
  client:    { id: 'client',    x: 60,  y: 200, label: 'Client App',        subtitle: 'Encrypts at source', icon: 'computer', color: '#3b82f6', desc: 'The application your users work in — browser, desktop, or mobile. This is where data gets encrypted before it ever leaves the device.' },
  kas:       { id: 'kas',       x: 370, y: 60,  label: 'KAS',               subtitle: 'Key Access Server',  icon: 'key',      color: '#f59e0b', desc: 'Key Access Server — the enforcement point for every decrypt attempt. Supports three key management modes: Software (platform-managed keys), Envelope (HSM/KMS-wrapped keys with in-memory caching), and Delegated (all crypto in HSM/KMS). Compatible with AWS KMS, Thales Luna HSMs, and Entrust HSMs. Validates the user\'s JWT, checks entitlements, and either unwraps the DEK or returns 403.' },
  platform:  { id: 'platform',  x: 660, y: 200, label: 'Platform',          subtitle: 'Policy engine',      icon: 'gear',     color: '#8b5cf6', desc: 'OpenTDF Policy Engine — stores attribute definitions, subject mappings, and key management configuration. Supports three attribute rule types: HIERARCHY (clearance levels), ALL_OF (compartments), and ANY_OF (coalition groups). KAS calls here on every key request to evaluate entitlements.' },
  keycloak:  { id: 'keycloak',  x: 370, y: 340, label: 'IdP / Entitlements',subtitle: 'Identity provider',  icon: 'shield',   color: '#ec4899', desc: 'Identity Provider & Entitlement Service — issues signed JWTs and provides entity resolution data. Any OIDC IdP works: Keycloak, Okta, Ping, Entra ID, or ADFS. Subject Mappings link entities to Attribute Values via condition sets.' },
  datastore: { id: 'datastore', x: 60,  y: 340, label: 'Data Store',        subtitle: 'Any storage',        icon: 'server',   color: '#10b981', desc: 'Where your encrypted TDF files live — S3, SharePoint, email, a database, or any storage. The data is worthless without the key, so the storage layer has zero ability to read content.' },
  tdf:       { id: 'tdf',       x: 660, y: 340, label: 'TDF Envelope',      subtitle: 'Encrypted container', icon: 'tdf-doc',  color: '#06b6d4', desc: 'Trusted Data Format — a portable, self-describing encrypted container. Bundles the ciphertext, the policy binding, and the wrapped key object in one portable package. The same TDF enforces the same rules in S3, email, SharePoint, or on a USB drive.' },
  // Coalition KAS nodes (multi-KAS flow only)
  kas_usa:   { id: 'kas_usa',   x: 80,  y: 50,  label: '🇺🇸 USA KAS',      subtitle: 'FBI',   icon: 'key', color: '#3b82f6', desc: 'FBI Key Access Server — origin KAS that unwraps the DEK, then provides it to client for rewrapping to coalition partners.' },
  kas_uk:    { id: 'kas_uk',    x: 260, y: 50,  label: '🇬🇧 UK KAS',       subtitle: 'GCHQ',  icon: 'key', color: '#ef4444', desc: 'GCHQ Key Access Server — DEK wrapped with UK public key for FVEY coalition sharing.' },
  kas_can:   { id: 'kas_can',   x: 440, y: 50,  label: '🇨🇦 CAN KAS',      subtitle: 'CSE',   icon: 'key', color: '#ec4899', desc: 'CSE Key Access Server — DEK wrapped with Canada public key for FVEY coalition sharing.' },
  kas_aus:   { id: 'kas_aus',   x: 620, y: 50,  label: '🇦🇺 AUS KAS',      subtitle: 'ASD',   icon: 'key', color: '#f59e0b', desc: 'ASD Key Access Server — DEK wrapped with Australia public key for FVEY coalition sharing.' },
  kas_nzl:   { id: 'kas_nzl',   x: 760, y: 50,  label: '🇳🇿 NZL KAS',      subtitle: 'GCSB',  icon: 'key', color: '#10b981', desc: 'GCSB Key Access Server — DEK wrapped with New Zealand public key for FVEY coalition sharing.' },
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
  { key: 'encrypt',  label: 'Encrypt Flow',   color: '#60a5fa', bg: 'rgba(59,130,246,0.12)',  border: '#3b82f6',  data: ENCRYPT_FLOW  },
  { key: 'decrypt',  label: 'Decrypt Flow',   color: '#4ade80', bg: 'rgba(34,197,94,0.1)',    border: '#22c55e',  data: DECRYPT_FLOW  },
  { key: 'abac',     label: 'ABAC Flow',      color: '#c084fc', bg: 'rgba(168,85,247,0.1)',   border: '#a855f7',  data: ABAC_FLOW     },
  { key: 'multikas', label: 'Multi-KAS Flow', color: '#fbbf24', bg: 'rgba(245,158,11,0.1)',   border: '#f59e0b',  data: MULTI_KAS_FLOW},
]

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
  const dotColor = flowDef?.color ?? '#60a5fa'

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
    { icon: 'lock',       title: 'Zero Trust Encryption',  body: 'Data is encrypted at the source before it leaves the client. Even your storage provider and Virtru cannot read it — only KAS can unlock it.' },
    { icon: 'tdf',        title: 'Policy-Bound Data',       body: 'Policies bind to the data itself using HIERARCHY, ALL_OF, and ANY_OF rules — not to the network perimeter. The same TDF enforces rules in S3, email, or a USB drive.' },
    { icon: 'shield',     title: 'Persistent Protection',   body: 'The policy travels with the data. KAS validates entitlements on every access attempt — revoking one attribute instantly locks out a user from all copies.' },
    sector === 'federal'
      ? { icon: 'partners',   title: 'Coalition-Aware Sharing', body: 'relto:fvey and relto:nato attributes use ANY_OF rules — any FVEY or NATO member satisfies the policy without listing each nationality individually.' }
      : { icon: 'compliance', title: 'Compliance Evidence',     body: 'Every access attempt is cryptographically logged — granted, denied, and revoked. Tamper-evident records ready for CMMC, FedRAMP, SOC 2, or HIPAA review.' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Page hero ──────────────────────────────────────────────────── */}
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--c-border)', flexShrink: 0 }}>
        <div className="page-hero" style={{ marginBottom: 0, paddingBottom: 0, borderBottom: 'none' }}>
          <p className="page-subtitle">
            Six components, one data protection boundary. Click any node to learn its role, or select a flow to watch how data moves through the system.
          </p>
          <div className="page-actions">
          </div>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 24px',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        background: 'var(--c-surface)',
      }}>
        <p style={{ fontSize: 12, color: 'var(--c-text-5)', margin: 0, marginRight: 8, flexShrink: 0 }}>
          Select a flow:
        </p>

        {/* Flow tabs */}
        {FLOWS.map(f => (
          <button
            key={f.key}
            onClick={() => startFlow(f.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: activeFlow === f.key ? 600 : 400,
              cursor: 'pointer',
              border: `1px solid ${activeFlow === f.key ? f.border : 'var(--c-border)'}`,
              background: activeFlow === f.key ? f.bg : 'transparent',
              color: activeFlow === f.key ? f.color : 'var(--c-text-5)',
              transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}

        {/* Step nav — only when a flow is active */}
        {activeFlow && (
          <>
            <div style={{ width: 1, height: 20, background: 'var(--c-border)', margin: '0 4px' }} />
            <button
              onClick={stepBack}
              disabled={flowStep <= 0}
              style={{
                width: 28, height: 28, borderRadius: 6, border: '1px solid var(--c-border)',
                background: 'var(--c-surface-2)', color: 'var(--c-text-3)',
                cursor: flowStep <= 0 ? 'default' : 'pointer', opacity: flowStep <= 0 ? 0.3 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              }}
            >◀</button>
            <span style={{ fontSize: 12, color: 'var(--c-text-4)', minWidth: 60, textAlign: 'center' }}>
              {flowStep + 1} / {flow.length}
            </span>
            <button
              onClick={stepForward}
              disabled={flowStep >= flow.length - 1}
              style={{
                width: 28, height: 28, borderRadius: 6, border: '1px solid var(--c-border)',
                background: 'var(--c-surface-2)', color: 'var(--c-text-3)',
                cursor: flowStep >= flow.length - 1 ? 'default' : 'pointer', opacity: flowStep >= flow.length - 1 ? 0.3 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              }}
            >▶</button>
          </>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="badge badge-blue" style={{ fontSize: 11 }}>v2.0.6.4</span>
          {(activeFlow || selected) && (
            <button
              onClick={reset}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12,
                background: 'transparent', border: '1px solid var(--c-border)',
                color: 'var(--c-text-5)', cursor: 'pointer',
              }}
            >
              ↺ Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>

        {/* Left: diagram + step strip */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 0 16px 24px', gap: 12, minHeight: 0 }}>

          {/* SVG diagram */}
          <div style={{
            flex: 1,
            minHeight: 0,
            borderRadius: 12,
            overflow: 'hidden',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            boxShadow: 'var(--c-shadow-md)',
          }}>
            <svg viewBox="0 0 900 490" style={{ width: '100%', height: '100%', display: 'block' }}>
              <defs>
                {/* Subtle dot grid */}
                <pattern id="dotgrid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <circle cx="16" cy="16" r="1.2" fill="#4a7aaa" opacity="0.4" />
                </pattern>
                {/* Radial vignette — darkens edges */}
                <radialGradient id="vignette" cx="50%" cy="50%" r="70%">
                  <stop offset="0%" stopColor="transparent" />
                  <stop offset="100%" stopColor="var(--c-bg)" stopOpacity="0.5" />
                </radialGradient>
                {/* Node fill gradients */}
                {Object.values(NODES).map(n => (
                  <linearGradient key={n.id} id={`ng-${n.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={n.color} stopOpacity="0.18" />
                    <stop offset="100%" stopColor={n.color} stopOpacity="0.04" />
                  </linearGradient>
                ))}
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
                {/* Invert black icons to white */}
                <filter id="icon-white">
                  <feColorMatrix type="matrix"
                    values="-1 0 0 0 1
                             0 -1 0 0 1
                             0 0 -1 0 1
                             0 0 0 1 0" />
                </filter>
                {/* Arrowhead markers */}
                {[
                  { id: 'arr',        color: 'var(--c-border-2)' },
                  { id: 'arr-blue',   color: '#60a5fa' },
                  { id: 'arr-green',  color: '#4ade80' },
                  { id: 'arr-purple', color: '#c084fc' },
                  { id: 'arr-amber',  color: '#fbbf24' },
                ].map(({ id, color }) => (
                  <marker key={id} id={id} markerWidth="7" markerHeight="7" refX="5" refY="3.5" orient="auto">
                    <path d="M0,0.5 L0,6.5 L6,3.5 z" fill={color} />
                  </marker>
                ))}
              </defs>

              {/* Background */}
              <rect width="900" height="490" fill="#1e3a5f" />
              <rect width="900" height="490" fill="url(#dotgrid)" />
              <rect width="900" height="490" fill="url(#vignette)" />

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
                      stroke={active ? dotColor : 'var(--c-border)'}
                      strokeWidth={active ? 2 : 1.5}
                      strokeDasharray={active ? 'none' : '5 4'}
                      strokeOpacity={active ? 1 : 0.7}
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
                      <text x={midX} y={midY - 8} textAnchor="middle" fontSize="9"
                        fill={active ? 'var(--c-text-3)' : 'var(--c-text-6)'} fontFamily="system-ui">
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
                const { x, y, color } = node

                return (
                  <g key={node.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(sel ? null : node.id)}>
                    {/* Outer glow when active */}
                    {active && (
                      <rect x={x - 4} y={y - 4} width={NW + 8} height={NH + 8} rx="16"
                        fill={color} opacity="0.15" filter="url(#node-glow)">
                        <animate attributeName="opacity" values="0.1;0.25;0.1" dur="2s" repeatCount="indefinite" />
                      </rect>
                    )}

                    {/* Card body */}
                    <rect x={x} y={y} width={NW} height={NH} rx="12"
                      fill="#1e3a5f"
                      stroke={active || sel ? color : '#2d5a8e'}
                      strokeWidth={active ? 2.5 : sel ? 1.5 : 1}
                      style={{ transition: 'stroke 0.3s' }}
                    />

                    {/* Color accent bar along top */}
                    <rect x={x + 1} y={y + 1} width={NW - 2} height={4} rx="11"
                      fill={color}
                      opacity={active ? 1 : sel ? 0.7 : 0.4}
                      style={{ transition: 'opacity 0.3s' }}
                    />

                    {/* Icon */}
                    <image
                      href={`${import.meta.env.BASE_URL}icons/${node.icon}.svg`}
                      x={x + 12} y={y + 14} width="22" height="22"
                      opacity={active ? 1 : 0.75}
                      filter={node.icon === 'tdf-doc' ? undefined : 'url(#icon-white)'}
                    />

                    {/* Label */}
                    <text x={x + 44} y={y + 26}
                      fontSize="12" fontWeight="700" fontFamily="system-ui"
                      fill={active ? '#ffffff' : '#e2eaf4'}
                      style={{ transition: 'fill 0.3s' }}>
                      {node.label.length > 16 ? node.label.slice(0, 15) + '…' : node.label}
                    </text>

                    {/* Subtitle */}
                    <text x={x + 44} y={y + 40}
                      fontSize="10" fontFamily="system-ui"
                      fill={active ? color : '#7aaac8'}
                      style={{ transition: 'fill 0.3s' }}>
                      {node.subtitle}
                    </text>

                    {/* Tech mode hostname */}
                    {techMode && (
                      <text x={x + NW / 2} y={y + NH - 8}
                        textAnchor="middle" fontSize="8" fontFamily="monospace"
                        fill={color} opacity="0.6">
                        {node.id === 'kas' ? 'kas.dsp.vm' : node.id === 'platform' ? 'platform.dsp.vm' : node.id === 'keycloak' ? 'keycloak.dsp.vm' : ''}
                      </text>
                    )}

                    {/* Active pulse dot */}
                    {active && (
                      <circle cx={x + NW - 10} cy={y + 10} r="5" fill={color}>
                        <animate attributeName="r" values="4;6;4" dur="1.2s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="1;0.5;1" dur="1.2s" repeatCount="indefinite" />
                      </circle>
                    )}

                    {/* Selected ring */}
                    {sel && !active && (
                      <rect x={x - 3} y={y - 3} width={NW + 6} height={NH + 6} rx="15"
                        fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Step strip */}
          {activeFlow && flow.length > 0 && (
            <div style={{
              display: 'flex', gap: 6, overflowX: 'auto', paddingTop: 10, paddingBottom: 2,
              flexShrink: 0,
            }}>
              {flow.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setFlowStep(i)}
                  style={{
                    flexShrink: 0,
                    padding: '5px 12px',
                    borderRadius: 8,
                    fontSize: 11,
                    fontWeight: i === flowStep ? 600 : 400,
                    cursor: 'pointer',
                    border: `1px solid ${i === flowStep ? flowDef.border : i < flowStep ? 'var(--c-border-2)' : 'var(--c-border)'}`,
                    background: i === flowStep ? flowDef.bg : 'transparent',
                    color: i === flowStep ? flowDef.color : i < flowStep ? 'var(--c-text-5)' : 'var(--c-text-6)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 10 }}>{s.step}</span>
                  {s.label}
                  {i < flowStep && <span style={{ color: '#4ade80', fontSize: 10 }}>✓</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: unified context panel */}
        <div style={{
          width: 300,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 24px 16px 16px',
          gap: 12,
          overflowY: 'auto',
        }}>

          {/* Context card */}
          <div style={{
            flex: currentStep ? 0 : 1,
            borderRadius: 12,
            padding: 20,
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            boxShadow: 'var(--c-shadow-md)',
          }}>
            {selectedNode && !currentStep ? (
              <div className="step-in">
                <div style={{ marginBottom: 10 }}><Icon name={selectedNode.icon} size={36} raw={selectedNode.icon === 'tdf-doc'} style={{ color: selectedNode.color }} /></div>
                <div style={{ fontWeight: 700, fontSize: 15, color: selectedNode.color, marginBottom: 8 }}>
                  {selectedNode.label.replace('\n', ' / ')}
                </div>
                <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-text-3)', margin: 0 }}>
                  {selectedNode.desc}
                </p>
                {techMode && selectedNode.id === 'kas' && (
                  <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--c-bg)', color: '#4ade80', border: '1px solid var(--c-border)', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.8 }}>
                    GET /kas/v2/kas_public_key<br />POST /kas/v2/rewrap
                  </div>
                )}
                {techMode && selectedNode.id === 'platform' && (
                  <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--c-bg)', color: '#4ade80', border: '1px solid var(--c-border)', fontSize: 11, fontFamily: 'monospace', lineHeight: 1.8 }}>
                    authorization.AuthorizationService<br />/GetEntitlements<br />policy.attributes.AttributesService<br />/ListAttributes
                  </div>
                )}
                {techMode && selectedNode.id === 'tdf' && (
                  <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 8, background: 'var(--c-bg)', color: '#06b6d4', border: '1px solid var(--c-border)', fontSize: 10, fontFamily: 'monospace', lineHeight: 1.8 }}>
                    {`{\n  "payload": { "type": "reference" },\n  "encryptionInformation": {\n    "keyAccess": [...],\n    "policy": "...(base64)"\n  }\n}`}
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* ABAC active persona callout */}
          {activeFlow === 'abac' && (
            <div style={{
              borderRadius: 10, padding: '10px 14px',
              background: activePersona.color + '12',
              border: `1.5px solid ${activePersona.color}`,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>{activePersona.avatar}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 12, color: activePersona.color }}>{activePersona.name}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {activePersona.fqns.slice(0, 4).map(fqn => (
                    <span key={fqn} style={{
                      padding: '1px 6px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace',
                      background: activePersona.color + '22', color: activePersona.color,
                      border: `1px solid ${activePersona.color}44`,
                    }}>{fqn.split('/value/')[1]}</span>
                  ))}
                  {activePersona.fqns.length === 0 && (
                    <span style={{ fontSize: 10, color: 'var(--c-text-5)', fontStyle: 'italic' }}>No attributes</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step detail card */}
          {currentStep && (
            <div
              key={`${activeFlow}-${flowStep}`}
              className="step-in"
              style={{
                borderRadius: 12,
                padding: 18,
                background: 'var(--c-surface)',
                border: `1px solid ${flowDef?.border ?? 'var(--c-border)'}`,
                boxShadow: 'var(--c-shadow-md)',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: flowDef?.color, marginBottom: 6 }}>
                STEP {currentStep.step} OF {flow.length} — {flowDef?.label.toUpperCase()}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-1)', marginBottom: 8 }}>
                {currentStep.label}
              </div>
              <p style={{ fontSize: 12, lineHeight: 1.6, color: 'var(--c-text-3)', margin: 0 }}>
                {techMode ? currentStep.technical : (activeFlow === 'abac' ? getAbacDetail(currentStep.step) : currentStep.detail)}
              </p>
              {techMode && (
                <div style={{ marginTop: 8, fontSize: 11, fontFamily: 'monospace', padding: '4px 8px', borderRadius: 6, background: 'var(--c-bg)', color: 'var(--c-text-5)' }}>
                  {currentStep.edge[0]} → {currentStep.edge[1]}
                </div>
              )}
              {/* ABAC result banner */}
              {activeFlow === 'abac' && flowStep === ABAC_FLOW.length - 1 && (
                <div style={{
                  marginTop: 12, borderRadius: 8, padding: '10px 14px',
                  background: isAbacGranted ? '#061a0e' : '#1a0505',
                  border: `2px solid ${isAbacGranted ? '#22c55e' : '#dc2626'}`,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: isAbacGranted ? '#4ade80' : '#f87171', marginBottom: 4 }}>
                    {isAbacGranted ? '✓ ACCESS GRANTED' : '✗ ACCESS DENIED'}
                  </div>
                  <div style={{ fontSize: 11, color: isAbacGranted ? '#86efac' : '#fca5a5', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--c-text-5)' }}>User: </span>
                    {activePersona.id === 'generic' ? 'Generic (no attributes)' : `${activePersona.name} — ${activePersona.attributes.join(', ') || 'no attributes'}`}
                  </div>
                  <div style={{ fontSize: 11, color: isAbacGranted ? '#86efac' : '#fca5a5' }}>
                    <span style={{ color: 'var(--c-text-5)' }}>Required: </span>{REQUIRED_ATTRS.join(' AND ')}
                  </div>
                  {!isAbacGranted && (
                    <div style={{ fontSize: 11, color: '#f87171' }}>
                      <span style={{ color: 'var(--c-text-5)' }}>Missing: </span>{missingAttrs.join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Principle cards — shown when no flow active */}
          {!activeFlow && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {PRINCIPLE_CARDS.map(c => (
                <div key={c.title} style={{
                  padding: '10px 12px', borderRadius: 8,
                  background: 'var(--c-surface)', border: '1px solid var(--c-border)',
                  borderLeft: '3px solid var(--c-accent)',
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', marginBottom: 4 }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-4)', lineHeight: 1.5 }}>{c.body}</div>
                </div>
              ))}
            </div>
          )}

          {/* Legend */}
          <div style={{
            borderRadius: 10,
            padding: '12px 16px',
            background: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--c-text-6)', marginBottom: 8 }}>LEGEND</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { color: 'var(--c-border)', dashed: true, label: 'Idle connection' },
                { color: '#3b82f6',  label: 'Encrypt flow' },
                { color: '#4ade80',  label: 'Decrypt flow' },
                { color: '#a855f7',  label: 'ABAC flow' },
                { color: '#f59e0b',  label: 'Multi-KAS flow' },
              ].map(({ color, dashed, label }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--c-text-4)' }}>
                  <svg width="20" height="6" viewBox="0 0 20 6">
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

    </div>
  )
}
