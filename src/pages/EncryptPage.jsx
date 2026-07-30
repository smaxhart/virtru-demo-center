import { useState, useEffect } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import Icon from '../components/Icon.jsx'
import ClassificationBanner from '../components/ClassificationBanner.jsx'
import { FEDERAL_SAMPLE_FILES, FEDERAL_FILE_PREVIEWS } from '../data/sectors.js'

const CLASSIFICATION_CLEARANCES = {
  'TOP SECRET':    ['top-secret', 'ts-sci'],
  'SECRET':        ['top-secret', 'secret', 'ts-sci'],
  'CONFIDENTIAL':  ['top-secret', 'secret', 'confidential', 'ts-sci', 'cui'],
  'UNCLASSIFIED':  ['top-secret', 'secret', 'confidential', 'unclassified', 'ts-sci', 'cui'],
}

// Each classification level → which attribute value is required on the data
const FILE_POLICY_ATTR = {
  'TOP SECRET':   'ts-sci',
  'SECRET':       'secret',
  'CONFIDENTIAL': 'confidential',
  'UNCLASSIFIED': null,
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function webCryptoEncrypt(plaintext) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plaintext))
  const rawKey = await crypto.subtle.exportKey('raw', key)
  const toHex = arr => Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
  return {
    key: toHex(new Uint8Array(rawKey)),
    iv: toHex(iv),
    ciphertext: toHex(new Uint8Array(cipher)).slice(0, 64) + '…',
  }
}

export default function EncryptPage() {
  const { activePersona, techMode, logEvent } = useDemo()
  const SAMPLE_FILES = FEDERAL_SAMPLE_FILES
  const FILE_PREVIEWS = FEDERAL_FILE_PREVIEWS

  const [selectedFile, setSelectedFile] = useState(null)
  const [fileMode, setFileMode] = useState('idle') // idle|encrypting|encrypted|decrypting|granted|denied
  const [fileStepIdx, setFileStepIdx] = useState(-1)
  const [fileCipher, setFileCipher] = useState(null)

  useEffect(() => {
    setSelectedFile(null)
    setFileMode('idle')
    setFileStepIdx(-1)
    setFileCipher(null)
  }, [activePersona.id])

  async function runFileEncrypt() {
    if (!selectedFile) return
    setFileMode('encrypting')
    setFileStepIdx(0)
    await sleep(500)
    setFileStepIdx(1)
    const plaintext = FILE_PREVIEWS[selectedFile.id] || selectedFile.name
    const result = await webCryptoEncrypt(plaintext).catch(() => ({
      key: 'a3f2c8e91b4d67054f2a38c0e5b7912d',
      iv: 'b7e3c2a1f4d89065',
      ciphertext: '8f3a2c1b7e4d9065a2f8c3e1b7d4a96f…',
    }))
    setFileCipher(result)
    setFileStepIdx(2)
    await sleep(700)
    setFileMode('encrypted')
    logEvent({
      type: 'access',
      persona: { id: activePersona.id, name: activePersona.name, avatar: activePersona.avatar, color: activePersona.color, fqns: activePersona.fqns ?? [] },
      document: selectedFile.name, result: 'granted', reason: 'Encrypted successfully',
    })
  }

  async function runFileDecrypt() {
    if (!selectedFile || fileMode !== 'encrypted') return
    setFileMode('decrypting')
    setFileStepIdx(0)
    await sleep(500)
    setFileStepIdx(1)
    await sleep(700)
    setFileStepIdx(2)
    await sleep(600)

    const allowed = CLASSIFICATION_CLEARANCES[selectedFile.classification] || []
    const granted = activePersona.attributes.some(a =>
      allowed.some(c => a.toLowerCase().includes(c.toLowerCase()))
    )
    const reason = granted
      ? `${activePersona.name} has required clearance for ${selectedFile.classification}`
      : `${activePersona.name} lacks ${selectedFile.classification} clearance — access denied`

    setFileMode(granted ? 'granted' : 'denied')
    logEvent({
      type: 'access',
      persona: { id: activePersona.id, name: activePersona.name, avatar: activePersona.avatar, color: activePersona.color, fqns: activePersona.fqns ?? [] },
      document: selectedFile.name, result: granted ? 'granted' : 'denied', reason,
    })
  }

  function resetFile() {
    setFileMode('idle')
    setFileStepIdx(-1)
    setFileCipher(null)
  }

  // Access matrix: which files can activePersona decrypt?
  function canDecrypt(file) {
    const allowed = CLASSIFICATION_CLEARANCES[file.classification] || []
    return activePersona.attributes.some(a =>
      allowed.some(c => a.toLowerCase().includes(c.toLowerCase()))
    )
  }

  const requiredAttr = selectedFile ? FILE_POLICY_ATTR[selectedFile.classification] : null

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1200, margin: '0 auto' }}>

      {/* Page hero */}
      <div className="page-hero">
        <p className="page-subtitle">
          Select a file, encrypt it with attribute-based policy, then try to decrypt as any persona.
          The file doesn't change — only the KAS decision changes.
        </p>
        <div className="page-actions">
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20 }}>

        {/* ── Left column (65%) ── */}
        <div style={{ flex: 13, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* Encrypting-as card */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 16px', borderRadius: 10,
            background: activePersona.color + '11', border: `1px solid ${activePersona.color}33`,
          }}>
            <span style={{ fontSize: 22 }}>{activePersona.avatar}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: activePersona.color }}>{activePersona.name}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-5)' }}>Encrypting and decrypting as this user</div>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {activePersona.fqns.slice(0, 4).map(fqn => (
                <span key={fqn} style={{
                  padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: 'monospace',
                  background: activePersona.color + '22', color: activePersona.color,
                  border: `1px solid ${activePersona.color}44`,
                }}>{fqn.split('/value/')[1]}</span>
              ))}
              {activePersona.fqns.length === 0 && (
                <span style={{ fontSize: 11, color: 'var(--c-text-5)', fontStyle: 'italic' }}>No attributes — protected files denied</span>
              )}
            </div>
          </div>

          {/* File grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {SAMPLE_FILES.map(f => {
              const isSelected = selectedFile?.id === f.id
              const isEncrypted = isSelected && fileMode !== 'idle'
              const accessible = canDecrypt(f)
              return (
                <button
                  key={f.id}
                  onClick={() => { if (fileMode === 'idle' || !isSelected) { setSelectedFile(f); if (!isSelected) resetFile() } }}
                  style={{
                    display: 'flex', flexDirection: 'column', gap: 8,
                    padding: '14px 14px', borderRadius: 12, textAlign: 'left',
                    cursor: 'pointer', transition: 'all 0.15s',
                    background: isSelected ? '#1e3a5f22' : 'var(--c-surface)',
                    border: `1.5px solid ${isSelected ? '#3b82f6' : 'var(--c-border)'}`,
                    boxShadow: isSelected ? '0 0 0 2px #3b82f622' : 'none',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Icon name={isEncrypted ? 'lock' : f.icon} size={28} />
                    <ClassificationBanner level={f.classification} size="sm" />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-2)', lineHeight: 1.3 }}>{f.name}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--c-text-5)' }}>{f.size}</span>
                    <span style={{
                      fontSize: 10, padding: '1px 6px', borderRadius: 99, fontWeight: 600,
                      background: accessible ? '#dcfce7' : '#fee2e2',
                      color: accessible ? '#16a34a' : '#dc2626',
                      border: `1px solid ${accessible ? '#86efac' : '#fca5a5'}`,
                    }}>{accessible ? '✓ can decrypt' : '✗ no clearance'}</span>
                  </div>
                  {isEncrypted && fileCipher && techMode && (
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {fileCipher.ciphertext}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Policy binding card — appears when file selected */}
          {selectedFile && fileMode === 'idle' && (
            <div className="step-in" style={{
              borderRadius: 10, padding: '14px 16px',
              background: '#001E4A', border: '1px solid #004987',
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6AAAE4', marginBottom: 10 }}>
                Policy that will be bound to this file:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Icon name={selectedFile.icon} size={20} />
                  <span style={{ fontSize: 13, color: '#ffffff', fontWeight: 600 }}>{selectedFile.name}</span>
                  <ClassificationBanner level={selectedFile.classification} size="sm" />
                </div>
                <span style={{ color: '#6AAAE4', fontSize: 13 }}>→</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  {requiredAttr ? (
                    <span style={{
                      padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 700,
                      fontFamily: 'monospace', background: '#1e3a5f', color: '#60a5fa',
                      border: '1px solid #3b82f6',
                    }}>clearance:{requiredAttr}</span>
                  ) : (
                    <span style={{ fontSize: 12, color: '#4ade80', fontStyle: 'italic' }}>No policy — file accessible to all</span>
                  )}
                </div>
              </div>
              {requiredAttr && (
                <div style={{ marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                  Only users with <strong style={{ color: '#60a5fa' }}>clearance:{requiredAttr}</strong> or higher can decrypt this file.
                  {techMode && (
                    <span style={{ display: 'block', fontFamily: 'monospace', marginTop: 4, color: '#4a7aaa' }}>
                      Attribute FQN: https://demo.com/attr/clearance/value/{requiredAttr}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          {selectedFile && (
            <div style={{ display: 'flex', gap: 10 }}>
              {fileMode === 'idle' && (
                <button onClick={runFileEncrypt} style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
                  cursor: 'pointer', background: 'linear-gradient(135deg, #1e3a5f, #2d4a7a)',
                  color: '#60a5fa', border: '1px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <Icon name="lock" size={16} /> Encrypt "{selectedFile.name}"
                </button>
              )}
              {fileMode === 'encrypting' && (
                <div style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 13,
                  background: '#1e3a5f', color: '#60a5fa', border: '1px solid #3b82f6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>
                  {fileStepIdx === 0 ? 'Binding policy to document…' : fileStepIdx === 1 ? 'Running AES-256-GCM…' : 'Wrapping DEK with KAS public key…'}
                </div>
              )}
              {fileMode === 'encrypted' && (
                <>
                  <button onClick={runFileDecrypt} style={{
                    flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
                    cursor: 'pointer', background: 'linear-gradient(135deg, #0d2018, #065f46)',
                    color: '#4ade80', border: '1px solid #22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <Icon name="unlock" size={16} /> Decrypt as {activePersona.name.split(' ').slice(-1)[0]}
                  </button>
                  <button onClick={resetFile} style={{
                    padding: '12px 16px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                    background: 'var(--c-surface)', color: 'var(--c-text-4)', border: '1px solid var(--c-border)',
                  }}>↺ Reset</button>
                </>
              )}
              {fileMode === 'decrypting' && (
                <div style={{
                  flex: 1, padding: '12px 0', borderRadius: 10, fontSize: 13,
                  background: '#0d2018', color: '#4ade80', border: '1px solid #22c55e',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>◌</span>
                  {fileStepIdx === 0 ? 'Presenting JWT to KAS…' : fileStepIdx === 1 ? 'KAS checking entitlements…' : 'Policy evaluation…'}
                </div>
              )}
              {(fileMode === 'granted' || fileMode === 'denied') && (
                <button onClick={resetFile} style={{
                  padding: '12px 20px', borderRadius: 10, fontSize: 13, cursor: 'pointer',
                  background: 'var(--c-surface)', color: 'var(--c-text-3)', border: '1px solid var(--c-border)',
                }}>↺ Try Another File</button>
              )}
            </div>
          )}

          {/* VERDICT — dramatically large */}
          {selectedFile && fileMode === 'granted' && (
            <div className="step-in" style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #22c55e', boxShadow: '0 0 32px rgba(34,197,94,0.2)' }}>
              <div style={{ background: '#166534', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 48 }}>✅</span>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>ACCESS GRANTED</div>
                  <div style={{ fontSize: 13, color: '#86efac', marginTop: 4 }}>
                    {activePersona.name} has {selectedFile.classification} clearance — KAS unwrapped DEK
                  </div>
                </div>
              </div>
              <div style={{ background: '#0f2d1a', padding: '14px 24px' }}>
                <div style={{ fontSize: 11, color: '#4ade80', fontWeight: 600, marginBottom: 6 }}>DECRYPTED PLAINTEXT:</div>
                <pre style={{ fontFamily: 'monospace', fontSize: 12, color: '#86efac', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0, maxHeight: 120, overflow: 'auto' }}>
                  {FILE_PREVIEWS[selectedFile.id] || selectedFile.name}
                </pre>
              </div>
            </div>
          )}

          {selectedFile && fileMode === 'denied' && (
            <div className="step-in" style={{ borderRadius: 12, overflow: 'hidden', border: '2px solid #ef4444', boxShadow: '0 0 32px rgba(239,68,68,0.2)' }}>
              <div style={{ background: '#7f1d1d', padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <span style={{ fontSize: 48 }}>🔒</span>
                <div>
                  <div style={{ fontSize: 36, fontWeight: 900, color: '#f87171', lineHeight: 1 }}>ACCESS DENIED</div>
                  <div style={{ fontSize: 13, color: '#fca5a5', marginTop: 4 }}>
                    KAS refused to unwrap DEK — {activePersona.name} lacks {selectedFile.classification} clearance
                  </div>
                </div>
              </div>
              <div style={{ background: '#1c0505', padding: '14px 24px' }}>
                <div style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, marginBottom: 6 }}>FILE CONTENT — STILL ENCRYPTED:</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#7f1d1d', lineHeight: 1.6, wordBreak: 'break-all' }}>
                  {fileCipher?.ciphertext || '[ENCRYPTED — AES-256-GCM — unauthorized]'}
                </div>
                <div style={{ fontSize: 11, color: '#b91c1c', marginTop: 8, fontStyle: 'italic' }}>
                  The physical file is unchanged. Without the DEK from KAS, it is unreadable.
                </div>
              </div>
            </div>
          )}

          {!selectedFile && (
            <div style={{
              padding: '32px', textAlign: 'center', borderRadius: 12,
              background: 'var(--c-surface)', border: '1px solid var(--c-border)',
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>👆</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-3)', marginBottom: 4 }}>Select a file above</div>
              <p style={{ fontSize: 13, color: 'var(--c-text-5)', margin: 0 }}>
                Choose a file to see its policy binding, then encrypt and try to decrypt as any persona.
              </p>
            </div>
          )}
        </div>

        {/* ── Right column (35%) ── */}
        <div style={{ flex: 7, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>

          {/* How it works */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 12 }}>How it works</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { icon: 'document', color: 'var(--c-text-2)', step: '1', label: 'File selected', desc: 'Classification determines which attribute is required to decrypt' },
                { icon: 'lock', color: 'var(--c-text-2)', step: '2', label: 'Policy binding', desc: 'Required attribute is written into the TDF manifest at encrypt time' },
                { icon: 'key', color: 'var(--c-text-3)', step: '3', label: 'AES-256-GCM + key wrap', desc: "DEK encrypted with KAS's public key — only KAS can recover it" },
                { icon: 'globe', color: '#15803d', step: '4', label: 'KAS decision', desc: "On decrypt, KAS checks the user's live JWT attributes against the policy" },
              ].map(s => (
                <div key={s.step} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                    background: s.color + '22', border: `1px solid ${s.color}55`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: s.color,
                  }}>{s.step}</div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-5)', lineHeight: 1.4 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Access matrix */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '16px 18px', flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 10 }}>
              Access Matrix — {activePersona.name.split(' ').slice(-1)[0]}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {SAMPLE_FILES.map(f => {
                const access = canDecrypt(f)
                return (
                  <div key={f.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px', borderRadius: 8,
                    background: access ? '#dcfce710' : '#fee2e210',
                    border: `1px solid ${access ? '#86efac44' : '#fca5a544'}`,
                    cursor: 'pointer',
                  }}
                    onClick={() => { setSelectedFile(f); resetFile() }}>
                    <span style={{ fontSize: 14 }}>{access ? '✅' : '🔒'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--c-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                    </div>
                    <ClassificationBanner level={f.classification} size="sm" />
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--c-text-5)', fontStyle: 'italic' }}>
              Click any row to select that file. Switch personas in the header to update.
            </div>
          </div>

          {/* Tech mode cipher output */}
          {techMode && fileCipher && (
            <div className="step-in" style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', marginBottom: 8 }}>CRYPTO OUTPUT</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'monospace', fontSize: 10 }}>
                <div><span style={{ color: '#64748b' }}>IV: </span><span style={{ color: '#0ea5e9' }}>{fileCipher.iv}</span></div>
                <div><span style={{ color: '#64748b' }}>AES key (hex): </span><span style={{ color: '#a78bfa' }}>{fileCipher.key?.slice(0, 32)}…</span></div>
                <div><span style={{ color: '#64748b' }}>Ciphertext: </span><span style={{ color: '#7dd3fc' }}>{fileCipher.ciphertext}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
