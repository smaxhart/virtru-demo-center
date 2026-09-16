/**
 * Department of War — clearances, mission compartments, coalition release.
 *
 * The original demo scenario. Its job is to show the three composition rules in the
 * cleanest possible form: a hierarchy (clearance), a compartment (mission), and a
 * release caveat that has nothing to do with either (coi).
 */

import { clearance, mission, needtoknow, coi } from './vocab.js'

const personas = [
  {
    id: 'dow-sarah',
    name: 'Maj. Sarah Williams',
    title: 'Intelligence Analyst, J2',
    icon: 'intel',
    color: '#3b82f6',
    note: 'Holds the highest clearance in the set — and is still refused the legal case file. Clearance is not need-to-know.',
  },
  {
    id: 'dow-patricia',
    name: 'Col. Patricia Lee',
    title: 'Staff Judge Advocate, JAG',
    icon: 'legal',
    color: '#8b5cf6',
    note: 'The only persona who can open the full patient record, including PII.',
  },
  {
    id: 'dow-marcus',
    name: 'CW3 Marcus Johnson',
    title: 'Cyberspace Operations, G6',
    icon: 'cyber',
    color: '#10b981',
    note: 'SECRET cyber operator — cleared for the audit, blocked from SCI and legal. He also holds role:admin, and no document policy asks about it.',
  },
  {
    id: 'dow-james',
    name: 'CPT. James Rivera',
    title: 'Cleared Contractor, SOCOM',
    icon: 'contractor',
    color: '#f59e0b',
    note: 'Cleared but external — the narrowest US persona in the set.',
  },
  {
    id: 'dow-emma',
    name: 'Flt Lt Emma Clarke',
    title: 'UK Intelligence Liaison',
    icon: 'liaison',
    badge: 'GB',
    color: '#0ea5e9',
    note: 'Holds coi:fvey, so the Five Eyes product is releasable to a non-US national.',
  },
  {
    id: 'dow-henri',
    name: 'Maj. Henri Dubois',
    title: 'French Liaison Officer',
    icon: 'liaison',
    badge: 'FR',
    color: '#6366f1',
    note: 'Holds coi:nato but not coi:fvey. Same clearance as Emma, different release community — this is the pair to demo.',
  },
  {
    id: 'dow-klaus',
    name: 'Maj. Klaus Richter',
    title: 'German Liaison Officer',
    icon: 'liaison',
    badge: 'DE',
    color: '#84cc16',
    note: 'Same posture as the French liaison — NATO release only.',
  },
  {
    id: 'dow-none',
    name: 'Uncleared User',
    title: 'No entitlements',
    icon: 'anonymous',
    color: '#6b7280',
    note: 'Authenticates successfully and still gets nothing — authentication is not authorization.',
  },
]

/**
 * The assistants, and what each one is trusted with.
 *
 * Grants live in `electron/identities.js`; this is the display half. Reaches are stated in the
 * notes because the whole feature is only legible if you can see the ceiling before you hit it.
 */
const agents = [
  {
    id: 'dow-agent-general',
    name: 'General Assistant',
    title: 'CUI · ops need-to-know',
    icon: 'agent',
    color: '#6b7280',
    note: 'Reaches one thing: the status tier of the casualty report. Ask it about anything classified and the refusal is the agent, not you.',
  },
  {
    id: 'dow-agent-intel',
    name: 'J2 Intel Agent',
    title: 'SECRET · mission:intel',
    icon: 'agent',
    color: '#3b82f6',
    note: 'The pairing to demo. Maj. Williams holds TS-SCI and this agent holds SECRET, so the Q3 threat briefing is withheld from a fully cleared analyst — because her assistant is not cleared for it.',
  },
  {
    id: 'dow-agent-command',
    name: 'Command Agent',
    title: 'TS-SCI · intel, ops, cyber',
    icon: 'agent',
    color: '#f59e0b',
    note: 'Broad enough to unblock the intel refusals — switch here after one to prove the agent was the only obstacle. It still holds no legal authority, so the JAG file and the full medical record are out of reach of every agent in this scenario, no matter who is asking.',
  },
]

const documents = [
  {
    id: 'sigint',
    label: 'SIGINT Collection Summary',
    classification: 'TOP SECRET // SCI // NOFORN',
    keywords: ['sigint', 'signal', 'signals intelligence', 'collection summary', 'intercept', 'nsanet', 'nsa'],
    policy: [clearance('ts-sci'), mission('intel')],
    policyNote: 'TS-SCI clearance AND the intel mission. The narrowest document in the set.',
    text: `
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
    label: 'Q3 Threat Briefing',
    classification: 'TOP SECRET // SCI',
    keywords: ['threat briefing', 'threat assessment', 'q3 threat', 'quarterly threat', 'threat brief'],
    policy: [clearance('ts-sci')],
    policyNote: 'TS-SCI clearance only — no mission compartment, so any TS-SCI holder qualifies.',
    text: `
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
    keywords: ['fvey', 'five eyes', 'fiveeyes', 'five-eyes', 'ukusa', 'allied intel', 'partner intel'],
    policy: [clearance('secret'), coi('fvey')],
    policyNote: 'SECRET AND the FVEY release caveat. The French and German liaisons hold SECRET and are still refused — the caveat is the whole decision.',
    text: `
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
    keywords: ['nato', 'joint ops', 'joint operations', 'article 5', 'alliance ops', 'coastal shield'],
    policy: [clearance('secret'), coi('nato')],
    policyNote: 'SECRET AND the NATO release caveat — a wider community than FVEY, so the French and German liaisons are in.',
    text: `
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
    policy: [clearance('secret'), mission('legal')],
    policyNote: 'SECRET AND the legal mission. Clearance alone is not enough — this is need-to-know, not rank.',
    text: `
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
    keywords: ['cyber', 'security audit', 'infra', 'infrastructure', 'vulnerability', 'cve', 'patch', 'firewall', 'zero day'],
    policy: [clearance('secret'), mission('cyber')],
    policyNote: 'SECRET AND the cyber mission — the same shape as the legal file, a different compartment.',
    text: `
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
    // Two separately encrypted TDFs over the same underlying event. Tiers are tried
    // top-down and the first successful rewrap wins, so a persona is served the most
    // complete version their attributes actually earn — redaction by policy, not by
    // asking the model to please leave the names out.
    id: 'patient',
    label: 'Patient / PHI Record',
    classification: 'UNCLASSIFIED // FOUO',
    keywords: ['patient', 'phi', 'medical', 'hipaa', 'health record', 'treatment', 'casualty', 'mci', 'triage', 'jane doe'],
    tiers: [
      {
        id: 'full',
        label: 'Full Record (PII + Treatment)',
        classification: 'FOUO // LEGAL EYES ONLY',
        policy: [mission('legal')],
        policyNote: 'The legal mission. Names, SSN, and treatment detail live only in this tier.',
        text: `
PATIENT RECORD — FOUO // LEGAL EYES ONLY
MCI Case #047 — Johns Hopkins R1 Trauma Center

Patient: Jane Doe — REAL NAME: Cpl. Maria Santos, 2nd Battalion 5th Marines
DOB: 1989-07-22  SSN (last 4): 4471  DoD ID: 1234567890
Condition on admission: Critical — penetrating abdominal trauma, hemorrhagic shock
Treating unit: MED-12 / Johns Hopkins R1 Trauma Center (Level I)
Current status: Stable post-op — ICU, ventilator weaned, prognosis guarded
Treatment notes: Emergency laparotomy performed. Splenectomy completed. Two units PRBCs administered.
Legal notes: JAG hold active. Patient is subject of UCMJ Article 32 investigation (Case 2026-0047).
  Next of kin notified. Power of attorney on file. Medical records subject to litigation hold.
Data handling: Full PII — HIPAA restricted. Legal personnel and treating physicians only.
        `.trim(),
      },
      {
        id: 'status',
        label: 'Status Only (No PII)',
        classification: 'FOUO // NEED TO KNOW',
        policy: [needtoknow('intel'), needtoknow('ops')],
        policyNote: 'Need-to-know of intel or ops (ANY_OF). Operationally useful, medically silent, no identity.',
        text: `
CASUALTY STATUS REPORT — FOUO // NTK INTEL/OPS
MCI Case #047 — Redacted per HIPAA

Identity: WITHHELD — contact JAG or Medical Officer for PII access
Unit: 2nd Bn, 5th Marines (unit identity confirmed, name withheld)
Condition on admission: Critical — penetrating trauma
Current status: Stable post-op — ICU observation
Operational impact: Subject is non-deployable. Unit has been notified through chain of command.
Prognosis: Guarded. Follow-on disposition pending physician clearance.
Note: Full record including PII and treatment details requires the legal mission.
        `.trim(),
      },
    ],
  },
]

const prompts = [
  { label: 'SIGINT intercepts',    text: 'What intercepts are flagged in the SIGINT collection summary?' },
  { label: 'Q3 threat vectors',    text: 'Give me the Q3 threat briefing highlights.' },
  { label: 'FVEY assessment',      text: 'What did the FVEY partners contribute to the joint maritime assessment?' },
  { label: 'NATO COASTAL SHIELD',  text: 'What is the NATO joint ops plan for Operation COASTAL SHIELD?' },
  { label: 'Article 32 case',      text: 'What are the details of the UCMJ Article 32 investigation?' },
  { label: 'Cyber audit findings', text: 'What does the infrastructure security audit show?' },
  { label: 'Patient Jane Doe',     text: 'What is the status of patient Jane Doe from MCI case 47?' },
  { label: 'How does KAS work?',   text: 'How does the KAS enforce policy on every decrypt?' },
]

export default {
  id: 'dow',
  name: 'Department of War',
  short: 'DoW',
  tagline: 'Clearances, mission compartments, coalition release',
  icon: 'medal',
  accent: '#3b82f6',
  premise: `A joint staff sharing intelligence, legal, and cyber product across US components and coalition partners. Classification sets the floor; mission compartments and release caveats do the actual work.`,
  teaches: [
    {
      title: 'Clearance is not need-to-know',
      detail: 'The TS-SCI intel analyst is refused the SECRET legal file. A hierarchy admits you to a level; a compartment decides whether that level is relevant.',
    },
    {
      title: 'Release caveats are markings, not rosters',
      detail: 'The French and German liaisons hold the same SECRET as the UK liaison and are still refused the Five Eyes product, because REL TO FVEY is a marking they do not carry.',
    },
    {
      title: 'An admin role is not an entitlement',
      detail: 'The cyber operator carries role:admin. No document policy names the role attribute, so it opens nothing — being privileged in an application says nothing about the data layer.',
    },
    {
      title: 'The agent is entitled too, and it is the ceiling',
      detail: 'Retrieval asks the KAS twice — once as you, once as the assistant acting for you — and releases only when both are granted. The TS-SCI analyst is refused the Q3 threat briefing while the J2 agent is selected, because the agent holds SECRET. An over-granted agent is a real hole, not a cosmetic one.',
    },
  ],
  vocabulary: [
    { name: 'clearance',  rule: 'HIERARCHY', detail: 'ts-sci › secret › cui › unclassified. Tagging a document SECRET admits TS-SCI holders without listing them.' },
    { name: 'mission',    rule: 'ANY_OF',    detail: 'intel, ops, legal, cyber, external — the functional compartment.' },
    { name: 'needtoknow', rule: 'ANY_OF',    detail: 'A community that cuts across missions. The status-only casualty report is scoped to intel or ops.' },
    { name: 'coi',        rule: 'ANY_OF',    detail: 'fvey, nato — the release caveat, held or not held.' },
  ],
  defaultPersonaId: 'dow-sarah',
  // The mission-scoped agent by default: it is the one that produces a refusal a fully cleared
  // analyst would not expect, which is the point of the feature.
  defaultAgentId: 'dow-agent-intel',
  personas,
  agents,
  documents,
  prompts,
}
