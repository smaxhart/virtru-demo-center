/**
 * Documents the user added themselves, persisted across restarts and app updates.
 *
 * Three kinds, stored differently because they cannot be stored the same way:
 *
 *   plaintext     Text plus the attribute FQNs chosen for it. Re-encrypted every time the mode
 *                 launches, exactly like a built-in document. This is the only *portable* kind:
 *                 a TDF's key is wrapped to one KAS's public key, so ciphertext is only ever
 *                 meaningful on the machine that made it.
 *   ztdf-local    A .tdf this app produced. Kept as ciphertext and used as-is, which is safe
 *                 because sidecar.js generates the KAS keypair once into userData/keys and
 *                 keeps it for ten years. It will not open on a different Mac — that is a
 *                 property of TDF, not a defect.
 *   ztdf-foreign  A .tdf whose key some other KAS holds. Kept so its manifest can be shown.
 *                 Never decryptable here, on purpose.
 *
 * Layout under userData:
 *   uploads/index.json   the records, oldest first
 *   uploads/<id>.bin     the payload — UTF-8 text for `plaintext`, ciphertext for the ztdf kinds
 *
 * The index is written via a temp file and renamed, so a crash mid-write leaves the previous
 * index intact rather than a half-written one. Losing an upload is annoying; losing the whole
 * list because one write was interrupted is worse.
 */

const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

const dir      = (app) => path.join(app.getPath('userData'), 'uploads')
const indexPath = (app) => path.join(dir(app), 'index.json')
const blobPath  = (app, id) => path.join(dir(app), `${id}.bin`)

function readIndex(app) {
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath(app), 'utf8'))
    return Array.isArray(raw?.items) ? raw.items : []
  } catch {
    // Missing is the normal first-run case; corrupt is rare and recoverable by starting over,
    // since every record's payload is still on disk beside it.
    return []
  }
}

function writeIndex(app, items) {
  fs.mkdirSync(dir(app), { recursive: true })
  const tmp = indexPath(app) + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, items }, null, 2))
  fs.renameSync(tmp, indexPath(app))
}

/** Every record, or just one mode's. Payloads are not read — see `read`. */
function list(app, modeId) {
  const items = readIndex(app)
  return modeId ? items.filter(r => r.modeId === modeId) : items
}

/**
 * Store one upload.
 *
 * @param {object} record  everything but `id`, `addedAt` and `bytes`, which are set here
 * @param {Uint8Array|string} payload text for `plaintext`, ciphertext for the ztdf kinds
 * @returns {object} the stored record
 */
function add(app, record, payload) {
  const id = `up-${randomUUID().slice(0, 8)}`
  fs.mkdirSync(dir(app), { recursive: true })

  const buf = typeof payload === 'string' ? Buffer.from(payload, 'utf8') : Buffer.from(payload)
  fs.writeFileSync(blobPath(app, id), buf)

  // Stamped here rather than in the renderer so the ordering is the filesystem's, not a
  // clock the UI happens to hold.
  const stored = { ...record, id, addedAt: new Date().toISOString(), bytes: buf.length }
  writeIndex(app, [...readIndex(app), stored])
  return stored
}

/** The payload. Text kinds come back as a string, ztdf kinds as bytes. */
function read(app, id) {
  const rec = readIndex(app).find(r => r.id === id)
  if (!rec) return null
  const buf = fs.readFileSync(blobPath(app, id))
  return rec.kind === 'plaintext' ? buf.toString('utf8') : new Uint8Array(buf)
}

/** Forget an upload. Removing the index entry is what counts; a stray blob is harmless. */
function remove(app, id) {
  const items = readIndex(app)
  if (!items.some(r => r.id === id)) return false
  writeIndex(app, items.filter(r => r.id !== id))
  try { fs.unlinkSync(blobPath(app, id)) } catch { /* already gone */ }
  return true
}

module.exports = { list, add, read, remove }
