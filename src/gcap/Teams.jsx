import { useEffect, useRef, useState } from 'react'
import { DOCUMENTS } from './data.js'
import { fileNameOf } from './TdfInspector.jsx'
import { byteSize } from './cipher.js'
import { CHANNELS, emailOf } from './desk.js'
import { initialsOf } from './ui.jsx'
import { Ico, ICONS, TdfGlyph } from './winui.jsx'

const THUMB = 'M7 9V17H4V9zM7 9l3-5c1.500 0 2 1 2 2v3h4a1.500 1.500 0 0 1 1.500 1.800l-1 5A1.500 1.500 0 0 1 15 17H7'

const RAIL = [['Activity', ICONS.bell], ['Chat', ICONS.chat], ['Teams', ICONS.people], ['Calendar', ICONS.cal], ['Calls', ICONS.phone]]

/** Teams: a programme channel where a protected file is posted once and opened by whoever may read it. */
export default function Teams({ ctx, pid }) {
  const { S } = ctx
  const me = ctx.who(pid)
  const [ch, setCh] = useState('integration')
  const [text, setText] = useState('')
  const [docs, setDocs] = useState([])
  const [menu, setMenu] = useState(false)
  const end = useRef(null)
  const posts = S.chat.filter(m => m.ch === ch)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [ch, S.chat.length])

  const send = () => {
    if (!text.trim() && !docs.length) return
    ctx.postChat(pid, ch, text.trim(), docs)
    setText(''); setDocs([]); setMenu(false)
  }
  const chan = CHANNELS.find(c => c.id === ch)
  const nameOf = (d) => fileNameOf(ctx.unitsOf(d)[0])

  return (
    <section className="tm" aria-label="Microsoft Teams" onClick={() => menu && setMenu(false)}>
      <div className="tm-top">
        <span className="tm-logo">T</span>
        <span className="tm-find"><Ico d={ICONS.srch} size={14} />Search</span>
        <span className="tm-me" style={{ background: me.color }} title={emailOf(me)}>{initialsOf(me)}</span>
        <i className="dk-gap" />
      </div>
      <div className="tm-grid">
        <nav className="tm-rail" aria-label="Apps">
          {RAIL.map(([n, d]) => <span key={n} className={n === 'Teams' ? 'on' : ''}><Ico d={d} size={20} /><small>{n}</small></span>)}
        </nav>
        <aside className="tm-side">
          <h5>Teams</h5>
          <div className="tm-team"><i>GP</i><b>GCAP Programme</b></div>
          {CHANNELS.map(c => (
            <button key={c.id} className={c.id === ch ? 'on' : ''} onClick={() => setCh(c.id)}>{c.name}</button>
          ))}
        </aside>
        <div className="tm-main">
          <header className="tm-ch">
            <b>{chan.name}</b>
            <span className="on">Posts</span><span>Files</span><span>Notes</span><Ico d={ICONS.plus} size={14} />
          </header>
          <div className="tm-feed" role="log" aria-label={`${chan.name} posts`}>
            {posts.length === 0 && <p className="tm-none">No posts in this channel yet.</p>}
            {posts.map((m, i) => {
              const from = ctx.who(m.from)
              return (
                <div key={m.id}>
                  {(i === 0 || posts[i - 1].day !== m.day) && <h6><span>{m.day}</span></h6>}
                  <article className="tm-post">
                    <span className="tm-av" style={{ background: from.color }}>{initialsOf(from)}</span>
                    <div>
                      <div className="tm-hd"><b>{from.name}</b><time>{m.day === 'Today' ? m.at : `${m.day} ${m.at}`}</time></div>
                      {m.text && <p>{m.text}</p>}
                      {m.docs.map(d => (
                        <button key={d} className="tm-file" onClick={() => ctx.viewDoc(pid, d, m.from)} title="Open in Virtru Secure Viewer">
                          <TdfGlyph w={20} h={24} />
                          <span><b>{nameOf(d)}</b><small>{byteSize(ctx.sizeOf(d))} · Protected by Virtru</small></span>
                        </button>
                      ))}
                      <button className={`tm-like ${m.likes > 0 ? 'has' : ''}`} onClick={() => ctx.set(m, { likes: m.likes + 1 })} aria-label="Like"><Ico d={THUMB} size={14} />{m.likes > 0 ? m.likes : ''}</button>
                    </div>
                  </article>
                </div>
              )
            })}
            <div ref={end} />
          </div>
          <div className="tm-cmp">
            {docs.length > 0 && <div className="tm-chips">{docs.map(d => <span key={d}><TdfGlyph w={13} h={16} />{nameOf(d)}<button aria-label={`Remove ${nameOf(d)}`} onClick={() => setDocs(docs.filter(x => x !== d))}>✕</button></span>)}</div>}
            <textarea value={text} rows={2} placeholder={`Type a message to ${chan.name}`} aria-label="Message" onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
            <div className="tm-tools">
              <span className="tm-attach">
                <button aria-haspopup="menu" onClick={(e) => { e.stopPropagation(); setMenu(!menu) }} aria-label="Attach"><Ico d={ICONS.clip} size={16} /></button>
                {menu && (
                  <div className="ox-menu tm-menu" role="menu">
                    {DOCUMENTS.filter(d => !docs.includes(d.id)).map(d => <button key={d.id} role="menuitem" onClick={() => { setDocs([...docs, d.id]); setMenu(false) }}>{d.title}</button>)}
                  </div>
                )}
              </span>
              <button aria-label="Emoji" tabIndex={-1}><Ico d={ICONS.emoji} size={16} /></button>
              <span className="tm-sp" />
              <button className="tm-send" onClick={send} disabled={!text.trim() && !docs.length} aria-label="Send"><Ico d={ICONS.send} size={16} /></button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
