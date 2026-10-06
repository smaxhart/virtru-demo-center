import { useState, useRef, useEffect } from 'react'
import { NavLink, Outlet, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import PersonaIcon from './PersonaIcon.jsx'
import BootGate from './BootGate.jsx'
import UiIcon from '../../components/UiIcon.jsx'
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
        className="sai-switch"
        style={{ maxWidth: width }}
      >
        {active && (
          <span className="sai-chip-ico" style={{ color: active.color }}>
            <PersonaIcon icon={active.icon} badge={active.badge} size={15} />
          </span>
        )}
        <span className="sai-switch-name">{active?.name ?? '—'}</span>
        <UiIcon name="chevron" size={13} />
      </button>

      {open && (
        <div role="listbox" className="menu" style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, minWidth: 260,
        }}>
          {subjects.map(s => {
            const on = s.id === activeId
            return (
              <button
                key={s.id}
                role="option"
                aria-selected={on}
                onClick={() => { onPick(s.id); setOpen(false) }}
                className="sai-opt"
              >
                <span style={{ color: s.color, display: 'flex' }}>
                  <PersonaIcon icon={s.icon} badge={s.badge} size={17} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{
                    display: 'block', fontSize: 13, fontWeight: on ? 700 : 550,
                    color: 'var(--c-text-1)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{s.name}</span>
                  <span style={{
                    display: 'block', fontSize: 11.5, color: 'var(--c-text-5)', marginTop: 1,
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
    <div className="sai-shell">

      {/* Mode bar. Was the window title bar in the standalone app; inside Demo Center the window
          chrome and the sidebar belong to the app, so this is just a strip within a page. */}
      <header className="sai-bar">
        {/* The mode badge doubles as the way back to the launcher */}
        <Link to={AI_ROOT} title="Back to all modes" className="sai-back">
          <UiIcon name="chevron" size={13} style={{ transform: 'rotate(90deg)' }} />
          <span className="sai-chip-ico" style={{ color: mode?.accent }}>
            <PersonaIcon icon={mode?.icon} size={15} />
          </span>
          <span>{mode?.short}</span>
        </Link>

        <nav className="sai-tabs" aria-label="AI Protection">
          {NAV.map(item => (
            <NavLink
              key={item.path}
              to={mode ? aiPath(mode.id, item.path) : AI_ROOT}
              title={item.hint}
              className="sai-tab"
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <div className="sai-who">
          <span>Acting as</span>
          <SubjectSwitcher subjects={personas} activeId={personaId} onPick={setPersonaId} />
          {/* The agent sits in the same bar, at the same level, because it is the second half
              of every access decision — not a preference tucked away in a settings pane. */}
          {agents.length > 0 && (
            <>
              <span>via</span>
              <SubjectSwitcher subjects={agents} activeId={agentId} onPick={setAgentId} width={200} />
            </>
          )}
          <span
            className="sai-status"
            title={status === 'ready' ? 'Platform ready' : status === 'error' ? 'Failed — see the panel' : 'Preparing'}
            style={{
              background: status === 'ready' ? '#4ade80' : status === 'error' ? '#f87171' : '#fbbf24',
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
