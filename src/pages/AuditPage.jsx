import React, { useState } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import UiIcon from '../components/UiIcon.jsx'

const FILTERS = ['All', 'Granted', 'Denied', 'Revoked']

function fmtTs(isoStr) {
  const d = new Date(isoStr)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function fmtRelative(isoStr) {
  const diff = Date.now() - new Date(isoStr).getTime()
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function getMissingAttrs(reason) {
  const m = reason?.match(/Missing:\s*(.+)/)
  if (!m) return []
  return m[1].split(/,\s*/).filter(Boolean)
}

export default function AuditPage() {
  const { eventLog, activePersona } = useDemo()
  const [filter, setFilter]           = useState('All')
  const [expandedRows, setExpandedRows] = useState(new Set())

  const isPersonaFiltered = activePersona.id !== 'generic'

  const filtered = eventLog.filter(e => {
    if (isPersonaFiltered && e.persona?.id !== activePersona.id) return false
    if (filter === 'All') return true
    return e.result === filter.toLowerCase()
  })

  const scopedLog = isPersonaFiltered ? eventLog.filter(e => e.persona?.id === activePersona.id) : eventLog
  const total   = scopedLog.length
  const granted = scopedLog.filter(e => e.result === 'granted').length
  const denied  = scopedLog.filter(e => e.result === 'denied').length
  const revoked = scopedLog.filter(e => e.result === 'revoked').length
  const grantRate = total > 0 ? Math.round((granted / total) * 100) : 0

  // Trend: compare last 3 events to overall rate
  const last3 = scopedLog.slice(0, 3)
  const last3Granted = last3.filter(e => e.result === 'granted').length
  const last3Rate = last3.length > 0 ? last3Granted / last3.length : null
  const trendUp = last3Rate !== null && last3Rate > grantRate / 100

  const personaCounts = {}
  eventLog.forEach(e => {
    personaCounts[e.persona.name] = (personaCounts[e.persona.name] || 0) + 1
  })
  const mostActive = Object.entries(personaCounts).sort((a, b) => b[1] - a[1])[0]

  function toggleRow(id) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function exportCsv() {
    const rows = [
      ['Time (ISO)', 'User', 'Document', 'Result', 'Reason'],
      ...filtered.map(e => [e.ts, e.persona.name, e.document, e.result, e.reason]),
    ]
    const csv = rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dsp-audit-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const CHIP = { granted: 'chip-grant', denied: 'chip-deny', revoked: 'chip-warn' }
  const EDGE = { granted: 'var(--c-grant)', denied: 'var(--c-deny)', revoked: 'var(--c-warn)' }
  const label = (r) => r.charAt(0).toUpperCase() + r.slice(1)

  const stats = [
    {
      label: 'Total events', value: total, color: 'var(--c-text-1)',
      sub: mostActive ? `Most active: ${mostActive[0]}` : null,
    },
    {
      label: 'Granted', value: granted, color: 'var(--c-grant)',
      sub: `${grantRate}% grant rate${last3Rate !== null ? (trendUp ? ', trending up' : ', trending down') : ''}`,
    },
    {
      label: 'Denied', value: denied, color: 'var(--c-deny)',
      sub: denied > total * 0.4 ? 'Elevated denial rate' : 'Nominal',
    },
    {
      label: 'Revoked', value: revoked, color: 'var(--c-text-1)',
      sub: revoked > 0 ? 'Policy changes logged' : 'No revocations',
    },
  ]

  return (
    <div className="page">

      <div className="page-hero">
        <p className="page-subtitle">
          Every access attempt, whether granted, denied or revoked, is cryptographically signed,
          tamper-evident, and ready for CMMC, FedRAMP, and STIG auditors.
        </p>
        <div className="page-actions">
          <button type="button" className="btn" onClick={exportCsv}>Export CSV</button>
        </div>
      </div>

      {/* Stats: one strip, not four cards */}
      <div className="card" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {stats.map((s, i) => (
          <div key={s.label} style={{ padding: '16px 20px', borderLeft: i === 0 ? 'none' : '1px solid var(--c-border)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-text-5)', marginBottom: 6 }}>{s.label}</div>
            <div className="num" style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.02em', color: s.color, lineHeight: 1 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 12, marginTop: 8, color: 'var(--c-text-5)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Persona filter note */}
      {isPersonaFiltered && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          padding: '10px 14px', borderRadius: 'var(--c-radius-btn)', fontSize: 13,
          background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
        }}>
          <Dot persona={activePersona} />
          <span style={{ color: 'var(--c-text-1)', fontWeight: 600 }}>Showing events for {activePersona.name}</span>
          <span style={{ fontSize: 12.5, color: 'var(--c-text-5)' }}>Switch to Generic to see all users.</span>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div className="seg" role="group" aria-label="Filter events by result">
          {FILTERS.map(f => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)}>
              {f}
              {f !== 'All' && (
                <span className="num" style={{ marginLeft: 6, fontSize: 12, opacity: 0.65, fontWeight: 500 }}>
                  {f === 'Granted' ? granted : f === 'Denied' ? denied : revoked}
                </span>
              )}
            </button>
          ))}
        </div>
        <span className="num" style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--c-text-5)' }}>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Event table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--c-text-5)' }}>
            No events match this filter.
          </div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                {['Time', 'User', 'Document', 'Result', 'Reason'].map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => {
                const isExpanded = expandedRows.has(e.id)
                const missing = getMissingAttrs(e.reason)
                return (
                  <React.Fragment key={e.id}>
                    <tr onClick={() => toggleRow(e.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ boxShadow: `inset 3px 0 0 ${EDGE[e.result] ?? EDGE.denied}`, paddingLeft: 16 }}>
                        <div className="num" style={{ fontSize: 12.5, fontFamily: 'var(--font-mono)', color: 'var(--c-text-3)', whiteSpace: 'nowrap' }}>{fmtTs(e.ts)}</div>
                        <div className="num" style={{ fontSize: 11.5, color: 'var(--c-text-5)' }}>{fmtRelative(e.ts)}</div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Dot persona={e.persona} />
                          <span style={{ fontWeight: 600, color: 'var(--c-text-1)' }}>{e.persona.name}</span>
                        </div>
                      </td>
                      <td>{e.document}</td>
                      <td>
                        <span className={`chip ${CHIP[e.result] ?? 'chip-deny'}`}>{label(e.result)}</span>
                      </td>
                      <td style={{ fontSize: 12.5, color: 'var(--c-text-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span>{e.reason}</span>
                          <UiIcon name="chevron" size={14} style={{ color: 'var(--c-text-6)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .12s' }} />
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${e.id}-detail`}>
                        <td colSpan={5} style={{ padding: '14px 24px', background: 'var(--c-surface-2)' }}>
                          <div style={{ display: 'flex', gap: 32 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--c-text-4)', marginBottom: 8 }}>
                                {e.persona.name}'s attributes at time of access
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(e.persona.fqns?.length > 0 ? e.persona.fqns : ['No attributes recorded']).map((fqn, fi) => (
                                  <span key={fi} className="chip chip-mono">{fqn}</span>
                                ))}
                              </div>
                            </div>
                            {missing.length > 0 && (
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--c-deny)', marginBottom: 8 }}>
                                  Access denied: missing required attributes
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                  {missing.map((attr, mi) => (
                                    <span key={mi} className="chip chip-mono chip-deny">{attr}</span>
                                  ))}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--c-text-5)' }}>
                                  KAS returned HTTP 403 and the file was not decrypted.
                                </div>
                              </div>
                            )}
                            {e.result === 'revoked' && (
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--c-warn)', marginBottom: 8 }}>
                                  Policy change recorded
                                </div>
                                <div style={{ fontSize: 12.5, color: 'var(--c-text-4)' }}>{e.reason}</div>
                                <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginTop: 4 }}>
                                  All subsequent decrypt attempts will be denied.
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// Persona marker: initials on the persona's own colour, matching the topbar.
const inkOn = (hex) => {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return '#fff'
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.62 ? '#0a1a33' : '#ffffff'
}

function Dot({ persona }) {
  const generic = persona.id === 'generic'
  const letters = persona.name.trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase()
  return (
    <span aria-hidden="true" style={{
      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: generic ? 'var(--c-surface-3)' : persona.color,
      color: generic ? 'var(--c-text-4)' : inkOn(persona.color),
      fontSize: 10, fontWeight: 700,
    }}>{generic ? <UiIcon name="user" size={13} strokeWidth={1.9} /> : letters}</span>
  )
}
