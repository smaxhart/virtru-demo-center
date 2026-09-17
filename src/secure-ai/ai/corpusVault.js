/**
 * The corpus vault: the retrieval layer of this demo.
 *
 * At boot every document is encrypted into a real TDF, and from then on the plaintext
 * exists nowhere the app can reach without asking the KAS. Retrieval is a rewrap
 * attempt — success returns text, refusal returns a reason, and no code path lets the
 * app hand the model a document the platform declined to release.
 *
 * Retrieval has two subjects, not one: the human asking and the agent asking on their behalf.
 * Both are separately entitled, both are separately asked, and the document is released only
 * when both are granted. `retrieve` is where that composition lives, and every access surface
 * in the app — the chat, the trace, the corpus matrix — goes through it.
 */

import { corpusUnits } from './corpus.js'
import { encryptText, decryptToText, manifestAttributes, describeDenial } from '../api/tdf.js'

/**
 * Encrypt one mode's corpus. Sequential on purpose, though no longer for the original reason:
 * `encryptText` now reuses one client, so the KAS public key is fetched once rather than per
 * document and a parallel boot would save only ~50ms across the whole corpus. The progress list is
 * worth more than that — it is the part of the boot an audience is actually reading.
 *
 * Called once per mode, the first time that mode is launched; AppContext caches the
 * resulting vault so re-entering a mode is instant.
 *
 * @param {Array} documents the mode's `documents` array
 * @param {(p: {done: number, total: number, label: string}) => void} [onProgress]
 * @returns {Promise<Map<string, object>>} keyed by unit.key
 */
export async function encryptCorpus(documents, onProgress) {
  const units = corpusUnits(documents)
  const vault = new Map()

  for (let i = 0; i < units.length; i++) {
    const unit = units[i]
    onProgress?.({ done: i, total: units.length, label: unit.label })

    const { tdfBytes, manifest } = await encryptText(unit.text, unit.policy)
    vault.set(unit.key, {
      unit,
      tdfBytes,
      manifest,
      // Read back from the manifest rather than trusting the input — this is what a
      // reader's KAS will actually evaluate.
      boundAttributes: manifestAttributes(manifest),
      bytes: tdfBytes.length,
    })
  }

  onProgress?.({ done: units.length, total: units.length, label: 'Corpus encrypted' })
  return vault
}

/** The vault entries belonging to one document, tiers in declared order. */
export function unitsForDocument(vault, doc) {
  if (!doc.tiers) {
    const entry = vault.get(doc.id)
    return entry ? [entry] : []
  }
  return doc.tiers.map(t => vault.get(`${doc.id}:${t.id}`)).filter(Boolean)
}

/**
 * One rewrap, as one subject.
 *
 * `keepText` exists so the agent's copy of the plaintext is never retained. Both subjects have
 * to be asked to make a refusal explainable (see `retrieve`), which means the KAS may well
 * release a key to the agent for a document the human is refused. Holding that plaintext in a
 * variable the intersection just denied would be the one place this app had a document it was
 * not entitled to, so the agent's attempt drops it on the floor.
 */
async function attemptAs(entry, subjectId, keepText) {
  try {
    const text = await decryptToText(entry.tdfBytes, subjectId)
    return { granted: true, reason: null, text: keepText ? text : null }
  } catch (err) {
    return { granted: false, reason: describeDenial(err), text: null }
  }
}

/** Stands in for the agent when no agent is in play, so composition stays one code path. */
const NO_AGENT = { granted: true, reason: null, text: null, absent: true }

/** Which subject failed on a single attempt. */
function blockerOf(user, agent) {
  if (user.granted && agent.granted) return null
  if (user.granted) return 'agent'
  if (agent.granted) return 'user'
  return 'both'
}

/**
 * Which subject to name when nothing was released.
 *
 * The agent wins the attribution whenever some tier existed that the human could open and the
 * agent could not — that is the case worth explaining and the one being demonstrated. A
 * document where each subject opens a different tier and neither opens the same one is real but
 * rare; it lands here as 'agent' too, which is the more useful half of a genuinely mutual miss.
 */
function summarizeBlocker(attempts) {
  if (attempts.length === 0) return null
  if (attempts.some(a => a.blockedBy === 'agent')) return 'agent'
  if (attempts.some(a => a.blockedBy === 'user')) return 'user'
  return 'both'
}

/**
 * Attempt retrieval of `doc` as `personaId`, on behalf of `agentId`.
 *
 * **Both subjects must be granted.** The agent is a policy subject in its own right, not a
 * conduit: the KAS is asked once as the human and once as the assistant acting for them, and
 * the document is released only if both are released. So an agent's entitlements are a hard
 * ceiling on what any user can pull through it — a Secret-cleared agent cannot be talked into
 * fetching TS-SCI for a TS-SCI analyst, and an over-granted agent is a real hole rather than a
 * cosmetic one. This is what an on-behalf-of flow has to mean if it is to mean anything.
 *
 * Both are asked even when one has already refused. Short-circuiting would save a round-trip
 * and cost the only thing that makes a refusal explainable: which of the two was the blocker.
 *
 * Tiered documents are tried most-privileged first and the first tier *both* subjects can open
 * wins, so a caller receives the fullest version the pair of them jointly earns.
 *
 * @param {string|null} [agentId] omit for a single-subject decision; composition is unchanged
 * @returns {Promise<{granted: boolean, entry: object|null, text: string|null,
 *                    blockedBy: 'user'|'agent'|'both'|null,
 *                    attempts: Array<{entry: object, granted: boolean, reason: string|null,
 *                                     user: object, agent: object,
 *                                     blockedBy: 'user'|'agent'|'both'|null}>}>}
 */
export async function retrieve(vault, doc, personaId, agentId = null) {
  const entries = unitsForDocument(vault, doc)
  const attempts = []

  for (const entry of entries) {
    const [user, agent] = await Promise.all([
      attemptAs(entry, personaId, true),
      agentId ? attemptAs(entry, agentId, false) : Promise.resolve(NO_AGENT),
    ])

    const granted = user.granted && agent.granted
    attempts.push({
      entry, granted, user, agent,
      blockedBy: blockerOf(user, agent),
      // The single line for callers that only want one: the human's refusal is named first
      // because they are the principal, and the agent's only when the human was in fact granted.
      reason: granted ? null : (user.reason ?? agent.reason),
    })

    if (granted) return { granted: true, entry, text: user.text, attempts, blockedBy: null }
  }

  return {
    granted: false, entry: null, text: null, attempts,
    blockedBy: summarizeBlocker(attempts),
  }
}

/**
 * Which documents a persona can reach through a given agent, by actually trying all of them.
 *
 * This is genuinely 2N rewrap round-trips against the local KAS — the access matrix in the UI
 * is measured, not predicted, which is the whole point of showing it. The two subjects for a
 * given document are asked concurrently, so the doubling costs requests rather than wall-clock.
 *
 * The winning entry is carried back as well, so a caller that wants to offer the ciphertext
 * for download has the exact tier the KAS released — not the one it would have guessed.
 *
 * @param {Array} documents the mode's `documents` array
 * @param {string|null} [agentId]
 * @returns {Promise<Map<string, {granted: boolean, tierId: string|null, entry: object|null,
 *   blockedBy: 'user'|'agent'|'both'|null, userGranted: boolean, agentGranted: boolean}>>}
 *   keyed by doc id
 */
export async function probeAccess(vault, personaId, documents, agentId = null) {
  const results = new Map()
  await Promise.all(documents.map(async doc => {
    const { granted, entry, attempts, blockedBy } = await retrieve(vault, doc, personaId, agentId)
    results.set(doc.id, {
      granted, tierId: entry?.unit.tierId ?? null, entry: entry ?? null, blockedBy,
      // Each subject's own reach, tracked apart from the verdict. "You could open this and the
      // assistant could not" is only sayable if the two were never collapsed into one boolean.
      userGranted:  attempts.some(a => a.user.granted),
      agentGranted: attempts.some(a => a.agent.granted),
    })
  }))
  return results
}
