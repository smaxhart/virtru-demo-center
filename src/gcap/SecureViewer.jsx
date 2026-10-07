import { useState } from 'react'
import { DOC_BY_ID, CUSTODIANS } from './data.js'
import { markingOf } from './marking.js'
import { fileNameOf } from './TdfInspector.jsx'
import { byteSize } from './cipher.js'
import { emailOf, usernameOf } from './desk.js'
import { evaluatePolicy, groupLabel } from '../data/policyMatch.js'
import { Ico, ICONS, TdfGlyph } from './winui.jsx'

const HOST = 'dsp.gigo.example'
const WATERMARK = '${username} / ${email} / ${name}' // eslint-disable-line no-template-curly-in-string

const Logo = ({ s = 22 }) => (
  <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10.500" stroke="#0d4a8f" strokeWidth="2" /><path d="M7.500 9.500 12 16l4.500-6.500" stroke="#0d4a8f" strokeWidth="2.400" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;')

/** The viewer's watermark setting, filled in with the signed-in person and tiled across the page. */
function watermarkUrl(p) {
  const text = WATERMARK.replace('${username}', usernameOf(p)).replace('${email}', emailOf(p)).replace('${name}', p.name) // eslint-disable-line no-template-curly-in-string
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='620' height='240'><text x='310' y='120' transform='rotate(-24 310 120)' text-anchor='middle' font-family='Roboto,Arial,sans-serif' font-size='13' fill='rgba(0,0,0,0.17)'>${esc(text)}</text></svg>`
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function Page({ ctx, v, p }) {
  const r = v.dying ? v.frozen : v.res
  const doc = DOC_BY_ID[v.docId]
  const name = fileNameOf(ctx.unitsOf(v.docId)[0])
  if (!r || r.status === 'pending') {
    return <div className="sv-wait"><i className="sv-spin" aria-hidden="true" /><p>Decrypting {name}…</p></div>
  }
  if (r.result.granted) {
    const { entry, tier, text } = r.result
    const marking = markingOf(entry.unit.policy)
    const block = marking.level === 'secret' || marking.level === 'ts-sci'
    const [title, ...rest] = text.split('\n\n')
    const save = () => {
      const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
      const a = document.createElement('a')
      a.href = url
      a.download = name.replace(/\.tdf$/, '.txt')
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      ctx.say(`Saved a decrypted copy of ${name.replace(/\.tdf$/, '')}.`)
    }
    const paper = (
      <div className="sv-paper" key={`${entry.unit.key}-${r.result.tried?.[0]?.at ?? 0}`}>
        <div className="sv-ban" style={{ background: marking.tone }}>{marking.banner}</div>
        <div className="sv-pb">
          <h4>{title}</h4>
          {rest.map((para, i) => <p key={i}>{para}</p>)}
        </div>
        <div className="sv-ft"><span>{tier && doc.tiers ? tier.label : doc.title}</span><span>key released by {CUSTODIANS[doc.custodian].label}</span></div>
      </div>
    )
    return (
      <div className="sv-doc">
        <div className="sv-tool">
          <span className="sv-fn" title={name}>{name.replace(/\.tdf$/, '')}</span>
          <span className="sv-pg">1 / 1</span>
          <span className="sv-zm"><Ico d={ICONS.zoomOut} size={15} /><em>100%</em><Ico d={ICONS.zoomIn} size={15} /></span>
          <span className="sv-sp" />
          {block && <span className="sv-pol">Download disabled by policy</span>}
          <button onClick={save} disabled={block} title={block ? 'This file carries a prevent_download obligation' : 'Download a decrypted copy'} aria-label="Download"><Ico d={ICONS.dl} size={16} /></button>
          <button aria-label="Print" tabIndex={-1}><Ico d={ICONS.print} size={16} /></button>
        </div>
        <div className="sv-view">
          <div className="sv-scroll">{v.dying ? <div className="dying">{paper}</div> : paper}</div>
          <div className="sv-wm" style={{ backgroundImage: watermarkUrl(p) }} aria-hidden="true" />
        </div>
      </div>
    )
  }
  const entries = ctx.unitsOf(v.docId)
  const groups = entries.length ? evaluatePolicy(ctx.entsOf(p), entries.at(-1).unit.policy).groups : []
  const session = /disabled|removed/i.test(r.why ?? '')
  return (
    <div className="sv-err">
      <div className="sv-alert" role="alert">
        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" fill="#d32f2f" /><path d="M12 7v6M12 16.500v.01" stroke="#fff" strokeWidth="2.200" strokeLinecap="round" /></svg>
        <div>
          <b>Unable to open {name}</b>
          <p>{session ? 'Your account can no longer decrypt files. ' : 'You do not have access to this file. '}{r.why}</p>
        </div>
      </div>
      {groups.length > 0 && (
        <table className="sv-tbl">
          <thead><tr><th>Required by the file</th><th>You hold</th><th /></tr></thead>
          <tbody>
            {groups.map(g => (
              <tr key={g.definition} className={g.satisfied ? 'ok' : 'bad'}>
                <td>{g.satisfied ? `${g.name}: ${g.matched.split('/value/')[1]}` : groupLabel(g)}</td>
                <td>{g.held.length ? g.held.join(', ') : 'nothing'}</td>
                <td>{g.satisfied ? '✓' : '✗'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <code className="sv-code">permission_denied · 403 · {entries[0]?.unit.key ?? v.docId}</code>
    </div>
  )
}

/** Windows "Open" dialog over the Downloads folder: how a file gets into the viewer by hand. */
function OpenDialog({ files, onOpen, onCancel }) {
  const [sel, setSel] = useState(null)
  return (
    <div className="ox-scrim">
      <div className="eg-open" role="dialog" aria-label="Open">
        <div className="ox-dh"><span>Open</span><button onClick={onCancel} aria-label="Close">✕</button></div>
        <div className="eg-path"><Ico d={ICONS.back} size={13} /><span>This PC</span><Ico d={ICONS.chevR} size={11} /><span>Downloads</span></div>
        <div className="eg-list">
          <div className="eg-hd"><span>Name</span><span>Type</span><span>Size</span></div>
          {files.length === 0 && <p className="eg-none">This folder is empty.</p>}
          {files.map(f => (
            <button key={f.id} className={sel === f.id ? 'on' : ''} onClick={() => setSel(f.id)} onDoubleClick={() => onOpen(f)}>
              <span><TdfGlyph w={14} h={17} />{f.name}</span><span>TDF File</span><span>{f.size}</span>
            </button>
          ))}
        </div>
        <div className="eg-foot">
          <label>File name:<input readOnly value={files.find(f => f.id === sel)?.name ?? ''} /></label>
          <button disabled={!sel} onClick={() => onOpen(files.find(f => f.id === sel))}>Open</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

/** Edge, with one tab open on the Secure Viewer, signed in by SSO as whoever sits at this PC. */
export default function EdgeView({ ctx, pid }) {
  const { S } = ctx
  const p = ctx.who(pid)
  const email = emailOf(p)
  const views = S.views.filter(v => v.pid === pid && !v.closed)
  const cur = views.find(v => v.id === S.vtab[pid])
  const [picker, setPicker] = useState(false)
  const files = S.files.filter(f => f.pid === pid && f.tdf)
  const take = (f) => { setPicker(false); ctx.viewDoc(pid, f.docId, f.from) }

  return (
    <section className="eg" aria-label="Microsoft Edge">
      <div className="eg-top">
        <span className="eg-tab"><Logo s={15} /><span>Virtru Secure Viewer</span><Ico d={ICONS.x} size={11} /></span>
        <span className="eg-new"><Ico d={ICONS.plus} size={13} /></span>
        <i className="dk-gap" />
      </div>
      <div className="eg-bar">
        <span className="eg-nav"><Ico d={ICONS.back} size={16} /><Ico d={ICONS.fwdNav} size={16} /><Ico d={ICONS.refresh} size={15} /><Ico d={ICONS.home} size={16} /></span>
        <span className="eg-url"><Ico d={ICONS.lock} size={12} /><span><b>{HOST}</b>/secureviewer/</span></span>
        <span className="eg-nav"><Ico d={ICONS.star} size={15} /><span className="eg-pf" style={{ background: p.color }}>{p.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span><Ico d={ICONS.more} size={16} /></span>
      </div>

      <div className="sv">
        <header className="sv-h">
          <Logo s={26} /><span className="sv-t">Virtru Secure Viewer</span>
          <span className="sv-sp" />
          <span className="sv-who"><Ico d={ICONS.user} size={16} />{email}</span>
        </header>
        <div className="sv-tabs" role="tablist">
          <span className="sv-rf"><Ico d={ICONS.refresh} size={15} /></span>
          {views.map(v => (
            <span key={v.id} role="tab" aria-selected={cur?.id === v.id} className={`sv-tab ${cur?.id === v.id ? 'on' : ''}`} onClick={() => ctx.setVtab(pid, v.id)}>
              <span>{fileNameOf(ctx.unitsOf(v.docId)[0])}</span>
              <button aria-label="Close tab" onClick={(e) => { e.stopPropagation(); ctx.closeView(v) }}>✕</button>
            </span>
          ))}
          <span role="tab" aria-selected={!cur} className={`sv-tab ${!cur ? 'on' : ''}`} onClick={() => ctx.setVtab(pid, null)}><span>+ Add File</span></span>
        </div>
        <div className="sv-body">
          {cur ? <Page ctx={ctx} v={cur} p={p} /> : (
            <div className="sv-drop">
              <Ico d={ICONS.up} size={56} sw={1.1} />
              <h3>Drop files here</h3>
              <p>— or —</p>
              <button onClick={() => setPicker(true)}>+ Add file</button>
            </div>
          )}
        </div>
      </div>
      {picker && <OpenDialog files={files.map(f => ({ ...f, size: byteSize(ctx.sizeOf(f.docId)) }))} onOpen={take} onCancel={() => setPicker(false)} />}
    </section>
  )
}
