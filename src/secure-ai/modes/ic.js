/**
 * Intelligence Community — compartments, dissemination controls, and tearlines.
 *
 * Where the DoW scenario shows clearance as the interesting variable, this one shows it as
 * the boring one. Every analyst here except two holds TS-SCI, and the level decides almost
 * nothing: the compartment (`sci`) and the originator's dissemination control (`dissem`) do
 * the work. The tearline document is the closest real-world analogue to a tiered TDF —
 * the sanitized paragraph and the source-revealing one have always been separate objects.
 */

import { clearance, sci, dissem, agency } from './vocab.js'

const personas = [
  {
    id: 'ic-diane',
    name: 'Diane Osei',
    title: 'Senior Collection Manager, NSA',
    icon: 'signals',
    color: '#3b82f6',
    note: 'TS-SCI with SI and TK. Two compartments, and still refused the HUMINT reporting — level is not the variable here. Reads the liaison tearline, never the sourced version.',
  },
  {
    id: 'ic-victor',
    name: 'Victor Reyes',
    title: 'Case Officer, CIA',
    icon: 'covert',
    color: '#8b5cf6',
    note: 'Holds HCS and ORCON, so he reaches source-identifying HUMINT product — and holds no TK, so he has no route into imagery at all.',
  },
  {
    id: 'ic-mei',
    name: 'Mei Lin Zhao',
    title: 'Imagery Analyst, NGA',
    icon: 'satellite',
    color: '#10b981',
    note: 'TK only. Identical clearance to the collection manager, narrower compartment access.',
  },
  {
    id: 'ic-nadia',
    name: 'Nadia Petrov',
    title: 'Covert Action Staff, ODNI',
    icon: 'finding',
    color: '#ef4444',
    note: 'GAMMA and HCS under ORCON — the broadest holder in the set, and the only one who reaches the finding.',
  },
  {
    id: 'ic-frank',
    name: 'Frank Boyle',
    title: 'All-Source Analyst, DIA',
    icon: 'analyst',
    color: '#f59e0b',
    note: 'SECRET with RELIDO and no SCI whatsoever. Reaches the estimate and the tearline — which is precisely what tearlines exist for.',
  },
  {
    id: 'ic-warren',
    name: 'Warren Pike',
    title: 'Cleared Contractor, Systems Integrator',
    icon: 'contractor',
    color: '#6b7280',
    note: 'SECRET, no compartments, no dissemination controls. Maintains the systems these documents live on and reaches only the coordinated estimate — not even the tearline.',
  },
]

/**
 * The assistants. Grants live in `electron/identities.js`; this is the display half.
 *
 * Note what none of them has: GAMMA. The covert action finding is refused to every agent in the
 * scenario, including the broadest, so there is no configuration in which a machine reads it.
 */
const agents = [
  {
    id: 'ic-agent-allsource',
    name: 'All-Source Assistant',
    title: 'SECRET · RELIDO',
    icon: 'agent',
    color: '#6b7280',
    note: 'The estimate and the tearline, never the sourcing. An assistant working from sanitized product is the realistic deployment, and the tearline exists precisely so this can work at all.',
  },
  {
    id: 'ic-agent-sigint',
    name: 'SIGINT Support Agent',
    title: 'TS-SCI · SI, TK · RELIDO',
    icon: 'agent',
    color: '#0ea5e9',
    note: 'Two compartments and no ORCON. Pair it with Victor from CIA: he holds HCS and ORCON, and his HUMINT reporting still will not open, because this agent holds neither.',
  },
  {
    id: 'ic-agent-compartmented',
    name: 'Compartmented Agent',
    title: 'TS-SCI · SI, TK, HCS · ORCON',
    icon: 'agent',
    color: '#f59e0b',
    note: 'Three compartments, both dissemination controls, and still refused the covert action finding. Even the most privileged agent in the scenario has a ceiling somebody chose.',
  },
]

const documents = [
  {
    id: 'nie',
    label: 'National Intelligence Estimate — Key Judgments',
    classification: 'SECRET // NOFORN',
    keywords: ['nie', 'national intelligence estimate', 'key judgments', 'estimate', 'coordinated assessment'],
    policy: [clearance('secret')],
    policyNote: 'SECRET alone. The coordinated, sanitized product — deliberately the widest-held document in the set.',
    text: `
NATIONAL INTELLIGENCE ESTIMATE — KEY JUDGMENTS
SECRET // NOFORN · NIE 2026-14 · Coordinated across 8 IC elements

Key Judgment 1: We assess with moderate confidence that ACTOR-X will continue probing critical
  maritime infrastructure through at least the next two quarters. Confidence is moderate because
  the pattern is consistent across collection disciplines but intent remains inferred.
Key Judgment 2: We judge it unlikely (roughly 20%) that current activity is preparation for
  near-term kinetic action. Force posture indicators do not corroborate.
Key Judgment 3: ACTOR-X capability to disrupt port operations is assessed as growing. One IC
  element dissents, assessing capability as static — see the dissent annex.
Confidence and sourcing: Judgments rest on multiple collection disciplines. Source descriptions
  and specific reporting are carried in compartmented annexes not included here.
Note: This document is the sanitized coordinated product. It exists so that the judgment can
  travel further than the reporting behind it.
    `.trim(),
  },
  {
    id: 'sigint-product',
    label: 'SIGINT Product — SI/TK',
    classification: 'TOP SECRET // SI // TK // NOFORN',
    keywords: ['sigint product', 'si/tk', 'talent keyhole', 'intercept series', 'collection platform', 'signals product'],
    policy: [clearance('ts-sci'), sci('si')],
    policyNote: 'TS-SCI AND the SI compartment. The imagery analyst holds the same clearance and a different compartment, so she is refused.',
    text: `
SIGINT PRODUCT — TOP SECRET // SI // TK // NOFORN
Series 26-4471 · Reporting interval: 14 days

Collection: 3 platforms tasked against ACTOR-X maritime logistics network.
Traffic analysis: Volume up 40% over the prior interval. Pattern shift from scheduled to
  event-driven transmission, consistent with an activated coordination cell.
Selector activity: 2 previously dormant selectors returned to service. Both associated with
  the ACTOR-X port liaison element in prior reporting.
Content: 9 intercepts processed. Discussion of berth availability, fuel contracting, and one
  reference to "the survey team" arriving in the next window.
Analyst comment: The survey reference is the most significant item in this series. It is not
  corroborated by other disciplines and should not be characterized as confirmed.
Handling: SI compartment. TK-derived geolocation included — do not extract without TK marking.
    `.trim(),
  },
  {
    id: 'imagery',
    label: 'Overhead Imagery Assessment — TK',
    classification: 'TOP SECRET // TK // NOFORN',
    keywords: ['imagery', 'overhead', 'satellite', 'geoint', 'talent keyhole imagery', 'port imagery', 'nga assessment'],
    policy: [clearance('ts-sci'), sci('tk')],
    policyNote: 'TS-SCI AND the TK compartment. The mirror image of the SIGINT product — same level, other compartment.',
    text: `
OVERHEAD IMAGERY ASSESSMENT — TOP SECRET // TK // NOFORN
Target: Port complex NORTHPOINT · Collection: 6 passes over 11 days

Observed changes:
  Berth 4 — Two vessels alongside, both matching the profile of the ACTOR-X logistics class.
    Neither was present in the prior collection cycle.
  Hardstand south — New container arrangement, 40 TEU equivalent, staged rather than stacked.
    Staging is consistent with imminent movement rather than storage.
  Perimeter — Two additional guard positions constructed. Concrete cure state suggests
    construction within the last three weeks.
Assessment: Activity is consistent with preparation for a materiel movement in the next 14 days.
  Alternative explanation — a scheduled maintenance surge — cannot be excluded from imagery alone.
Confidence: Moderate. Recommend cross-discipline corroboration before this is used in a judgment.
Handling: TK. Derived measurements are TK-controlled; the assessment paragraph is not.
    `.trim(),
  },
  {
    id: 'humint',
    label: 'HUMINT Source Reporting — HCS',
    classification: 'TOP SECRET // HCS // ORCON // NOFORN',
    keywords: ['humint', 'hcs', 'source reporting', 'asset', 'clandestine', 'human source', 'orcon'],
    policy: [clearance('ts-sci'), sci('hcs'), dissem('orcon')],
    policyNote: 'Three definitions AND-ed: clearance, the HCS compartment, and ORCON. The narrowest document in the set — and the SIGINT and imagery analysts hold identical clearances.',
    text: `
HUMINT SOURCE REPORTING — TOP SECRET // HCS // ORCON // NOFORN
Report 26-HCS-0912 · Originator controls all dissemination

Source: SPINDLE — placed and access-verified, reporting reliably for 3 years. Sub-source access
  is direct; no intermediary in the reporting chain.
Reporting: The survey team referenced in signals reporting is a technical assessment team, not an
  operational element. Source attended a preparatory meeting and describes the tasking as a
  feasibility study for expanded berthing.
Source comment: Internal disagreement about the timeline. One faction pushing to accelerate;
  the logistics element resisting on capacity grounds.
Acquisition risk: Source's access to this reporting stream is narrow. Any action visibly derived
  from this report risks exposing SPINDLE. This is why the report is ORCON.
Handling: HCS. ORCON — no dissemination, extraction, or paraphrase outside the originating
  element without written authorization. A tearline version exists for wider use.
    `.trim(),
  },
  {
    id: 'finding',
    label: 'Covert Action Finding',
    classification: 'TOP SECRET // GAMMA // ORCON // NOFORN',
    keywords: ['covert action', 'finding', 'gamma', 'presidential finding', 'special activity', 'notification'],
    policy: [clearance('ts-sci'), sci('gamma'), dissem('orcon')],
    policyNote: 'GAMMA under ORCON. One persona in the entire set holds this — the demonstration that a compartment of one is expressible.',
    text: `
COVERT ACTION FINDING — TOP SECRET // GAMMA // ORCON
Reference: CAF-26-03 · Congressional notification status: Gang of Eight only

Authority: Finding signed and in force. Scope limited to the maritime logistics network
  described in referenced reporting.
Authorized activities: Non-attributable disruption of logistics coordination. Explicitly excludes
  any activity intended to cause casualties or damage to civilian port infrastructure.
Risk of exposure: Assessed as moderate. Mitigation relies on the activity being indistinguishable
  from ordinary logistics friction.
Oversight: Quarterly review by the DNI. Notification to the full committees deferred under the
  extraordinary-circumstances provision; deferral expires at the next quarterly review.
Legal: Reviewed by General Counsel. Opinion on file.
Handling: GAMMA. ORCON. Access is by name, not by clearance level.
    `.trim(),
  },
  {
    // A tearline is the original tiered document: the same reporting written twice, once
    // sourced and once sanitized, so the judgment can travel where the sourcing cannot.
    id: 'liaison',
    label: 'Liaison Service Reporting',
    classification: 'TOP SECRET // HCS // ORCON',
    keywords: ['liaison', 'partner service', 'tearline', 'foreign partner', 'third party rule', 'spindle'],
    tiers: [
      {
        id: 'sourced',
        label: 'Full Report (sourced)',
        classification: 'TOP SECRET // HCS // ORCON',
        policy: [sci('hcs'), dissem('orcon')],
        policyNote: 'The sourced version — names the partner service and the access. HCS and ORCON both required.',
        text: `
LIAISON SERVICE REPORTING — TOP SECRET // HCS // ORCON
Report 26-LNO-0208 · Third-party rule applies

Partner service: Liaison service ARBOR, internal reference their 4471-series.
Access: Partner holds a technical placement inside the port authority's scheduling system. This is
  a unilateral partner capability shared with us under a bilateral arrangement, not a joint program.
Reporting: Berthing schedule shows a 6-day block reserved under an administrative code the partner
  associates with military movements. Reservation was entered 19 days in advance.
Partner caveat: ARBOR asks that no action visibly derived from this reporting occur before the
  reservation window opens, to protect their placement.
Third-party rule: This reporting may not be passed to any further government without ARBOR's
  written consent. The tearline below was cleared by ARBOR for wider internal use.
        `.trim(),
      },
      {
        id: 'tearline',
        label: 'Tearline (sanitized)',
        classification: 'SECRET // REL IDO',
        policy: [clearance('secret'), dissem('relido')],
        policyNote: 'The tearline. SECRET with RELIDO — the judgment survives, the sourcing does not. This is the sanitized paragraph an all-source analyst is meant to work from.',
        text: `
TEARLINE — SECRET // RELIDO
Derived from reporting 26-LNO-0208 · Sourcing removed

A six-day berthing block at port complex NORTHPOINT has been reserved under an administrative
code associated with military movements. The reservation was entered approximately 19 days in
advance of the window.

Assessment: The advance reservation is consistent with a planned materiel movement rather than
an opportunistic one, and aligns with observed staging activity at the same complex.

Confidence: Moderate. Reporting is from a liaison relationship; sourcing details and the nature
of the access are withheld and are not required to use this judgment.
        `.trim(),
      },
    ],
  },
]

const prompts = [
  { label: 'NIE key judgments',  text: 'What are the key judgments in the national intelligence estimate?' },
  { label: 'SIGINT series',      text: 'What does the SI/TK signals product say about selector activity?' },
  { label: 'Imagery at the port',text: 'What changed in the overhead imagery assessment of the port complex?' },
  { label: 'HUMINT reporting',   text: 'What did the HUMINT source reporting say about the survey team?' },
  { label: 'Covert action',      text: 'What activities does the covert action finding authorize?' },
  { label: 'Liaison tearline',   text: 'What does the liaison service reporting say about the berthing block?' },
  { label: 'Why compartments?',  text: 'Why do compartments exist if everyone already holds TS-SCI?' },
]

export default {
  id: 'ic',
  name: 'Intelligence Community',
  short: 'IC',
  tagline: 'Compartments, dissemination controls, tearlines',
  icon: 'satellite',
  accent: '#a855f7',
  premise: `Five IC elements working the same target through different collection disciplines. Almost everyone holds TS-SCI, so the clearance level decides nothing — the compartment and the originator's dissemination control decide everything.`,
  teaches: [
    {
      title: 'Compartments are orthogonal to level',
      detail: 'The SIGINT manager, the imagery analyst, and the case officer all hold TS-SCI. Each is refused the others’ product. Raising a clearance does not widen access sideways.',
    },
    {
      title: 'ORCON is a real attribute, not a footer',
      detail: 'On paper ORCON is a handling instruction that depends on people obeying it. Here it is a value in the policy: the originator’s control is enforced on every rewrap, so it survives the document being copied.',
    },
    {
      title: 'A tearline is a tiered TDF',
      detail: 'The liaison report exists twice — sourced and sanitized. The all-source analyst holds no compartments at all and is served the tearline automatically, because the platform tries the privileged version first and falls back.',
    },
    {
      title: 'The assistant is entitled too, and it is the ceiling',
      detail: 'Retrieval asks the KAS twice — once as you, once as the agent acting for you — and releases the document only if both are granted. No agent in this scenario holds GAMMA, so the one finding that depends on it is unreachable through any assistant no matter who is asking. An over-granted agent is a real hole, not a cosmetic one.',
    },
  ],
  vocabulary: [
    { name: 'clearance', rule: 'HIERARCHY', detail: 'ts-sci › secret. Present, and mostly not the deciding factor in this mode.' },
    { name: 'sci',       rule: 'ANY_OF',    detail: 'si, tk, hcs, gamma — the compartment. Held by name, never by level.' },
    { name: 'dissem',    rule: 'ANY_OF',    detail: 'orcon, relido, propin — the originator’s dissemination control.' },
    { name: 'agency',    rule: 'ANY_OF',    detail: 'nsa, cia, nga, dia, odni — carried on personas, not decided on by any policy here.' },
  ],
  defaultPersonaId: 'ic-frank',
  // Frank is SECRET/RELIDO, so the all-source agent matches him exactly — the pairing where the
  // human and the agent agree, which makes every later refusal attributable to one or the other.
  defaultAgentId: 'ic-agent-allsource',
  personas,
  agents,
  documents,
  prompts,
}
