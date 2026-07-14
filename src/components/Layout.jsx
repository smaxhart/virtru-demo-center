import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { useDemo } from '../context/DemoContext.jsx'
import Icon from './Icon.jsx'

const NAV_ITEMS = [
  { to: '/home',         id: 'home',         label: 'Home',              icon: 'globe'   },
  { to: '/architecture', id: 'architecture', label: 'Architecture',      icon: 'boxes'   },
  { to: '/keywrap',      id: 'keywrap',      label: 'Key Management',    icon: 'key'     },
  { to: '/tdf-explorer', id: 'tdf-explorer', label: 'TDF Explorer',      icon: 'tdf'     },
  { to: '/collaborate',  id: 'collaborate',  label: 'Collaborate',       icon: 'revoke'  },
  { to: '/tagging',      id: 'tagging',      label: 'Auto-Tagging',      icon: 'document'},
  { to: '/policy',       id: 'policy',       label: 'Policy Builder',    icon: 'document'},
  { to: '/platform',     id: 'platform',     label: 'Platform',          icon: 'globe'   },
  { to: '/audit',        id: 'audit',        label: 'Audit Log',         icon: 'tdf-doc' },
]

const PAGE_LABELS = {
  '/home':         'Home',
  '/architecture': 'Architecture',
  '/keywrap':      'Key Management',
  '/collaborate':  'Collaborate',
  '/audit':        'Audit Log',
  '/tagging':      'Auto-Tagging',
  '/policy':       'Policy Builder',
  '/platform':     'Platform',
  '/tdf-explorer': 'TDF Explorer',
  '/settings':     'Settings',
}

export default function Layout() {
  const {
    activePersona, setActivePersona, personas,
    techMode, setTechMode,
    theme, toggleTheme,
    platformReady, apiLog,
    sector, setSector,
  } = useDemo()

  const [devOpen, setDevOpen]               = useState(false)
  const [drawerOpen, setDrawerOpen]         = useState(false)
  const [pageVisibility, setPageVisibility] = useState({})
  const prevLogLen = useRef(0)
  const [pulse, setPulse]       = useState(false)
  const [updateInfo, setUpdateInfo] = useState(null) // { state, version?, percent? }
  const [appVersion, setAppVersion] = useState(null)
  const devRef   = useRef(null)
  const location = useLocation()

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
  const pageLabel = PAGE_LABELS[location.pathname] ?? ''

  const visibleNavItems = NAV_ITEMS.map(item => {
    if (item === null) return null
    if (item.to === '/platform' && platformReady !== true) return null
    if (Object.keys(pageVisibility).length > 0 && item.id && pageVisibility[item.id] === false) return null
    return item
  })

  // Collapse consecutive nulls / leading-trailing nulls
  const cleanedNav = visibleNavItems.filter((item, i, arr) => {
    if (item !== null) return true
    const prev = arr.slice(0, i).findLast(x => x !== null)
    const next = arr.slice(i + 1).find(x => x !== null)
    return prev !== undefined && next !== undefined
  })

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--c-bg)' }}>

      {/* ── Sidebar ────────────────────────────────────────────── */}
      <aside style={{
        width: 228,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        background: '#0f2340',
        borderRight: '1px solid rgba(106,170,228,0.15)',
        overflow: 'hidden',
      }}>

        {/* Logo — left padding clears macOS traffic light buttons (hiddenInset titlebar) */}
        <div style={{
          height: 60,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px 0 80px',
          borderBottom: '1px solid rgba(106,170,228,0.1)',
          flexShrink: 0,
          WebkitAppRegion: 'drag',
        }}>
          <NavLink to="/architecture" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, WebkitAppRegion: 'no-drag' }}>
            {/* C1 icon chip — navy gradient bg + logomark */}
            <div style={{
              width: 34, height: 34,
              borderRadius: 8,
              background: 'linear-gradient(150deg, #1e3a5f 0%, #0a1f3d 100%)',
              boxShadow: '0 0 12px rgba(106,170,228,0.25), inset 0 1px 0 rgba(106,170,228,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <img src="./virtru-logomark.svg" alt="Virtru" width={20} height={20} style={{ opacity: 0.95 }} />
            </div>
            {/* Text stack */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ fontSize: 8, fontWeight: 700, color: 'rgba(147,197,253,0.65)', letterSpacing: '0.18em', textTransform: 'uppercase', lineHeight: 1 }}>
                Virtru
              </div>
              <div style={{ width: 24, height: 1, background: 'rgba(106,170,228,0.35)' }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(232,240,254,0.9)', letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1 }}>
                Demo Center
              </div>
            </div>
            {platformReady === true && (
              <div style={{
                marginLeft: 2,
                width: 6, height: 6,
                borderRadius: '50%',
                background: '#4ade80',
                boxShadow: '0 0 6px rgba(74,222,128,0.7)',
                animation: 'pulse-ring 2s ease-out infinite',
                flexShrink: 0,
              }} />
            )}
          </NavLink>
        </div>

        {/* Update banner */}
        {updateInfo && (
          <div style={{
            padding: '8px 12px',
            borderBottom: '1px solid rgba(106,170,228,0.1)',
            background: updateInfo.state === 'ready' ? 'rgba(74,222,128,0.08)' : 'rgba(96,165,250,0.08)',
            flexShrink: 0,
          }}>
            {updateInfo.state === 'available' && (
              <div style={{ fontSize: 11, color: '#60a5fa' }}>
                ↑ v{updateInfo.version} available — downloading…
              </div>
            )}
            {updateInfo.state === 'error' && (
              <div style={{ fontSize: 11, color: '#f87171' }}>
                ⚠ Update failed — check logs
              </div>
            )}
            {updateInfo.state === 'downloading' && (
              <div style={{ fontSize: 11, color: '#60a5fa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>↓ Updating… {updateInfo.percent}%</span>
                  <span style={{ color: 'rgba(96,165,250,0.6)' }}>
                    {updateInfo.mbps ? `${updateInfo.mbps} MB/s` : ''}
                  </span>
                </div>
                <div style={{ height: 3, background: 'rgba(96,165,250,0.15)', borderRadius: 2 }}>
                  <div style={{ width: `${updateInfo.percent}%`, height: '100%', background: '#60a5fa', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>
                {updateInfo.total && (
                  <div style={{ marginTop: 3, color: 'rgba(96,165,250,0.5)', fontSize: 10 }}>
                    {updateInfo.transferred} / {updateInfo.total} MB
                  </div>
                )}
              </div>
            )}
            {updateInfo.state === 'ready' && (
              <div style={{ fontSize: 11, color: '#4ade80' }}>
                ✓ v{updateInfo.version} ready — installs on quit
              </div>
            )}
          </div>
        )}

        {/* Nav items */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {cleanedNav.map((item, i) => {
            if (item === null) return (
              <div key={`div-${i}`} style={{
                height: 1,
                background: 'rgba(106,170,228,0.08)',
                margin: '6px 16px',
              }} />
            )
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 16px 9px 18px',
                  margin: '1px 8px',
                  borderRadius: 8,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.75)',
                  background: isActive ? 'rgba(106,170,228,0.18)' : 'transparent',
                  borderLeft: isActive ? '3px solid #6AAAE4' : '3px solid transparent',
                  transition: 'all 0.15s ease',
                })}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      name={item.icon}
                      size={15}
                      raw={item.icon === 'tdf-doc'}
                      style={{ color: isActive ? '#6AAAE4' : 'rgba(255,255,255,0.5)', flexShrink: 0 }}
                    />
                    {item.label}
                  </>
                )}
              </NavLink>
            )
          })}
        </nav>

        {/* Version footer */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(106,170,228,0.08)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 10, color: 'rgba(147,197,253,0.35)', fontFamily: 'monospace', letterSpacing: '0.05em' }}>
            {appVersion ? `v${appVersion}` : 'dev'}
          </span>
          {updateInfo?.state === 'ready' && (
            <span style={{ fontSize: 10, color: '#4ade80' }}>v{updateInfo.version} ready ↑</span>
          )}
        </div>

      </aside>

      {/* ── Main column ────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          height: 56,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 24px',
          background: 'var(--c-surface)',
          borderBottom: '1px solid var(--c-border)',
          boxShadow: '0 1px 0 rgba(0,0,0,0.15)',
        }}>

          {/* Page context */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--c-text-1)' }}>
              {pageLabel}
            </span>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Persona switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--c-text-6)' }}>As:</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {personas.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setActivePersona(p)}
                    title={`${p.name} — ${p.title}`}
                    style={{
                      width: 28, height: 28,
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13,
                      background: activePersona.id === p.id ? p.color + '22' : 'var(--c-surface-2)',
                      border: `2px solid ${activePersona.id === p.id ? p.color : 'transparent'}`,
                      transform: activePersona.id === p.id ? 'scale(1.15)' : 'scale(1)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {p.avatar}
                  </button>
                ))}
              </div>
              <span style={{
                fontSize: 12, fontWeight: 500,
                padding: '3px 10px', borderRadius: 6,
                background: activePersona.color + '15',
                color: activePersona.color,
                border: `1px solid ${activePersona.color}30`,
              }}>
                {activePersona.name}
              </span>
            </div>

            {/* Persona attributes */}
            {activePersona.attributes.length > 0 && (
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                {activePersona.attributes.map(a => (
                  <span key={a} style={{
                    fontSize: 11, fontWeight: 500,
                    padding: '2px 8px', borderRadius: 4,
                    background: activePersona.color + '12',
                    color: activePersona.color,
                    border: `1px solid ${activePersona.color}25`,
                  }}>
                    {a}
                  </span>
                ))}
              </div>
            )}

            {/* Divider */}
            {/* Dev tools (Generic only) */}
            {isGeneric && (
              <div style={{ position: 'relative' }} ref={devRef}>
                <button
                  onClick={() => setDevOpen(o => !o)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 10px', borderRadius: 8,
                    fontSize: 12, fontWeight: 500, cursor: 'pointer',
                    background: devOpen ? '#001E4A' : 'var(--c-surface-2)',
                    color: devOpen ? '#6AAAE4' : 'var(--c-text-5)',
                    border: `1px solid ${devOpen ? '#004987' : 'var(--c-border)'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  <Icon name="gear" size={13} />
                  Dev
                  <span style={{ fontSize: 9, opacity: 0.5 }}>{devOpen ? '▲' : '▼'}</span>
                </button>

                {devOpen && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0,
                    background: 'var(--c-surface)',
                    border: '1px solid var(--c-border-2)',
                    borderRadius: 12,
                    boxShadow: 'var(--c-shadow-lg)',
                    minWidth: 200,
                    zIndex: 50,
                    padding: '4px 0',
                  }}>
                    <button
                        onClick={() => { setDrawerOpen(o => !o); setDevOpen(false) }}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 16px', fontSize: 13, textAlign: 'left',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: drawerOpen ? '#6AAAE4' : 'var(--c-text-3)',
                        }}
                      >
                        <span style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: apiLog.length > 0 ? '#4ade80' : 'var(--c-text-6)',
                          animation: pulse ? 'pulse-ring 0.5s ease-out' : 'none',
                        }} />
                        API Log {apiLog.length > 0 && `(${apiLog.length})`}
                      </button>
                    <button
                        onClick={() => setTechMode(t => !t)}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 16px', fontSize: 13, textAlign: 'left',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: techMode ? '#6AAAE4' : 'var(--c-text-3)',
                        }}
                      >
                        <Icon name="innovation" size={14} />
                        {techMode ? 'Tech Mode: On' : 'Tech Mode: Off'}
                      </button>
                    <div style={{ height: 1, background: 'var(--c-border)', margin: '4px 0' }} />
                    <NavLink
                      to="/settings"
                      onClick={() => setDevOpen(false)}
                      style={({ isActive }) => ({
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 16px', fontSize: 13, textDecoration: 'none',
                        color: isActive ? '#6AAAE4' : 'var(--c-text-3)',
                        background: isActive ? '#001E4A' : 'transparent',
                      })}
                    >
                      <Icon name="gear" size={14} /> Settings
                    </NavLink>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <Outlet />
        </main>

        {/* API Log Drawer */}
        {drawerOpen && (
          <div style={{
            flexShrink: 0,
            background: 'var(--c-surface)',
            borderTop: '1px solid #3b82f6',
            boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
            maxHeight: '14rem',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 16px',
              borderBottom: '1px solid var(--c-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#60a5fa', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon name="web" size={13} /> LIVE API LOG
                </span>
                <span style={{ fontSize: 11, color: 'var(--c-text-5)' }}>
                  {apiLog.length === 0 ? 'Waiting for calls…' : `${apiLog.length} total`}
                </span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, cursor: 'pointer', color: 'var(--c-text-5)', background: 'var(--c-border)', border: 'none' }}
              >
                ✕ Close
              </button>
            </div>
            <div style={{ overflowY: 'auto', flex: 1, padding: '8px 16px', fontFamily: 'monospace', fontSize: 11, color: 'var(--c-text-4)' }}>
              {apiLog.length === 0 ? (
                <span style={{ color: 'var(--c-text-6)' }}>No API calls yet. Navigate to any page to see live traffic.</span>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ color: 'var(--c-text-6)', borderBottom: '1px solid var(--c-border)' }}>
                      <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', fontWeight: 'normal' }}>status</th>
                      <th style={{ textAlign: 'left', padding: '4px 12px 4px 0', fontWeight: 'normal' }}>method</th>
                      <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 'normal' }}>endpoint</th>
                      <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 'normal' }}>latency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiLog.slice(0, 30).map(entry => (
                      <tr key={entry.id} style={{ borderBottom: '1px solid var(--c-border)' }}>
                        <td style={{ padding: '4px 12px 4px 0', color: entry.ok !== false ? '#4ade80' : '#f87171' }}>{entry.status ?? '?'}</td>
                        <td style={{ padding: '4px 12px 4px 0', color: '#a78bfa' }}>{entry.method}</td>
                        <td style={{ padding: '4px 0', color: 'var(--c-text-3)', maxWidth: '60vw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={entry.url}>{entry.url}</td>
                        <td style={{ padding: '4px 0', textAlign: 'right', color: entry.latency > 300 ? '#f59e0b' : 'var(--c-text-5)' }}>{entry.latency != null ? `${entry.latency}ms` : '—'}</td>
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
