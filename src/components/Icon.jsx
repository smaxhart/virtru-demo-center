const BASE = import.meta.env.BASE_URL.replace(/\/$/, '')

const ICONS = {
  tools:      `${BASE}/icons/tools.svg`,
  lock:       `${BASE}/icons/lock.svg`,
  unlock:     `${BASE}/icons/unlock.svg`,
  key:        `${BASE}/icons/key.svg`,
  shield:     `${BASE}/icons/shield.svg`,
  document:   `${BASE}/icons/document.svg`,
  'tdf-doc':  `${BASE}/icons/tdf-doc.svg`,
  folder:     `${BASE}/icons/folder.svg`,
  gear:       `${BASE}/icons/gear.svg`,
  chart:      `${BASE}/icons/chart.svg`,
  search:     `${BASE}/icons/search.svg`,
  users:      `${BASE}/icons/users.svg`,
  server:     `${BASE}/icons/server.svg`,
  revoke:     `${BASE}/icons/revoke.svg`,
  checkmark:  `${BASE}/icons/checkmark.svg`,
  blocked:    `${BASE}/icons/blocked.svg`,
  alert:      `${BASE}/icons/alert.svg`,
  tdf:        `${BASE}/icons/tdf.svg`,
  compliance: `${BASE}/icons/compliance.svg`,
  globe:      `${BASE}/icons/globe.svg`,
  computer:   `${BASE}/icons/computer.svg`,
  boxes:      `${BASE}/icons/boxes.svg`,
  video:      `${BASE}/icons/video.svg`,
  stack:      `${BASE}/icons/stack.svg`,
  chess:      `${BASE}/icons/chess.svg`,
  innovation: `${BASE}/icons/innovation.svg`,
  safe:       `${BASE}/icons/safe.svg`,
  partners:   `${BASE}/icons/partners.svg`,
  toggle:     `${BASE}/icons/toggle.svg`,
  web:        `${BASE}/icons/web.svg`,
  security:   `${BASE}/icons/security.svg`,
  handgear:   `${BASE}/icons/handgear.svg`,
  patent:     `${BASE}/icons/patent.svg`,
}

// fallback: what to render when name is not a known Virtru icon (e.g. an emoji string)
export default function Icon({ name, size = 24, className = '', style = {}, fallback = null, raw = false }) {
  const src = ICONS[name]
  if (!src) return fallback

  // If a `color` is specified in style, use CSS mask so the icon renders as that solid color.
  // Pass raw=true to skip the mask and always render the original image.
  const { color, ...restStyle } = style
  if (color && !raw) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          width: size,
          height: size,
          backgroundColor: color,
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          ...restStyle,
        }}
      />
    )
  }

  return (
    <img
      src={src}
      alt={name}
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...restStyle }}
    />
  )
}
