/**
 * The handful of form pieces that appear in more than one place.
 *
 * These started out inside `AddDocument.jsx`. The scenario builder needs the same attribute
 * picker, and having two of them would be the easiest possible way to end up with a builder that
 * offers values the upload flow does not — so there is one, here.
 */

const MAX_POLICY_VALUES = 20

export const field = {
  width: '100%', fontSize: 12, padding: '6px 9px', borderRadius: 6,
  background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
  color: 'var(--c-text-2)', fontFamily: 'inherit',
}

export function Label({ children, hint }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <span className="section-label">{children}</span>
      {hint && <span style={{ fontSize: 10, color: 'var(--c-text-6)', marginLeft: 7 }}>{hint}</span>}
    </div>
  )
}

export function Notice({ tone = 'warn', children }) {
  const c = tone === 'deny' ? 'deny' : tone === 'grant' ? 'grant' : 'warn'
  return (
    <div style={{
      padding: '8px 11px', borderRadius: 7, fontSize: 11, lineHeight: 1.6,
      background: `var(--c-${c}-bg)`, border: `1px solid var(--c-${c}-br)`,
      color: `var(--c-${c})`,
    }}>{children}</div>
  )
}

/**
 * Pick attribute values, and get FQNs back.
 *
 * `vocab` is `{ namespace, defs: [{ name, values, hierarchy }] }` — the shape
 * `window.electronAPI.getAttributeDefs()` returns, so the picker can only ever offer values the
 * platform actually created. Offering one it did not would produce a policy that denies everybody
 * with nothing in the UI to explain why.
 *
 * `footer` is false when the caller is collecting a subject's grants rather than a document's
 * policy. The 20-value ceiling and the AND-ing note are facts about policies, not about people.
 */
export function AttributePicker({ vocab, selected, onChange, footer = true }) {
  const toggle = (fqn) => onChange(
    selected.includes(fqn) ? selected.filter(f => f !== fqn) : [...selected, fqn]
  )

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {vocab.defs.map(def => (
          <div key={def.name}>
            <div className="mono" style={{ fontSize: 9.5, color: 'var(--c-text-5)', marginBottom: 4 }}>
              {def.name}
              <span style={{ color: 'var(--c-text-6)' }}>
                {' '}· {def.hierarchy ? 'hierarchy — tagging a level admits everyone above it' : 'any of'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {def.values.map(v => {
                const fqn = `${vocab.namespace}/${def.name}/value/${v}`
                const on = selected.includes(fqn)
                return (
                  <button key={v} onClick={() => toggle(fqn)} className="mono" style={{
                    fontSize: 9.5, padding: '3px 7px', borderRadius: 4, cursor: 'pointer',
                    background: on ? 'var(--c-grant-bg)' : 'var(--c-surface-2)',
                    color: on ? 'var(--c-grant)' : 'var(--c-text-5)',
                    border: `1px solid ${on ? 'var(--c-grant-br)' : 'var(--c-border)'}`,
                  }}>{on ? '✓ ' : ''}{v}</button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {footer && (
        <div style={{ fontSize: 10, color: 'var(--c-text-6)', marginTop: 10, lineHeight: 1.6 }}>
          Separate definitions AND together — clearance plus mission means both. Values inside one
          definition follow that definition's rule.
          {' '}
          <span style={{ color: selected.length > MAX_POLICY_VALUES ? 'var(--c-deny)' : 'var(--c-text-5)' }}>
            {selected.length} of {MAX_POLICY_VALUES} values used.
          </span>
          {selected.length === 0 && (
            <span style={{ color: 'var(--c-warn)' }}>
              {' '}An empty policy is legal and releases to every authenticated persona.
            </span>
          )}
          {selected.length > MAX_POLICY_VALUES && (
            <span style={{ color: 'var(--c-deny)' }}>
              {' '}Past 20 the platform's decision lookup fails and the KAS denies everyone.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
