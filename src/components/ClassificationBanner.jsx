const COLORS = {
  'TOP SECRET': { bg: '#fef2f2', text: '#ef4444', border: '#fca5a5' },
  'SECRET':     { bg: '#fff7ed', text: '#f97316', border: '#fdba74' },
  'CONFIDENTIAL': { bg: '#fefce8', text: '#ca8a04', border: '#fde047' },
  'UNCLASSIFIED': { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
  'CUI':          { bg: '#eff6ff', text: '#2563eb', border: '#93c5fd' },
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
      borderRadius: 4,
      fontSize: fs,
      fontWeight: 700,
      letterSpacing: '0.5px',
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
      textTransform: 'uppercase',
      fontFamily: 'monospace',
      flexShrink: 0,
    }}>
      {level}
    </span>
  )
}
