const NS = 'https://demo.com/attr'

// Classification levels — mapped to platform's clearance attribute
// Labels use civilian emergency/law-enforcement sensitivity tiers
export const CLASSIFICATIONS = [
  { id: 'topsecret',    label: 'RESTRICTED',    banner: 'RESTRICTED',    color: '#ef4444', stroke: '#b91c1c', bg: '#fee2e2', text: '#991b1b', fqn: `${NS}/clearance/value/ts-sci` },
  { id: 'secret',       label: 'SENSITIVE',      banner: 'SENSITIVE',     color: '#f59e0b', stroke: '#b45309', bg: '#fef3c7', text: '#92400e', fqn: `${NS}/clearance/value/secret` },
  { id: 'confidential', label: 'LIMITED',        banner: 'LIMITED',       color: '#3b82f6', stroke: '#1d4ed8', bg: '#dbeafe', text: '#1e40af', fqn: `${NS}/clearance/value/cui` },
  { id: 'unclassified', label: 'OPEN',           banner: 'OPEN',          color: '#22c55e', stroke: '#15803d', bg: '#dcfce7', text: '#14532d', fqn: `${NS}/clearance/value/unclassified` },
]

// Compartments — LEI: Law Enforcement Intelligence; MED: Medical/PHI
export const NEEDTOKNOW_OPTIONS = [
  { id: 'int', label: 'LEI', fqn: `${NS}/mission/value/intel` },
  { id: 'ops', label: 'MED', fqn: `${NS}/mission/value/ops`  },
]

// Partner sharing groups — USA: US-only; FED: federal agencies; MULTI: multi-jurisdiction mutual aid
export const RELTO_OPTIONS = [
  { id: 'usa',  label: 'USA',   fqn: `${NS}/relto/value/usa`  },
  { id: 'fvey', label: 'FED',   fqn: `${NS}/relto/value/fvey` },
  { id: 'nato', label: 'MULTI', fqn: `${NS}/relto/value/nato` },
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

// Build display banner string e.g. "SENSITIVE // LEI // REL TO FED"
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
export const SOURCE_TYPES = [
  {
    id: 'response_unit',
    label: 'AIR UNIT',
    fullLabel: 'Aerial Response Unit',
    icon: '🚁',
    description: 'Airborne response asset with telemetry',
    defaultClassification: 'secret',
    attrFields: ['attrClassification', 'attrNeedToKnow', 'attrRelTo'],
    fields: [
      { name: 'unitName',  label: 'Unit Name',     type: 'text',   required: true,  placeholder: 'e.g. USCG MH-60T Jayhawk' },
      { name: 'callsign',  label: 'Callsign',       type: 'text',   required: false, placeholder: 'e.g. RESCUE 71' },
      { name: 'agency',    label: 'Agency',         type: 'text',   required: false, placeholder: 'e.g. US Coast Guard' },
      { name: 'unit_type', label: 'Unit Type',      type: 'select', required: false, options: ['Rescue Helicopter', 'Medevac Helicopter', 'Surveillance Drone', 'Transport Aircraft', 'Patrol Aircraft', 'Other'] },
      { name: 'status',    label: 'Status',         type: 'select', required: false, options: ['Active', 'En Route', 'On Station', 'RTB', 'Standby'] },
      { name: 'speed',     label: 'Speed (kts)',    type: 'text',   required: false, placeholder: 'e.g. 140' },
      { name: 'altitude',  label: 'Altitude (ft)',  type: 'text',   required: false, placeholder: 'e.g. 2500' },
      { name: 'heading',   label: 'Heading (°)',    type: 'text',   required: false, placeholder: 'e.g. 090' },
    ],
  },
  {
    id: 'incident',
    label: 'INCIDENT',
    fullLabel: 'Incident Report',
    icon: '🚨',
    description: 'Active incident or situation report',
    defaultClassification: 'secret',
    attrFields: ['attrClassification', 'attrNeedToKnow', 'attrRelTo'],
    fields: [
      { name: 'incidentType',  label: 'Incident Type',      type: 'select',   required: true,  options: ['Mass Casualty', 'Flood', 'Structural Collapse', 'Hazmat', 'Search & Rescue', 'Active Threat', 'Civil Unrest'] },
      { name: 'entryDate',     label: 'Date',               type: 'text',     required: false, placeholder: 'YYYY-MM-DD' },
      { name: 'reporter',      label: 'Reporting Agency',   type: 'text',     required: false, placeholder: 'e.g. FEMA Region III' },
      { name: 'incidentName',  label: 'Incident Name',      type: 'text',     required: false, placeholder: 'e.g. OPERATION COASTAL SURGE' },
      { name: 'severity',      label: 'Severity (1–5)',     type: 'select',   required: false, options: ['1', '2', '3', '4', '5'] },
      { name: 'fromLocation',  label: 'Reporting Location', type: 'text',     required: false, placeholder: 'e.g. Baltimore EOC' },
      { name: 'aboutLocation', label: 'Incident Location',  type: 'textarea', required: false, placeholder: 'e.g. I-95 Corridor, MD/VA border' },
    ],
  },
  {
    id: 'patient',
    label: 'PATIENT',
    fullLabel: 'Patient Record',
    icon: '🏥',
    description: 'Protected patient / PHI record',
    defaultClassification: 'confidential',
    attrFields: ['attrClassification'],
    fields: [
      { name: 'name',      label: 'Patient Name',   type: 'text',   required: true,  placeholder: 'e.g. John Doe #47' },
      { name: 'dob',       label: 'Date of Birth',  type: 'text',   required: false, placeholder: 'YYYY-MM-DD' },
      { name: 'condition', label: 'Condition',      type: 'select', required: false, options: ['Critical', 'Serious', 'Stable', 'Discharged', 'Deceased', 'Unknown'] },
      { name: 'unit',      label: 'Treating Unit',  type: 'text',   required: false, placeholder: 'e.g. MED-12 / Johns Hopkins ER' },
    ],
  },
  {
    id: 'ground_unit',
    label: 'GROUND',
    fullLabel: 'Ground Response Unit',
    icon: '🚒',
    description: 'Ground-based response unit position and status',
    defaultClassification: 'secret',
    attrFields: ['attrClassification', 'attrNeedToKnow', 'attrRelTo'],
    fields: [
      { name: 'unitName',  label: 'Unit Name',      type: 'text',   required: true,  placeholder: 'e.g. Engine Company 14' },
      { name: 'callsign',  label: 'Callsign',       type: 'text',   required: false, placeholder: 'e.g. ENGINE 14' },
      { name: 'agency',    label: 'Agency',         type: 'text',   required: false, placeholder: 'e.g. Baltimore City Fire' },
      { name: 'unit_type', label: 'Unit Type',      type: 'select', required: false, options: ['Ambulance', 'Fire Engine', 'Ladder Truck', 'Rescue Squad', 'SWAT', 'Tactical Response', 'Mobile Command', 'K-9 Unit', 'EOD', 'Other'] },
      { name: 'status',    label: 'Status',         type: 'select', required: false, options: ['Active', 'En Route', 'On Scene', 'Staging', 'RTB', 'Stand-Down'] },
      { name: 'grid',      label: 'Grid Reference', type: 'text',   required: false, placeholder: 'e.g. 18S UJ 23456 78901' },
    ],
  },
  {
    id: 'facility',
    label: 'FACILITY',
    fullLabel: 'Fixed Facility',
    icon: '🏛️',
    description: 'Fixed installation, EOC, or coordination center',
    defaultClassification: 'confidential',
    attrFields: ['attrClassification', 'attrNeedToKnow', 'attrRelTo'],
    fields: [
      { name: 'name',          label: 'Facility Name',   type: 'text',   required: true,  placeholder: 'e.g. Johns Hopkins Hospital' },
      { name: 'commander',     label: 'Director / IC',   type: 'text',   required: false, placeholder: 'e.g. Incident Commander Smith' },
      { name: 'agency',        label: 'Primary Agency',  type: 'text',   required: false, placeholder: 'e.g. FEMA / HHS / Local' },
      { name: 'status',        label: 'Status',          type: 'select', required: false, options: ['Active', 'Elevated Alert', 'Stand-Down', 'Exercise', 'Surge Capacity', 'Degraded'] },
      { name: 'facility_type', label: 'Facility Type',   type: 'select', required: false, options: ['Hospital', 'EOC', 'Fire Station', 'Police HQ', 'Staging Area', 'Joint Ops Center', 'Federal Command', 'Triage Center'] },
    ],
  },
]

export function getSourceType(id) { return SOURCE_TYPES.find(s => s.id === id) ?? SOURCE_TYPES[0] }

// Simulation constants
export const SIM_BOUNDS    = { minLat: 25, maxLat: 47, minLng: -86, maxLng: -60 }
export const SIM_TICK_MS   = 1000
export const SIM_SPEED_MULT = 50

export const CLIP_CONFIGS = {
  'seed-7':  { src: './cctv/hurricane.mp4', startTime: 0, camId: 'CAM-07', zoom: 1.0, label: 'COASTAL SURGE ZONE',   filter: '' },
  'seed-9':  { src: './cctv/street.mp4',    startTime: 0, camId: 'CAM-09', zoom: 1.0, label: 'INCIDENT PERIMETER',   filter: '' },
  'seed-10': { src: './cctv/tactical.mp4',  startTime: 0, camId: 'CAM-10', zoom: 1.0, label: 'TACTICAL CORRIDOR',    filter: 'grayscale(1)' },
  'seed-11': { src: './cctv/ambulance.mp4', startTime: 0, camId: 'CAM-11', zoom: 1.0, label: 'STAGING AREA',         filter: '' },
  'seed-12': { src: './cctv/eoc.mp4',       startTime: 0, camId: 'CAM-12', zoom: 1.0, label: 'NORFOLK EOC EXTERIOR', filter: '' },
  'seed-13': { src: './cctv/staging.mp4',   startTime: 0, camId: 'CAM-13', zoom: 1.0, label: 'FOB CAMP LIBERTY',     filter: '' },
  'seed-14': { src: './cctv/building.mp4',  startTime: 0, camId: 'CAM-14', zoom: 1.0, label: 'JOC ENTRANCE',         filter: '' },
  'seed-15': { src: './cctv/federal.mp4',   startTime: 0, camId: 'CAM-15', zoom: 1.0, label: 'NCC EXTERIOR',         filter: '' },
}

// Seed objects — multi-agency hurricane/disaster response, Eastern Seaboard
// Access patterns:
//   OPEN:                        all personas
//   SENSITIVE + FED:             sarah, james, and federal-cleared partners
//   SENSITIVE + MULTI:           sarah, james, and mutual-aid partners
//   RESTRICTED + LEI + FED:      sarah only
//   SENSITIVE + LEI + FED:       sarah only (james lacks mission:intel)
//   LIMITED + MULTI:             all SENSITIVE+ cleared personas with MULTI partner access
//   LIMITED:                     all SENSITIVE+ cleared personas
export const SEED_OBJECTS = [
  // Aerial response units — active over Eastern Seaboard
  {
    id: 'seed-1',
    srcTypeId: 'response_unit',
    lat: 42.1, lng: -66.4,
    classification: 'secret',
    needToKnow: [],
    relTo: ['fvey'],
    speed: 130, heading: 280,
    title: 'RESCUE 7102 — USCG MH-60T Jayhawk',
    payload: JSON.stringify({
      unitName: 'USCG MH-60T Jayhawk',
      callsign: 'RESCUE 7102',
      agency: 'US Coast Guard, Sector Boston',
      unit_type: 'Rescue Helicopter',
      status: 'On Station',
      speed: '130',
      altitude: '1500',
      heading: '280',
    }),
    encryptAsPersona: 'james',
  },
  {
    id: 'seed-2',
    srcTypeId: 'response_unit',
    lat: 38.6, lng: -68.2,
    classification: 'secret',
    needToKnow: [],
    relTo: ['fvey'],
    speed: 80, heading: 270,
    title: 'FEMA-7 — Disaster Assessment UAV',
    payload: JSON.stringify({
      unitName: 'General Atomics Predator B',
      callsign: 'FEMA-7',
      agency: 'FEMA Region III',
      unit_type: 'Surveillance Drone',
      status: 'Active',
      speed: '80',
      altitude: '3000',
      heading: '270',
    }),
    encryptAsPersona: 'james',
  },
  {
    id: 'seed-3',
    srcTypeId: 'response_unit',
    lat: 40.3, lng: -70.8,
    classification: 'secret',
    needToKnow: [],
    relTo: ['nato'],
    speed: 140, heading: 270,
    title: 'TROOPER 9 — NJ State Police Helicopter',
    payload: JSON.stringify({
      unitName: 'Bell 407',
      callsign: 'TROOPER 9',
      agency: 'New Jersey State Police Aviation',
      unit_type: 'Patrol Aircraft',
      status: 'Active',
      speed: '140',
      altitude: '2000',
      heading: '270',
      mission_notes: 'Coastal evacuation airspace management. Diverting general aviation from I-95 corridor to inland alternates.',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-4',
    srcTypeId: 'response_unit',
    lat: 35.9, lng: -72.5,
    classification: 'secret',
    needToKnow: ['int'],
    relTo: ['fvey'],
    speed: 180, heading: 180,
    title: 'SHADOW 04 — DHS Surveillance UAV',
    payload: JSON.stringify({
      unitName: 'General Atomics Predator B',
      callsign: 'SHADOW 04',
      agency: 'DHS / CBP Air and Marine Operations',
      unit_type: 'Surveillance Drone',
      status: 'Active',
      speed: '180',
      altitude: '25000',
      heading: '180',
      mission_notes: 'Federal asset protection — critical infrastructure ISR over Groton NCC exclusion zone. Storm-degraded coastal radar; UAV provides persistent overwatch during landfall window.',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-5',
    srcTypeId: 'response_unit',
    lat: 37.2, lng: -75.8,
    classification: 'secret',
    needToKnow: [],
    relTo: ['nato'],
    speed: 155, heading: 190,
    title: 'LIFE FLIGHT 3 — Medevac Helicopter',
    payload: JSON.stringify({
      unitName: 'Sikorsky S-76D',
      callsign: 'LIFE FLIGHT 3',
      agency: 'EVMS Medical Center / Virginia Beach',
      unit_type: 'Medevac Helicopter',
      status: 'En Route',
      speed: '155',
      altitude: '2500',
      heading: '190',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-6',
    srcTypeId: 'response_unit',
    lat: 37.4, lng: -71.5,
    classification: 'topsecret',
    needToKnow: ['int'],
    relTo: ['fvey'],
    speed: 160, heading: 250,
    title: 'REACH 09 — USMC UH-1Y Venom',
    payload: JSON.stringify({
      unitName: 'Bell UH-1Y Venom',
      callsign: 'REACH 09',
      agency: 'USMC HMX-1, Federal Asset Protection Detail',
      unit_type: 'Transport Aircraft',
      status: 'Active',
      speed: '160',
      altitude: '3500',
      heading: '250',
      mission_notes: 'QRF for Groton NCC continuity-of-operations plan. Coordinated with SHADOW 04 overwatch. Alternate LZ: Fort Meade Annex.',
    }),
    encryptAsPersona: 'sarah',
  },
  // Incident report
  {
    id: 'seed-7',
    srcTypeId: 'incident',
    lat: 32.2, lng: -76.8,
    classification: 'confidential',
    needToKnow: [],
    relTo: ['usa', 'nato'],
    title: 'INCIDENT — Hurricane COASTAL SURGE',
    payload: JSON.stringify({
      incidentType: 'Flood',
      entryDate: '2026-08-19',
      reporter: 'FEMA Region IV',
      incidentName: 'OPERATION COASTAL SURGE',
      severity: '4',
      fromLocation: 'Wilmington EOC, NC',
      aboutLocation: 'Hurricane eye 32°N 76°W, tracking NNE at 14 kts. Storm surge warnings active: Cape Lookout NC through Virginia Beach VA. Mandatory evacuation orders issued for 6 coastal counties. Category 4 at landfall, expected within 18 hours.',
    }),
    encryptAsPersona: 'sarah',
  },
  // Patient record (PHI)
  {
    id: 'seed-8',
    srcTypeId: 'patient',
    lat: 39.0, lng: -76.8,
    classification: 'confidential',
    needToKnow: [],
    relTo: ['usa'],
    title: 'Patient Record — Doe, Jane #MCI-047',
    payload: JSON.stringify({
      name: 'Jane Doe #MCI-047',
      dob: '1984-03-15',
      condition: 'Serious',
      unit: 'MED-12 / Johns Hopkins R1 Trauma Center',
    }),
    encryptAsPersona: 'james',
  },
  // Ground units
  {
    id: 'seed-9',
    srcTypeId: 'ground_unit',
    lat: 36.9, lng: -76.3,
    classification: 'unclassified',
    needToKnow: [],
    relTo: ['usa'],
    speed: 35, heading: 10,
    title: 'MED-12 — Mass Casualty Ambulance',
    payload: JSON.stringify({
      unitName: 'Ford F-450 Type I Ambulance',
      callsign: 'MED-12',
      agency: 'Norfolk Fire-Rescue EMS',
      unit_type: 'Ambulance',
      status: 'On Scene',
      grid: '18S UJ 34500 12800',
    }),
    encryptAsPersona: 'james',
  },
  {
    id: 'seed-10',
    srcTypeId: 'ground_unit',
    lat: 34.1, lng: -77.9,
    classification: 'secret',
    needToKnow: [],
    relTo: ['usa', 'nato'],
    speed: 55, heading: 340,
    title: 'TACTICAL-7 — FBI HRT Ground Team',
    payload: JSON.stringify({
      unitName: 'FBI Tactical Vehicle',
      callsign: 'TACTICAL-7',
      agency: 'FBI Hostage Rescue Team',
      unit_type: 'Tactical Response',
      status: 'En Route',
      grid: '17S QJ 92400 55300',
      mission_notes: 'Securing coastal power substation SUB-42 (Wilmington NC) — civil unrest reported at evacuation checkpoint. Mutual-aid coordination with NC Highway Patrol. Not affiliated with humanitarian relief tasking.',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-11',
    srcTypeId: 'ground_unit',
    lat: 31.8, lng: -81.2,
    classification: 'secret',
    needToKnow: [],
    relTo: ['usa', 'nato'],
    speed: 30, heading: 25,
    title: 'MEDCMD-3 — Mobile Medical Command',
    payload: JSON.stringify({
      unitName: 'Mobile Command Unit w/ Triage',
      callsign: 'MEDCMD-3',
      agency: 'FEMA / HHS NDMS',
      unit_type: 'Mobile Command',
      status: 'On Scene',
      grid: '17S MJ 44100 28700',
      mission_notes: 'Forward triage node for Cape Fear evacuation corridor. Coordinating with LIFE FLIGHT 3 and MED-12 for surge overflow patients.',
    }),
    encryptAsPersona: 'sarah',
  },
  // Facilities
  {
    id: 'seed-12',
    srcTypeId: 'facility',
    lat: 36.94, lng: -76.29,
    classification: 'unclassified',
    needToKnow: [],
    relTo: ['usa'],
    title: 'Norfolk Regional Emergency Operations Center',
    payload: JSON.stringify({
      name: 'Norfolk Regional EOC / USCG Sector Norfolk',
      commander: 'Rear Adm. Patricia Kelley, USCG',
      agency: 'US Coast Guard / City of Norfolk',
      status: 'Elevated Alert',
      facility_type: 'EOC',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-13',
    srcTypeId: 'facility',
    lat: 35.14, lng: -79.00,
    classification: 'confidential',
    needToKnow: [],
    relTo: ['usa', 'nato'],
    title: 'FEMA Forward Operating Base — Camp Liberty',
    payload: JSON.stringify({
      name: 'FEMA Forward Operating Base — Camp Liberty',
      commander: 'FEMA Region IV Director Torres',
      agency: 'FEMA / Army National Guard',
      status: 'Active',
      facility_type: 'Staging Area',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-14',
    srcTypeId: 'facility',
    lat: 38.72, lng: -76.76,
    classification: 'secret',
    needToKnow: ['int'],
    relTo: ['usa', 'fvey'],
    title: 'FBI Joint Operations Center — Fort Meade Annex',
    payload: JSON.stringify({
      name: 'FBI Joint Operations Center — Fort Meade Annex',
      commander: 'SAC Sarah Chen, FBI',
      agency: 'FBI / DHS / NSA',
      status: 'Active',
      facility_type: 'Joint Ops Center',
    }),
    encryptAsPersona: 'sarah',
  },
  {
    id: 'seed-15',
    srcTypeId: 'facility',
    lat: 41.38, lng: -72.09,
    classification: 'topsecret',
    needToKnow: ['int'],
    relTo: ['usa', 'fvey'],
    title: 'FEMA National Coordination Center — Groton',
    payload: JSON.stringify({
      name: 'FEMA National Coordination Center',
      commander: 'FEMA Administrator Whitfield',
      agency: 'FEMA / DHS / DoD',
      status: 'Active',
      facility_type: 'Federal Command',
    }),
    encryptAsPersona: 'sarah',
  },
]
