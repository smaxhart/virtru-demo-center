/**
 * Documents the user added, joined into the corpus as first-class members.
 *
 * The goal is that an uploaded document is indistinguishable from a built-in one *after* it is
 * in the vault: same card, same access matrix row, same retrieval path, same KAS decision. The
 * differences all live in how it gets there.
 *
 *   plaintext     Text plus chosen attributes. Encrypted here, at launch, exactly like a
 *                 built-in document — so it behaves identically and travels to another machine.
 *   ztdf-local    Already a TDF this app made. Its ciphertext is used as-is, and its policy is
 *                 read back out of its own manifest rather than taken from the record. The
 *                 manifest is the only version the KAS will evaluate, so it is the only version
 *                 worth displaying.
 *   ztdf-foreign  Deliberately NOT in the vault. Its key is wrapped to another KAS, so it can
 *                 never be released here — and putting it in the vault would make it show up in
 *                 the access matrix as a *denial*, which would misattribute a key-binding fact
 *                 to a policy decision. It gets its own inspect-only section instead.
 *
 * The ciphertext kinds are machine-local by construction: a payload key is wrapped to one KAS's
 * public key. `electron/sidecar.js` generates that keypair once into userData and keeps it, so
 * `ztdf-local` survives restarts and app updates — but not a different Mac. Anything meant to be
 * shared has to travel as plaintext plus policy and be re-encrypted on arrival.
 */

import { encryptText, manifestAttributes } from '../api/tdf.js'
import { inspectZtdf } from '../api/tdfInspect.js'

/** Every record for a mode, or [] outside Electron where there is no store. */
export async function loadUploadRecords(modeId) {
  try {
    return (await window.electronAPI?.listUploads?.(modeId)) ?? []
  } catch {
    return []
  }
}

/**
 * A record in the shape the rest of the app expects a document to have.
 *
 * `keywords` is not optional: `classifyQuery` iterates it unguarded, and a document with none
 * is encrypted, policy-enforced, and unreachable by any question ever asked.
 */
export function recordToDocument(record) {
  return {
    id: record.id,
    label: record.label,
    classification: record.classification,
    policy: record.policy ?? [],
    policyNote: record.policyNote,
    keywords: record.keywords ?? [],
    upload: record,
  }
}

/** The decryptable records, as documents. Foreign TDFs are excluded — see the note above. */
export function uploadDocuments(records) {
  return records.filter(r => r.kind !== 'ztdf-foreign').map(recordToDocument)
}

/**
 * Add one record's entry to a vault.
 *
 * Mutates `vault`, because the vault is a cache of ciphertext rather than render state, and the
 * cached promise in AppContext has to keep resolving to the populated version. The caller is
 * responsible for telling React something changed.
 *
 * @returns {Promise<object|null>} the entry, or null for a record that belongs in no vault
 */
export async function attachUpload(vault, record) {
  if (record.kind === 'ztdf-foreign') return null

  if (record.kind === 'plaintext') {
    const text = await window.electronAPI.readUpload(record.id)
    if (typeof text !== 'string') throw new Error(`Upload ${record.id} has no text on disk`)

    const { tdfBytes, manifest } = await encryptText(text, record.policy ?? [])
    const entry = {
      unit: { ...unitFromRecord(record), text },
      tdfBytes,
      manifest,
      boundAttributes: manifestAttributes(manifest),
      bytes: tdfBytes.length,
    }
    vault.set(entry.unit.key, entry)
    return entry
  }

  // ztdf-local: the bytes are the document. Nothing re-encrypts them, and the plaintext is
  // genuinely unavailable until the KAS releases it — which is a better demo than a document
  // the app is quietly holding in memory.
  const bytes = await window.electronAPI.readUpload(record.id)
  const info = await inspectZtdf(bytes)
  if (!info.ok) throw new Error(`Upload ${record.id} is not a readable TDF: ${info.error}`)

  const entry = {
    unit: { ...unitFromRecord(record), text: null, policy: info.attributes },
    tdfBytes: bytes,
    manifest: null,
    boundAttributes: info.attributes,
    bytes: bytes.length,
  }
  vault.set(entry.unit.key, entry)
  return entry
}

/**
 * The unit shape `corpusUnits` would have produced. Uploads are never tiered.
 *
 * `upload` rides along so a card can offer to remove it — the one thing an uploaded document can
 * do that a built-in one cannot.
 */
function unitFromRecord(record) {
  return {
    key: record.id,
    docId: record.id,
    tierId: null,
    label: record.label,
    classification: record.classification,
    policy: record.policy ?? [],
    policyNote: record.policyNote,
    upload: record,
  }
}

/**
 * Attach every stored upload for a mode.
 *
 * One failure does not sink the others: a record whose blob went missing is reported and
 * skipped, because losing the whole corpus over one bad upload would be a much worse morning
 * than losing one document.
 *
 * @returns {Promise<{records: object[], failed: Array<{record: object, error: string}>}>}
 */
export async function attachUploads(vault, modeId) {
  const records = await loadUploadRecords(modeId)
  const failed = []

  for (const record of records) {
    try {
      await attachUpload(vault, record)
    } catch (err) {
      failed.push({ record, error: err?.message ?? String(err) })
    }
  }

  return { records, failed }
}
