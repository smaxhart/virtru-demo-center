// SABLE policy vocabulary. Nothing in this file DECIDES access: the KAS does, via the TDFs in vault.js.
// `evaluate` only mirrors the rule to explain a refusal ("what was missing"); verify-sable.mjs proves
// the mirror and the KAS never disagree.
// clearance = hierarchy; wp = ALL_OF (every listed work package); comp = ALL_OF; team = membership flag.

export const LEVELS = ['U', 'CUI', 'C', 'S', 'TS'];
export const LEVEL_NAME = { U: 'UNCLASSIFIED', CUI: 'CUI', C: 'CONFIDENTIAL', S: 'SECRET', TS: 'TOP SECRET' };
export const rank = (l) => LEVELS.indexOf(l);
export const maxLevel = (a, b) => (rank(a) >= rank(b) ? a : b);

export const WP_LABEL = {
  airframe: 'airframe',
  propulsion: 'propulsion',
  missionsys: 'mission sys',
  threat: 'threat',
};

// policy: { level, wp: [], comp: [], team: bool }
export function evaluate(person, policy) {
  const missing = [];
  if (policy.team && !person.team) missing.push('team:sable');
  if (rank(person.clearance) < rank(policy.level || 'U')) missing.push(`clearance >= ${policy.level}`);
  for (const w of policy.wp || []) if (!person.wps.includes(w)) missing.push(`wp:${w}`);
  for (const c of policy.comp || []) if (!person.comps.includes(c)) missing.push(`comp:${c}`);
  return { ok: missing.length === 0, missing };
}

const NS = 'https://demo.com/attr';
const LEVEL_VALUE = { U: 'unclassified', CUI: 'cui', S: 'secret', TS: 'ts-sci' };

// The policy as the attribute FQNs a TDF is bound to.
export function toFqns(policy) {
  const level = LEVEL_VALUE[policy.level || 'U'];
  if (!level) throw new Error(`SABLE has no platform clearance for level ${policy.level}`);
  return [
    `${NS}/clearance/value/${level}`,
    ...(policy.wp || []).map((w) => `${NS}/sablewp/value/${w}`),
    ...(policy.comp || []).map((c) => `${NS}/sablecomp/value/${c.toLowerCase()}`),
    ...(policy.team ? [`${NS}/sableteam/value/member`] : []),
  ];
}

export const policyKey = (p) => [p.level || 'U', [...(p.wp || [])].sort().join(','), [...(p.comp || [])].sort().join(','), p.team ? 'T' : '-'].join('|');

export function describe(policy) {
  const parts = [policy.level || 'U'];
  for (const w of policy.wp || []) parts.push(`wp:${w}`);
  for (const c of policy.comp || []) parts.push(c);
  if (policy.team) parts.push('team');
  return parts.join(' + ');
}

export const union = (...lists) => [...new Set(lists.flat())];

// Derive the policy of a run's output layers from the files it consumed.
// Rule: level = max over all inputs; need-to-know (wp) of PRODUCER models ANDs together;
// threat data contributes level + its own wp to the threat-side layers only.
export function deriveLayers(inputs, parts) {
  const inLevel = inputs.reduce((m, f) => maxLevel(m, f.read.level), 'U');
  const producer = inputs.filter((f) => f.slot !== 'threat');
  const threat = inputs.filter((f) => f.slot === 'threat');
  const producerWps = union(...producer.map((f) => f.read.wp || []));
  const threatWps = union(...threat.map((f) => f.read.wp || []));
  const comps = union(...inputs.map((f) => f.read.comp || []));
  const sealedThreat = threat.some((f) => (f.read.wp || []).length > 0);
  const layers = {
    L1: {},
    L2: { level: inLevel, wp: producerWps, comp: comps },
    L3: { level: inLevel, wp: threatWps, comp: [] },
    L4: {
      level: inLevel,
      wp: union(producerWps, threatWps),
      comp: union(comps, sealedThreat ? ['KESTREL'] : []),
    },
  };
  for (const p of parts) layers.L1[p.slot] = { level: inLevel, wp: [p.wp], comp: [] };
  return { inLevel, producerWps, threatWps, comps, layers };
}

export const LAYER_INFO = {
  L0: { name: 'Run receipt', blurb: 'status, timing, model revisions, result hash' },
  L1: { name: 'Per-part contribution', blurb: 'does your part meet its allocation (banded)' },
  L2: { name: 'Composite outcome', blurb: 'survivability and mission success of the whole system' },
  L3: { name: 'Threat-side breakdown', blurb: 'engagements by site, weapons expended' },
  L4: { name: 'Full replay + derived ranges', blurb: 'tracks, detection ranges, signature-derived values' },
};
