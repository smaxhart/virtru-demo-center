import { parse, compile, monteCarlo, replay } from './engine/afsim.js'
import { FILES, personaById, RUNNER } from './data.js'
import { SLOTS, choiceFromScript } from './engine/scenarios.js'
import { evaluate, deriveLayers, describe, LEVEL_NAME } from './policy.js'
import { decide, openFile, sealJson, sha256Hex, ask } from './vault.js'
import { pep, sleep } from './state.js'

export const ALLOCATION = { airframe: 10, engine: 5, ew: 8 }
const SLOT_WP = { airframe: 'airframe', engine: 'propulsion', ew: 'missionsys' }
const SLOT_OWNER = { airframe: 'Meridian', engine: 'Corvane', ew: 'Halden' }
export const STAGES = ['validate', 'resolve', 'run', 'seal']

let seq = 1180

// What only the runner holds: the compiled scenario behind each run. Nothing reads this but ensureReplay,
// which is the enclave re-simulating a replication and sealing it, the way it sealed the first.
const enclave = new Map()

function swapSlot(text, slot, option) {
  const all = new Set(Object.values(SLOTS[slot].options).flatMap((o) => o.inc))
  const lines = text.split('\n').filter((l) => !(l.startsWith('include_once ') && all.has(l.split(/\s+/)[1])))
  const at = lines.map((l) => l.startsWith('include_once ')).lastIndexOf(true)
  lines.splice(at + 1, 0, ...SLOTS[slot].options[option].inc.map((p) => `include_once ${p}`))
  return lines.join('\n')
}

const band = (d) => (d >= 25 ? 'Decisive' : d >= 12 ? 'Significant' : d >= 5 ? 'Moderate' : 'Marginal')

/** The generics the ablation swaps in. Unclassified, so the runner opens them once and keeps them. */
const genericTexts = new Map()
async function genericsAsRunner() {
  for (const p of Object.keys(FILES).filter((x) => FILES[x].repo === 'reference-models')) {
    if (genericTexts.has(p)) continue
    const r = await openFile(RUNNER, p)
    if (r.ok) genericTexts.set(p, r.text)
  }
}

export async function executeRun(persona, script, { label, ablationReps = 60, submittedAt, onUpdate, pace = 0 } = {}) {
  const id = `run-${++seq}`
  const run = {
    id, submitter: persona.id, label: label || 'ad-hoc scenario', submittedAt: submittedAt || new Date(),
    status: 'running', stage: 'validate', reasons: [], log: [], files: [], parts: [],
    derived: null, sealed: null, receipt: null, repIndex: 0, reps: 0, seed: 0,
  }
  const sealedLog = { L2: [], L3: [], L4: [] }
  const tick = () => onUpdate?.(run)
  const L = async (text) => { run.log.push({ min: 'L0', text }); tick(); if (pace) await sleep(pace) }
  const S = (min, text) => { run.log.push({ min, idx: sealedLog[min].length }); sealedLog[min].push(text) }

  await L(`$ pipeline ${id} submitted by ${persona.name.toLowerCase().replace(/[^a-z ]/g, '').replace(/ /g, '.')}`)

  // validate: syntax and names only. Anything that needs a model's contents waits for the enclave.
  const main = parse(script)
  const includes = [...new Set(main.includes)]
  const scn = main.root.children.find((n) => n.kind === 'scenario')
  const errors = [...main.errors, ...includes.filter((p) => !FILES[p]).map((p) => `cannot resolve include ${p}`)]
  if (errors.length) {
    run.status = 'failed'; run.reasons = errors
    for (const e of errors) await L(`[validate] ERROR ${e}`)
    return run
  }
  const reps = Number((scn?.props.find((t) => t[0] === 'replications') || [])[1]) || 100
  await L(`[validate] scenario ${scn?.name || 'UNNAMED'}: ${includes.length} includes, ${reps} replications`)

  // resolve: one KAS decision per model, as the submitter
  run.stage = 'resolve'
  run.files = includes
  const denials = []
  for (const path of includes) {
    const f = FILES[path]
    const ex = f.exec ? await decide(persona.kas, f.exec) : { ok: false, reason: 'not an executable model' }
    if (ex.ok) {
      const rd = await decide(persona.kas, f.read)
      await L(`[resolve] ${path}  execute: PERMIT${rd.ok ? '' : '  (execute-only, contents not readable by submitter)'}`)
      pep(persona.name, 'EXECUTE', path, 'PERMIT', rd.ok ? '' : 'execute-only')
    } else {
      const missing = f.exec ? (evaluate(persona, f.exec).missing.length ? evaluate(persona, f.exec).missing : [ex.reason || 'refused by the KAS']) : ['not an executable model']
      await L(`[resolve] ${path}  execute: DENY  missing ${missing.join(', ')}`)
      pep(persona.name, 'EXECUTE', path, 'DENY', `missing ${missing.join(', ')}`)
      denials.push({ path, missing })
    }
  }
  if (denials.length) {
    run.status = 'rejected'
    run.reasons = denials.map((d) => `cannot execute ${d.path}: ${d.missing.join(', ')}`)
    await L(`[resolve] pipeline aborted -- submitter is not entitled to execute ${denials.length} model(s)`)
    return run
  }

  // run: the enclave decrypts what the submitter was only allowed to execute
  run.stage = 'run'
  await L(`[run] dispatching to enclave-runner-02 (service identity ${RUNNER})`)
  await genericsAsRunner()
  const texts = new Map(genericTexts)
  const refused = []
  for (const path of includes) {
    const r = await openFile(RUNNER, path)
    if (r.ok) texts.set(path, r.text)
    else refused.push(`enclave could not decrypt ${path}: ${r.reason}`)
  }
  if (refused.length) {
    run.status = 'failed'; run.reasons = refused
    for (const e of refused) await L(`[run] ERROR ${e}`)
    pep(RUNNER, 'DECRYPT', `${includes.length} models`, 'DENY', refused[0])
    return run
  }
  pep(RUNNER, 'DECRYPT', `${includes.length} models`, 'PERMIT', 'enclave service identity')
  await L(`[run] runner decrypted ${includes.length} models inside the enclave`)
  await sleep(0)

  const lookup = (p) => texts.get(p)
  const model = compile(script, lookup)
  if (!model.ok) {
    run.status = 'failed'; run.reasons = model.errors
    for (const e of model.errors) await L(`[run] ERROR ${e}`)
    return run
  }
  await L(`[run] ${model.sites.length} threat sites, ${model.params.reps} replications`)
  const t0 = performance.now()
  const mc = monteCarlo(model)
  await L(`[run] ${mc.reps} replications complete in ${((performance.now() - t0) / 1000).toFixed(2)} s`)

  const choice = choiceFromScript(script)
  const full = []
  for (const slot of ['airframe', 'engine', 'ew']) {
    const opt = choice[slot]
    if (!opt || opt === 'generic') continue
    const abl = compile(swapSlot(script, slot, 'generic').replace(/replications\s+\d+/, `replications ${ablationReps}`), lookup)
    if (!abl.ok) continue
    const base = monteCarlo(abl, ablationReps).survivability
    const delta = Math.round((mc.survivability - base) * 100)
    full.push({ slot, wp: SLOT_WP[slot], owner: SLOT_OWNER[slot], option: SLOTS[slot].options[opt].label, delta, band: band(delta), allocation: ALLOCATION[slot], meets: delta >= ALLOCATION[slot] })
  }
  run.parts = full.map(({ slot, wp, owner, option }) => ({ slot, wp, owner, option }))

  // seal: the policy of every output layer is derived from the inputs, then the KAS is the only thing that holds it
  run.stage = 'seal'
  const inputs = model.files.map((p) => FILES[p])
  const derived = deriveLayers(inputs, run.parts)
  run.derived = derived
  run.reps = mc.reps
  run.seed = model.params.seed
  run.repIndex = mc.repSeedIndex

  await L(`[afsim] representative replication #${mc.repSeedIndex + 1} (seed ${model.params.seed + mc.repSeedIndex * 7919})`)
  S('L2', `[afsim] composite survivability ${(mc.survivability * 100).toFixed(1)}%  (95% CI ${(mc.ci[0] * 100).toFixed(0)}-${(mc.ci[1] * 100).toFixed(0)})`)
  S('L3', `[afsim] mean weapons expended ${mc.meanLaunches.toFixed(1)}  engaged in ${(mc.engagedPct * 100).toFixed(0)}% of replications`)
  for (const s of mc.perSite) if (s.medianFcRange != null) S('L4', `[afsim] ${s.site} median fire-control range ${s.medianFcRange.toFixed(1)} km`)
  tick()

  const { L1: p1, L2: p2, L3: p3, L4: p4 } = derived.layers
  const [l1, l2, l3, l4] = await Promise.all([
    Promise.all(full.map((p) => sealJson({ slot: p.slot, owner: p.owner, option: p.option, band: p.band, meets: p.meets, allocation: p.allocation }, p1[p.slot]))),
    sealJson({
      survivability: mc.survivability, ci: mc.ci, detectedPct: mc.detectedPct, engagedPct: mc.engagedPct,
      meanLaunches: mc.meanLaunches, meanExposure: mc.meanExposure, reps: mc.reps, seed: model.params.seed, log: sealedLog.L2,
    }, p2),
    sealJson({ sites: mc.perSite.map((s) => ({ site: s.site, guidance: s.guidance, engagedPct: s.engagedPct, meanLaunches: s.meanLaunches, killPct: s.killPct })), log: sealedLog.L3 }, p3),
    sealJson({ sites: mc.perSite.map((s) => ({ site: s.site, medianFcRange: s.medianFcRange, medianAcqRange: s.medianAcqRange })), log: sealedLog.L4 }, p4),
  ])
  run.sealed = { L1: Object.fromEntries(full.map((p, i) => [p.slot, l1[i]])), L2: l2, L3: l3, L4: l4 }

  const all = [...l1, l2, l3, l4]
  const joined = new Uint8Array(all.reduce((n, s) => n + s.tdfBytes.length, 0))
  let off = 0
  for (const s of all) { joined.set(s.tdfBytes, off); off += s.tdfBytes.length }
  run.receipt = {
    hash: await sha256Hex(joined), bytes: joined.length, reps: mc.reps, seed: model.params.seed,
    models: model.files.map((p) => ({ path: p, rev: FILES[p].rev })),
  }

  enclave.set(id, { model })
  await ensureReplay(run, mc.repSeedIndex)
  pep(RUNNER, 'SEAL', `${id}/L1-L4`, 'SEAL', describe(p2))

  await L(`[seal] derived output policy: ${describe(p2)}`)
  await L(`[seal] layers L1-L4 sealed under their own policies; receipt released to submitter and JPO`)
  run.status = 'sealed'
  tick()
  return run
}

export const levelName = (l) => LEVEL_NAME[l]
export { personaById }

// ── Replays ──────────────────────────────────────────────────────────────────
// Each replication is three sealed blobs, one per layer that may see part of it. What is in a blob is
// what that layer's readers are entitled to, so a thinner reader is thinner because there is less in
// what the KAS releases to them, not because the page hides a field.

function buildRep(m, rp) {
  const ev = rp.events
  return {
    r2: {
      wps: m.wps.map((w) => ({ x: w.x, y: w.y })),
      steps: rp.rec.steps.map((s) => ({ t: s.t, x: s.x, y: s.y, alt: s.alt })),
      missiles: rp.rec.missiles.map((x) => ({ x1: x.x1, y1: x.y1, hit: x.hit })),
      alive: rp.alive, tKill: rp.tKill,
      events: ev.filter((e) => e.min === 'L2').map((e) => ({ t: e.t, kind: e.kind, text: e.t3 })),
    },
    r3: {
      sites: m.sites.map((s) => ({ name: s.name, x: s.x, y: s.y })),
      steps: rp.rec.steps.map((s) => ({ t: s.t, fc: s.fc })),
      missiles: rp.rec.missiles.map((x) => ({ i: x.i, t0: x.t0, t1: x.t1 })),
      events: ev.filter((e) => e.min !== 'L2').map((e) => ({ t: e.t, kind: e.kind, text: e.t3 })),
    },
    r4: {
      sites: m.sites.map((s) => ({ guidance: s.guidance, wRange: s.wRange })),
      steps: rp.rec.steps.map((s) => ({ t: s.t, sig: s.sig, rfc: s.rfc, racq: s.racq, jam: s.jam })),
      events: ev.map((e) => ({ t: e.t, kind: e.kind, text: e.t4 })),
    },
  }
}

/** Seal one replication (once). The enclave does this at run time for the representative one and on demand for the rest. */
export function ensureReplay(run, rep) {
  return ask(`rep|${run.id}|${rep}`, async () => {
    const m = enclave.get(run.id).model
    const b = buildRep(m, replay(m, rep))
    const l = run.derived.layers
    const [R2, R3, R4] = await Promise.all([sealJson(b.r2, l.L2), sealJson(b.r3, l.L3), sealJson(b.r4, l.L4)])
    return { R2, R3, R4 }
  })
}
