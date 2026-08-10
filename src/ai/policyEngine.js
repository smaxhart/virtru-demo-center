/**
 * Policy engine for the AI Protection chat demo.
 *
 * Each TOPIC maps natural-language query patterns to a set of required
 * FQN attributes. Before the LLM is invoked, we classify the query and
 * check whether the active persona holds all required attributes.
 *
 * This mirrors how a real data-layer enforcement point works:
 *   1. Classify the query to determine what data it touches
 *   2. Check entitlements against the policy on that data
 *   3. Block or allow at the retrieval layer — never trust the model to self-censor
 */

const NS = 'https://demo.com/attr'

// Clearance hierarchy expansion (mirrors copSourceTypes.js)
function expandAttrs(attrs) {
  const s = new Set(attrs)
  if (s.has('clearance:ts-sci'))   { s.add('clearance:secret'); s.add('clearance:cui'); s.add('clearance:unclassified') }
  if (s.has('clearance:secret'))   { s.add('clearance:cui'); s.add('clearance:unclassified') }
  if (s.has('clearance:cui'))      s.add('clearance:unclassified')
  return s
}

/**
 * Topic definitions.
 * Each topic has:
 *   - keywords:     terms that trigger topic classification (lowercased match)
 *   - requiredFqns: attributes the persona must hold to access this topic
 *   - label:        display name
 *   - classification: banner string
 *   - corpus:       the "document" the LLM should draw from when answering
 */
export const TOPICS = [
  {
    id: 'sigint',
    label: 'SIGINT Collection Summary',
    classification: 'TOP SECRET // SCI // NOFORN',
    keywords: ['sigint', 'signal', 'signals intelligence', 'collection summary', 'intercept', 'nsanet', 'nsa'],
    requiredFqns: [
      `${NS}/clearance/value/ts-sci`,
      `${NS}/mission/value/intel`,
    ],
    corpus: `
SIGINT COLLECTION SUMMARY — TOP SECRET // SCI // NOFORN
Reporting period: 72-hour window, Eastern Seaboard tasking

Collection assets: 3 active SIGINT platforms on coastal corridors.
COLLECTION-ALPHA: 14 intercepts flagged for further processing. HUMINT corroboration pending.
COLLECTION-BRAVO: Encrypted comms detected on non-standard frequencies near target area. NSA forwarded to analyst pool.
TARGET-7 communications: 3 intercepts show elevated operational tempo. Assessment: pre-operational posturing, 60% confidence.
FVEY partner product CANOPUS-9 shared under UKUSA exchange. Corroborates TARGET-7 assessment independently.
Access restriction: SCI compartment, no foreign nationals.
    `.trim(),
  },
  {
    id: 'threat-briefing',
    label: 'Threat Briefing (Q3)',
    classification: 'TOP SECRET // SCI',
    keywords: ['threat briefing', 'threat assessment', 'q3 threat', 'quarterly threat', 'threat brief'],
    requiredFqns: [
      `${NS}/clearance/value/ts-sci`,
    ],
    corpus: `
Q3 THREAT BRIEFING — TOP SECRET // SCI
Prepared for: JTTF / Senior Leadership

Executive Summary: Three principal threat vectors assessed for the Q3 period.
1. VECTOR ALPHA — Domestic: Elevated chatter on encrypted platforms consistent with infrastructure targeting. FBI/DHS joint monitoring active.
2. VECTOR BRAVO — External State Actor: Attribution assessed at 75% confidence to ACTOR-X. DHS coordinating with NSA and Five Eyes partners.
3. VECTOR CHARLIE — Cyber: Two zero-day exploits circulating in underground markets. CISA emergency directive issued.
Key judgment: Overall threat level elevated compared to Q2. No specific attack timeline assessed at this time.
    `.trim(),
  },
  {
    id: 'fvey',
    label: 'FVEY Intel Exchange',
    classification: 'SECRET // REL TO FVEY',
    keywords: ['fvey', 'five eyes', 'fiveeyes', 'five-eyes', 'ukusa', 'allied intel', 'partner intel', 'uk share', 'canada share', 'aus share', 'nz share'],
    requiredFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/relto/value/fvey`,
    ],
    corpus: `
FVEY INTEL EXCHANGE — SECRET // REL TO FVEY
Joint product: USA-GBR-CAN-AUS-NZL

Shared assessment: Maritime surveillance in Eastern Seaboard corridor shows pattern consistent with pre-operational reconnaissance.
GBR contribution (GCHQ): Two signals intercepts matching TARGET-7 signature from 72-hour window.
CAN contribution (CSE): Corroborating metadata from SIGINT platform. Details withheld pending full analysis.
AUS contribution (ASD): No direct corroboration; standing watch on Pacific corridor.
NZL contribution (GCSB): No current product.
Consensus assessment: Credible. Recommend elevated DEFCON monitoring.
Distribution: FVEY principals only. No NATO release without separate authority.
    `.trim(),
  },
  {
    id: 'nato',
    label: 'NATO Joint Ops Plan',
    classification: 'SECRET // REL TO NATO',
    keywords: ['nato', 'joint ops', 'joint operations', 'article 5', 'alliance ops', 'nato plan', 'nato forces'],
    requiredFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/relto/value/nato`,
    ],
    corpus: `
NATO JOINT OPS PLAN — SECRET // REL TO NATO
Operation COASTAL SHIELD — Phase II Annex

Allied force posture: 4 NATO member states contributing maritime and air assets for Phase II.
Phase II objectives: (1) ISR coverage of Atlantic corridor (2) Interoperability exercise with US COCOM (3) Establish shared COP access for contributing partners.
Key dates: D+0 = first allied asset on station. D+14 = Phase II conclusion and after-action review.
Command: NATO STRIKFORNATO retains operational authority. US COCOM in supporting role.
Logistics: Fuel and ordnance resupply from Norfolk NAS and Rota, Spain.
Release authority: NATO SECRET. No FVEY-only product incorporated; separate annex required.
    `.trim(),
  },
  {
    id: 'legal',
    label: 'UCMJ Art. 32 Investigation',
    classification: 'SECRET // LEGAL',
    keywords: ['ucmj', 'article 32', 'investigation', 'legal', 'court martial', 'military justice', 'proceedings'],
    requiredFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/mission/value/legal`,
    ],
    corpus: `
UCMJ ART. 32 INVESTIGATION — SECRET
Case file: CASE-2026-0047 — Unauthorized Disclosure Investigation

Investigating Officer: LTC Williams, JAG Corps
Subject: SSgt. R. Morales, USAF (rank withheld pending investigation)
Allegation: Willful disclosure of SECRET information to a person not authorized to receive it.
Evidence summary: Three encrypted attachments forwarded to external email address. KAS audit log confirms attribute mismatch — forwarding account lacked requisite entitlements.
Status: Pre-referral hearing scheduled. Defense counsel assigned.
Disposition recommendation: Pending IO report. Referral to General Court-Martial under consideration.
Distribution: Legal counsel, Investigating Officer, Convening Authority. No further distribution.
    `.trim(),
  },
  {
    id: 'cyber',
    label: 'Infrastructure Security Audit',
    classification: 'SECRET // CYBER',
    keywords: ['cyber', 'security audit', 'infra', 'infrastructure', 'vulnerability', 'cve', 'patch', 'firewall', 'network security', 'zero day'],
    requiredFqns: [
      `${NS}/clearance/value/secret`,
      `${NS}/mission/value/cyber`,
    ],
    corpus: `
INFRASTRUCTURE SECURITY AUDIT — SECRET
Audit period: Q2–Q3, Eastern Seaboard network infrastructure

Scope: 14 classified network segments reviewed across 3 command nodes.
Critical findings (4):
  CVE-2026-1147: Unpatched SCADA interface on node ECHO-3. CISA directive overdue.
  CVE-2026-0892: Default credentials found on 2 edge routers. Remediated day-of.
  Finding-3: Lateral movement vector identified between SECRET and CUI segments. Firewall rule gap. Remediation in progress.
  Finding-4: KAS audit logging disabled on 1 of 14 segments — compliance gap, not an active exploit.
Recommended actions: Emergency patch cadence, segment re-certification before D+30.
Classification: SECRET. Distribution: Cyber command, IG office, relevant COs.
    `.trim(),
  },
  {
    id: 'patient',
    label: 'Patient / PHI Record',
    classification: 'LIMITED // USA',
    keywords: ['patient', 'phi', 'medical', 'hipaa', 'health record', 'treatment', 'casualty', 'mci', 'triage', 'jane doe'],
    requiredFqns: [
      `${NS}/relto/value/usa`,
    ],
    corpus: `
PATIENT RECORD — LIMITED // USA ONLY
MCI Case #047 — Johns Hopkins R1 Trauma Center

Patient: Jane Doe #MCI-047 (identity withheld per HIPAA)
DOB: 1984-03-15
Condition on admission: Serious — blunt force trauma, possible spinal involvement
Treating unit: MED-12 / Johns Hopkins R1 Trauma
Current status: Stable — ICU observation, CT imaging complete
Treatment notes: Surgery completed. Patient remains in ICU. Next of kin notified via FEMA emergency contact protocol.
Data handling: PHI. No foreign national release. USA-cleared personnel only.
    `.trim(),
  },
]

// Topics accessible to all personnel (no special attributes required)
const OPEN_CORPUS = `
You are an AI assistant integrated into the Virtru Data Security Platform demo environment.
You have access to a classified document corpus. What you can share depends entirely on the user's entitlements —
the policy layer enforces this before you receive any query.

For general questions about Virtru, TDF, KAS (Key Access Server), attribute-based access control, or how the DSP works:
- Virtru DSP uses TDF (Trusted Data Format) — AES-256-GCM encryption with policy bound inside the file
- Every decrypt requires a live KAS check — the key is never stored client-side
- Entitlements = attribute values in the IdP (Keycloak) — KAS checks these on every request
- Policy is enforced at the data layer, not the application layer — the app cannot override it
- Subject mappings connect IdP users to policy attribute values

If asked about anything outside your corpus, say you don't have that information.
`.trim()

/**
 * Classify a free-text query into the best matching topic.
 * Returns the first matching topic, or null if the query is general.
 */
export function classifyQuery(text) {
  const lower = text.toLowerCase()
  for (const topic of TOPICS) {
    if (topic.keywords.some(kw => lower.includes(kw))) {
      return topic
    }
  }
  return null
}

/**
 * Check whether a persona can access a topic.
 * Returns { allowed: bool, missing: string[] }
 */
export function checkAccess(topic, persona) {
  if (!topic) return { allowed: true, missing: [] }
  const expanded = expandAttrs(persona.attributes ?? [])
  const missing = topic.requiredFqns.filter(fqn => {
    const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
    const short = m ? `${m[1]}:${m[2]}` : fqn
    return !expanded.has(short)
  })
  return { allowed: missing.length === 0, missing }
}

/**
 * Build the system prompt for an allowed query.
 * Includes the corpus for the matched topic (if any) plus general DSP context.
 */
export function buildSystemPrompt(topic, persona) {
  const personaCtx = `
The user you are responding to is ${persona.name}, ${persona.title}.
Their current entitlements: ${persona.attributes.length > 0 ? persona.attributes.join(', ') : 'none — uncleared user'}.
`.trim()

  if (!topic) {
    return `${OPEN_CORPUS}\n\n${personaCtx}\n\nAnswer concisely. Do not fabricate classified information. If the question touches a classified topic you have not been given, say access is controlled by policy.`
  }

  return `
You are an AI assistant in a classified environment. You have been provided the following document to answer questions from.
Only answer based on the contents of this document — do not fabricate details.

DOCUMENT: ${topic.label}
CLASSIFICATION: ${topic.classification}

---
${topic.corpus}
---

${personaCtx}

Answer the user's question based strictly on the document above. Be concise. Do not repeat the classification banner in your answer. If the question asks for something not in the document, say it is not in your current context.
`.trim()
}
