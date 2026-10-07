import { stampNow, TODAY_UK } from './desk.js'
import OutlookView from './OutlookView.jsx'
import Teams from './Teams.jsx'
import EdgeView from './SecureViewer.jsx'
import Explorer from './Explorer.jsx'
import { Ico, ICONS } from './winui.jsx'

const APPS = {
  outlook: { name: 'Outlook', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="3" fill="#0f6cbd" /><path d="M3 7l9 6 9-6" stroke="#fff" strokeWidth="1.800" fill="none" strokeLinecap="round" /></svg>) },
  teams: { name: 'Teams', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="4" fill="#5b5fc7" /><path d="M7 9h10M12 9v8" stroke="#fff" strokeWidth="2.200" strokeLinecap="round" /></svg>) },
  edge: { name: 'Microsoft Edge', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#0c8f8f" /><path d="M5 13c0-4 3-7 7-7s6 2.500 6 5.500c0 2-2 2.500-4 2.500H9c0 2 2 3 4 3 1.500 0 2.800-.5 4-1.500" stroke="#bfe9ff" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>) },
  files: { name: 'File Explorer', icon: (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 6a2 2 0 0 1 2-2h5l2 2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="#f4b73f" /><path d="M2 10h20v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2z" fill="#ffd56b" /></svg>) },
}

const APPS_FOR = (pid) => (pid === 'gmail' ? ['outlook', 'files'] : ['outlook', 'teams', 'edge', 'files'])

/** A Windows 11 desktop for one person: the apps that person has, a taskbar, and a clock. */
export default function Desktop({ ctx, pid, onBack }) {
  const { S } = ctx
  const d = ctx.dkOf(pid)
  const who = ctx.who(pid)
  const apps = APPS_FOR(pid)

  const toggle = (a) => {
    if (!d.open.includes(a)) { d.open.push(a); d.front = a }
    else if (d.front === a) d.front = null
    else d.front = a
    ctx.set(d, {})
  }
  const close = (a) => { d.open = d.open.filter(x => x !== a); if (d.front === a) d.front = d.open.at(-1) ?? null; ctx.set(d, {}) }
  const minimise = (a) => { if (d.front === a) d.front = null; ctx.set(d, {}) }

  const body = (a) => {
    if (a === 'outlook') return <OutlookView ctx={ctx} owner={who} onBack={onBack} />
    if (a === 'teams') return <Teams ctx={ctx} pid={pid} />
    if (a === 'edge') return <EdgeView ctx={ctx} pid={pid} />
    return <Explorer ctx={ctx} pid={pid} />
  }

  return (
    <div className="dk" aria-label={`${who.name}'s desktop`}>
      <div className="dk-area">
        <div className="dk-icons" aria-hidden="true"><span><svg width="34" height="34" viewBox="0 0 24 24"><path d="M6 7h12l-1 13H7z" fill="#dfe8f1" stroke="#9fb3c8" /><path d="M5 7h14M10 7V5h4v2" stroke="#9fb3c8" fill="none" /></svg>Recycle Bin</span></div>
        {d.open.map(a => (
          <div key={a} className={`dk-win ${a} ${d.front === a ? 'front' : ''}`} hidden={d.front !== a}>
            <div className="dk-ctl">
              <button aria-label="Minimise" onClick={() => minimise(a)}><Ico d={ICONS.min} size={13} sw={1} /></button>
              <button aria-label="Maximise" tabIndex={-1}><Ico d={ICONS.max} size={12} sw={1} /></button>
              <button className="x" aria-label="Close" onClick={() => close(a)}><Ico d={ICONS.x} size={13} sw={1} /></button>
            </div>
            {body(a)}
          </div>
        ))}
      </div>
      <div className="dk-bar">
        <span className="dk-sp" />
        <div className="dk-apps" role="toolbar" aria-label="Taskbar">
          <button className="dk-start" aria-label="Start" tabIndex={-1}><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M2 3.500l7-1V9H2zM10 2.400l8-1.200V9h-8zM2 10h7v6.500l-7-1zM10 10h8v7.800l-8-1.200z" fill="#4cc2ff" /></svg></button>
          {apps.map(a => (
            <button key={a} className={`${d.open.includes(a) ? 'run' : ''} ${d.front === a ? 'on' : ''}`} onClick={() => toggle(a)} title={APPS[a].name} aria-label={APPS[a].name}>{APPS[a].icon}</button>
          ))}
        </div>
        <div className="dk-tray"><span>ENG</span><span className="dk-ck"><b>{stampNow(S)}</b><small>{TODAY_UK}</small></span></div>
      </div>
    </div>
  )
}
