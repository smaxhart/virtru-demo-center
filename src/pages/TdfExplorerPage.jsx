import { useState, useRef, useEffect } from 'react'
import UiIcon from '../components/UiIcon.jsx'
import { useDemo } from '../context/DemoContext.jsx'
import { FEDERAL_PERSONAS } from '../data/sectors.js'
import { FEDERAL_DOCS, federalDoc, docBytes, formatSize } from '../data/federalDocs.js'
import { encryptText, decryptTdf } from '../api/tdf.js'
import { parseMarkingToFqns, fqnsToShortLabels } from '../ai/markingParser.js'
import { coalitionFqns } from '../data/coalitions.js'
import { evaluatePolicy, groupPolicy, groupLabel, fqnLabel } from '../data/policyMatch.js'
import './tdf-explorer.css'

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

const MONO = 'var(--font-mono)'

/**
 * Classification colour is carried by `data-lv` and the `--band-bg` / `--band-fg` tokens in
 * tdf-explorer.css, so the sample list, the paper sheets and the uploaded-file card all read the
 * same level from one place. `levelKey` only decides which level a banner string belongs to.
 */
function levelKey(text) {
  const t = String(text ?? '').trim().toUpperCase()
  if (!t) return 'none'
  if (t.startsWith('TOP SECRET')) return 'ts'
  if (t.startsWith('SECRET')) return 's'
  if (t.startsWith('CONFIDENTIAL')) return 'c'
  if (t.startsWith('CUI')) return 'cui'
  if (t.startsWith('UNCLASS')) return 'u'
  return 'none'
}

/** A banner for an archive whose source we never saw, read off its clearance attribute. */
function markingFromPolicy(policy) {
  const fqn = policy.find(f => f.includes('/clearance/value/'))
  const v = fqn?.split('/value/')[1]
  return {
    'ts-sci': 'TOP SECRET//SCI', topsecret: 'TOP SECRET', secret: 'SECRET',
    confidential: 'CONFIDENTIAL', cui: 'CUI', unclassified: 'UNCLASSIFIED',
  }[v] ?? null
}

/** Lengths (in characters) for redaction bars that follow the rhythm of the real text. */
const FALLBACK_BARS = [62, 44, 66, 38, 56, 30, 60]
function barsFromText(text, max = 7) {
  if (!text) return FALLBACK_BARS.slice(0, max).map(n => ({ n, indent: 0 }))
  const bars = text.split('\n').slice(1)
    .filter(l => l.trim())
    .slice(0, max)
    .map(l => ({ n: Math.max(6, Math.min(l.trim().length, 68)), indent: Math.min(l.length - l.trimStart().length, 6) }))
  return bars.length ? bars : FALLBACK_BARS.slice(0, max).map(n => ({ n, indent: 0 }))
}

function ZipGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" /><path d="M4 7.5 12 12l8-4.5M12 12v9" />
    </svg>
  )
}

function PlugOffGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 3v4M15 3v4M6 7h12v3a6 6 0 0 1-12 0zM12 16v5" /><path d="M3.5 3.5l17 17" />
    </svg>
  )
}

/**
 * A sheet of paper with a classification band top and bottom: the same object as the briefing on
 * Home. It is the page's one recurring figure. The source document is a sheet, a GRANT is a sheet
 * that unseals, a DENY is the same sheet under ink.
 */
function Sheet({ marking, title, sub, compact, children }) {
  const band = marking ? <div className="brief-banner tx-banner">{marking}</div> : null
  return (
    <div className={`tx-sheet tx-lv${compact ? ' is-compact' : ''}`} data-lv={levelKey(marking)}>
      {band}
      {title && (
        <div className="tx-sheet-head">
          <h3 className="tx-sheet-title">{title}</h3>
          {sub && <p className="tx-sheet-sub">{sub}</p>}
        </div>
      )}
      {children}
      {band}
    </div>
  )
}

/** Ink bars where text would be. Width only, so there is no text in the DOM to copy out. */
function InkBars({ text, label, sealing, lines = 7 }) {
  const bars = barsFromText(text, lines)
  return (
    <div className={`tx-bars${sealing ? ' tx-seal' : ''}`} role="img" aria-label={label}>
      {bars.map((b, i) => (
        <span key={i} className="brief-shut" style={{ width: `${b.n}ch`, marginLeft: `${b.indent}ch`, '--i': i }} />
      ))}
    </div>
  )
}

function StepBar({ current, busy, notes }) {
  const steps = ['Pick a document', 'Encrypt to a TDF', 'Try to open it']
  return (
    <ol className="tx-steps">
      {steps.map((label, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <li key={label} data-state={done ? 'done' : active ? 'active' : 'todo'}
            aria-current={active ? 'step' : undefined}>
            <span className={`tx-step-rule${busy && n === 2 ? ' is-busy' : ''}`}><i /></span>
            <span className="tx-step-top">
              <span className="tx-step-n num">
                {done ? <UiIcon name="check" size={11} strokeWidth={2.8} /> : n}
              </span>
              <span className="tx-step-label">{label}</span>
            </span>
            <span className="tx-step-note">{notes[i]}</span>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * One definition's worth of policy, as a single chip.
 *
 * A roster is one decision, so it gets one chip rather than thirteen. Where the group is satisfied
 * the chip names the value that carried it (nationality:gbr, 1 of 5) because "granted by
 * being British" is the sentence this page exists to produce, and thirteen green chips for a NATO
 * policy would say nothing at all. `evaluated` is omitted for the unevaluated policy view.
 */
function GroupChip({ group, evaluated }) {
  const state = !evaluated ? 'neutral' : evaluated.satisfied ? 'held' : 'missing'
  const tone = { neutral: '', held: 'chip-grant', missing: 'chip-deny' }[state]

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

  const heldNote = evaluated?.held?.length ? `. Holds ${evaluated.held.join(', ')}` : ''
  return (
    <span title={`${full}${heldNote}`} className={`chip chip-mono ${tone}`}>
      {state === 'held' && <UiIcon name="check" size={11} strokeWidth={2.6} />}
      {state === 'missing' && <UiIcon name="x" size={11} strokeWidth={2.6} />}
      {text}
    </span>
  )
}

/** One `"key": value` line in the manifest view. */
function Field({ name, value, note, tone = 'string' }) {
  const valueColor = { string: 'var(--c-grant)', hash: 'var(--c-text-4)', bool: 'var(--c-warn)' }[tone]
  return (
    <div className="flex items-baseline gap-2 flex-wrap" style={{ lineHeight: 1.9 }}>
      <span style={{ color: 'var(--c-accent)' }}>"{name}"</span>
      <span style={{ color: 'var(--c-text-5)' }}>:</span>
      <span style={{ color: valueColor, wordBreak: 'break-all' }}>{value}</span>
      {note && (
        <span className="chip" style={{ height: 'auto', padding: '0 6px', fontSize: 10.5, fontWeight: 500, fontFamily: 'var(--font-ui)' }}>
          {note}
        </span>
      )}
    </div>
  )
}

function Collapsible({ open, onToggle, name, blurb, children }) {
  return (
    <div className="tx-sec">
      <button onClick={onToggle} aria-expanded={open} className="tx-sec-btn">
        <UiIcon name="chevron" size={13} strokeWidth={2.2}
          style={{ color: 'var(--c-text-5)', transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform .12s' }} />
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--c-text-1)' }}>"{name}"</span>
        <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--c-text-5)' }}>{blurb}</span>
      </button>
      {open && <div style={{ padding: '0 0 12px 21px', fontSize: 11.5 }}>{children}</div>}
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

  // Display-only derivations. None of these feed back into state or a handler.
  const marking = doc?.banner ?? detectedMarking ?? manualMarking ?? markingFromPolicy(effectivePolicy)
  let manifestEntry = null
  let payloadEntry = null
  try {
    if (tdfBytes) {
      manifestEntry = findZipEntry(tdfBytes, ['manifest.json', '0.manifest.json'])
      payloadEntry = findZipEntry(tdfBytes, ['0.payload'])
    }
  } catch { /* a malformed archive just shows no per-file sizes */ }
  const fileCount = (manifestEntry ? 1 : 0) + (payloadEntry ? 1 : 0)
  const archiveName = importedFilename ?? `${sourceName}.tdf`
  const triedCount = Object.keys(decryptResults).length
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`

  const stepNotes = [
    hasSource ? sourceName : 'Nothing picked yet',
    encrypting
      ? 'Waiting on the KAS'
      : tdfBytes
        ? `TDF, ${formatSize(tdfBytes.length)}`
        : hasSource ? `${plural(policyGroups.length, 'policy definition')} to bind` : 'Needs a document',
    tdfBytes ? `${triedCount} of ${DECRYPT_PERSONAS.length} personas tried` : 'Needs a TDF',
  ]

  return (
    <div className="page tx">
      <div className="page-hero">
        <p className="page-subtitle">
          Encrypt a real document into a TDF with your live KAS, open the archive it produced
          (manifest, wrapped key, ciphertext), then ask the KAS to release it to each persona in turn.
        </p>
      </div>

      <div style={{ marginBottom: 28 }}>
        <StepBar current={step} busy={encrypting} notes={stepNotes} />
      </div>

      {platformReady === false && (
        <div className="tx-offline" role="alert">
          <PlugOffGlyph />
          <div>
            <div className="tx-offline-title">Platform not reachable</div>
            <div>The KAS is offline. Nothing on this page can be encrypted or opened until it comes back.</div>
          </div>
        </div>
      )}

      <input ref={nativeFileInputRef} type="file" style={{ display: 'none' }} onChange={handleNativeFileChange} />
      <input ref={tdfFileInputRef} type="file" accept=".tdf,.zip" style={{ display: 'none' }} onChange={handleTdfFileChange} />

      <div className="tx-cols">

        {/* ── Left rail: source ─────────────────────────────────────────── */}
        <div className="tx-rail">

          <div>
            <h2 className="section-title">Sample documents</h2>
            <div className="card overflow-hidden">
              {FEDERAL_DOCS.map(d => {
                const on = d.id === selectedId
                return (
                  <button key={d.id} onClick={() => selectDoc(d.id)} className="tx-doc tx-lv"
                    data-lv={levelKey(d.classification)} aria-pressed={on}>
                    <span className="truncate tx-doc-name">{d.name}</span>
                    <span className="tx-doc-meta">
                      <span className="truncate" title={d.classification}>{d.banner ?? d.classification}</span>
                      <span className="num">{formatSize(docBytes(d))}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
            <span style={{ fontSize: 11.5, color: 'var(--c-text-5)' }}>or</span>
            <span style={{ flex: 1, height: 1, background: 'var(--c-border)' }} />
          </div>

          <button onClick={() => nativeFileInputRef.current?.click()} className="btn w-full">
            Upload your own file
          </button>

          {uploadedFile && (
            <div className="tx-upload tx-lv" data-lv={levelKey(detectedMarking ?? manualMarking)}>
              <div className="truncate" style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: 'var(--c-text-1)' }}>{uploadedFile.name}</div>
              <div className="num" style={{ color: 'var(--c-text-5)', marginTop: 2 }}>{formatSize(uploadedFile.size)}</div>

              {detectedMarking ? (
                <>
                  <div style={{ color: 'var(--c-grant)', marginTop: 10, fontWeight: 650, fontSize: 12 }}>
                    Marking detected
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--c-text-2)', marginTop: 2, wordBreak: 'break-all' }}>
                    {detectedMarking}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ color: 'var(--c-warn)', marginTop: 10, fontWeight: 650, fontSize: 12 }}>
                    No marking found, pick one
                  </div>
                  <div className="flex flex-col gap-1" style={{ marginTop: 8 }}>
                    {MARKING_PRESETS.map(p => {
                      const on = manualMarking === p.marking
                      return (
                        <button key={p.label} onClick={() => { setManualMarking(p.marking); setManualFqns(p.fqns) }}
                          className={`chip chip-mono ${on ? 'chip-grant' : ''}`}
                          aria-pressed={on}
                          style={{ height: 26, justifyContent: 'flex-start', cursor: 'pointer', fontWeight: on ? 700 : 500 }}>
                          {on && <UiIcon name="check" size={11} strokeWidth={2.6} />}
                          {p.label}
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
            className="btn btn-primary w-full" style={{ height: 40, fontSize: 14 }}>
            {!encrypting && !tdfBytes && <UiIcon name="lock" size={15} />}
            {encrypting ? 'Encrypting…' : tdfBytes ? 'Re-encrypt' : 'Encrypt with KAS'}
          </button>

          {encryptError && (
            <div className="tx-note tx-note-deny" role="alert">{encryptError}</div>
          )}

          {tdfBytes && (
            <div className="tx-note tx-note-grant">
              <div className="flex items-center gap-1.5" style={{ fontWeight: 650, color: 'var(--c-grant)' }}>
                <UiIcon name="check" size={14} strokeWidth={2.4} /> Real TDF created
              </div>
              <div className="num" style={{ color: 'var(--c-text-4)', marginTop: 2 }}>ZIP archive, {formatSize(tdfBytes.length)}</div>
            </div>
          )}

          {tdfBytes && window.electronAPI && (
            <button onClick={handleSave} className="btn w-full">
              Save .tdf to disk
            </button>
          )}

          <button onClick={handleImport} className="btn btn-ghost w-full">
            Import .tdf from disk
          </button>
        </div>

        {/* ── Right: the three views of the same thing ──────────────────── */}
        <div className="flex-1 flex flex-col gap-5 min-w-0">

          {/* Tab bar: the plaintext on the left, the two files inside the ZIP on the right */}
          <div className="tx-tabs">
            <div className="tx-track">
              <button onClick={() => setTab('doc')} aria-pressed={tab === 'doc'} className="tx-tab">
                Document
              </button>
            </div>

            <div className={`tx-track tx-arch${tdfBytes ? ' is-on' : ''}`}>
              <span className="tx-arch-head">
                <ZipGlyph />
                {tdfBytes ? (
                  <>
                    <span className="truncate tx-arch-name" title={archiveName}>{archiveName}</span>
                    <span className="tx-arch-meta num">
                      {fileCount > 0 ? `${plural(fileCount, 'file')}, ` : ''}{formatSize(tdfBytes.length)}
                    </span>
                  </>
                ) : (
                  <span className="tx-arch-meta">No archive yet</span>
                )}
              </span>
              {TABS.filter(t => t.id !== 'doc').map(t => (
                <button key={t.id} onClick={() => t.enabled && setTab(t.id)} disabled={!t.enabled}
                  aria-pressed={tab === t.id} className="tx-tab tx-tab-mono">
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Encrypting: the sheet goes under ink */}
          {encrypting && (
            <div className="tx-sealing" role="status">
              <div style={{ minWidth: 0 }}>
                <Sheet marking={marking} compact>
                  <InkBars text={plaintext} label="Document being encrypted" sealing />
                </Sheet>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-2)' }}>Encrypting with KAS…</div>
                <div style={{ fontSize: 12.5, color: 'var(--c-text-5)', marginTop: 4, maxWidth: '34ch' }}>
                  Fetching the public key, AES-256-GCM encrypting, RSA-OAEP wrapping
                </div>
              </div>
            </div>
          )}

          {/* ── Document ─────────────────────────────────────────────── */}
          {!encrypting && tab === 'doc' && (
            <div className="flex flex-col gap-5">
              {!hasSource ? (
                <div className="tx-ghost">
                  <div className="tx-ghost-lines" aria-hidden="true">
                    {FALLBACK_BARS.map((n, i) => <span key={i} style={{ width: `${n}%` }} />)}
                  </div>
                  <div className="tx-ghost-copy">
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-2)' }}>
                      {tdfBytes ? 'This archive was imported, so there is no plaintext to show' : 'Pick a sample document, or upload one of your own'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--c-text-5)', maxWidth: 420, marginTop: 4 }}>
                      {tdfBytes
                        ? 'Open the manifest to see what policy it carries, then try a persona below.'
                        : 'The samples are full documents. What the KAS releases at the end is what you read here.'}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <Sheet marking={marking} title={sourceName} sub={doc?.summary}>
                    <div className="brief-open" key={sourceName}>
                      <pre className="tx-sheet-body">{plaintext}</pre>
                    </div>
                  </Sheet>

                  {/* Policy to be applied */}
                  <section>
                    <h2 className="section-title">
                      {tdfBytes ? 'Policy on this archive' : 'Policy that will be applied'}
                    </h2>
                    <div className="flex flex-wrap gap-1.5">
                      {policyGroups.map(g => <GroupChip key={g.definition} group={g} />)}
                      {policyGroups.length === 0 && (
                        <span style={{ fontSize: 13, color: 'var(--c-text-5)' }}>No attributes, so anyone who can reach the KAS can open it.</span>
                      )}
                    </div>
                    {policyGroups.some(g => g.values.length > 1) && (
                      <div className="mt-2" style={{ fontSize: 12, color: 'var(--c-text-5)' }}>
                        Definitions AND together; the values inside one are ANY_OF, so a roster needs one match, not all of them.
                      </div>
                    )}
                    {doc?.policyWhy && !tdfBytes && (
                      <div className="mt-3 flex flex-col gap-1">
                        {policyGroups.map(g => doc.policyWhy[g.name] && (
                          <div key={g.definition} style={{ fontSize: 12.5, color: 'var(--c-text-4)' }}>
                            <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--c-text-2)' }}>{groupLabel(g)}</span>
                            {' — '}{doc.policyWhy[g.name]}
                          </div>
                        ))}
                      </div>
                    )}
                    {doc?.detectDelta && (
                      <div className="mt-3" style={{ fontSize: 12.5, padding: '2px 0 2px 12px', borderLeft: '3px solid var(--c-accent)', color: 'var(--c-text-3)' }}>
                        <span style={{ fontWeight: 700, color: 'var(--c-text-1)' }}>Banner ≠ policy. </span>{doc.detectDelta}
                      </div>
                    )}
                    {detectedMarking && (
                      <div className="mt-3" style={{ fontSize: 12.5, color: 'var(--c-text-4)' }}>
                        Derived from this file's own banner line: <span style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--c-text-2)' }}>{detectedMarking}</span>
                        {', which maps to '}{fqnsToShortLabels(detectedFqns).join(', ')}
                      </div>
                    )}
                  </section>
                </>
              )}
            </div>
          )}

          {/* ── manifest.json ────────────────────────────────────────── */}
          {!encrypting && tab === 'manifest' && manifest && (
            <div className="flex flex-col gap-3">
              <div style={{ fontSize: 13, color: 'var(--c-text-4)', maxWidth: '68ch' }}>
                One of the two files in the ZIP. It travels with the data and names the KAS that must
                be asked, the policy that KAS will evaluate, and the key it wrapped, but never the key itself.
              </div>

              <div className="tx-file">
                <div className="tx-file-head">
                  <span className="tx-file-name">manifest.json</span>
                  {manifestEntry && <span className="tx-file-meta num">{formatSize(manifestEntry.length)}</span>}
                  <span className="flex-1" />
                  <span className="tx-file-meta truncate" title={archiveName}>in {archiveName}</span>
                </div>
                <div className="tx-file-body">
                  {keyAccess && (
                    <Collapsible open={openSections.has('keyAccess')} onToggle={() => toggleSection('keyAccess')}
                      name="keyAccess" blurb="which KAS to ask, and the key it wrapped">
                      <Field name="type" value={`"${keyAccess.type}"`} />
                      <Field name="url" value={`"${keyAccess.url}"`} note="live KAS" />
                      <Field name="wrappedKey" value={`"${(keyAccess.wrappedKey || '').slice(0, 40)}…"`} tone="hash" note="RSA-OAEP wrapped DEK" />
                      <Field name="protocol" value={`"${keyAccess.protocol}"`} />
                    </Collapsible>
                  )}

                  <div className="tx-sec">
                    <div className="py-2.5 flex items-center gap-2 flex-wrap">
                      <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: 'var(--c-text-1)', paddingLeft: 21 }}>"policy"</span>
                      <span className="truncate" style={{ fontFamily: MONO, fontSize: 11.5, color: 'var(--c-text-5)', maxWidth: 240 }}>"{policyB64.slice(0, 28)}…"</span>
                      <span style={{ fontFamily: 'var(--font-ui)', fontSize: 12, color: 'var(--c-text-5)' }}>base64</span>
                      <span className="flex-1" />
                      {!policyDecoded ? (
                        <button onClick={() => setPolicyDecoded(true)} className="btn btn-sm">
                          Decode
                        </button>
                      ) : (
                        <span className="chip chip-grant" style={{ fontFamily: 'var(--font-ui)' }}>
                          <UiIcon name="check" size={11} strokeWidth={2.6} /> Decoded
                        </span>
                      )}
                    </div>
                    {policyDecoded && (
                      <div style={{ padding: '0 0 14px 21px', fontFamily: 'var(--font-ui)' }}>
                        <div className="mb-2" style={{ fontSize: 12.5, color: 'var(--c-text-4)' }}>
                          The KAS re-evaluates every one of these against the caller's live entitlements, on
                          every single decrypt. Separate definitions are ANDed; values inside one follow its rule.
                        </div>
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {groupPolicy(archivePolicy).map(g => <GroupChip key={g.definition} group={g} />)}
                          {archivePolicy.length === 0 && <span style={{ fontSize: 12, color: 'var(--c-text-5)' }}>No attribute restrictions</span>}
                        </div>
                        <div className="break-all" style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--c-text-5)' }}>{policyB64}</div>
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
              </div>
            </div>
          )}

          {/* ── 0.payload ────────────────────────────────────────────── */}
          {!encrypting && tab === 'payload' && hexRows && (
            <div className="flex flex-col gap-3">
              <div style={{ fontSize: 13, color: 'var(--c-text-4)' }}>
                AES-256-GCM ciphertext: the real bytes from this archive. No structure, no readable strings.
              </div>
              <div className="tx-file">
                <div className="tx-file-head">
                  <span className="tx-file-name">0.payload</span>
                  <span className="tx-file-meta num">{formatSize(payloadBytes.length)}</span>
                  <span className="flex-1" />
                  <span className="tx-file-meta truncate" title={archiveName}>in {archiveName}</span>
                </div>
                <div className="tx-hex overflow-auto">
                  {hexRows.map((row, i) => (
                    <div key={i} className="tx-hex-row">
                      <span className="tx-hex-off">{row.offset}</span>
                      <span>{row.bytes.slice(0, 8).join(' ')}</span>
                      <span>{row.bytes.slice(8).join(' ')}</span>
                    </div>
                  ))}
                  <div style={{ color: 'var(--c-text-5)', marginTop: 6 }}>
                    … {formatSize(payloadBytes.length)} total
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Try to open ──────────────────────────────────────────── */}
          {tdfBytes && !encrypting && (
            <section style={{ marginTop: 8 }}>
              <div className="flex items-baseline justify-between gap-4 mb-3">
                <h2 className="section-title" style={{ margin: 0, whiteSpace: 'nowrap' }}>Try to open as</h2>
                <div style={{ fontSize: 12, color: 'var(--c-text-5)', textAlign: 'right' }}>
                  Chips are each persona's live entitlements against this policy. The verdict comes from the KAS.
                </div>
              </div>

              <div className="card overflow-hidden">
                {DECRYPT_PERSONAS.map(persona => {
                  const ent = entitlements[persona.id] ?? persona.fqns ?? []
                  // One verdict per definition, so Emma's single `nationality:gbr` reads as the whole
                  // reason a five-nation FVEY policy lets her in rather than as four refusals.
                  const verdict = evaluatePolicy(ent, effectivePolicy)
                  const result = decryptResults[persona.id]
                  const isLoading = decryptingId === persona.id
                  const expanded = openResult === persona.id
                  const rowState = isLoading ? 'loading' : result ? (result.ok ? 'grant' : 'deny') : 'idle'
                  return (
                    <div key={persona.id} className="tx-row" data-state={rowState}>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center flex-shrink-0 rounded-full"
                          style={{ width: 32, height: 32, background: 'var(--c-surface-3)', color: 'var(--c-text-4)' }}>
                          <UiIcon name="user" size={16} />
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--c-text-1)' }}>{persona.name}</span>
                            <span style={{ fontSize: 12, color: 'var(--c-text-5)' }}>{persona.title}</span>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {verdict.groups.map(g => (
                              <GroupChip key={g.definition} group={g} evaluated={g} />
                            ))}
                            {effectivePolicy.length === 0 && (
                              <span style={{ fontSize: 12, color: 'var(--c-text-5)' }}>No policy attributes to satisfy</span>
                            )}
                          </div>
                        </div>
                        {result && !isLoading && (
                          <span className={`chip ${result.ok ? 'chip-grant' : 'chip-deny'}`}>
                            <UiIcon name={result.ok ? 'check' : 'x'} size={11} strokeWidth={2.6} />
                            {result.ok ? 'Granted' : 'Denied'}
                          </span>
                        )}
                        <button onClick={() => handleDecrypt(persona)} disabled={isLoading || !!decryptingId}
                          className="btn btn-sm flex-shrink-0" style={{ minWidth: 72 }}>
                          {isLoading ? 'Asking KAS…' : result ? 'Open again' : 'Open'}
                        </button>
                      </div>

                      {result?.ok && (
                        <div className="tx-result">
                          <button onClick={() => setOpenResult(expanded ? null : persona.id)}
                            aria-expanded={expanded}
                            className="cursor-pointer px-0 py-0 flex items-center gap-1.5"
                            style={{ fontSize: 12, fontWeight: 600, background: 'none', border: 'none', color: 'var(--c-grant)', fontFamily: 'inherit' }}>
                            <UiIcon name="chevron" size={12} strokeWidth={2.4}
                              style={{ transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform .12s' }} />
                            Released plaintext
                            <span className="num" style={{ fontWeight: 500, color: 'var(--c-text-5)' }}>{formatSize(new TextEncoder().encode(result.text).length)}</span>
                          </button>
                          {expanded && (
                            <div className="mt-2">
                              <Sheet marking={marking} compact>
                                <div className="brief-open">
                                  <pre className="tx-sheet-body">{result.text}</pre>
                                </div>
                              </Sheet>
                            </div>
                          )}
                        </div>
                      )}

                      {result?.ok === false && (
                        <div className="tx-result">
                          <Sheet marking={marking} compact>
                            <InkBars text={plaintext} lines={5} label="Redacted: the KAS withheld the key" />
                          </Sheet>
                          <div className="tx-reason">
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
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
