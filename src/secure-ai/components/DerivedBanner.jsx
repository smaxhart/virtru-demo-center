import { explainBanner } from '../ai/banner.js'

/**
 * A CUI banner shown as a derivation rather than a label.
 *
 * The point is auditability. Everywhere else in this app a marking is a string a scenario author
 * typed, and the audience is asked to take it on faith that it matches the policy underneath. For a
 * compliance scenario that is exactly backwards: the question an assessor asks is "show me that the
 * marking and the enforcement are the same thing", and the only convincing answer is to render the
 * banner *from* the attribute values the KAS actually decides on, itemised, with the authority for
 * each one.
 *
 * Renders nothing when the policy names no `cui` or `ldc` value. That is the normal case for four
 * of the five modes and is not worth a placeholder — those documents have authored banners, and a
 * "not derivable" note beside one would read as a defect.
 *
 * @param {{policy: string[], compact?: boolean, style?: object}} props
 *   `compact` is the 236px decision rail: same rows, no prose, authority on its own line.
 *   `style` rather than a wrapper div at the call site, so a caller's spacing disappears along with
 *   the block on the four modes where nothing is derivable.
 */
export default function DerivedBanner({ policy, compact = false, style }) {
  const explained = explainBanner(policy)
  if (!explained) return null

  const { banner, level, rows } = explained

  return (
    <div className="card" style={{
      padding: compact ? '9px 11px' : '10px 13px',
      background: 'var(--c-surface-2)',
      ...style,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <div className="section-label" style={{ flex: compact ? '1 0 100%' : '0 0 auto' }}>
          CUI marking, derived
        </div>
        {/* Basic vs Specified is the first thing that changes an assessor's handling
            obligations, so it sits with the heading rather than inside the rows. */}
        <span className="chip chip-mono" style={{ height: 20, background: 'var(--c-surface)' }}>{level}</span>
      </div>

      <div className="mono" style={{
        fontSize: compact ? 12 : 13.5, fontWeight: 700,
        color: 'var(--c-text-2)', margin: compact ? '6px 0 7px' : '7px 0 9px',
        wordBreak: 'break-word',
      }}>{banner}</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 4 : 5 }}>
        {rows.map(r => (
          <div key={r.fqn} style={{
            display: 'flex', gap: 7, alignItems: 'baseline',
            flexWrap: compact ? 'wrap' : 'nowrap',
          }}>
            <span className="chip chip-mono" style={{
              height: 20, flexShrink: 0, background: 'var(--c-surface)', color: 'var(--c-text-3)',
            }}>{r.fqn}</span>
            <span className="mono" style={{
              fontSize: 11, color: 'var(--c-text-3)', flexShrink: 0,
            }}>{/* A category with no marking of its own is the whole point of cui:basic. */}
              {r.marking ?? '(no category marking)'}
            </span>
            <span style={{
              fontSize: 11.5, color: 'var(--c-text-5)', lineHeight: 1.5,
              flex: compact ? '1 0 100%' : '1 1 auto', minWidth: 0,
            }}>
              {r.name}
              {r.authority && (
                <span style={{ color: 'var(--c-text-5)' }}>, {r.authority}</span>
              )}
            </span>
          </div>
        ))}
      </div>

      {!compact && (
        <div style={{ fontSize: 11.5, color: 'var(--c-text-5)', marginTop: 9, lineHeight: 1.6 }}>
          No part of this banner was typed into the document. It is assembled from the attribute
          values above — the same values the KAS evaluates — so the marking and the enforcement
          cannot drift apart. What it does <em>not</em> carry is a decontrol date: DSP attributes
          are static, so this is the marking as of now.
        </div>
      )}
    </div>
  )
}
