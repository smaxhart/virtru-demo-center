import React, { useState } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import Icon from '../components/Icon.jsx'

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

  const RESULT_COLORS = {
    granted: { text: '#16a34a', bg: '#dcfce7', border: '#86efac', row: 'transparent' },
    denied:  { text: '#dc2626', bg: '#fee2e2', border: '#fca5a5', row: '#ef444406' },
    revoked: { text: '#d97706', bg: '#fef3c7', border: '#fde68a', row: '#f59e0b06' },
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100, margin: '0 auto' }}>

      {/* Page hero */}
      <div className="page-hero">
        <div>
          <p className="page-subtitle">
            Every access attempt — granted, denied, or revoked — is cryptographically signed,
            tamper-evident, and ready for CMMC, FedRAMP, and STIG auditors.
          </p>
        </div>
        <div className="page-actions" style={{ gap: 10, alignItems: 'flex-start' }}>
          <button onClick={exportCsv} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', background: 'var(--c-surface-2)',
            color: 'var(--c-text-3)', border: '1px solid var(--c-border)',
          }}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          {
            label: 'Total Events', value: total, color: '#60a5fa',
            sub: mostActive ? `Most active: ${mostActive[0]}` : null,
          },
          {
            label: 'Granted', value: granted, color: '#4ade80',
            sub: `${grantRate}% grant rate ${last3Rate !== null ? (trendUp ? '↑ trending up' : '↓ trending down') : ''}`,
          },
          {
            label: 'Denied', value: denied, color: '#f87171',
            sub: denied > total * 0.4 ? '⚠ elevated denial rate' : 'nominal',
          },
          {
            label: 'Revoked', value: revoked, color: '#fb923c',
            sub: revoked > 0 ? 'policy changes logged' : 'no revocations',
          },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--c-text-5)', marginBottom: 6 }}>
              {s.label}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: 11, marginTop: 6, color: 'var(--c-text-5)' }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Persona filter banner */}
      {isPersonaFiltered && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', borderRadius: 8, fontSize: 13,
          background: activePersona.color + '18',
          border: `1px solid ${activePersona.color}44`,
        }}>
          <span style={{ fontSize: 18 }}>{activePersona.avatar}</span>
          <span style={{ color: activePersona.color, fontWeight: 600 }}>Showing events for {activePersona.name}</span>
          <span style={{ fontSize: 11, color: 'var(--c-text-5)' }}>— switch to Generic to see all users</span>
        </div>
      )}

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', transition: 'all 0.15s',
            background: filter === f ? '#1e3a5f' : 'var(--c-surface)',
            color: filter === f ? '#60a5fa' : 'var(--c-text-4)',
            border: `1px solid ${filter === f ? '#3b82f6' : 'var(--c-border)'}`,
          }}>
            {f}
            {f !== 'All' && (
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.7 }}>
                ({f === 'Granted' ? granted : f === 'Denied' ? denied : revoked})
              </span>
            )}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--c-text-5)' }}>
          {filtered.length} event{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Event table */}
      <div style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)', borderRadius: 12, overflow: 'hidden' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--c-text-5)' }}>
            No events match this filter.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--c-border)' }}>
                {['Time', 'User', 'Document', 'Result', 'Reason'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 16px',
                    fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.5px', color: 'var(--c-text-5)',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((e, i) => {
                const rc = RESULT_COLORS[e.result] ?? RESULT_COLORS.denied
                const isExpanded = expandedRows.has(e.id)
                const missing = getMissingAttrs(e.reason)
                return (
                  <React.Fragment key={e.id}>
                    <tr
                      onClick={() => toggleRow(e.id)}
                      style={{
                        borderBottom: '1px solid var(--c-border)',
                        background: rc.row,
                        cursor: 'pointer',
                        transition: 'background 0.1s',
                      }}
                    >
                      <td style={{ padding: '10px 16px', borderLeft: `3px solid ${rc.text}` }}>
                        <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--c-text-4)', whiteSpace: 'nowrap' }}>{fmtTs(e.ts)}</div>
                        <div style={{ fontSize: 10, color: 'var(--c-text-6)' }}>{fmtRelative(e.ts)}</div>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{e.persona.avatar}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: e.persona.color }}>{e.persona.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--c-text-2)' }}>{e.document}</td>
                      <td style={{ padding: '10px 16px' }}>
                        <span style={{
                          padding: '3px 10px', borderRadius: 99,
                          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                          background: rc.bg, color: rc.text, border: `1px solid ${rc.border}`,
                        }}>
                          {e.result}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--c-text-4)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <span>{e.reason}</span>
                          <span style={{ fontSize: 10, color: 'var(--c-text-6)', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded detail row */}
                    {isExpanded && (
                      <tr key={`${e.id}-detail`} style={{ background: 'var(--c-surface-2)', borderBottom: '1px solid var(--c-border)' }}>
                        <td colSpan={5} style={{ padding: '12px 24px' }}>
                          <div style={{ display: 'flex', gap: 32 }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--c-text-5)', marginBottom: 8 }}>
                                {e.persona.name}'s attributes at time of access
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                                {(e.persona.fqns?.length > 0 ? e.persona.fqns : ['No attributes recorded']).map((fqn, fi) => (
                                  <span key={fi} style={{
                                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                                    background: e.persona.color + '18',
                                    color: e.persona.color,
                                    border: `1px solid ${e.persona.color}30`,
                                    fontFamily: 'monospace',
                                  }}>{fqn}</span>
                                ))}
                              </div>
                            </div>
                            {missing.length > 0 && (
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#dc2626', marginBottom: 8 }}>
                                  Access denied — missing required attributes
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                                  {missing.map((attr, mi) => (
                                    <span key={mi} style={{
                                      padding: '2px 8px', borderRadius: 4, fontSize: 11,
                                      background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5',
                                      fontFamily: 'monospace', fontWeight: 600,
                                    }}>{attr}</span>
                                  ))}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--c-text-5)', fontStyle: 'italic' }}>
                                  KAS returned HTTP 403 — the file was not decrypted.
                                </div>
                              </div>
                            )}
                            {e.result === 'revoked' && (
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#d97706', marginBottom: 8 }}>
                                  Policy change recorded
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--c-text-4)' }}>{e.reason}</div>
                                <div style={{ fontSize: 11, color: 'var(--c-text-5)', marginTop: 4, fontStyle: 'italic' }}>
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
