import { useEffect, useState } from 'react'
import { byteSize } from './cipher.js'
import { DOCUMENTS } from './data.js'
import { fileNameOf } from './TdfInspector.jsx'
import { EXTERNAL } from './scmData.js'
import { emailOf, seedInbox, seedSent } from './desk.js'
import { initialsOf } from './ui.jsx'
import { Ico, ICONS, TdfGlyph, ErrorDialog } from './winui.jsx'

/** A person as Outlook shows them: a display name, an address, a colour. */
const card = (p) => (p.id === 'gmail'
  ? { name: 'Ryan Mercer', email: EXTERNAL.name, color: p.color, initials: 'RM' }
  : { name: p.name, email: emailOf(p), color: p.color, initials: initialsOf(p) })

const FOLDERS = {
  inbox: ['Inbox', ICONS.inbox], sent: ['Sent Items', ICONS.send], drafts: ['Drafts', ICONS.draft],
  deleted: ['Deleted Items', ICONS.trash], junk: ['Junk Email', ICONS.junk], archive: ['Archive', ICONS.arch], hist: ['Conversation History', ICONS.folder],
}
const fullDate = (r) => (r.day === 'Today' ? `Wed 07/10/2026 ${r.at}` : `Tue 06/10/2026 ${r.at.replace(/^\w+ /, '')}`)

/** A mailbox: Inbox, Sent Items, and a compose pane. An insider's attachments open in the Secure Viewer; an outsider's hit the key server with no identity. */
export default function OutlookView({ ctx, owner, onBack }) {
  const { S } = ctx
  const ext = owner.id === 'gmail'
  const me = card(owner)
  const dk = ctx.dkOf(owner.id)
  const [folder, setFolder] = useState('inbox')
  const [sel, setSel] = useState(() => [...S.mails.filter(m => m.pid === owner.id)].reverse().find(m => !m.read)?.id ?? null)
  const [compose, setCompose] = useState(null)
  const [pick, setPick] = useState(null)
  const [menu, setMenu] = useState(null)
  const [seen, setSeen] = useState(() => new Set())
  const [gone, setGone] = useState(() => new Set())
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!dk.want) return
    setFolder('inbox'); setSel(dk.want); setCompose(null); dk.want = null
  }, [dk.want]) // eslint-disable-line react-hooks/exhaustive-deps

  const crTitle = ctx.crTitle
  const rowOf = (m, kind) => {
    const from = card(ctx.who(m.from))
    const to = m.pid === 'gmail'
      ? { name: m.toAddr && m.toAddr !== EXTERNAL.name ? '' : 'Ryan Mercer', email: m.toAddr ?? EXTERNAL.name }
      : card(ctx.who(m.pid))
    return { id: m.id, src: m, kind, from, to, subject: m.subject ?? `Shared: ${ctx.firstCr} · ${crTitle}`, body: m.body ?? ['The current baseline is attached.'], at: m.at ?? '09:41', day: m.day ?? 'Today', docs: m.docs, read: m.read }
  }
  const seedRow = (s, kind) => ({ id: s.id, src: null, kind, seed: true, from: kind === 'in' ? s.who : card(s.who), to: kind === 'in' ? me : { name: s.toName, email: s.toAddr }, subject: s.subject, body: s.body, at: s.at, day: s.day, docs: [], read: kind === 'out' || s.read })

  const inbox = [
    ...[...S.mails.filter(m => m.pid === owner.id)].reverse().map(m => rowOf(m, 'in')),
    ...(ext ? [] : seedInbox(owner).map(s => seedRow(s, 'in'))),
  ].filter(r => !gone.has(r.id))
  const sent = [
    ...[...S.mails.filter(m => m.from === owner.id)].reverse().map(m => rowOf(m, 'out')),
    ...(ext ? [] : seedSent(owner).map(s => seedRow(s, 'out'))),
  ].filter(r => !gone.has(r.id))
  const rows = folder === 'inbox' ? inbox : folder === 'sent' ? sent : []
  const row = rows.find(r => r.id === sel) ?? null
  const unread = inbox.filter(r => !(r.seed ? seen.has(r.id) || r.read : r.read)).length
  const isRead = (r) => (r.seed ? seen.has(r.id) || r.read : r.read)

  const choose = (r) => {
    setSel(r.id); setCompose(null); setPick(null); setMenu(null)
    if (r.src && !r.src.read) ctx.set(r.src, { read: true })
    if (r.seed) setSeen(new Set([...seen, r.id]))
  }
  const openFolder = (f) => { setFolder(f); setSel(null); setCompose(null); setMenu(null) }

  const startCompose = (init) => { setErr(''); setCompose({ to: '', subject: '', body: '', docs: [], ...init }) }
  const reply = () => row && startCompose({ to: row.kind === 'in' ? row.from.email : row.to.email, subject: /^RE:/i.test(row.subject) ? row.subject : `RE: ${row.subject}` })
  const forward = () => row && startCompose({ subject: /^FW:/i.test(row.subject) ? row.subject : `FW: ${row.subject}`, docs: [...row.docs] })
  const remove = () => { if (!row) return; setGone(new Set([...gone, row.id])); setSel(null) }

  const send = () => {
    if (!compose.to.trim()) { setErr('Add at least one recipient.'); return }
    const m = ctx.sendMail({ from: owner.id, toAddr: compose.to.trim(), subject: compose.subject.trim() || '(no subject)', body: compose.body.split('\n').filter(l => l.trim()), docs: compose.docs })
    setCompose(null); setFolder('sent'); setSel(m.id)
  }

  const nameOf = (d) => fileNameOf(ctx.unitsOf(d)[0])
  const openAtt = (d, r) => {
    setPick(d); setMenu(null)
    if (ext) { if (r.src) ctx.open(r.src, d) } else ctx.viewDoc(owner.id, d, r.src?.from ?? owner.id)
  }
  const suggestions = [...ctx.people.filter(x => x.id !== owner.id).map(x => emailOf(x)), EXTERNAL.name]
  const dialogSrc = row?.src?.res ? row.src : null

  return (
    <section className="ox" aria-label={`Outlook, ${FOLDERS[folder]?.[0] ?? folder}`} onClick={() => menu && setMenu(null)}>
      <div className="ox-top">
        <button className="ox-wf" aria-label="App launcher" tabIndex={-1}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor" aria-hidden="true">{[2, 8, 14].flatMap(x => [2, 8, 14].map(y => <circle key={`${x}${y}`} cx={x + 1} cy={y + 1} r="1.5" />))}</svg>
        </button>
        <span className="ox-brand">Outlook</span>
        <span className="ox-search"><Ico d={ICONS.srch} size={14} />Search</span>
        <span className="ox-sp" />
        {ext && onBack && <button className="ox-back" onClick={onBack}>Back to the SCM</button>}
        <span className="ox-ti"><Ico d={ICONS.bell} size={16} /></span>
        <span className="ox-ti"><Ico d={ICONS.gear} size={16} /></span>
        <span className="ox-me" style={{ background: me.color }} title={me.email}>{me.initials}</span>
        <i className="dk-gap" />
      </div>

      <div className="ox-grid">
        <nav className="ox-rail" aria-label="Apps">
          <span className="on"><Ico d={ICONS.mail} size={18} /></span>
          <span><Ico d={ICONS.cal} size={18} /></span>
          <span><Ico d={ICONS.people} size={18} /></span>
          <span><Ico d={ICONS.todo} size={18} /></span>
        </nav>

        <div className="ox-main">
          <div className="ox-rib">
            <div className="ox-tabs"><span className="on">Home</span><span>View</span><span>Help</span></div>
            <div className="ox-cmds">
              <button className="ox-new" onClick={() => startCompose()}><Ico d="M4 6.500h12v8H4zM4.500 7l5.500 4.500L15.500 7" size={15} />New mail<Ico d={ICONS.chev} size={12} /></button>
              <i className="ox-sep" />
              <button onClick={remove} disabled={!row}><Ico d={ICONS.del} size={15} />Delete</button>
              <button disabled={!row}><Ico d={ICONS.arch} size={15} />Archive</button>
              <button><Ico d={ICONS.junk} size={15} />Report<Ico d={ICONS.chev} size={12} /></button>
              <i className="ox-sep" />
              <button onClick={reply} disabled={!row}><Ico d={ICONS.reply} size={15} />Reply</button>
              <button onClick={reply} disabled={!row}><Ico d={ICONS.replyAll} size={15} />Reply all</button>
              <button onClick={forward} disabled={!row}><Ico d={ICONS.fwd} size={15} />Forward</button>
              <i className="ox-sep" />
              <button><Ico d={ICONS.flag} size={15} /></button>
              <button><Ico d={ICONS.more} size={15} /></button>
            </div>
          </div>

          <div className="ox-cols">
            <nav className="ox-folders" aria-label="Folders">
              <h6><Ico d={ICONS.chev} size={10} />Favorites</h6>
              <button className={folder === 'inbox' ? 'on' : ''} onClick={() => openFolder('inbox')}><Ico d={ICONS.inbox} />Inbox{unread > 0 && <b>{unread}</b>}</button>
              <button className={folder === 'sent' ? 'on' : ''} onClick={() => openFolder('sent')}><Ico d={ICONS.send} />Sent Items</button>
              <button className={folder === 'drafts' ? 'on' : ''} onClick={() => openFolder('drafts')}><Ico d={ICONS.draft} />Drafts</button>
              <h6><Ico d={ICONS.chev} size={10} />{me.email}</h6>
              {Object.entries(FOLDERS).map(([k, [label, d]]) => (
                <button key={k} className={folder === k ? 'on' : ''} onClick={() => openFolder(k)}><Ico d={d} />{label}{k === 'inbox' && unread > 0 && <b>{unread}</b>}</button>
              ))}
            </nav>

            <div className="ox-list">
              <div className="ox-lh"><span className="on">{folder === 'inbox' ? 'Focused' : FOLDERS[folder]?.[0]}</span>{folder === 'inbox' && <span>Other</span>}<em>Filter</em></div>
              {rows.length === 0 && <p className="ox-none">Nothing here.</p>}
              <div role="listbox" aria-label="Messages">
                {rows.map((r, i) => {
                  const who = r.kind === 'in' ? r.from : r.to
                  const un = r.kind === 'in' && !isRead(r)
                  return (
                    <div key={r.id}>
                      {(i === 0 || rows[i - 1].day !== r.day) && <h6>{r.day}</h6>}
                      <button role="option" aria-selected={r.id === sel} className={`ox-msg ${r.id === sel ? 'on' : ''} ${un ? 'un' : ''}`} onClick={() => choose(r)}>
                        <span className="ox-av" style={{ background: who.color ?? '#6b7c89' }}>{(who.initials ?? (who.name || who.email).split(/[ @.]/).filter(Boolean).slice(0, 2).map(w => w[0]).join('')).toUpperCase()}</span>
                        <span className="ox-mt">
                          <span className="ox-r1"><b>{who.name || who.email}</b><time>{r.at}</time></span>
                          <span className="ox-r2"><span>{r.subject}</span>{r.docs.length > 0 && <Ico d={ICONS.clip} size={13} />}</span>
                          <span className="ox-r3">{r.body[0]}</span>
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {compose ? (
              <article className="ox-read ox-cmp" aria-label="New message">
                <div className="ox-cbar">
                  <button className="ox-snd" onClick={send}><Ico d={ICONS.send} size={15} />Send</button>
                  <button className="ox-dis" onClick={() => setCompose(null)}><Ico d={ICONS.trash} size={15} />Discard</button>
                  {!ext && <span className="ox-vt" title="Attachments are encrypted before this message leaves your mailbox"><Ico d={ICONS.lock} size={13} />Virtru · Protected</span>}
                </div>
                <label className="ox-fld"><span>From</span><input value={me.email} readOnly tabIndex={-1} /></label>
                <label className="ox-fld"><span>To</span><input list="ox-addrs" value={compose.to} autoFocus placeholder="Add a name or email address" onChange={e => { setCompose({ ...compose, to: e.target.value }); setErr('') }} /></label>
                <datalist id="ox-addrs">{suggestions.map(a => <option key={a} value={a} />)}</datalist>
                <label className="ox-fld"><span>Subject</span><input value={compose.subject} placeholder="Add a subject" onChange={e => setCompose({ ...compose, subject: e.target.value })} /></label>
                {err && <p className="ox-err" role="alert">{err}</p>}
                <textarea className="ox-txt" value={compose.body} aria-label="Message body" placeholder="Type your message" onChange={e => setCompose({ ...compose, body: e.target.value })} />
                <div className="ox-cat">
                  {compose.docs.map(d => (
                    <span key={d} className="ox-chip"><TdfGlyph w={14} h={17} />{nameOf(d)}<button aria-label={`Remove ${nameOf(d)}`} onClick={() => setCompose({ ...compose, docs: compose.docs.filter(x => x !== d) })}>✕</button></span>
                  ))}
                  {!ext && (
                    <label className="ox-attach"><Ico d={ICONS.clip} size={14} />
                      <select value="" aria-label="Attach a file" onChange={e => e.target.value && setCompose({ ...compose, docs: [...compose.docs, e.target.value] })}>
                        <option value="">Attach a file…</option>
                        {DOCUMENTS.filter(d => !compose.docs.includes(d.id)).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                      </select>
                    </label>
                  )}
                </div>
              </article>
            ) : row ? (
              <article className="ox-read">
                {!ext && row.docs.length > 0 && (
                  <div className="ox-info"><Ico d={ICONS.lock} size={14} />
                    {row.kind === 'in' ? 'Virtru · This message has protected attachments. Open them in Virtru Secure Viewer.' : 'Virtru · The attachments were encrypted before this message left your mailbox.'}
                  </div>
                )}
                <h2>{row.subject}</h2>
                <div className="ox-from">
                  <span className="ox-av lg" style={{ background: row.from.color ?? '#6b7c89' }}>{row.from.initials ?? row.from.name.split(' ').map(w => w[0]).join('').slice(0, 2)}</span>
                  <div className="ox-fm">
                    <b>{row.from.name}</b>
                    <small>{row.from.email}</small>
                    <small>To: {row.to.name ? `${row.to.name} ` : ''}{row.to.name ? `<${row.to.email}>` : row.to.email}</small>
                  </div>
                  <div className="ox-when">{fullDate(row)}</div>
                  <div className="ox-acts"><button onClick={reply} aria-label="Reply"><Ico d={ICONS.reply} size={16} /></button><button onClick={reply} aria-label="Reply all"><Ico d={ICONS.replyAll} size={16} /></button><button onClick={forward} aria-label="Forward"><Ico d={ICONS.fwd} size={16} /></button><Ico d={ICONS.more} size={16} /></div>
                </div>
                <div className="ox-bd">
                  {row.body.map((p, i) => <p key={i}>{p}</p>)}
                  {!row.seed && <p>{(row.kind === 'in' ? row.from : me).name.split(' ')[0]}</p>}
                </div>
                {row.docs.length > 0 && (
                  <>
                    <div className="ox-ah"><Ico d={ICONS.clip} size={14} />{row.docs.length} attachment{row.docs.length > 1 ? 's' : ''}</div>
                    <div className="ox-att">
                      {row.docs.map(d => (
                        <div key={d} className="ox-fw">
                          <button className={`ox-file ${pick === d ? 'on' : ''}`} title={nameOf(d)}
                            onClick={(e) => { e.stopPropagation(); setPick(d); setMenu(null) }}
                            onDoubleClick={() => openAtt(d, row)}
                            onKeyDown={e => e.key === 'Enter' && openAtt(d, row)}>
                            <span className="ox-fi"><TdfGlyph /></span>
                            <span className="ox-fx"><b>{nameOf(d)}</b><small>{byteSize(ctx.sizeOf(d))}</small></span>
                          </button>
                          <button className="ox-fc" aria-label="Attachment actions" aria-haspopup="menu" onClick={(e) => { e.stopPropagation(); setPick(d); setMenu(menu === d ? null : d) }}><Ico d={ICONS.chev} size={12} /></button>
                          {menu === d && (
                            <div className="ox-menu" role="menu">
                              {!ext && <button role="menuitem" onClick={() => openAtt(d, row)}>Open in Secure Viewer</button>}
                              {ext && <button role="menuitem" onClick={() => openAtt(d, row)}>Open</button>}
                              <button role="menuitem" onClick={() => { setMenu(null); ctx.saveFile(owner.id, d, row.src?.from ?? owner.id) }}>{ext ? 'Download' : 'Save to Downloads'}</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </article>
            ) : (
              <article className="ox-read ox-empty"><Ico d={ICONS.mail} size={40} sw={1} /><p>Select an item to read</p></article>
            )}
          </div>
        </div>
      </div>

      {dialogSrc && <ErrorDialog res={dialogSrc.res} name={nameOf(dialogSrc.res.docId)} onClose={() => ctx.set(dialogSrc, { res: null })} />}
    </section>
  )
}
