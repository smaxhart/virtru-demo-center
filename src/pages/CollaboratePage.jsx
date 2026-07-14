import { useState, useCallback, useRef } from 'react'
import { useDemo } from '../context/DemoContext.jsx'

// ── Static file catalogue ─────────────────────────────────────────────────────
const BASE_FILES = [
  {
    id: 'briefing',
    ext: 'pdf',
    name: 'Q3_Threat_Briefing.pdf',
    size: '2.4 MB',
    msClass: 'ts',
    msLabel: 'Top Secret',
    owner: 'Alice Chen',
    ownerUser: 'alice',
    modified: 'Today, 9:14 AM',
    visible: ['clearance:top-secret'],
    required: ['clearance:top-secret'],
  },
  {
    id: 'acquisition',
    ext: 'docx',
    name: 'Meridian_Acquisition_NDA.docx',
    size: '845 KB',
    msClass: 's',
    msLabel: 'Secret',
    owner: 'Carol Singh',
    ownerUser: 'carol',
    modified: 'July 10, 3:45 PM',
    visible: ['clearance:secret'],
    required: ['clearance:secret', 'department:legal'],
  },
  {
    id: 'audit',
    ext: 'xlsx',
    name: 'Infra_Security_Audit.xlsx',
    size: '1.1 MB',
    msClass: 's',
    msLabel: 'Secret',
    owner: 'Dave Kim',
    ownerUser: 'dave',
    modified: 'July 9, 11:02 AM',
    visible: ['clearance:secret'],
    required: ['clearance:secret', 'department:it'],
  },
  {
    id: 'scope',
    ext: 'pdf',
    name: 'Atlas_Contractor_SOW.pdf',
    size: '560 KB',
    msClass: 'u',
    msLabel: 'Unclassified',
    owner: 'Alice Chen',
    ownerUser: 'alice',
    modified: 'July 8, 2:30 PM',
    visible: [],
    required: ['department:external'],
  },
  {
    id: 'patent',
    ext: 'docx',
    name: 'Patent_Filing_Draft.docx',
    size: '320 KB',
    msClass: 'c',
    msLabel: 'Confidential',
    owner: 'Carol Singh',
    ownerUser: 'carol',
    modified: 'July 7, 4:18 PM',
    visible: ['clearance:secret'],
    required: ['clearance:secret', 'role:counsel'],
  },
  {
    id: 'readme',
    ext: 'txt',
    name: 'Project_README.txt',
    size: '12 KB',
    msClass: 'u',
    msLabel: 'Unclassified',
    owner: 'Dave Kim',
    ownerUser: 'dave',
    modified: 'July 6, 9:00 AM',
    visible: [],
    required: [],
  },
]

const MS_LABEL_STYLES = {
  ts: { bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
  s:  { bg: '#fff7ed', color: '#9a3412', border: '#fdba74' },
  c:  { bg: '#fefce8', color: '#854d0e', border: '#fde047' },
  u:  { bg: '#f0fdf4', color: '#14532d', border: '#86efac' },
}

// Derive TDF policy from filename (PEP keyword detection simulation)
function derivePolicy(filename) {
  const lc = filename.toLowerCase()
  if (/secret|brief|threat|classified/.test(lc))
    return { msClass: 's', msLabel: 'Secret', required: ['clearance:secret'] }
  if (/legal|nda|contract|acquisition/.test(lc))
    return { msClass: 's', msLabel: 'Secret', required: ['clearance:secret', 'department:legal'] }
  if (/audit|infra|security/.test(lc))
    return { msClass: 's', msLabel: 'Secret', required: ['clearance:secret', 'department:it'] }
  return { msClass: 'u', msLabel: 'Unclassified', required: [] }
}

function canSee(file, attrs) {
  return file.visible.every(v => attrs.includes(v))
}

function canOpen(file, attrs) {
  return file.required.every(v => attrs.includes(v))
}

function fileEmail(ownerUser) {
  return `${ownerUser}.user@contoso.com`
}

function extColor(ext) {
  if (ext === 'pdf')  return '#ef4444'
  if (ext === 'docx') return '#2563eb'
  if (ext === 'xlsx') return '#16a34a'
  return '#64748b'
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ msg, onDone }) {
  return (
    <div style={{
      position: 'fixed', bottom: 28, right: 28, zIndex: 200,
      background: '#0f2035', border: '1px solid #22c55e44',
      borderLeft: '3px solid #22c55e',
      borderRadius: 10, padding: '12px 18px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'flex-start', gap: 10,
      maxWidth: 340,
      animation: 'fadeInUp 0.2s ease',
    }}>
      <span style={{ color: '#22c55e', fontSize: 16, flexShrink: 0 }}>✓</span>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc', marginBottom: 2 }}>{msg.title}</div>
        <div style={{ fontSize: 11, color: '#94a3b8' }}>{msg.sub}</div>
      </div>
      <button onClick={onDone} style={{
        marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer',
        color: '#475569', fontSize: 14, lineHeight: 1, flexShrink: 0,
      }}>✕</button>
    </div>
  )
}

// ── KAS Access Panel ──────────────────────────────────────────────────────────
function KasPanel({ file, attrs }) {
  if (!file) return (
    <div style={{ padding: '20px', textAlign: 'center', color: '#475569' }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>🔒</div>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8' }}>Select a file to open</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>KAS evaluates policy on every open attempt</div>
    </div>
  )

  const granted = canOpen(file, attrs)
  const labelStyle = MS_LABEL_STYLES[file.msClass] || MS_LABEL_STYLES.u

  return (
    <div>
      <div style={{
        padding: '10px 14px',
        background: granted ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
        borderBottom: '1px solid var(--c-border)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{granted ? '✅' : '🚫'}</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: granted ? '#4ade80' : '#f87171' }}>
            KAS: {granted ? 'ACCESS GRANTED' : 'ACCESS DENIED'}
          </div>
          <div style={{ fontSize: 11, color: '#64748b' }}>{file.name}</div>
        </div>
      </div>
      <div style={{ padding: '12px 14px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
          File Policy
        </div>
        {file.required.length === 0 ? (
          <div style={{ fontSize: 12, color: '#4ade80' }}>No restrictions — public</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {file.required.map(attr => {
              const has = attrs.includes(attr)
              return (
                <div key={attr} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '4px 8px', borderRadius: 4,
                  background: has ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                  border: `1px solid ${has ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
                }}>
                  <span style={{ fontSize: 12, color: has ? '#4ade80' : '#f87171' }}>{has ? '✓' : '✗'}</span>
                  <span style={{ fontSize: 12, fontFamily: 'monospace', color: has ? '#a7f3d0' : '#fca5a5' }}>{attr}</span>
                </div>
              )
            })}
          </div>
        )}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
            Sensitivity Label
          </div>
          <span style={{
            display: 'inline-block',
            padding: '2px 10px', borderRadius: 4, fontSize: 12, fontWeight: 700,
            background: labelStyle.bg, color: labelStyle.color, border: `1px solid ${labelStyle.border}`,
          }}>
            {file.msLabel}
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Upload Modal ──────────────────────────────────────────────────────────────
const PEP_STEPS = [
  'Reading sensitivity tags',
  'Deriving TDF policy',
  'Encrypting with KAS',
  'Writing to bucket',
]

function UploadModal({ onClose, onComplete }) {
  const [staged, setStaged] = useState(null)
  const [phase, setPhase] = useState('idle') // idle | processing | done
  const [stepIdx, setStepIdx] = useState(0)
  const [isDrag, setIsDrag] = useState(false)
  const fileRef = useRef()

  function stageFile(file) {
    if (!file) return
    setStaged(file)
    setPhase('idle')
    setStepIdx(0)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDrag(false)
    const f = e.dataTransfer?.files?.[0]
    if (f) stageFile(f)
  }

  function runUpload() {
    if (!staged) return
    setPhase('processing')
    setStepIdx(0)
    let i = 0
    const tick = () => {
      i++
      if (i < PEP_STEPS.length) {
        setStepIdx(i)
        setTimeout(tick, 600)
      } else {
        setPhase('done')
        setTimeout(() => {
          onComplete(staged)
          onClose()
        }, 500)
      }
    }
    setTimeout(tick, 600)
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div style={{
        background: '#0f2035',
        border: '1px solid #1e3a5f',
        borderRadius: 14,
        padding: '24px 28px',
        width: 420, maxWidth: '95vw',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
      }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc', margin: '0 0 4px' }}>Upload &amp; Encrypt File</h3>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 16px' }}>
          Virtru PEP reads the file's existing tags and applies TDF policy automatically before writing to the bucket.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setIsDrag(true) }}
          onDragLeave={() => setIsDrag(false)}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDrag ? '#3b82f6' : '#1e3a5f'}`,
            borderRadius: 10, padding: '28px 20px',
            textAlign: 'center', cursor: 'pointer',
            background: isDrag ? 'rgba(29,78,216,0.07)' : '#07111f',
            marginBottom: 14, transition: 'all 0.15s',
          }}
        >
          <input ref={fileRef} type="file" style={{ display: 'none' }} onChange={e => stageFile(e.target.files[0])} />
          <div style={{ fontSize: 28, marginBottom: 6 }}>📁</div>
          <div style={{ fontSize: 13, color: '#94a3b8' }}>Drop a file here or click to browse</div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>PDF, DOCX, XLSX, TXT — existing sensitivity tags will be detected</div>
        </div>

        {/* Staged file */}
        {staged && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', marginBottom: 14,
            background: '#07111f', border: '1px solid #1e3a5f', borderRadius: 8,
          }}>
            <span style={{ fontSize: 20 }}>📄</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {staged.name}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>
                {staged.size ? `${(staged.size / 1024).toFixed(0)} KB` : '—'}
              </div>
            </div>
          </div>
        )}

        {/* PEP steps */}
        {phase !== 'idle' && (
          <div style={{
            background: '#07111f', border: '1px solid #1e3a5f', borderRadius: 8,
            padding: '12px 14px', marginBottom: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8 }}>
              Virtru PEP
            </div>
            {PEP_STEPS.map((step, i) => {
              const done = i < stepIdx || phase === 'done'
              const active = i === stepIdx && phase === 'processing'
              return (
                <div key={step} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 0',
                  opacity: i > stepIdx && phase === 'processing' ? 0.35 : 1,
                  transition: 'opacity 0.3s',
                }}>
                  <span style={{ fontSize: 13, width: 16, flexShrink: 0 }}>
                    {done ? '✓' : active ? '⟳' : '○'}
                  </span>
                  <span style={{
                    fontSize: 12,
                    color: done ? '#4ade80' : active ? '#60a5fa' : '#475569',
                  }}>
                    {step}
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              background: 'transparent', border: '1px solid #1e3a5f', color: '#94a3b8',
            }}
          >
            Cancel
          </button>
          <button
            onClick={runUpload}
            disabled={!staged || phase === 'processing'}
            style={{
              padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: staged && phase === 'idle' ? 'pointer' : 'default',
              background: staged && phase === 'idle' ? '#1d4ed8' : '#1e3a5f',
              color: staged && phase === 'idle' ? '#fff' : '#475569',
              border: 'none', transition: 'all 0.15s',
            }}
          >
            Encrypt &amp; Upload
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Office file icon ──────────────────────────────────────────────────────────
function OfficeIcon({ ext, size = 18 }) {
  const c = extColor(ext)
  const label = ext === 'pdf' ? 'PDF' : ext === 'docx' ? 'W' : ext === 'xlsx' ? 'X' : ext.toUpperCase().slice(0, 2)
  return (
    <svg width={size} height={size} viewBox="0 0 18 18">
      <rect width="18" height="18" rx="2" fill={c} />
      <text x="9" y="13" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#fff" fontFamily="Arial">{label}</text>
    </svg>
  )
}

// ── SharePoint Shell ──────────────────────────────────────────────────────────
function SharePointShell({ files, activeFile, onSelect, onUpload, onDownload }) {
  const now = new Date()
  const dateStr = (s) => s.startsWith('Today') ? s : s

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", borderRadius: '0 0 10px 10px', overflow: 'hidden', border: '1px solid #c8c6c4', borderTop: 'none' }}>
      {/* O365 top bar */}
      <div style={{ background: '#1b1a19', height: 40, display: 'flex', alignItems: 'center', padding: '0 12px', gap: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, cursor: 'pointer', color: '#fff', borderRadius: 2 }}>
          <svg width="14" height="14" viewBox="0 0 12 12">
            {[0,1,2,3,5,6,7,8,10,11,12].filter((_, i) => i < 9).map((_, i) => (
              <rect key={i} x={(i % 3) * 5} y={Math.floor(i / 3) * 5} width="3.5" height="3.5" fill="#fff" rx="0.5" />
            ))}
          </svg>
        </div>
        <span style={{ color: '#fff', fontSize: 15, fontWeight: 300, marginLeft: 10, letterSpacing: '-0.3px' }}>
          Office 365 <span style={{ fontWeight: 600 }}>|</span> <span style={{ fontSize: 14 }}>Sites</span>
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#0078d4', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 700 }}>AC</div>
        </div>
      </div>

      {/* Ribbon */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e1dfdd', padding: '0 8px', display: 'flex', alignItems: 'stretch', height: 36 }}>
        {['BROWSE', 'FILES', 'LIBRARY'].map(tab => (
          <div key={tab} style={{
            padding: '0 14px', display: 'flex', alignItems: 'center', fontSize: 12, fontWeight: 600,
            color: tab === 'FILES' ? '#0078d4' : '#605e5c', cursor: 'pointer',
            borderBottom: tab === 'FILES' ? '2px solid #0078d4' : '2px solid transparent',
          }}>{tab}</div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, paddingRight: 8 }}>
          {['↓ SHARE', '☆ FOLLOW', '⤢'].map(lbl => (
            <span key={lbl} style={{ fontSize: 11, color: '#605e5c', cursor: 'pointer' }}>{lbl}</span>
          ))}
        </div>
      </div>

      {/* Site header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e1dfdd', padding: '0 16px', display: 'flex', alignItems: 'center', height: 44, gap: 0 }}>
        <div style={{ width: 32, height: 32, background: '#0078d4', borderRadius: 2, flexShrink: 0, marginRight: 16 }} />
        {['Demo', 'Community', 'Project', 'Team', 'Doc Center', 'Members'].map((t, i) => (
          <div key={t} style={{
            padding: '0 14px', height: '100%', display: 'flex', alignItems: 'center',
            fontSize: 13, color: i === 0 ? '#0078d4' : '#605e5c', cursor: 'pointer',
            borderBottom: i === 0 ? '2px solid #0078d4' : '2px solid transparent',
          }}>{t}</div>
        ))}
      </div>

      {/* Content */}
      <div style={{ background: '#fff', padding: '12px 16px', overflowX: 'auto' }}>
        <div style={{ fontSize: 20, fontWeight: 400, color: '#323130', marginBottom: 10 }}>Classified Documents</div>

        {/* Command bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
          {[['⊕ New', null], ['↑ Upload', onUpload], ['⟳ Sync', null], ['Share', null], ['More ▾', null]].map(([lbl, fn]) => (
            <button
              key={lbl}
              onClick={fn || undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '5px 10px', border: '1px solid #c8c6c4', borderRadius: 2,
                background: '#fff', fontSize: 12, fontWeight: 600, color: '#323130',
                cursor: fn ? 'pointer' : 'default',
              }}
            >{lbl}</button>
          ))}
        </div>

        {/* View bar */}
        <div style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid #e1dfdd', marginBottom: 4 }}>
          <div style={{ padding: '6px 12px', fontSize: 12, color: '#0078d4', borderBottom: '2px solid #0078d4', cursor: 'pointer' }}>All Documents</div>
          <div style={{ padding: '6px 12px', fontSize: 12, color: '#605e5c', cursor: 'pointer' }}>…</div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', border: '1px solid #c8c6c4', borderRadius: 1, overflow: 'hidden', height: 26 }}>
            <input placeholder="Find a file" style={{ border: 'none', outline: 'none', fontSize: 12, padding: '0 8px', width: 120, color: '#323130' }} />
            <div style={{ padding: '0 8px', background: '#f3f2f1', borderLeft: '1px solid #c8c6c4', height: '100%', display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 12, color: '#605e5c' }}>🔍</div>
          </div>
        </div>

        {/* Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e1dfdd' }}>
              <th style={{ width: 28 }}><input type="checkbox" /></th>
              <th style={{ width: 24 }}></th>
              <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#605e5c', padding: '6px 8px' }}>Name</th>
              <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#605e5c', padding: '6px 8px', whiteSpace: 'nowrap' }}>Modified</th>
              <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#605e5c', padding: '6px 8px', whiteSpace: 'nowrap' }}>Modified By</th>
              <th style={{ textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#605e5c', padding: '6px 8px' }}>Sensitivity</th>
              <th style={{ width: 70 }}></th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => {
              const ls = MS_LABEL_STYLES[f.msClass] || MS_LABEL_STYLES.u
              const sel = f.id === activeFile
              return (
                <tr
                  key={f.id}
                  onClick={() => onSelect(f.id)}
                  style={{
                    borderBottom: '1px solid #f3f2f1', cursor: 'pointer',
                    background: sel ? '#deecf9' : 'transparent',
                  }}
                >
                  <td style={{ padding: '5px 0 5px 4px' }}><input type="checkbox" checked={sel} readOnly onClick={e => e.stopPropagation()} /></td>
                  <td style={{ padding: '5px 4px' }}><OfficeIcon ext={f.ext} /></td>
                  <td style={{ padding: '5px 8px' }}>
                    <span style={{ fontSize: 13, color: '#0078d4', cursor: 'pointer', display: 'block', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {f.name}
                    </span>
                  </td>
                  <td style={{ padding: '5px 8px', fontSize: 12, color: '#605e5c', whiteSpace: 'nowrap' }}>{f.modified}</td>
                  <td style={{ padding: '5px 8px', fontSize: 12, color: '#605e5c', whiteSpace: 'nowrap' }}>{f.owner}</td>
                  <td style={{ padding: '5px 8px' }}>
                    <span style={{
                      display: 'inline-block', padding: '1px 8px', borderRadius: 3,
                      fontSize: 11, fontWeight: 700,
                      background: ls.bg, color: ls.color, border: `1px solid ${ls.border}`,
                      whiteSpace: 'nowrap',
                    }}>{f.msLabel}</span>
                  </td>
                  <td style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={e => { e.stopPropagation(); onDownload(f.id) }}
                      style={{
                        padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: 'rgba(0,120,212,0.08)', color: '#0078d4', border: '1px solid rgba(0,120,212,0.3)',
                      }}
                    >↓ .tdf</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ marginTop: 8, fontSize: 11, color: '#a19f9d', padding: '4px 0' }}>
          Drag files here to upload
        </div>
      </div>
    </div>
  )
}

// ── Amazon S3 Shell ───────────────────────────────────────────────────────────
function S3Shell({ files, activeFile, onSelect, onUpload, onDownload }) {
  return (
    <div style={{
      background: '#0f2035', border: '1px solid #1e3a5f', borderTop: 'none',
      borderRadius: '0 0 10px 10px', padding: '16px 20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid #1e3a5f' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M12 3L3 7v10l9 4 9-4V7L12 3z" fill="#ff9900" />
          <path d="M3 7l9 4 9-4M12 11v10" stroke="#fff" strokeWidth="1.5" fill="none" opacity=".8" />
        </svg>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#f8fafc' }}>corp-data-prod</div>
          <div style={{ fontSize: 12, color: '#64748b', fontFamily: 'monospace' }}>s3://corp-data-prod/classified/fy2026/</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onUpload}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 12px', background: '#1d4ed8', color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >↑ Upload &amp; Encrypt</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ width: 20 }}></th>
              <th style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #1e3a5f' }}>Key</th>
              <th style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #1e3a5f', width: 55 }}>Size</th>
              <th style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #1e3a5f', width: 110 }}>Last Modified</th>
              <th style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#475569', padding: '6px 10px', textAlign: 'left', borderBottom: '1px solid #1e3a5f', width: 90 }}>Encryption</th>
              <th style={{ width: 80, borderBottom: '1px solid #1e3a5f' }}></th>
            </tr>
          </thead>
          <tbody>
            {files.map(f => {
              const sel = f.id === activeFile
              return (
                <tr
                  key={f.id}
                  onClick={() => onSelect(f.id)}
                  style={{
                    borderBottom: '1px solid rgba(30,58,95,0.35)', cursor: 'pointer',
                    background: sel ? 'rgba(29,78,216,0.13)' : 'transparent',
                  }}
                >
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{ fontSize: 14 }}>{f.required.length ? '🔒' : '📄'}</span>
                  </td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{
                      color: '#60a5fa', fontFamily: 'monospace', fontSize: 12,
                      display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      classified/fy2026/{f.name}
                    </span>
                  </td>
                  <td style={{ padding: '9px 10px', fontSize: 11, color: '#64748b' }}>{f.size}</td>
                  <td style={{ padding: '9px 10px', fontSize: 11, color: '#64748b', whiteSpace: 'nowrap' }}>{f.modified}</td>
                  <td style={{ padding: '9px 10px' }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 3,
                      ...(f.required.length
                        ? { background: 'rgba(29,78,216,0.13)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.27)' }
                        : { background: 'rgba(134,239,172,0.07)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.2)' })
                    }}>
                      {f.required.length ? 'TDF' : 'plaintext'}
                    </span>
                  </td>
                  <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={e => { e.stopPropagation(); onDownload(f.id) }}
                      style={{
                        padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: 'rgba(29,78,216,0.13)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.27)',
                      }}
                    >↓ .tdf</button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span id="s3-count">{files.length} objects · {files.filter(f => f.required.length).length} TDF-protected</span>
      </div>
    </div>
  )
}

// ── Virtru Collaborate Shell ──────────────────────────────────────────────────
const VIRTRU_LOGOMARK = `<svg width="22" height="22" viewBox="0 0 296.7 296.7" xmlns="http://www.w3.org/2000/svg">
  <path fill="#fff" d="M114.6,105.3L114.6,105.3l0,98.4c5.6-0.7,15.7-3.2,15.7-3.2c24.4-6.3,70.8-30.3,70.8-85.9c0-7.1-5.8-12.9-12.9-12.9c-7.1,0-12.9,5.8-12.9,12.9c0,31.1-19.9,47-34.7,54.5v-0.8v-62.9h0H114.6z"/>
  <path fill="#fff" d="M274.6,70.5c-0.3,5.3-2.9,10.4-7.5,13.8c-5.1,3.7-11.5,4.5-17.1,2.5c-0.2-0.4-0.5-0.8-0.7-1.2c12.9,20.7,19.5,45.5,17.6,71.6c-4.9,65.5-62,114.6-127.5,109.6C73.9,262,24.8,205,29.7,139.5C34.7,74,91.7,24.9,157.2,29.9c14.6,1.1,28.4,4.8,41,10.7c-0.4-0.2-0.8-0.4-1.2-0.6c5.2,2.5,11.6,1.7,16.2-2.3c6.1-5.4,6.6-14.8,1.2-20.9c-1.1-1.2-2.3-2.1-3.6-2.9c-15.7-7.3-33-12-51.3-13.4C77.8-5.7,6.6,55.5,0.4,137.2C-5.7,219,55.5,290.2,137.2,296.3c81.7,6.1,152.9-55.1,159.1-136.8C298.8,127,290.5,96.3,274.6,70.5z"/>
  <path fill="rgba(255,255,255,0.5)" d="M273.5,68.7c-0.5-0.8-1-1.6-1.5-2.3c-0.4-0.5-0.7-1-1.1-1.6c-0.7-1-1.3-2-2-2.9c-2-2.8-4.1-5.5-6.3-8.2c0,0,0,0,0-0.1c-0.4-0.5-0.9-1-1.3-1.5c-0.2-0.2-0.3-0.4-0.5-0.6c-0.2-0.3-0.5-0.5-0.7-0.8c-0.7-0.8-1.4-1.6-2.2-2.4c-0.7-0.7-1.4-1.5-2.1-2.2c-0.5-0.5-1-1.1-1.5-1.6c-1.1-1.2-2.3-2.3-3.5-3.4c-0.1-0.1-0.2-0.2-0.3-0.3c-6.7-6.3-14-12.1-21.8-17.1c0.1,0,0.1,0.1,0.1,0.1c-3-1.9-6.1-3.8-9.2-5.5c-0.7-0.4-1.3-0.7-2-1.1c-0.2-0.1-0.3-0.2-0.5-0.2c-2.1-1.1-4.2-2.1-6.3-3.1c1.3,0.8,2.5,1.7,3.6,2.9c5.4,6.1,4.9,15.5-1.2,20.9c-4.6,4.1-11,4.8-16.2,2.3c0.4,0.2,0.8,0.4,1.2,0.6c0.5,0.3,1.1,0.5,1.6,0.8c1.4,0.7,2.7,1.3,4,2c7.9,4.2,15.3,9.3,22.1,15.1c1.3,1.1,2.5,2.2,3.8,3.4c0.1,0.1,0.2,0.2,0.2,0.2c1,0.9,2,1.9,2.9,2.9c0.4,0.4,0.8,0.8,1.2,1.3c0.5,0.6,1.1,1.2,1.6,1.7c0.6,0.7,1.3,1.4,1.9,2.1c0,0,0,0.1,0.1,0.1c3.2,3.6,6.1,7.5,8.8,11.4c0.3,0.5,0.7,1,1,1.5c0.6,0.9,1.1,1.7,1.7,2.6c0.2,0.4,0.5,0.8,0.7,1.2c5.6,2,12,1.2,17.1-2.5c4.6-3.4,7.2-8.5,7.5-13.8C274.2,69.9,273.9,69.3,273.5,68.7z"/>
</svg>`

function VcFileIcon({ ext }) {
  const c = extColor(ext)
  return (
    <div style={{
      width: 36, height: 36, background: '#f0f2f5', borderRadius: 4,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '1px solid #e2e5ea', flexShrink: 0,
    }}>
      <OfficeIcon ext={ext} size={20} />
    </div>
  )
}

function CollaborateShell({ files, activeFile, onSelect, onUpload, onDownload, userEmail }) {
  const initials = userEmail.slice(0, 2).toUpperCase()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderRadius: '0 0 10px 10px', overflow: 'hidden', border: '1px solid #c5cdd6', borderTop: 'none', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Blue header */}
      <div style={{ background: 'linear-gradient(135deg, #0d3c6e 0%, #1565a8 60%, #1a7abf 100%)', padding: '14px 20px', display: 'flex', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }} dangerouslySetInnerHTML={{ __html: VIRTRU_LOGOMARK }} />
          <span style={{ color: '#fff', fontSize: 17, fontWeight: 300, letterSpacing: '-0.5px' }}>virtru</span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '5px 12px 5px 6px' }}>
          <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{initials}</div>
          <span style={{ fontSize: 12, color: '#fff', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userEmail}</span>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>›</span>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', background: '#f5f6f8', minHeight: 320 }}>
        {/* Content */}
        <div style={{ flex: 1, minWidth: 0, background: '#fff', margin: 12, borderRadius: 8, border: '1px solid #e2e5ea', overflowX: 'auto' }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #e2e5ea' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#1a56db', marginBottom: 8 }}>
              <span style={{ cursor: 'pointer' }}>Workspaces</span>
              <span style={{ color: '#8a96a3' }}>›</span>
              <span style={{ color: '#1a2b45' }}>classified-ops</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 24, fontWeight: 400, color: '#1a2b45', letterSpacing: '-0.5px' }}>classified-ops</div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button style={{ width: 32, height: 32, border: '1px solid #c5cdd6', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#4a5568', fontSize: 14 }}>⤢</button>
                <button onClick={onUpload} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', background: '#1a56db', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>＋ Add</button>
              </div>
            </div>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e2e5ea' }}>
                <th style={{ width: 44 }}></th>
                <th style={{ fontSize: 12, fontWeight: 600, color: '#8a96a3', padding: '10px 16px', textAlign: 'left', minWidth: 160, maxWidth: 220 }}>Name</th>
                <th style={{ fontSize: 12, fontWeight: 600, color: '#8a96a3', padding: '10px 16px', textAlign: 'left', width: 60 }}>Size</th>
                <th style={{ fontSize: 12, fontWeight: 600, color: '#1a2b45', padding: '10px 16px', textAlign: 'left', width: 120, whiteSpace: 'nowrap' }}>Last Modified ↓</th>
                <th style={{ fontSize: 12, fontWeight: 600, color: '#8a96a3', padding: '10px 16px', textAlign: 'left', width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map(f => {
                const sel = f.id === activeFile
                return (
                  <tr
                    key={f.id}
                    onClick={() => onSelect(f.id)}
                    style={{ cursor: 'pointer', borderBottom: '1px solid #f0f2f5', background: sel ? '#eef3fd' : 'transparent' }}
                  >
                    <td style={{ padding: '12px 0 12px 16px' }}><VcFileIcon ext={f.ext} /></td>
                    <td style={{ padding: '12px 16px', maxWidth: 220 }}>
                      <div style={{ fontSize: 13, color: '#1a2b45', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{f.name}</div>
                      <div style={{ fontSize: 11, color: '#8a96a3', marginTop: 2 }}>{f.required.length ? '🔐 TDF Protected' : 'No policy'}</div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#4a5568', whiteSpace: 'nowrap' }}>{f.size}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#4a5568', whiteSpace: 'nowrap' }}>
                      {f.modified.replace('Today, ', '').replace('July ', '')}
                    </td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                      <button
                        onClick={e => { e.stopPropagation(); onDownload(f.id) }}
                        style={{ padding: '3px 9px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: 'rgba(26,86,219,0.08)', color: '#1a56db', border: '1px solid rgba(26,86,219,0.2)', marginRight: 6 }}
                      >↓ .tdf</button>
                      <span style={{ color: '#8a96a3', cursor: 'pointer', fontSize: 16 }}>⋯</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const BUCKET_TABS = [
  { id: 'sharepoint', label: 'SharePoint', icon: '🟦' },
  { id: 's3',         label: 'Amazon S3',  icon: '🟧' },
  { id: 'collaborate',label: 'Collaborate', icon: '🔵' },
]

export default function CollaboratePage() {
  const { activePersona, personas, setActivePersona } = useDemo()
  const attrs = activePersona.attributes ?? []

  const [extraFiles, setExtraFiles] = useState([])
  const [activeBucket, setActiveBucket] = useState('sharepoint')
  const [activeFile, setActiveFile]     = useState(null)
  const [showUpload, setShowUpload]     = useState(false)
  const [toast, setToast]               = useState(null)
  const toastTimer = useRef(null)

  const allFiles = [...extraFiles, ...BASE_FILES]
  const visibleFiles = allFiles.filter(f => canSee(f, attrs))
  const selectedFile = visibleFiles.find(f => f.id === activeFile) ?? null

  function showToast(title, sub) {
    clearTimeout(toastTimer.current)
    setToast({ title, sub })
    toastTimer.current = setTimeout(() => setToast(null), 4000)
  }

  function handleDownload(fileId) {
    const f = allFiles.find(x => x.id === fileId)
    if (!f) return
    showToast(`${f.name} encrypted & downloaded`, 'Downloaded as .tdf — policy travels with the file')
  }

  function handleUploadComplete(rawFile) {
    const policy = derivePolicy(rawFile.name)
    const ext = rawFile.name.split('.').pop() || 'txt'
    const newFile = {
      id: `upload-${Date.now()}`,
      ext,
      name: rawFile.name,
      size: rawFile.size ? `${(rawFile.size / 1024).toFixed(0)} KB` : '—',
      msClass: policy.msClass,
      msLabel: policy.msLabel,
      owner: activePersona.name,
      ownerUser: activePersona.username,
      modified: 'Today, just now',
      visible: policy.required.length ? [policy.required[0]] : [],
      required: policy.required,
    }
    setExtraFiles(prev => [newFile, ...prev])
    showToast(`${rawFile.name} encrypted & uploaded`, 'Policy derived from sensitivity tags by Virtru PEP')
  }

  const userEmail = `${activePersona.username}@contoso.com`

  return (
    <div style={{ padding: 24, maxWidth: 1340, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Hero */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--c-text-1)', margin: 0 }}>Collaborate</h1>
        <p style={{ fontSize: 13, color: 'var(--c-text-5)', lineHeight: 1.5, maxWidth: 680, margin: 0 }}>
          Files in shared buckets — SharePoint, S3, or Virtru Collaborate — stay policy-bound wherever they go. Users only see files they're entitled to. Attempts to open protected files are evaluated live at KAS.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* Left: bucket viewer */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Bucket tabs */}
          <div style={{
            display: 'flex', borderRadius: '10px 10px 0 0', overflow: 'hidden',
            background: '#0f2035', border: '1px solid #1e3a5f', borderBottom: 'none',
          }}>
            {BUCKET_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveBucket(tab.id)}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 7, padding: '10px 20px', border: 'none',
                  borderRight: tab.id !== 'collaborate' ? '1px solid #1e3a5f' : 'none',
                  background: activeBucket === tab.id ? 'rgba(29,78,216,0.13)' : 'transparent',
                  color: activeBucket === tab.id ? '#60a5fa' : '#64748b',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>

          {/* Shell */}
          {activeBucket === 'sharepoint' && (
            <SharePointShell
              files={visibleFiles}
              activeFile={activeFile}
              onSelect={setActiveFile}
              onUpload={() => setShowUpload(true)}
              onDownload={handleDownload}
            />
          )}
          {activeBucket === 's3' && (
            <S3Shell
              files={visibleFiles}
              activeFile={activeFile}
              onSelect={setActiveFile}
              onUpload={() => setShowUpload(true)}
              onDownload={handleDownload}
            />
          )}
          {activeBucket === 'collaborate' && (
            <CollaborateShell
              files={visibleFiles}
              activeFile={activeFile}
              onSelect={setActiveFile}
              onUpload={() => setShowUpload(true)}
              onDownload={handleDownload}
              userEmail={userEmail}
            />
          )}
        </div>

        {/* Right: persona + KAS panel */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* Persona selector */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
              Who is viewing this bucket?
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {personas.map(p => (
                <button
                  key={p.id}
                  onClick={() => { setActivePersona(p); setActiveFile(null) }}
                  title={`${p.name} — ${p.title}`}
                  style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    padding: '8px 4px', borderRadius: 8, cursor: 'pointer',
                    background: activePersona.id === p.id ? p.color + '18' : 'var(--c-surface-2)',
                    border: `2px solid ${activePersona.id === p.id ? p.color : 'transparent'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <span style={{ fontSize: 18 }}>{p.avatar}</span>
                  <span style={{ fontSize: 10, color: activePersona.id === p.id ? p.color : 'var(--c-text-5)', fontWeight: activePersona.id === p.id ? 700 : 400 }}>
                    {p.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>

            {/* Active persona chip */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: activePersona.color + '22', border: `2px solid ${activePersona.color}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>
                {activePersona.avatar}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>{activePersona.name}</div>
                <div style={{ fontSize: 11, color: 'var(--c-text-5)', marginBottom: 6 }}>{activePersona.title}</div>
                {attrs.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {attrs.map(a => (
                      <span key={a} style={{
                        fontSize: 10, fontWeight: 500, padding: '2px 7px', borderRadius: 4,
                        background: activePersona.color + '12', color: activePersona.color,
                        border: `1px solid ${activePersona.color}25`,
                      }}>{a}</span>
                    ))}
                  </div>
                )}
                {attrs.length === 0 && (
                  <span style={{ fontSize: 11, color: 'var(--c-text-6)' }}>No entitlements</span>
                )}
              </div>
            </div>

            <button
              onClick={() => { /* select file to demo */ }}
              style={{
                marginTop: 12, width: '100%', padding: '9px 0', borderRadius: 8,
                background: '#1d4ed8', color: '#fff', border: 'none',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {selectedFile ? `Open "${selectedFile.name.split('_')[0]}…"` : 'Select a file to open'}
            </button>
          </div>

          {/* KAS access panel */}
          <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
            <KasPanel file={selectedFile} attrs={attrs} />
          </div>
        </div>
      </div>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onComplete={handleUploadComplete}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  )
}
