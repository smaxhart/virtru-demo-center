import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import PersonaIcon from './PersonaIcon.jsx'
import BootGate from './BootGate.jsx'
import { AI_ROOT, aiPath } from '../routes.js'

const NAV = [
  { path: 'chat',   label: 'Secure Chat', hint: 'Ask questions against the corpus' },
  { path: 'corpus', label: 'Corpus',      hint: 'The encrypted documents and who can open them' },
  { path: 'audit',  label: 'Audit',       hint: 'Every KAS decision this session' },
  { path: 'how',    label: 'How it works', hint: 'Why the enforcement point sits here' },
]

/**
 * A hand-rolled dropdown rather than a <select>: an <option> can only hold text, so the
 * persona icons could not appear in a native one. Icons in the switcher matter here because
 * this is the control a presenter reaches for most.
 *
 * Used for both entitled subjects — the person and the agent — because they are peers in the
 * decision and giving them different controls would suggest otherwise.
 */
function SubjectSwitcher({ subjects, activeId, onPick, width = 230 }) {
  const { corpusPhase } = useApp()
  const active = subjects.find(s => s.id === activeId) ?? null
  const ready = corpusPhase === 'ready'
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false) }
    const onKey  = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Switching modes swaps the list; a menu left open over stale names is worse than one
  // that simply closed.
  useEffect(() => setOpen(false), [activeId])

  if (subjects.length === 0) return null

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        onClick={() => ready && setOpen(o => !o)}
        disabled={!ready}
        aria-haspopup="listbox"
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          fontSize: 12, padding: '5px 9px', borderRadius: 8, maxWidth: width,
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          color: 'var(--c-text-2)', cursor: ready ? 'pointer' : 'not-allowed',
          opacity: ready ? 1 : 0.6,
        }}
      >
        {active && (
          <span style={{ color: active.color, display: 'flex' }}>
            <PersonaIcon icon={active.icon} badge={active.badge} size={16} />
          </span>
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {active?.name ?? '—'}
        </span>
        <span style={{ fontSize: 9, color: 'var(--c-text-6)' }}>▾</span>
      </button>

      {open && (
        <div role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 5px)', right: 0, zIndex: 50,
          minWidth: 250, padding: 4, borderRadius: 9,
          background: 'var(--c-surface)', border: '1px solid var(--c-border)',
          boxShadow: '0 10px 28px rgba(0,0,0,0.45)',
        }}>
          {subjects.map(s => {
            const on = s.id === activeId
            return (
              <button
                key={s.id}
                role="option"
                aria-selected={on}
                onClick={() => { onPick(s.id); setOpen(false) }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9, width: '100%',
                  padding: '7px 9px', borderRadius: 6, textAlign: 'left', cursor: 'pointer',
                  background: on ? s.color + '18' : 'transparent',
                  border: `1px solid ${on ? s.color + '55' : 'transparent'}`,
                }}
              >
                <span style={{ color: on ? s.color : 'var(--c-text-5)', display: 'flex' }}>
                  <PersonaIcon icon={s.icon} badge={s.badge} size={17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: 12, fontWeight: on ? 600 : 500,
                    color: on ? s.color : 'var(--c-text-2)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{s.name}</span>
                  <span style={{
                    display: 'block', fontSize: 10, color: 'var(--c-text-5)', marginTop: 1,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{s.title}</span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default function Layout() {
  const {
    platformPhase, corpusPhase, mode, persona,
    personas, personaId, setPersonaId,
    agents, agentId, setAgentId,
  } = useApp()
  const ready = platformPhase === 'ready' && corpusPhase === 'ready' && mode && persona
  const status = platformPhase === 'error' || corpusPhase === 'error' ? 'error'
    : ready ? 'ready' : 'busy'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>

      {/* Mode bar. Was the window title bar in the standalone app, hence the traffic-light
          clearance and the drag region that used to be here — inside Demo Center the window
          chrome and the sidebar belong to the app, so this is just a strip within a page. */}
      <header style={{
        flexShrink: 0, height: 52, display: 'flex', alignItems: 'center',
        gap: 14, padding: '0 16px',
        borderBottom: '1px solid var(--c-border)', background: 'var(--c-surface)',
      }}>
        {/* The mode badge doubles as the way back to the launcher */}
        <Link
          to={AI_ROOT}
          title="Back to all modes"
          style={{
            display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0,
            textDecoration: 'none',
            padding: '5px 9px 5px 7px', borderRadius: 8,
            border: '1px solid var(--c-border)', background: 'var(--c-surface-2)',
          }}
        >
          <span style={{ fontSize: 11, color: 'var(--c-text-6)' }}>←</span>
          <span style={{ color: mode?.accent ?? 'var(--c-text-4)', display: 'flex' }}>
            <PersonaIcon icon={mode?.icon} size={15} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)' }}>{mode?.short}</span>
        </Link>

        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV.map(item => (
            <NavLink
              key={item.path}
              to={mode ? aiPath(mode.id, item.path) : AI_ROOT}
              title={item.hint}
              style={({ isActive }) => ({
                fontSize: 12, fontWeight: isActive ? 600 : 500,
                padding: '6px 11px', borderRadius: 7, textDecoration: 'none',
                color: isActive ? (mode?.accent ?? 'var(--c-accent)') : 'var(--c-text-4)',
                background: isActive ? 'rgba(37,99,235,0.09)' : 'transparent',
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 10, color: 'var(--c-text-6)' }}>ACTING AS</span>
          <SubjectSwitcher subjects={personas} activeId={personaId} onPick={setPersonaId} />
          {/* The agent sits in the same bar, at the same level, because it is the second half
              of every access decision — not a preference tucked away in a settings pane. */}
          {agents.length > 0 && (
            <>
              <span style={{ fontSize: 10, color: 'var(--c-text-6)' }}>VIA</span>
              <SubjectSwitcher subjects={agents} activeId={agentId} onPick={setAgentId} width={200} />
            </>
          )}
          <span
            title={status === 'ready' ? 'Platform ready' : status === 'error' ? 'Failed — see the panel' : 'Preparing'}
            style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: status === 'ready' ? '#22c55e' : status === 'error' ? '#ef4444' : '#f59e0b',
            }}
          />
        </div>
      </header>

      <main style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {ready
          ? <Outlet key={`${mode.id}:${persona.id}`} />
          : <BootGate />}
      </main>
    </div>
  )
}
