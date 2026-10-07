/**
 * Verifies the SABLE page against a running platform.
 *
 *   node scripts/verify-sable.mjs
 *
 * Needs the app open: the platform (:7777) and the JWT issuer (:7779) live in the Electron main
 * process, and the `sable-` identities only exist once the AI seeder has run at seed version 5.
 *
 * What it proves, in order:
 *   1. Static seams — the page's personas and the issuer's `sable-` identities are the same set,
 *      every policy FQN the page can emit is seeded, no policy is over the 20-value cap.
 *   2. Named cases, written out by hand and NOT derived from policy.js — a check that computed its
 *      own answer could never disagree with it. These include the ALL_OF cases (several work
 *      packages on one definition), which is the semantic the whole demo leans on.
 *   3. Derived layers — the output policy of scn_01, scn_02 and scn_03 and who may open each layer.
 *   4. The mirror — for every distinct policy the page can produce, policy.js `evaluate` (which only
 *      words a refusal on screen) agrees with the KAS for every identity. A disagreement would mean
 *      the screen explains a refusal the KAS did not make.
 *   5. An unauthenticated client is refused.
 */

import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'
import identities from '../electron/ai-identities.js'
import { PERSONAS, FILES, RUNNER } from '../src/sable/data.js'
import { PRESETS, presetScript } from '../src/sable/engine/scenarios.js'
import { deriveLayers, toFqns, evaluate, policyKey } from '../src/sable/policy.js'

const { IDENTITIES, ATTRIBUTE_DEFS, NS } = identities
const PLATFORM_URL = 'http://localhost:7777'
const KAS_URL = `${PLATFORM_URL}/kas`
const ISSUER_URL = 'http://localhost:7779'

const RUNNER_PERSONA = { id: 'runner', kas: RUNNER, clearance: 'TS', wps: ['airframe', 'propulsion', 'missionsys', 'threat'], comps: ['KESTREL'], team: true }
const WHO = [...PERSONAS, RUNNER_PERSONA]
const P = (level, wp = [], comp = []) => ({ level, wp, comp, team: true })

// Hand-written. Keys are persona ids; the runner holds everything and is appended by `expect()`.
const expect = (...ids) => new Set([...ids, 'runner'])

const NAMED = [
  // Models: read.
  ['sable_rcs_signature read',  FILES['airframe-models/models/sable_rcs_signature.txt'].read, expect('dana', 'okafor', 'hale')],
  ['fx9_performance read',      FILES['propulsion-models/models/fx9_performance.txt'].read,   expect('raj', 'tyler', 'okafor', 'hale')],
  ['fx9_ir_signature read',     FILES['propulsion-models/models/fx9_ir_signature.txt'].read,  expect('raj', 'okafor', 'hale')],
  ['ew_suite read',             FILES['mission-systems/models/ew_suite.txt'].read,            expect('elena', 'okafor', 'hale')],
  ['sa_net_regional read',      FILES['threat-library/threat/sa_net_regional.txt'].read,      expect('vasquez', 'hale')],
  ['iads_advanced read',        FILES['threat-library/threat/iads_advanced.txt'].read,        expect('vasquez', 'hale')],
  // Models: execute. Execute-only is the point: these are wider than read.
  ['sable_rcs_signature exec',  FILES['airframe-models/models/sable_rcs_signature.txt'].exec, expect('dana', 'raj', 'elena', 'okafor', 'vasquez', 'hale')],
  ['fx9_performance exec',      FILES['propulsion-models/models/fx9_performance.txt'].exec,   expect('dana', 'raj', 'elena', 'tyler', 'okafor', 'vasquez', 'hale')],
  ['iads_advanced exec',        FILES['threat-library/threat/iads_advanced.txt'].exec,        expect('vasquez', 'hale')],
  // ALL_OF across several values of one definition.
  ['ALL_OF airframe+propulsion',            P('S', ['airframe', 'propulsion']),                 expect('okafor', 'hale')],
  ['ALL_OF all three producers',            P('S', ['airframe', 'propulsion', 'missionsys']),   expect('okafor', 'hale')],
  ['ALL_OF all four work packages + comp',  P('TS', ['airframe', 'propulsion', 'missionsys', 'threat'], ['KESTREL']), expect('hale')],
  ['comp only',                             P('TS', [], ['KESTREL']),                           expect('hale')],
  ['threat only, TS',                       P('TS', ['threat']),                                expect('vasquez', 'hale')],
  // The federated q4 join: TS, airframe + threat, KESTREL.
  ['q4 join',                               P('TS', ['airframe', 'threat'], ['KESTREL']),       expect('hale')],
  // Hierarchy.
  ['CUI, no wp',                            P('CUI'),                                           expect('dana', 'raj', 'elena', 'tyler', 'okafor', 'vasquez', 'hale')],
  ['S, no wp',                              P('S'),                                             expect('dana', 'raj', 'elena', 'okafor', 'vasquez', 'hale')],
]

// Derived layers, hand-written per scenario. L1 is per part.
const parts = { scn_01: [{ slot: 'airframe', wp: 'airframe' }], scn_02: [{ slot: 'airframe', wp: 'airframe' }, { slot: 'engine', wp: 'propulsion' }, { slot: 'ew', wp: 'missionsys' }], scn_03: [{ slot: 'airframe', wp: 'airframe' }, { slot: 'engine', wp: 'propulsion' }, { slot: 'ew', wp: 'missionsys' }] }
const LAYERS = {
  scn_02: {
    L2: expect('okafor', 'hale'),
    L3: expect('vasquez', 'hale'),
    L4: expect('hale'),
    'L1:airframe': expect('dana', 'okafor', 'hale'),
    'L1:engine':   expect('raj', 'okafor', 'hale'),
    'L1:ew':       expect('elena', 'okafor', 'hale'),
  },
  scn_03: {
    L2: expect('hale'),
    L3: expect('vasquez', 'hale'),
    L4: expect('hale'),
  },
  scn_01: {
    L2: expect('dana', 'okafor', 'hale'),
    L4: expect('dana', 'okafor', 'hale'),
    L3: expect('dana', 'raj', 'elena', 'okafor', 'vasquez', 'hale'),
  },
}

// ── Static ───────────────────────────────────────────────────────────────────

function staticChecks(policies) {
  const problems = []
  const seeded = new Set(ATTRIBUTE_DEFS.flatMap(d => d.values.map(v => `${NS}/${d.name}/value/${v}`)))
  const issuerIds = Object.keys(IDENTITIES).filter(id => id.startsWith('sable-')).sort()
  const pageIds = WHO.map(p => p.kas ?? `sable-${p.id}`).sort()
  for (const id of pageIds) if (!issuerIds.includes(id)) problems.push(`page persona ${id} is unknown to the issuer`)
  for (const id of issuerIds) if (!pageIds.includes(id)) problems.push(`issuer identity ${id} is not on the page`)
  for (const [label, pol] of policies) {
    let fqns
    try { fqns = toFqns(pol) } catch (e) { problems.push(`${label}: ${e.message}`); continue }
    for (const f of fqns) if (!seeded.has(f)) problems.push(`${label} names ${f}, which is not seeded`)
    if (fqns.length > 20) problems.push(`${label} carries ${fqns.length} values, over the 20-value cap`)
  }
  return problems
}

// ── Live ─────────────────────────────────────────────────────────────────────

async function token(id) {
  const res = await fetch(`${ISSUER_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: id }),
  })
  if (!res.ok) throw new Error(`token for ${id}: HTTP ${res.status}`)
  return (await res.json()).access_token
}
const client = (t) => new OpenTDF({ interceptors: [authTokenInterceptor(() => t)], platformUrl: PLATFORM_URL, disableDPoP: true })
async function drain(stream) {
  const chunks = []
  const reader = stream.getReader()
  for (;;) { const { done, value } = await reader.read(); if (done) break; chunks.push(value) }
  return Buffer.concat(chunks.map(c => Buffer.from(c)))
}
async function seal(policy, adminToken) {
  const blob = new Blob([new TextEncoder().encode('ok')], { type: 'text/plain' })
  return drain(await client(adminToken).createTDF({
    source: { type: 'stream', location: blob.stream() }, defaultKASEndpoint: KAS_URL, autoconfigure: false,
    attributes: toFqns(policy).map(fqn => ({ attribute: fqn })),
  }))
}
async function canOpen(bytes, accessToken) {
  for (let attempt = 0; ; attempt++) {
    try {
      const out = await client(accessToken).read({ source: { type: 'stream', location: new Blob([bytes]).stream() }, allowedKASEndpoints: [KAS_URL] })
      return { ok: (await drain(out)).toString('utf8') === 'ok' }
    } catch (err) {
      const reason = (err?.message ?? String(err)).split('\n')[0].slice(0, 90)
      // Only a 403 is a decision; anything else is the service dropping a request, so try again.
      if (/403|permission denied/i.test(reason) || attempt >= 4) return { ok: false, reason }
      await new Promise(r => setTimeout(r, 300 * (attempt + 1)))
    }
  }
}

let failures = 0
const check = (label, ok, detail = '') => { if (!ok) failures++; console.log(`  ${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`) }

// ── Collect every policy the page can emit ───────────────────────────────────

const derived = {}
for (const p of PRESETS) {
  const incs = [...presetScript(p).matchAll(/^include(?:_once)?\s+(\S+)/gm)].map(m => m[1])
  derived[p.id] = deriveLayers(incs.map(i => FILES[i]).filter(f => f?.read), parts[p.id] ?? [])
}
const all = new Map()
const add = (label, pol) => { const k = policyKey(pol); if (!all.has(k)) all.set(k, [label, pol]) }
for (const f of Object.values(FILES)) { add(`${f.path} read`, f.read); if (f.exec) add(`${f.path} exec`, f.exec) }
for (const [id, d] of Object.entries(derived)) for (const L of ['L2', 'L3', 'L4']) add(`${id} ${L}`, d.layers[L])
for (const d of Object.values(derived)) for (const [s, pol] of Object.entries(d.layers.L1)) add(`L1 ${s}`, pol)
for (const [label, pol] of NAMED) add(label, pol)

const problems = staticChecks([...all.values()])
if (problems.length) { console.error('Static checks failed:\n'); for (const p of problems) console.error(`  ✗ ${p}`); process.exit(1) }
console.log(`Static checks passed: ${PERSONAS.length} personas + runner, ${all.size} distinct policies, every FQN seeded.\n`)

const health = await fetch(`${PLATFORM_URL}/healthz`).catch(() => null)
if (!health?.ok) { console.error(`No platform on ${PLATFORM_URL}. Start the app first (npm run dev).`); process.exit(1) }

const adminToken = await token('admin')
const tokens = Object.fromEntries(await Promise.all(WHO.map(async p => [p.id, await token(p.kas ?? `sable-${p.id}`)])))

console.log(`Sealing ${all.size} ticket TDFs as admin…`)
const sealed = new Map()
for (const [k, [, pol]] of all) sealed.set(k, await seal(pol, adminToken))

console.log('Deciding (every identity × every policy)…')
const dec = new Map()
const jobs = WHO.flatMap(p => [...all].map(([k]) => async () => dec.set(`${p.id}|${k}`, await canOpen(sealed.get(k), tokens[p.id]))))
await Promise.all(Array.from({ length: 12 }, async () => { for (let j = jobs.shift(); j; j = jobs.shift()) await j() }))
const kasOk = (pid, pol) => dec.get(`${pid}|${policyKey(pol)}`).ok

console.log('\nNamed cases (● granted, · refused):')
for (const [label, pol, want] of NAMED) {
  const got = WHO.filter(p => kasOk(p.id, pol)).map(p => p.id)
  const okk = got.length === want.size && got.every(id => want.has(id))
  console.log(`  ${label.padEnd(40)} ${WHO.map(p => (kasOk(p.id, pol) ? '●' : '·')).join(' ')}`)
  check(`${label}`, okk, `expected [${[...want].join(',')}] got [${got.join(',')}]`)
}
console.log(`  ${''.padEnd(40)} ${WHO.map(p => p.id[0]).join(' ')}   (${WHO.map(p => p.id).join(' ')})`)

console.log('\nDerived layers:')
for (const [sid, layers] of Object.entries(LAYERS)) {
  for (const [L, want] of Object.entries(layers)) {
    const pol = L.startsWith('L1:') ? derived[sid].layers.L1[L.slice(3)] : derived[sid].layers[L]
    const got = WHO.filter(p => kasOk(p.id, pol)).map(p => p.id)
    check(`${sid} ${L}`, got.length === want.size && got.every(id => want.has(id)), `expected [${[...want].join(',')}] got [${got.join(',')}]`)
  }
}
check('scn_02 L4 carries KESTREL (sealed threat data)', derived.scn_02.layers.L4.comp.includes('KESTREL'))
check('scn_01 L4 does not (unclassified threat surrogate)', !derived.scn_01.layers.L4.comp.includes('KESTREL'))

console.log('\nMirror (policy.js vs KAS, every identity × every policy):')
let diverged = 0
for (const [k, [label, pol]] of all) {
  for (const p of WHO) {
    const mirror = evaluate(p, pol).ok
    const kas = dec.get(`${p.id}|${k}`).ok
    if (mirror !== kas) { diverged++; console.log(`    ✗ ${label} as ${p.id}: mirror=${mirror} kas=${kas}`) }
  }
}
check(`no divergence across ${all.size * WHO.length} decisions`, diverged === 0)

console.log('\nUnauthenticated:')
{
  const [k] = [...all]
  const r = await canOpen(sealed.get(k[0]), 'no-credential')
  check('a client with no credential is refused', !r.ok)
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll SABLE checks passed.')
process.exit(failures ? 1 : 0)
