import { useMemo, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { saveText } from '../api/download.js'

const fmtTime = (d) => d.toLocaleTimeString([], { hour12: false })

/**
 * The log as a file someone else can read.
 *
 * A demo that ends at "look, it was denied" stops one step short of the thing a CISO actually has
 * to produce. The exportable record is the deliverable: it names the subject, the object, the
 * verdict, and — the column that makes it evidence rather than an anecdote — the attribute that
 * withheld it.
 *
 * CSV, not the app's internal shape: the audience for this file is a spreadsheet and a GRC tool.
 * JSON is offered alongside for anything that wants the structure back intact.
 */
const COLUMNS = [
  ['timestamp',   e => e.at.toISOString()],
  ['mode',        e => e.mode ?? ''],
  ['verdict',     e => (e.granted ? 'GRANT' : 'DENY')],
  ['subject',     e => e.persona ?? ''],
  ['subject_id',  e => e.personaId ?? ''],
  ['agent',       e => e.agent ?? ''],
  ['agent_id',    e => e.agentId ?? ''],
  ['object',      e => e.document ?? ''],
  ['tier',        e => e.tier ?? ''],
  ['marking',     e => e.classification ?? ''],
  // The whole point of the column. Space-separated so one cell holds a compound shortfall
  // (`cui:sp-cti ldc:noforn`) without needing a nested quoting convention.
  ['controlling_attributes', e => (e.missing ?? []).join(' ')],
  ['blocked_subject', e => e.blockedBy ?? ''],
  ['rewrap_attempts', e => String(e.attempts ?? '')],
  ['reason',      e => e.reason ?? ''],
]

/** RFC 4180 quoting: double the quotes, wrap anything with a comma, quote or newline in them. */
const csvCell = (v) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

function toCsv(log) {
  // Oldest first. The log is newest-first on screen because that is where attention goes, but a
  // record read end to end is a sequence of events, and a reversed one reads as a different story.
  const rows = [...log].reverse()
  return [
    COLUMNS.map(([name]) => name).join(','),
    ...rows.map(e => COLUMNS.map(([, get]) => csvCell(get(e))).join(',')),
  ].join('\r\n') + '\r\n'
}

export default function AuditPage() {
  const { auditLog, clearAudit, modeId, modes } = useApp()
  const [saved, setSaved] = useState(null) // null | 'csv' | 'json' | 'error'

  const exportLog = useCallback(async (format) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    try {
      const where = format === 'csv'
        ? await saveText(`virtru-access-decisions-${stamp}.csv`, toCsv(auditLog), 'text/csv')
        : await saveText(
            `virtru-access-decisions-${stamp}.json`,
            JSON.stringify([...auditLog].reverse(), null, 2),
            'application/json',
          )
      setSaved(where ? format : null) // null = the save dialog was dismissed
    } catch {
      setSaved('error')
    }
  }, [auditLog])

  const stats = useMemo(() => {
    const granted = auditLog.filter(e => e.granted).length
    const modeCount = new Set(auditLog.map(e => e.mode).filter(Boolean)).size
    // Counted separately because it is a different failure from an uncleared user: the person
    // was entitled and the machine acting for them was not.
    const agentBlocked = auditLog.filter(e => e.blockedBy === 'agent').length
    return { total: auditLog.length, granted, denied: auditLog.length - granted, modes: modeCount, agentBlocked }
  }, [auditLog])

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: 20 }}>
      <div style={{ maxWidth: 940, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text-1)' }}>Audit</div>
            <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginTop: 4, lineHeight: 1.65, maxWidth: 640 }}>
              Every access decision this session, in order, across every mode you have opened —
              the log outlives a mode switch on purpose. Denials are recorded the same way grants
              are; in a real deployment this is the record showing a request was made and refused,
              which is usually the more interesting half. Each denial names the attribute that
              withheld it, which is what an assessor asks for against NIST 800-171 3.1.1 and
              3.1.3: not that access is limited, but evidence of which rule limited it.
            </div>
          </div>
          {auditLog.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              <button onClick={() => exportLog('csv')}
                title="Every decision this session as CSV, oldest first — including the attribute that withheld each denial"
                style={{
                  fontSize: 11, padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                  background: 'var(--c-surface-2)',
                  border: `1px solid ${saved === 'error' ? 'var(--c-deny-br)' : 'var(--c-border)'}`,
                  color: saved === 'csv' ? 'var(--c-grant)' : saved === 'error' ? 'var(--c-deny)' : 'var(--c-text-4)',
                }}>{saved === 'csv' ? '✓ Saved CSV' : saved === 'error' ? 'Save failed' : 'Export CSV'}</button>
              <button onClick={() => exportLog('json')} title="The same records with their structure intact" style={{
                fontSize: 11, padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
                color: saved === 'json' ? 'var(--c-grant)' : 'var(--c-text-4)',
              }}>{saved === 'json' ? '✓ Saved JSON' : 'JSON'}</button>
              <button onClick={clearAudit} style={{
                fontSize: 11, padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
                background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text-4)',
              }}>Clear</button>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          {[
            { label: 'DECISIONS', value: stats.total,   color: 'var(--c-text-2)' },
            { label: 'GRANTED',   value: stats.granted, color: 'var(--c-grant)' },
            { label: 'DENIED',    value: stats.denied,  color: 'var(--c-deny)' },
            { label: 'MODES',     value: stats.modes,   color: 'var(--c-text-4)' },
            // Only once it has happened — a permanent zero would read as an unused feature.
            ...(stats.agentBlocked > 0
              ? [{ label: 'AGENT BLOCKED', value: stats.agentBlocked, color: 'var(--c-warn)' }]
              : []),
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '11px 16px', minWidth: 108 }}>
              <div style={{ fontSize: 21, fontWeight: 700, color: s.color, lineHeight: 1.1 }}>{s.value}</div>
              <div className="section-label" style={{ marginTop: 3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {auditLog.length === 0 ? (
          <div className="card" style={{ padding: 26, textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-5)', lineHeight: 1.65 }}>
              No decisions yet. Ask something on the Secure Chat page, or try a decrypt from
              the Corpus page.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 24 }}>
            {auditLog.map(e => (
              <div key={e.id} className="card" style={{
                padding: '10px 13px', display: 'flex', gap: 12, alignItems: 'flex-start',
                borderLeft: `3px solid ${e.granted ? 'var(--c-grant)' : 'var(--c-deny)'}`,
              }}>
                <span className="mono" style={{ fontSize: 10, color: 'var(--c-text-6)', flexShrink: 0, paddingTop: 2 }}>
                  {fmtTime(e.at)}
                </span>

                <span style={{
                  flexShrink: 0, fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4,
                  background: e.granted ? 'var(--c-grant-bg)' : 'var(--c-deny-bg)',
                  color: e.granted ? 'var(--c-grant)' : 'var(--c-deny)',
                  border: `1px solid ${e.granted ? 'var(--c-grant-br)' : 'var(--c-deny-br)'}`,
                }}>{e.granted ? 'GRANT' : 'DENY'}</span>

                {/* Mode chip, dimmed when the event came from the mode you are in now */}
                {(() => {
                  const m = modes.find(x => x.id === e.mode)
                  if (!m) return null
                  return (
                    <span
                      title={m.name}
                      style={{
                        flexShrink: 0, fontSize: 9.5, fontWeight: 600, padding: '2px 7px',
                        borderRadius: 4, display: 'flex', alignItems: 'center', gap: 4,
                        background: m.accent + '14', color: m.accent,
                        border: `1px solid ${m.accent}30`,
                        opacity: e.mode === modeId ? 1 : 0.65,
                      }}
                    >
                      <span>{m.icon}</span>{m.short}
                    </span>
                  )
                })()}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--c-text-2)' }}>
                    <strong style={{ fontWeight: 600 }}>{e.persona}</strong>
                    {/* Both subjects named, because the same person through a different agent is
                        a different decision and the log has to be able to tell them apart. */}
                    {e.agent && (
                      <span style={{ color: 'var(--c-text-5)' }}> via {e.agent}</span>
                    )}
                    <span style={{ color: 'var(--c-text-5)' }}> → </span>
                    {e.document}
                    {e.tier && <span style={{ color: 'var(--c-warn)' }}> · {e.tier}</span>}
                    {e.blockedBy === 'agent' && (
                      <span style={{ color: 'var(--c-warn)', fontWeight: 600 }}> · agent blocked</span>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--c-text-5)', marginTop: 3, lineHeight: 1.55 }}>
                    {e.reason}
                    {e.attempts > 1 && ` · ${e.attempts} rewrap attempts`}
                  </div>
                  {/* The controlling attribute. Without it a row says a refusal happened; with it
                      the row says what did the refusing, which is the difference between a log and
                      an audit record. Grants have no shortfall, so nothing renders on them. */}
                  {e.missing?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5, alignItems: 'baseline' }}>
                      <span className="section-label">WITHHELD BY</span>
                      {e.missing.map(m => (
                        <span key={m} className="mono" style={{
                          fontSize: 9, padding: '1px 5px', borderRadius: 4,
                          background: 'var(--c-deny-bg)', color: 'var(--c-deny)',
                          border: '1px solid var(--c-deny-br)',
                        }}>{m}</span>
                      ))}
                    </div>
                  )}
                </div>

                {e.classification && (
                  <span className="mono" style={{
                    flexShrink: 0, fontSize: 9.5, color: 'var(--c-text-6)', paddingTop: 2, textAlign: 'right',
                  }}>{e.classification}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
