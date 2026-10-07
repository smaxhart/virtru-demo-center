import { SRC } from './engine/modelsrc.js';
import { PRESETS, presetScript } from './engine/scenarios.js';

export const PERSONAS = [
  { id: 'dana', name: 'Dana Whitfield', title: 'Airframe engineer', org: 'Meridian Aerostructures', kind: 'contractor', clearance: 'S', wps: ['airframe'], comps: [], team: true },
  { id: 'raj', name: 'Raj Patel', title: 'Propulsion engineer', org: 'Corvane Propulsion', kind: 'contractor', clearance: 'S', wps: ['propulsion'], comps: [], team: true },
  { id: 'elena', name: 'Elena Marsh', title: 'EW / mission systems engineer', org: 'Halden Electronic Systems', kind: 'contractor', clearance: 'S', wps: ['missionsys'], comps: [], team: true },
  { id: 'tyler', name: 'Tyler Brandt', title: 'Build & software engineer', org: 'Corvane Propulsion', kind: 'contractor', clearance: 'CUI', wps: ['propulsion'], comps: [], team: true },
  { id: 'okafor', name: 'Maj. Chris Okafor', title: 'Program-office test engineer', org: 'SABLE JPO', kind: 'gov', clearance: 'S', wps: ['airframe', 'propulsion', 'missionsys'], comps: [], team: true },
  { id: 'vasquez', name: 'Dr. Lena Vasquez', title: 'Threat analyst (red team)', org: 'SABLE JPO', kind: 'gov', clearance: 'TS', wps: ['threat'], comps: [], team: true },
  { id: 'hale', name: 'Col. Marcus Hale', title: 'Test authority', org: 'SABLE JPO', kind: 'gov', clearance: 'TS', wps: ['airframe', 'propulsion', 'missionsys', 'threat'], comps: ['KESTREL'], team: true },
];

PERSONAS.forEach((p) => { p.kas = `sable-${p.id}`; });
export const personaById = Object.fromEntries(PERSONAS.map((p) => [p.id, p]));
export const RUNNER = 'sable-runner';

export const REPOS = [
  { id: 'airframe-models', owner: 'Meridian Aerostructures', wp: 'airframe', desc: 'SABLE airframe signature and geometry models' },
  { id: 'propulsion-models', owner: 'Corvane Propulsion', wp: 'propulsion', desc: 'FX-9 engine performance and IR signature models' },
  { id: 'mission-systems', owner: 'Halden Electronic Systems', wp: 'missionsys', desc: 'Integrated EW suite and self-protect models' },
  { id: 'threat-library', owner: 'SABLE JPO', wp: 'threat', desc: 'Government threat laydowns and emitter data' },
  { id: 'reference-models', owner: 'SABLE JPO', wp: null, desc: 'Unclassified GFI surrogate models for all teams' },
  { id: 'scenarios', owner: 'Shared', wp: null, desc: 'Integration scenarios and the AFSIM pipeline definition' },
];

const R = (level, wp = [], comp = []) => ({ level, wp, comp, team: true });

const PLAIN = {
  'airframe-models/README.md': ['# airframe-models\n\nMeridian Aerostructures. SABLE airframe signature tables.\n\nModels are consumed by the shared AFSIM pipeline. Do not copy signature tables\nout of this repository; request a run instead.\n', R('U')],
  'airframe-models/tools/build_tables.py': ['#!/usr/bin/env python3\n# Regenerates models/sable_rcs_signature.txt from the measurement archive.\nimport csv, sys\n\ndef main(src, dst):\n    rows = list(csv.DictReader(open(src)))\n    with open(dst, "w") as out:\n        out.write("radar_signature SABLE_RCS\\n")\n        for r in rows:\n            out.write(f"   aspect {r[\'az\']} {r[\'dbsm\']} dbsm\\n")\n        out.write("end_radar_signature\\n")\n\nif __name__ == "__main__":\n    main(*sys.argv[1:3])\n', R('CUI', ['airframe'])],
  'airframe-models/docs/coating_notes.md': ['# Coating & edge treatment notes\n\n(Rev 3.2 change log, aperture treatment, seam tolerances.)\n\nSYNTHETIC CONTENT -- placeholder for a restricted engineering document.\n', R('S', ['airframe'])],
  'propulsion-models/README.md': ['# propulsion-models\n\nCorvane Propulsion. FX-9 adaptive-cycle engine models.\n', R('U')],
  'propulsion-models/tools/thrust_table_gen.py': ['#!/usr/bin/env python3\n# Builds thrust/lapse tables for the FX-9 performance model.\nimport numpy as np\n\ndef lapse(mach, alt_m):\n    return 1.0 - 0.18 * mach - 0.00002 * alt_m\n', R('CUI', ['propulsion'])],
  'propulsion-models/data/thrust_lapse.csv': ['mach,alt_m,lapse\n0.6,300,0.886\n0.9,300,0.832\n1.15,300,0.787\n', R('CUI', ['propulsion'])],
  'mission-systems/README.md': ['# mission-systems\n\nHalden Electronic Systems. Integrated EW suite.\n', R('U')],
  'mission-systems/docs/jammer_techniques.md': ['# Jammer technique library\n\nSYNTHETIC CONTENT -- placeholder for restricted EW technique descriptions.\n', R('S', ['missionsys'])],
  'mission-systems/data/jammer_effectiveness.csv': ['technique,band,j_s_db\nnoise,X,18\ndeception,X,24\n', R('S', ['missionsys'])],
  'threat-library/README.md': ['# threat-library\n\nSABLE JPO. Government-held threat laydowns. Contractors may execute against\nthese via the pipeline but cannot read them.\n', R('U')],
  'threat-library/data/emitter_parameters.csv': ['emitter,band,prf_hz,scan_s\nAD_LR,VHF,320,3\nAD_MR,S,1800,2\n', R('TS', ['threat'])],
  'reference-models/README.md': ['# reference-models\n\nUnclassified GFI surrogate models. Every team may read and execute these.\n', R('U')],
  'scenarios/README.md': ['# scenarios\n\nShared integration scenarios. A scenario names models by path; it never contains\nmodel data. Access to a scenario file does not confer access to the models it names.\n', R('CUI')],
  'scenarios/.gitlab-ci.yml': ['stages: [validate, resolve, run, seal]\n\nvalidate:\n  stage: validate\n  script: [afsim-check "$SCENARIO"]\n\nresolve:\n  stage: resolve\n  script: [pep-resolve --submitter "$GITLAB_USER_LOGIN" "$SCENARIO"]\n\nrun-afsim:\n  stage: run\n  tags: [enclave-runner]\n  script: [afsim-run "$SCENARIO" --replications auto]\n\nseal-results:\n  stage: seal\n  script: [pep-seal --derive-policy results/]\n  artifacts:\n    paths: [results/]\n', R('CUI')],
};

const SIM = {
  // path -> [slot, read, exec, rev]
  'reference-models/generic_rcs.txt': ['airframe', R('U'), R('U'), '1.0'],
  'reference-models/generic_performance.txt': ['engine', R('U'), R('U'), '1.0'],
  'reference-models/generic_ir_signature.txt': ['engine', R('U'), R('U'), '1.0'],
  'reference-models/generic_ew.txt': ['ew', R('U'), R('U'), '1.0'],
  'reference-models/generic_iads.txt': ['threat', R('U'), R('U'), '1.0'],
  'airframe-models/models/sable_rcs_signature.txt': ['airframe', R('S', ['airframe']), R('S'), '3.2'],
  'propulsion-models/models/fx9_performance.txt': ['engine', R('CUI', ['propulsion']), R('CUI'), '2.7'],
  'propulsion-models/models/fx9_ir_signature.txt': ['engine', R('S', ['propulsion']), R('S'), '2.7'],
  'mission-systems/models/ew_suite.txt': ['ew', R('S', ['missionsys']), R('S'), '4.1'],
  'threat-library/threat/sa_net_regional.txt': ['threat', R('S', ['threat']), R('S'), '11'],
  'threat-library/threat/iads_advanced.txt': ['threat', R('TS', ['threat']), R('TS'), '4'],
};

// Plaintext exists here only to be sealed at start-up (vault.js) and by the simulated databases. Every
// screen reads a file by asking the KAS for it, never from this table.
const SEED_TEXT = {};
export const seedText = (path) => SEED_TEXT[path];

export const FILES = {};
for (const [path, [content, read]] of Object.entries(PLAIN)) {
  FILES[path] = { path, repo: path.split('/')[0], slot: null, read, exec: null, rev: '1' };
  SEED_TEXT[path] = content;
}
for (const [path, [slot, read, exec, rev]] of Object.entries(SIM)) {
  FILES[path] = { path, repo: path.split('/')[0], slot, read, exec, rev };
  SEED_TEXT[path] = SRC[path];
}
for (const p of PRESETS) {
  FILES[p.file] = { path: p.file, repo: 'scenarios', slot: null, read: R('CUI'), exec: null, rev: '1', scenario: p.id };
  SEED_TEXT[p.file] = presetScript(p);
}

export const filesInRepo = (id) => Object.values(FILES).filter((f) => f.repo === id).sort((a, b) => a.path.localeCompare(b.path));
