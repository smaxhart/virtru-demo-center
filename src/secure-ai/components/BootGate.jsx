import UiIcon from '../../components/UiIcon.jsx'
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
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-deny)', marginBottom: 10 }}>
            {platformPhase === 'error' ? 'The platform did not start' : 'The corpus could not be encrypted'}
          </div>
          <pre style={{
            fontSize: 12, lineHeight: 1.6, color: 'var(--c-text-3)', margin: 0, fontFamily: 'var(--font-mono)',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            background: 'var(--c-surface-2)', border: '1px solid var(--c-border)',
            borderRadius: 8, padding: 12, maxHeight: 300, overflowY: 'auto',
          }}>{bootError}</pre>
          <div style={{ fontSize: 12.5, color: 'var(--c-text-4)', marginTop: 14, lineHeight: 1.65 }}>
            {platformPhase === 'error'
              ? <>Common causes: the platform binary is missing (run <code className="code">npm run sync:resources</code>),
                  or ports 7777/7778 are already taken by another process.</>
              : <>A document policy usually names an attribute value the seed did not create.
                  Check the FQNs in the mode file against <code className="code">electron/seeder.js</code>, or run{' '}
                  <code className="code">node scripts/verify-matrix.mjs</code> to find the mismatch.</>}
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
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--c-text-1)', marginBottom: 6 }}>
          Virtru Secure AI
        </div>
        <div style={{ fontSize: 13.5, color: 'var(--c-text-4)', marginBottom: 22, lineHeight: 1.6 }}>
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
                borderColor: state === 'active' ? 'var(--c-focus)' : 'var(--c-border)',
              }}>
                <div style={{ width: 16, paddingTop: 1, flexShrink: 0, textAlign: 'center' }}>
                  {state === 'done'   && <span style={{ color: 'var(--c-grant)', display: 'flex' }}><UiIcon name="check" size={14} strokeWidth={2.4} /></span>}
                  {state === 'active' && <Spinner />}
                  {state === 'pending' && <span style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: 'var(--c-border-2)', margin: '4px auto 0' }} />}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: 'var(--c-text-1)' }}>{step.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--c-text-5)', marginTop: 2 }}>{step.detail}</div>

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
                      <div className="mono" style={{ fontSize: 11.5, color: 'var(--c-text-5)', marginTop: 5 }}>
                        {done}/{total} — {label}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginTop: 18, lineHeight: 1.65 }}>
          First launch takes longer: the database cluster is initialized and the policy
          namespace is seeded once.
        </div>
      </div>
    </div>
  )
}
