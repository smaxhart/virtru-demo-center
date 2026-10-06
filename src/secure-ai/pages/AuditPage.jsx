import { useMemo, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { saveText } from '../api/download.js'
import UiIcon from '../../components/UiIcon.jsx'
import PersonaIcon from '../components/PersonaIcon.jsx'

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
    <div style={{ height: '100%', overflowY: 'auto' }}>
      <div className="page" style={{ maxWidth: 1040 }}>

        <div className="page-hero">
          <div>
            <h1 className="page-title">Audit</h1>
            <p className="page-subtitle" style={{ maxWidth: '72ch' }}>
              Every access decision this session, in order, across every mode you have opened,
              because the log outlives a mode switch on purpose. Denials are recorded the same way
              grants are; in a real deployment this is the record showing a request was made and
              refused, which is usually the more interesting half. Each denial names the attribute
              that withheld it, which is what an assessor asks for against NIST 800-171 3.1.1 and
              3.1.3: not that access is limited, but evidence of which rule limited it.
            </p>
          </div>
          {auditLog.length > 0 && (
            <div className="page-actions">
              <button className="btn btn-sm" onClick={() => exportLog('csv')}
                title="Every decision this session as CSV, oldest first, including the attribute that withheld each denial"
                style={saved === 'error'
                  ? { borderColor: 'var(--c-deny-br)', color: 'var(--c-deny)' }
                  : saved === 'csv' ? { color: 'var(--c-grant)' } : undefined}
              >
                {saved === 'csv' && <UiIcon name="check" size={13} strokeWidth={2.4} />}
                {saved === 'csv' ? 'Saved CSV' : saved === 'error' ? 'Save failed' : 'Export CSV'}
              </button>
              <button className="btn btn-sm" onClick={() => exportLog('json')}
                title="The same records with their structure intact"
                style={saved === 'json' ? { color: 'var(--c-grant)' } : undefined}>
                {saved === 'json' && <UiIcon name="check" size={13} strokeWidth={2.4} />}
                {saved === 'json' ? 'Saved JSON' : 'JSON'}
              </button>
              <button className="btn btn-sm btn-ghost" onClick={clearAudit}>Clear</button>
            </div>
          )}
        </div>

        <div className="sai-stats">
          {[
            { label: 'Decisions', value: stats.total,   color: 'var(--c-text-1)' },
            { label: 'Granted',   value: stats.granted, color: 'var(--c-grant)' },
            { label: 'Denied',    value: stats.denied,  color: 'var(--c-deny)' },
            { label: 'Modes',     value: stats.modes,   color: 'var(--c-text-1)' },
            // Only once it has happened — a permanent zero would read as an unused feature.
            ...(stats.agentBlocked > 0
              ? [{ label: 'Agent blocked', value: stats.agentBlocked, color: 'var(--c-warn)' }]
              : []),
          ].map(s => (
            <div key={s.label} className="sai-stat">
              <b style={{ color: s.color }}>{s.value}</b>
              <span>{s.label}</span>
            </div>
          ))}
        </div>

        {auditLog.length === 0 ? (
          <div className="card" style={{ padding: 32, textAlign: 'center' }}>
            <div style={{ fontSize: 13.5, color: 'var(--c-text-4)', lineHeight: 1.65 }}>
              No decisions yet. Ask something on the Secure Chat page, or try a decrypt from
              the Corpus page.
            </div>
          </div>
        ) : (
          <div className="sai-log">
            {auditLog.map((e) => (
              <div key={e.id} className={`sai-entry${e.granted ? '' : ' is-deny'}`}>
                <span className="mono num" style={{ fontSize: 11.5, color: 'var(--c-text-5)', flexShrink: 0, paddingTop: 3 }}>
                  {fmtTime(e.at)}
                </span>

                <span className={`chip ${e.granted ? 'chip-grant' : 'chip-deny'}`} style={{ flexShrink: 0, fontWeight: 700 }}>
                  {e.granted ? 'GRANT' : 'DENY'}
                </span>

                {/* Mode chip, dimmed when the event came from the mode you are in now */}
                {(() => {
                  const m = modes.find(x => x.id === e.mode)
                  if (!m) return null
                  return (
                    <span
                      title={m.name}
                      className="chip"
                      style={{
                        flexShrink: 0, gap: 5,
                        background: m.accent + '14', color: m.accent,
                        borderColor: m.accent + '30',
                        opacity: e.mode === modeId ? 1 : 0.65,
                      }}
                    >
                      <PersonaIcon icon={m.icon} size={12} />{m.short}
                    </span>
                  )
                })()}

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: 'var(--c-text-2)' }}>
                    <strong style={{ fontWeight: 650, color: 'var(--c-text-1)' }}>{e.persona}</strong>
                    {/* Both subjects named, because the same person through a different agent is
                        a different decision and the log has to be able to tell them apart. */}
                    {e.agent && (
                      <span style={{ color: 'var(--c-text-5)' }}> via {e.agent}</span>
                    )}
                    <span style={{ color: 'var(--c-text-5)' }}> requested </span>
                    {e.document}
                    {e.tier && <span style={{ color: 'var(--c-warn)' }}>, {e.tier}</span>}
                    {e.blockedBy === 'agent' && (
                      <span style={{ color: 'var(--c-warn)', fontWeight: 600 }}>, agent blocked</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginTop: 3, lineHeight: 1.55 }}>
                    {e.reason}
                    {e.attempts > 1 && `, ${e.attempts} rewrap attempts`}
                  </div>
                  {/* The controlling attribute. Without it a row says a refusal happened; with it
                      the row says what did the refusing, which is the difference between a log and
                      an audit record. Grants have no shortfall, so nothing renders on them. */}
                  {e.missing?.length > 0 && (
                    <div className="sai-withheld">
                      <span>Withheld by</span>
                      {e.missing.map(m => (
                        <span key={m} className="sai-shut-chip">{m}</span>
                      ))}
                    </div>
                  )}
                </div>

                {e.classification && (
                  <span className="mono" style={{
                    flexShrink: 0, fontSize: 11.5, color: 'var(--c-text-5)', paddingTop: 3, textAlign: 'right',
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
