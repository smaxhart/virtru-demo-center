/**
 * Law Enforcement / Emergency Response — CJIS, case scoping, and mutual aid.
 *
 * The only mode where the interesting decisions run *sideways* rather than up. Two detectives
 * of identical rank, in the same agency, with the same certification, are separated by which
 * case they are assigned to. And unlike the other three scenarios, half the point here is
 * policy *enabling* disclosure: a multi-agency incident needs the fire chief and the medic to
 * receive things fast, and the same attribute that opens the situation report to them keeps
 * the criminal history closed.
 */

import { cjis, caseaccess, jurisdiction, discipline } from './vocab.js'

const personas = [
  {
    id: 'le-nina',
    name: 'Det. Nina Cortez',
    title: 'Homicide, Baltimore PD — Case 0047',
    icon: 'detective',
    color: '#3b82f6',
    note: 'Sworn, CJIS-certified, assigned to case 0047. The only persona who reaches that case file and its informant list — switch to Det. Whitfield to watch identical rank and certification get refused.',
  },
  {
    id: 'le-ray',
    name: 'Det. Ray Whitfield',
    title: 'Robbery, Baltimore PD — Case 0112',
    icon: 'detective',
    color: '#f59e0b',
    note: 'The control for Nina. Same agency, same certification, same sworn status — assigned to 0112 instead of 0047, and refused her case file entirely. That single attribute is the whole difference.',
  },
  {
    id: 'le-sam',
    name: 'Sam Ostrowski',
    title: 'Crime Analyst (civilian), MD State',
    icon: 'analyst',
    color: '#8b5cf6',
    note: 'CJIS-certified and not sworn. Certification alone does not open criminal history — the policy asks for both.',
  },
  {
    id: 'le-jo',
    name: 'Jo Amari',
    title: 'Paramedic, City EMS',
    icon: 'medic',
    color: '#10b981',
    note: 'Holds the EMS discipline and mutual aid. Gets the full patient handoff including allergies and meds, and cannot pull a rap sheet on the patient.',
  },
  {
    id: 'le-hank',
    name: 'BC Hank Molina',
    title: 'Battalion Chief, Fire / Incident Command',
    icon: 'fire',
    color: '#ef4444',
    note: 'Running the incident. Gets triage counts and dispositions, not patient identities — command needs the numbers, not the names.',
  },
  {
    id: 'le-dee',
    name: 'Dee Kwan',
    title: 'Assistant Public Defender',
    icon: 'legal',
    color: '#6b7280',
    note: 'Reaches the public alert and nothing else. Due-process access is a grant somebody has to make deliberately, not a side effect of being in the system.',
  },
]

/**
 * The assistants. Grants live in `electron/identities.js`; this is the display half.
 *
 * The split here runs along discipline rather than seniority: the case agent outranks the EMS
 * agent everywhere except patient PHI, which it cannot touch at all.
 */
const agents = [
  {
    id: 'le-agent-dispatch',
    name: 'Dispatch Assistant',
    title: 'dispatch · mutual-aid',
    icon: 'agent',
    color: '#6b7280',
    note: 'The alert, the situation report, and the command summary. Everything with a case number or a patient name on it is closed to it.',
  },
  {
    id: 'le-agent-ems',
    name: 'EMS Field Agent',
    title: 'discipline:ems · mutual-aid',
    icon: 'agent',
    color: '#10b981',
    note: 'The only agent that opens the identified clinical record, and it opens no restricted law enforcement material at all — no rap sheet, no case file, no informant. Discipline, not rank.',
  },
  {
    id: 'le-agent-case',
    name: 'Case 0047 Agent',
    title: 'CJIS · sworn · case 2026-0047',
    icon: 'agent',
    color: '#f59e0b',
    note: 'Everything on case 0047, including the informant file — and refused the clinical record. Pair it with Det. Whitfield on case 0112 and the case number becomes the whole decision.',
  },
]

const documents = [
  {
    id: 'bolo',
    label: 'BOLO / Public Alert',
    classification: 'PUBLIC — UNRESTRICTED',
    keywords: ['bolo', 'be on the lookout', 'public alert', 'wanted', 'lookout', 'alert bulletin', 'press release'],
    // Empty policy on purpose. A BOLO that partners cannot open is a BOLO that failed.
    policy: [],
    policyNote: 'No attributes. A lookout that a partner agency cannot open has failed at its job, so this one is readable by every caller.',
    text: `
BOLO — PUBLIC ALERT · UNRESTRICTED DISTRIBUTION
Issued this date · Baltimore PD Central District

Vehicle of interest: Silver 2019 sedan, four-door, Maryland tag partial 4J·7. Damage to the
  right rear quarter panel. Last seen eastbound on Monument St.
Occupants: Two, described only as adults. No further description available for release.
Connection: Sought in connection with an ongoing investigation. No charges have been filed and
  no person named in this bulletin is a suspect.
Action requested: Do not approach. Report sightings to Central District dispatch or 911.
Distribution: Unrestricted. Cleared for release to partner agencies, media, and the public.
    `.trim(),
  },
  {
    id: 'chri',
    label: 'Criminal History Record (CHRI)',
    classification: 'CJIS RESTRICTED // 28 CFR 20',
    keywords: ['criminal history', 'chri', 'rap sheet', 'record check', 'ncic', 'cjis', 'prior arrests', 'convictions'],
    policy: [cjis('certified'), discipline('sworn')],
    policyNote: 'CJIS certification AND sworn status. The civilian analyst is certified and still refused; the medic on scene is neither.',
    text: `
CRIMINAL HISTORY RECORD INFORMATION — CJIS RESTRICTED
Subject: MARLOWE, D. · SID MD-4471902 · Query logged and attributable

Arrest cycles: 4 (spanning 11 years).
  Cycle 1 — Theft under, disposition: PBJ, probation completed.
  Cycle 2 — CDS possession, disposition: nolle prosequi.
  Cycle 3 — Assault second degree, disposition: guilty, 18 months suspended.
  Cycle 4 — Open. Charged, awaiting disposition. Do not treat as a conviction.
Wants and warrants: None active.
Cautions: Officer safety flag from cycle 3 (resisted arrest). No weapons flag.
Dissemination: 28 CFR Part 20. Secondary dissemination must be logged. Use for any purpose other
  than the administration of criminal justice is prohibited and is an auditable violation.
    `.trim(),
  },
  {
    id: 'case-0047',
    label: 'Active Investigation — Case 0047',
    classification: 'LAW ENFORCEMENT SENSITIVE',
    keywords: ['case 0047', '0047', 'homicide investigation', 'active investigation', 'monument street', 'investigative file'],
    policy: [caseaccess('2026-0047'), discipline('sworn')],
    policyNote: 'Assignment to case 0047 AND sworn status. The robbery detective is refused — same rank, same agency, different assignment.',
    text: `
ACTIVE INVESTIGATION FILE — LAW ENFORCEMENT SENSITIVE
Case 2026-0047 · Homicide · Central District

Incident: Single victim, Monument St corridor. Time of incident established within a 40-minute
  window by two independent sources.
Investigative posture: Two persons of interest developed. Neither charged. One has retained counsel
  and has declined interview; the second has not been located.
Physical evidence: 3 items submitted to the lab. Firearms examination pending, 14-day estimate.
  Latent prints on one item — no AFIS hit.
Video: Recovered from 4 of 9 canvassed businesses. Two cameras cover the approach; none cover
  the incident itself.
Investigative hold: Do not release vehicle description details beyond what the public BOLO carries.
  Broader release would tell the persons of interest what we have.
    `.trim(),
  },
  {
    id: 'informant',
    label: 'Confidential Informant File',
    classification: 'LAW ENFORCEMENT SENSITIVE // CI',
    keywords: ['informant', 'confidential informant', 'ci file', 'source', 'cooperating witness', 'ci handler'],
    policy: [caseaccess('2026-0047'), discipline('sworn'), cjis('certified')],
    policyNote: 'Three definitions AND-ed: case assignment, sworn status, and CJIS certification. The narrowest file in the mode — and rightly so, because disclosure here gets someone hurt.',
    text: `
CONFIDENTIAL INFORMANT FILE — LAW ENFORCEMENT SENSITIVE // CI
CI reference: CI-0047-B · True identity sealed separately

Status: Active. Registered, signed cooperation agreement on file. Reliability established through
  two prior corroborated instances.
Motivation: Consideration on a pending charge. Documented, and disclosed to the prosecutor.
Access: Direct social access to one person of interest in case 0047. Not tasked to elicit; passive
  reporting only, per handler instruction.
Reporting: CI places the person of interest in the Monument St corridor within the incident window.
  Uncorroborated by independent evidence at this time.
Risk assessment: Elevated. The CI's access is narrow enough that acting visibly on this reporting
  would identify them. Handler recommends no overt action derived from CI reporting alone.
Handling: Identity not to be disclosed outside the handler, the assigned investigator, and the
  prosecutor. Brady/Giglio obligations to be assessed by the prosecutor, not by investigators.
    `.trim(),
  },
  {
    id: 'sitrep',
    label: 'MCI Situation Report',
    classification: 'MUTUAL AID — SHARED',
    keywords: ['mci', 'mass casualty', 'situation report', 'sitrep', 'incident command', 'mutual aid', 'scene status'],
    policy: [jurisdiction('mutual-aid')],
    policyNote: 'Mutual aid alone. The widest real policy in the mode: everyone working the incident gets it, and the public defender does not. Policy enabling disclosure, not just blocking it.',
    text: `
MASS CASUALTY INCIDENT — SITUATION REPORT
Incident 26-MCI-0047 · Operational period 2 · MUTUAL AID DISTRIBUTION

Incident type: Multi-vehicle collision with structure impact, Monument St and Broadway.
Scene status: Contained. Extrication complete. Structural engineer on scene, building red-tagged.
Patient count: 11 total. Triage — 2 red, 4 yellow, 5 green. No black tags.
Transport: 2 red to Johns Hopkins R1 (Level I). 4 yellow distributed across 2 receiving facilities
  to avoid overload. 5 green treated and released on scene.
Resources committed: 3 medic units, 2 engines, 1 truck, 1 battalion chief, 6 patrol units.
Unified command: Fire holds incident command. PD holds the traffic and investigative perimeter.
Next operational period: Scene turnover to PD investigative control at the top of the hour.
Note: Patient identities are not carried in this report and are not required for incident command.
    `.trim(),
  },
  {
    // The sharpest tier story in the app: the medic needs allergies and medications, the
    // incident commander needs counts and dispositions, and neither one needs the other's
    // version. The privileged tier is not "more senior" — it is a different job.
    id: 'handoff',
    label: 'Patient Handoff Record',
    classification: 'PHI // MUTUAL AID',
    keywords: ['handoff', 'patient handoff', 'phi', 'ems report', 'patient care report', 'allergies', 'medications', 'triage tag'],
    tiers: [
      {
        id: 'clinical',
        label: 'Clinical Record (identified PHI)',
        classification: 'PHI // EMS TREATING PROVIDER',
        policy: [discipline('ems')],
        policyNote: 'The EMS discipline. Identity, allergies, and medications live only here — and note that the detectives cannot reach it either.',
        text: `
PATIENT CARE REPORT — PHI // TREATING PROVIDER
Incident 26-MCI-0047 · Patient 2 of 11 · Triage: RED

Patient: MARLOWE, Danielle · DOB 1994-11-02 · Age 31 · Female
Chief complaint: Chest and abdominal trauma, restrained front-seat occupant.
Vitals en route: BP 88/54 → 96/60 after fluids. HR 122. SpO2 94% on 15L NRB. GCS 14.
Allergies: PENICILLIN — anaphylaxis documented. Also reports sulfa intolerance.
Medications: Metoprolol 50mg daily. Sertraline 50mg daily. No anticoagulants — relevant to trauma.
Interventions: 2 large-bore IVs, 500mL crystalloid, C-collar, 12-lead (no acute ischemic changes).
  Fentanyl 50mcg IV for pain, tolerated.
Transport: Johns Hopkins R1, trauma team activated pre-arrival, 9-minute transport.
Handoff: Verbal report to trauma attending. Allergy communicated verbally and documented.
Handling: PHI under HIPAA. Treating providers and the receiving facility. Not for investigative use.
        `.trim(),
      },
      {
        id: 'command',
        label: 'Command Summary (no identity)',
        classification: 'MUTUAL AID — NO PHI',
        policy: [jurisdiction('mutual-aid')],
        policyNote: 'Mutual aid. Triage category, disposition, and destination — everything incident command needs and nothing it does not.',
        text: `
PATIENT TRACKING SUMMARY — MUTUAL AID // NO PHI
Incident 26-MCI-0047 · Patient 2 of 11

Triage category: RED (immediate).
Mechanism: Restrained front-seat occupant, multi-vehicle collision.
Injury summary: Torso trauma. Hemodynamically unstable on scene, responded to fluids en route.
Disposition: Transported. Trauma team activation requested pre-arrival.
Destination: Johns Hopkins R1 (Level I trauma). Transport interval 9 minutes.
Tracking status: Arrival confirmed. Bed assignment relayed to incident command.
Identity, date of birth, allergies, and medication history: withheld — carried in the clinical
  record and available to treating providers only.
        `.trim(),
      },
    ],
  },
]

const prompts = [
  { label: 'Public BOLO',        text: 'What does the public BOLO describe?' },
  { label: 'Criminal history',   text: 'Pull the criminal history record for Marlowe.' },
  { label: 'Case 0047',          text: 'What is the investigative posture on case 0047?' },
  { label: 'Informant file',     text: 'What does the confidential informant file say about reliability and risk?' },
  { label: 'MCI situation',      text: 'Give me the current situation report for the mass casualty incident.' },
  { label: 'Patient handoff',    text: 'What is the handoff information for patient 2, including allergies?' },
  { label: 'Why CJIS?',          text: 'What is CJIS and why does it restrict criminal history information?' },
]

export default {
  id: 'leer',
  name: 'Law Enforcement / Emergency Response',
  short: 'LE / ER',
  tagline: 'CJIS, case scoping, mutual aid at an incident',
  icon: 'alert',
  accent: '#f97316',
  premise: `A live multi-agency incident with an investigation running through it. Police, fire, EMS, and a public defender all touching the same event, where two detectives of identical rank are separated by a single attribute — which case they are assigned to.`,
  teaches: [
    {
      title: 'Access runs sideways, not up',
      detail: 'The two detectives share an agency, a rank, and a CJIS certification. One reaches case 0047 and one reaches 0112. Nothing hierarchical distinguishes them, so nothing hierarchical could express the rule.',
    },
    {
      title: 'Two conditions, both required',
      detail: 'The civilian crime analyst is CJIS-certified but not sworn, so criminal history stays closed. Certification is necessary and not sufficient — exactly what AND-ing two definitions says.',
    },
    {
      title: 'Policy that shares, not just withholds',
      detail: 'The situation report is scoped to mutual aid so every responder gets it immediately, and the patient handoff splits in two so the medic gets allergies while command gets triage counts. The privileged tier is a different job, not a higher rank.',
    },
    {
      title: 'The assistant is entitled too',
      detail: 'Retrieval asks the KAS twice — once as you, once as the agent acting for you — and releases the document only if both are granted. The case 0047 agent opens the informant file and cannot touch the clinical record; the EMS agent is the reverse. Discipline splits the agents exactly as it splits the people.',
    },
  ],
  vocabulary: [
    { name: 'cjis',         rule: 'ANY_OF', detail: 'certified — the CJIS Security Policy gate on criminal justice information.' },
    { name: 'discipline',   rule: 'ANY_OF', detail: 'sworn, ems, fire, analyst, publicdefender — what the person actually does.' },
    { name: 'caseaccess',   rule: 'ANY_OF', detail: '2026-0047, 2026-0112 — assignment to a specific investigation.' },
    { name: 'jurisdiction', rule: 'ANY_OF', detail: 'mutual-aid, city-baltimore, state-md, federal — who is inside the incident.' },
  ],
  defaultPersonaId: 'le-nina',
  // Nina works case 0047, so the matching agent starts them aligned; switching to Ray (case
  // 0112) then shows the human and the agent disagreeing about the same file.
  defaultAgentId: 'le-agent-case',
  personas,
  agents,
  documents,
  prompts,
}
