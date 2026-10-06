import { compile } from './engine/afsim.js';
import { PRESETS, presetScript } from './engine/scenarios.js';
import { SRC } from './engine/modelsrc.js';
import { evaluate, describe, maxLevel, union, policyKey } from './policy.js';
import { sealJson, openJson, ask, look } from './vault.js';
import { RUNNER } from './data.js';
import { dec, why } from './ui.js';

const P = (level, wp = [], comp = []) => ({ level, wp, comp, team: true });

const sitesOf = (id) => compile(presetScript(PRESETS.find((p) => p.id === id)), (p) => SRC[p]).sites;
const SA = sitesOf('scn_02');
const AD = sitesOf('scn_03');

const emitterRows = [
  ...SA.map((s) => ({ site: s.name, network: 'SA_NET_REGIONAL', type: s.type, lat: +s.lat.toFixed(3), lon: +s.lon.toFixed(3), acq_km: s.acqRef, fc_km: s.fcRef, scan_s: s.scan, missiles: s.missiles, _pol: P('S', ['threat']) })),
  ...AD.map((s) => ({ site: s.name, network: 'IADS_ADVANCED', type: s.type, lat: +s.lat.toFixed(3), lon: +s.lon.toFixed(3), acq_km: s.acqRef, fc_km: s.fcRef, scan_s: s.scan, missiles: s.missiles, _pol: P('TS', ['threat']) })),
];

export const SOURCES = {
  registry: {
    id: 'registry', engine: 'PostgreSQL 16', db: 'component_registry', table: 'parts', owner: 'Program office',
    desc: 'Part master. Row = part; the owning work package gates the sensitive columns.',
    cols: [
      { n: 'part_id', pol: P('U') }, { n: 'name', pol: P('U') }, { n: 'owner', pol: P('U') },
      { n: 'rev', pol: P('U') }, { n: 'mass_kg', pol: P('CUI') },
      { n: 'rcs_band', pol: P('S', ['airframe']) }, { n: 'thrust_class', pol: P('CUI', ['propulsion']) }, { n: 'ir_class', pol: P('S', ['propulsion']) },
      { n: 'jam_class', pol: P('S', ['missionsys']) },
    ],
    rows: [
      { part_id: 'AF-100', name: 'SABLE forward fuselage', owner: 'Meridian', rev: '3.2', mass_kg: 1840, rcs_band: 'VLO-A', thrust_class: null, ir_class: null, jam_class: null },
      { part_id: 'AF-210', name: 'SABLE inlet / diverter', owner: 'Meridian', rev: '3.2', mass_kg: 412, rcs_band: 'VLO-B', thrust_class: null, ir_class: null, jam_class: null },
      { part_id: 'PR-900', name: 'FX-9 adaptive-cycle core', owner: 'Corvane', rev: '2.7', mass_kg: 1620, rcs_band: null, thrust_class: '27k-class', ir_class: 'low-A', jam_class: null },
      { part_id: 'PR-915', name: 'FX-9 exhaust nozzle', owner: 'Corvane', rev: '2.7', mass_kg: 288, rcs_band: null, thrust_class: null, ir_class: 'low-B', jam_class: null },
      { part_id: 'MS-410', name: 'Halden integrated EW suite', owner: 'Halden', rev: '4.1', mass_kg: 164, rcs_band: null, thrust_class: null, ir_class: null, jam_class: 'tier-2' },
    ].map((r) => ({ ...r, _pol: P('U') })),
  },
  threats: {
    id: 'threats', engine: 'SQLite (enclave volume)', db: 'threat_library', table: 'emitters', owner: 'SABLE JPO',
    desc: 'Government threat laydowns. Row policy follows the network; a contractor can execute against it but never SELECT.',
    cols: [
      { n: 'site', pol: P('S', ['threat']) }, { n: 'network', pol: P('S', ['threat']) }, { n: 'type', pol: P('S', ['threat']) },
      { n: 'lat', pol: P('TS', ['threat']) }, { n: 'lon', pol: P('TS', ['threat']) },
      { n: 'acq_km', pol: P('S', ['threat']) }, { n: 'fc_km', pol: P('S', ['threat']) },
      { n: 'scan_s', pol: P('S', ['threat']) }, { n: 'missiles', pol: P('S', ['threat']) },
    ],
    rows: emitterRows,
  },
  flight: {
    id: 'flight', engine: 'TimescaleDB', db: 'flight_test', table: 'telemetry', owner: 'Meridian + Corvane',
    desc: 'Instrumented test-range data. Measured RCS and thrust are owner-gated; raw time series are not shared across companies.',
    cols: [
      { n: 'test_id', pol: P('U') }, { n: 'article', pol: P('U') }, { n: 'mach', pol: P('CUI') }, { n: 'alt_m', pol: P('CUI') },
      { n: 'rcs_dbsm', pol: P('S', ['airframe']) }, { n: 'thrust_pct', pol: P('CUI', ['propulsion']) },
    ],
    rows: [
      ['FT-0412', 'SABLE-A1', 0.80, 6000, -31.8, 92], ['FT-0413', 'SABLE-A1', 0.90, 3000, -32.4, 88],
      ['FT-0421', 'SABLE-A1', 1.05, 300, -29.9, 96], ['FT-0433', 'SABLE-A2', 0.80, 6000, -33.1, 91],
    ].map(([test_id, article, mach, alt_m, rcs_dbsm, thrust_pct]) => ({ test_id, article, mach, alt_m, rcs_dbsm, thrust_pct, _pol: P('CUI') })),
  },
};

export const QUERIES = [
  { id: 'q1', title: 'Part master', src: ['registry'], cols: ['registry.part_id', 'registry.name', 'registry.owner', 'registry.mass_kg', 'registry.rcs_band', 'registry.thrust_class', 'registry.ir_class', 'registry.jam_class'], note: 'One table, mixed-owner columns. Each column carries its own policy.' },
  { id: 'q2', title: 'Threat emitters', src: ['threats'], cols: ['threats.site', 'threats.network', 'threats.type', 'threats.lat', 'threats.lon', 'threats.fc_km'], note: 'Government-only. Row policy by network: the advanced IADS rows need TS.' },
  { id: 'q3', title: 'Flight-test telemetry', src: ['flight'], cols: ['flight.test_id', 'flight.article', 'flight.mach', 'flight.alt_m', 'flight.rcs_dbsm', 'flight.thrust_pct'], note: 'Measured RCS belongs to the airframe; thrust belongs to propulsion.' },
  { id: 'q4', title: 'Federated: which emitters see which test articles?', src: ['flight', 'threats'], federated: true, cols: ['flight.article', 'flight.rcs_dbsm', 'threats.site', 'threats.network', 'threats.fc_km'], note: 'A join of airframe RCS and threat fire-control range yields a derived detection range per emitter. No single source is sensitive enough to warn you. The PEP computes the join output policy and refuses it.' },
];

const colDef = (ref) => { const [s, c] = ref.split('.'); return { src: SOURCES[s], col: SOURCES[s].cols.find((x) => x.n === c), ref }; };

// Policy of a federated result = conjunction of every input column + every contributing row class.
export function joinPolicy(q) {
  let level = 'U'; let wp = []; const comp = [];
  for (const ref of q.cols) {
    const { col } = colDef(ref);
    level = maxLevel(level, col.pol.level); wp = union(wp, col.pol.wp);
  }
  const touchesAdv = q.src.includes('threats');
  if (touchesAdv) { level = maxLevel(level, 'TS'); comp.push('KESTREL'); }
  return { level, wp, comp, team: true };
}

const fmt = (v) => (v == null ? 'NULL' : typeof v === 'number' ? v : `'${v}'`);

function rewrite(q, redacted, hiddenRows, src) {
  const sel = q.cols.filter((r) => r.startsWith(src.id + '.')).map((r) => {
    const c = r.split('.')[1];
    const red = redacted.find((x) => x.ref === r);
    return red ? { text: `NULL AS ${c}`, red: red.why } : { text: c };
  });
  const orig = `SELECT ${q.cols.filter((r) => r.startsWith(src.id + '.')).map((r) => r.split('.')[1]).join(', ')}\n  FROM ${src.db}.${src.table};`;
  const pepd = `SELECT ${sel.map((s) => (s.red ? `${s.text} /* ${s.red} */` : s.text)).join(',\n       ')}\n  FROM ${src.db}.${src.table}\n WHERE pep_row_ok(_policy, :subject)${hiddenRows ? `  /* ${hiddenRows} row(s) filtered */` : ''};`;
  return { orig, pepd };
}


// ── Sealing ──────────────────────────────────────────────────────────────────
// A cell is sealed under the stricter of its column's policy and its row's, so the group a value
// lives in is exactly the policy needed to read it. The PEP's row filter and column NULLs are
// decisions; the values themselves only ever arrive through a decrypt of these groups.

export const effPol = (col, row) => ({
  level: maxLevel(col.level || 'U', row.level || 'U'),
  wp: union(col.wp || [], row.wp || []),
  comp: union(col.comp || [], row.comp || []),
  team: true,
});

const groups = new Map();
const joins = new Map();
const gkey = (sid, pol) => `${sid}|${policyKey(pol)}`;

export async function sealDb(onProgress) {
  const plan = new Map();
  for (const s of Object.values(SOURCES)) {
    s.rows.forEach((row, ri) => {
      for (const c of s.cols) {
        const v = row[c.n];
        if (v == null) continue;
        const pol = effPol(c.pol, row._pol);
        const k = gkey(s.id, pol);
        if (!plan.has(k)) plan.set(k, { sid: s.id, pol, cells: [] });
        plan.get(k).cells.push([ri, c.n, v]);
      }
    });
  }
  const list = [...plan.entries()];
  for (let i = 0; i < list.length; i++) {
    const [k, g] = list[i];
    onProgress?.({ done: i, total: list.length + 1, label: `${SOURCES[g.sid].db} · ${describe(g.pol)}` });
    if (!groups.has(k)) groups.set(k, await sealJson({ cells: g.cells }, g.pol));
  }
  onProgress?.({ done: list.length, total: list.length + 1, label: 'federated join (computed in the enclave)' });
  for (const q of QUERIES.filter((x) => x.federated)) if (!joins.has(q.id)) joins.set(q.id, await sealJoin(q));
}

async function tableAs(sid, kasId) {
  const s = SOURCES[sid];
  const rows = s.rows.map(() => ({}));
  for (const [k, sealed] of groups) {
    if (!k.startsWith(sid + '|')) continue;
    const r = await openJson(sealed, kasId);
    if (!r.ok) throw new Error(`${kasId} could not open ${k}: ${r.reason}`);
    for (const [ri, c, v] of r.data.cells) rows[ri][c] = v;
  }
  return rows;
}

const JOIN_COLS = ['article', 'rcs_dbsm', 'site', 'network', 'fc_km', 'derived_fc_range_km'];

async function sealJoin(q) {
  const [ft, th] = await Promise.all([tableAs('flight', RUNNER), tableAs('threats', RUNNER)]);
  const rows = [];
  for (const a of ft) for (const e of th) {
    const d = e.fc_km * Math.pow(Math.pow(10, a.rcs_dbsm / 10) / 5, 0.25);
    rows.push({ article: a.article, rcs_dbsm: a.rcs_dbsm, site: e.site, network: e.network, fc_km: e.fc_km, derived_fc_range_km: +d.toFixed(1) });
  }
  return sealJson({ cols: JOIN_COLS, rows }, joinPolicy(q));
}

// ── Querying ─────────────────────────────────────────────────────────────────

export const groupKeysFor = (sid, pol) => gkey(sid, pol);
export const joinSealed = (qid) => joins.get(qid);

const openGroup = (kasId, k) => look(`g|${kasId}|${k}`, () => openJson(groups.get(k), kasId), null);

export function runQuery(persona, q) {
  const out = { q, persona, per: [], refused: null, rows: null, cols: null, opened: [] };
  for (const sid of q.src) {
    const src = SOURCES[sid];
    const wanted = q.cols.filter((r) => r.startsWith(sid + '.'));
    const redacted = [];
    for (const r of wanted) {
      const pol = colDef(r).col.pol;
      const d = dec(persona, pol);
      if (!d.ok) redacted.push({ ref: r, why: `redacted: needs ${describe(pol)}` });
    }
    const visible = src.rows.map((row, ri) => ({ row, ri })).filter(({ row }) => dec(persona, row._pol).ok);
    const sql = rewrite(q, redacted, src.rows.length - visible.length, src);
    out.per.push({ src, wanted, redacted, visible: visible.map((v) => v.row), hidden: src.rows.length - visible.length, sql, _vis: visible });
  }
  if (q.federated) {
    const need = joinPolicy(q);
    out.derived = need;
    const d = dec(persona, need);
    if (!d.ok) {
      out.refused = `Join refused. Output policy is ${describe(need)}; subject lacks ${why(persona, need, d).join(', ')}.`;
      return out;
    }
    const key = `j|${persona.kas}|${q.id}`;
    const r = look(key, () => openJson(joins.get(q.id), persona.kas), null);
    if (!r) { out.cols = JOIN_COLS; out.rows = []; return out; }
    if (!r.ok) { out.refused = `Join output was sealed under ${describe(need)} and the key server refused it: ${r.reason}`; return out; }
    out.cols = r.data.cols;
    out.rows = r.data.rows;
    out.opened.push(key);
    return out;
  }
  const p = out.per[0];
  out.cols = p.wanted.map((r) => r.split('.')[1]);
  const vals = new Map();
  for (const { row, ri } of p._vis) {
    for (const c of out.cols) {
      if (p.redacted.some((x) => x.ref === p.src.id + '.' + c)) continue;
      const col = p.src.cols.find((x) => x.n === c);
      const k = gkey(p.src.id, effPol(col.pol, row._pol));
      if (!groups.has(k)) continue;
      const g = openGroup(persona.kas, k);
      if (g?.ok) { for (const [gi, gc, v] of g.data.cells) vals.set(gi + '|' + gc, v); }
      else if (g && !g.ok) vals.set(ri + '|' + c, '⊘');
      if (!out.opened.includes(`g|${persona.kas}|${k}`)) out.opened.push(`g|${persona.kas}|${k}`);
    }
  }
  out.rows = p._vis.map(({ row, ri }) => Object.fromEntries(out.cols.map((c) => [c, p.redacted.some((x) => x.ref === p.src.id + '.' + c) ? '███' : (vals.get(ri + '|' + c) ?? null)])));
  return out;
}

export { fmt };
