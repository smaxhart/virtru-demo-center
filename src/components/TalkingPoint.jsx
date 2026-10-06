export default function TalkingPoint({ text }) {
  return (
    <div style={{
      background: 'var(--c-surface-2)',
      borderLeft: '2px solid var(--c-accent)',
      borderRadius: '0 8px 8px 0',
      padding: '10px 14px',
      maxWidth: 400,
      fontSize: 12.5,
      color: 'var(--c-text-3)',
      lineHeight: 1.5,
      flexShrink: 0,
    }}>
      {text}
    </div>
  )
}
