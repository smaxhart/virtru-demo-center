import { DEFAULT_PLATFORM } from './modelsrc.js';

// Each slot option = the include lines it contributes.
export const SLOTS = {
  airframe: {
    label: 'Airframe (RCS)',
    options: {
      generic: { label: 'Generic 4th-gen (GFI)', owner: 'JPO', inc: ['reference-models/generic_rcs.txt'] },
      sable: { label: 'SABLE airframe rev 3.2', owner: 'Meridian', inc: ['airframe-models/models/sable_rcs_signature.txt'] },
    },
  },
  engine: {
    label: 'Propulsion',
    options: {
      generic: { label: 'Generic turbofan (GFI)', owner: 'JPO', inc: ['reference-models/generic_performance.txt', 'reference-models/generic_ir_signature.txt'] },
      fx9_perf: { label: 'FX-9 performance only (CUI)', owner: 'Corvane', inc: ['propulsion-models/models/fx9_performance.txt', 'reference-models/generic_ir_signature.txt'] },
      fx9_full: { label: 'FX-9 full, with IR signature', owner: 'Corvane', inc: ['propulsion-models/models/fx9_performance.txt', 'propulsion-models/models/fx9_ir_signature.txt'] },
    },
  },
  ew: {
    label: 'Mission systems / EW',
    options: {
      generic: { label: 'Generic self-protect (GFI)', owner: 'JPO', inc: ['reference-models/generic_ew.txt'] },
      halden: { label: 'Halden integrated EW rev 4.1', owner: 'Halden', inc: ['mission-systems/models/ew_suite.txt'] },
    },
  },
  threat: {
    label: 'Threat environment',
    options: {
      generic: { label: 'Generic IADS (GFI)', owner: 'JPO', inc: ['reference-models/generic_iads.txt'] },
      sa_net: { label: 'Regional SAM network', owner: 'JPO', inc: ['threat-library/threat/sa_net_regional.txt'] },
      iads_adv: { label: 'Advanced IADS', owner: 'JPO', inc: ['threat-library/threat/iads_advanced.txt'] },
    },
  },
};

export const SLOT_ORDER = ['airframe', 'engine', 'ew', 'threat'];

export function buildScript({ name, description, choice, seed = 4242, reps = 200, platform = DEFAULT_PLATFORM }) {
  const inc = SLOT_ORDER.flatMap((s) => SLOTS[s].options[choice[s]].inc.map((p) => `include_once ${p}`));
  return `# ${name}.txt
${inc.join('\n')}

scenario ${name.toUpperCase()}
   description "${description}"
   seed ${seed}
   replications ${reps}
   end_time 2400 sec
   step 2 sec
end_scenario

${platform}
`;
}

export function choiceFromScript(text) {
  const choice = {};
  for (const s of SLOT_ORDER) {
    choice[s] = null;
    for (const [k, o] of Object.entries(SLOTS[s].options)) {
      if (o.inc.every((p) => text.includes(p)) && (choice[s] === null || o.inc.length > SLOTS[s].options[choice[s]].inc.length)) choice[s] = k;
    }
  }
  return choice;
}

export const PRESETS = [
  {
    id: 'scn_01',
    file: 'scenarios/scn_01_airframe_only.txt',
    name: 'airframe_only',
    description: 'Meridian airframe against generic IADS, GFI engine and EW',
    choice: { airframe: 'sable', engine: 'generic', ew: 'generic', threat: 'generic' },
  },
  {
    id: 'scn_02',
    file: 'scenarios/scn_02_ingress_integrated.txt',
    name: 'ingress_integrated',
    description: 'Integrated strike ingress against the regional SAM network',
    choice: { airframe: 'sable', engine: 'fx9_full', ew: 'halden', threat: 'sa_net' },
  },
  {
    id: 'scn_03',
    file: 'scenarios/scn_03_deep_strike_iads.txt',
    name: 'deep_strike_iads',
    description: 'Integrated deep strike against the advanced IADS',
    choice: { airframe: 'sable', engine: 'fx9_full', ew: 'halden', threat: 'iads_adv' },
  },
  {
    id: 'scn_04',
    file: 'scenarios/scn_04_engine_cui.txt',
    name: 'engine_cui',
    description: 'FX-9 performance (CUI) on a generic airframe and threat',
    choice: { airframe: 'generic', engine: 'fx9_perf', ew: 'generic', threat: 'generic' },
  },
];

export const presetScript = (p) => buildScript({ name: p.name, description: p.description, choice: p.choice });
