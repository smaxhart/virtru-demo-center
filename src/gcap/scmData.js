import { POLICY_KIT } from './data.js'

// The supply-chain system the windows run inside is fictional. Only what Virtru does to the attached
// files is real; these tables are the furniture that makes it feel like a tool someone sits in all day.

export const FIRST_CR = 'CR-4471'

export const CRS = [
  ['CR-4471', 'Revise ICD baseline: mission bus, thermal loops, mounting pattern', 'In review', 'Integration', '14 Nov'],
  ['CR-4468', 'Update connector class B pin allocation', 'Approved', 'Integration', '02 Nov'],
  ['CR-4466', 'Change coolant fitting to SS316', 'In review', 'Propulsion', '21 Nov'],
  ['CR-4462', 'Relax tolerance on fairing bracket hole pattern', 'Draft', 'Airframe', '28 Nov'],
  ['CR-4459', 'Add vibration damper to avionics tray', 'Implemented', 'Sensors', '—'],
  ['CR-4455', 'Supplier change: harness assembly', 'On hold', 'Integration', '—'],
  ['CR-4451', 'Revise paint specification, zone 1', 'Approved', 'Airframe', '09 Nov'],
  ['CR-4447', 'Correct BOM quantity, actuator mount', 'Implemented', 'Airframe', '—'],
]

export const PARTS = [
  ['P-20417', 'Mounting bracket, zone 3, Al 7075', 'C', 'Edgewing Machining', '14 d', '212'],
  ['P-20418', 'Fairing bracket, zone 2', 'B', 'Northgate Precision', '21 d', '96'],
  ['P-31002', 'Connector B-24, circular', 'D', 'Sable Interconnect', '35 d', '1 480'],
  ['P-31007', 'Harness assembly, avionics bay', 'A', 'Tarn Harness Ltd', '42 d', '18'],
  ['P-44210', 'Coolant fitting, SS316', 'B', 'Kestrel Fluid Systems', '28 d', '340'],
  ['P-44215', 'Actuator mount, port', 'C', 'Northgate Precision', '21 d', '61'],
  ['P-51090', 'Avionics tray assembly', 'B', 'Edgewing Machining', '30 d', '27'],
  ['P-51102', 'Vibration damper, type 3', 'A', 'Kestrel Fluid Systems', '16 d', '504'],
]

export const SUPS = [
  ['Edgewing Machining', 'Tier 1', 'United Kingdom', '97%', '6'],
  ['Northgate Precision', 'Tier 2', 'United Kingdom', '93%', '4'],
  ['Sable Interconnect', 'Tier 2', 'Italy', '95%', '3'],
  ['Tarn Harness Ltd', 'Tier 3', 'United Kingdom', '88%', '2'],
  ['Kestrel Fluid Systems', 'Tier 2', 'Japan', '96%', '5'],
  ['Okabe Fasteners', 'Tier 3', 'Japan', '91%', '1'],
]

export const ORDS = [
  ['PO-88213', 'P-20417', 'Mounting bracket, zone 3', '120', '14 Nov', 'In production'],
  ['PO-88220', 'P-31002', 'Connector B-24', '800', '28 Nov', 'Confirmed'],
  ['PO-88231', 'P-44210', 'Coolant fitting, SS316', '200', '05 Dec', 'Confirmed'],
  ['PO-88237', 'P-51102', 'Vibration damper', '300', '19 Nov', 'Shipped'],
  ['PO-88244', 'P-31007', 'Harness assembly', '10', '12 Dec', 'Awaiting drawing'],
  ['PO-88250', 'P-20418', 'Fairing bracket', '60', '22 Nov', 'In production'],
]

export const NAV = [['home', 'Home'], ['crs', 'Changes'], ['parts', 'Parts'], ['sups', 'Suppliers'], ['ords', 'Orders']]

export const SEED_LOG = [
  ['3 days ago', 'Marco Bellandi', 'created the change request', 'sys'],
  ['yesterday', 'Marco Bellandi', 'submitted it for review', 'sys'],
  ['2 h ago', 'GIGO Document Control', 'attached ICD baseline', 'sys'],
]

export const EXTERNAL = { id: 'gmail', name: 'ryan.mercer@rival-prime.example', employer: 'External', title: 'No programme account', nation: '—', color: '#6b7280' }

/** Who owns a change, by work package. */
export const OWNER_BY_PACKAGE = { Integration: 'Marco Bellandi', Airframe: 'Marco Bellandi', Propulsion: 'Kenji Watanabe', Sensors: 'Priya Nair' }

/** What each person is on the change request that opens in every window. */
export const ROLE_ON_CR = {
  'gcap-marco': 'Approver, design authority',
  'gcap-priya': 'Reviewer, sensors interfaces',
  'gcap-kenji': 'Reviewer, propulsion interfaces',
  'gcap-harriet': 'Security reviewer',
  'gcap-oliver': 'Cost reviewer',
  'gcap-giulia': 'Export reviewer',
  'gcap-wren': 'Supplier, bracket machining',
  'gcap-owen': 'Supplier, machining',
  'gcap-sanjay': 'Platform administrator',
  gmail: 'Outside the programme',
}

/** [due, text, change request to link or null]. The text may take the CR id as {0}. */
export const TASKS = {
  'gcap-marco': [['14 Nov', 'Approve {0}', 'CR-4471'], ['28 Nov', 'Review {0}', 'CR-4462']],
  'gcap-priya': [['14 Nov', 'Review {0}', 'CR-4471'], ['21 Nov', 'Review {0}', 'CR-4459']],
  'gcap-kenji': [['14 Nov', 'Review {0}', 'CR-4471'], ['21 Nov', 'Review {0}', 'CR-4466']],
  'gcap-harriet': [['14 Nov', 'Check the release markings on {0}', 'CR-4471']],
  'gcap-oliver': [['30 Nov', 'Reconcile the drawdown for PO-88213', null]],
  'gcap-giulia': [['28 Nov', 'Export check on {0}', 'CR-4455']],
  'gcap-wren': [['14 Nov', 'Confirm PO-88213 delivery date', null]],
  'gcap-owen': [['14 Nov', 'Machine the zone 3 brackets to WO-7741', null]],
  'gcap-sanjay': [['12 Nov', 'Review pending access requests', null]],
}

// ── Who may see a row ────────────────────────────────────────────────────────
// Every row of the four tables is a small encrypted object with a policy of its own, the same way a
// document is. The tables here are the furniture; whether a row is shown is the key server's answer
// (`scmVault.js`), never a list in this file. A row a person may not open is not drawn at all: no
// placeholder, no count of what is missing.
//
// The policies below are the only place this is written down. They use the same attributes as the
// documents: a change request or part follows its work package, the supplier register follows the
// supply tier (it is the same "targeting list" as the bill of materials), and a company's own parts
// and orders follow `company`, the way that company's IP documents do.

const { P, S, GCAP, nationality, workpackage: wp, supplytier: tier, role, company } = POLICY_KIT
const PARTNER = tier('partner'), TIER2 = tier('tier2'), TIER3 = tier('tier3')

const CR_POLICY = {
  'CR-4471': [P, ...GCAP, PARTNER, TIER2],                     // the cross-package review every window opens on
  'CR-4468': [P, ...GCAP, wp('integration'), PARTNER],
  'CR-4466': [P, ...GCAP, wp('propulsion'), PARTNER],
  'CR-4462': [P, ...GCAP, wp('airframe'), PARTNER, TIER2],
  'CR-4459': [P, ...GCAP, wp('sensors'), PARTNER],
  'CR-4455': [P, ...GCAP, role('export'), role('security')],   // a supplier change: export and security eyes only
  'CR-4451': [P, ...GCAP, wp('airframe'), PARTNER, TIER2],
  'CR-4447': [P, ...GCAP, wp('airframe'), PARTNER, TIER2],
}

const PART_POLICY = {
  'P-20417': [P, ...GCAP, wp('airframe'), PARTNER, TIER2, TIER3],
  'P-20418': [P, ...GCAP, wp('airframe'), PARTNER, TIER2, TIER3],
  'P-31002': [P, ...GCAP, wp('integration'), PARTNER, TIER2],
  'P-31007': [P, ...GCAP, company('leonardo')],                // Leonardo IP
  'P-44210': [P, ...GCAP, wp('propulsion'), company('mhi')],   // MHI IP
  'P-44215': [P, ...GCAP, wp('airframe'), PARTNER, TIER2, TIER3],
  'P-51090': [P, ...GCAP, wp('sensors'), company('bae')],      // BAE IP
  'P-51102': [P, ...GCAP, wp('sensors'), PARTNER],
}

/** The register is partners-only at GCAP SECRET; Japan's own suppliers are Japan's to see. */
const SUPPLIER = [S, ...GCAP, PARTNER]
const SUP_POLICY = {
  'Edgewing Machining': SUPPLIER, 'Northgate Precision': SUPPLIER, 'Sable Interconnect': SUPPLIER, 'Tarn Harness Ltd': SUPPLIER,
  'Kestrel Fluid Systems': [S, nationality('jpn'), PARTNER], 'Okabe Fasteners': [S, nationality('jpn'), PARTNER],
}

const ORD_POLICY = {
  'PO-88213': [P, ...GCAP, PARTNER, TIER2, TIER3],
  'PO-88220': [P, ...GCAP, PARTNER, TIER2],
  'PO-88231': [P, ...GCAP, wp('propulsion'), company('mhi')],  // MHI IP
  'PO-88237': [P, ...GCAP, wp('sensors'), PARTNER],
  'PO-88244': [P, ...GCAP, company('leonardo')],               // Leonardo IP
  'PO-88250': [P, ...GCAP, wp('airframe'), PARTNER, TIER2, TIER3],
}

/** One entry per table row, keyed `table:id`. `text` is what actually gets encrypted. */
export const SCM_ROWS = [
  ...CRS.map(r => ({ key: `crs:${r[0]}`, table: 'crs', id: r[0], policy: CR_POLICY[r[0]], text: r.join(' | ') })),
  ...PARTS.map(r => ({ key: `parts:${r[0]}`, table: 'parts', id: r[0], policy: PART_POLICY[r[0]], text: r.join(' | ') })),
  ...SUPS.map(r => ({ key: `sups:${r[0]}`, table: 'sups', id: r[0], policy: SUP_POLICY[r[0]], text: r.join(' | ') })),
  ...ORDS.map(r => ({ key: `ords:${r[0]}`, table: 'ords', id: r[0], policy: ORD_POLICY[r[0]], text: r.join(' | ') })),
]
