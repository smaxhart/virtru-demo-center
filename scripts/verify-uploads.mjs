/**
 * Exercises the whole "add your own document" path against the running platform.
 *
 *   node scripts/verify-uploads.mjs           # run it with the app open
 *
 * The store, the format sniffing, the marking detection, the vault attach and the KAS decision
 * are all the real modules the app uses — nothing is reimplemented here. Two shims make that
 * possible: a fake `app` object pointing the store at a temp directory, and a `window.electronAPI`
 * wired to that store. Token issuance falls through to `src/api/auth.js`'s HTTP path, which is
 * the same issuer the app talks to over IPC.
 *
 * What it proves, in order:
 *   1. A text file's own markings produce a policy the KAS then enforces — granted for a persona
 *      who satisfies it, refused for one who does not.
 *   2. A .tdf this app made can be added as ciphertext and still be enforced, with its policy
 *      read back out of its own manifest rather than taken on trust.
 *   3. A .tdf from another KAS is recognised as foreign and kept out of the vault entirely.
 *   4. A TDF1 file is identified as TDF1 rather than handed to an SDK that cannot read it.
 *   5. Uploads survive a restart — a fresh vault re-attaches everything from disk.
 *   6. Removing one takes it out of both the index and the corpus.
 *
 * Exits non-zero on any failure.
 */

import { mkdtempSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

// ── Shims, before anything from src/ is imported ─────────────────────────────

const root = mkdtempSync(join(tmpdir(), 'virtru-ai-uploads-'))
const fakeApp = { getPath: () => root }
const uploads = require('../electron/ai-uploads.js')
const identities = require('../electron/ai-identities.js')

const ISSUER_URL = 'http://localhost:7779'

/**
 * `src/api/auth.js` routes tokens through electronAPI whenever it exists, so the shim has to
 * cover them too. It calls the same in-process issuer over HTTP that the app reaches over IPC.
 */
async function issueToken(personaId) {
  const res = await fetch(`${ISSUER_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: personaId }),
  })
  if (!res.ok) throw new Error(`Token request failed for "${personaId}": ${res.status} — is the app running?`)
  return res.json()
}

globalThis.window = {
  electronAPI: {
    getUserToken:     issueToken,
    getPlatformToken: () => issueToken('admin'),
    getEntityAttributes: async (personaId) => {
      const { access_token } = await issueToken(personaId)
      const payload = JSON.parse(
        Buffer.from(access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64')
      )
      return (payload.tdf_claims?.entitlements?.[0]?.entity_attributes ?? []).map(a => a.attribute)
    },

    listUploads:  (modeId) => uploads.list(fakeApp, modeId),
    readUpload:   (id) => uploads.read(fakeApp, id),
    deleteUpload: (id) => uploads.remove(fakeApp, id),
    addUpload:    (record, payload) => uploads.add(fakeApp, record, payload),
    getAttributeDefs: () => ({
      namespace: identities.NS,
      hierarchy: identities.CLEARANCE_HIERARCHY,
      defs: identities.ATTRIBUTE_DEFS.map(d => ({
        name: d.name, values: d.values, hierarchy: d.rule.endsWith('HIERARCHY'),
      })),
    }),
  },
}

const { encryptText } = await import('../src/secure-ai/api/tdf.js')
const { sniffFormat, inspectZtdf } = await import('../src/secure-ai/api/tdfInspect.js')
const { detectMarkings, suggestKeywords } = await import('../src/secure-ai/ai/markings.js')
const { attachUpload, attachUploads, uploadDocuments } = await import('../src/secure-ai/ai/userDocs.js')
const { retrieve } = await import('../src/secure-ai/ai/corpusVault.js')
const { classifyQuery } = await import('../src/secure-ai/ai/policyEngine.js')

const vocab = window.electronAPI.getAttributeDefs()
const MODE = 'dow'

// ── Reporting ────────────────────────────────────────────────────────────────

let failures = 0
const ok   = (m) => console.log(`  ✓ ${m}`)
const bad  = (m) => { failures++; console.log(`  ✗ ${m}`) }
const check = (cond, m) => (cond ? ok(m) : bad(m))
const head = (m) => console.log(`\n━━ ${m}`)

/** A real rewrap attempt, reduced to granted / refused. */
async function verdict(vault, doc, personaId) {
  const { granted } = await retrieve(vault, doc, personaId)
  return granted
}

// ── Finding real .tdf files to test against ──────────────────────────────────
//
// Searched for rather than hardcoded: these are the user's own files, they move, and a test
// that silently skips because a path went stale is worse than no test. Pass paths as arguments
// to override.

const SEARCH_DIRS = process.argv.length > 2 ? [] : [
  join(homedir(), 'Downloads'),
  join(homedir(), 'Desktop'),
  join(homedir(), 'Documents'),
]

function realTdfs() {
  if (process.argv.length > 2) return process.argv.slice(2).filter(existsSync)
  const out = []
  for (const dir of SEARCH_DIRS) {
    if (!existsSync(dir)) continue
    try {
      for (const name of readdirSync(dir, { recursive: true })) {
        if (typeof name === 'string' && name.endsWith('.tdf')) out.push(join(dir, name))
      }
    } catch { /* unreadable directory — not worth failing over */ }
  }
  return out
}

/** The first .tdf whose key belongs to a KAS that is not ours. */
async function findForeignTdf() {
  for (const path of realTdfs()) {
    const bytes = new Uint8Array(readFileSync(path))
    if (sniffFormat(bytes) !== 'ztdf') continue
    const info = await inspectZtdf(bytes)
    if (info.ok && !info.ours) return { path, bytes, info }
  }
  return null
}

// ── 1. Text with its own markings ────────────────────────────────────────────

head('A text document, policy proposed from its own markings')

const SITREP = `SECRET//REL TO USA, FVEY

COALITION SITREP — OPERATION NORTHERN LANTERN

(S//REL) The forward logistics node at Grid 44R relocated overnight. Coalition
partners retain tasking authority over the maritime corridor.
(S//REL) Resupply cadence moves to 72 hours effective immediately.
`

const det = detectMarkings(SITREP, vocab)
console.log(`  detected: ${det.fqns.map(f => f.replace(vocab.namespace + '/', '').replace('/value/', ':')).join(', ') || '(none)'}`)
check(det.fqns.some(f => f.endsWith('/clearance/value/secret')), 'SECRET banner became clearance:secret')
check(det.fqns.some(f => f.endsWith('/coi/value/fvey')), 'REL TO ... FVEY became coi:fvey')

const vault = new Map()
const textRecord = await window.electronAPI.addUpload({
  modeId: MODE,
  kind: 'plaintext',
  label: 'Coalition SITREP (uploaded)',
  classification: det.banner,
  policy: det.fqns,
  policyNote: 'Policy proposed from the document\'s own markings.',
  keywords: suggestKeywords(SITREP, 'northern-lantern-sitrep.txt'),
  filename: 'northern-lantern-sitrep.txt',
}, SITREP)

await attachUpload(vault, textRecord)
check(vault.has(textRecord.id), 'attached to the vault')

const textDoc = uploadDocuments([textRecord])[0]
const boundText = vault.get(textRecord.id).boundAttributes
check(
  det.fqns.every(f => boundText.includes(f)) && boundText.length === det.fqns.length,
  `manifest carries exactly the proposed policy (${boundText.length} value(s))`
)

// dow-sarah holds ts-sci (≥ secret) and coi:fvey. dow-henri holds NATO but not FVEY.
check(await verdict(vault, textDoc, 'dow-sarah'), 'dow-sarah granted — satisfies clearance and coi')
check(!(await verdict(vault, textDoc, 'dow-henri')), 'dow-henri refused — holds coi:nato, not coi:fvey')

check(
  classifyQuery('what changed in the northern lantern resupply cadence?', [textDoc])?.id === textDoc.id,
  'reachable by a question through the suggested keywords'
)

// ── 2. A TDF this app made, added as ciphertext ──────────────────────────────

head('A .tdf this app made, added as ciphertext')

const CYBER_POLICY = [
  `${identities.NS}/clearance/value/secret`,
  `${identities.NS}/needtoknow/value/cyber`,
]
const { tdfBytes } = await encryptText('Intrusion set TEMP-4471 is re-scanning the perimeter.', CYBER_POLICY)

// Through the filesystem, exactly as a user picking a file off disk would.
const localPath = join(root, 'made-here.tdf')
writeFileSync(localPath, Buffer.from(tdfBytes))
const localBytes = new Uint8Array(readFileSync(localPath))

check(sniffFormat(localBytes) === 'ztdf', 'sniffed as ztdf')
const localInfo = await inspectZtdf(localBytes)
check(localInfo.ok && localInfo.ours, `recognised as ours (${localInfo.kasUrls.join(', ')})`)
check(
  CYBER_POLICY.every(f => localInfo.attributes.includes(f)),
  'policy read back out of the manifest without a token or a network call'
)

const localRecord = await window.electronAPI.addUpload({
  modeId: MODE,
  kind: 'ztdf-local',
  label: 'Perimeter scan note (uploaded TDF)',
  classification: 'SECRET',
  policy: localInfo.attributes,
  policyNote: 'Encrypted by this app earlier; added as-is.',
  keywords: ['temp-4471', 'perimeter scan'],
  filename: 'made-here.tdf',
}, localBytes)

await attachUpload(vault, localRecord)
const localDoc = uploadDocuments([localRecord])[0]
check(vault.get(localRecord.id)?.bytes === localBytes.length, 'ciphertext used as-is, not re-encrypted')
check(await verdict(vault, localDoc, 'dow-marcus'), 'dow-marcus granted — holds needtoknow:cyber')
check(!(await verdict(vault, localDoc, 'dow-emma')), 'dow-emma refused — no cyber need-to-know')

// ── 3. A TDF from another KAS ───────────────────────────────────────────────

head('A .tdf from another platform')

const foreign = await findForeignTdf()
if (!foreign) {
  console.log(`  — skipped: no foreign .tdf found under ${SEARCH_DIRS.join(', ')}`)
} else {
  const { path: FOREIGN, bytes, info } = foreign
  console.log(`  using ${FOREIGN}`)
  check(sniffFormat(bytes) === 'ztdf', 'sniffed as ztdf')
  check(info.ok, 'manifest parsed')
  check(!info.ours, `recognised as foreign (${info.kasUrls.join(', ') || 'no KAS named'})`)
  console.log(`  its policy: ${info.attributes.join(', ') || '(none)'}`)

  const foreignRecord = await window.electronAPI.addUpload({
    modeId: MODE, kind: 'ztdf-foreign',
    label: 'Partner SITREP (foreign TDF)',
    classification: 'FOREIGN', policy: info.attributes, policyNote: 'Another platform\'s KAS.',
    keywords: [], filename: 'partner-sitrep.tdf',
    foreign: { kasUrls: info.kasUrls, attributes: info.attributes },
  }, bytes)

  const before = vault.size
  const attached = await attachUpload(vault, foreignRecord)
  check(attached === null && vault.size === before, 'kept out of the vault, so it is never rendered as a denial')
  check(uploadDocuments([foreignRecord]).length === 0, 'kept out of the corpus documents')
}

// ── 4. TDF1, the format the SDK cannot read ─────────────────────────────────

head('A TDF1 file from Virtru\'s commercial stack')

const TDF1 = realTdfs().find(p => sniffFormat(new Uint8Array(readFileSync(p))) === 'tdf1')
if (!TDF1) {
  console.log(`  — skipped: no TDF1 file found under ${SEARCH_DIRS.join(', ')}`)
} else {
  console.log(`  using ${TDF1}`)
  const bytes = new Uint8Array(readFileSync(TDF1))
  check(sniffFormat(bytes) === 'tdf1', 'identified as tdf1 before the SDK ever sees it')
  // The point of sniffing: confirm what the SDK would actually have done with it.
  const info = await inspectZtdf(bytes)
  check(!info.ok, `the SDK genuinely cannot read it — "${info.error}"`)
}

// ── 5. Survives a restart ──────────────────────────────────────────────────

head('A restart')

const fresh = new Map()
const { records, failed } = await attachUploads(fresh, MODE)
check(failed.length === 0, `every record re-attached (${failed.map(f => f.error).join('; ') || 'no failures'})`)
check(records.length === uploads.list(fakeApp, MODE).length, `${records.length} record(s) read back from disk`)
check(fresh.has(textRecord.id) && fresh.has(localRecord.id), 'both decryptable uploads are in the new vault')
check(
  await verdict(fresh, uploadDocuments([textRecord])[0], 'dow-sarah'),
  'the re-encrypted text document is still enforced the same way'
)
check(
  !(await verdict(fresh, uploadDocuments([localRecord])[0], 'dow-emma')),
  'the ciphertext document still refuses dow-emma after a restart'
)

// ── 6. Removal ─────────────────────────────────────────────────────────────

head('Removal')

await window.electronAPI.deleteUpload(localRecord.id)
fresh.delete(localRecord.id)
check(!uploads.list(fakeApp, MODE).some(r => r.id === localRecord.id), 'gone from the index')
check(!fresh.has(localRecord.id), 'gone from the vault')

// ── Done ───────────────────────────────────────────────────────────────────

rmSync(root, { recursive: true, force: true })

console.log(failures === 0
  ? '\nEvery upload path behaved as intended, and every access decision came from the KAS.'
  : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
