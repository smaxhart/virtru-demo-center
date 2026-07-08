// Single source of truth for all sector-specific content
// Used by DemoContext, Layout, and all page components

const NS = 'https://example.com/attr'

// ─── Commercial ───────────────────────────────────────────────────────────────

export const COMMERCIAL_PERSONAS = [
  {
    id: 'alice',
    name: 'Alice Chen',
    title: 'Senior Analyst, Finance',
    avatar: '👩‍💼',
    username: 'alice',
    attributes: ['clearance:top-secret', 'department:finance', 'role:analyst'],
    fqns: [
      `${NS}/clearance/value/top-secret`,
      `${NS}/department/value/finance`,
      `${NS}/role/value/analyst`,
    ],
    color: '#3b82f6',
  },
  {
    id: 'bob',
    name: 'Bob Martinez',
    title: 'External Contractor',
    avatar: '👨‍💻',
    username: 'bob',
    attributes: ['clearance:unclassified', 'department:external', 'role:contractor'],
    fqns: [
      `${NS}/clearance/value/unclassified`,
      `${NS}/department/value/external`,
      `${NS}/role/value/contractor`,
    ],
    color: '#f59e0b',
  },
  {
    id: 'carol',
    name: 'Carol Singh',
    title: 'Legal Counsel',
    avatar: '👩‍⚖️',
    username: 'carol',
    attributes: ['clearance:secret', 'department:legal', 'role:counsel'],
    fqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/department/value/legal`,
      `${NS}/role/value/counsel`,
    ],
    color: '#8b5cf6',
  },
  {
    id: 'dave',
    name: 'Dave Kim',
    title: 'IT Administrator',
    avatar: '🧑‍🔧',
    username: 'dave',
    attributes: ['clearance:secret', 'department:it', 'role:admin'],
    fqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/department/value/it`,
      `${NS}/role/value/admin`,
    ],
    color: '#10b981',
  },
  {
    id: 'generic',
    name: 'Generic User',
    title: 'Demo View',
    avatar: '👤',
    username: 'user',
    attributes: [],
    fqns: [],
    color: '#6b7280',
  },
]

export const COMMERCIAL_PERSONA_DOCS = {
  alice: {
    title: 'Q3 Financial Threat Assessment',
    classification: 'Top Secret / Finance Eyes Only',
    plaintext: 'CLASSIFIED BRIEFING — Q3 Threat Assessment\n\nTop Secret / Finance Eyes Only\n\nRevenue exposure analysis and competitive intelligence for Q3. Contains non-public financial projections.',
    policyFqns: [
      `${NS}/clearance/value/top-secret`,
      `${NS}/department/value/finance`,
    ],
  },
  bob: {
    title: 'Project Atlas — Contractor Scope of Work',
    classification: 'Unclassified / External Distribution',
    plaintext: 'SCOPE OF WORK — Project Atlas\n\nUnclassified / External Distribution\n\nEngagement scope, deliverables, and timeline for external contractor access.',
    policyFqns: [
      `${NS}/clearance/value/unclassified`,
      `${NS}/department/value/external`,
    ],
  },
  carol: {
    title: 'Meridian Corp Acquisition — NDA',
    classification: 'Secret / Legal Eyes Only',
    plaintext: 'MERGER AGREEMENT — Meridian Corp Acquisition\n\nSecret / Legal Eyes Only\n\nConfidential terms of the proposed acquisition. Subject to attorney-client privilege.',
    policyFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/department/value/legal`,
    ],
  },
  dave: {
    title: 'Infrastructure Security Audit Report',
    classification: 'Secret / IT Internal',
    plaintext: 'SECURITY AUDIT — Infrastructure Review Q3\n\nSecret / IT Internal\n\nVulnerability findings, remediation status, and network access control review.',
    policyFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/department/value/it`,
    ],
  },
}

export const COMMERCIAL_SAMPLE_FILES = [
  { id: 'briefing',    name: 'Q3_Threat_Briefing.pdf',        icon: 'document', size: '2.4 MB', classification: 'TOP SECRET' },
  { id: 'acquisition', name: 'Meridian_Acquisition_NDA.docx', icon: 'document', size: '845 KB', classification: 'SECRET' },
  { id: 'audit',       name: 'Infra_Security_Audit.xlsx',     icon: 'chart',    size: '1.1 MB', classification: 'SECRET' },
  { id: 'scope',       name: 'Atlas_Contractor_SOW.pdf',      icon: 'document', size: '560 KB', classification: 'UNCLASSIFIED' },
  { id: 'patent',      name: 'Patent_Filing_Draft.docx',      icon: 'document', size: '320 KB', classification: 'CONFIDENTIAL' },
  { id: 'incident',    name: 'Incident_Response_Log.txt',     icon: 'search',   size: '88 KB',  classification: 'SECRET' },
]

export const COMMERCIAL_FILE_PREVIEWS = {
  briefing:    'CLASSIFIED BRIEFING — Q3 Threat Assessment\n\nTop Secret / Finance Eyes Only\n\nRevenue exposure analysis and competitive intelligence for Q3. Contains non-public financial projections and threat actor profiling.',
  acquisition: 'MERGER AGREEMENT — Meridian Corp Acquisition\n\nSecret / Legal Eyes Only\n\nConfidential terms of the proposed acquisition. Subject to attorney-client privilege. Do not distribute.',
  audit:       'SECURITY AUDIT — Infrastructure Review Q3\n\nSecret / IT Internal\n\nVulnerability findings, remediation status, and network access control review for Q3 2024.',
  scope:       'SCOPE OF WORK — Project Atlas\n\nUnclassified / External Distribution\n\nEngagement scope, deliverables, and timeline for external contractor access.',
  patent:      'PATENT FILING DRAFT — Confidential\n\nMethod and system for attribute-based cryptographic key management. Filing reference #2024-DSP-441.',
  incident:    'INCIDENT RESPONSE LOG — Secret\n\n[2024-03-15 14:22] Anomalous access pattern detected on KAS node 3.\n[2024-03-15 14:28] Entitlement mismatch flagged for user bob@example.com.',
}

const COM_NS = 'example.com'
export const COMMERCIAL_FLAT_ATTRS = [
  { fqn: `https://${COM_NS}/attr/clearance/value/top-secret`,  ns: COM_NS, name: 'clearance',  value: 'top-secret',   label: 'clearance:top-secret' },
  { fqn: `https://${COM_NS}/attr/clearance/value/secret`,      ns: COM_NS, name: 'clearance',  value: 'secret',       label: 'clearance:secret' },
  { fqn: `https://${COM_NS}/attr/clearance/value/unclassified`,ns: COM_NS, name: 'clearance',  value: 'unclassified', label: 'clearance:unclassified' },
  { fqn: `https://${COM_NS}/attr/department/value/finance`,    ns: COM_NS, name: 'department', value: 'finance',      label: 'department:finance' },
  { fqn: `https://${COM_NS}/attr/department/value/legal`,      ns: COM_NS, name: 'department', value: 'legal',        label: 'department:legal' },
  { fqn: `https://${COM_NS}/attr/department/value/it`,         ns: COM_NS, name: 'department', value: 'it',           label: 'department:it' },
  { fqn: `https://${COM_NS}/attr/department/value/external`,   ns: COM_NS, name: 'department', value: 'external',     label: 'department:external' },
  { fqn: `https://${COM_NS}/attr/role/value/analyst`,          ns: COM_NS, name: 'role',       value: 'analyst',      label: 'role:analyst' },
  { fqn: `https://${COM_NS}/attr/role/value/counsel`,          ns: COM_NS, name: 'role',       value: 'counsel',      label: 'role:counsel' },
  { fqn: `https://${COM_NS}/attr/role/value/admin`,            ns: COM_NS, name: 'role',       value: 'admin',        label: 'role:admin' },
  { fqn: `https://${COM_NS}/attr/role/value/contractor`,       ns: COM_NS, name: 'role',       value: 'contractor',   label: 'role:contractor' },
]

// Attribute names shown in the demo UI (used to filter live platform results)
export const COMMERCIAL_DEMO_ATTR_NAMES = new Set(['clearance', 'department', 'role'])
export const FEDERAL_DEMO_ATTR_NAMES = new Set(['clearance', 'mission', 'role', 'caveats', 'relto', 'nationality', 'needtoknow'])

export const COMMERCIAL_THREATS = [
  {
    id: 'stolen-file',
    icon: 'folder',
    name: 'Stolen File',
    subtitle: 'Data Exfiltration',
    severity: 'HIGH',
    severityColor: '#f59e0b',
    attack: 'Attacker exfiltrates a TDF file from S3, email, or SharePoint. They have the file on their machine.',
    steps: [
      { label: 'Attacker obtains TDF file via exfiltration',    icon: 'folder', detail: "Possession of the file is meaningless. AES-256-GCM means the ciphertext is infeasible to break without the DEK — and the DEK is locked inside KAS." },
      { label: 'Opens file — sees only encrypted ciphertext',   icon: 'document', detail: "The TDF manifest is readable — it shows the policy and the wrapped key. But the wrapped key is encrypted with KAS's public key. Without KAS, it stays locked." },
      { label: 'Attempts to decrypt without a KAS credential',  icon: 'unlock', detail: "To obtain the DEK, the attacker must POST to /kas/v2/rewrap with a valid JWT. They have the file, but no way to obtain an authorized identity token." },
      { label: 'KAS rejects: no valid JWT presented',           icon: 'shield', detail: "No JWT means no key means no data. The attacker can copy, share, or hold the file indefinitely — it remains AES-256-GCM encrypted gibberish." },
    ],
    error: 'kas_auth_required — no bearer token — 401 Unauthorized',
    defense: "AES-256-GCM means the file is worthless without KAS. The DEK is wrapped with KAS's public key — only KAS can unwrap it, and KAS requires a valid verified JWT every time.",
    defenseIcon: 'lock',
    withoutDsp: {
      steps: ['Attacker copies file from S3', 'Opens file in standard viewer', 'Full plaintext visible immediately'],
      successMessage: 'FILE CONTENTS EXPOSED',
    },
  },
  {
    id: 'token-forgery',
    icon: 'security',
    name: 'Token Forgery',
    subtitle: 'JWT Spoofing',
    severity: 'CRITICAL',
    severityColor: '#ef4444',
    attack: 'Attacker crafts a fake JWT claiming clearance:top-secret without going through Keycloak at all.',
    steps: [
      { label: 'Attacker crafts JWT: { clearance: "top-secret" }', icon: 'handgear', detail: "A system that trusts token claims without verifying signatures can be fooled by any JSON. KAS does not trust claims — it verifies the cryptographic signature." },
      { label: "Signs with a random key (not Keycloak's key)",     icon: 'key', detail: "The attacker doesn't have Keycloak's private key — that's the point of asymmetric cryptography. Their signature is meaningless to KAS." },
      { label: 'Sends forged JWT + wrapped key to KAS',             icon: 'web', detail: "The forged token arrives at KAS. The claims look right, the structure is valid. KAS ignores the claims and goes straight to signature verification." },
      { label: 'KAS fetches JWKS from Keycloak, verifies sig',      icon: 'search', detail: "KAS fetches the JWKS from Keycloak and checks the signature. Mismatch. 403. Claims can be forged — cryptographic signatures cannot." },
    ],
    error: 'invalid_jwt_signature — 403 Forbidden',
    defense: "KAS fetches Keycloak's public JWKS on every request and cryptographically verifies the JWT signature. A forged token cannot produce a valid signature without Keycloak's private key.",
    defenseIcon: 'checkmark',
    withoutDsp: {
      steps: ['Attacker crafts fake JWT with admin claims', 'Presents forged token to unprotected API', 'API accepts token — no signature verification'],
      successMessage: 'UNAUTHORIZED ACCESS GRANTED',
    },
  },
  {
    id: 'privilege-escalation',
    icon: 'stack',
    name: 'Privilege Escalation',
    subtitle: 'Attribute Injection',
    severity: 'CRITICAL',
    severityColor: '#ef4444',
    attack: 'Insider intercepts their own JWT in transit and modifies claims to escalate clearance from secret → top-secret.',
    steps: [
      { label: 'Insider intercepts their own JWT in transit',        icon: 'toggle', detail: "The JWT is signed with Keycloak's private key. Any modification to any claim in the payload will invalidate that signature — by design." },
      { label: 'Modifies: clearance:secret → clearance:top-secret', icon: 'handgear', detail: "One field changed. The payload is now different from what Keycloak signed. The signature no longer matches — and KAS will detect this immediately." },
      { label: 'Forwards tampered JWT to KAS',                      icon: 'web', detail: "The tampered token has a valid issuer, valid expiry, and escalated claims. The signature is a cryptographic fingerprint of the original payload." },
      { label: 'KAS detects signature mismatch on modified claims',  icon: 'search', detail: "Signature mismatch detected. 403 Forbidden. The JWT signing mechanism makes payload tampering immediately and unambiguously detectable." },
    ],
    error: 'jwt_tampered — signature_mismatch — 403 Forbidden',
    defense: 'JWT claims are part of the signed payload. Any modification — even a single character — invalidates the cryptographic signature. KAS detects this immediately.',
    defenseIcon: 'lock',
    withoutDsp: {
      steps: ['Insider modifies session cookie claims', 'App trusts claims without re-validation', 'Insider reads top-secret documents'],
      successMessage: 'PRIVILEGE ESCALATION SUCCEEDED',
    },
  },
  {
    id: 'revoked-employee',
    icon: 'users',
    name: 'Revoked Employee',
    subtitle: 'Stale Access',
    severity: 'MEDIUM',
    severityColor: '#f59e0b',
    attack: 'Terminated employee still has a TDF file downloaded before they left. They try to access it after termination.',
    steps: [
      { label: 'Employee terminated — attribute removed from IdP',     icon: 'alert', detail: "The attribute is removed from the IdP. The next JWT this user obtains will not contain it. KAS checks entitlements live — no cached state is trusted." },
      { label: 'Ex-employee opens their local TDF copy',               icon: 'folder', detail: "The local file copy is irrelevant to whether access is granted. What matters is the live entitlement check that happens on every decrypt attempt." },
      { label: 'Gets a JWT from Keycloak (identity still exists)',      icon: 'key', detail: "Keycloak issues a valid JWT — the identity still exists. But the token reflects the current attribute state, which no longer includes the revoked clearance." },
      { label: 'KAS: clearance:top-secret not in live entitlements',   icon: 'shield', detail: "KAS queries the Platform and finds the attribute missing. 403 returned. The local copy is permanently inaccessible." },
    ],
    error: 'entitlement_check_failed — attribute_not_found — 403 Forbidden',
    defense: 'Even with the file and a valid identity, KAS checks entitlements live on every decrypt. Remove the attribute in the IdP and access is denied instantly — no file rotation needed.',
    defenseIcon: 'toggle',
    withoutDsp: {
      steps: ['Ex-employee opens file from local disk', 'App checks only session token (still valid)', 'Ex-employee reads sensitive document'],
      successMessage: 'STALE ACCESS NOT REVOKED',
    },
  },
]

export const COMMERCIAL_SCENARIOS = [
  {
    id: 'terminated',
    title: 'Terminated Employee',
    icon: 'users',
    tagline: 'Ex-employee still has sensitive files downloaded before leaving',
    steps: [
      { actor: 'IT Admin',  action: "Removes clearance:secret attribute from Sarah's account in Keycloak", ts: '-0:02', detail: "The moment this attribute is removed, the policy enforcement boundary moves instantly. No file recall, no re-encryption — just one attribute change." },
      { actor: 'Sarah',     action: 'Attempts to open Q3 Briefing she saved locally last week', ts: '0:00', detail: "With a traditional system, having the file locally means having the data. With TDF, the file is encrypted gibberish without KAS approval on every open." },
      { actor: 'DSP / KAS', action: "Receives decrypt request with Sarah's new token", ts: '0:01', detail: "KAS receives the key request with Sarah's freshly issued token — which no longer carries clearance:secret. The live entitlement check is about to run." },
      { actor: 'KAS',       action: 'Checks entitlements — clearance:secret NOT present → 403 Forbidden', ts: '0:01', result: 'denied', detail: "KAS queries the Platform and finds the attribute missing. 403 returned. The file remains permanently encrypted — no matter how many copies Sarah has." },
    ],
    outcome: 'Access revoked instantly. File remains encrypted gibberish.',
  },
  {
    id: 'contractor',
    title: 'Contractor Oversharing',
    icon: 'partners',
    tagline: 'External contractor forwards a confidential attachment to a personal email',
    steps: [
      { actor: 'Bob (Contractor)', action: 'Forwards encrypted TDF attachment to bob.personal@gmail.com', ts: '0:00', detail: "Bob can forward freely — the TDF is safe to share because it's cryptographically locked to the corporate KAS. Forwarding accomplishes nothing for the recipient." },
      { actor: 'Gmail',            action: 'Delivers message — attachment arrives as opaque .tdf file', ts: '0:01', detail: "The attachment lands in the personal inbox just like any file. But it's bound to the corporate identity provider — no personal device or account can unlock it." },
      { actor: 'Bob (personal)',   action: 'Tries to open attachment outside corporate environment', ts: '0:02', detail: "Outside the corporate environment, there's no way to obtain a valid entitlement token. The personal Gmail session carries zero weight with KAS." },
      { actor: 'KAS',              action: 'No valid entitlement token from personal context → 401 Unauthorized', ts: '0:02', result: 'denied', detail: "Without a valid token signed by the corporate IdP, KAS returns 401. The data is permanently inaccessible outside the authorized environment." },
    ],
    outcome: 'File is useless without a valid entitlement token. Forwarding solves nothing.',
  },
  {
    id: 'manda',
    title: 'M&A Due Diligence',
    icon: 'server',
    tagline: "Share sensitive documents with acquirer — revoke access the moment the deal closes or falls through",
    steps: [
      { actor: 'Legal (Carol)',       action: "Shares encrypted data room with acquirer's counsel — policy: role:counsel + department:legal", ts: '-72h', detail: "Carol sets the policy at encryption time: only users with role:counsel and department:legal can access. The acquirer's counsel qualifies — for now." },
      { actor: 'Acquirer',            action: 'Reviews documents under NDA — all access logged', ts: '-24h', detail: "Every decrypt attempt is checked live against the Platform. Every access is logged. Carol can see exactly which documents the acquirer opened and when." },
      { actor: 'Deal falls through',  action: 'Carol removes acquirer from role:counsel group in Keycloak', ts: '0:00', detail: "One group membership change in Keycloak is all it takes. No document retrieval, no secure deletion, no chasing down who has what copy." },
      { actor: 'KAS',                 action: 'Next decrypt attempt by acquirer → entitlement_check_failed → 403', ts: '0:01', result: 'denied', detail: "The attribute is gone from the acquirer's token. The next decrypt attempt returns 403 instantly. The data room is closed — cryptographically and irrevocably." },
    ],
    outcome: 'No document retrieval required. Attribute removal instantly locks the data room.',
  },
  {
    id: 'it-boundary',
    title: 'IT Admin Data Boundary',
    icon: 'tools',
    tagline: "IT opens a support ticket on Finance storage — DSP ensures they can manage infrastructure without reading the data",
    steps: [
      { actor: 'Finance User',    action: 'Opens support ticket: "cannot access encrypted drive" — Dave assigned', ts: '-0:05', detail: "IT admins routinely handle storage issues. The risk: admin-level access to infrastructure often bleeds into admin-level access to data. DSP breaks that equivalence." },
      { actor: 'Dave (IT Admin)', action: 'Navigates to Finance shared drive, attempts to open Q3 Threat Assessment', ts: '0:00', detail: "Dave opens the TDF to diagnose whether the decryption problem is on the client or the key service. He has full infrastructure access — but his token carries department:it, not department:finance." },
      { actor: 'DSP / KAS',       action: "Receives decrypt request with Dave's token: clearance:secret, department:it", ts: '0:01', detail: "KAS evaluates the request against the document policy: clearance:top-secret AND department:finance. Dave has neither. Infra access and data access are separate concerns." },
      { actor: 'KAS',             action: 'Policy requires clearance:top-secret + department:finance → 403 Forbidden', ts: '0:01', result: 'denied', detail: "403 returned. Dave can confirm the key service is reachable and responding — the support ticket can be resolved — without ever seeing the Finance data. Least-privilege enforced." },
    ],
    outcome: "IT can manage infrastructure without reading protected data. Admin access ≠ data access.",
  },
]

// ─── Federal / DoD ────────────────────────────────────────────────────────────

export const FEDERAL_PERSONAS = [
  {
    id: 'generic',
    name: 'Generic User',
    title: 'Demo View',
    avatar: '👤',
    username: 'user',
    nationality: null,
    coalition: [],
    needToKnow: [],
    attributes: [],
    fqns: [],
    color: '#6b7280',
  },
  {
    id: 'sarah',
    name: 'Maj. Sarah Williams',
    title: 'Intelligence Analyst J2',
    avatar: '👩‍✈️',
    username: 'sarah',
    nationality: 'USA',
    coalition: ['fvey', 'nato'],
    needToKnow: ['intel', 'ops'],
    attributes: ['clearance:ts-sci', 'mission:intel', 'role:analyst', 'nationality:USA', 'relto:fvey'],
    fqns: [
      `${NS}/clearance/value/ts-sci`,
      `${NS}/mission/value/intel`,
      `${NS}/role/value/analyst`,
      `${NS}/nationality/value/USA`,
      `${NS}/relto/value/fvey`,
    ],
    color: '#3b82f6',
  },
  {
    id: 'james',
    name: 'CPT. James Rivera',
    title: 'Cleared Contractor SOCOM',
    avatar: '👨‍💼',
    username: 'james',
    nationality: 'USA',
    coalition: ['fvey', 'nato'],
    needToKnow: ['external'],
    attributes: ['clearance:secret', 'mission:external', 'role:contractor', 'nationality:USA', 'relto:fvey'],
    fqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/mission/value/external`,
      `${NS}/role/value/contractor`,
      `${NS}/nationality/value/USA`,
      `${NS}/relto/value/fvey`,
    ],
    color: '#f59e0b',
  },
  {
    id: 'patricia',
    name: 'Col. Patricia Lee',
    title: 'Staff Judge Advocate JAG',
    avatar: '👩‍⚖️',
    username: 'patricia',
    nationality: 'USA',
    coalition: ['fvey', 'nato'],
    needToKnow: ['legal'],
    attributes: ['clearance:secret', 'mission:legal', 'role:counsel', 'nationality:USA', 'relto:fvey'],
    fqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/mission/value/legal`,
      `${NS}/role/value/counsel`,
      `${NS}/nationality/value/USA`,
      `${NS}/relto/value/fvey`,
    ],
    color: '#8b5cf6',
  },
  {
    id: 'marcus',
    name: 'CW3 Marcus Johnson',
    title: 'Cyberspace Ops G6',
    avatar: '🧑‍💻',
    username: 'marcus',
    nationality: 'USA',
    coalition: ['fvey', 'nato'],
    needToKnow: ['cyber'],
    attributes: ['clearance:secret', 'mission:cyber', 'role:admin', 'nationality:USA', 'relto:fvey'],
    fqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/mission/value/cyber`,
      `${NS}/role/value/admin`,
      `${NS}/nationality/value/USA`,
      `${NS}/relto/value/fvey`,
    ],
    color: '#10b981',
  },
  {
    id: 'fvey-uk',
    name: 'Flt Lt Emma Clarke',
    title: 'UK Intelligence Liaison',
    avatar: '🇬🇧',
    username: 'emma.clarke',
    nationality: 'GBR',
    coalition: ['fvey', 'nato'],
    needToKnow: ['intel'],
    attributes: ['clearance:secret', 'nationality:GBR', 'relto:fvey', 'relto:nato', 'needtoknow:intel'],
    fqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/nationality/value/GBR`,
      `${NS}/relto/value/fvey`,
      `${NS}/relto/value/nato`,
      `${NS}/needtoknow/value/intel`,
    ],
    color: '#0ea5e9',
  },
  {
    id: 'nato-fr',
    name: 'Maj. Henri Dubois',
    title: 'French Defense Attaché',
    avatar: '🇫🇷',
    username: 'henri.dubois',
    nationality: 'FRA',
    coalition: ['nato'],
    needToKnow: ['ops'],
    attributes: ['clearance:secret', 'nationality:FRA', 'relto:nato', 'needtoknow:ops'],
    fqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/nationality/value/FRA`,
      `${NS}/relto/value/nato`,
      `${NS}/needtoknow/value/ops`,
    ],
    color: '#f97316',
  },
  {
    id: 'nato-de',
    name: 'Maj. Klaus Richter',
    title: 'German Cyber Command',
    avatar: '🇩🇪',
    username: 'klaus.richter',
    nationality: 'DEU',
    coalition: ['nato'],
    needToKnow: ['cyber'],
    attributes: ['clearance:secret', 'nationality:DEU', 'relto:nato', 'needtoknow:cyber'],
    fqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/nationality/value/DEU`,
      `${NS}/relto/value/nato`,
      `${NS}/needtoknow/value/cyber`,
    ],
    color: '#a3a3a3',
  },
]

export const FEDERAL_PERSONA_DOCS = {
  sarah: {
    title: 'Intel Briefing Q3 — NOFORN',
    classification: 'TS/SCI NOFORN',
    plaintext: 'INTELLIGENCE BRIEFING — Q3 SIGINT Summary\n\nTS/SCI NOFORN\n\nSignals intelligence assessment covering adversary communication patterns and order of battle. NOFORN — not releasable to foreign nationals.',
    policyFqns: [
      `${NS}/clearance/value/ts-sci`,
      `${NS}/mission/value/intel`,
    ],
  },
  james: {
    title: 'Contractor PWS — SOCOM',
    classification: 'Unclassified / External',
    plaintext: 'PERFORMANCE WORK STATEMENT — SOCOM Contractor Support\n\nUnclassified / External\n\nScope of work for cleared contractor support of SOCOM operations. Distribution authorized to cleared contractor personnel only.',
    policyFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/mission/value/external`,
    ],
  },
  patricia: {
    title: 'UCMJ Article 32 Investigation',
    classification: 'Secret / Legal',
    plaintext: 'ARTICLE 32 PRELIMINARY HEARING — UCMJ\n\nSecret / Legal Eyes Only\n\nPreliminary hearing officer findings and recommendations. Subject to military privilege and attorney-client protections.',
    policyFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/mission/value/legal`,
    ],
  },
  marcus: {
    title: 'Cyber Incident Report G6',
    classification: 'Secret / Internal',
    plaintext: 'CYBER INCIDENT REPORT — G6 CYBERSPACE OPS\n\nSecret / Internal\n\nAnomaly detected on SIPR node cluster 7. Lateral movement indicators observed. Containment actions initiated per COOP plan.',
    policyFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/mission/value/cyber`,
    ],
  },
  'fvey-uk': {
    title: 'FVEY Intelligence Summary',
    classification: 'SECRET // REL TO FVEY',
    plaintext: 'FIVE EYES INTELLIGENCE SUMMARY\n\nSECRET // REL TO FVEY\n\nJoint intelligence product from FVEY partner agencies. Releasable to USA, GBR, AUS, CAN, NZL only. Handle per FVEY sharing protocols.',
    policyFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/relto/value/fvey`,
    ],
  },
  'nato-fr': {
    title: 'NATO Cyber Defense Brief',
    classification: 'SECRET // REL TO NATO',
    plaintext: 'NATO COLLECTIVE CYBER DEFENSE BRIEFING\n\nSECRET // REL TO NATO\n\nThreat assessment and defensive posture for NATO member-state infrastructure. Releasable to all NATO member nations.',
    policyFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/relto/value/nato`,
    ],
  },
  'nato-de': {
    title: 'NATO Cyber Defense Brief',
    classification: 'SECRET // REL TO NATO',
    plaintext: 'NATO COLLECTIVE CYBER DEFENSE BRIEFING\n\nSECRET // REL TO NATO\n\nThreat assessment and defensive posture for NATO member-state infrastructure. Releasable to all NATO member nations.',
    policyFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/relto/value/nato`,
    ],
  },
}

export const FEDERAL_SAMPLE_FILES = [
  { id: 'opord',       name: 'OPORD_Op_Meridian.pdf',         icon: 'document', size: '1.8 MB', classification: 'SECRET' },
  { id: 'sitrep',      name: 'SITREP_Daily_Report.pdf',       icon: 'document', size: '540 KB', classification: 'SECRET' },
  { id: 'intel',       name: 'Intel_Briefing_NOFORN.pdf',     icon: 'search',   size: '3.2 MB', classification: 'TOP SECRET' },
  { id: 'roe',         name: 'ROE_Coalition_Partners.docx',   icon: 'document', size: '720 KB', classification: 'SECRET' },
  { id: 'cyber',       name: 'Cyber_Incident_G6.txt',         icon: 'shield',   size: '95 KB',  classification: 'SECRET' },
  { id: 'pws',         name: 'Contractor_PWS_SOCOM.pdf',      icon: 'document', size: '410 KB', classification: 'UNCLASSIFIED' },
]

export const FEDERAL_FILE_PREVIEWS = {
  opord:  'OPERATION ORDER — OPERATION MERIDIAN\n\nSecret\n\nTask organization, commander\'s intent, and execution phase lines for Operation Meridian. This document is classified SECRET and subject to OPSEC restrictions.',
  sitrep: 'SITUATION REPORT — Daily SITREP\n\nSecret\n\nCurrent operational status, enemy activity, and friendly force disposition as of 0600Z. Distribution: J2, J3, battalion commanders.',
  intel:  'INTELLIGENCE BRIEFING — NOFORN\n\nTop Secret/SCI\n\nSignals intelligence assessment and adversary order of battle. NOT RELEASABLE TO FOREIGN NATIONALS. Handle per SCI procedures.',
  roe:    'RULES OF ENGAGEMENT — Coalition Operations\n\nSecret\n\nEngagement authority and ROE card for coalition partner forces. Annex C to OPORD 24-003.',
  cyber:  'CYBER INCIDENT REPORT — G6\n\nSecret\n\n[2024-03-15 14:22Z] Anomalous lateral movement detected on SIPR cluster 7.\n[2024-03-15 14:31Z] Containment initiated. COOP activated.',
  pws:    'PERFORMANCE WORK STATEMENT — SOCOM Support\n\nUnclassified\n\nScope, deliverables, and security requirements for contractor support of SOCOM information operations.',
}

const FED_NS = 'example.com'
export const FEDERAL_FLAT_ATTRS = [
  // clearance (HIERARCHY — higher levels satisfy lower)
  { fqn: `https://${FED_NS}/attr/clearance/value/ts-sci`,       ns: FED_NS, name: 'clearance',    value: 'ts-sci',       label: 'clearance:ts-sci',       rule: 'HIERARCHY' },
  { fqn: `https://${FED_NS}/attr/clearance/value/sci`,          ns: FED_NS, name: 'clearance',    value: 'sci',          label: 'clearance:sci',           rule: 'HIERARCHY' },
  { fqn: `https://${FED_NS}/attr/clearance/value/secret`,       ns: FED_NS, name: 'clearance',    value: 'secret',       label: 'clearance:secret',        rule: 'HIERARCHY' },
  { fqn: `https://${FED_NS}/attr/clearance/value/cui`,          ns: FED_NS, name: 'clearance',    value: 'cui',          label: 'clearance:cui',           rule: 'HIERARCHY' },
  { fqn: `https://${FED_NS}/attr/clearance/value/unclassified`, ns: FED_NS, name: 'clearance',    value: 'unclassified', label: 'clearance:unclassified',  rule: 'HIERARCHY' },
  // mission (ANY_OF)
  { fqn: `https://${FED_NS}/attr/mission/value/intel`,          ns: FED_NS, name: 'mission',      value: 'intel',        label: 'mission:intel',           rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/mission/value/ops`,            ns: FED_NS, name: 'mission',      value: 'ops',          label: 'mission:ops',             rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/mission/value/legal`,          ns: FED_NS, name: 'mission',      value: 'legal',        label: 'mission:legal',           rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/mission/value/cyber`,          ns: FED_NS, name: 'mission',      value: 'cyber',        label: 'mission:cyber',           rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/mission/value/external`,       ns: FED_NS, name: 'mission',      value: 'external',     label: 'mission:external',        rule: 'ANY_OF' },
  // role (ANY_OF)
  { fqn: `https://${FED_NS}/attr/role/value/analyst`,           ns: FED_NS, name: 'role',         value: 'analyst',      label: 'role:analyst',            rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/role/value/contractor`,        ns: FED_NS, name: 'role',         value: 'contractor',   label: 'role:contractor',         rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/role/value/counsel`,           ns: FED_NS, name: 'role',         value: 'counsel',      label: 'role:counsel',            rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/role/value/admin`,             ns: FED_NS, name: 'role',         value: 'admin',        label: 'role:admin',              rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/role/value/commander`,         ns: FED_NS, name: 'role',         value: 'commander',    label: 'role:commander',          rule: 'ANY_OF' },
  // caveats (ALL_OF)
  { fqn: `https://${FED_NS}/attr/caveats/value/noforn`,         ns: FED_NS, name: 'caveats',      value: 'noforn',       label: 'caveats:noforn',          rule: 'ALL_OF' },
  { fqn: `https://${FED_NS}/attr/caveats/value/relto-fvey`,     ns: FED_NS, name: 'caveats',      value: 'relto-fvey',   label: 'caveats:relto-fvey',      rule: 'ALL_OF' },
  { fqn: `https://${FED_NS}/attr/caveats/value/orcon`,          ns: FED_NS, name: 'caveats',      value: 'orcon',        label: 'caveats:orcon',           rule: 'ALL_OF' },
  { fqn: `https://${FED_NS}/attr/caveats/value/propin`,         ns: FED_NS, name: 'caveats',      value: 'propin',       label: 'caveats:propin',          rule: 'ALL_OF' },
  // relto / coalition (ANY_OF — one membership is sufficient)
  { fqn: `https://${FED_NS}/attr/relto/value/fvey`,             ns: FED_NS, name: 'relto',        value: 'fvey',         label: 'relto:fvey',              rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/relto/value/nato`,             ns: FED_NS, name: 'relto',        value: 'nato',         label: 'relto:nato',              rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/relto/value/pink`,             ns: FED_NS, name: 'relto',        value: 'pink',         label: 'relto:pink',              rule: 'ANY_OF' },
  // nationality (ANY_OF)
  { fqn: `https://${FED_NS}/attr/nationality/value/USA`,        ns: FED_NS, name: 'nationality',  value: 'USA',          label: 'nationality:USA',         rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/nationality/value/GBR`,        ns: FED_NS, name: 'nationality',  value: 'GBR',          label: 'nationality:GBR',         rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/nationality/value/AUS`,        ns: FED_NS, name: 'nationality',  value: 'AUS',          label: 'nationality:AUS',         rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/nationality/value/CAN`,        ns: FED_NS, name: 'nationality',  value: 'CAN',          label: 'nationality:CAN',         rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/nationality/value/NZL`,        ns: FED_NS, name: 'nationality',  value: 'NZL',          label: 'nationality:NZL',         rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/nationality/value/FRA`,        ns: FED_NS, name: 'nationality',  value: 'FRA',          label: 'nationality:FRA',         rule: 'ANY_OF' },
  { fqn: `https://${FED_NS}/attr/nationality/value/DEU`,        ns: FED_NS, name: 'nationality',  value: 'DEU',          label: 'nationality:DEU',         rule: 'ANY_OF' },
  // needtoknow (ALL_OF — must have all specified compartments)
  { fqn: `https://${FED_NS}/attr/needtoknow/value/intel`,       ns: FED_NS, name: 'needtoknow',   value: 'intel',        label: 'needtoknow:intel',        rule: 'ALL_OF' },
  { fqn: `https://${FED_NS}/attr/needtoknow/value/ops`,         ns: FED_NS, name: 'needtoknow',   value: 'ops',          label: 'needtoknow:ops',          rule: 'ALL_OF' },
  { fqn: `https://${FED_NS}/attr/needtoknow/value/legal`,       ns: FED_NS, name: 'needtoknow',   value: 'legal',        label: 'needtoknow:legal',        rule: 'ALL_OF' },
  { fqn: `https://${FED_NS}/attr/needtoknow/value/cyber`,       ns: FED_NS, name: 'needtoknow',   value: 'cyber',        label: 'needtoknow:cyber',        rule: 'ALL_OF' },
  { fqn: `https://${FED_NS}/attr/needtoknow/value/external`,    ns: FED_NS, name: 'needtoknow',   value: 'external',     label: 'needtoknow:external',     rule: 'ALL_OF' },
]

export const FEDERAL_THREATS = [
  {
    id: 'exfil-sipr',
    icon: 'folder',
    name: 'Exfiltrated SIPR File',
    subtitle: 'Data Exfiltration',
    severity: 'HIGH',
    severityColor: '#f59e0b',
    attack: 'Adversary exfiltrates a TDF file from a SIPR share. No CAC credential available outside the classified enclave.',
    steps: [
      { label: 'Adversary copies TDF file from SIPR share',         icon: 'folder', detail: "In a traditional system, getting the file off the SIPR network is game over. With TDF, the cryptographic boundary travels with the data." },
      { label: 'Transfers file to unclassified system',             icon: 'document', detail: "The file is on an unclassified system. Without a CAC-backed credential trusted by KAS, it's meaningless bytes." },
      { label: 'Attempts to decrypt without CAC-backed credential', icon: 'unlock', detail: "The adversary has no DoD PKI-backed credential. KAS only accepts tokens from its registered trust anchors — no credential, no key." },
      { label: 'KAS rejects: no valid PKI-backed JWT presented',    icon: 'shield', detail: "401 Unauthorized. The classified data is cryptographically inaccessible outside the authorized environment — regardless of how it was obtained." },
    ],
    error: 'kas_auth_required — no bearer token — 401 Unauthorized',
    defense: 'The file is worthless outside the KAS trust boundary. The DEK is wrapped with the KAS public key — only KAS can unwrap it, and KAS requires a verified PKI-backed token on every request.',
    defenseIcon: 'lock',
    withoutDsp: {
      steps: ['Adversary copies file from SIPR share', 'Opens file on unclassified system', 'Full plaintext immediately visible'],
      successMessage: 'CLASSIFIED DATA EXPOSED',
    },
  },
  {
    id: 'forged-cac',
    icon: 'security',
    name: 'Forged CAC Token',
    subtitle: 'PKI Spoofing',
    severity: 'CRITICAL',
    severityColor: '#ef4444',
    attack: 'Adversary crafts a fake PKI-signed JWT claiming clearance:ts-sci without a valid DoD CAC certificate.',
    steps: [
      { label: 'Adversary crafts JWT: { clearance: "ts-sci" }', icon: 'handgear', detail: "A forged token with the right claims could fool a system that trusts claims without verification. KAS validates the entire PKI chain — not just the claims." },
      { label: 'Signs with a self-signed key (not DoD PKI)',          icon: 'key', detail: "Self-signed certificates are not trusted by any legitimate PKI chain. KAS validates against registered DoD trust anchors — not the token's self-reported issuer." },
      { label: 'Sends forged JWT + wrapped key to KAS',               icon: 'web', detail: "The forged token arrives at KAS. The claims look right. KAS will now verify the cryptographic chain back to a trusted DoD root." },
      { label: 'KAS fetches JWKS from IdP, verifies PKI chain',       icon: 'search', detail: "Chain-of-trust validation fails. The token cannot be traced to a trusted DoD PKI anchor. 403 Forbidden. Claims without a valid chain are worthless." },
    ],
    error: 'invalid_jwt_signature — untrusted_issuer — 403 Forbidden',
    defense: 'KAS validates the JWT against the registered IdP JWKS on every request. A token not signed by a trusted DoD PKI anchor will fail signature verification immediately.',
    defenseIcon: 'checkmark',
    withoutDsp: {
      steps: ['Adversary crafts fake PKI token with ts-sci claims', 'Presents token to unprotected classified system', 'System grants access without chain-of-trust validation'],
      successMessage: 'UNAUTHORIZED ACCESS GRANTED',
    },
  },
  {
    id: 'clearance-escalation',
    icon: 'stack',
    name: 'Clearance Level Manipulation',
    subtitle: 'Attribute Injection',
    severity: 'CRITICAL',
    severityColor: '#ef4444',
    attack: 'Insider intercepts their own JWT and injects a clearance escalation — secret → ts-sci — before presenting it to KAS.',
    steps: [
      { label: 'Insider captures their own auth token in transit',         icon: 'toggle', detail: "Intercepting your own token is technically feasible. But JWT payloads are covered by the cryptographic signature — any modification invalidates it." },
      { label: 'Injects: clearance:secret → clearance:ts-sci',  icon: 'handgear', detail: "Two characters changed in the payload. The signature, computed over the original payload, no longer matches. KAS will detect this in milliseconds." },
      { label: 'Forwards tampered token to KAS',                          icon: 'web', detail: "The tampered token has a valid issuer, valid expiry, and escalated claims. The signature is a cryptographic fingerprint of the original unmodified payload." },
      { label: 'KAS detects signature mismatch on modified claims',        icon: 'search', detail: "Signature mismatch. Immediate 403. Clearance escalation through token manipulation is cryptographically impossible with KAS in the path." },
    ],
    error: 'jwt_tampered — signature_mismatch — 403 Forbidden',
    defense: 'JWT claims are covered by the cryptographic signature. Any modification to the payload invalidates the signature. KAS rejects the tampered token before any entitlement check runs.',
    defenseIcon: 'lock',
    withoutDsp: {
      steps: ['Insider modifies session attributes in local cache', 'System trusts locally-cached clearance level', 'Insider accesses TS/SCI compartmented material'],
      successMessage: 'CLEARANCE ESCALATION SUCCEEDED',
    },
  },
  {
    id: 'discharged-servicemember',
    icon: 'users',
    name: 'Discharged Servicemember',
    subtitle: 'Stale Access',
    severity: 'MEDIUM',
    severityColor: '#f59e0b',
    attack: 'Servicemember is discharged and clearance is suspended. They retained a TDF file on a personally-owned device.',
    steps: [
      { label: 'Clearance suspended — attributes removed from IdP',     icon: 'alert', detail: "Clearance suspension is reflected immediately in the IdP. The next token issued for this identity will not carry the suspended attributes." },
      { label: 'Ex-servicemember opens local copy from personal device', icon: 'folder', detail: "The file is on a personal device outside any controlled environment. Physical access controls are gone — but the cryptographic controls are absolute." },
      { label: 'Gets a token (identity still exists in system)',          icon: 'key', detail: "The identity still exists — the servicemember can authenticate. But authentication is not authorization. KAS checks entitlements separately." },
      { label: 'KAS: clearance:secret not in live entitlements',    icon: 'shield', detail: "clearance:secret is no longer present in the live entitlement set. 403 Forbidden. The suspended clearance takes effect immediately on every decrypt." },
    ],
    error: 'entitlement_check_failed — clearance_suspended — 403 Forbidden',
    defense: 'KAS checks entitlements live on every decrypt attempt. Suspending a clearance in the IdP takes effect immediately — no file retrieval or rotation required.',
    defenseIcon: 'toggle',
    withoutDsp: {
      steps: ['Ex-servicemember opens file from personal device', 'App checks stale cached token (still valid)', 'Classified document is readable'],
      successMessage: 'STALE CLEARANCE NOT REVOKED',
    },
  },
]

export const FEDERAL_SCENARIOS = [
  {
    id: 'clearance-revoked',
    title: 'Security Clearance Revoked',
    icon: 'compliance',
    tagline: 'TS/SCI revoked mid-operation — local SIGINT file becomes instantly inaccessible',
    steps: [
      { actor: 'G2 Security',       action: "Removes clearance:ts-sci from Maj. Williams' account following adjudication hold", ts: '-0:02', detail: "Adjudication hold triggers an attribute removal. The change is immediate in the IdP — KAS will enforce it on the next decrypt attempt with no grace period." },
      { actor: 'Maj. Williams',     action: 'Attempts to open SIGINT briefing saved locally during the operation', ts: '0:00', detail: "Maj. Williams has the SIGINT file locally. The classification markings are visible on the container — but the contents are unreadable without KAS." },
      { actor: 'DSP / KAS',         action: "Receives decrypt request with Williams' refreshed token", ts: '0:01', detail: "KAS receives the request with Williams' refreshed token — issued after the attribute removal. The live check will reflect the current clearance status." },
      { actor: 'KAS',               action: 'Checks live entitlements — clearance:ts-sci NOT present → 403 Forbidden', ts: '0:01', result: 'denied', detail: "clearance:ts-sci is no longer present. KAS returns 403. The operation data is immediately inaccessible — no document recall order required." },
    ],
    outcome: 'Access suspended instantly. Encrypted file is unreadable — no document recall required.',
  },
  {
    id: 'coalition-overshare',
    title: 'Coalition Partner Oversharing',
    icon: 'partners',
    tagline: 'Five Eyes partner forwards a NOFORN attachment outside authorized channels',
    steps: [
      { actor: 'Partner Analyst',  action: 'Forwards encrypted NOFORN TDF attachment to a non-US coalition mailbox', ts: '0:00', detail: "The partner can forward freely — NOFORN enforcement is cryptographic, not procedural. The file is useless outside the authorized access boundary." },
      { actor: 'Coalition Server', action: 'Delivers message — attachment arrives as opaque .tdf file', ts: '0:01', detail: "The TDF arrives intact at the coalition mailbox. It looks like an ordinary attachment but is bound to a KAS that only accepts CAC-backed credentials." },
      { actor: 'Recipient',        action: 'Attempts to open attachment — no valid CAC-backed token in this environment', ts: '0:02', detail: "The recipient has no valid CAC-backed entitlement token in this environment. The NOFORN policy is technically enforced — not just labeled." },
      { actor: 'KAS',              action: 'No authorized entitlement token presented → 401 Unauthorized', ts: '0:02', result: 'denied', detail: "401 Unauthorized. No authorized token means no key means no data. NOFORN is enforced at the cryptographic layer, not the honor system." },
    ],
    outcome: 'File is useless outside the authorized access boundary. NOFORN caveat is technically enforced.',
  },
  {
    id: 'mission-compartment',
    title: 'Mission-Based Compartment',
    icon: 'chess',
    tagline: 'G2 creates a time-limited mission compartment — expires automatically after the operation window',
    steps: [
      { actor: 'G2 (Maj. Williams)', action: 'Creates mission:op-meridian attribute — valid for 12h assault window', ts: '-12h', detail: "G2 creates a time-limited attribute in the Platform and assigns it to the assault element. The compartment is live the moment the attribute exists." },
      { actor: 'Assault Element',    action: 'Accesses OPORD and ISR imagery using mission:op-meridian entitlement', ts: '-6h', detail: "Every decrypt against OPORD and ISR imagery is checked live — mission:op-meridian must be present in the token. All access is logged for the after-action." },
      { actor: 'G2',                 action: 'Operation window closes — removes mission:op-meridian from all accounts', ts: '0:00', detail: "G2 removes the attribute from all accounts. The operation window is closed. No document destruction or file rotation required." },
      { actor: 'KAS',                action: 'Any subsequent decrypt attempt → entitlement_check_failed → 403', ts: '0:01', result: 'denied', detail: "Any subsequent decrypt returns 403. The OPORD and ISR data are automatically inaccessible — compartment expiry is cryptographically enforced." },
    ],
    outcome: 'Compartment expires on schedule. OPORD and ISR data automatically inaccessible — no document destruction required.',
  },
  {
    id: 'legal-hold',
    title: 'UCMJ Legal Hold',
    icon: 'compliance',
    tagline: "JAG places a legal hold on operational evidence — chain of custody is cryptographically enforced and auditable",
    steps: [
      { actor: 'G2 Security',          action: "Revokes mission:intel from whistleblower's account — access to SIGINT files removed", ts: '-1h', detail: "G2 revokes the operational attribute. The whistleblower's access to the SIGINT documents is instantly cut — the files are now inaccessible to them regardless of what copies exist." },
      { actor: 'Col. Lee (JAG)',        action: 'Opens UCMJ Article 32 investigation — requests legal access grant to SIGINT evidence', ts: '0:00', detail: "JAG cannot proceed without access to the actual documents. G2 grants a mission:legal access to the specific evidence files — scoped precisely to the legal review, not a broad clearance elevation." },
      { actor: 'Platform',             action: 'G2 adds mission:legal grant to SIGINT document policy — Col. Lee now entitled', ts: '0:01', detail: "The Platform updates the subject mapping: mission:legal satisfies the document policy for this specific investigation. No other documents are affected. Least-privilege legal access." },
      { actor: 'KAS',                  action: "Col. Lee decrypts SIGINT file — access granted, cryptographically logged", ts: '0:02', result: 'granted', detail: "KAS grants access and logs it with a cryptographic signature. The audit trail — who accessed what, when, and from where — is tamper-evident and admissible as chain of custody in UCMJ proceedings." },
    ],
    outcome: "JAG has precisely scoped, audited access to evidence. Chain of custody is cryptographically enforced — admissible in UCMJ proceedings.",
  },
  {
    id: 'nato-coalition-share',
    title: 'NATO Coalition Share',
    icon: 'globe',
    tagline: 'NATO cyber defense brief shared with all member nations — non-NATO partners automatically blocked',
    steps: [
      { actor: 'NATO CISO',           action: 'Encrypts cyber defense brief with policy: clearance:secret + relto:nato', ts: '-2h', detail: "The document policy uses relto:nato — a coalition group attribute. Any user whose nationality maps to a NATO member nation satisfies this. Non-NATO nations are automatically excluded." },
      { actor: 'Flt Lt Clarke (GBR)', action: 'Opens brief from shared NATO portal — GBR is a FVEY and NATO member', ts: '0:00', result: 'granted', detail: "Clarke's token carries nationality:GBR and relto:nato. KAS resolves the coalition membership: GBR ∈ NATO → relto:nato satisfied. Access granted." },
      { actor: 'Maj. Dubois (FRA)',   action: 'Opens brief — FRA is a NATO member nation', ts: '0:01', result: 'granted', detail: "Dubois carries nationality:FRA and relto:nato. FRA ∈ NATO. KAS grants access — the relto:nato policy is designed precisely to include all NATO member nations." },
      { actor: 'KAS',                 action: 'Non-NATO partner attempts access — nationality not in NATO membership list → 403', ts: '0:02', result: 'denied', detail: "A partner nation outside NATO has no relto:nato attribute. 403. The coalition boundary is cryptographically enforced — non-members cannot access NATO-tagged documents regardless of other attributes." },
    ],
    outcome: 'NATO members granted, non-members blocked. Coalition releasability is cryptographically — not procedurally — enforced.',
  },
  {
    id: 'fvey-eyes-only',
    title: 'FVEY Eyes Only',
    icon: 'search',
    tagline: 'SIGINT shared inside the Five Eyes — NATO allies outside FVEY are blocked despite SECRET clearance',
    steps: [
      { actor: 'NSA Analyst',         action: 'Encrypts SIGINT summary with policy: clearance:secret + relto:fvey + needtoknow:intel', ts: '-4h', detail: "The document requires three attributes: secret clearance, FVEY membership, AND needtoknow:intel. All three must be satisfied — this is an ALL_OF on needtoknow and ANY_OF on relto (FVEY only)." },
      { actor: 'Maj. Williams (USA)', action: 'Opens SIGINT file — US/FVEY/ts-sci/intel credentials presented', ts: '0:00', result: 'granted', detail: "Williams satisfies all three: clearance:ts-sci ≥ secret, nationality:USA → relto:fvey, needtoknow:intel present. Full access granted." },
      { actor: 'Flt Lt Clarke (GBR)', action: 'Opens SIGINT file — GBR is FVEY, intel compartment present', ts: '0:01', result: 'granted', detail: "Clarke satisfies: clearance:secret, nationality:GBR → relto:fvey, needtoknow:intel. GBR is explicitly in the FVEY group. Access granted." },
      { actor: 'Maj. Dubois (FRA)',   action: 'Attempts to open SIGINT file — FRA is NATO but NOT FVEY', ts: '0:02', result: 'denied', detail: "Dubois has clearance:secret and relto:nato — but relto:fvey is not satisfied. FRA is a NATO member but not FVEY. 403. The FVEY boundary holds even for close allied partners." },
    ],
    outcome: 'FVEY-only access enforced cryptographically. NATO partners outside FVEY blocked despite equivalent clearance.',
  },
]

// ─── Coalition Personas (full set, for CoalitionPage) ────────────────────────

// Coalition group membership definitions — used by CoalitionPage for the visualizer
export const COALITION_GROUPS = {
  fvey: {
    name: 'FVEY',
    label: 'Five Eyes',
    color: '#3b82f6',
    nations: ['USA', 'GBR', 'AUS', 'CAN', 'NZL'],
    description: 'Australia, Canada, New Zealand, United Kingdom, United States',
  },
  nato: {
    name: 'NATO',
    label: 'NATO Alliance',
    color: '#0ea5e9',
    nations: ['USA', 'GBR', 'AUS', 'CAN', 'NZL', 'FRA', 'DEU', 'ITA', 'ESP', 'NOR', 'DNK', 'BEL', 'NLD', 'POL', 'CZE', 'HUN', 'ROU', 'BGR', 'EST', 'LVA', 'LTU', 'SVK', 'SVN', 'HRV', 'MNE', 'MKD', 'ALB', 'TUR', 'GRC', 'PRT', 'LUX', 'ISL'],
    description: '32 member nations — collective defense Article 5',
  },
  pink: {
    name: 'PINK',
    label: 'PINK Alliance',
    color: '#a855f7',
    nations: ['USA', 'GBR', 'AUS', 'CAN', 'NZL', 'FRA', 'DEU', 'ITA', 'ESP', 'NOR', 'DNK', 'BEL', 'NLD', 'POL', 'CZE', 'HRV', 'ROU', 'TUR', 'SWE', 'FIN', 'AUT'],
    description: 'Extended NATO partnership group',
  },
}

// ─── Tagging PDP Samples (for TaggingPDPPage) ────────────────────────────────

export const TAGGING_SAMPLES = [
  {
    id: 'fvey-ops',
    label: 'SECRET // REL TO USA, GBR // NTK OPS',
    banner: 'SECRET // REL TO USA, GBR // NTK OPS',
    body: 'JOINT OPERATIONS INTELLIGENCE REPORT\n\nSECRET // REL TO USA, GBR // NTK OPS\n\nAdversary activity in the northern sector indicates increased SIGINT collection operations. All units should maintain communications discipline. Distribution limited to US and UK personnel with OPS compartment.',
    extractedAttrs: [
      { type: 'classification', label: 'clearance:secret',       fqn: `https://${FED_NS}/attr/clearance/value/secret`,     matched: 'SECRET',   rule: 'HIERARCHY', color: '#ef4444' },
      { type: 'relto',         label: 'nationality:USA',         fqn: `https://${FED_NS}/attr/nationality/value/USA`,      matched: 'USA',      rule: 'ANY_OF',    color: '#3b82f6' },
      { type: 'relto',         label: 'nationality:GBR',         fqn: `https://${FED_NS}/attr/nationality/value/GBR`,      matched: 'GBR',      rule: 'ANY_OF',    color: '#3b82f6' },
      { type: 'needtoknow',    label: 'needtoknow:ops',          fqn: `https://${FED_NS}/attr/needtoknow/value/ops`,       matched: 'OPS',      rule: 'ALL_OF',    color: '#8b5cf6' },
    ],
    synonym: { input: 'SECRET', output: 'secret', dict: 'classification-dict' },
    rollup: 'High watermark: SECRET (HIERARCHY) — kept as-is. REL TO list becomes ANY_OF nationality attributes. NTK becomes ALL_OF needtoknow.',
  },
  {
    id: 'ts-noforn',
    label: 'TOP SECRET // NOFORN // NTK INTEL OPS',
    banner: 'TOP SECRET // NOFORN // NTK INTEL OPS',
    body: 'SIGNALS INTELLIGENCE ASSESSMENT\n\nTOP SECRET // NOFORN // NTK INTEL OPS\n\nSECTION 1: COLLECTION SUMMARY\nCollection activities indicate significant adversary command and control activity. This product is NOT RELEASABLE TO FOREIGN NATIONALS. Access requires INTEL and OPS compartment authorization.',
    extractedAttrs: [
      { type: 'classification', label: 'clearance:ts-sci',        fqn: `https://${FED_NS}/attr/clearance/value/ts-sci`,     matched: 'TOP SECRET', rule: 'HIERARCHY', color: '#ef4444' },
      { type: 'caveat',        label: 'caveats:noforn',           fqn: `https://${FED_NS}/attr/caveats/value/noforn`,       matched: 'NOFORN',     rule: 'ALL_OF',    color: '#dc2626' },
      { type: 'needtoknow',    label: 'needtoknow:intel',         fqn: `https://${FED_NS}/attr/needtoknow/value/intel`,     matched: 'INTEL',      rule: 'ALL_OF',    color: '#8b5cf6' },
      { type: 'needtoknow',    label: 'needtoknow:ops',           fqn: `https://${FED_NS}/attr/needtoknow/value/ops`,       matched: 'OPS',        rule: 'ALL_OF',    color: '#8b5cf6' },
    ],
    synonym: { input: 'TOP SECRET', output: 'ts-sci', dict: 'classification-dict' },
    rollup: 'High watermark: TOP SECRET → ts-sci (HIERARCHY). NOFORN triggers caveats:noforn (ALL_OF). NTK INTEL and OPS both become needtoknow ALL_OF — user must have BOTH.',
  },
  {
    id: 'nato-conf',
    label: 'CONFIDENTIAL // REL TO NATO',
    banner: 'CONFIDENTIAL // REL TO NATO',
    body: 'NATO LOGISTICS COORDINATION MEMORANDUM\n\nCONFIDENTIAL // REL TO NATO\n\nLogistics coordination for Exercise Steadfast Defender. Releasable to all NATO member nations. Distribution to non-NATO parties requires prior authorization from NATO HQ.',
    extractedAttrs: [
      { type: 'classification', label: 'clearance:secret',        fqn: `https://${FED_NS}/attr/clearance/value/secret`,     matched: 'CONFIDENTIAL', rule: 'HIERARCHY', color: '#ef4444' },
      { type: 'relto',         label: 'relto:nato',               fqn: `https://${FED_NS}/attr/relto/value/nato`,           matched: 'NATO',         rule: 'ANY_OF',    color: '#3b82f6' },
    ],
    synonym: { input: 'CONFIDENTIAL', output: 'confidential', dict: 'classification-dict' },
    rollup: 'CONFIDENTIAL maps to confidential (HIERARCHY). NATO is a recognized coalition alias — maps to relto:nato (ANY_OF), which covers all 32 member nations via group membership.',
  },
  {
    id: 'ts-fvey-intel',
    label: 'TS-SCI // REL TO FVEY // NTK INTEL',
    banner: 'TS-SCI // REL TO FVEY // NTK INTEL',
    body: 'FIVE EYES SIGINT PRODUCT\n\nTS-SCI // REL TO FVEY // NTK INTEL\n\nJoint SIGINT product derived from allied collection. Releasable only to Five Eyes partners with INTEL compartment clearance. Handle per SCI procedures and FVEY sharing protocols.',
    extractedAttrs: [
      { type: 'classification', label: 'clearance:ts-sci',        fqn: `https://${FED_NS}/attr/clearance/value/ts-sci`,     matched: 'TS-SCI',   rule: 'HIERARCHY', color: '#ef4444' },
      { type: 'relto',         label: 'relto:fvey',               fqn: `https://${FED_NS}/attr/relto/value/fvey`,           matched: 'FVEY',     rule: 'ANY_OF',    color: '#3b82f6' },
      { type: 'needtoknow',    label: 'needtoknow:intel',         fqn: `https://${FED_NS}/attr/needtoknow/value/intel`,     matched: 'INTEL',    rule: 'ALL_OF',    color: '#8b5cf6' },
    ],
    synonym: { input: 'TS-SCI', output: 'ts-sci', dict: 'classification-dict' },
    rollup: 'TS-SCI is a direct match → ts-sci attribute. FVEY resolves to relto:fvey coalition group. NTK INTEL → needtoknow:intel ALL_OF. Three attributes, all must be satisfied.',
  },
  {
    id: 'unclassified-fouo',
    label: 'UNCLASSIFIED // FOR OFFICIAL USE ONLY',
    banner: 'UNCLASSIFIED // FOR OFFICIAL USE ONLY',
    body: 'TRAINING DIRECTIVE — EXERCISE PLANNING\n\nUNCLASSIFIED // FOR OFFICIAL USE ONLY\n\nThis document contains information intended for official use only. It may not be released to the public or foreign nationals without authorization from the originating agency.',
    extractedAttrs: [
      { type: 'classification', label: 'clearance:unclassified',  fqn: `https://${FED_NS}/attr/clearance/value/unclassified`, matched: 'UNCLASSIFIED', rule: 'HIERARCHY', color: '#22c55e' },
    ],
    synonym: { input: 'UNCLASSIFIED', output: 'unclassified', dict: 'classification-dict' },
    rollup: 'UNCLASSIFIED maps to clearance:unclassified. FOUO is not a TDF-standard caveat — no attribute generated. Minimum access restriction applied.',
  },
]

// ─── Obligations Data (for ObligationsPage) ───────────────────────────────────

export const OBLIGATIONS_DATA = {
  definitions: [
    {
      id: 'watermark',
      fqn: 'https://example.com/obl/drm/value/watermark',
      label: 'Apply Watermark',
      desc: 'PEP must render visible watermark before displaying content',
      icon: 'document',
      category: 'drm',
      template: '${username} / ${email} / ${datetime}',
      example: 'alice.chen@corp.com / 2024-03-15 14:22Z',
    },
    {
      id: 'no-download',
      fqn: 'https://example.com/obl/drm/value/no-download',
      label: 'Block Download',
      desc: 'PEP must not allow plaintext to be saved or downloaded',
      icon: 'lock',
      category: 'drm',
    },
    {
      id: 'require-mfa',
      fqn: 'https://example.com/obl/access/value/require-mfa',
      label: 'Require MFA',
      desc: 'PEP must verify second factor before granting access',
      icon: 'shield',
      category: 'access',
    },
    {
      id: 'time-limit',
      fqn: 'https://example.com/obl/access/value/time-limit',
      label: 'Time-Limited Access',
      desc: 'PEP must enforce a session time limit (default: 30 minutes)',
      icon: 'alert',
      category: 'access',
      param: '30m',
    },
  ],
  clearanceLevels: [
    { value: 'top-secret', label: 'TOP SECRET', color: '#ef4444' },
    { value: 'secret',     label: 'SECRET',     color: '#f97316' },
    { value: 'confidential', label: 'CONFIDENTIAL', color: '#eab308' },
    { value: 'unclassified', label: 'UNCLASSIFIED', color: '#22c55e' },
  ],
  sampleDocument: {
    title: 'Q3 Intelligence Assessment',
    classification: 'SECRET',
    preview: 'INTELLIGENCE ASSESSMENT — Q3\n\nSECRET\n\nThis document contains compartmented intelligence relating to adversary capabilities and intentions. Access is restricted to cleared personnel with appropriate need-to-know.',
  },
}

// ─── Pipeline Stages (for PipelinePage) ──────────────────────────────────────

export const PIPELINE_STAGES = [
  {
    id: 'ingest',
    label: 'Raw Files',
    icon: 'folder',
    color: '#6b7280',
    desc: 'Unprotected documents enter the pipeline from file shares, email systems, or data repositories.',
    tech: 'Apache NiFi GetFile / ListenHTTP processor receives raw files. MIME type detected via Apache Tika magic bytes.',
    sample: '{ "filename": "Intel_Briefing.docx", "size": "2.4MB", "mime": "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }',
  },
  {
    id: 'extract',
    label: 'Content Extraction',
    icon: 'search',
    color: '#0ea5e9',
    desc: 'Apache Tika extracts text, metadata, and embedded content. OCR applied to scanned documents and images.',
    tech: 'Tika server (REST API) invoked with document bytes. Returns extracted plaintext, metadata map, and MIME type. OCR via Tesseract for image/PDF content.',
    sample: '{ "Content-Type": "application/vnd.openxmlformats...", "extracted_text": "TOP SECRET // REL TO FVEY // NTK INTEL\\n\\nSection 1...", "metadata": { "Author": "J2 Analyst", "Created": "2024-03-15" } }',
  },
  {
    id: 'tagging',
    label: 'Tagging PDP',
    icon: 'document',
    color: '#8b5cf6',
    desc: 'Tagging PDP applies regex rules to extract classification markings. Synonym dictionaries normalize values.',
    tech: 'classification-banners regex: captures classification level, REL TO countries, and NTK compartments in capture groups. Synonym dict maps "TOP SECRET" → "topsecret", "GBR" → nationality:GBR.',
    sample: '{ "tags": [{ "type": "ATTRIBUTE", "fqn": "example.com/attr/clearance/value/ts-sci" }, { "type": "ATTRIBUTE", "fqn": "example.com/attr/relto/value/fvey" }, { "type": "ATTRIBUTE", "fqn": "example.com/attr/needtoknow/value/intel" }] }',
  },
  {
    id: 'policy',
    label: 'Policy Evaluation',
    icon: 'compliance',
    color: '#f59e0b',
    desc: 'Extracted attributes are resolved against the Platform attribute registry. Rollup rules applied.',
    tech: 'Platform AttributesService validates FQNs against registered definitions. Rollup: HIERARCHY → high watermark, ALL_OF → union, ANY_OF → intersection. Coalition aliases (FVEY, NATO) resolved to group definitions.',
    sample: '{ "policy": { "attributes": ["example.com/attr/clearance/value/ts-sci", "example.com/attr/relto/value/fvey", "example.com/attr/needtoknow/value/intel"], "dissem_scope": "FVEY", "rollup_applied": true } }',
  },
  {
    id: 'encrypt',
    label: 'TDF Encryption',
    icon: 'lock',
    color: '#10b981',
    desc: 'Data Encryption Key (DEK) generated. Payload encrypted with AES-256-GCM. DEK wrapped with KAS public key.',
    tech: 'OpenTDF SDK: createZTDF() generates 256-bit DEK, encrypts payload with AES-256-GCM (random IV). RSA-OAEP wraps DEK with KAS public key. manifest.json assembled with policy, keyAccess, and encryptionInfo.',
    sample: '{ "payload": "0x3f8a...c2b1 [AES-256-GCM encrypted]", "manifest": { "encryptionInformation": { "type": "split", "keyAccess": [{ "type": "wrapped", "url": "https://kas.example.com" }], "method": { "algorithm": "AES-256-GCM" } } } }',
  },
  {
    id: 'store',
    label: 'Secure Storage',
    icon: 'server',
    color: '#6b7280',
    desc: 'Encrypted TDF stored in S3, data lake, or SharePoint. File is opaque — storage system has no access to plaintext.',
    tech: 'NiFi PutS3Object processor writes .tdf file to configured S3 bucket. Object metadata includes Tdf-Data-Attribute-N FQNs for S4 proxy compatibility. Storage system cannot decrypt without KAS credentials.',
    sample: 'PUT s3://classified-data/Intel_Briefing.docx.tdf\nContent-Type: application/zip\nTdf-Data-Attribute-0: example.com/attr/clearance/value/ts-sci\nTdf-Data-Attribute-1: example.com/attr/relto/value/fvey',
  },
]

// ─── Seed Events ──────────────────────────────────────────────────────────────

export function makeSeedEvents(sector) {
  const now = Date.now()
  if (sector === 'federal') {
    const sarah   = { id: 'sarah',    name: 'Maj. Sarah Williams', avatar: '👩‍✈️', color: '#3b82f6', fqns: ['https://demo.com/attr/clearance/value/ts-sci', 'https://demo.com/attr/mission/value/intel', 'https://demo.com/attr/relto/value/fvey'] }
    const james   = { id: 'james',    name: 'CPT. James Rivera',   avatar: '👨‍💼', color: '#f59e0b', fqns: ['https://demo.com/attr/clearance/value/secret', 'https://demo.com/attr/relto/value/fvey'] }
    const patricia= { id: 'patricia', name: 'Col. Patricia Lee',   avatar: '👩‍⚖️', color: '#8b5cf6', fqns: ['https://demo.com/attr/clearance/value/secret', 'https://demo.com/attr/mission/value/legal', 'https://demo.com/attr/relto/value/fvey'] }
    const marcus  = { id: 'marcus',   name: 'CW3 Marcus Johnson',  avatar: '🧑‍💻', color: '#10b981', fqns: ['https://demo.com/attr/clearance/value/secret', 'https://demo.com/attr/mission/value/cyber', 'https://demo.com/attr/relto/value/fvey'] }
    const clarke  = { id: 'fvey-uk',  name: 'Flt Lt Emma Clarke',  avatar: '🇬🇧', color: '#0ea5e9', fqns: ['https://demo.com/attr/clearance/value/secret', 'https://demo.com/attr/relto/value/fvey'] }
    const dubois  = { id: 'nato-fr',  name: 'Maj. Henri Dubois',   avatar: '🇫🇷', color: '#f97316', fqns: ['https://demo.com/attr/clearance/value/secret', 'https://demo.com/attr/relto/value/nato'] }
    const richter = { id: 'nato-de',  name: 'Maj. Klaus Richter',  avatar: '🇩🇪', color: '#a3a3a3', fqns: ['https://demo.com/attr/clearance/value/secret', 'https://demo.com/attr/relto/value/nato'] }
    return [
      { id: 1,  ts: new Date(now - 9000000).toISOString(), type: 'access', persona: sarah,    document: 'Intel Briefing Q3 — NOFORN',         result: 'granted', reason: 'All required attributes satisfied' },
      { id: 2,  ts: new Date(now - 8200000).toISOString(), type: 'access', persona: clarke,   document: 'FVEY Intelligence Summary',           result: 'granted', reason: 'clearance:secret + relto:fvey satisfied' },
      { id: 3,  ts: new Date(now - 7500000).toISOString(), type: 'access', persona: dubois,   document: 'FVEY Intelligence Summary',           result: 'denied',  reason: 'Missing: relto:fvey (FRA is NATO, not FVEY)' },
      { id: 4,  ts: new Date(now - 6800000).toISOString(), type: 'access', persona: dubois,   document: 'NATO Cyber Defense Brief',            result: 'granted', reason: 'clearance:secret + relto:nato satisfied' },
      { id: 5,  ts: new Date(now - 6000000).toISOString(), type: 'access', persona: richter,  document: 'NATO Cyber Defense Brief',            result: 'granted', reason: 'clearance:secret + relto:nato satisfied' },
      { id: 6,  ts: new Date(now - 5200000).toISOString(), type: 'access', persona: james,    document: 'Intel Briefing Q3 — NOFORN',         result: 'denied',  reason: 'Missing: ts-sci, intel' },
      { id: 7,  ts: new Date(now - 4400000).toISOString(), type: 'access', persona: patricia, document: 'UCMJ Article 32 Investigation',       result: 'granted', reason: 'All required attributes satisfied' },
      { id: 8,  ts: new Date(now - 3600000).toISOString(), type: 'revoke', persona: marcus,   document: 'Cyber Incident Report G6',            result: 'revoked', reason: 'Attribute clearance:secret removed by admin' },
      { id: 9,  ts: new Date(now - 2700000).toISOString(), type: 'access', persona: marcus,   document: 'Cyber Incident Report G6',            result: 'denied',  reason: 'Missing: secret' },
      { id: 10, ts: new Date(now - 1800000).toISOString(), type: 'access', persona: sarah,    document: 'OPORD Operation Meridian',            result: 'granted', reason: 'No attribute restriction on file' },
      { id: 11, ts: new Date(now - 900000).toISOString(),  type: 'access', persona: james,    document: 'Contractor PWS — SOCOM',              result: 'granted', reason: 'All required attributes satisfied' },
      { id: 12, ts: new Date(now - 300000).toISOString(),  type: 'access', persona: clarke,   document: 'Intel Briefing Q3 — NOFORN',         result: 'denied',  reason: 'Missing: caveats:noforn (foreign national)' },
    ]
  }
  // commercial
  const alice = { id: 'alice', name: 'Alice Chen',    avatar: '👩‍💼', color: '#3b82f6' }
  const bob   = { id: 'bob',   name: 'Bob Martinez',  avatar: '👨‍💻', color: '#f59e0b' }
  const carol = { id: 'carol', name: 'Carol Singh',   avatar: '👩‍⚖️', color: '#8b5cf6' }
  const dave  = { id: 'dave',  name: 'Dave Kim',      avatar: '🧑‍🔧', color: '#10b981' }
  return [
    { id: 1, ts: new Date(now - 7200000).toISOString(), type: 'access', persona: alice, document: 'Q3 Financial Threat Assessment',       result: 'granted', reason: 'All required attributes satisfied' },
    { id: 2, ts: new Date(now - 6500000).toISOString(), type: 'access', persona: bob,   document: 'Q3 Financial Threat Assessment',       result: 'denied',  reason: 'Missing: top-secret, finance' },
    { id: 3, ts: new Date(now - 5800000).toISOString(), type: 'access', persona: carol, document: 'Meridian Corp Acquisition NDA',        result: 'granted', reason: 'All required attributes satisfied' },
    { id: 4, ts: new Date(now - 4900000).toISOString(), type: 'revoke', persona: dave,  document: 'Infrastructure Security Audit',        result: 'revoked', reason: 'Attribute clearance:secret removed by admin' },
    { id: 5, ts: new Date(now - 3600000).toISOString(), type: 'access', persona: dave,  document: 'Infrastructure Security Audit',        result: 'denied',  reason: 'Missing: secret' },
    { id: 6, ts: new Date(now - 2700000).toISOString(), type: 'access', persona: alice, document: 'Patent Filing Draft',                  result: 'granted', reason: 'No attribute restriction on file' },
    { id: 7, ts: new Date(now - 1800000).toISOString(), type: 'access', persona: bob,   document: 'Atlas Contractor SOW',                 result: 'granted', reason: 'All required attributes satisfied' },
    { id: 8, ts: new Date(now - 900000).toISOString(),  type: 'revoke', persona: carol, document: 'Meridian Corp Acquisition NDA',        result: 'revoked', reason: 'Document policy updated — access suspended' },
    { id: 9, ts: new Date(now - 300000).toISOString(),  type: 'access', persona: carol, document: 'Meridian Corp Acquisition NDA',        result: 'denied',  reason: 'Policy suspended — access revoked' },
  ]
}

// ── Demo talking points (one per page, for TalkingPoint component) ──────────
export const DEMO_TALKING_POINTS = {
  architecture: "The key never leaves KAS, and KAS checks entitlements live on every single decrypt — there's no cached access anywhere in this system.",
  keywrap:      "The encryption key is never stored anywhere — not in the database, not in memory at rest, not on disk. Zero knowledge is architectural, not aspirational.",
  revocation:   "Watch what happens when I revoke Sarah's clearance right now — the file is sitting right there on her machine, and she still can't open it.",
  tagging:      "Your analysts are tagging based on memory and habit. The pipeline reads the actual document content and applies the policy objectively, every time.",
  encrypt:      "Select a file, encrypt it, then try to open it as someone without the clearance. The file doesn't change — only the KAS decision changes.",
  policy:       "This is exactly what KAS evaluates on every single decrypt attempt — these attributes, against this user's live token. No caching, no grace period.",
  audit:        "Every access attempt, granted or denied, is cryptographically logged. You can hand this to an auditor today — it's already CMMC and FedRAMP format.",
  platform:     "These aren't mock responses — we're hitting your actual KAS right now and it's returning the live public key it uses to protect your data.",
}

// ── Compliance frameworks (for AuditPage) ────────────────────────────────────
export const FEDERAL_COMPLIANCE_FRAMEWORKS = [
  { id: 'cmmc',    label: 'CMMC 2.0',   level: 'Level 3', color: '#3b82f6', detail: 'AU.3.045 — audit records for unauthorized access attempts' },
  { id: 'fedramp', label: 'FedRAMP',    level: 'High',    color: '#8b5cf6', detail: 'AU-2, AU-9 — protection of audit information' },
  { id: 'nist',    label: 'NIST 800-53',level: 'Rev 5',   color: '#0ea5e9', detail: 'AU-3 — content of audit records' },
  { id: 'stig',    label: 'DoD STIG',   level: 'CAT I',   color: '#f59e0b', detail: 'Tamper-evident audit logging required' },
]

// ── Quick policy scenarios (for PolicyPage) ───────────────────────────────────
export const FEDERAL_QUICK_SCENARIOS = [
  { label: 'SIGINT analyst access',   attrs: ['ts-sci', 'intel'],   personaId: 'sarah',    outcome: 'granted' },
  { label: 'Contractor blocked',       attrs: ['ts-sci', 'intel'],   personaId: 'james',    outcome: 'denied'  },
  { label: 'FVEY coalition share',     attrs: ['secret', 'fvey'],    personaId: 'fvey-uk',  outcome: 'granted' },
  { label: 'NATO-only (FRA blocked)',  attrs: ['secret', 'fvey'],    personaId: 'nato-fr',  outcome: 'denied'  },
  { label: 'Legal hold access',        attrs: ['secret', 'legal'],   personaId: 'patricia', outcome: 'granted' },
  { label: 'Cyber ops only',           attrs: ['secret', 'cyber'],   personaId: 'marcus',   outcome: 'granted' },
]
