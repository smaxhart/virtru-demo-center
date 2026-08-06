import { useState, useEffect } from 'react'
import { useDemo } from '../context/DemoContext.jsx'
import Icon from '../components/Icon.jsx'

const DEFAULT_PAGE_VISIBILITY = {
  home: true,
  cop: true,
  collaborate: true,
  'ai-agent': true,
  'tdf-explorer': true,
  architecture: true,
  encrypt: true,
  policy: true,
  keywrap: true,
  revoke: true,
  platform: true,
  audit: true,
  tagging: true,
}

const PAGE_GROUPS = [
  {
    label: 'Demo',
    pages: [
      { id: 'home',         label: 'Home',          icon: 'globe'   },
      { id: 'cop',          label: 'COP',           icon: 'globe'   },
      { id: 'collaborate',  label: 'Collaborate',   icon: 'revoke'  },
      { id: 'ai-agent',     label: 'AI Protection', icon: 'shield'  },
      { id: 'tdf-explorer', label: 'TDF Explorer',  icon: 'tdf'     },
    ]
  },
  {
    label: 'Core',
    pages: [
      { id: 'architecture', label: 'Architecture',    icon: 'boxes' },
      { id: 'keywrap',      label: 'Key Management',  icon: 'key' },
      { id: 'revoke',       label: 'Live Revocation', icon: 'revoke' },
      { id: 'audit',        label: 'Audit Log',       icon: 'tdf-doc' },
    ]
  },
  {
    label: 'Advanced',
    pages: [
      { id: 'tagging', label: 'Auto-Tagging', icon: 'document' },
    ]
  },
  {
    label: 'Build',
    pages: [
      { id: 'encrypt',  label: 'Encrypt / Decrypt',     icon: 'lock' },
      { id: 'policy',   label: 'Policy Builder',        icon: 'document' },
      { id: 'platform', label: 'Platform Connectivity', icon: 'globe' },
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
      <div className="p-6 flex flex-col items-center justify-center h-full">
        <div className="max-w-md text-center">
          <Icon name="shield" size={64} style={{ color: 'var(--c-text-6)', margin: '0 auto 1rem' }} />
          <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--c-text-1)' }}>Access Restricted</h1>
          <p style={{ color: 'var(--c-text-4)' }}>
            Settings are only available to the Generic persona. Please switch personas to access this page.
          </p>
        </div>
      </div>
    )
  }

  const visibleCount = Object.values(visibility).filter(Boolean).length
  const totalCount = Object.keys(visibility).length

  return (
    <div className="p-6 flex flex-col gap-6 max-w-5xl mx-auto">
      <div className="page-hero">
        <p className="page-subtitle">Configure which pages appear in navigation. Customize the demo for each prospect or presentation context.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div className="text-2xl font-bold mb-1" style={{ color: 'var(--c-text-2)' }}>{visibleCount}</div>
          <div className="text-xs" style={{ color: 'var(--c-text-5)' }}>Visible Pages</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div className="text-2xl font-bold mb-1" style={{ color: 'var(--c-text-4)' }}>{totalCount - visibleCount}</div>
          <div className="text-xs" style={{ color: 'var(--c-text-5)' }}>Hidden Pages</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
          <div className="text-2xl font-bold mb-1" style={{ color: 'var(--c-text-4)' }}>{totalCount}</div>
          <div className="text-xs" style={{ color: 'var(--c-text-5)' }}>Total Pages</div>
        </div>
      </div>

      {/* Page Visibility Controls */}
      <div className="rounded-xl p-6" style={{ background: 'var(--c-surface)', border: '1px solid var(--c-border)' }}>
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--c-text-2)' }}>Page Visibility</h2>

        <div className="flex flex-col gap-6">
          {PAGE_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--c-text-5)' }}>
                {group.label}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {group.pages.map(page => (
                  <label
                    key={page.id}
                    className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all"
                    style={{
                      background: visibility[page.id] ? 'var(--c-bg)' : 'var(--c-border)',
                      border: `1px solid ${visibility[page.id] ? '#4ade80' : 'var(--c-border-2)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visibility[page.id]}
                      onChange={() => togglePage(page.id)}
                      className="w-4 h-4 cursor-pointer"
                      style={{ accentColor: '#4ade80' }}
                    />
                    <Icon name={page.icon} size={18} />
                    <span className="text-sm" style={{ color: visibility[page.id] ? 'var(--c-text-2)' : 'var(--c-text-5)' }}>
                      {page.label}
                    </span>
                    {visibility[page.id] && (
                      <span className="ml-auto text-xs" style={{ color: '#4ade80' }}>✓</span>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={saveSettings}
          className="px-6 py-3 rounded-lg font-medium cursor-pointer transition-all"
          style={{
            background: saved ? '#0d2018' : '#004987',
            color: saved ? '#4ade80' : '#ffffff',
            border: `1px solid ${saved ? '#22c55e' : '#3b82f6'}`,
          }}
        >
          {saved ? (
            <>
              <Icon name="check" size={16} /> Saved!
            </>
          ) : (
            <>
              <Icon name="gear" size={16} /> Save Settings
            </>
          )}
        </button>

        <button
          onClick={resetToDefaults}
          className="px-6 py-3 rounded-lg font-medium cursor-pointer transition-all"
          style={{
            background: 'var(--c-border)',
            color: 'var(--c-text-3)',
            border: '1px solid var(--c-border-2)',
          }}
        >
          Reset to Defaults
        </button>

        {!saved && (
          <span className="text-sm ml-auto" style={{ color: 'var(--c-text-5)' }}>
            Unsaved changes
          </span>
        )}
      </div>

      {/* Help Text */}
      <div className="rounded-lg p-4" style={{ background: 'var(--c-info-bg)', border: '1px solid #1e3a5f' }}>
        <div className="text-xs font-bold mb-1" style={{ color: 'var(--c-text-2)' }}>💡 TIP</div>
        <p className="text-xs" style={{ color: 'var(--c-text-4)' }}>
          Settings are stored in your browser's local storage and persist across sessions.
          Use this to customize the demo for different presentation scenarios or to focus on specific features.
        </p>
      </div>
    </div>
  )
}
