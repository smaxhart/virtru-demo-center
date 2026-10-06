/**
 * The ACE vault: every GCAP document as a real TDF, and every answer to "may this person open it"
 * as a live KAS rewrap.
 *
 * Nothing here decides anything. `openDocument` tries the key and reports what the KAS said; the
 * tree the page draws is whatever those answers add up to. There is no per-persona list of
 * documents anywhere in the renderer, which is why a policy change in `data.js` moves the tree
 * without a second edit and why a stale table cannot drift from the enforcement.
 */

import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'
import { encryptText, decryptTdf } from '../api/tdf.js'
import { manifestAttributes, describeDenial } from '../secure-ai/api/tdf.js'
import { inspectZtdf } from '../secure-ai/api/tdfInspect.js'
import { DOCUMENTS, UNITS, PERSONAS, DOC_BY_LINK, unitsOf } from './data.js'

const PLATFORM_URL = 'http://localhost:7777'
const KAS_URL = `${PLATFORM_URL}/kas`
const ISSUER_URL = 'http://localhost:7779'

/**
 * Encrypt every unit as the platform admin. Sequential: the client is reused so the KAS public key
 * is fetched once, and the progress list is the part of boot an audience actually reads.
 *
 * @returns {Promise<Map<string, {unit, tdfBytes, manifest, boundAttributes}>>}
 */
export async function encryptVault(onProgress) {
  const vault = new Map()
  for (let i = 0; i < UNITS.length; i++) {
    const unit = UNITS[i]
    onProgress?.({ done: i, total: UNITS.length, label: unit.doc.title })
    const { tdfBytes, manifest } = await encryptText(unit.text, unit.policy, 'admin')
    vault.set(unit.key, { unit, tdfBytes, manifest, boundAttributes: manifestAttributes(manifest) })
  }
  onProgress?.({ done: UNITS.length, total: UNITS.length, label: 'Vault encrypted' })
  return vault
}

/** One rewrap, as one persona. A thrown error is the denial. */
async function attempt(entry, personaId) {
  try {
    const text = await decryptTdf(entry.tdfBytes, personaId)
    return { granted: true, text, reason: null }
  } catch (err) {
    return { granted: false, text: null, reason: describeDenial(err) }
  }
}

/**
 * Open one document as one persona. A tiered document is tried most privileged first and the first
 * tier the KAS releases is the one returned, so the tearline is the KAS's doing and not the page's.
 */
export async function openDocument(vault, doc, personaId) {
  const entries = unitsOf(doc).map(u => vault.get(u.key))
  const tried = []
  let lastReason = null
  for (const entry of entries) {
    const r = await attempt(entry, personaId)
    tried.push({ key: entry.unit.key, tier: entry.unit.tier?.id ?? null, granted: r.granted })
    if (r.granted) {
      return { granted: true, doc, entry, tier: entry.unit.tier, text: r.text, reason: null, tried }
    }
    lastReason = r.reason
  }
  return { granted: false, doc, entry: null, tier: null, text: null, reason: lastReason, tried }
}

/**
 * Everything one persona can open. One rewrap per unit, and the trimmed tree and the visible-only
 * counter are both computed from this single pass.
 */
export async function listFor(vault, personaId) {
  const results = await Promise.all(DOCUMENTS.map(doc => openDocument(vault, doc, personaId)))
  return results
}

/** persona × document, from live decisions. Presenter-only: no persona's view ever renders this. */
export async function auditMatrix(vault, onRow) {
  const rows = {}
  for (const p of PERSONAS) {
    const results = await listFor(vault, p.id)
    rows[p.id] = Object.fromEntries(results.map(r => [r.doc.id, r]))
    onRow?.(p.id, rows[p.id])
  }
  return rows
}

/**
 * Open by address, the way a forwarded link would. A known address is a real rewrap, so the
 * refusal on screen is the KAS's own; an unknown address is just "nothing there".
 */
export async function probe(vault, link, personaId) {
  const doc = DOC_BY_LINK[link.trim()]
  if (!doc) return { found: false }
  return { found: true, ...(await openDocument(vault, doc, personaId)) }
}

// ── The exfiltrated copy ─────────────────────────────────────────────────────

/** What anybody holding the bytes can read without an identity: the policy, not the payload. */
export function inspectCopy(entry) {
  return inspectZtdf(entry.tdfBytes)
}

let anonymous = null
/** A client with no real credential: every rewrap it attempts arrives at the KAS unauthenticated. */
function anonymousClient() {
  return (anonymous ??= new OpenTDF({
    interceptors: [authTokenInterceptor(() => 'no-credential')],
    platformUrl: PLATFORM_URL,
    disableDPoP: true,
  }))
}

/** The stolen file, opened by a laptop that has no identity. */
export async function openWithoutIdentity(entry) {
  try {
    const stream = await anonymousClient().read({
      source: { type: 'stream', location: new Blob([entry.tdfBytes]).stream() },
      allowedKASEndpoints: [KAS_URL],
    })
    const reader = stream.getReader()
    const parts = []
    for (;;) { const { done, value } = await reader.read(); if (done) break; parts.push(value) }
    return { granted: true, text: new TextDecoder().decode(await new Blob(parts).arrayBuffer()), reason: null }
  } catch (err) {
    return { granted: false, text: null, reason: describeDenial(err) }
  }
}

/** The stolen file, opened with a stolen credential. */
export function openWithCredential(entry, personaId) {
  return attempt(entry, personaId)
}

// ── Revocation ───────────────────────────────────────────────────────────────

async function issuerCall(path, username) {
  const res = await fetch(`${ISSUER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username }),
  })
  if (!res.ok) throw new Error(`${path} failed (${res.status})`)
  return res.json()
}

export async function revoke(personaId) {
  if (window.electronAPI?.gcapRevoke) return window.electronAPI.gcapRevoke(personaId)
  return (await issuerCall('/revoke', personaId)).ok
}

/** Pass `'*'` to restore every revoked identity. */
export async function restore(personaId = '*') {
  if (window.electronAPI?.gcapRestore) return window.electronAPI.gcapRestore(personaId)
  return (await issuerCall('/restore', personaId)).ok
}
