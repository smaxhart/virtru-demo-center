import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useDemo } from '../context/DemoContext.jsx'
import UiIcon from './UiIcon.jsx'

// Grouped by what you do with them: orient, demo, inspect. A `null` is a divider.
const NAV_ITEMS = [
  { to: '/home',         id: 'home',         label: 'Home',          icon: 'home'     },
  { to: '/architecture', id: 'architecture', label: 'Architecture',  icon: 'layers'   },
  null,
  { to: '/cop',          id: 'cop',          label: 'COP',           icon: 'pin'      },
  { to: '/collaborate',  id: 'collaborate',  label: 'Collaborate',   icon: 'people'   },
  { to: '/gcap',         id: 'gcap',         label: 'GCAP',          icon: 'plane'    },
  { to: '/sable',        id: 'sable',        label: 'SABLE',         icon: 'target'   },
  { to: '/ai-agent',     id: 'ai-agent',     label: 'AI Protection', icon: 'shield'   },
  { to: '/tdf-explorer', id: 'tdf-explorer', label: 'TDF Explorer',  icon: 'fileScan' },
  null,
  { to: '/platform',     id: 'platform',     label: 'Platform',      icon: 'server'   },
  { to: '/audit',        id: 'audit',        label: 'Audit Log',     icon: 'list'     },
]

// Pages whose content changes with the active persona. The switcher only shows on these.
const PERSONA_ROUTES = new Set(['/home', '/architecture', '/cop', '/collaborate', '/audit'])

const PAGE_LABELS = {
  '/home':         'Home',
  '/architecture': 'Architecture',
  '/cop':          'Common Operating Picture',
  '/collaborate':  'Collaborate',
  '/gcap':         'GCAP Advanced Collaborative Environment - Working',
  '/sable':        'SABLE · Joint Mission Engineering',
  '/ai-agent':     'AI Protection',
  '/audit':        'Audit Log',
  '/platform':     'Platform',
  '/tdf-explorer': 'TDF Explorer',
  '/settings':     'Settings',
}

// Last two words skip rank prefixes ("Maj.", "CW3", "Flt Lt") without a lookup table.
const initialsOf = (p) => {
  if (p.id.startsWith('ai-')) return 'AI'
  const w = p.name.trim().split(/\s+/)
  return w.slice(-2).map(s => s[0]).join('').toUpperCase()
}

const inkOn = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255
  return lum > 0.62 ? '#0a1a33' : '#ffffff'
}

function PersonaDot({ persona, active, onSelect }) {
  const generic = persona.id === 'generic'
  const bg = generic ? 'var(--c-surface-3)' : persona.color
  return (
    <button
      type="button"
      className="persona-dot"
      aria-pressed={active}
      aria-label={`View as ${persona.name}`}
      title={`${persona.name} — ${persona.title}`}
      onClick={() => onSelect(persona)}
      style={{ background: bg, color: generic ? 'var(--c-text-4)' : inkOn(persona.color) }}
    >
      {generic ? <UiIcon name="user" size={15} strokeWidth={1.9} /> : initialsOf(persona)}
    </button>
  )
}

export default function Layout() {
  const {
    activePersona, setActivePersona, personas,
    techMode, setTechMode,
    platformReady, apiLog,
  } = useDemo()

  const [devOpen, setDevOpen]               = useState(false)
  const [drawerOpen, setDrawerOpen]         = useState(false)
  const [navHidden, setNavHidden]           = useState(() => localStorage.getItem('dsp-demo-nav-hidden') === '1')
  const [pageVisibility, setPageVisibility] = useState({})
  const prevLogLen = useRef(0)
  const [pulse, setPulse]       = useState(false)
  const [updateInfo, setUpdateInfo] = useState(null) // { state, version?, percent? }
  const [appVersion, setAppVersion] = useState(null)
  const devRef   = useRef(null)
  const location = useLocation()

  useEffect(() => {
    localStorage.setItem('dsp-demo-nav-hidden', navHidden ? '1' : '0')
  }, [navHidden])

  // Cmd/Ctrl + \ hides the navigation for a demo without reaching for the mouse.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); setNavHidden(h => !h) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!window.electronAPI?.onUpdateStatus) return
    const unsub = window.electronAPI.onUpdateStatus(setUpdateInfo)
    return unsub
  }, [])

  useEffect(() => {
    window.electronAPI?.getAppVersion?.().then(setAppVersion).catch(() => {})
  }, [])

  useEffect(() => {
    const load = () => {
      const stored = localStorage.getItem('dsp-demo-page-visibility')
      setPageVisibility(stored ? JSON.parse(stored) : {})
    }
    load()
    window.addEventListener('storage', load)
    return () => window.removeEventListener('storage', load)
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('dsp-demo-page-visibility')
    setPageVisibility(stored ? JSON.parse(stored) : {})
  }, [location.pathname])

  useEffect(() => {
    if (apiLog.length > prevLogLen.current) {
      prevLogLen.current = apiLog.length
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 1000)
      return () => clearTimeout(t)
    }
  }, [apiLog.length])

  useEffect(() => {
    if (!devOpen) return
    const handler = (e) => {
      if (devRef.current && !devRef.current.contains(e.target)) setDevOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [devOpen])

  const isGeneric = activePersona.id === 'generic'

  // AI Protection routes below its own mount point (/ai-agent/dow/chat and so on), so its label
  // and its own chrome rules have to survive a path that is longer than the nav entry.
  const isAiRoute = location.pathname === '/ai-agent' || location.pathname.startsWith('/ai-agent/')
  const pageLabel = PAGE_LABELS[location.pathname] ?? (isAiRoute ? PAGE_LABELS['/ai-agent'] : '')
  const showPersonas = PERSONA_ROUTES.has(location.pathname)

  const visibleNavItems = NAV_ITEMS.map(item => {
    if (item === null) return null
    if (item.to === '/platform' && platformReady !== true) return null
    if (Object.keys(pageVisibility).length > 0 && item.id && pageVisibility[item.id] === false) return null
    return item
  })

  // Collapse consecutive nulls / leading-trailing nulls
  const cleanedNav = visibleNavItems.filter((item, i, arr) => {
    if (item !== null) {
      return true
    }
    const prev = arr.slice(0, i).findLast(x => x !== null)
    const next = arr.slice(i + 1).find(x => x !== null)
    return prev !== undefined && next !== undefined
  })

  const status = platformReady === true
    ? { color: '#4ade80', label: 'Platform online' }
    : platformReady === false
      ? { color: '#f87171', label: 'Platform offline' }
      : { color: '#fbbf24', label: 'Platform starting' }

  const firstAiIdx = personas.findIndex(p => p.id.startsWith('ai-'))

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--c-bg)' }}>

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside className={`sidebar ${navHidden ? 'collapsed' : ''}`} aria-hidden={navHidden}>

        {/* Logo — left padding clears macOS traffic light buttons (hiddenInset titlebar) */}
        <div className="sidebar-brand">
          <NavLink to="/home" className="sidebar-brand-link">
            <div className="sidebar-mark">
              <img src="./virtru-logomark.svg" alt="" width={19} height={19} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 550, color: 'rgba(146,192,233,0.75)', lineHeight: 1.1 }}>Virtru</span>
              <span style={{ fontSize: 15, fontWeight: 680, color: '#fff', letterSpacing: '-0.01em', lineHeight: 1.1 }}>Demo Center</span>
            </div>
          </NavLink>
        </div>

        {/* Update banner */}
        {updateInfo && (
          <div style={{
            margin: '12px 12px 0',
            padding: '9px 12px',
            borderRadius: 8,
            border: `1px solid ${updateInfo.state === 'ready' ? 'rgba(74,222,128,0.3)' : updateInfo.state === 'error' ? 'rgba(248,113,113,0.35)' : 'rgba(106,170,228,0.3)'}`,
            background: updateInfo.state === 'ready' ? 'rgba(74,222,128,0.08)' : updateInfo.state === 'error' ? 'rgba(248,113,113,0.08)' : 'rgba(106,170,228,0.08)',
            flexShrink: 0,
            fontSize: 12,
            color: 'rgba(232,240,254,0.92)',
          }}>
            {updateInfo.state === 'available' && <div>Version {updateInfo.version} is available. Downloading…</div>}
            {updateInfo.state === 'error' && <div style={{ color: '#fca5a5' }}>Update failed. Check the logs.</div>}
            {updateInfo.state === 'downloading' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span>Updating… {updateInfo.percent}%</span>
                  <span style={{ color: 'rgba(146,192,233,0.7)' }}>{updateInfo.mbps ? `${updateInfo.mbps} MB/s` : ''}</span>
                </div>
                <div style={{ height: 3, background: 'rgba(106,170,228,0.2)', borderRadius: 2 }}>
                  <div style={{ width: `${updateInfo.percent}%`, height: '100%', background: '#6AAAE4', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                {updateInfo.total && (
                  <div style={{ marginTop: 5, color: 'rgba(146,192,233,0.6)', fontSize: 11 }}>
                    {updateInfo.transferred} / {updateInfo.total} MB
                  </div>
                )}
              </div>
            )}
            {updateInfo.state === 'ready' && <div style={{ color: '#86efac' }}>Version {updateInfo.version} is ready. It installs when you quit.</div>}
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '14px 0' }} aria-label="Primary">
          {cleanedNav.map((item, i) => {
            if (item === null) return <div key={`div-${i}`} className="nav-divider" />
            return (
              <NavLink key={item.to} to={item.to} className="nav-item">
                <UiIcon name={item.icon} size={17} />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        {/* Status + version footer */}
        <div className="sidebar-foot">
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(214,226,244,0.8)' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%', background: status.color, flexShrink: 0,
              boxShadow: `0 0 0 3px ${status.color}26`,
            }} />
            {status.label}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(146,192,233,0.55)', display: 'flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums' }}>
            {appVersion ? `v${appVersion}` : 'dev'}
            {/* A prerelease version string is the whole staging channel — electron-updater derives
                allowPrerelease from it — so it is worth saying out loud. Someone demoing from a
                beta by accident should be able to see it without opening the logs. */}
            {appVersion?.includes('-') && (
              <span style={{
                fontSize: 10.5, fontWeight: 650, padding: '1px 6px', borderRadius: 4,
                color: '#fbbf24', background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)',
              }}>Staging</span>
            )}
          </span>
        </div>

      </aside>

      {/* ── Main column ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header className={`topbar ${navHidden ? 'nav-hidden' : ''}`}>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <button
            type="button"
            className="nav-toggle"
            onClick={() => setNavHidden(h => !h)}
            aria-label={navHidden ? 'Show navigation' : 'Hide navigation'}
            aria-expanded={!navHidden}
            title={`${navHidden ? 'Show' : 'Hide'} navigation (${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'}+\\)`}
          >
            <UiIcon name="panel" size={18} />
          </button>

          <h1 style={{ margin: 0, fontSize: 17, fontWeight: 660, letterSpacing: '-0.015em', color: 'var(--c-text-1)', whiteSpace: 'nowrap' }}>
            {pageLabel}
          </h1>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>

            {/* Persona switcher — shown only on pages that change with the persona (PERSONA_ROUTES).
                Elsewhere it would be a control that does nothing. AI Protection and GCAP select
                their own identities, so they are deliberately not in that list. */}
            {showPersonas && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--c-text-5)', whiteSpace: 'nowrap' }}>Viewing as</span>
                  <div className="persona-strip" role="group" aria-label="Viewing as">
                    {personas.map((p, i) => (
                      <span key={p.id} style={{ display: 'contents' }}>
                        {i === firstAiIdx && firstAiIdx > 0 && <span className="persona-sep" />}
                        <PersonaDot persona={p} active={activePersona.id === p.id} onSelect={setActivePersona} />
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--c-text-1)', whiteSpace: 'nowrap' }}>{activePersona.name}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--c-text-5)', whiteSpace: 'nowrap' }}>{activePersona.title}</span>
                </div>

                {activePersona.attributes.length > 0 && (
                  <div className="persona-attrs">
                    {activePersona.attributes.filter(a => !a.startsWith('relto:')).map(a => (
                      <span key={a} className="chip chip-mono">{a}</span>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Dev tools (Generic only) */}
            {isGeneric && (
              <div style={{ position: 'relative' }} ref={devRef}>
                <button
                  onClick={() => setDevOpen(o => !o)}
                  className="btn btn-sm"
                  aria-expanded={devOpen}
                  style={devOpen ? { background: 'var(--c-ink)', color: '#fff', borderColor: 'var(--c-ink)' } : undefined}
                >
                  <UiIcon name="sliders" size={14} />
                  Developer
                  <UiIcon name="chevron" size={12} style={{ opacity: 0.6, transform: devOpen ? 'rotate(180deg)' : 'none' }} />
                </button>

                {devOpen && (
                  <div className="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 210, zIndex: 50 }}>
                    <button className="menu-item" onClick={() => { setDrawerOpen(o => !o); setDevOpen(false) }}>
                      <span style={{
                        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                        background: apiLog.length > 0 ? '#22c55e' : 'var(--c-text-6)',
                        animation: pulse ? 'pulse-ring 0.5s ease-out' : 'none',
                      }} />
                      API log{apiLog.length > 0 && <span style={{ color: 'var(--c-text-5)' }}>({apiLog.length})</span>}
                    </button>
                    <button className="menu-item" onClick={() => setTechMode(t => !t)}>
                      <UiIcon name={techMode ? 'check' : 'x'} size={14} style={{ color: techMode ? 'var(--c-grant)' : 'var(--c-text-6)' }} />
                      Tech mode {techMode ? 'on' : 'off'}
                    </button>
                    <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 0' }} />
                    <NavLink to="/settings" onClick={() => setDevOpen(false)} className="menu-item" style={{ textDecoration: 'none' }}>
                      <UiIcon name="sliders" size={14} /> Settings
                    </NavLink>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
          <Outlet />
        </main>

        {/* API Log Drawer */}
        {drawerOpen && (
          <div style={{
            flexShrink: 0,
            background: 'var(--c-ink)',
            borderTop: '1px solid rgba(106,170,228,0.35)',
            maxHeight: '14rem',
            display: 'flex',
            flexDirection: 'column',
            color: 'rgba(214,226,244,0.85)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <span style={{ fontSize: 13, fontWeight: 650, color: '#fff' }}>Live API log</span>
                <span style={{ fontSize: 12, color: 'rgba(146,192,233,0.7)' }}>
                  {apiLog.length === 0 ? 'Waiting for calls…' : `${apiLog.length} total`}
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close API log"
                style={{ display: 'flex', padding: 4, borderRadius: 6, cursor: 'pointer', color: 'rgba(214,226,244,0.7)', background: 'transparent', border: 'none' }}
              >
                <UiIcon name="x" size={15} />
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 16px', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
              {apiLog.length === 0 ? (
                <span style={{ color: 'rgba(146,192,233,0.55)' }}>No API calls yet. Open any demo to see live traffic.</span>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'rgba(146,192,233,0.6)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', fontWeight: 'normal' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', fontWeight: 'normal' }}>Method</th>
                      <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 'normal' }}>Endpoint</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 'normal' }}>Latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiLog.slice(0, 30).map(entry => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <td style={{ padding: '4px 12px 4px 0', color: entry.ok !== false ? '#4ade80' : '#f87171' }}>{entry.status ?? '?'}</td>
                        <td style={{ padding: '4px 12px 4px 0' }}>{entry.method}</td>
                        <td style={{ padding: '4px 0', color: 'rgba(214,226,244,0.7)', maxWidth: '60vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.url}>{entry.url}</td>
                        <td style={{ padding: '4px 0', textAlign: 'right', color: entry.latency > 300 ? '#fbbf24' : 'rgba(146,192,233,0.6)' }}>{entry.latency != null ? `${entry.latency}ms` : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
