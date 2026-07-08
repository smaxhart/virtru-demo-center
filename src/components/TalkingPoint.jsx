export default function TalkingPoint({ text }) {
  return (
    <div style={{
      background: '#fffbeb',
      border: '1px solid #fde68a',
      borderRadius: 8,
      padding: '10px 14px',
      maxWidth: 400,
      fontSize: 12,
      color: '#92400e',
      fontStyle: 'italic',
      lineHeight: 1.5,
      flexShrink: 0,
    }}>
      <span style={{ fontStyle: 'normal', marginRight: 6 }}>💬</span>
      {text}
    </div>
  )
}
