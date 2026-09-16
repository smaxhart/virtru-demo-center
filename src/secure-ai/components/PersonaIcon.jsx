/**
 * Line icons for personas and modes.
 *
 * These replaced emoji. Emoji were a liability in a demo that gets projected: the glyphs
 * are gendered (👩‍✈️ vs 🧑‍💻 implies things about people the scenario never said), they
 * render differently per macOS version, and they cannot be tinted to match a persona's
 * colour. These are stroke paths on a 24-grid that inherit `color`, so a persona's icon and
 * its accent are always the same hue.
 *
 * Two personas sharing an icon is intentional, not an oversight. Det. Nina Cortez and
 * Det. Ray Whitfield are the same rank, agency, and certification, separated by one
 * attribute — drawing them identically and letting colour be the only difference is the
 * point being made.
 */

const STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
}

const solid = { fill: 'currentColor', stroke: 'none' }

/** Each glyph draws inside a 0 0 24 24 viewBox. */
const GLYPHS = {
  // ── Persona roles ───────────────────────────────────────────────────────────
  /** Intelligence analyst — a radar sweep with one return. */
  intel: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <path d="M12 12 18.2 6.8" />
      <circle cx="15.7" cy="9.1" r="1.15" {...solid} />
    </>
  ),
  /** Counsel — scales. The pans hang close under the beam; drop them further and the
   *  whole glyph reads as an anchor instead. */
  legal: (
    <>
      <circle cx="12" cy="4" r="1.3" />
      <path d="M12 5.3V19.6M8.4 19.6h7.2" />
      <path d="M4.6 8.2h14.8" />
      <path d="M4.6 8.2v2M19.4 8.2v2" />
      <path d="M1.4 10.2a3.2 2.4 0 0 0 6.4 0M16.2 10.2a3.2 2.4 0 0 0 6.4 0" />
    </>
  ),
  /** Cyber operations — a shell prompt. */
  cyber: (
    <>
      <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
      <path d="M6.6 10.2 9.2 12.4 6.6 14.6M12 14.8h5" />
    </>
  ),
  /** Cleared contractor — a badge on a lanyard clip. */
  contractor: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17.5" rx="2.5" />
      <path d="M9.5 3.5v2.4h5V3.5" />
      <circle cx="12" cy="11.2" r="2.4" />
      <path d="M8 17.6a4 4 0 0 1 8 0" />
    </>
  ),
  /** Foreign liaison — a globe, paired with a country badge. */
  liaison: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="3.7" ry="8.5" />
      <path d="M3.6 12h16.8" />
    </>
  ),
  /** No entitlements — deliberately drawn as an absence. Long dashes: at 16px a fine
   *  dash pattern stops reading as a person and starts looking like noise. */
  anonymous: (
    <>
      <circle cx="12" cy="8.6" r="3.4" strokeDasharray="3.6 2.1" />
      <path d="M5.4 20.2a6.6 6.6 0 0 1 13.2 0" strokeDasharray="3.6 2.1" />
    </>
  ),
  /** Revenue / tax — a return, marked as a rate. */
  finance: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <circle cx="9.6" cy="9.2" r="1.5" />
      <circle cx="14.4" cy="15" r="1.5" />
      <path d="M15.2 8.4 8.8 15.8" />
    </>
  ),
  /** Claims / determinations — a clipboard, adjudicated. */
  claims: (
    <>
      <rect x="4.5" y="4.8" width="15" height="16.2" rx="2" />
      <rect x="9" y="2.6" width="6" height="3.6" rx="1.2" />
      <path d="M8.8 13.4 11.4 16l5-5" />
    </>
  ),
  /** Contracting — an instrument with a signature on it. */
  contract: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M8 8.4h8M8 11.6h8" />
      <path d="M7.8 16.6c1.5-1.6 2.6 1.1 4.1 0s2.6-1.6 4.3 0" />
    </>
  ),
  /** Investigator — a magnifier. */
  investigator: (
    <>
      <circle cx="10.6" cy="10.6" r="6.6" />
      <path d="M15.4 15.4 21 21" />
    </>
  ),
  /** All-source / program analyst — a bar chart. */
  analyst: (
    <>
      <path d="M3.8 20.4h16.4" />
      <path d="M7.6 20.4v-5.6M12 20.4v-10.2M16.4 20.4v-7.6" strokeWidth="2.2" />
    </>
  ),
  /** Public requester — broadcast outward. */
  public: (
    <>
      <path d="M4.4 9.6h3.2l5-3.9v12.6l-5-3.9H4.4z" />
      <path d="M16.4 9.2a4.6 4.6 0 0 1 0 5.6M19.4 6.6a8.2 8.2 0 0 1 0 10.8" />
    </>
  ),
  /** Signals collection — a transmitter. */
  signals: (
    <>
      <path d="M12 20.8v-8.4M9 20.8h6" />
      <circle cx="12" cy="11.6" r="1.5" {...solid} />
      <path d="M8.2 12.7a5.2 5.2 0 0 1 7.6 0M5.3 10a9.2 9.2 0 0 1 13.4 0" />
    </>
  ),
  /** Case officer — clandestine, drawn as a brim, a crown, and a jaw. The crown has to be
   *  taller than the brim is wide or it reads as a bowl. */
  covert: (
    <>
      <path d="M3.5 11.2h17" />
      <path d="M7.4 11.2V7.7c0-2 2.1-3.5 4.6-3.5s4.6 1.5 4.6 3.5v3.5" />
      <path d="M7.6 11.2v2.5a4.4 4.4 0 0 0 8.8 0v-2.5" />
      <circle cx="10.1" cy="13.6" r="1.05" {...solid} />
      <circle cx="13.9" cy="13.6" r="1.05" {...solid} />
    </>
  ),
  /** Imagery / overhead collection. */
  satellite: (
    <>
      <rect x="9.8" y="9" width="4.4" height="6" rx="1.2" />
      <rect x="2.5" y="10.1" width="6" height="3.8" rx="0.9" />
      <rect x="15.5" y="10.1" width="6" height="3.8" rx="0.9" />
      <path d="M12 9V5.6" />
      <path d="M9.5 4.6a4.2 4.2 0 0 1 5 0" />
    </>
  ),
  /** Covert action finding — an instrument bearing a seal. */
  finding: (
    <>
      <rect x="4.5" y="3" width="15" height="18" rx="2" />
      <path d="M12 7.8l1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z" />
    </>
  ),
  /** Sworn officer — a badge. */
  detective: (
    <>
      <path d="M12 2.6l8.2 3v6.6c0 5-3.5 8.5-8.2 9.7-4.7-1.2-8.2-4.7-8.2-9.7V5.6z" />
      <path d="M12 8.2l1.25 2.6 2.85.4-2.05 2 .5 2.85L12 14.7l-2.55 1.35.5-2.85-2.05-2 2.85-.4z" />
    </>
  ),
  /** Emergency medical. */
  medic: (
    <>
      <path d="M2.6 12.6h3.9l2-4.4 3.1 8.6 2.5-5.2 1.9 3.1h5.4" />
    </>
  ),
  /** Fire / incident command.
   *
   *  The asymmetry is the whole trick. A symmetric teardrop reads as water no matter how
   *  it is shaded, and nesting a second teardrop inside it just reads as two drops. What
   *  says "flame" is the lick curling back up the left side, so that lives in the outline
   *  itself rather than in a second path. */
  fire: (
    <>
      <path d="M12.4 2.4c.8 3.8 3.6 5.8 5.2 8 1.3 1.8 1.8 3.4 1.8 5.2 0 3.4-3.4 6-7.4 6s-7.4-2.4-7.4-6.2c0-1.6.6-3 1.6-4 .2 1.4 1.2 2.4 2.6 2.4 1.6 0 2.8-1.2 2.8-2.8 0-1.6-1-2.6-1-4.2 0-1.6.6-3.2 1.8-4.4z" />
    </>
  ),

  // ── Mode badges ─────────────────────────────────────────────────────────────
  /** Department of War. The bar across the top makes the V read as a ribbon rather than
   *  as a pair of antlers. */
  medal: (
    <>
      <path d="M7.2 2.5h9.6" />
      <path d="M8.7 2.5l3.3 5 3.3-5" />
      <circle cx="12" cy="15.4" r="6" />
      <path d="M12 12.1l1.05 2.15 2.35.35-1.7 1.68.4 2.34L12 17.5l-2.1 1.1.4-2.34-1.7-1.68 2.35-.35z" />
    </>
  ),
  /** Federal Civilian. */
  capitol: (
    <>
      <path d="M3.4 9L12 3.6 20.6 9" />
      <path d="M3.4 9h17.2M3.4 20.6h17.2" />
      <path d="M6.6 9v11.6M10 9v11.6M14 9v11.6M17.4 9v11.6" />
    </>
  ),
  /** Law Enforcement / Emergency Response. */
  alert: (
    <>
      <path d="M12 3.8l9.2 15.9H2.8z" />
      <path d="M12 9.8v4.6" />
      <circle cx="12" cy="17.4" r="1.15" {...solid} />
    </>
  ),

  // ── Agents ──────────────────────────────────────────────────────────────────
  /**
   * The machine subject. Every agent draws with this one glyph on purpose: an agent must
   * never be mistaken for a person at a glance, and the scenario's three agents differ by
   * what they hold, not by what they do. Name and colour carry that; the shape carries
   * "this is not a human".
   */
  agent: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12.5" rx="3" />
      <path d="M12 3.2v4.3" />
      <circle cx="12" cy="2.6" r="1.1" {...solid} />
      <circle cx="8.8" cy="13.2" r="1.25" {...solid} />
      <circle cx="15.2" cy="13.2" r="1.25" {...solid} />
      <path d="M9.4 16.9h5.2" />
    </>
  ),
}

export const ICON_KEYS = Object.keys(GLYPHS)

/**
 * @param {string} icon   a key of GLYPHS
 * @param {number} [size] rendered px (the viewBox is always 24)
 * @param {string} [badge] up to 2 characters shown bottom-right — used for the liaisons,
 *   where nationality is load-bearing in the scenario and a globe alone would lose it
 * @param {string} [title] accessible label; falls back to nothing (icon is decorative)
 */
export default function PersonaIcon({ icon, size = 20, badge, title, style }) {
  const glyph = GLYPHS[icon]

  // An unknown key should be visible in the UI, not silently blank — a mode file with a
  // typo'd icon is otherwise invisible until someone notices an empty square.
  const svg = (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      {...STROKE}
      role={title ? 'img' : 'presentation'}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      style={{ display: 'block', flexShrink: 0, ...(badge ? null : style) }}
    >
      {title && <title>{title}</title>}
      {glyph ?? <circle cx="12" cy="12" r="8.5" strokeDasharray="2 2.5" />}
    </svg>
  )

  if (!badge) return svg

  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      {svg}
      <span
        className="mono"
        style={{
          position: 'absolute', right: -3, bottom: -3,
          fontSize: Math.max(7, Math.round(size * 0.36)), lineHeight: 1,
          fontWeight: 700, letterSpacing: '-0.02em',
          padding: '1px 1.5px', borderRadius: 3,
          background: 'var(--c-bg)', color: 'currentColor',
        }}
      >{badge}</span>
    </span>
  )
}
