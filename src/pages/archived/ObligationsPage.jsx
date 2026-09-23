import { useState, useEffect } from 'react'
import { useDemo } from '../../context/DemoContext.jsx'
import { OBLIGATIONS_DATA } from '../../data/sectors.js'
import Icon from '../../components/Icon.jsx'

const { definitions, clearanceLevels, sampleDocument } = OBLIGATIONS_DATA

const drmObligations = definitions.filter(d => d.category === 'drm')
const accessObligations = definitions.filter(d => d.category === 'access')

// ── Syntax-highlighted JSON renderer ──────────────────────────────────────────

function buildDecisionJson(selectedOblIds) {
  const obligations = definitions
    .filter(d => selectedOblIds.has(d.id))
    .map(d => {
      if (d.id === 'watermark') return { fqn: d.fqn, data: { text: '${username} / ${email}' } }
      if (d.id === 'time-limit') return { fqn: d.fqn, data: { duration: d.param } }
      return { fqn: d.fqn }
    })
  return { decision: 'PERMIT', obligations }
}

function JsonHighlight({ obj }) {
  const lines = JSON.stringify(obj, null, 2).split('\n')

  function highlightLine(line) {
    // Match key: "someKey":
    const keyPattern = /^(\s*)("[\w-]+")\s*:/
    // Detect value type after colon
    const full = line

    const keyMatch = full.match(keyPattern)
    const indent = keyMatch ? keyMatch[1] : (full.match(/^(\s*)/)?.[1] ?? '')

    let rest = keyMatch ? full.slice(indent.length + keyMatch[2].length + 1) : full.slice(indent.length)
    // rest starts with optional space then value or just value line

    const tokens = []

    if (keyMatch) {
      tokens.push(<span key="indent">{indent}</span>)
      tokens.push(<span key="key" style={{ color: '#60a5fa' }}>{keyMatch[2]}</span>)
      tokens.push(<span key="colon">:</span>)

      // parse value portion
      const valTrimmed = rest.trim()

      if (valTrimmed === '"PERMIT"' || valTrimmed === '"PERMIT",') {
        const comma = valTrimmed.endsWith(',') ? ',' : ''
        tokens.push(<span key="sp"> </span>)
        tokens.push(<span key="val" style={{ color: '#4ade80', fontWeight: 700 }}>{'"PERMIT"'}</span>)
        tokens.push(<span key="comma">{comma}</span>)
      } else if (/^"https:\/\/example\.com\/obl\//.test(valTrimmed)) {
        const comma = valTrimmed.endsWith(',') ? ',' : ''
        const raw = valTrimmed.replace(/,$/, '')
        tokens.push(<span key="sp"> </span>)
        tokens.push(<span key="val" style={{ color: '#fbbf24' }}>{raw}</span>)
        tokens.push(<span key="comma">{comma}</span>)
      } else if (/^"/.test(valTrimmed)) {
        const comma = valTrimmed.endsWith(',') ? ',' : ''
        const raw = valTrimmed.replace(/,$/, '')
        tokens.push(<span key="sp"> </span>)
        tokens.push(<span key="val" style={{ color: '#4ade80' }}>{raw}</span>)
        tokens.push(<span key="comma">{comma}</span>)
      } else {
        tokens.push(<span key="rest">{rest}</span>)
      }
    } else {
      tokens.push(<span key="raw">{full}</span>)
    }

    return tokens
  }

  return (
    <pre
      style={{
        backgroundColor: '#0f172a',
        color: '#e2e8f0',
        borderRadius: 8,
        padding: '14px 16px',
        fontSize: 12,
        lineHeight: 1.65,
        overflowX: 'auto',
        margin: 0,
        fontFamily: "'Fira Code', 'Cascadia Code', 'Menlo', monospace",
      }}
    >
      {lines.map((line, i) => (
        <div key={i}>{highlightLine(line)}</div>
      ))}
    </pre>
  )
}

// ── Step breakdown ─────────────────────────────────────────────────────────────

function StepRow({ num, label, detail }) {
  return (
    <div className="flex gap-3 items-start">
      <div
        style={{
          minWidth: 22,
          height: 22,
          borderRadius: '50%',
          backgroundColor: '#3b82f6',
          color: '#fff',
          fontSize: 11,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {num}
      </div>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-1)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--c-text-4)', marginTop: 2 }}>{detail}</div>
      </div>
    </div>
  )
}

// ── Document viewer mockup ─────────────────────────────────────────────────────

function DocumentViewer({ evaluated, selectedOblIds, pepChoice, onHonor, onRefuse }) {
  const classColor = clearanceLevels.find(c => c.value === 'secret')?.color ?? '#f97316'

  const isHonored = pepChoice === 'honor'
  const isRefused = pepChoice === 'refuse'
  const hasWatermark = selectedOblIds.has('watermark')
  const hasNoDownload = selectedOblIds.has('no-download')
  const hasMfa = selectedOblIds.has('require-mfa')
  const hasTimeLimit = selectedOblIds.has('time-limit')

  const placeholder = !evaluated

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Document frame */}
      <div
        style={{
          border: '1px solid var(--c-border)',
          borderRadius: 8,
          overflow: 'hidden',
          backgroundColor: 'var(--c-bg)',
          position: 'relative',
          minHeight: 220,
        }}
      >
        {/* Classification banner */}
        <div
          style={{
            backgroundColor: classColor,
            color: '#fff',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textAlign: 'center',
            padding: '4px 0',
          }}
        >
          {sampleDocument.classification}
        </div>

        {/* Document header */}
        <div style={{ padding: '10px 14px 6px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--c-text-1)' }}>
            {sampleDocument.title}
          </div>
        </div>

        {/* Document body */}
        <div style={{ padding: '10px 14px', position: 'relative' }}>
          {/* Blurred text lines */}
          <div
            style={{
              filter: placeholder || isRefused ? 'blur(3px)' : isHonored ? 'none' : 'blur(3px)',
              userSelect: 'none',
              fontSize: 12,
              color: 'var(--c-text-3)',
              lineHeight: 1.7,
            }}
          >
            {sampleDocument.preview.split('\n').map((line, i) => (
              <div key={i}>{line || <>&nbsp;</>}</div>
            ))}
          </div>

          {/* Watermark overlay */}
          {isHonored && hasWatermark && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'rgba(239,68,68,0.35)',
                  transform: 'rotate(-30deg)',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap',
                  border: '1.5px solid rgba(239,68,68,0.25)',
                  padding: '2px 10px',
                  borderRadius: 4,
                }}
              >
                alice.chen@corp.com / 2024-03-15 14:22Z
              </div>
            </div>
          )}

          {/* Access denied overlay */}
          {isRefused && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(239,68,68,0.08)',
              }}
            >
              <div
                style={{
                  backgroundColor: '#ef4444',
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  padding: '8px 20px',
                  borderRadius: 6,
                  transform: 'rotate(-5deg)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                }}
              >
                ACCESS DENIED
              </div>
            </div>
          )}

          {/* Pre-evaluation overlay */}
          {placeholder && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0,0,0,0.3)',
                borderRadius: 4,
              }}
            >
              <span style={{ fontSize: 11, color: 'var(--c-text-4)' }}>Awaiting PDP decision…</span>
            </div>
          )}
        </div>

        {/* Obligation badges when honored */}
        {isHonored && (
          <div
            style={{
              padding: '6px 14px 8px',
              borderTop: '1px solid var(--c-border)',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {hasMfa && (
              <span style={{ fontSize: 10, backgroundColor: '#1d4ed8', color: '#bfdbfe', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
                MFA VERIFIED
              </span>
            )}
            {hasNoDownload && (
              <span style={{ fontSize: 10, backgroundColor: '#7f1d1d', color: '#fca5a5', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
                DOWNLOAD BLOCKED
              </span>
            )}
            {hasTimeLimit && (
              <span style={{ fontSize: 10, backgroundColor: '#78350f', color: '#fcd34d', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
                SESSION: 30m
              </span>
            )}
            {hasWatermark && (
              <span style={{ fontSize: 10, backgroundColor: '#14532d', color: '#86efac', borderRadius: 4, padding: '2px 7px', fontWeight: 600 }}>
                WATERMARKED
              </span>
            )}
          </div>
        )}

        {/* Download button area */}
        {isHonored && (
          <div style={{ padding: '0 14px 10px' }}>
            <button
              disabled={hasNoDownload}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid var(--c-border)',
                backgroundColor: hasNoDownload ? 'var(--c-surface)' : '#1e3a5f',
                color: hasNoDownload ? 'var(--c-text-5)' : '#93c5fd',
                cursor: hasNoDownload ? 'not-allowed' : 'pointer',
                textDecoration: hasNoDownload ? 'line-through' : 'none',
                opacity: hasNoDownload ? 0.6 : 1,
              }}
            >
              Download
            </button>
            {hasNoDownload && (
              <span style={{ fontSize: 10, color: '#f87171', marginLeft: 6 }}>blocked by obligation</span>
            )}
          </div>
        )}
      </div>

      {/* Scenario buttons */}
      {evaluated && !pepChoice && (
        <div className="flex gap-3">
          <button
            onClick={onHonor}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: 6,
              border: '1px solid #16a34a',
              backgroundColor: '#14532d',
              color: '#86efac',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Honor Obligations
          </button>
          <button
            onClick={onRefuse}
            style={{
              flex: 1,
              padding: '9px 0',
              borderRadius: 6,
              border: '1px solid #b91c1c',
              backgroundColor: '#7f1d1d',
              color: '#fca5a5',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Refuse Obligations
          </button>
        </div>
      )}

      {/* Reset button when choice made */}
      {pepChoice && (
        <button
          onClick={() => { onHonor(null) }}
          style={{
            fontSize: 11,
            padding: '6px 0',
            borderRadius: 6,
            border: '1px solid var(--c-border)',
            backgroundColor: 'var(--c-surface)',
            color: 'var(--c-text-4)',
            cursor: 'pointer',
          }}
        >
          ← Try another scenario
        </button>
      )}

      {/* Status line */}
      {pepChoice === 'honor' && (
        <div
          style={{
            fontSize: 12,
            color: '#4ade80',
            backgroundColor: 'rgba(74,222,128,0.08)',
            border: '1px solid rgba(74,222,128,0.25)',
            borderRadius: 6,
            padding: '8px 12px',
            fontWeight: 500,
          }}
        >
          Access granted — obligations enforced ✓
        </div>
      )}
      {pepChoice === 'refuse' && (
        <div
          style={{
            backgroundColor: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 6,
            padding: '8px 12px',
          }}
        >
          <div style={{ fontSize: 12, color: '#f87171', fontWeight: 600, marginBottom: 4 }}>
            PEP refused obligation compliance → Access denied
          </div>
          <div style={{ fontSize: 11, color: 'var(--c-text-4)' }}>
            A PEP that cannot or will not honor obligations must deny access
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ObligationsPage() {
  useDemo() // consume context (sector, techMode available if needed)

  const [clearanceLevel, setClearanceLevel] = useState('secret')
  const [selectedOblIds, setSelectedOblIds] = useState(new Set(['watermark', 'no-download']))
  const [evaluated, setEvaluated] = useState(false)
  const [pepChoice, setPepChoice] = useState(null) // null | 'honor' | 'refuse'

  // Reset evaluated + pepChoice when inputs change
  function handleClearanceChange(val) {
    setClearanceLevel(val)
    setEvaluated(false)
    setPepChoice(null)
  }

  function toggleObligation(id) {
    setSelectedOblIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setEvaluated(false)
    setPepChoice(null)
  }

  function handleEvaluate() {
    setEvaluated(true)
    setPepChoice(null)
  }

  function handlePepReset() {
    setPepChoice(null)
  }

  const selectedCount = selectedOblIds.size
  const decisionObj = buildDecisionJson(selectedOblIds)
  const selectedClearance = clearanceLevels.find(c => c.value === clearanceLevel)

  return (
    <div style={{ padding: '24px 28px', minHeight: '100%' }}>

      {/* ── Key concept banner ─────────────────────────────────────────────── */}
      <div
        style={{
          backgroundColor: 'rgba(96,165,250,0.07)',
          border: '1px solid rgba(96,165,250,0.2)',
          borderRadius: 8,
          padding: '12px 16px',
          marginBottom: 20,
          fontSize: 13,
          color: 'var(--c-text-3)',
          lineHeight: 1.6,
        }}
      >
        <span style={{ fontWeight: 700, color: 'var(--c-text-1)' }}>What are Obligations?</span>{' '}
        TDF policy can include obligations — requirements the PEP must fulfill when rendering protected content.
        Common obligations: watermarking, download restrictions, MFA requirements, time limits.
        The PDP issues a PERMIT + obligations; the PEP must honor all of them or deny access.

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(96,165,250,0.15)' }}>
          <span style={{ fontWeight: 700, color: 'var(--c-text-1)' }}>Obligation Triggers</span> are fired by a combination of:
          <div style={{ marginLeft: 12, marginTop: 6, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px' }}>
            <span style={{ color: '#fbbf24' }}>•</span> <span><strong>Action</strong> (optional) — e.g., "transmit", "standard", or custom CRUD</span>
            <span style={{ color: '#a78bfa' }}>•</span> <span><strong>Attribute Value</strong> (optional) — e.g., classification:top-secret</span>
            <span style={{ color: '#06b6d4' }}>•</span> <span><strong>PEP identifier</strong> (optional) — when omitted, the obligation is <em>global</em> (applies to all PEPs)</span>
          </div>
        </div>

        <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(96,165,250,0.15)' }}>
          <span style={{ fontWeight: 700, color: 'var(--c-text-1)' }}>Namespace Hierarchy:</span>{' '}
          Multiple Namespaces → Definitions → Values → Triggers. Each obligation follows the pattern:{' '}
          <code style={{ background: '#0f172a', color: '#60a5fa', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
            https://example.com/obl/&lt;name&gt;/value/&lt;value&gt;
          </code>
        </div>
      </div>

      {/* ── 3-column grid ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '30% 35% 35%',
          gap: 16,
          alignItems: 'start',
        }}
      >

        {/* ── LEFT: Policy Builder ─────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 14 }}>
            Policy Configuration
          </div>

          {/* Document clearance selector */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
              Document Clearance
            </div>
            <div className="flex flex-col gap-2">
              {clearanceLevels.map(cl => (
                <button
                  key={cl.value}
                  onClick={() => handleClearanceChange(cl.value)}
                  style={{
                    padding: '7px 10px',
                    borderRadius: 6,
                    border: `1.5px solid ${clearanceLevel === cl.value ? cl.color : 'var(--c-border)'}`,
                    backgroundColor: clearanceLevel === cl.value ? `${cl.color}22` : 'var(--c-bg)',
                    color: clearanceLevel === cl.value ? cl.color : 'var(--c-text-3)',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    textAlign: 'left',
                    letterSpacing: '0.05em',
                    transition: 'all 0.15s',
                  }}
                >
                  {cl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Obligation checkboxes */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-4)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 8 }}>
              Obligations
            </div>

            {/* DRM group */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                DRM
              </div>
              <div className="flex flex-col gap-2">
                {drmObligations.map(obl => (
                  <ObligationCheckbox
                    key={obl.id}
                    obl={obl}
                    checked={selectedOblIds.has(obl.id)}
                    onToggle={() => toggleObligation(obl.id)}
                  />
                ))}
              </div>
            </div>

            {/* Access group */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--c-text-5)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 5 }}>
                Access
              </div>
              <div className="flex flex-col gap-2">
                {accessObligations.map(obl => (
                  <ObligationCheckbox
                    key={obl.id}
                    obl={obl}
                    checked={selectedOblIds.has(obl.id)}
                    onToggle={() => toggleObligation(obl.id)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Evaluate button */}
          <button
            onClick={handleEvaluate}
            disabled={selectedCount === 0}
            style={{
              width: '100%',
              padding: '10px 0',
              borderRadius: 7,
              border: 'none',
              backgroundColor: selectedCount === 0 ? 'var(--c-border)' : '#2563eb',
              color: selectedCount === 0 ? 'var(--c-text-5)' : '#fff',
              fontSize: 13,
              fontWeight: 700,
              cursor: selectedCount === 0 ? 'not-allowed' : 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Evaluate →
          </button>
          {selectedCount === 0 && (
            <div style={{ fontSize: 11, color: 'var(--c-text-5)', marginTop: 5, textAlign: 'center' }}>
              Select at least one obligation
            </div>
          )}
        </div>

        {/* ── CENTER: PDP Decision ─────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 14 }}>
            PDP Response
          </div>

          {!evaluated ? (
            <Placeholder text="Configure policy and click Evaluate →" />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Decision badge */}
              <div className="flex items-center gap-2">
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    padding: '3px 10px',
                    borderRadius: 5,
                    backgroundColor: 'rgba(74,222,128,0.12)',
                    border: '1px solid rgba(74,222,128,0.3)',
                    color: '#4ade80',
                  }}
                >
                  PERMIT
                </span>
                <span style={{ fontSize: 11, color: 'var(--c-text-4)' }}>
                  with {selectedCount} obligation{selectedCount !== 1 ? 's' : ''}
                </span>
              </div>

              {/* JSON block */}
              <JsonHighlight obj={decisionObj} />

              {/* Step breakdown */}
              <div className="flex flex-col gap-3" style={{ marginTop: 2 }}>
                <StepRow
                  num={1}
                  label="Attribute check"
                  detail={`Persona has clearance ≥ ${selectedClearance?.label ?? clearanceLevel.toUpperCase()} → PERMIT`}
                />
                <StepRow
                  num={2}
                  label="Obligation lookup"
                  detail={`Policy registry returns ${selectedCount} obligation${selectedCount !== 1 ? 's' : ''} for this clearance level`}
                />
                <StepRow
                  num={3}
                  label="Response assembled"
                  detail="Decision + obligations returned to PEP"
                />
              </div>

              {/* Explainer box */}
              <div
                style={{
                  backgroundColor: 'rgba(251,191,36,0.07)',
                  border: '1px solid rgba(251,191,36,0.2)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  fontSize: 11,
                  color: 'var(--c-text-4)',
                  lineHeight: 1.6,
                  marginTop: 2,
                }}
              >
                The PDP cannot compel PEP enforcement. The PDP returns obligations alongside its decision — but a PEP that refuses to honor an obligation <strong style={{ color: 'var(--c-text-3)' }}>MUST</strong> deny access entirely rather than proceed without the obligation.
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: PEP Simulation ────────────────────────────────────────── */}
        <div
          style={{
            backgroundColor: 'var(--c-surface)',
            border: '1px solid var(--c-border)',
            borderRadius: 10,
            padding: 16,
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 14 }}>
            PEP (Policy Enforcement Point)
          </div>

          {!evaluated ? (
            <Placeholder text="Configure policy and click Evaluate →" />
          ) : (
            <DocumentViewer
              evaluated={evaluated}
              selectedOblIds={selectedOblIds}
              pepChoice={pepChoice}
              onHonor={pepChoice === null ? () => setPepChoice('honor') : handlePepReset}
              onRefuse={() => setPepChoice('refuse')}
            />
          )}
        </div>

      </div>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────────────────────────

function ObligationCheckbox({ obl, checked, onToggle }) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        cursor: 'pointer',
        padding: '6px 8px',
        borderRadius: 6,
        border: `1px solid ${checked ? 'rgba(96,165,250,0.35)' : 'var(--c-border)'}`,
        backgroundColor: checked ? 'rgba(96,165,250,0.06)' : 'var(--c-bg)',
        transition: 'all 0.12s',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        style={{ marginTop: 2, accentColor: '#3b82f6', cursor: 'pointer' }}
      />
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, flex: 1 }}>
        <div style={{ marginTop: 1, color: checked ? '#60a5fa' : 'var(--c-text-5)', flexShrink: 0 }}>
          <Icon name={obl.icon} size={13} />
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: checked ? 'var(--c-text-1)' : 'var(--c-text-3)' }}>
            {obl.label}
          </div>
          <div style={{ fontSize: 10, color: 'var(--c-text-5)', marginTop: 1, lineHeight: 1.4 }}>
            {obl.desc}
          </div>
        </div>
      </div>
    </label>
  )
}

function Placeholder({ text }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 140,
        borderRadius: 7,
        border: '1.5px dashed var(--c-border-2)',
        color: 'var(--c-text-5)',
        fontSize: 12,
        fontStyle: 'italic',
        textAlign: 'center',
        padding: 16,
      }}
    >
      {text}
    </div>
  )
}
