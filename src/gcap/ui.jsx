import { evaluatePolicy, groupLabel } from '../data/policyMatch.js'

// The page carries its own night palette by overriding the shared tokens, so Card, Button and Verdict
// pick it up without the rest of the app changing. No web fonts: the demo must work offline.
export const THEME = {
  '--c-surface': '#1F2F3D', '--c-surface-2': '#16222D', '--c-border': '#36495A', '--c-border-2': '#4A6072',
  '--c-text-1': '#E6EDF2', '--c-text-2': '#D3DEE6', '--c-text-3': '#B5C4CF', '--c-text-4': '#9DB0BF',
  '--c-text-5': '#8DA0B0', '--c-text-6': '#5E7384',
  '--c-info-bg': '#2A3E4F', '--c-purple-bg': '#3A3358',
  '--c-grant': '#7FD4A6', '--c-grant-bg': 'rgba(127,212,166,0.10)', '--c-grant-br': 'rgba(127,212,166,0.35)',
  '--c-deny': '#FF8A7E', '--c-deny-bg': 'rgba(255,107,94,0.10)', '--c-deny-br': 'rgba(255,107,94,0.4)',
  '--c-shadow-sm': 'none', '--c-shadow-lg': '0 12px 40px rgba(0,0,0,0.5)',
}
export const SKY = '#7FC2E8'
export const RED = '#FF6B5E'
export const GREEN = '#7FD4A6'
export const AMBER = '#F2C572'
export const PAPER = '#F2F4F4'
export const INK = '#1B2731'
export const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
export const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif"

export function Shell({ children }) {
  return (
    <div style={{ ...THEME, position: 'absolute', inset: 0, overflowY: 'auto', background: '#16222D', color: 'var(--c-text-2)' }}>
      {children}
    </div>
  )
}

export const initialsOf = (persona) => persona.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

export function Avatar({ persona, size = 30, dim }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: persona.color, color: '#fff', fontSize: size * 0.38, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: dim ? 0.4 : 1,
    }}>{initialsOf(persona)}</div>
  )
}

export function Card({ title, right, children, style, accent }) {
  return (
    <section style={{
      background: 'var(--c-surface)', border: `1px solid ${accent === true ? 'var(--c-deny-br)' : 'var(--c-border)'}`,
      borderLeft: accent ? `3px solid ${accent === true ? RED : accent}` : undefined,
      borderRadius: 'var(--c-radius-card)', boxShadow: 'var(--c-shadow-sm)', ...style,
    }}>
      {title && (
        <header style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, padding: '13px 14px 2px',
          fontSize: 14, fontWeight: 650, color: 'var(--c-text-1)', flexShrink: 0,
        }}>
          <span>{title}</span>{right}
        </header>
      )}
      {children}
    </section>
  )
}

export function Button({ children, onClick, disabled, tone = 'neutral', style, title }) {
  const tones = {
    neutral: { bg: 'var(--c-surface)', fg: 'var(--c-text-2)', br: 'var(--c-border)' },
    danger:  { bg: 'var(--c-deny-bg)', fg: 'var(--c-deny)', br: 'var(--c-deny-br)' },
    go:      { bg: 'var(--c-grant-bg)', fg: 'var(--c-grant)', br: 'var(--c-grant-br)' },
    primary: { bg: SKY, fg: INK, br: SKY },
  }[tone]
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      padding: '7px 12px', borderRadius: 'var(--c-radius-btn)', fontSize: 12, fontWeight: 600,
      cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
      background: tones.bg, color: tones.fg, border: `1px solid ${tones.br}`, ...style,
    }}>{children}</button>
  )
}

export function Verdict({ granted, children }) {
  return (
    <div style={{
      padding: '8px 10px', borderRadius: 8, fontSize: 12, lineHeight: 1.45,
      background: granted ? 'var(--c-grant-bg)' : 'var(--c-deny-bg)',
      border: `1px solid ${granted ? 'var(--c-grant-br)' : 'var(--c-deny-br)'}`,
      color: granted ? 'var(--c-grant)' : 'var(--c-deny)',
    }}>{children}</div>
  )
}

export function Banner({ marking, position }) {
  return (
    <div style={{
      background: marking.tone, color: '#fff', textAlign: 'center', padding: '6px 12px', fontSize: 11.5,
      fontWeight: 700, letterSpacing: '0.12em', fontFamily: MONO,
      borderRadius: position === 'top' ? '6px 6px 0 0' : '0 0 6px 6px',
    }}>{marking.banner}</div>
  )
}

/**
 * Why the verdict is what it is: one chip per attribute the policy names, ticked when the person
 * holds it. This mirrors the KAS (see policyMatch.js); the verdict itself is always the KAS's.
 */
export function WhyChips({ entitlements, policy }) {
  const { groups } = evaluatePolicy(entitlements, policy)
  if (groups.length === 0) return <span style={{ fontSize: 12, color: 'var(--c-text-5)' }}>No attribute is required.</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {groups.map(g => (
        <span key={g.name} title={g.satisfied ? `held: ${g.matched?.split('/value/')[1]}` : g.held.length ? `holds ${g.held.join(', ')}` : 'holds none'} style={{
          fontFamily: MONO, fontSize: 11.5, padding: '2px 8px', borderRadius: 4,
          color: g.satisfied ? GREEN : RED,
          border: `1px solid ${g.satisfied ? 'rgba(127,212,166,.4)' : 'rgba(255,107,94,.45)'}`,
        }}>{g.satisfied ? '✓' : '✕'} {groupLabel(g)}</span>
      ))}
    </div>
  )
}
