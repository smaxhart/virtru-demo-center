import { useState } from 'react'
import Icon from '../components/Icon.jsx'
import ClassificationBanner from '../components/ClassificationBanner.jsx'
import { useDemo } from '../context/DemoContext.jsx'
import { FEDERAL_SAMPLE_FILES, FEDERAL_FILE_PREVIEWS, FEDERAL_PERSONAS } from '../data/sectors.js'
import { encryptText, decryptTdf } from '../api/tdf.js'

// Policies must align with seeded subject mappings so the demo shows real allow/deny decisions.
// clearance uses HIERARCHY rule: ts-sci > secret > cui > unclassified (higher satisfies lower)
const FILE_POLICIES = {
  opord:  ['https://demo.com/attr/clearance/value/secret'],                                                         // all cleared personnel
  sitrep: ['https://demo.com/attr/clearance/value/secret', 'https://demo.com/attr/relto/value/fvey'],              // FVEY partners only
  intel:  ['https://demo.com/attr/clearance/value/ts-sci', 'https://demo.com/attr/mission/value/intel'],           // TS-SCI intel only → sarah
  roe:    ['https://demo.com/attr/clearance/value/secret', 'https://demo.com/attr/relto/value/fvey'],              // FVEY partners
  cyber:  ['https://demo.com/attr/clearance/value/secret', 'https://demo.com/attr/mission/value/cyber'],           // cyber mission → marcus
  pws:    ['https://demo.com/attr/clearance/value/unclassified'],                                                   // everyone
}

const DECRYPT_PERSONAS = FEDERAL_PERSONAS.filter(p => p.id !== 'generic')

function fqnLabel(fqn) {
  const m = fqn.match(/\/attr\/([^/]+)\/value\/([^/]+)$/)
  return m ? `${m[1]}:${m[2]}` : fqn
}

function bytesToHexRows(bytes, rows = 8) {
  return Array.from({ length: rows }, (_, i) => {
    const offset = i * 16
    const slice = bytes.slice(offset, offset + 16)
    return {
      offset: offset.toString(16).padStart(8, '0'),
      bytes: Array.from(slice, b => b.toString(16).padStart(2, '0')),
    }
  })
}

export default function TdfExplorerPage() {
  const { platformReady } = useDemo()

  const [selectedId, setSelectedId] = useState('opord')
  const [encrypting, setEncrypting] = useState(false)
  const [encryptError, setEncryptError] = useState(null)

  // Real TDF state
  const [tdfBytes, setTdfBytes] = useState(null)
  const [manifest, setManifest] = useState(null)
  const [importedFilename, setImportedFilename] = useState(null)

  // UI state
  const [manifestOpen, setManifestOpen] = useState(true)
  const [payloadOpen, setPayloadOpen] = useState(false)
  const [policyDecoded, setPolicyDecoded] = useState(false)
  const [openSections, setOpenSections] = useState(new Set(['keyAccess', 'method', 'payloadRef']))

  // Per-persona decrypt results
  const [decryptResults, setDecryptResults] = useState({})
  const [decryptingId, setDecryptingId] = useState(null)

  function selectFile(id) {
    setSelectedId(id)
    setTdfBytes(null)
    setManifest(null)
    setImportedFilename(null)
    setEncryptError(null)
    setPolicyDecoded(false)
    setDecryptResults({})
    setOpenSections(new Set(['keyAccess', 'method', 'payloadRef']))
  }

  function toggleSection(s) {
    setOpenSections(prev => {
      const n = new Set(prev)
      n.has(s) ? n.delete(s) : n.add(s)
      return n
    })
  }

  async function handleEncrypt() {
    setEncrypting(true)
    setEncryptError(null)
    setTdfBytes(null)
    setManifest(null)
    setDecryptResults({})
    setPolicyDecoded(false)
    try {
      const plaintext = FEDERAL_FILE_PREVIEWS[selectedId] ?? 'Sample document content.'
      const fqns = FILE_POLICIES[selectedId] ?? []
      const { tdfBytes: bytes, manifest: mf } = await encryptText(plaintext, fqns, 'sarah')
      setTdfBytes(bytes)
      setManifest(mf)
      setManifestOpen(true)
      setPayloadOpen(false)
    } catch (e) {
      setEncryptError(e.message || String(e))
    } finally {
      setEncrypting(false)
    }
  }

  async function handleSave() {
    if (!tdfBytes || !window.electronAPI) return
    const fileEntry = FEDERAL_SAMPLE_FILES.find(f => f.id === selectedId)
    const filename = importedFilename ?? `${fileEntry?.name ?? selectedId}.tdf`
    await window.electronAPI.saveTdf(Array.from(tdfBytes), filename)
  }

  async function handleImport() {
    if (!window.electronAPI) return
    const result = await window.electronAPI.openTdf()
    if (!result) return
    const bytes = new Uint8Array(result.bytes)
    setTdfBytes(bytes)
    setImportedFilename(result.filename)
    setDecryptResults({})
    setPolicyDecoded(false)
    // Parse manifest from ZIP
    try {
      const mf = parseManifestFromZip(bytes)
      setManifest(mf)
      setManifestOpen(true)
      setPayloadOpen(false)
    } catch {
      setManifest(null)
    }
  }

  function parseManifestFromZip(bytes) {
    // Scan for PK\x03\x04 local file headers to find manifest.json
    const sig = [0x50, 0x4b, 0x03, 0x04]
    for (let i = 0; i < bytes.length - 30; i++) {
      if (bytes[i] === sig[0] && bytes[i+1] === sig[1] && bytes[i+2] === sig[2] && bytes[i+3] === sig[3]) {
        const fnLen = bytes[i+26] | (bytes[i+27] << 8)
        const extraLen = bytes[i+28] | (bytes[i+29] << 8)
        const fnBytes = bytes.slice(i+30, i+30+fnLen)
        const fname = new TextDecoder().decode(fnBytes)
        if (fname === 'manifest.json' || fname === '0.manifest.json') {
          const compSize = bytes[i+18] | (bytes[i+19] << 8) | (bytes[i+20] << 16) | (bytes[i+21] << 24)
          const dataStart = i + 30 + fnLen + extraLen
          const text = new TextDecoder().decode(bytes.slice(dataStart, dataStart + compSize))
          return JSON.parse(text)
        }
      }
    }
    return null
  }

  async function handleDecrypt(persona) {
    setDecryptingId(persona.id)
    try {
      const plaintext = await decryptTdf(tdfBytes, persona.id)
      setDecryptResults(r => ({ ...r, [persona.id]: { ok: true, text: plaintext } }))
    } catch (e) {
      const msg = e.message || String(e)
      setDecryptResults(r => ({ ...r, [persona.id]: { ok: false, error: msg } }))
    } finally {
      setDecryptingId(null)
    }
  }

  const file = FEDERAL_SAMPLE_FILES.find(f => f.id === selectedId)
  const hexRows = tdfBytes ? bytesToHexRows(tdfBytes) : null

  // Parse manifest sections
  const encInfo = manifest?.encryptionInformation
  const keyAccess = encInfo?.keyAccess?.[0]
  const method = encInfo?.method
  const policyB64 = encInfo?.policy ?? ''
  let decodedPolicy = null
  try { decodedPolicy = policyB64 ? JSON.parse(atob(policyB64)) : null } catch {}
  const policyFqns = decodedPolicy?.dataAttributes?.map(a => a.attribute) ?? []

  return (
    <div className="p-6 flex flex-col gap-5 max-w-6xl mx-auto">
      <div className="page-hero">
        <p className="page-subtitle">
          Encrypt a real file into a TDF using your live KAS, then explore the ZIP structure — manifest, wrapped key, policy — and try decrypting as each persona to see access control in action.
        </p>
      </div>

      {platformReady === false && (
        <div className="rounded-xl p-4 text-sm" style={{ background: '#3f1010', border: '1px solid #991b1b', color: '#fca5a5' }}>
          ⚠ Platform not reachable — KAS is offline. Connect to your DSP instance to use real TDF encryption.
        </div>
      )}

      <div className="flex gap-5">

        {/* Left: file picker */}
        <div style={{ width: 224, flexShrink: 0 }}>
          <div className="text-xs font-bold mb-2" style={{ color: 'var(--c-text-5)' }}>SELECT A FILE</div>
          <div className="flex flex-col gap-1.5 mb-4">
            {FEDERAL_SAMPLE_FILES.map(f => (
              <button
                key={f.id}
                onClick={() => selectFile(f.id)}
                className="text-left p-2.5 rounded-lg cursor-pointer transition-all"
                style={{
                  background: f.id === selectedId ? 'var(--c-surface)' : 'transparent',
                  border: `1px solid ${f.id === selectedId ? '#004987' : 'var(--c-border)'}`,
                }}>
                <div className="text-xs font-medium mb-1.5 truncate" style={{ color: f.id === selectedId ? 'var(--c-text-1)' : 'var(--c-text-4)' }}>
                  {f.name}
                </div>
                <div className="flex items-center justify-between">
                  <ClassificationBanner level={f.classification} />
                  <span className="text-xs" style={{ color: 'var(--c-text-6)' }}>{f.size}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Encrypt button */}
          <button
            onClick={handleEncrypt}
            disabled={encrypting || platformReady === false}
            className="w-full py-2.5 rounded-lg text-sm font-semibold cursor-pointer disabled:opacity-40 transition-all"
            style={{ background: '#004987', color: '#fff', border: '1px solid #0066b3' }}>
            {encrypting ? '⏳ Encrypting…' : tdfBytes ? '↺ Re-encrypt' : '🔒 Encrypt with KAS'}
          </button>

          {encryptError && (
            <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: '#3f1010', border: '1px solid #991b1b', color: '#fca5a5' }}>
              {encryptError}
            </div>
          )}

          {tdfBytes && (
            <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: '#0d2018', border: '1px solid #166534', color: '#4ade80' }}>
              ✓ Real TDF created<br />
              <span style={{ color: 'rgba(74,222,128,0.6)' }}>{(tdfBytes.length / 1024).toFixed(1)} KB · ZIP archive</span>
            </div>
          )}

          {tdfBytes && window.electronAPI && (
            <button
              onClick={handleSave}
              className="w-full mt-2 py-2 rounded-lg text-xs font-semibold cursor-pointer transition-all"
              style={{ background: '#0d2018', color: '#4ade80', border: '1px solid #166534' }}>
              ↓ Save .tdf to disk
            </button>
          )}

          <button
            onClick={handleImport}
            disabled={!window.electronAPI}
            className="w-full mt-2 py-2 rounded-lg text-xs font-semibold cursor-pointer disabled:opacity-40 transition-all"
            style={{ background: 'transparent', color: 'var(--c-text-4)', border: '1px solid var(--c-border)' }}>
            ↑ Import .tdf from disk
          </button>
        </div>

        {/* Right: explorer */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">

          {!tdfBytes && !encrypting && (
            <div className="rounded-xl p-10 flex flex-col items-center gap-3 text-center"
              style={{ background: 'var(--c-surface)', border: '2px dashed var(--c-border)' }}>
              <Icon name="tdf" size={40} />
              <div className="text-sm font-medium" style={{ color: 'var(--c-text-3)' }}>Select a file and click Encrypt with KAS</div>
              <div className="text-xs" style={{ color: 'var(--c-text-5)' }}>
                A real TDF will be created using your live KAS — wrapped key, policy, and ciphertext included
              </div>
            </div>
          )}

          {encrypting && (
            <div className="rounded-xl p-10 flex flex-col items-center gap-3 text-center"
              style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
              <div className="text-3xl" style={{ animation: 'spin 1s linear infinite' }}>⚙</div>
              <div className="text-sm" style={{ color: 'var(--c-text-3)' }}>Encrypting with KAS…</div>
              <div className="text-xs" style={{ color: 'var(--c-text-5)' }}>Fetching public key · AES-256-GCM encrypt · RSA-OAEP wrap</div>
            </div>
          )}

          {tdfBytes && manifest && (
            <>
              {/* Archive header */}
              <div className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: '#10b98122', border: '1px solid #10b98144' }}>
                  <Icon name="tdf" size={22} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: 'var(--c-text-1)' }}>
                    {importedFilename ?? `${file?.name}.tdf`}
                  </div>
                  <div className="text-xs" style={{ color: 'var(--c-text-5)' }}>
                    {importedFilename ? 'Imported TDF' : 'Real TDF Archive'} · {(tdfBytes.length / 1024).toFixed(1)} KB
                  </div>
                </div>
                {file && <ClassificationBanner level={file.classification} />}
              </div>

              {/* ZIP contents */}
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--c-border)' }}>

                {/* manifest.json */}
                <button
                  onClick={() => setManifestOpen(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer text-left"
                  style={{ background: manifestOpen ? '#0d1a2e' : 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
                  <span>📄</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: '#60a5fa' }}>manifest.json</span>
                    <span className="ml-3 text-xs" style={{ color: 'var(--c-text-5)' }}>policy · wrapped key · encryption method</span>
                  </div>
                  <span className="text-xs" style={{ color: '#60a5fa' }}>{manifestOpen ? '▲' : '▼'}</span>
                </button>

                {manifestOpen && (
                  <div className="p-4 flex flex-col gap-3" style={{ background: 'var(--c-bg)', borderBottom: '1px solid var(--c-border)' }}>

                    {/* keyAccess */}
                    {keyAccess && (
                      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #f59e0b44' }}>
                        <button
                          onClick={() => toggleSection('keyAccess')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
                          style={{ background: '#f59e0b18' }}>
                          <span className="text-xs" style={{ color: '#f59e0b' }}>{openSections.has('keyAccess') ? '▼' : '▶'}</span>
                          <span className="text-xs font-mono font-bold" style={{ color: '#f59e0b' }}>"keyAccess"</span>
                          <span className="text-xs ml-2" style={{ color: 'var(--c-text-5)' }}>— who can decrypt, via which KAS</span>
                        </button>
                        {openSections.has('keyAccess') && (
                          <div className="p-3 text-xs font-mono" style={{ background: 'var(--c-bg)', lineHeight: 2.1 }}>
                            <div>
                              <span style={{ color: '#60a5fa' }}>"type"</span><span style={{ color: 'var(--c-text-5)' }}>: </span>
                              <span style={{ color: '#4ade80' }}>"{keyAccess.type}"</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span style={{ color: '#60a5fa' }}>"url"</span><span style={{ color: 'var(--c-text-5)' }}>: </span>
                              <span style={{ color: '#4ade80' }}>"{keyAccess.url}"</span>
                              <span className="px-1.5 py-0.5 rounded font-sans" style={{ fontSize: 10, background: '#f59e0b22', color: '#f59e0b', border: '1px solid #f59e0b55' }}>live KAS</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span style={{ color: '#60a5fa' }}>"wrappedKey"</span><span style={{ color: 'var(--c-text-5)' }}>: </span>
                              <span style={{ color: '#ec4899' }}>"{(keyAccess.wrappedKey || '').slice(0, 32)}…"</span>
                              <span className="px-1.5 py-0.5 rounded font-sans" style={{ fontSize: 10, background: '#ec489922', color: '#ec4899', border: '1px solid #ec489955' }}>RSA-OAEP encrypted DEK</span>
                            </div>
                            <div>
                              <span style={{ color: '#60a5fa' }}>"protocol"</span><span style={{ color: 'var(--c-text-5)' }}>: </span>
                              <span style={{ color: '#4ade80' }}>"{keyAccess.protocol}"</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* policy */}
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #f59e0b44' }}>
                      <div className="px-3 py-2 flex items-center gap-2 flex-wrap" style={{ background: '#f59e0b18' }}>
                        <span className="text-xs font-mono font-bold" style={{ color: '#f59e0b' }}>"policy"</span>
                        <span className="text-xs font-mono" style={{ color: '#4ade8077' }}>"{policyB64.slice(0, 28)}…"</span>
                        <span className="text-xs" style={{ color: 'var(--c-text-6)' }}>base64</span>
                        {!policyDecoded ? (
                          <button
                            onClick={() => setPolicyDecoded(true)}
                            className="px-2 py-0.5 rounded cursor-pointer text-xs font-sans"
                            style={{ background: '#f59e0b33', color: '#f59e0b', border: '1px solid #f59e0b88' }}>
                            Decode →
                          </button>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs font-sans" style={{ background: '#10b98122', color: '#10b981', border: '1px solid #10b98133' }}>decoded ✓</span>
                        )}
                      </div>
                      {policyDecoded && (
                        <div className="p-3" style={{ background: 'var(--c-bg)' }}>
                          <div className="text-xs mb-2" style={{ color: 'var(--c-text-5)' }}>
                            KAS checks ALL of these against the user's live entitlements on every decrypt:
                          </div>
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {policyFqns.map(fqn => (
                              <span key={fqn} className="px-2 py-1 rounded font-mono text-xs"
                                style={{ background: '#60a5fa18', color: '#60a5fa', border: '1px solid #60a5fa44' }}>
                                {fqnLabel(fqn)}
                              </span>
                            ))}
                            {policyFqns.length === 0 && (
                              <span className="text-xs" style={{ color: 'var(--c-text-5)' }}>No attribute restrictions</span>
                            )}
                          </div>
                          <div className="text-xs font-mono break-all" style={{ color: 'var(--c-text-6)', fontSize: 10 }}>
                            {policyB64}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* method */}
                    {method && (
                      <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #8b5cf644' }}>
                        <button
                          onClick={() => toggleSection('method')}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
                          style={{ background: '#8b5cf618' }}>
                          <span className="text-xs" style={{ color: '#8b5cf6' }}>{openSections.has('method') ? '▼' : '▶'}</span>
                          <span className="text-xs font-mono font-bold" style={{ color: '#8b5cf6' }}>"method"</span>
                          <span className="text-xs ml-2" style={{ color: 'var(--c-text-5)' }}>— encryption algorithm and IV</span>
                        </button>
                        {openSections.has('method') && (
                          <div className="p-3 text-xs font-mono" style={{ background: 'var(--c-bg)', lineHeight: 2.1 }}>
                            <div>
                              <span style={{ color: '#60a5fa' }}>"algorithm"</span><span style={{ color: 'var(--c-text-5)' }}>: </span>
                              <span style={{ color: '#4ade80' }}>"{method.algorithm}"</span>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span style={{ color: '#60a5fa' }}>"iv"</span><span style={{ color: 'var(--c-text-5)' }}>: </span>
                              <span style={{ color: '#4ade80' }}>"{method.iv?.slice(0, 24)}{method.iv?.length > 24 ? '…' : ''}"</span>
                              <span className="px-1.5 py-0.5 rounded font-sans" style={{ fontSize: 10, background: '#8b5cf622', color: '#8b5cf6', border: '1px solid #8b5cf655' }}>96-bit random</span>
                            </div>
                            <div>
                              <span style={{ color: '#60a5fa' }}>"isStreamable"</span><span style={{ color: 'var(--c-text-5)' }}>: </span>
                              <span style={{ color: '#f87171' }}>{String(!!method.isStreamable)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* payload ref */}
                    <div className="rounded-lg overflow-hidden" style={{ border: '1px solid #10b98144' }}>
                      <button
                        onClick={() => toggleSection('payloadRef')}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left cursor-pointer"
                        style={{ background: '#10b98118' }}>
                        <span className="text-xs" style={{ color: '#10b981' }}>{openSections.has('payloadRef') ? '▼' : '▶'}</span>
                        <span className="text-xs font-mono font-bold" style={{ color: '#10b981' }}>"payload"</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--c-text-5)' }}>— reference to the encrypted data file</span>
                      </button>
                      {openSections.has('payloadRef') && (
                        <div className="p-3 text-xs font-mono" style={{ background: 'var(--c-bg)', lineHeight: 2.1 }}>
                          <div className="flex items-center gap-2">
                            <span style={{ color: '#60a5fa' }}>"url"</span><span style={{ color: 'var(--c-text-5)' }}>: </span>
                            <span style={{ color: '#4ade80' }}>"0.payload"</span>
                            <span className="px-1.5 py-0.5 rounded font-sans" style={{ fontSize: 10, background: '#10b98122', color: '#10b981', border: '1px solid #10b98144' }}>the other file in the ZIP</span>
                          </div>
                          <div>
                            <span style={{ color: '#60a5fa' }}>"isEncrypted"</span><span style={{ color: 'var(--c-text-5)' }}>: </span>
                            <span style={{ color: '#4ade80' }}>true</span>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>
                )}

                {/* 0.payload */}
                <button
                  onClick={() => setPayloadOpen(v => !v)}
                  className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer text-left"
                  style={{ background: payloadOpen ? '#050f0a' : 'var(--c-surface)' }}>
                  <span>🔒</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold" style={{ color: '#4ade80' }}>0.payload</span>
                    <span className="ml-3 text-xs" style={{ color: 'var(--c-text-5)' }}>AES-256-GCM encrypted · {(tdfBytes.length / 1024).toFixed(1)} KB</span>
                  </div>
                  <span className="text-xs" style={{ color: '#4ade80' }}>{payloadOpen ? '▲' : '▼'}</span>
                </button>

                {payloadOpen && hexRows && (
                  <div className="p-4" style={{ background: '#050f0a' }}>
                    <div className="text-xs mb-3 italic" style={{ color: '#4ade8055', fontFamily: 'monospace' }}>
                      {'/* AES-256-GCM ciphertext — real bytes from this TDF */'}
                    </div>
                    <div className="font-mono text-xs" style={{ lineHeight: 1.9 }}>
                      {hexRows.map((row, i) => (
                        <div key={i} className="flex gap-6">
                          <span style={{ color: '#4ade8033', userSelect: 'none', minWidth: 72 }}>{row.offset}</span>
                          <span style={{ color: '#4ade8066' }}>{row.bytes.slice(0, 8).join(' ')}</span>
                          <span style={{ color: '#4ade8066' }}>{row.bytes.slice(8).join(' ')}</span>
                        </div>
                      ))}
                      <div className="mt-2" style={{ color: '#4ade8033' }}>
                        … {(tdfBytes.length / 1024).toFixed(1)} KB total — no structure, no readable strings
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Try Decrypt */}
              <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
                <div className="text-xs font-bold mb-3" style={{ color: 'var(--c-text-5)' }}>TRY DECRYPT AS</div>
                <div className="flex flex-col gap-2">
                  {DECRYPT_PERSONAS.map(persona => {
                    const result = decryptResults[persona.id]
                    const isLoading = decryptingId === persona.id
                    return (
                      <div key={persona.id}>
                        <div className="flex items-center gap-3">
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{persona.avatar}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold" style={{ color: persona.color }}>{persona.name}</div>
                            <div className="text-xs truncate" style={{ color: 'var(--c-text-6)' }}>{persona.attributes.slice(0, 3).join(' · ')}</div>
                          </div>
                          <button
                            onClick={() => handleDecrypt(persona)}
                            disabled={isLoading || !!decryptingId}
                            className="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer disabled:opacity-40 flex-shrink-0"
                            style={{
                              background: result ? (result.ok ? '#0d2018' : '#3f1010') : 'var(--c-bg)',
                              color: result ? (result.ok ? '#4ade80' : '#f87171') : 'var(--c-text-4)',
                              border: `1px solid ${result ? (result.ok ? '#166534' : '#991b1b') : 'var(--c-border)'}`,
                            }}>
                            {isLoading ? '⏳' : result ? (result.ok ? '✓ Granted' : '✗ Denied') : 'Decrypt'}
                          </button>
                        </div>
                        {result?.ok && (
                          <div className="mt-1.5 ml-9 p-2.5 rounded-lg text-xs font-mono"
                            style={{ background: '#0d2018', color: '#86efac', border: '1px solid #166534', lineHeight: 1.6 }}>
                            {result.text.slice(0, 180)}{result.text.length > 180 ? '…' : ''}
                          </div>
                        )}
                        {result?.ok === false && (
                          <div className="mt-1.5 ml-9 p-2 rounded-lg text-xs"
                            style={{ background: '#3f1010', color: '#fca5a5', border: '1px solid #991b1b' }}>
                            KAS denied: {result.error.slice(0, 120)}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

            </>
          )}
        </div>
      </div>
    </div>
  )
}
