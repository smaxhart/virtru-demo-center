/**
 * Defense Industrial Base — CUI, NARA Registry markings, and limited dissemination controls.
 *
 * A compliance scenario rather than a mission one. The audience is a CISO, an ISSO, or a CMMC
 * assessor, and the question being answered is not "what can my analysts do" but "does this satisfy
 * NIST 800-171 3.1.1 and 3.1.3, and can I show an auditor the record." Everything below is chosen
 * for that: the markings are real NARA CUI Registry codes, the personas are the parties a DFARS
 * 252.204-7012 flowdown makes accountable, and the documents are the artifacts that flowdown covers.
 *
 * It inherits the Federal Civilian mode's discipline and extends it. Nothing here is classified and
 * there is no `clearance` attribute anywhere in the file — CUI is unclassified, and a CUI demo built
 * on clearance tiers teaches the wrong model to the one audience guaranteed to notice. What decides
 * access is which category you hold and which dissemination control the originator will release to
 * you. Federal Civilian shows that inside one government; this shows it across the boundary between
 * a government and its suppliers, which is where `FED ONLY` and `FEDCON` finally mean something.
 *
 * Two things about the vocabulary that are easy to read backwards:
 *
 *   `ldc` values are *release eligibility*, not restrictions. A persona holding `ldc:noforn` is one
 *   the originator will release NOFORN material to. Same inversion as the IC mode's `dissem:orcon`,
 *   and it reads more jarringly here, so it is stated in `teaches` as well.
 *
 *   `cui` is ANY_OF, so two categories in one policy means *either*, not both. A real
 *   `CUI//SP-CTI/SP-EXPT//FEDCON` banner is therefore not expressible as a single policy in this
 *   vocabulary. Each document below carries one controlling category, and the export-control beat
 *   lives on its own document rather than being AND-ed onto the CTI one.
 *
 * No document here declares a `classification`. The banner is derived from the policy by
 * `ai/banner.js` — see the note there for why that matters more in this mode than in any other.
 * What it does not model is decontrol: CUI carries decontrol dates and event-driven decontrol, and
 * a static attribute is a statement about now, so decontrol here would be a policy change rather
 * than something the marking knows. Worth saying before being asked.
 */

// `role` and `nationality` are granted to these personas but named by no policy here, so they are
// deliberately not imported — nothing in this file needs to build an FQN for them.
import { cui, ldc } from './vocab.js'

const personas = [
  {
    id: 'dib-renee',
    name: 'Renée Alvarez',
    title: 'Program Manager, AFLCMC (government)',
    icon: 'capitol',
    color: '#14b8a6',
    note: 'The only federal employee in the scenario, and the only holder of FED ONLY, NOCON, or DL ONLY. Nothing about her access comes from seniority — it comes from being the government.',
  },
  {
    id: 'dib-tom',
    name: 'Tom Braddock',
    title: 'Systems Engineer, Aegis Dynamics (prime)',
    icon: 'contractor',
    color: '#0ea5e9',
    note: 'The prime contractor. FEDCON-authorized, NOFORN-releasable, and holding the CTI flowdown — which is as far as a non-federal party gets. The award memorandum stays shut.',
  },
  {
    id: 'dib-dale',
    name: 'Dale Whitcomb',
    title: 'Quality Manager, Kestrel Machining (Tier 2)',
    icon: 'contractor',
    color: '#f59e0b',
    // Same icon as Tom, different colour, on purpose — the point is how alike they are.
    note: 'A Tier-2 supplier on the same program as Tom, differing from him by exactly one attribute: his subcontract never received the CTI flowdown. He machines the part and cannot open the drawing that specifies it.',
  },
  {
    id: 'dib-anika',
    name: 'Anika Rautenberg',
    title: 'Structures Analyst, Aegis Dynamics (DE national)',
    icon: 'liaison',
    color: '#a855f7',
    badge: 'DE',
    note: 'A German national on the prime’s own team. Same employer and same CUI category as Tom, refused the NOFORN drawing set and the export-controlled release — and note that no policy here reads her nationality. NOFORN and export control do that work.',
  },
  {
    id: 'dib-joy',
    name: 'Joy Nakashima',
    title: 'Contract Administrator, Aegis Dynamics',
    icon: 'contract',
    color: '#10b981',
    note: 'Holds one category — proprietary business information — because administering the subcontract requires it and nothing else does. The honest posture for most people on a cleared program.',
  },
  {
    id: 'dib-rhea',
    name: 'Rhea Solberg',
    title: 'Business Development, Northgate Systems',
    icon: 'anonymous',
    color: '#6b7280',
    note: 'A competitor with no role on the program. Authenticates successfully, holds nothing, and reaches the public solicitation and not one page further.',
  },
]

/**
 * The assistants. Grants live in `electron/ai-identities.js`; this is the display half.
 *
 * **No agent here holds a limited dissemination control beyond FEDCON** — not NOFORN, not FED ONLY,
 * not NOCON. Three of the eight units are therefore unreachable through any assistant in the mode,
 * which is the line worth having for a compliance audience: every limited-dissemination control in
 * this scenario stops at a human. Nor does any agent hold both FED ONLY and FEDCON; that pair is
 * the government/contractor boundary, and an identity standing on both sides of it would be the
 * same category error as an agent holding all four civilian CUI categories.
 */
const agents = [
  {
    id: 'dib-agent-supplier',
    name: 'Supplier Portal Assistant',
    title: 'ldc:fedcon',
    icon: 'agent',
    color: '#6b7280',
    note: 'Authorized as a contractor-side assistant and holding no CUI category at all, so it reaches exactly the public solicitation. This is what most vendor-portal chatbots actually are.',
  },
  {
    id: 'dib-agent-engineering',
    name: 'Engineering Data Agent',
    title: 'CUI sp-cti · propin · ldc:fedcon',
    icon: 'agent',
    color: '#0ea5e9',
    note: 'The widest agent here, and still two categories out of four and one control out of five. Pair it with Tom and ask for the technical data package: he personally opens the NOFORN drawing set, this does not, so he is served the releasable interface document instead.',
  },
  {
    id: 'dib-agent-quality',
    name: 'Supplier Quality Agent',
    title: 'CUI propin · expt · ldc:fedcon',
    icon: 'agent',
    color: '#f59e0b',
    note: 'Export-controlled drawings and supplier agreements, deliberately without sp-cti. Neither this nor the engineering agent contains the other, so there is no single best assistant to fall back on.',
  },
]

const documents = [
  {
    id: 'solicitation',
    label: 'Solicitation & Industry Day Package',
    // The one document with an authored marking, because there is no CUI in it to derive one from.
    classification: 'UNCLASSIFIED // PUBLIC RELEASE',
    keywords: ['solicitation', 'industry day', 'rfp', 'request for proposal', 'public notice', 'bidders', 'sam.gov', 'competition'],
    policy: [],
    policyNote: 'No attributes in the policy. Every authenticated caller opens it, including the competitor with no role on the program — a system that only ever denies proves nothing.',
    text: `
SOLICITATION SYNOPSIS — UNCLASSIFIED // CLEARED FOR PUBLIC RELEASE
FA8615-26-R-0044 · Advanced seeker assembly, engineering and manufacturing development

Scope: Design, qualify, and deliver 24 seeker assemblies plus associated technical data.
  Base period 36 months, two option years for low-rate production.
Set-aside: None. Full and open competition.
Estimated value: $84M base plus options.
Anticipated contract type: Cost-plus-incentive-fee for EMD, firm-fixed-price for options.
Industry day: Held last quarter, 41 attendees from 19 firms. Slides and Q&A posted to SAM.gov.
Security and handling: Performance requires access to Controlled Unclassified Information,
  including Controlled Technical Information. Offerors must flow DFARS 252.204-7012 to all
  subcontractors at every tier who will handle covered defense information, and must have a
  current NIST SP 800-171 assessment on record in SPRS.
Nothing in this synopsis is CUI. Technical requirements are released only under the data
  rights and handling terms described in Section H.
    `.trim(),
  },
  {
    id: 'cdrl',
    label: 'CDRL A004 — Qualification Test Report',
    keywords: ['cdrl', 'a004', 'test report', 'qualification test', 'deliverable', 'data item', 'vibration', 'did'],
    policy: [cui('sp-cti'), ldc('fedcon')],
    policyNote: 'CUI category sp-cti AND ldc:fedcon → banner CUI//SP-CTI//FEDCON. A contract deliverable containing controlled technical information, releasable to the government and to authorized contractors. The Tier-2 supplier holds no sp-cti and is refused.',
    text: `
CDRL A004 — QUALIFICATION TEST REPORT — CUI//SP-CTI//FEDCON
Contract FA8615-26-C-0044 · DID DI-NDTI-80809B · Submitted this quarter

Article under test: Seeker assembly, P/N 4471-002, serial 007 (first article).
Test sequence completed: 6 of 7. Random vibration, thermal cycling, thermal shock,
  humidity, altitude, and EMI/EMC per MIL-STD-461G. Salt fog deferred to the second article.
Results:
  Random vibration — PASS at 14.2 Grms, 3 axes, 60 min/axis. No structural findings.
  Thermal cycling — PASS, 250 cycles, -54 °C to +71 °C. Two solder joints reworked at cycle 180.
  EMI/EMC — CONDITIONAL. CE102 exceedance of 4 dB between 2.1 and 2.6 MHz. Filter redesign
    in work; retest scheduled. Does not affect flight safety per the safety review board.
Open items: 3 minor, 1 conditional. No majors.
Handling: Controlled Technical Information. Distribution Statement D — US Government agencies
  and their contractors only. Export of this data is restricted; see the export-controlled
  drawing release for the geometry it references.
    `.trim(),
  },
  {
    // The tearline pattern, in a CUI register. The full drawing set is NOFORN; the interface
    // control document is the part the originator will release to any authorized contractor.
    id: 'tdp',
    label: 'Technical Data Package',
    keywords: ['technical data package', 'tdp', 'drawing set', 'interface control', 'icd', 'seeker', 'assembly', 'geometry'],
    tiers: [
      {
        id: 'full',
        label: 'Full Drawing Set (NOFORN)',
        policy: [cui('sp-cti'), ldc('noforn')],
        policyNote: 'sp-cti AND ldc:noforn → CUI//SP-CTI//NOFORN. The government PM and the prime’s US engineer. No agent in this mode holds noforn, so this tier is unreachable through every assistant.',
        text: `
TECHNICAL DATA PACKAGE — FULL DRAWING SET — CUI//SP-CTI//NOFORN
Contract FA8615-26-C-0044 · Revision C · 214 sheets

Top assembly: 4471-002 seeker assembly.
Included: Detail drawings (167), assembly drawings (31), wiring (9), process specifications (7).
Key characteristics designated: 14. Dimensional tolerance stack-up analysis at sheet 88.
Seeker window: Chalcogenide glass, 3.0–5.0 µm passband, coating recipe at sheet 141. The
  deposition sequence and dwell times on that sheet are the qualifying constraint on detection
  range and are the reason this package is NOFORN rather than FEDCON.
Gimbal: Two-axis, brushless, 0.14 mrad pointing accuracy. Bearing preload procedure at sheet 103.
Materials: Two entries require domestic sourcing per DFARS 252.225-7009 (specialty metals).
Handling: Controlled Technical Information, NOFORN. Not releasable to foreign nationals
  including foreign nationals employed by authorized contractors. Distribution Statement D.
        `.trim(),
      },
      {
        id: 'icd',
        label: 'Interface Control Document',
        policy: [cui('sp-cti'), ldc('fedcon')],
        policyNote: 'sp-cti AND ldc:fedcon → CUI//SP-CTI//FEDCON. The releasable half: the interfaces a contractor needs to build to, without the geometry and process data that make the full set NOFORN. Everyone entitled to the full set is entitled to this too, and is served the full set first.',
        text: `
TECHNICAL DATA PACKAGE — INTERFACE CONTROL DOCUMENT — CUI//SP-CTI//FEDCON
Contract FA8615-26-C-0044 · Revision C · 22 sheets

Mechanical interface: 6-bolt flange, 101.6 mm bolt circle, 4 × dowel location. Mass budget
  2.85 kg ± 0.05. Centre of gravity envelope defined at sheet 6.
Electrical interface: MIL-DTL-38999 Series III, 19-pin. 28 VDC nominal, 41 W peak, 22 W steady.
Data interface: MIL-STD-1553B remote terminal, RT address configurable. Message set at sheet 14.
Environmental envelope: Qualified to -54 °C to +71 °C, 14.2 Grms random vibration.
Optical interface: Window aperture 74 mm clear, boresight datum defined relative to the
  mechanical flange. Passband, coating, and internal optical train: NOT INCLUDED — see the
  full drawing set, which is NOFORN.
Handling: Controlled Technical Information. Distribution Statement D — US Government agencies
  and their contractors. Releasable to authorized contractor personnel without regard to
  nationality; the withheld sheets are what carry the NOFORN restriction.
        `.trim(),
      },
    ],
  },
  {
    id: 'export-drawings',
    label: 'Export-Controlled Drawing Release',
    keywords: ['export controlled', 'export control', 'itar', 'ear', 'export license', 'usml', 'drawing release', 'technical assistance agreement'],
    policy: [cui('expt'), ldc('fedcon')],
    policyNote: 'CUI category expt AND ldc:fedcon → CUI//SP-EXPT//FEDCON. A separate category from sp-cti, and deliberately a separate document: `cui` is ANY_OF, so naming both categories in one policy would mean "either" and loosen it rather than tighten it.',
    text: `
EXPORT-CONTROLLED DRAWING RELEASE — CUI//SP-EXPT//FEDCON
Contract FA8615-26-C-0044 · Release ECR-26-0188

Governing authority: USML Category IV(h). ITAR 22 CFR Parts 120-130 applies to the technical
  data listed below. Two subordinate items are EAR 9E003 rather than ITAR; both are listed.
Released to: Aegis Dynamics (prime) and Kestrel Machining (Tier 2, quality and inspection use).
Items released: Machining drawings for the gimbal housing and bearing races, inspection
  procedures, and the associated GD&T datum scheme. 38 sheets.
Empowered official determination: Release to the named US persons at the named facilities is
  authorized without a licence. Release to any foreign person, including a foreign person
  employed at either facility, requires a TAA or DSP-5 and is NOT authorized by this release.
Deemed export warning: Providing this data to a foreign national inside the United States is an
  export to that person's country of nationality. Access control is the compliance mechanism.
Handling: Export Controlled. Distribution Statement D with export warning.
    `.trim(),
  },
  {
    id: 'cost-analysis',
    label: 'Supplier Rate Comparison',
    keywords: ['rate comparison', 'supplier rates', 'cost analysis', 'indirect rates', 'wrap rate', 'should-cost', 'forward pricing'],
    policy: [cui('propin'), ldc('nocon')],
    policyNote: 'CUI propin AND ldc:nocon → CUI//PROPIN//NOCON. Government-produced, containing several contractors’ proprietary rate data, so it is released to the government and to no contractor at all — not even the ones whose data is in it. This is why NOCON exists, and it is the same category as the subcontract agreement below.',
    text: `
SUPPLIER RATE COMPARISON — CUI//PROPIN//NOCON
Prepared by the government program office · Should-cost review, this quarter

Purpose: Compare forward pricing rates across the four suppliers proposed for the gimbal
  housing, to support a should-cost position ahead of the option-year negotiation.
  Contains proprietary data from all four. Not releasable to any of them.
  Aegis Dynamics    — fringe 34.1%, overhead 118.4%, G&A 11.2%, wrap 3.21, fee 9.0% proposed
  Kestrel Machining — fringe 28.9%, overhead 91.6%,  G&A 8.4%,  wrap 2.62, fee 11.5% proposed
  Northgate Systems — fringe 31.2%, overhead 104.8%, G&A 9.9%,  wrap 2.94, fee 8.5% proposed
  Supplier D        — fringe 26.4%, overhead 88.1%,  G&A 7.8%,  wrap 2.48, fee 12.0% proposed
Government position: Kestrel's wrap rate is 18% below the prime's for comparable work.
  Recommend directing a make-or-buy review of the housing before exercising Option 1, and
  challenging 240 hours of the prime's proposed touch labour as unsupported by the A004 results.
Handling: Proprietary business information of four separate firms. NOCON — disclosure to any
  contractor, including one that submitted part of this data, would expose competitors' rates.
    `.trim(),
  },
  {
    id: 'subk-agreement',
    label: 'Subcontract Flowdown Agreement',
    keywords: ['subcontract', 'flowdown', 'teaming agreement', 'subk', 'nondisclosure', 'supplier agreement', 'clause'],
    policy: [cui('propin'), ldc('fedcon')],
    policyNote: 'The same CUI category as the rate comparison — propin — with ldc:fedcon instead of nocon. One document reaches five people and the other reaches one. The category is identical; the limited dissemination control is doing all of the work.',
    text: `
SUBCONTRACT FLOWDOWN AGREEMENT — CUI//PROPIN//FEDCON
Aegis Dynamics → Kestrel Machining · Subcontract AD-26-0771

Statement of work: Machining, inspection, and delivery of the gimbal housing and bearing races
  per the released export-controlled drawing package. 24 ship sets plus 4 qualification units.
Value: $6.14M firm-fixed-price. Payment on delivery and acceptance.
Clauses flowed down: DFARS 252.204-7012 (safeguarding covered defense information and cyber
  incident reporting), 252.204-7020 (NIST SP 800-171 DoD assessment requirements),
  252.225-7009 (specialty metals), FAR 52.204-21.
Scope of CUI access granted: Export-controlled machining data and inspection procedures.
  Controlled Technical Information is NOT within scope of this subcontract — the seller does
  not receive the seeker technical data package or its derivative deliverables. This limitation
  was priced and is the reason the seller's quote excludes design-support labour.
SPRS: Seller's current 800-171 assessment score on record, dated within 12 months.
Handling: Contains proprietary terms and pricing of both parties. Releasable to the
  government and to authorized contractor personnel supporting this subcontract.
    `.trim(),
  },
  {
    id: 'award-memo',
    label: 'Source Selection Award Memorandum',
    keywords: ['award memorandum', 'source selection decision', 'award decision', 'best value', 'competitive range', 'ssa decision', 'debrief'],
    policy: [cui('procurement'), ldc('fedonly')],
    policyNote: 'CUI procurement AND ldc:fedonly → CUI//SSEL//FED ONLY. FED ONLY excludes every contractor in the scenario by construction, including the one that won. This is the pair that carries the compliance story: FEDCON admits the primes, FED ONLY does not.',
    text: `
SOURCE SELECTION DECISION DOCUMENT — CUI//SSEL//FED ONLY
FA8615-26-R-0044 · Source Selection Authority decision, this quarter

Offerors in the competitive range: 3 of 5.
  Aegis Dynamics    — Technical: Outstanding. Past performance: Substantial confidence.
                      Evaluated price $86.4M.
  Northgate Systems — Technical: Good. Past performance: Satisfactory confidence. Two
                      unmitigated weaknesses in the seeker window approach. Price $79.1M.
  Offeror C         — Technical: Marginal. Eliminated from the competitive range.
Tradeoff: Aegis's window coating approach is the discriminator. Northgate's proposed passband
  is achievable but their qualification schedule is unsupported by their own test facility
  throughput, which the evaluation team assessed as a schedule risk not offset by a 9% price
  advantage.
Decision: Award to Aegis Dynamics. No discussions beyond the competitive range determination.
Debriefing: Offerors receive the FAR 15.506 content only. This document is not releasable to
  any offeror, successful or otherwise.
Handling: Source selection information under FAR 2.101 and 41 U.S.C. §2102. FED ONLY —
  federal employees only. Release to a contractor, including the awardee, taints the record.
    `.trim(),
  },
]

const prompts = [
  { label: 'Solicitation',        text: 'What is the solicitation asking for and what are the handling requirements?' },
  { label: 'Test report',         text: 'What did the CDRL A004 qualification test report find?' },
  { label: 'Technical data',      text: 'Show me the technical data package for the seeker assembly.' },
  { label: 'Export release',      text: 'What does the export-controlled drawing release authorize?' },
  { label: 'Supplier rates',      text: 'What does the supplier rate comparison say about wrap rates?' },
  { label: 'Subcontract',         text: 'What was flowed down in the subcontract agreement with Kestrel?' },
  { label: 'Award decision',      text: 'Which offeror won the source selection and why?' },
  { label: 'What is CUI?',        text: 'What is CUI and how do the limited dissemination controls work?' },
]

export default {
  id: 'dib',
  name: 'Defense Industrial Base',
  short: 'DIB',
  tagline: 'CUI Registry markings, limited dissemination controls, 800-171',
  icon: 'contract',
  accent: '#14b8a6',
  premise: `One weapons program, a government program office, a prime, a Tier-2 supplier, and a foreign national on the prime's own team. Nothing here is classified — every restriction is a NARA CUI Registry category and a limited dissemination control, and the banner on each document is computed from the policy rather than typed by hand.`,
  teaches: [
    {
      title: 'CUI is unclassified, and it is the hard part',
      detail: 'There is no clearance attribute anywhere in this scenario. Every decision turns on which CUI category you hold and which dissemination control the originator will release to you — which is exactly what 800-171 3.1.1 and 3.1.3 ask you to control, and exactly what a shared drive cannot express.',
    },
    {
      title: 'The banner is computed, not typed',
      detail: 'CUI//SP-CTI//NOFORN is derived from the two attributes the document is encrypted under, so changing the policy changes the marking and a label cannot drift from what is enforced. What it cannot compute is decontrol: CUI carries decontrol dates and event-driven decontrol, and an attribute is a statement about now, so decontrol here is a policy change rather than something the marking knows.',
    },
    {
      title: 'FED ONLY against FEDCON is the org chart',
      detail: 'The award memorandum is FED ONLY and reaches one person; the subcontract agreement is FEDCON and reaches five. Sharper still: the rate comparison and the subcontract carry the identical CUI category — PROPIN — and one reaches a single reader while the other reaches five. The category is not what decides; the dissemination control is.',
    },
    {
      title: 'A flowdown is one attribute',
      detail: 'Tom at the prime and Dale at the Tier-2 supplier are both authorized contractors, both NOFORN-releasable, and differ by exactly cui:sp-cti — whether DFARS 7012 carried Controlled Technical Information into Dale’s subcontract. He machines the part and is refused the drawing that specifies it. The denial is attributable to one attribute, which is what makes it an audit finding rather than an argument.',
    },
    {
      title: 'The assistant is entitled too, and no assistant holds a control',
      detail: 'Retrieval asks the KAS twice — once as you, once as the agent acting for you — and releases only if both are granted. No agent in this mode holds NOFORN, FED ONLY, or NOCON, so three of the eight units are unreachable through every assistant. Ask the engineering agent for the technical data package as Tom: he personally opens the NOFORN drawing set, it does not, and he is served the releasable interface document instead.',
    },
  ],
  vocabulary: [
    { name: 'cui', rule: 'ANY_OF', detail: 'sp-cti, expt, propin, procurement — the NARA CUI Registry category. Rendered SP-CTI, SP-EXPT, PROPIN, SSEL in the banner. ANY_OF, so two in one policy would mean either.' },
    { name: 'ldc', rule: 'ANY_OF', detail: 'noforn, fedonly, fedcon, nocon, dlonly — the Limited Dissemination Control per 32 CFR 2002.20. Holding one is release eligibility, not a restriction on you.' },
    { name: 'role', rule: 'ANY_OF', detail: 'contracting, contractor, analyst, admin — carried on personas for display, not decided on by any policy here.' },
    { name: 'nationality', rule: 'ANY_OF', detail: 'usa, deu — display only. NOFORN and export control do the work; a nationality field would be a roster where a marking belongs.' },
  ],
  defaultPersonaId: 'dib-tom',
  // Tom with the engineering agent is the pairing where the two nearly agree, so the first thing
  // anyone tries — the technical data package — lands on the tier fallback rather than a refusal,
  // and every later denial is attributable to one side or the other.
  defaultAgentId: 'dib-agent-engineering',
  personas,
  agents,
  documents,
  prompts,
}
