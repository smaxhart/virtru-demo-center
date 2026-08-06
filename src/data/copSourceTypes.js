const NS = 'https://demo.com/attr'

// Classification levels (mapped to platform's clearance attribute)
export const CLASSIFICATIONS = [
  { id: 'topsecret',   label: 'TOP SECRET',   banner: 'TOP SECRET',   color: '#ef4444', stroke: '#b91c1c', bg: '#fee2e2', text: '#991b1b', fqn: `${NS}/clearance/value/ts-sci` },
  { id: 'secret',      label: 'SECRET',        banner: 'SECRET',       color: '#f59e0b', stroke: '#b45309', bg: '#fef3c7', text: '#92400e', fqn: `${NS}/clearance/value/secret` },
  { id: 'confidential',label: 'CONFIDENTIAL',  banner: 'CONFIDENTIAL', color: '#3b82f6', stroke: '#1d4ed8', bg: '#dbeafe', text: '#1e40af', fqn: `${NS}/clearance/value/cui` },
  { id: 'unclassified',label: 'UNCLASSIFIED',  banner: 'UNCLASSIFIED', color: '#22c55e', stroke: '#15803d', bg: '#dcfce7', text: '#14532d', fqn: `${NS}/clearance/value/unclassified` },
]

// NeedToKnow compartments (mapped to platform's mission attribute)
export const NEEDTOKNOW_OPTIONS = [
  { id: 'int', label: 'INT', fqn: `${NS}/mission/value/intel` },
  { id: 'ops', label: 'OPS', fqn: `${NS}/mission/value/ops`  },
]

// RelTo coalition groups (mapped to platform's relto attribute)
export const RELTO_OPTIONS = [
  { id: 'fvey', label: 'FVEY', fqn: `${NS}/relto/value/fvey` },
  { id: 'nato', label: 'NATO', fqn: `${NS}/relto/value/nato` },
]

export function getClassification(id) { return CLASSIFICATIONS.find(c => c.id === id) ?? CLASSIFICATIONS[3] }
export function getNeedToKnow(id)     { return NEEDTOKNOW_OPTIONS.find(n => n.id === id) }
export function getRelTo(id)          { return RELTO_OPTIONS.find(r => r.id === id) }

// Build full FQN list for encryption / access check
export function buildFqns(classId, needToKnowIds = [], relToIds = []) {
  const cls = getClassification(classId)
  return [
    cls.fqn,
    ...needToKnowIds.map(id => getNeedToKnow(id)?.fqn).filter(Boolean),
    ...relToIds.map(id => getRelTo(id)?.fqn).filter(Boolean),
  ]
}

// Build display banner string e.g. "SECRET // INT // REL TO FVEY"
export function buildBanner(classId, needToKnowIds = [], relToIds = []) {
  const cls = getClassification(classId)
  const parts = [cls.banner]
  if (needToKnowIds.length > 0)
    parts.push(needToKnowIds.map(id => getNeedToKnow(id)?.label ?? id).join('/'))
  if (relToIds.length > 0)
    parts.push('REL TO ' + relToIds.map(id => getRelTo(id)?.label ?? id).join(', '))
  return parts.join(' // ')
}

// Clearance hierarchy expansion for access check
function expandAttrs(attrs) {
  const s = new Set(attrs)
  if (s.has('clearance:ts-sci')) { s.add('clearance:secret'); s.add('clearance:cui'); s.add('clearance:unclassified') }
  if (s.has('clearance:secret')) { s.add('clearance:cui'); s.add('clearance:unclassified') }
  if (s.has('clearance:cui'))    s.add('clearance:unclassified')
  return s
}

// Can persona access an object encrypted with the given FQNs?
export function canAccessFqns(requiredFqns, persona) {
  const expanded = expandAttrs(persona.attributes ?? [])
  return requiredFqns.every(fqn => {
    const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
    const short = m ? `${m[1]}:${m[2]}` : fqn
    return expanded.has(short)
  })
}

export function missingFqns(requiredFqns, persona) {
  const expanded = expandAttrs(persona.attributes ?? [])
  return requiredFqns.filter(fqn => {
    const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
    const short = m ? `${m[1]}:${m[2]}` : fqn
    return !expanded.has(short)
  })
}

// Source type definitions — schema drives the create form
// attrFields lists which attribute dimensions are configurable per type
export const SOURCE_TYPES = [
  {
    id: 'vehicles',
    label: 'AIRCRAFT',
    fullLabel: 'Aircraft Track',
    icon: '✈️',
    description: 'Aircraft position report with telemetry',
    defaultClassification: 'secret',
    attrFields: ['attrClassification', 'attrNeedToKnow', 'attrRelTo'],
    fields: [
      { name: 'vehicleName',   label: 'Aircraft Name',  type: 'text',   required: true,  placeholder: 'e.g. F-35A Lightning II' },
      { name: 'callsign',      label: 'Callsign',        type: 'text',   required: false, placeholder: 'e.g. EAGLE 21' },
      { name: 'origin',        label: 'Origin',          type: 'text',   required: false, placeholder: 'e.g. RAF Lakenheath, UK' },
      { name: 'destination',   label: 'Destination',     type: 'text',   required: false, placeholder: 'e.g. Andrews AFB, USA' },
      { name: 'aircraft_type', label: 'Aircraft Type',   type: 'select', required: false, options: ['F-35A', 'F-35B', 'F-22', 'F-15E', 'B-52H', 'B-2A', 'C-17', 'KC-135', 'P-8A', 'MQ-9', 'RC-135', 'E-3 AWACS', 'Other'] },
      { name: 'speed',         label: 'Speed (kts)',     type: 'text',   required: false, placeholder: 'e.g. 480' },
      { name: 'altitude',      label: 'Altitude (ft)',   type: 'text',   required: false, placeholder: 'e.g. 35000' },
      { name: 'heading',       label: 'Heading (°)',     type: 'text',   required: false, placeholder: 'e.g. 270' },
    ],
  },
  {
    id: 'sitrep',
    label: 'SITREP',
    fullLabel: 'Situation Report',
    icon: '📋',
    description: 'Operational situation report',
    defaultClassification: 'secret',
    attrFields: ['attrClassification', 'attrNeedToKnow', 'attrRelTo'],
    fields: [
      { name: 'reportType',        label: 'Report Type',        type: 'select', required: true,  options: ['REGULAR', 'INCIDENT', 'SAR', 'CONSOLIDATED'] },
      { name: 'entryDate',         label: 'Entry Date',         type: 'text',   required: false, placeholder: 'YYYY-MM-DD' },
      { name: 'reporter',          label: 'Reporter',           type: 'text',   required: false, placeholder: 'e.g. Maj. Sarah Williams' },
      { name: 'missionName',       label: 'Mission Name',       type: 'text',   required: false, placeholder: 'e.g. OPERATION ATLANTIC RESOLVE' },
      { name: 'reportSignificance',label: 'Significance (1–5)', type: 'select', required: false, options: ['1', '2', '3', '4', '5'] },
      { name: 'fromLocation',      label: 'From Location',      type: 'text',   required: false, placeholder: 'e.g. Norfolk, VA' },
      { name: 'aboutLocation',     label: 'About Location',     type: 'textarea', required: false, placeholder: 'e.g. North Atlantic, 38°N 65°W' },
    ],
  },
  {
    id: 'employee',
    label: 'EMPLOYEE',
    fullLabel: 'Personnel Record',
    icon: '👤',
    description: 'Classified personnel record',
    defaultClassification: 'confidential',
    attrFields: ['attrClassification'],
    fields: [
      { name: 'name',          label: 'Full Name',       type: 'text', required: true,  placeholder: 'e.g. James Mitchell' },
      { name: 'favoriteColor', label: 'Favorite Color',  type: 'text', required: false, placeholder: 'e.g. Navy Blue' },
      { name: 'placeOfBirth',  label: 'Place of Birth',  type: 'text', required: false, placeholder: 'e.g. Richmond, Virginia' },
    ],
  },
  {
    id: 'ground_vehicle',
    label: 'GROUND',
    fullLabel: 'Ground Vehicle',
    icon: '🚗',
    description: 'Ground vehicle position and status',
    defaultClassification: 'secret',
    attrFields: ['attrClassification', 'attrNeedToKnow', 'attrRelTo'],
    fields: [
      { name: 'vehicleName',   label: 'Vehicle Name',   type: 'text',   required: true,  placeholder: 'e.g. M1A2 Abrams' },
      { name: 'callsign',      label: 'Callsign',        type: 'text',   required: false, placeholder: 'e.g. IRON 01' },
      { name: 'unit',          label: 'Unit',            type: 'text',   required: false, placeholder: 'e.g. 2nd Armored Brigade' },
      { name: 'vehicle_type',  label: 'Vehicle Type',    type: 'select', required: false, options: ['M1A2 Abrams', 'M2 Bradley', 'Stryker', 'LMTV', 'JLTV', 'Humvee', 'Other'] },
      { name: 'status',        label: 'Status',          type: 'select', required: false, options: ['Operational', 'En Route', 'At Position', 'Maintenance', 'Standby'] },
      { name: 'grid',          label: 'Grid Reference',  type: 'text',   required: false, placeholder: 'e.g. 18S UJ 23456 78901' },
    ],
  },
  {
    id: 'base',
    label: 'BASE',
    fullLabel: 'Military Installation',
    icon: '🏛️',
    description: 'Fixed military installation or command post',
    defaultClassification: 'confidential',
    attrFields: ['attrClassification', 'attrNeedToKnow', 'attrRelTo'],
    fields: [
      { name: 'name',          label: 'Installation',   type: 'text',   required: true,  placeholder: 'e.g. Naval Station Norfolk' },
      { name: 'commander',     label: 'Commander',       type: 'text',   required: false, placeholder: 'e.g. RADM John Smith' },
      { name: 'unit',          label: 'Assigned Unit',   type: 'text',   required: false, placeholder: 'e.g. COMNAVLANT' },
      { name: 'status',        label: 'Status',          type: 'select', required: false, options: ['Active', 'Elevated Alert', 'Stand-Down', 'Exercise', 'Degraded'] },
      { name: 'mission_type',  label: 'Mission Type',    type: 'select', required: false, options: ['Naval', 'Air Force', 'Army', 'Joint', 'Intelligence', 'Logistics', 'Command'] },
    ],
  },
]

export function getSourceType(id) { return SOURCE_TYPES.find(s => s.id === id) ?? SOURCE_TYPES[0] }

// Simulation constants
export const SIM_BOUNDS    = { minLat: 25, maxLat: 47, minLng: -86, maxLng: -60 }
export const SIM_TICK_MS   = 2000
export const SIM_SPEED_MULT = 10

// Seed objects — North Atlantic flight corridors (lat 25–45°N, lng –85 to –65°W)
// Access patterns:
//   UNCLASSIFIED:                all personas
//   SECRET + FVEY:               sarah, james, marcus, patricia, fvey-uk
//   SECRET + NATO:               sarah, james, marcus, patricia, fvey-uk, nato-fr, nato-de
//   TOP SECRET + INT + FVEY:     sarah only
//   SECRET + INT + FVEY:         sarah only (james/fvey-uk lack mission:intel)
//   CONFIDENTIAL + NATO:         all secret+ cleared personas with nato relto
//   CONFIDENTIAL:                all secret+ cleared personas
export const SEED_OBJECTS = [
  {
    id: 'seed-1',
    srcTypeId: 'vehicles',
    lat: 37.5, lng: -74.0,
    classification: 'unclassified',
    needToKnow: [],
    relTo: [],
    speed: 450, heading: 65,
    title: 'ATLAS 01 — C-17 Globemaster III',
    payload: JSON.stringify({
      vehicleName: 'C-17 Globemaster III',
      callsign: 'ATLAS 01',
      origin: 'Dover AFB, USA',
      destination: 'RAF Mildenhall, UK',
      aircraft_type: 'C-17',
      speed: '450',
      altitude: '31000',
      heading: '065',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-2',
    srcTypeId: 'vehicles',
    lat: 35.2, lng: -70.8,
    classification: 'secret',
    needToKnow: [],
    relTo: ['nato'],
    speed: 470, heading: 55,
    title: 'TRIDENT 07 — P-8A Poseidon',
    payload: JSON.stringify({
      vehicleName: 'P-8A Poseidon',
      callsign: 'TRIDENT 07',
      origin: 'NAS Jacksonville, USA',
      destination: 'NAS Sigonella, Italy',
      aircraft_type: 'P-8A',
      speed: '470',
      altitude: '25000',
      heading: '055',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-3',
    srcTypeId: 'vehicles',
    lat: 38.5, lng: -71.2,
    classification: 'secret',
    needToKnow: [],
    relTo: ['fvey'],
    speed: 520, heading: 280,
    title: 'EAGLE 21 — F-35A Lightning II',
    payload: JSON.stringify({
      vehicleName: 'F-35A Lightning II',
      callsign: 'EAGLE 21',
      origin: 'RAF Lakenheath, UK',
      destination: 'Andrews AFB, USA',
      aircraft_type: 'F-35A',
      speed: '520',
      altitude: '35000',
      heading: '280',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-4',
    srcTypeId: 'vehicles',
    lat: 42.1, lng: -68.4,
    classification: 'topsecret',
    needToKnow: ['int'],
    relTo: ['fvey'],
    speed: 240, heading: 190,
    title: 'SHADOW 11 — MQ-9 Reaper ISR',
    payload: JSON.stringify({
      vehicleName: 'MQ-9 Reaper',
      callsign: 'SHADOW 11',
      origin: 'Classified',
      destination: 'Classified',
      aircraft_type: 'MQ-9',
      speed: '240',
      altitude: '45000',
      heading: '190',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-5',
    srcTypeId: 'vehicles',
    lat: 38.2, lng: -67.5,
    classification: 'secret',
    needToKnow: ['int'],
    relTo: ['fvey'],
    speed: 510, heading: 60,
    title: 'BISON 03 — B-52H Stratofortress',
    payload: JSON.stringify({
      vehicleName: 'B-52H Stratofortress',
      callsign: 'BISON 03',
      origin: 'Barksdale AFB, USA',
      destination: 'RAF Fairford, UK',
      aircraft_type: 'B-52H',
      speed: '510',
      altitude: '40000',
      heading: '060',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-6',
    srcTypeId: 'vehicles',
    lat: 44.3, lng: -66.1,
    classification: 'topsecret',
    needToKnow: ['int'],
    relTo: ['fvey'],
    speed: 465, heading: 255,
    title: 'COBRA 05 — RC-135V Rivet Joint',
    payload: JSON.stringify({
      vehicleName: 'RC-135V Rivet Joint',
      callsign: 'COBRA 05',
      origin: 'RAF Mildenhall, UK',
      destination: 'Offutt AFB, USA',
      aircraft_type: 'RC-135',
      speed: '465',
      altitude: '37000',
      heading: '275',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-7',
    srcTypeId: 'sitrep',
    lat: 28.4, lng: -76.2,
    classification: 'confidential',
    needToKnow: [],
    relTo: ['nato'],
    title: 'SITREP — North Atlantic ASW Patrol',
    payload: JSON.stringify({
      reportType: 'REGULAR',
      entryDate: '2026-07-31',
      reporter: 'COMNAVLANT J3',
      missionName: 'OPERATION ATLANTIC RESOLVE',
      reportSignificance: '3',
      fromLocation: 'Norfolk, VA',
      aboutLocation: 'North Atlantic, 28°N 76°W',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-8',
    srcTypeId: 'employee',
    lat: 39.0, lng: -76.8,
    classification: 'confidential',
    needToKnow: [],
    relTo: [],
    title: 'Personnel Record — J. Mitchell',
    payload: JSON.stringify({
      name: 'James Mitchell',
      favoriteColor: 'Navy Blue',
      placeOfBirth: 'Richmond, Virginia, USA',
    }),
    encryptAsPersona: 'james',
  },
  // Ground vehicles — slow-moving, spread across Eastern Seaboard / Atlantic coast
  {
    id: 'seed-9',
    srcTypeId: 'ground_vehicle',
    lat: 36.9, lng: -76.3,
    classification: 'unclassified',
    needToKnow: [],
    relTo: [],
    speed: 35, heading: 10,
    title: 'IRON 01 — M1A2 Abrams',
    payload: JSON.stringify({
      vehicleName: 'M1A2 Abrams',
      callsign: 'IRON 01',
      unit: '2nd Armored Brigade, 1st Infantry Division',
      vehicle_type: 'M1A2 Abrams',
      status: 'En Route',
      grid: '18S UJ 34500 12800',
    }),
    encryptAsPersona: 'james',
  },
  {
    id: 'seed-10',
    srcTypeId: 'ground_vehicle',
    lat: 34.1, lng: -77.9,
    classification: 'secret',
    needToKnow: [],
    relTo: ['nato'],
    speed: 55, heading: 340,
    title: 'STRIKER 04 — Stryker ICV',
    payload: JSON.stringify({
      vehicleName: 'Stryker ICV',
      callsign: 'STRIKER 04',
      unit: '3rd Infantry Division, FORSCOM',
      vehicle_type: 'Stryker',
      status: 'Operational',
      grid: '17S QJ 92400 55300',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-11',
    srcTypeId: 'ground_vehicle',
    lat: 31.8, lng: -81.2,
    classification: 'secret',
    needToKnow: ['ops'],
    relTo: ['fvey'],
    speed: 45, heading: 25,
    title: 'GHOST 09 — JLTV SOCOM',
    payload: JSON.stringify({
      vehicleName: 'JLTV',
      callsign: 'GHOST 09',
      unit: 'USSOCOM TF-Black',
      vehicle_type: 'JLTV',
      status: 'En Route',
      grid: '17S MJ 44100 28700',
    }),
    encryptAsPersona: 'sarah',
  },
  // Bases — fixed, varied classification tiers
  {
    id: 'seed-12',
    srcTypeId: 'base',
    lat: 36.94, lng: -76.29,
    classification: 'unclassified',
    needToKnow: [],
    relTo: [],
    title: 'Naval Station Norfolk',
    payload: JSON.stringify({
      name: 'Naval Station Norfolk',
      commander: 'RADM Patricia Kelley',
      unit: 'COMNAVLANT',
      status: 'Active',
      mission_type: 'Naval',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-13',
    srcTypeId: 'base',
    lat: 35.14, lng: -79.00,
    classification: 'confidential',
    needToKnow: [],
    relTo: ['nato'],
    title: 'Fort Liberty — XVIII Airborne Corps',
    payload: JSON.stringify({
      name: 'Fort Liberty (formerly Fort Bragg)',
      commander: 'LTG Michael Torres',
      unit: 'XVIII Airborne Corps',
      status: 'Elevated Alert',
      mission_type: 'Army',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-14',
    srcTypeId: 'base',
    lat: 38.72, lng: -76.76,
    classification: 'secret',
    needToKnow: ['int'],
    relTo: ['fvey'],
    title: 'NSA Fort Meade — SIGINT HQ',
    payload: JSON.stringify({
      name: 'NSA / CSS Fort Meade',
      commander: 'LTG Sarah Chen',
      unit: 'NSA / Cyber Command',
      status: 'Active',
      mission_type: 'Intelligence',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-15',
    srcTypeId: 'base',
    lat: 41.38, lng: -72.09,
    classification: 'topsecret',
    needToKnow: ['int'],
    relTo: ['fvey'],
    title: 'Groton Sub Base — COMSUBLANT',
    payload: JSON.stringify({
      name: 'Naval Submarine Base New London',
      commander: 'RADM James Whitfield',
      unit: 'COMSUBLANT',
      status: 'Active',
      mission_type: 'Naval',
    }),
    encryptAsPersona: 'sarah',
  },
]
