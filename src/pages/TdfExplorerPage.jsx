import { useState, useRef, useEffect } from 'react'
import Icon from '../components/Icon.jsx'
import ClassificationBanner from '../components/ClassificationBanner.jsx'
import { useDemo } from '../context/DemoContext.jsx'
import { FEDERAL_PERSONAS } from '../data/sectors.js'
import { FEDERAL_DOCS, federalDoc, docBytes, formatSize } from '../data/federalDocs.js'
import { encryptText, decryptTdf } from '../api/tdf.js'
import { parseMarkingToFqns, fqnsToShortLabels } from '../ai/markingParser.js'
import { coalitionFqns } from '../data/coalitions.js'
import { evaluatePolicy, groupPolicy, groupLabel, fqnLabel } from '../data/policyMatch.js'

/**
 * TDF Explorer — three steps: pick a document, encrypt it, try to open it.
 *
 * The page used to be styled for a dark theme it never ran in: maroon error boxes, near-black
 * panels, a green-on-black hex dump, all hardcoded on an app whose tokens are light-only. Everything
 * here draws from `--c-*` now, verdicts included.
 *
 * Two behavioural notes worth keeping in mind while reading:
 *
 *   - The per-persona chips are the persona's **live** entitlements — `getEntityAttributes` returns
 *     the FQNs the KAS will resolve them to, from the same issuer that mints their token. The old
 *     page printed the first three strings of a hand-maintained array in `sectors.js`, which had
 *     already drifted from the tokens.
 *   - **A policy is evaluated per definition, not per value.** `src/data/policyMatch.js` does that;
 *     this page must not reintroduce an `every()` over the FQN list. A REL TO marking is a roster of
 *     member nations and `nationality` is ANY_OF, so a persona satisfies a 13-nation NATO policy by
 *     holding exactly one of them — asking for all thirteen reports a denial the KAS never made.
 */

const NS = 'https://demo.com/attr'

// `generic` holds no attributes at all, so it can never open anything and is not a useful row.
const DECRYPT_PERSONAS = FEDERAL_PERSONAS.filter(p => p.id !== 'generic')

const MARKING_PRESETS = [
  { label: 'UNCLASSIFIED',          marking: 'UNCLASSIFIED',          fqns: [`${NS}/clearance/value/unclassified`] },
  { label: 'SECRET',                marking: 'SECRET',                fqns: [`${NS}/clearance/value/secret`] },
  { label: 'SECRET // REL TO FVEY', marking: 'SECRET // REL TO FVEY', fqns: [`${NS}/clearance/value/secret`, ...coalitionFqns('fvey')] },
  { label: 'SECRET // REL TO NATO', marking: 'SECRET // REL TO NATO', fqns: [`${NS}/clearance/value/secret`, ...coalitionFqns('nato')] },
  { label: 'TOP SECRET // SI',      marking: 'TOP SECRET // SI',      fqns: [`${NS}/clearance/value/ts-sci`, `${NS}/mission/value/intel`] },
]

function bytesToHexRows(bytes, rows = 10) {
  return Array.from({ length: rows }, (_, i) => {
    const offset = i * 16
    const slice = bytes.slice(offset, offset + 16)
    return {
      offset: offset.toString(16).padStart(8, '0'),
      bytes: Array.from(slice, b => b.toString(16).padStart(2, '0')),
    }
  })
}

/**
 * Read one named entry out of a TDF's ZIP container.
 *
 * The sizes have to come from the central directory, not the local file header. The SDK writes the
 * archive as it streams, so it cannot know a size before it gets there: it sets general-purpose bit
 * 3, leaves the local header's size fields as the ZIP64 placeholder 0xFFFFFFFF, and writes the real
 * numbers behind the data. Read the local header and `compSize` comes back as -1, so the slice is
 * empty — which is why the manifest never parsed and the manifest tab stayed disabled.
 *
 * The central directory carries the same placeholder for a ZIP64 archive, with the true 64-bit
 * uncompressed size, compressed size and local-header offset in extra field 0x0001, in that order,
 * each present only when its 32-bit field is the placeholder.
 *
 * Both entries the SDK writes are stored (method 0), so the bytes are usable as-is. Anything
 * deflated returns null rather than a corrupt slice.
 */
function findZipEntry(bytes, wanted) {
  const u16 = o => bytes[o] | (bytes[o + 1] << 8)
  const u32 = o => ((bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0)
  const u64 = o => Number(new DataView(bytes.buffer, bytes.byteOffset + o, 8).getBigUint64(0, true))
  const ZIP64 = 0xffffffff

  for (let i = 0; i < bytes.length - 46; i++) {
    if (!(bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x01 && bytes[i + 3] === 0x02)) continue

    const fnLen = u16(i + 28)
    const name = new TextDecoder().decode(bytes.slice(i + 46, i + 46 + fnLen))
    if (!wanted.includes(name)) continue
    if (u16(i + 10) !== 0) return null // deflated — not something we can slice

    let compSize = u32(i + 20)
    let localOff = u32(i + 42)
    if (compSize === ZIP64 || localOff === ZIP64) {
      const exStart = i + 46 + fnLen
      const exEnd = exStart + u16(i + 30)
      for (let e = exStart; e + 4 <= exEnd; e += 4 + u16(e + 2)) {
        if (u16(e) !== 0x0001) continue
        let f = e + 4
        if (u32(i + 24) === ZIP64) f += 8            // uncompressed size, present first
        if (compSize === ZIP64) { compSize = u64(f); f += 8 }
        if (localOff === ZIP64) localOff = u64(f)
        break
      }
    }
    if (compSize === ZIP64 || localOff === ZIP64) return null

    // The local header's own extra field can differ in length from the central one.
    const start = localOff + 30 + u16(localOff + 26) + u16(localOff + 28)
    return bytes.slice(start, start + compSize)
  }
  return null
}

function parseManifestFromZip(bytes) {
  const entry = findZipEntry(bytes, ['manifest.json', '0.manifest.json'])
  return entry ? JSON.parse(new TextDecoder().decode(entry)) : null
}

// ── Small presentational pieces ──────────────────────────────────────────────

function StepBar({ current }) {
  const steps = ['Pick a document', 'Encrypt to a TDF', 'Try to open it']
  return (
    <div className="flex items-center gap-2">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div key={label} className="flex items-center gap-2" style={{ flex: i === steps.length - 1 ? '0 0 auto' : 1 }}>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="flex items-center justify-center rounded-full font-bold"
                style={{
                  width: 20, height: 20, fontSize: 11,
                  background: done ? 'var(--c-grant)' : active ? 'var(--c-accent)' : 'var(--c-surface)',
                  color: done || active ? '#fff' : 'var(--c-text-6)',
                  border: `1px solid ${done ? 'var(--c-grant)' : active ? 'var(--c-accent)' : 'var(--c-border-2)'}`,
                }}>
                {done ? '✓' : n}
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                color: active ? 'var(--c-text-1)' : done ? 'var(--c-text-4)' : 'var(--c-text-6)',
              }}>
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <span style={{ flex: 1, height: 1, background: done ? 'var(--c-grant)' : 'var(--c-border)' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * One definition's worth of policy, as a single chip.
 *
 * A roster is one decision, so it gets one chip rather than thirteen. Where the group is satisfied
 * the chip names the value that carried it — `✓ nationality:gbr (1 of 5)` — because "granted by
 * being British" is the sentence this page exists to produce, and thirteen green chips for a NATO
 * policy would say nothing at all. `evaluated` is omitted for the unevaluated policy view.
 */
function GroupChip({ group, evaluated }) {
  const state = !evaluated ? 'neutral' : evaluated.satisfied ? 'held' : 'missing'
  const palette = {
    neutral: { bg: 'var(--c-surface-2)', fg: 'var(--c-text-3)', br: 'var(--c-border)' },
    held:    { bg: 'var(--c-grant-bg)',  fg: 'var(--c-grant)',  br: 'var(--c-grant-br)' },
    missing: { bg: 'var(--c-deny-bg)',   fg: 'var(--c-deny)',   br: 'var(--c-deny-br)' },
  }[state]

  const full = groupLabel(group)
  const roster = group.values.length > 1
  let text
  if (state === 'held' && evaluated.matched) {
    text = fqnLabel(evaluated.matched) + (roster ? ` (1 of ${group.values.length})` : '')
  } else if (state === 'missing' && roster) {
    text = `${group.name}: none of ${group.values.length}`
  } else if (state === 'missing') {
    text = full
  } else {
    text = roster && group.values.length > 4
      ? `${group.name}: any of ${group.values.length}`
      : full
  }

  const heldNote = evaluated?.held?.length ? `  ·  holds ${evaluated.held.join(', ')}` : ''
  return (
    <span title={`${full}${heldNote}`} className="px-2 py-0.5 rounded font-mono"
      style={{ fontSize: 11, background: palette.bg, color: palette.fg, border: `1px solid ${palette.br}`, whiteSpace: 'nowrap' }}>
      {state === 'held' ? '✓ ' : state === 'missing' ? '✗ ' : ''}{text}
    </span>
  )
}

/** One `"key": value` line in the manifest view. */
function Field({ name, value, note, tone = 'string' }) {
  const valueColor = { string: 'var(--c-grant)', hash: '#7c3aed', bool: 'var(--c-warn)' }[tone]
  return (
    <div className="flex items-baseline gap-2 flex-wrap" style={{ lineHeight: 1.9 }}>
      <span style={{ color: 'var(--c-accent)' }}>"{name}"</span>
      <span style={{ color: 'var(--c-text-6)' }}>:</span>
      <span style={{ color: valueColor, wordBreak: 'break-all' }}>{value}</span>
      {note && (
        <span className="px-1.5 py-0.5 rounded font-sans"
          style={{ fontSize: 10, background: 'var(--c-surface-2)', color: 'var(--c-text-5)', border: '1px solid var(--c-border)' }}>
          {note}
        </span>
      )}
    </div>
  )
}

function Collapsible({ open, onToggle, name, blurb, children }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
      <button onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
        style={{ background: 'var(--c-surface-2)' }}>
        <span style={{ fontSize: 10, color: 'var(--c-text-5)' }}>{open ? '▼' : '▶'}</span>
        <span className="font-mono font-bold" style={{ fontSize: 12, color: 'var(--c-text-1)' }}>"{name}"</span>
        <span style={{ fontSize: 11, color: 'var(--c-text-5)' }}>— {blurb}</span>
      </button>
      {open && <div className="px-3 py-2 font-mono" style={{ fontSize: 11, background: 'var(--c-surface)' }}>{children}</div>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TdfExplorerPage() {
  const { platformReady, logEvent } = useDemo()

  const [selectedId, setSelectedId] = useState('opord')
  const [tab, setTab] = useState('doc')
  const [encrypting, setEncrypting] = useState(false)
  const [encryptError, setEncryptError] = useState(null)

  const [tdfBytes, setTdfBytes] = useState(null)
  const [manifest, setManifest] = useState(null)
  const [importedFilename, setImportedFilename] = useState(null)

  const [uploadedFile, setUploadedFile] = useState(null)   // { name, text, size }
  const [detectedFqns, setDetectedFqns] = useState(null)
  const [detectedMarking, setDetectedMarking] = useState(null)
  const [manualMarking, setManualMarking] = useState(null)
  const [manualFqns, setManualFqns] = useState(null)
  const nativeFileInputRef = useRef(null)
  const tdfFileInputRef = useRef(null)

  const [policyDecoded, setPolicyDecoded] = useState(false)
  const [openSections, setOpenSections] = useState(new Set(['keyAccess', 'method', 'payloadRef']))

  const [decryptResults, setDecryptResults] = useState({})
  const [decryptingId, setDecryptingId] = useState(null)
  const [openResult, setOpenResult] = useState(null)

  // Live entitlements, from the same issuer that mints the personas' tokens. Falls back to the
  // static list when there is no main process (the browser dev path).
  const [entitlements, setEntitlements] = useState({})
  useEffect(() => {
    let cancelled = false
    async function load() {
      const pairs = await Promise.all(DECRYPT_PERSONAS.map(async p => {
        if (!window.electronAPI?.getEntityAttributes) return [p.id, p.fqns ?? []]
        try { return [p.id, await window.electronAPI.getEntityAttributes(p.id)] }
        catch { return [p.id, p.fqns ?? []] }
      }))
      if (!cancelled) setEntitlements(Object.fromEntries(pairs))
    }
    load()
    return () => { cancelled = true }
  }, [])

  const doc = selectedId ? federalDoc(selectedId) : null

  function resetArchive() {
    setTdfBytes(null)
    setManifest(null)
    setImportedFilename(null)
    setEncryptError(null)
    setPolicyDecoded(false)
    setDecryptResults({})
    setOpenResult(null)
    setOpenSections(new Set(['keyAccess', 'method', 'payloadRef']))
  }

  function selectDoc(id) {
    setSelectedId(id)
    setUploadedFile(null)
    setDetectedFqns(null)
    setDetectedMarking(null)
    setManualMarking(null)
    setManualFqns(null)
    setTab('doc')
    resetArchive()
  }

  function toggleSection(s) {
    setOpenSections(prev => {
      const n = new Set(prev)
      n.has(s) ? n.delete(s) : n.add(s)
      return n
    })
  }

  function handleNativeFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const bytes = new Uint8Array(ev.target.result)
      // The banner is in the first non-blank line; 2KB is plenty and keeps a large binary cheap.
      const parsed = parseMarkingToFqns(new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 2048)))
      setDetectedFqns(parsed.fqns.length ? parsed.fqns : null)
      setDetectedMarking(parsed.fqns.length ? parsed.firstLine : null)
      setManualMarking(null)
      setManualFqns(null)
      setUploadedFile({
        name: file.name,
        text: new TextDecoder('utf-8', { fatal: false }).decode(bytes),
        size: file.size,
      })
      setSelectedId(null)
      setTab('doc')
      resetArchive()
    }
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  function loadTdfBytes(bytes, filename) {
    setTdfBytes(bytes)
    setImportedFilename(filename)
    setUploadedFile(null)
    setSelectedId(null)
    setDecryptResults({})
    setOpenResult(null)
    setPolicyDecoded(false)
    try { setManifest(parseManifestFromZip(bytes)) } catch { setManifest(null) }
    setTab('manifest')
  }

  function handleTdfFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => loadTdfBytes(new Uint8Array(ev.target.result), file.name)
    reader.readAsArrayBuffer(file)
    e.target.value = ''
  }

  async function handleImport() {
    if (!window.electronAPI) { tdfFileInputRef.current?.click(); return }
    const result = await window.electronAPI.openTdf()
    if (result) loadTdfBytes(new Uint8Array(result.bytes), result.filename)
  }

  const plaintext = uploadedFile?.text ?? doc?.body ?? ''
  const pendingPolicy = detectedFqns ?? manualFqns ?? doc?.policy ?? []
  const sourceName = uploadedFile?.name ?? doc?.name ?? selectedId

  async function handleEncrypt() {
    setEncrypting(true)
    setEncryptError(null)
    setTdfBytes(null)
    setManifest(null)
    setDecryptResults({})
    setOpenResult(null)
    setPolicyDecoded(false)
    try {
      const { tdfBytes: bytes, manifest: mf } = await encryptText(plaintext, pendingPolicy, 'sarah')
      setTdfBytes(bytes)
      setManifest(mf)
      setTab('manifest')
      const sarah = FEDERAL_PERSONAS.find(p => p.id === 'sarah')
      logEvent({
        type: 'encrypt',
        persona: { id: 'sarah', name: sarah?.name ?? 'Sarah', avatar: sarah?.avatar ?? '👩', color: sarah?.color ?? '#60a5fa', fqns: sarah?.fqns ?? [] },
        document: sourceName,
        result: 'granted',
        reason: `Encrypted with ${pendingPolicy.length} policy attribute${pendingPolicy.length !== 1 ? 's' : ''}`,
      })
    } catch (e) {
      setEncryptError(e.message || String(e))
    } finally {
      setEncrypting(false)
    }
  }

  async function handleSave() {
    if (!tdfBytes || !window.electronAPI) return
    await window.electronAPI.saveTdf(Array.from(tdfBytes), importedFilename ?? `${sourceName}.tdf`)
  }

  async function handleDecrypt(persona) {
    setDecryptingId(persona.id)
    try {
      // An imported TDF may point at someone else's KAS, which fails as an opaque network error.
      // Say so instead.
      const kasUrls = manifest?.encryptionInformation?.keyAccess?.map(k => k.url) ?? []
      if (kasUrls.length === 0 && tdfBytes) {
        const raw = new TextDecoder('utf-8', { fatal: false }).decode(tdfBytes.slice(0, 4096))
        const m = raw.match(/"url"\s*:\s*"([^"]+)"/) ?? raw.match(/url=["']([^"']+)["']/)
        if (m) kasUrls.push(m[1])
      }
      const foreignKas = kasUrls.find(u => u && !u.includes('localhost') && !u.includes('127.0.0.1'))
      if (foreignKas) {
        setDecryptResults(r => ({ ...r, [persona.id]: { ok: false, error: `KAS unreachable: ${foreignKas} — this TDF was not encrypted by the local platform` } }))
        return
      }
      const text = await decryptTdf(tdfBytes, persona.id)
      setDecryptResults(r => ({ ...r, [persona.id]: { ok: true, text } }))
      setOpenResult(persona.id)
      logEvent({
        type: 'access',
        persona: { id: persona.id, name: persona.name, avatar: persona.avatar, color: persona.color, fqns: entitlements[persona.id] ?? persona.fqns ?? [] },
        document: sourceName,
        result: 'granted',
        reason: 'KAS released the key — all policy attributes satisfied',
      })
    } catch (e) {
      const msg = e.message || String(e)
      setDecryptResults(r => ({ ...r, [persona.id]: { ok: false, error: msg } }))
      logEvent({
        type: 'access',
        persona: { id: persona.id, name: persona.name, avatar: persona.avatar, color: persona.color, fqns: entitlements[persona.id] ?? persona.fqns ?? [] },
        document: sourceName,
        result: 'denied',
        reason: msg.includes('403') || msg.toLowerCase().includes('denied')
          ? 'KAS denied — missing required attributes'
          : msg.slice(0, 80),
      })
    } finally {
      setDecryptingId(null)
    }
  }

  // Manifest sections
  const encInfo = manifest?.encryptionInformation
  const keyAccess = encInfo?.keyAccess?.[0]
  const method = encInfo?.method
  const policyB64 = encInfo?.policy ?? ''
  let decodedPolicy = null
  try { decodedPolicy = policyB64 ? JSON.parse(atob(policyB64)) : null } catch { /* not base64 JSON */ }
  // The policy JSON is `{ uuid, body: { dataAttributes, dissem } }`. Read the nested form first and
  // keep the flat one as a fallback — a manifest written by an older SDK can have either, and
  // reading only the flat shape leaves the policy panel empty and every denial reason blank.
  const archivePolicy = (decodedPolicy?.body?.dataAttributes ?? decodedPolicy?.dataAttributes ?? [])
    .map(a => a.attribute)
    .filter(Boolean)
  const effectivePolicy = tdfBytes ? archivePolicy : pendingPolicy
  // Grouped once, per definition. Every chip and every verdict on this page reads this, so a roster
  // is one row wherever it appears.
  const policyGroups = groupPolicy(effectivePolicy)

  const payloadBytes = tdfBytes ? (findZipEntry(tdfBytes, ['0.payload']) ?? tdfBytes) : null
  const hexRows = payloadBytes ? bytesToHexRows(payloadBytes) : null

  const hasSource = !!(doc || uploadedFile)
  const step = tdfBytes ? 3 : hasSource ? 2 : 1
  const needsMarking = uploadedFile && !detectedMarking && !manualMarking

  const TABS = [
    { id: 'doc',      label: 'Document',      enabled: true },
    { id: 'manifest', label: 'manifest.json', enabled: !!manifest },
    { id: 'payload',  label: '0.payload',     enabled: !!payloadBytes },
  ]

  return (
    <div className="p-6 flex flex-col gap-5 max-w-6xl mx-auto">
      <div className="page-hero">
        <p className="page-subtitle">
          Encrypt a real document into a TDF with your live KAS, open the archive it produced —
          manifest, wrapped key, ciphertext — then ask the KAS to release it to each persona in turn.
        </p>
      </div>

      <StepBar current={step} />

      {platformReady === false && (
        <div className="rounded-xl p-4" style={{ fontSize: 13, background: 'var(--c-error-bg)', border: '1px solid var(--c-deny-br)', color: 'var(--c-deny)' }}>
          Platform not reachable — KAS is offline. Nothing on this page can be encrypted or opened until it comes back.
        </div>
      )}

      <input ref={nativeFileInputRef} type="file" style={{ display: 'none' }} onChange={handleNativeFileChange} />
      <input ref={tdfFileInputRef} type="file" accept=".tdf,.zip" style={{ display: 'none' }} onChange={handleTdfFileChange} />

      <div className="flex gap-5 items-start">

        {/* ── Left rail: source ─────────────────────────────────────────── */}
        <div style={{ width: 248, flexShrink: 0 }} className="flex flex-col gap-3">

          <div>
            <div className="font-bold mb-2" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--c-text-5)' }}>
              SAMPLE DOCUMENTS
            </div>
            <div className="flex flex-col gap-1.5">
              {FEDERAL_DOCS.map(d => {
                const on = d.id === selectedId
                return (
                  <button key={d.id} onClick={() => selectDoc(d.id)}
                    className="text-left p-2.5 rounded-lg cursor-pointer transition-all"
                    style={{
                      background: on ? 'var(--c-surface)' : 'transparent',
                      border: `1px solid ${on ? 'var(--c-accent)' : 'var(--c-border)'}`,
                      boxShadow: on ? 'var(--c-shadow-sm)' : 'none',
                    }}>
                    <div className="font-mono truncate mb-1.5"
                      style={{ fontSize: 11, fontWeight: on ? 700 : 500, color: on ? 'var(--c-text-1)' : 'var(--c-text-4)' }}>
                      {d.name}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <ClassificationBanner level={d.classification} size="sm" />
                      <span style={{ fontSize: 11, color: 'var(--c-text-6)' }}>{formatSize(docBytes(d))}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
            <span style={{ fontSize: 10, color: 'var(--c-text-6)' }}>OR</span>
            <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
          </div>

          <button onClick={() => nativeFileInputRef.current?.click()}
            className="w-full py-2 rounded-lg font-semibold cursor-pointer transition-all"
            style={{ fontSize: 12, background: 'var(--c-surface-2)', color: 'var(--c-text-3)', border: '1px dashed var(--c-border-2)' }}>
            ↑ Upload your own file
          </button>

          {uploadedFile && (
            <div className="p-2.5 rounded-lg"
              style={{
                fontSize: 11,
                background: 'var(--c-surface)',
                border: `1px solid ${detectedMarking || manualMarking ? 'var(--c-grant-br)' : 'var(--c-warn-br)'}`,
              }}>
              <div className="font-mono font-medium truncate" style={{ color: 'var(--c-text-1)' }}>{uploadedFile.name}</div>
              <div style={{ color: 'var(--c-text-5)', marginTop: 2 }}>{formatSize(uploadedFile.size)}</div>

              {detectedMarking ? (
                <>
                  <div style={{ color: 'var(--c-grant)', marginTop: 6, fontWeight: 700, fontSize: 10, letterSpacing: '0.06em' }}>
                    MARKING DETECTED
                  </div>
                  <div className="font-mono" style={{ color: 'var(--c-text-2)', marginTop: 2, wordBreak: 'break-all' }}>
                    {detectedMarking}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: 'var(--c-warn)', marginTop: 6, fontWeight: 700, fontSize: 10, letterSpacing: '0.06em' }}>
                    NO MARKING FOUND — PICK ONE
                  </div>
                  <div className="flex flex-col gap-1" style={{ marginTop: 6 }}>
                    {MARKING_PRESETS.map(p => {
                      const on = manualMarking === p.marking
                      return (
                        <button key={p.label} onClick={() => { setManualMarking(p.marking); setManualFqns(p.fqns) }}
                          className="text-left px-2 py-1 rounded font-mono cursor-pointer transition-all"
                          style={{
                            fontSize: 10,
                            background: on ? 'var(--c-grant-bg)' : 'var(--c-surface-2)',
                            color: on ? 'var(--c-grant)' : 'var(--c-text-3)',
                            border: `1px solid ${on ? 'var(--c-grant-br)' : 'var(--c-border)'}`,
                            fontWeight: on ? 700 : 400,
                          }}>
                          {on ? '✓ ' : ''}{p.label}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          <button onClick={handleEncrypt}
            disabled={encrypting || platformReady === false || needsMarking || !hasSource}
            title={needsMarking ? 'Pick a classification marking first' : undefined}
            className="w-full py-2.5 rounded-lg font-semibold cursor-pointer disabled:opacity-40 transition-all"
            style={{ fontSize: 13, background: 'var(--c-accent)', color: '#fff', border: '1px solid var(--c-accent)' }}>
            {encrypting ? 'Encrypting…' : tdfBytes ? '↺ Re-encrypt' : '🔒 Encrypt with KAS'}
          </button>

          {encryptError && (
            <div className="p-2.5 rounded-lg" style={{ fontSize: 11, background: 'var(--c-error-bg)', border: '1px solid var(--c-deny-br)', color: 'var(--c-deny)' }}>
              {encryptError}
            </div>
          )}

          {tdfBytes && (
            <div className="p-2.5 rounded-lg" style={{ fontSize: 11, background: 'var(--c-grant-bg)', border: '1px solid var(--c-grant-br)', color: 'var(--c-grant)' }}>
              <div style={{ fontWeight: 700 }}>✓ Real TDF created</div>
              <div style={{ color: 'var(--c-text-4)', marginTop: 2 }}>{formatSize(tdfBytes.length)} · ZIP archive</div>
            </div>
          )}

          {tdfBytes && window.electronAPI && (
            <button onClick={handleSave}
              className="w-full py-2 rounded-lg font-semibold cursor-pointer transition-all"
              style={{ fontSize: 12, background: 'var(--c-surface)', color: 'var(--c-text-3)', border: '1px solid var(--c-border-2)' }}>
              ↓ Save .tdf to disk
            </button>
          )}

          <button onClick={handleImport}
            className="w-full py-2 rounded-lg font-semibold cursor-pointer transition-all"
            style={{ fontSize: 12, background: 'transparent', color: 'var(--c-text-4)', border: '1px solid var(--c-border)' }}>
            ↑ Import .tdf from disk
          </button>
        </div>

        {/* ── Right: the three views of the same thing ──────────────────── */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {/* Tab bar */}
          <div className="card flex items-center gap-1 px-2" style={{ height: 42, borderRadius: 'var(--c-radius-btn)' }}>
            {TABS.map(t => {
              const on = tab === t.id
              return (
                <button key={t.id} onClick={() => t.enabled && setTab(t.id)} disabled={!t.enabled}
                  className="px-3 py-1.5 rounded font-mono cursor-pointer disabled:cursor-default transition-all"
                  style={{
                    fontSize: 12,
                    fontWeight: on ? 700 : 500,
                    background: on ? 'var(--c-info-bg)' : 'transparent',
                    color: !t.enabled ? 'var(--c-text-6)' : on ? 'var(--c-accent)' : 'var(--c-text-4)',
                    border: '1px solid transparent',
                    opacity: t.enabled ? 1 : 0.5,
                  }}>
                  {t.label}
                </button>
              )
            })}
            <span className="flex-1" />
            {tdfBytes && (
              <span className="font-mono truncate" style={{ fontSize: 11, color: 'var(--c-text-5)', maxWidth: 260 }}>
                {importedFilename ?? `${sourceName}.tdf`} · {formatSize(tdfBytes.length)}
              </span>
            )}
          </div>

          {encrypting && (
            <div className="card p-10 flex flex-col items-center gap-3 text-center">
              <div style={{ fontSize: 28, animation: 'spin 1s linear infinite' }}>⚙</div>
              <div style={{ fontSize: 13, color: 'var(--c-text-3)' }}>Encrypting with KAS…</div>
              <div style={{ fontSize: 12, color: 'var(--c-text-5)' }}>Fetching public key · AES-256-GCM encrypt · RSA-OAEP wrap</div>
            </div>
          )}

          {/* ── Document ─────────────────────────────────────────────── */}
          {!encrypting && tab === 'doc' && (
            <div className="flex flex-col gap-3">
              {!hasSource ? (
                <div className="card p-10 flex flex-col items-center gap-3 text-center" style={{ borderStyle: 'dashed' }}>
                  <Icon name="tdf" size={36} />
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--c-text-3)' }}>
                    {tdfBytes ? 'This archive was imported — there is no plaintext to show' : 'Pick a sample document, or upload one of your own'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-5)', maxWidth: 420 }}>
                    {tdfBytes
                      ? 'Open the manifest to see what policy it carries, then try a persona below.'
                      : 'The samples are full documents. What the KAS releases at the end is what you read here.'}
                  </div>
                </div>
              ) : (
                <>
                  <div className="card overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-2.5" style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface-2)' }}>
                      <span className="font-mono truncate flex-1" style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-1)' }}>
                        {sourceName}
                      </span>
                      {doc && <ClassificationBanner level={doc.classification} size="sm" />}
                    </div>
                    {doc?.summary && (
                      <div className="px-4 pt-3" style={{ fontSize: 12, color: 'var(--c-text-5)' }}>{doc.summary}</div>
                    )}
                    <pre className="px-4 py-3 m-0 overflow-auto"
                      style={{
                        fontSize: 11.5, lineHeight: 1.65, maxHeight: 420,
                        color: 'var(--c-text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                      }}>
                      {plaintext}
                    </pre>
                  </div>

                  {/* Policy to be applied */}
                  <div className="card p-4">
                    <div className="font-bold mb-2" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--c-text-5)' }}>
                      {tdfBytes ? 'POLICY ON THIS ARCHIVE' : 'POLICY THAT WILL BE APPLIED'}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {policyGroups.map(g => <GroupChip key={g.definition} group={g} />)}
                      {policyGroups.length === 0 && (
                        <span style={{ fontSize: 12, color: 'var(--c-text-5)' }}>No attributes — anyone who can reach the KAS can open it.</span>
                      )}
                    </div>
                    {policyGroups.some(g => g.values.length > 1) && (
                      <div className="mt-2" style={{ fontSize: 11, color: 'var(--c-text-5)' }}>
                        Definitions AND together; the values inside one are ANY_OF, so a roster needs one match, not all of them.
                      </div>
                    )}
                    {doc?.policyWhy && !tdfBytes && (
                      <div className="mt-3 flex flex-col gap-1">
                        {policyGroups.map(g => doc.policyWhy[g.name] && (
                          <div key={g.definition} style={{ fontSize: 11, color: 'var(--c-text-5)' }}>
                            <span className="font-mono" style={{ color: 'var(--c-text-3)' }}>{groupLabel(g)}</span>
                            {' — '}{doc.policyWhy[g.name]}
                          </div>
                        ))}
                      </div>
                    )}
                    {doc?.detectDelta && (
                      <div className="mt-3 p-2.5 rounded-lg" style={{ fontSize: 11, background: 'var(--c-info-bg)', color: 'var(--c-text-3)' }}>
                        <span style={{ fontWeight: 700 }}>Banner ≠ policy. </span>{doc.detectDelta}
                      </div>
                    )}
                    {detectedMarking && (
                      <div className="mt-3" style={{ fontSize: 11, color: 'var(--c-text-5)' }}>
                        Derived from this file's own banner line: <span className="font-mono" style={{ color: 'var(--c-text-3)' }}>{detectedMarking}</span>
                        {' → '}{fqnsToShortLabels(detectedFqns).join(', ')}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── manifest.json ────────────────────────────────────────── */}
          {!encrypting && tab === 'manifest' && manifest && (
            <div className="card p-4 flex flex-col gap-3">
              <div style={{ fontSize: 12, color: 'var(--c-text-5)' }}>
                One of the two files in the ZIP. It travels with the data and names the KAS that must
                be asked, the policy that KAS will evaluate, and the key it wrapped — but never the key itself.
              </div>

              {keyAccess && (
                <Collapsible open={openSections.has('keyAccess')} onToggle={() => toggleSection('keyAccess')}
                  name="keyAccess" blurb="which KAS to ask, and the key it wrapped">
                  <Field name="type" value={`"${keyAccess.type}"`} />
                  <Field name="url" value={`"${keyAccess.url}"`} note="live KAS" />
                  <Field name="wrappedKey" value={`"${(keyAccess.wrappedKey || '').slice(0, 40)}…"`} tone="hash" note="RSA-OAEP wrapped DEK" />
                  <Field name="protocol" value={`"${keyAccess.protocol}"`} />
                </Collapsible>
              )}

              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>
                <div className="px-3 py-2 flex items-center gap-2 flex-wrap" style={{ background: 'var(--c-surface-2)' }}>
                  <span className="font-mono font-bold" style={{ fontSize: 12, color: 'var(--c-text-1)' }}>"policy"</span>
                  <span className="font-mono truncate" style={{ fontSize: 11, color: 'var(--c-text-5)', maxWidth: 220 }}>"{policyB64.slice(0, 28)}…"</span>
                  <span style={{ fontSize: 11, color: 'var(--c-text-6)' }}>base64</span>
                  <span className="flex-1" />
                  {!policyDecoded ? (
                    <button onClick={() => setPolicyDecoded(true)}
                      className="px-2 py-0.5 rounded cursor-pointer"
                      style={{ fontSize: 11, fontWeight: 600, background: 'var(--c-info-bg)', color: 'var(--c-accent)', border: '1px solid var(--c-accent)' }}>
                      Decode →
                    </button>
                  ) : (
                    <span className="px-2 py-0.5 rounded"
                      style={{ fontSize: 11, background: 'var(--c-grant-bg)', color: 'var(--c-grant)', border: '1px solid var(--c-grant-br)' }}>
                      decoded ✓
                    </span>
                  )}
                </div>
                {policyDecoded && (
                  <div className="px-3 py-3" style={{ background: 'var(--c-surface)' }}>
                    <div className="mb-2" style={{ fontSize: 11, color: 'var(--c-text-5)' }}>
                      The KAS re-evaluates every one of these against the caller's live entitlements, on
                      every single decrypt. Separate definitions are ANDed; values inside one follow its rule.
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {groupPolicy(archivePolicy).map(g => <GroupChip key={g.definition} group={g} />)}
                      {archivePolicy.length === 0 && <span style={{ fontSize: 11, color: 'var(--c-text-5)' }}>No attribute restrictions</span>}
                    </div>
                    <div className="font-mono break-all" style={{ fontSize: 10, color: 'var(--c-text-6)' }}>{policyB64}</div>
                  </div>
                )}
              </div>

              {method && (
                <Collapsible open={openSections.has('method')} onToggle={() => toggleSection('method')}
                  name="method" blurb="the symmetric algorithm and its IV">
                  <Field name="algorithm" value={`"${method.algorithm}"`} />
                  <Field name="iv" value={`"${method.iv?.slice(0, 24)}${method.iv?.length > 24 ? '…' : ''}"`} note="96-bit random" />
                  <Field name="isStreamable" value={String(!!method.isStreamable)} tone="bool" />
                </Collapsible>
              )}

              <Collapsible open={openSections.has('payloadRef')} onToggle={() => toggleSection('payloadRef')}
                name="payload" blurb="a reference to the other file in the ZIP">
                <Field name="url" value={'"0.payload"'} note="the ciphertext, beside this manifest" />
                <Field name="isEncrypted" value="true" tone="bool" />
              </Collapsible>
            </div>
          )}

          {/* ── 0.payload ────────────────────────────────────────────── */}
          {!encrypting && tab === 'payload' && hexRows && (
            <div className="card p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div style={{ fontSize: 12, color: 'var(--c-text-5)' }}>
                  AES-256-GCM ciphertext — the real bytes from this archive. No structure, no readable strings.
                </div>
                <span className="px-2 py-0.5 rounded font-mono flex-shrink-0"
                  style={{ fontSize: 11, background: 'var(--c-surface-2)', color: 'var(--c-text-4)', border: '1px solid var(--c-border)' }}>
                  {formatSize(payloadBytes.length)}
                </span>
              </div>
              <div className="rounded-lg p-3 font-mono overflow-auto"
                style={{ fontSize: 11, lineHeight: 1.8, background: 'var(--c-surface-2)', border: '1px solid var(--c-border)' }}>
                {hexRows.map((row, i) => (
                  <div key={i} className="flex gap-6" style={{ whiteSpace: 'nowrap' }}>
                    <span style={{ color: 'var(--c-text-6)', userSelect: 'none', minWidth: 68 }}>{row.offset}</span>
                    <span style={{ color: 'var(--c-text-3)' }}>{row.bytes.slice(0, 8).join(' ')}</span>
                    <span style={{ color: 'var(--c-text-3)' }}>{row.bytes.slice(8).join(' ')}</span>
                  </div>
                ))}
                <div style={{ color: 'var(--c-text-6)', marginTop: 6 }}>
                  … {formatSize(payloadBytes.length)} total
                </div>
              </div>
            </div>
          )}

          {/* ── Try to open ──────────────────────────────────────────── */}
          {tdfBytes && !encrypting && (
            <div className="card p-4">
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <div className="font-bold" style={{ fontSize: 11, letterSpacing: '0.06em', color: 'var(--c-text-5)' }}>
                  TRY TO OPEN AS
                </div>
                <div style={{ fontSize: 11, color: 'var(--c-text-5)' }}>
                  Chips are each persona's live entitlements against this policy. The verdict comes from the KAS.
                </div>
              </div>

              <div className="flex flex-col">
                {DECRYPT_PERSONAS.map((persona, idx) => {
                  const ent = entitlements[persona.id] ?? persona.fqns ?? []
                  // One verdict per definition, so Emma's single `nationality:gbr` reads as the whole
                  // reason a five-nation FVEY policy lets her in rather than as four refusals.
                  const verdict = evaluatePolicy(ent, effectivePolicy)
                  const result = decryptResults[persona.id]
                  const isLoading = decryptingId === persona.id
                  const expanded = openResult === persona.id
                  return (
                    <div key={persona.id} style={{ borderTop: idx === 0 ? 'none' : '1px solid var(--c-border)', paddingTop: idx === 0 ? 0 : 10, paddingBottom: 10 }}>
                      <div className="flex items-center gap-3">
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{persona.avatar}</span>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-1)' }}>
                            {persona.name}
                            <span style={{ fontWeight: 400, color: 'var(--c-text-5)' }}> · {persona.title}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {verdict.groups.map(g => (
                              <GroupChip key={g.definition} group={g} evaluated={g} />
                            ))}
                            {effectivePolicy.length === 0 && (
                              <span style={{ fontSize: 11, color: 'var(--c-text-6)' }}>no policy attributes to satisfy</span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => handleDecrypt(persona)} disabled={isLoading || !!decryptingId}
                          className="px-3 py-1.5 rounded-lg font-semibold cursor-pointer disabled:opacity-40 flex-shrink-0"
                          style={{
                            fontSize: 12,
                            background: result ? (result.ok ? 'var(--c-grant-bg)' : 'var(--c-deny-bg)') : 'var(--c-surface-2)',
                            color: result ? (result.ok ? 'var(--c-grant)' : 'var(--c-deny)') : 'var(--c-text-3)',
                            border: `1px solid ${result ? (result.ok ? 'var(--c-grant-br)' : 'var(--c-deny-br)') : 'var(--c-border-2)'}`,
                          }}>
                          {isLoading ? 'Asking KAS…' : result ? (result.ok ? '✓ Granted' : '✗ Denied') : 'Open'}
                        </button>
                      </div>

                      {result?.ok && (
                        <div className="mt-2 ml-9">
                          <button onClick={() => setOpenResult(expanded ? null : persona.id)}
                            className="cursor-pointer px-0 py-0"
                            style={{ fontSize: 11, fontWeight: 600, background: 'none', border: 'none', color: 'var(--c-grant)' }}>
                            {expanded ? '▼' : '▶'} Released plaintext · {formatSize(new TextEncoder().encode(result.text).length)}
                          </button>
                          {expanded && (
                            <pre className="mt-1.5 p-3 m-0 rounded-lg overflow-auto"
                              style={{
                                fontSize: 11, lineHeight: 1.6, maxHeight: 280,
                                background: 'var(--c-grant-bg)', border: '1px solid var(--c-grant-br)',
                                color: 'var(--c-text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                              }}>
                              {result.text}
                            </pre>
                          )}
                        </div>
                      )}

                      {result?.ok === false && (
                        <div className="mt-2 ml-9 p-2.5 rounded-lg"
                          style={{ fontSize: 11, background: 'var(--c-deny-bg)', border: '1px solid var(--c-deny-br)', color: 'var(--c-text-3)' }}>
                          {verdict.missing.length
                            ? <><span style={{ fontWeight: 700, color: 'var(--c-deny)' }}>KAS withheld the key. </span>
                                {verdict.missing.map(g => (
                                  <span key={g.definition}>
                                    {' '}Needs {groupLabel(g)}
                                    {g.held.length
                                      // Surname, not the first word: every federal persona's name
                                      // starts with a rank, so `split(' ')[0]` read "Maj. holds…".
                                      ? ` — ${persona.name.split(' ').at(-1)} holds ${g.name}:${g.held.join(', ')}.`
                                      : `; none held.`}
                                  </span>
                                ))}</>
                            : <><span style={{ fontWeight: 700, color: 'var(--c-deny)' }}>KAS denied. </span>{result.error.slice(0, 200)}</>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
