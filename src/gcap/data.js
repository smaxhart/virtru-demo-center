/**
 * GCAP · Advanced Collaborative Environment (ACE) — people, documents, and the policy on each.
 *
 * Everything here is fictional. The programme, the three governments and the primes are real
 * names; the people, suppliers, figures and documents are invented, and nothing below is drawn
 * from or resembles any real design, threat or contract data.
 *
 * Two things are deliberately NOT stored on a document:
 *
 *   The marking. `marking.js` derives the banner from the policy, so what is printed on a file can
 *   never disagree with what the KAS enforces.
 *   The verdict. Who can open what is decided by a live KAS rewrap (`vault.js`), never by anything
 *   in this file. The EXPECTED matrix in `scripts/verify-gcap.mjs` is the only place verdicts are
 *   written down, and it exists to be compared against the KAS, not to drive the page.
 *
 * Persona ids are the `gcap-` identities in `electron/ai-identities.js`. The two files cannot
 * import each other (CommonJS in the main process, ESM here), so `verify-gcap.mjs` cross-checks
 * them and a drift is a test failure rather than a mystery denial.
 */

import { NS, coalitionFqns } from '../data/coalitions.js'

const fqn = (name, value) => `${NS}/${name}/value/${value}`

const clearance   = (v) => fqn('clearance', v)
const nationality = (v) => fqn('nationality', v)
const workpackage = (v) => fqn('workpackage', v)
const supplytier  = (v) => fqn('supplytier', v)
const role        = (v) => fqn('role', v)
const company     = (v) => fqn('company', v)

/** The three programme nations. Japan is a GCAP partner and is not in NATO or the Five Eyes. */
export const GCAP_NATIONS = ['gbr', 'ita', 'jpn']
const GCAP = GCAP_NATIONS.map(nationality)
const NATO = coalitionFqns('nato')

/** Clearance values, ranked. `ts-sci` is national TOP SECRET; the programme has no marking above SECRET. */
const U = clearance('unclassified')
const P = clearance('cui')          // GCAP RESTRICTED
const S = clearance('secret')       // GCAP SECRET
const T = clearance('ts-sci')       // national TOP SECRET, sovereign material only

// ── Custody ──────────────────────────────────────────────────────────────────
// SIMULATED. Demo Center runs one platform, so there is one key server. Each document names which
// party would hold its key in a real deployment, and the UI reports that party as the one that
// released or refused. Replacing this with per-nation key servers means changing where a unit is
// encrypted and read, not this table.
export const CUSTODIANS = {
  gigo: { id: 'gigo', label: 'GIGO joint custody',  short: 'GIGO' },
  gbr:  { id: 'gbr',  label: 'UK custodian',        short: 'UK'   },
  ita:  { id: 'ita',  label: 'Italian custodian',   short: 'IT'   },
  jpn:  { id: 'jpn',  label: 'Japanese custodian',  short: 'JP'   },
  nato: { id: 'nato', label: 'NATO custodian',      short: 'NATO' },
  ace:  { id: 'ace',  label: 'ACE operations',      short: 'ACE'  },
}

// ── People ───────────────────────────────────────────────────────────────────
export const PERSONAS = [
  {
    id: 'gcap-marco', name: 'Marco Bellandi', employer: 'Edgewing', title: 'Design authority', nation: 'ITA', color: '#2563eb',
    note: 'The broadest view in the environment, and a tree with no UK or Japanese sovereign file in it.',
  },
  {
    id: 'gcap-harriet', name: 'Harriet Lowe', employer: 'GIGO', title: 'Programme security', nation: 'GBR', color: '#7c3aed',
    note: 'Programme reach across all three nations, with sovereign reach into none but her own.',
  },
  {
    id: 'gcap-kenji', name: 'Kenji Watanabe', employer: 'Mitsubishi Heavy Industries', title: 'Propulsion lead', nation: 'JPN', color: '#dc2626',
    note: 'Japan is in GCAP and not in NATO. Releasability is a roster of nations, not a club.',
  },
  {
    id: 'gcap-priya', name: 'Priya Nair', employer: 'BAE Systems', title: 'Sensors engineer', nation: 'GBR', color: '#0891b2',
    note: 'Same nation as Harriet, one tier down, and only the sensors work package.',
  },
  {
    id: 'gcap-oliver', name: 'Oliver Hartley', employer: 'Edgewing', title: 'Funding controller', nation: 'GBR', color: '#059669',
    note: 'Runs the money and sees none of the design.',
  },
  {
    id: 'gcap-giulia', name: 'Giulia Ferraro', employer: 'Leonardo', title: 'Export and contracts', nation: 'ITA', color: '#d97706',
    note: 'Authority is not rank: she decides on export, and has no design access at all.',
  },
  {
    id: 'gcap-wren', name: 'Wren Castellan', employer: 'Tier-2 supplier', title: 'Production engineer', nation: 'GBR', color: '#65a30d',
    note: 'Is served the interface extract, not the design behind it.',
  },
  {
    id: 'gcap-owen', name: 'Owen Pryce', employer: 'Tier-3 supplier', title: 'Machinist', nation: 'GBR', color: '#be185d',
    note: 'An ordinary account at the bottom of the supply chain, and the one an adversary takes over.',
  },
  {
    id: 'gcap-sanjay', name: 'Sanjay Rao', employer: 'Edgewing IT', title: 'ACE administrator', nation: 'GBR', color: '#475569',
    note: 'Runs the platform. Running it is not access to what is in it.',
  },
  {
    id: 'gcap-ryan', name: 'Ryan Mercer', employer: 'A competing prime', title: 'Business development', nation: 'USA', color: '#64748b',
    note: 'Authenticated, and authorised for exactly one thing.',
  },
]

/** How a person is named in any audit event. The competing prime has no account here, so the system has no name for them. */
export const auditName = (p) => (p?.id === 'gcap-ryan' || p?.id === 'gmail' ? 'Unknown user' : p?.name)

export const PERSONA_BY_ID = Object.fromEntries(PERSONAS.map(p => [p.id, p]))

/** The persona the compromise act is about. */
export const COMPROMISED_ID = 'gcap-owen'

// ── Documents ────────────────────────────────────────────────────────────────
// `link` is what gets forwarded in an email; it is opaque on purpose, because a readable link would
// put the file's name on screen before anyone has been asked whether they may know it exists.
// A document with `tiers` is one tree item that serves the most privileged tier the caller can open.

export const FOLDERS = ['Programme', 'Design', 'Company IP', 'Supply chain', 'Funding', 'Sovereign', 'Export and NATO', 'Operations']

export const DOCUMENTS = [
  {
    id: 'overview', folder: 'Programme', title: 'GCAP Programme Overview', link: 'ace://obj/4f1a9c', custodian: 'gigo',
    policy: [],
    text: `GLOBAL COMBAT AIR PROGRAMME — OVERVIEW

The United Kingdom, Italy and Japan are jointly developing a sixth-generation combat aircraft. The programme is funded through the GCAP International Government Organisation (GIGO) and delivered by Edgewing, the design authority, with BAE Systems, Leonardo and Mitsubishi Heavy Industries building to its design.

Target: in-service entry in the mid-2030s.
Workshare is agreed by the three governments and administered by GIGO.

This overview is approved for release to any authenticated ACE user.`,
  },
  {
    id: 'governance', folder: 'Programme', title: 'GIGO Governance and Workshare Summary', link: 'ace://obj/b27e03', custodian: 'gigo',
    policy: [P, ...GCAP, supplytier('partner')],
    text: `GIGO GOVERNANCE AND WORKSHARE SUMMARY

Decision rights
  - Requirements changes: three-nation agreement, chaired by GIGO.
  - Design baseline changes: Edgewing proposes, GIGO approves.
  - National data releases: the originating nation alone.

Workshare (illustrative, pending next baseline review)
  - Airframe: shared across all three partners.
  - Propulsion: lead partner with an integration partner.
  - Sensors and integration: lead partner per nation, reviewed annually.

Programme partners only.`,
  },
  {
    id: 'icd', folder: 'Design', title: 'Common Interface Control Document', link: 'ace://obj/e8d415', custodian: 'gigo',
    tiers: [
      {
        id: 'full', label: 'Full release',
        policy: [S, ...GCAP, workpackage('integration')],
        text: `COMMON INTERFACE CONTROL DOCUMENT — FULL RELEASE

1. Mission-system bus: dual-redundant, 2 x 10 Gb/s, deterministic latency budget 120 microseconds.
2. Power: 270 V DC primary, three independent generation channels; load-shed order defined in Annex C.
3. Thermal: avionics bay coolant loop 20 L/min at 35 C inlet; sensor fairing loop 6 L/min at 20 C.
4. Structural: hard-point loads and the airframe mounting pattern (Annex D, full tolerances).
5. Software: partition schedule and the security-domain crossing rules (Annex F).

This release carries the design rationale behind every interface value. Integration work package only.`,
      },
      {
        id: 'extract', label: 'Supplier extract',
        policy: [P, ...GCAP, supplytier('partner'), supplytier('tier2')],
        text: `COMMON INTERFACE CONTROL DOCUMENT — SUPPLIER EXTRACT

Dimensions, interface types, connector classes and tolerances a supplier needs in order to make a part that fits.

1. Mounting pattern and envelope: see Annex D, values only.
2. Connector classes and pin allocation by zone.
3. Permitted material and finish classes.

Design rationale, load cases and the partition schedule are not part of this release.`,
      },
    ],
  },
  {
    id: 'engine', folder: 'Company IP', title: 'MHI Engine Thermal Test Report', link: 'ace://obj/0c6b72', custodian: 'gigo',
    policy: [S, ...GCAP, workpackage('propulsion'), company('mhi')],
    text: `ENGINE THERMAL TEST REPORT — PROPULSION WORK PACKAGE

Rig campaign 4, hot-section soak at 110 percent design speed for 50 cycles.
  - Turbine entry temperature margin held at 42 K against the 2027 baseline.
  - Two combustor liner hot spots observed at the 30 degree position; redesign of the liner cooling pattern under review.
  - No change to the certified operating envelope.

Recommendation: proceed to campaign 5 with the revised liner. Mitsubishi Heavy Industries intellectual property; propulsion work package only.`,
  },
  {
    id: 'sensors', folder: 'Company IP', title: 'BAE Sensor Fusion Design Specification', link: 'ace://obj/93af58', custodian: 'gigo',
    policy: [S, ...GCAP, workpackage('sensors'), company('bae')],
    text: `SENSOR FUSION DESIGN SPECIFICATION — SENSORS WORK PACKAGE

Architecture: distributed track-level fusion with per-sensor confidence weighting.
  - Track update rate: 20 Hz fused, sensors contribute asynchronously.
  - Conflict resolution: highest-confidence source wins unless the operator has pinned a track.
  - Degraded mode: fusion continues on any single remaining sensor with reduced confidence bounds.

Open item: time-alignment error budget between the two apertures. BAE Systems intellectual property; sensors work package only.`,
  },
  {
    id: 'bae-aperture', folder: 'Company IP', title: 'BAE Radar Aperture Calibration Method', link: 'ace://obj/3c9d82', custodian: 'gigo',
    policy: [S, ...GCAP, company('bae')],
    text: `RADAR APERTURE CALIBRATION METHOD — BAE SYSTEMS

Fictional content for demonstration.

Procedure for calibrating the phase and gain of each transmit-receive module across the array, and the correction table format the fusion software consumes.
  - Calibration interval: every 40 flight hours, or after any thermal excursion above the module limit.
  - Residual phase error held under the per-module budget; modules outside it are masked, not repaired in the field.

BAE Systems intellectual property. Not released to the other partner companies.`,
  },
  {
    id: 'mhi-coating', folder: 'Company IP', title: 'MHI Hot-Section Coating Process', link: 'ace://obj/a1f670', custodian: 'gigo',
    policy: [S, ...GCAP, company('mhi')],
    text: `HOT-SECTION COATING PROCESS — MITSUBISHI HEAVY INDUSTRIES

Fictional content for demonstration.

Deposition sequence, bond-coat chemistry class and cure schedule for the turbine hot-section thermal barrier.
  - Surface preparation and masking order for the blade root.
  - Cure schedule and the inspection points between coats.

Mitsubishi Heavy Industries intellectual property. Not released to the other partner companies.`,
  },
  {
    id: 'leo-mission', folder: 'Company IP', title: 'Leonardo Mission Computer Software Architecture', link: 'ace://obj/5e08b4', custodian: 'gigo',
    policy: [P, ...GCAP, company('leonardo')],
    text: `MISSION COMPUTER SOFTWARE ARCHITECTURE — LEONARDO

Fictional content for demonstration.

Partitioning of the mission computer into isolated processing domains, the scheduling model and the update path for each partition.
  - Domain boundaries and the message schema between them.
  - Build and signing flow for field-loadable software.

Leonardo intellectual property. Not released to the other partner companies.`,
  },
  {
    id: 'leo-ew', folder: 'Company IP', title: 'Leonardo Defensive Aids Integration Notes', link: 'ace://obj/d7a315', custodian: 'gigo',
    policy: [P, ...GCAP, company('leonardo')],
    text: `DEFENSIVE AIDS INTEGRATION NOTES — LEONARDO

Fictional content for demonstration.

How the defensive-aids suite is mounted, cooled and tied into the aircraft's power and data buses, and the bench-test results behind each choice.
  - Mounting zones and cooling allocation.
  - Bench-test summary by configuration.

Leonardo intellectual property. Not released to the other partner companies.`,
  },
  {
    id: 'workorder', folder: 'Supply chain', title: 'Tier-3 Machined Part Work Order', link: 'ace://obj/5d20e1', custodian: 'gigo',
    policy: [P, ...GCAP, workpackage('airframe'), supplytier('partner'), supplytier('tier2'), supplytier('tier3')],
    text: `WORK ORDER WO-7741 — MACHINED BRACKET, AIRFRAME ZONE 3

Quantity: 240
Material: aluminium alloy, finish class B
Tolerance: +/- 0.05 mm on the mounting faces
Delivery: to the Tier-2 assembler by the end of the quarter

Drawing reference: see the supplier extract of the interface control document. Airframe work package.`,
  },
  {
    id: 'bom', folder: 'Supply chain', title: 'Bill of Materials and Supplier Register', link: 'ace://obj/a7f9c4', custodian: 'gigo',
    policy: [S, ...GCAP, supplytier('partner')],
    text: `BILL OF MATERIALS AND SUPPLIER REGISTER

Lists every supplier by tier and the parts each one supplies.

  Airframe        Tier 1: three partners        Tier 2: 41 suppliers     Tier 3: 160+ machine shops
  Propulsion      Tier 1: two partners          Tier 2: 28 suppliers     Tier 3: 90+ machine shops
  Sensors         Tier 1: three partners        Tier 2: 35 suppliers     Tier 3: 70+ machine shops
  Integration     Tier 1: three partners        Tier 2: 19 suppliers     Tier 3: 40+ machine shops

Knowing who supplies what, at every tier, is a targeting list. Programme partners only.`,
  },
  {
    id: 'funding', folder: 'Funding', title: 'Funding Drawdown Schedule', link: 'ace://obj/c3b801', custodian: 'gigo',
    policy: [P, ...GCAP, role('finance')],
    text: `FUNDING DRAWDOWN SCHEDULE — EDGEWING

Milestone payments drawn against the governments' agreed budget, released through GIGO.

  Milestone 7   design baseline freeze       drawdown approved
  Milestone 8   ground-test readiness        drawdown pending
  Milestone 9   first-article delivery       scheduled

Workshare percentages and unit costs are commercially sensitive. Finance role only.`,
  },
  {
    id: 'uk-ew', folder: 'Sovereign', title: 'UK Sovereign EW Threat Library', link: 'ace://obj/7be3d9', custodian: 'gbr',
    policy: [T, nationality('gbr'), workpackage('sensors')],
    text: `UK SOVEREIGN ELECTRONIC WARFARE THREAT LIBRARY — EXTRACT

Fictional content for demonstration.

Emitter classes 1 through 6, with the UK national assessment of each class and the response priority assigned to it. The library is maintained by the UK alone and is not shared with the programme partners, who receive only the derived requirements that reach the interface control document.

Originating nation only.`,
  },
  {
    id: 'jp-range', folder: 'Sovereign', title: 'Japan Test Range and Telemetry Plan', link: 'ace://obj/16c4aa', custodian: 'jpn',
    policy: [S, nationality('jpn'), workpackage('propulsion')],
    text: `JAPAN TEST RANGE AND TELEMETRY PLAN — EXTRACT

Fictional content for demonstration.

Range schedule for propulsion flight test, telemetry band allocation, and the recovery plan for instrumented articles. Held by Japan alone; partner nations are told the test window and the result, not the plan.

Originating nation only.`,
  },
  {
    id: 'it-avionics', folder: 'Sovereign', title: 'Italian Avionics Integration Plan', link: 'ace://obj/d049f6', custodian: 'ita',
    policy: [S, nationality('ita'), workpackage('integration')],
    text: `ITALIAN AVIONICS INTEGRATION PLAN — EXTRACT

Fictional content for demonstration.

Integration sequence for the national avionics suite, laboratory schedule, and the national test-asset allocation. Held by Italy alone.

Originating nation only.`,
  },
  {
    id: 'export', folder: 'Export and NATO', title: 'Third-Country Export Assessment', link: 'ace://obj/2e8b35', custodian: 'gigo',
    policy: [P, ...GCAP, role('export')],
    text: `THIRD-COUNTRY EXPORT ASSESSMENT

Whether, and under what conditions, the aircraft could be offered to a third country.

  - Screening criteria agreed by the three governments.
  - Release conditions by sub-system; sovereign sub-systems excluded from any offer.
  - Decision authority: unanimous.

Export role only — authority here is not a matter of rank.`,
  },
  {
    id: 'nato-paper', folder: 'Export and NATO', title: 'NATO Interoperability Paper', link: 'ace://obj/f5a2b0', custodian: 'nato',
    policy: [S, ...NATO],
    text: `NATO INTEROPERABILITY PAPER

How the aircraft's data links and mission systems interoperate with allied forces.

Releasable to NATO member nations. The roster is the list of member nations — nobody holds an entitlement called NATO; a person qualifies by being from one of them. Japan is a GCAP partner and is not a NATO member, so this paper is not releasable to a Japanese holder of the same clearance.`,
  },
  {
    id: 'custody-log', folder: 'Operations', title: 'ACE Access and Key-Custody Log', link: 'ace://obj/8a1d7e', custodian: 'ace',
    policy: [U, role('admin'), role('security')],
    text: `ACE ACCESS AND KEY-CUSTODY LOG

The operational record of who touched what and which custodian released each key. Metadata only: no document content is held here.

  - 09:02  key released by the UK custodian
  - 09:05  key refused by the Japanese custodian (nationality)
  - 09:11  key released by GIGO joint custody

Operations and programme-security roles only.`,
  },
]

/** The policy vocabulary, for other GCAP files that write policies of their own (the SCM rows). */
export const POLICY_KIT = { U, P, S, T, GCAP, nationality, workpackage, supplytier, role, company }

export const DOC_BY_ID = Object.fromEntries(DOCUMENTS.map(d => [d.id, d]))
export const DOC_BY_LINK = Object.fromEntries(DOCUMENTS.map(d => [d.link, d]))

/**
 * One row per encrypted object. A tiered document is several, ordered most privileged first so a
 * caller is served the fullest release they can open.
 */
export const UNITS = DOCUMENTS.flatMap(doc =>
  doc.tiers
    ? doc.tiers.map(t => ({ key: `${doc.id}:${t.id}`, doc, tier: t, policy: t.policy, text: t.text }))
    : [{ key: doc.id, doc, tier: null, policy: doc.policy, text: doc.text }],
)

export const unitsOf = (doc) => UNITS.filter(u => u.doc.id === doc.id)
