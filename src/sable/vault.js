/**
 * The SABLE vault: every byte that has a policy is a real TDF, and every "may this person" is an
 * answer from the KAS.
 *
 * Three kinds of object are sealed here and in db.js / run.js:
 *   files    the GitLab blobs, one TDF per file under its read policy
 *   tickets  a one-word TDF per distinct policy. Opening a ticket as a persona IS the decision for
 *            that policy, which is how a screen can ask "read or execute?" about thirty files without
 *            thirty rewraps: files that share a policy share a ticket.
 *   results  the run layers, the replay slices and the join output (run.js, db.js)
 *
 * Nothing in the renderer decides anything. `policy.js#evaluate` is used only to word a refusal, and
 * scripts/verify-sable.mjs asserts it never disagrees with the KAS.
 *
 * The renderer draws synchronously but the KAS answers asynchronously, so screens read through
 * `look()`: a hit returns the answer, a miss returns a fallback, starts the request and marks the
 * pass as incomplete. app.js re-draws until a pass completes with no misses, which means a screen is
 * only ever painted from real answers.
 */

import { encryptText, decryptTdf } from '../api/tdf.js'
import { manifestAttributes, describeDenial } from '../secure-ai/api/tdf.js'
import { FILES, seedText } from './data.js'
import { toFqns, policyKey } from './policy.js'

// ── Concurrency ──────────────────────────────────────────────────────────────

function limiter(n) {
  let active = 0
  const q = []
  const pump = () => {
    while (active < n && q.length) {
      const { fn, res, rej } = q.shift()
      active++
      fn().then(res, rej).finally(() => { active--; pump() })
    }
  }
  return (fn) => new Promise((res, rej) => { q.push({ fn, res, rej }); pump() })
}
const limit = limiter(6)

// ── Memoised asks ────────────────────────────────────────────────────────────

const vals = new Map()
const proms = new Map()
let missed = false

/** Start (once) and await an answer. A thrown error is stored as a refusal, never rethrown. */
export function ask(key, fn) {
  if (!proms.has(key)) {
    proms.set(key, Promise.resolve().then(fn).then(
      (v) => { vals.set(key, v); return v },
      (e) => { const v = { ok: false, reason: e?.message || String(e) }; vals.set(key, v); return v },
    ))
  }
  return proms.get(key)
}

/** The answer if we have it; otherwise `fallback`, with the request started and the pass marked incomplete. */
export function look(key, fn, fallback) {
  if (vals.has(key)) return vals.get(key)
  ask(key, fn)
  missed = true
  return fallback
}

/** Read an answer that is already in, without triggering anything. */
export const known = (key) => vals.get(key)

export function beginPass() { missed = false }
export const passIncomplete = () => missed
export const settle = () => Promise.all([...proms.values()])
export const inFlight = () => proms.size - vals.size

// ── Sealing and opening ──────────────────────────────────────────────────────

/** Seal text under a policy as the platform admin. The policy is bound to the TDF; nothing else holds it. */
export async function sealText(text, policy) {
  const { tdfBytes, manifest } = await limit(() => encryptText(text, toFqns(policy), 'admin'))
  return { tdfBytes, manifest, policy, bound: manifestAttributes(manifest), size: tdfBytes.length }
}
export const sealJson = (obj, policy) => sealText(JSON.stringify(obj), policy)

/** One rewrap as one identity. A refusal is a value, not an exception. */
export async function tryOpen(sealed, kasId) {
  for (let attempt = 0; ; attempt++) {
    try {
      return { ok: true, text: await limit(() => decryptTdf(sealed.tdfBytes, kasId)), reason: null }
    } catch (err) {
      const refused = /403|forbidden|permission|denied|unauthorized/i.test(err?.message ?? String(err))
      // A service hiccup is not a refusal: retry it, so a dropped request can never read as a DENY.
      if (refused || attempt >= 3) return { ok: false, text: null, reason: describeDenial(err) }
      await new Promise((r) => setTimeout(r, 250 * (attempt + 1)))
    }
  }
}

export async function openJson(sealed, kasId) {
  const r = await tryOpen(sealed, kasId)
  if (!r.ok) return r
  try { return { ok: true, data: JSON.parse(r.text), reason: null } } catch { return { ok: false, data: null, reason: 'payload was not valid JSON' } }
}

// ── Tickets: one decision per distinct policy per identity ──────────────────

const tickets = new Map()
const ticketFor = (policy) => {
  const k = policyKey(policy)
  if (!tickets.has(k)) tickets.set(k, sealText('ok', policy))
  return tickets.get(k)
}

/** Would the KAS release a payload sealed under `policy` to this identity? */
export function decide(kasId, policy) {
  return ask(`d|${kasId}|${policyKey(policy)}`, async () => {
    const r = await tryOpen(await ticketFor(policy), kasId)
    return { ok: r.ok, reason: r.reason }
  })
}
export const decideLook = (kasId, policy) =>
  look(`d|${kasId}|${policyKey(policy)}`, async () => {
    const r = await tryOpen(await ticketFor(policy), kasId)
    return { ok: r.ok, reason: r.reason }
  }, { ok: false, reason: null, pending: true })

// ── Files ────────────────────────────────────────────────────────────────────

const files = new Map()

/** Seal every repository file under its read policy. Sequential, like GCAP: the progress list is what an audience reads. */
export async function sealFiles(onProgress) {
  const paths = Object.keys(FILES)
  for (let i = 0; i < paths.length; i++) {
    onProgress?.({ done: i, total: paths.length, label: paths[i] })
    if (files.has(paths[i])) continue
    files.set(paths[i], await sealText(seedText(paths[i]), FILES[paths[i]].read))
  }
}

export const fileSealed = (path) => files.get(path)

export const openFile = (kasId, path) =>
  ask(`f|${kasId}|${path}`, () => tryOpen(files.get(path), kasId))
export const openFileLook = (kasId, path) =>
  look(`f|${kasId}|${path}`, () => tryOpen(files.get(path), kasId), { ok: false, text: null, reason: null, pending: true })

// ── Helpers for display ──────────────────────────────────────────────────────

/** The first bytes of the TDF's encrypted payload, so a sealed file shows what the holder of the bytes really has. */
export function hexPreview(sealed, rows = 7) {
  const b = sealed.tdfBytes
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength)
  const start = b[0] === 0x50 && b[1] === 0x4b ? 30 + dv.getUint16(26, true) + dv.getUint16(28, true) : 0
  const out = []
  for (let r = 0; r < rows; r++) {
    const row = []
    for (let c = 0; c < 8; c++) {
      const i = start + r * 16 + c * 2
      row.push(((b[i] ?? 0) << 8 | (b[i + 1] ?? 0)).toString(16).padStart(4, '0'))
    }
    out.push(row.join(' '))
  }
  return out.join('\n')
}

export async function sha256Hex(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, '0')).join('')
}

export const boundShort = (sealed) => (sealed?.bound ?? []).map((f) => f.replace(/^.*\/attr\//, '').replace('/value/', ':'))

/**
 * Build a view until a pass completes with no misses, so the caller sees only real answers.
 * Serialised: the miss flag is shared, so two callers interleaving would each see the other's misses.
 */
let chain = Promise.resolve()
export function resolved(fn) {
  const job = chain.then(async () => {
    for (let i = 0; i < 10; i++) {
      beginPass()
      const v = fn()
      if (!passIncomplete()) return v
      await settle()
    }
    beginPass()
    return fn()
  })
  chain = job.catch(() => {})
  return job
}
