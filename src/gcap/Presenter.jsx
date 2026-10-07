import { makeT } from './scmText.js'

const t = makeT('en')

export const MAIN = ['gcap-marco', 'gcap-priya', 'gcap-wren', 'gmail']

/** Everything the audience should not have to look at: scene, optional apps, the pull, the audit trail and the counters. */
export default function Presenter({ ctx, pc, scene, tally, revoked, others, onClose, onScene, onReset, onDisable, onRestore, onSeat, onApp, onInspect }) {
  const { S } = ctx
  const first = ctx.who(pc).name.split(' ')[0]
  const recent = S.log.slice(0, 8)

  return (
    <aside className="pd" aria-label="Presenter controls">
      <header><b>Presenter</b><button onClick={onClose} aria-label="Close presenter controls">✕</button></header>

      <section>
        <h5>Scene</h5>
        <label className={`pd-opt ${scene === 'payoff' ? 'on' : ''}`}>
          <input type="radio" name="pd-scene" checked={scene === 'payoff'} onChange={() => onScene('payoff')} />
          <span><b>Start at the payoff</b><small>Priya and Ryan already hold Marco&rsquo;s mail</small></span>
        </label>
        <label className={`pd-opt ${scene === 'fresh' ? 'on' : ''}`}>
          <input type="radio" name="pd-scene" checked={scene === 'fresh'} onChange={() => onScene('fresh')} />
          <span><b>Fresh start</b><small>Empty Sent Items; compose it live</small></span>
        </label>
        <button className="btn" onClick={onReset}>Reset scene</button>
      </section>

      <section>
        <h5>Apps on the desktop</h5>
        <div className="pd-apps">
          <label><input type="checkbox" checked disabled readOnly />Outlook</label>
          <label><input type="checkbox" checked disabled readOnly />Secure Viewer</label>
          <label><input type="checkbox" checked={S.apps.teams} onChange={e => onApp('teams', e.target.checked)} />Teams</label>
          <label><input type="checkbox" checked={S.apps.files} onChange={e => onApp('files', e.target.checked)} />File Explorer</label>
        </div>
      </section>

      <section>
        <h5>Pull access</h5>
        {pc === 'gmail'
          ? <p className="pd-note">Ryan is not a user, so there is no account to disable.</p>
          : revoked.has(pc)
            ? <button className="btn" onClick={() => onRestore(pc)}>Restore {first}&rsquo;s account</button>
            : <button className="btn d" onClick={() => onDisable(pc)}>Disable {first}&rsquo;s account</button>}
      </section>

      <section>
        <h5>Under the hood</h5>
        <button className="btn" onClick={onInspect}>Inspect the TDF</button>
        <p className="pd-note">Ctrl/Cmd + Shift + A shows who can open what.</p>
        {others.length > 0 && (
          <details>
            <summary>Sit as someone else</summary>
            <div className="pd-who">
              {others.map(x => <button key={x.id} className={`btn ${revoked.has(x.id) ? 'off' : ''}`} onClick={() => onSeat(x.id)}>{x.name}</button>)}
            </div>
          </details>
        )}
        <div className="pd-log" aria-label="Audit log">
          {recent.map((e, i) => (
            <div key={i}><time>{t(e.t)}</time><span><b>{t(e.w)}</b> {e.k === 'c' ? e.x : t(e.x, ...(e.a ?? []))}{e.k === 'permit' && <em>permit</em>}{e.k === 'deny' && <em className="deny">deny</em>}</span></div>
          ))}
        </div>
        <div className="pd-tally">
          <div><b>{tally.open}</b>copies open</div>
          <div><b>{tally.refused}</b>refused</div>
          <div><b>{tally.off}</b>disabled</div>
        </div>
      </section>
    </aside>
  )
}
