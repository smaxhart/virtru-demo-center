import { useMemo } from 'react'
import { useApp } from '../context/AppContext.jsx'

const fmtTime = (d) => d.toLocaleTimeString([], { hour12: false })

export default function AuditPage() {
  const { auditLog, clearAudit, modeId, modes } = useApp()

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
              which is usually the more interesting half.
            </div>
          </div>
          {auditLog.length > 0 && (
            <button onClick={clearAudit} style={{
              flexShrink: 0, fontSize: 11, padding: '6px 12px', borderRadius: 7, cursor: 'pointer',
              background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text-4)',
            }}>Clear</button>
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
