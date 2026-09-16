import { useApp } from '../context/AppContext.jsx'

/**
 * The waiting screen, used in two places.
 *
 * On the home page it covers the platform starting up. Inside a mode it covers that too (a
 * deep link can land before the sidecar is up) plus the mode's own corpus encryption, which
 * happens lazily on first launch rather than at boot.
 */

function Spinner({ color = 'var(--c-accent)' }) {
  return (
    <span style={{
      width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${color}`, borderTopColor: 'transparent',
      display: 'inline-block', animation: 'spin 0.7s linear infinite',
    }} />
  )
}

export default function BootGate() {
  const { platformPhase, corpusPhase, mode, bootError, bootProgress } = useApp()

  if (platformPhase === 'error' || corpusPhase === 'error') {
    return (
      <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 32 }}>
        <div className="card" style={{ maxWidth: 620, padding: 24, borderColor: 'var(--c-deny-br)' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-deny)', marginBottom: 10 }}>
            {platformPhase === 'error' ? 'The platform did not start' : 'The corpus could not be encrypted'}
          </div>
          <pre style={{
            fontSize: 11, lineHeight: 1.6, color: 'var(--c-text-3)', margin: 0,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
            borderRadius: 8, padding: 12, maxHeight: 300, overflowY: 'auto',
          }}>{bootError}</pre>
          <div style={{ fontSize: 11, color: 'var(--c-text-5)', marginTop: 14, lineHeight: 1.7 }}>
            {platformPhase === 'error'
              ? <>Common causes: the platform binary is missing (run <code>npm run sync:resources</code>),
                  or ports 7777/7778 are already taken by another process.</>
              : <>A document policy usually names an attribute value the seed did not create.
                  Check the FQNs in the mode file against <code>electron/seeder.js</code>, or run{' '}
                  <code>node scripts/verify-matrix.mjs</code> to find the mismatch.</>}
          </div>
        </div>
      </div>
    )
  }

  const steps = [
    { key: 'platform', label: 'Starting the OpenTDF platform', detail: 'Embedded Postgres, KAS keys, policy seed' },
  ]
  if (mode) {
    steps.push({
      key: 'encrypting',
      label: `Encrypting the ${mode.short} corpus`,
      detail: 'Sealing each document into a TDF with its policy bound inside it',
    })
  }

  const activeIndex = platformPhase === 'ready' ? 1 : 0
  const { done, total, label } = bootProgress

  return (
    <div style={{ height: '100%', display: 'grid', placeItems: 'center', padding: 32 }}>
      <div style={{ width: 440, animation: 'fadeIn 0.3s ease-out' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--c-text-1)', marginBottom: 4 }}>
          Virtru Secure AI
        </div>
        <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginBottom: 22, lineHeight: 1.6 }}>
          {mode
            ? `Preparing the ${mode.name} scenario. Nothing leaves this machine except the model call itself.`
            : 'Bringing up a local data security platform. Nothing leaves this machine except the model call itself.'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {steps.map((step, i) => {
            const state = i < activeIndex ? 'done' : i === activeIndex ? 'active' : 'pending'
            return (
              <div key={step.key} className="card" style={{
                padding: '12px 14px', display: 'flex', gap: 11, alignItems: 'flex-start',
                opacity: state === 'pending' ? 0.5 : 1,
                borderColor: state === 'active' ? 'rgba(37,99,235,0.35)' : 'var(--c-border)',
              }}>
                <div style={{ width: 14, paddingTop: 1, flexShrink: 0, textAlign: 'center' }}>
                  {state === 'done'   && <span style={{ color: 'var(--c-grant)', fontWeight: 700, fontSize: 12 }}>✓</span>}
                  {state === 'active' && <Spinner />}
                  {state === 'pending' && <span style={{ color: 'var(--c-text-6)' }}>·</span>}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-2)' }}>{step.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-5)', marginTop: 2 }}>{step.detail}</div>

                  {state === 'active' && step.key === 'encrypting' && total > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{
                        height: 3, borderRadius: 2, background: 'var(--c-border)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${(done / total) * 100}%`,
                          background: 'var(--c-accent)', transition: 'width 0.2s',
                        }} />
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: 'var(--c-text-6)', marginTop: 5 }}>
                        {done}/{total} — {label}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 10, color: 'var(--c-text-6)', marginTop: 18, lineHeight: 1.7 }}>
          First launch takes longer — the database cluster is initialized and the policy
          namespace is seeded once.
        </div>
      </div>
    </div>
  )
}
