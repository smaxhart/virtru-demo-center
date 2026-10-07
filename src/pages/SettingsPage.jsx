import { useState, useEffect } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import UiIcon from '../components/UiIcon.jsx'

const DEFAULT_PAGE_VISIBILITY = {
  home: true,
  cop: true,
  collaborate: true,
  gcap: true,
  sable: true,
  'ai-agent': true,
  'tdf-explorer': true,
  architecture: true,
  platform: true,
  audit: true,
}

const PAGE_GROUPS = [
  {
    label: 'Demo',
    pages: [
      { id: 'home',         label: 'Home' },
      { id: 'cop',          label: 'COP' },
      { id: 'collaborate',  label: 'Collaborate' },
      { id: 'gcap',         label: 'GCAP' },
      { id: 'sable',        label: 'SABLE' },
      { id: 'ai-agent',     label: 'AI Protection' },
      { id: 'tdf-explorer', label: 'TDF Explorer' },
    ]
  },
  {
    label: 'Core',
    pages: [
      { id: 'architecture', label: 'Architecture' },
      { id: 'audit',        label: 'Audit Log' },
      { id: 'platform',     label: 'Platform Connectivity' },
    ]
  },
]

export default function SettingsPage() {
  const { activePersona } = useDemo()
  const [visibility, setVisibility] = useState(DEFAULT_PAGE_VISIBILITY)
  const [saved, setSaved] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('dsp-demo-page-visibility')
    if (stored) {
      try {
        setVisibility(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    }
  }, [])

  function togglePage(pageId) {
    setVisibility(prev => ({ ...prev, [pageId]: !prev[pageId] }))
    setSaved(false)
  }

  function saveSettings() {
    localStorage.setItem('dsp-demo-page-visibility', JSON.stringify(visibility))
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  function resetToDefaults() {
    setVisibility(DEFAULT_PAGE_VISIBILITY)
    localStorage.removeItem('dsp-demo-page-visibility')
    setSaved(false)
  }

  // Only Generic persona can access settings
  if (activePersona.id !== 'generic') {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', paddingTop: 96 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <UiIcon name="lock" size={32} style={{ color: 'var(--c-text-6)', margin: '0 auto 14px' }} />
          <h1 className="page-title">Access restricted</h1>
          <p className="page-subtitle" style={{ margin: '0 auto' }}>
            Settings are only available to the Generic persona. Switch to Generic on Home, then open Settings from the Developer menu.
          </p>
        </div>
      </div>
    )
  }

  const visibleCount = Object.values(visibility).filter(Boolean).length
  const totalCount = Object.keys(visibility).length

  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-hero">
        <p className="page-subtitle">Configure which pages appear in navigation. Customize the demo for each prospect or presentation context.</p>
        <div className="page-actions">
          <button type="button" className="btn" onClick={resetToDefaults}>Reset to defaults</button>
          <button
            type="button"
            className={saved ? 'btn' : 'btn btn-primary'}
            onClick={saveSettings}
            style={saved ? { color: 'var(--c-grant)', borderColor: 'var(--c-grant-br)', background: 'var(--c-grant-bg)' } : undefined}
          >
            {saved ? <><UiIcon name="check" size={15} /> Saved</> : 'Save settings'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 className="section-title" style={{ margin: 0 }}>Page visibility</h2>
        <span className="num" style={{ fontSize: 12.5, color: 'var(--c-text-5)' }}>
          {visibleCount} visible, {totalCount - visibleCount} hidden, {totalCount} total
        </span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {PAGE_GROUPS.map((group, gi) => (
          <div key={group.label} style={{ borderTop: gi === 0 ? 'none' : '1px solid var(--c-border)' }}>
            <div style={{ padding: '12px 20px 4px', fontSize: 12.5, fontWeight: 650, color: 'var(--c-text-5)' }}>
              {group.label}
            </div>
            {group.pages.map((page, pi) => (
              <label
                key={page.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 20px', cursor: 'pointer',
                  borderTop: pi === 0 ? 'none' : '1px solid var(--c-border)',
                }}
              >
                <input
                  type="checkbox"
                  checked={visibility[page.id]}
                  onChange={() => togglePage(page.id)}
                  style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--c-accent)', margin: 0 }}
                />
                <span style={{ fontSize: 14, fontWeight: 550, color: visibility[page.id] ? 'var(--c-text-1)' : 'var(--c-text-5)' }}>
                  {page.label}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 12.5, color: 'var(--c-text-5)' }}>
                  {visibility[page.id] ? 'Shown' : 'Hidden'}
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>

      <p style={{ margin: '16px 2px 0', fontSize: 12.5, lineHeight: 1.55, color: 'var(--c-text-5)' }}>
        Settings are stored in your browser's local storage and persist across sessions.
        Use this to customize the demo for different presentation scenarios or to focus on specific features.
      </p>
    </div>
  )
}
