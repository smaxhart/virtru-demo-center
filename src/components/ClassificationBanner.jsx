const COLORS = {
  'TOP SECRET':   { bg: 'var(--c-deny-bg)',   text: 'var(--c-deny)',   border: 'var(--c-deny-br)' },
  'SECRET':       { bg: 'var(--c-warn-bg)',   text: 'var(--c-warn)',   border: 'var(--c-warn-br)' },
  'CONFIDENTIAL': { bg: 'var(--c-purple-bg)', text: '#5b3fb0',         border: '#cfc4f0' },
  'UNCLASSIFIED': { bg: 'var(--c-grant-bg)',  text: 'var(--c-grant)',  border: 'var(--c-grant-br)' },
  'CUI':          { bg: 'var(--c-info-bg)',   text: 'var(--c-accent)', border: '#b9d3f0' },
}

export default function ClassificationBanner({ level, size = 'md' }) {
  const c = COLORS[level?.toUpperCase?.()] ?? COLORS['UNCLASSIFIED']
  const pad = size === 'sm' ? '2px 8px' : size === 'lg' ? '6px 16px' : '3px 12px'
  const fs  = size === 'sm' ? 10 : size === 'lg' ? 14 : 11

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: pad,
      borderRadius: 'var(--c-radius-chip)',
      fontSize: fs,
      fontWeight: 700,
      letterSpacing: '0.04em',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      textTransform: 'uppercase',
      fontFamily: 'var(--font-mono)',
      flexShrink: 0,
    }}>
      {level}
    </span>
  )
}
