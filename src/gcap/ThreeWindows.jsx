import { useEffect, useRef, useState } from 'react'
import './scm.css'
import { DOCUMENTS, DOC_BY_ID, auditName } from './data.js'
import { openDocument, openWithoutIdentity } from './vault.js'
import { visibleScmRows } from './scmVault.js'
import { entitlementsOf } from './entitle.js'
import { evaluatePolicy, groupLabel } from '../data/policyMatch.js'
import { AppWindow } from './Scm.jsx'
import Desktop from './Desktop.jsx'
import Presenter, { MAIN } from './Presenter.jsx'
import { emailOf, stampNow, seedChat, CHANNELS } from './desk.js'
import { initialsOf } from './ui.jsx'
import TdfInspector, { fileNameOf } from './TdfInspector.jsx'
import { CRS, FIRST_CR, SEED_LOG, EXTERNAL } from './scmData.js'
import { langOf, makeT } from './scmText.js'

const DEFAULT_IDS = ['gcap-marco', 'gcap-priya', 'gcap-kenji']
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const newWindow = (id, pid) => ({ id, pid, view: 'cr', cr: FIRST_CR, tab: 'summary', q: '', c: '', res: null, menu: false, ent: false, share: false, dying: false, frozen: null, to: 'gmail', seq: 0 })

const CR_TITLE = CRS.find(c => c[0] === FIRST_CR)[1]
let generation = 0

const fresh = () => ({
  n: 3, tr: false, doc: 'icd', att: ['icd'], approved: false, mails: [], insp: null, who: 'gcap-kenji', mailN: 0,
  mode: 'stage', scene: 'payoff', apps: { teams: false, files: false }, pc: 'gcap-marco', dk: {}, views: [], vtab: {}, viewN: 0, files: [], fileN: 0, chat: seedChat(), chN: 0, t0: Date.now(), gen: ++generation,
  log: SEED_LOG.map(([t, w, x, k]) => ({ t, w, x, k })),
  wins: DEFAULT_IDS.map((p, i) => newWindow(`w${i}`, p)),
})

export default function ThreeWindows({ world, vault, scm, active, onEditPerson }) {
  const { people, byId, epoch, revokedIds, live } = world
  const store = useRef(null)
  if (!store.current) store.current = fresh()
  const S = store.current
  const [, tick] = useState(0)
  const render = () => tick(n => n + 1)
  const env = useRef({})
  env.current = { byId, people, revokedIds, vault, epoch }
  const skipEpoch = useRef(null)

  // Which SCM rows each person may see, as the key server answered. Keyed by person and by anything
  // that can change the answer (an edited grant bumps the epoch, a disabled account is in the key),
  // so a stale answer is never read: a new key simply has no entry yet and is asked for.
  const rowCache = useRef(new Map())
  const rowsFor = (pid) => {
    const key = `${pid}@${epoch}@${revokedIds.has(pid) ? 'off' : 'on'}`
    const hit = rowCache.current.get(key)
    if (hit) return hit === 'pending' ? null : hit
    if (!scm) return null
    rowCache.current.set(key, 'pending')
    visibleScmRows(scm, pid).then(set => { rowCache.current.set(key, set); render() }).catch(() => { rowCache.current.delete(key) })
    return null
  }
  const seenEpoch = useRef(epoch)
  const [toast, setToast] = useState(null)
  const toastTimer = useRef(null)
  const say = (msg) => {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2600)
  }
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  const [pdOpen, setPdOpen] = useState(() => localStorage.getItem('gcap-presenter-open') === '1')
  useEffect(() => { localStorage.setItem('gcap-presenter-open', pdOpen ? '1' : '0') }, [pdOpen])
  useEffect(() => {
    if (!active) return undefined
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '.') { e.preventDefault(); setPdOpen(o => !o) }
      else if (e.key === 'Escape') setPdOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active])

  const who = (id) => (id === 'gmail' ? EXTERNAL : env.current.byId[id] ?? env.current.people[0])
  const unitsOf = (docId) => [...env.current.vault.values()].filter(e => e.unit.doc.id === docId)
  const sizeOf = (docId) => unitsOf(docId).reduce((n, e) => n + e.tdfBytes.length, 0)
  const allWins = () => [...S.wins.slice(0, S.n), ...S.mails, ...S.views.filter(v => !v.closed), ...S.files]
  const findWin = (id) => [...S.wins, ...S.mails].find(w => w.id === id)
  const log = (w, x, k, ...a) => S.log.unshift({ t: 'just now', w, x, k, a })
  const statusOf = (id) => (id === FIRST_CR && S.approved ? 'Approved' : CRS.find(c => c[0] === id)[2])

  /** Ask the key server whether this window's person may open a document, and keep its answer. */
  const ask = async (w, docId, { quiet = false, revoked } = {}) => {
    const mine = ++w.seq
    const prev = w.res?.status === 'done' && w.res.docId === docId ? w.res.result : null
    if (!quiet) { w.res = { status: 'pending', docId }; render() }
    const doc = DOC_BY_ID[docId]
    const entries = unitsOf(docId)
    const p = who(w.pid)
    let result
    try {
      if (w.pid === 'gmail') {
        const r = await openWithoutIdentity(entries[0])
        result = { granted: r.granted, doc, entry: r.granted ? entries[0] : null, tier: r.granted ? entries[0].unit.tier : null, text: r.text, reason: r.reason, tried: [] }
      } else {
        result = await openDocument(env.current.vault, doc, p.id, 'windows')
      }
    } catch (err) {
      result = { granted: false, doc, entry: null, tier: null, text: null, reason: String(err?.message ?? err), tried: [] }
    }
    if (w.seq !== mine) return
    let need = []
    let why = ''
    if (!result.granted) {
      const off = revoked ?? env.current.revokedIds.has(p.id)
      if (w.pid === 'gmail') { need = ['an authenticated programme account']; why = 'There is no identity to ask the key server about.' }
      else if (off) { need = ['an active account']; why = prev ? 'Access removed. The key server was asked again and said no.' : 'This account is disabled. The key server will not release a key.' }
      else {
        const lowest = entries[entries.length - 1]
        need = evaluatePolicy(entitlementsOf(p.grants), lowest.unit.policy).missing.map(groupLabel)
        why = need.length ? 'Your attributes do not satisfy the policy written inside this file.' : (result.reason || 'The key server refused.')
      }
    }
    w.res = { status: 'done', docId, result, need, why }
    const name = auditName(p)
    if (!quiet) {
      if (result.granted) {
        if (doc.tiers && result.tier) log(name, 'opened {0} · {1}', 'permit', doc.title, result.tier.label.toLowerCase())
        else log(name, 'opened {0}', 'permit', doc.title)
      } else if (w.pid === 'gmail') log(name, 'tried to open {0} · sent by {1}', 'deny', doc.title, auditName(who(w.from)))
      else log(name, 'was refused {0}', 'deny', doc.title)
    } else if (prev && prev.granted !== result.granted) {
      log(name, result.granted ? 'regained access to {0}' : 'lost access to {0}', result.granted ? 'permit' : 'deny', doc.title)
    }
    render()
  }

  const reaskAll = (filter, opts) => Promise.all(allWins().filter(w => w.res?.status === 'done' && filter(w)).map(w => ask(w, w.res.docId, { quiet: true, ...opts })))

  // An edit made anywhere (another tab, the person editor) re-asks every window that is already open.
  useEffect(() => {
    if (!active || epoch === seenEpoch.current) return
    seenEpoch.current = epoch
    if (skipEpoch.current === epoch) { skipEpoch.current = null; return }
    reaskAll(() => true)
  }, [epoch, active]) // eslint-disable-line react-hooks/exhaustive-deps

  const disable = async (pid) => {
    if (env.current.revokedIds.has(pid)) return
    log('GIGO identity admin', "disabled {0}'s account", 'sys', auditName(who(pid)))
    const hit = allWins().filter(w => w.pid === pid && w.res?.status === 'done' && w.res.result.granted)
    hit.forEach(w => { w.dying = true; w.frozen = w.res })
    render()
    skipEpoch.current = env.current.epoch + 1
    try {
      await Promise.all([world.revokeAccount(pid), sleep(hit.length ? 1300 : 0)])
      await reaskAll(w => w.pid === pid, { revoked: true })
    } catch (err) {
      skipEpoch.current = null
      say(`Could not disable the account: ${err?.message ?? err}`)
    } finally {
      hit.forEach(w => { w.dying = false; w.frozen = null })
      render()
    }
  }

  const restoreOne = async (pid) => {
    if (!env.current.revokedIds.has(pid)) return
    log('GIGO identity admin', "restored {0}'s account", 'sys', auditName(who(pid)))
    skipEpoch.current = env.current.epoch + 1
    try {
      await world.restoreAccount(pid)
      await reaskAll(w => w.pid === pid, { revoked: false })
    } catch (err) {
      skipEpoch.current = null
      say(`Could not restore the account: ${err?.message ?? err}`)
    }
    render()
  }

  const startOver = async () => {
    const off = [...env.current.revokedIds]
    const tr = S.tr
    Object.assign(S, fresh(), { tr, scene: S.scene })
    render()
    for (const id of off) await world.restoreAccount(id)
  }

  const resetScene = async (scene = S.scene) => {
    const off = [...env.current.revokedIds]
    const tr = S.tr
    Object.assign(S, fresh(), { tr, scene, mode: 'desk', pc: scene === 'payoff' ? 'gcap-priya' : 'gcap-marco' })
    stage()
    say(scene === 'payoff' ? 'Scene reset: the mail is already delivered' : 'Scene reset: nothing sent yet')
    render()
    for (const id of off) await world.restoreAccount(id)
  }

  /** The payoff scene: Marco has already shared the change request with Priya and with Ryan, so the demo can open on the reading. */
  function stage() {
    if (S.scene !== 'payoff' || S.mails.length) return
    const subject = `Shared: ${FIRST_CR} · ${CR_TITLE}`
    const body = ['The current baseline is attached.', 'Please review and comment in Meridian.']
    for (const to of [who('gcap-priya'), EXTERNAL]) ctx.sendMail({ from: 'gcap-marco', toAddr: emailOf(to), subject, body, docs: S.att, via: 'scm', quiet: true })
    S.pc = 'gcap-priya'
  }

  const enterDesk = () => { stage(); S.mode = 'desk'; render() }

  const setApp = (name, on) => {
    S.apps[name] = on
    if (!on) Object.values(S.dk).forEach(d => { d.open = d.open.filter(a => a !== name); if (d.front === name) d.front = d.open.at(-1) ?? null })
    render()
  }

  const set = (w, patch) => { Object.assign(w, patch); render() }
  const attachDoc = (docId, by) => {
    if (!S.att.includes(docId)) { S.att.push(docId); log(by, 'attached {0}', 'sys', DOC_BY_ID[docId].title) }
    S.doc = docId
  }

  const ctx = {
    S, rowsFor, people: people.filter(x => x.id !== 'gcap-ryan'), revoked: revokedIds, entsOf: (p, shown) => (revokedIds.has(p.id) && !shown ? [] : entitlementsOf(p.grants)), tFor: (p) => makeT(S.tr ? langOf(p) : 'en'), live, firstCr: FIRST_CR, who, unitsOf, sizeOf, statusOf, set,
    editPerson: onEditPerson,
    nav: (w, view, cr) => set(w, { view, cr: cr ?? w.cr, tab: 'summary', q: '', menu: false, share: false }),
    user: (w, pid) => set(w, { pid, res: null, menu: false, ent: false, share: false, to: 'gmail' }),
    open: (w, docId) => ask(w, docId),
    props: (w, docId) => {
      const units = unitsOf(docId)
      const got = w.res?.status === 'done' && w.res.docId === docId && w.res.result.granted ? units.findIndex(e => e.unit.key === w.res.result.entry.unit.key) : 0
      S.insp = { wid: w.id, docId, idx: Math.max(0, got) }
      render()
    },
    download: (docId) => {
      const entry = unitsOf(docId)[0]
      const url = URL.createObjectURL(new Blob([entry.tdfBytes], { type: 'application/octet-stream' }))
      const a = document.createElement('a')
      a.href = url
      a.download = fileNameOf(entry)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      say(`Saved ${fileNameOf(entry)}, still encrypted.`)
    },
    crTitle: CR_TITLE,
    say,
    dkOf: (pid) => (S.dk[pid] ??= { open: ['outlook'], front: 'outlook', want: null }),
    goDesk: (pid, app, opts = {}) => {
      const d = ctx.dkOf(pid)
      if (app in S.apps) S.apps[app] = true
      if (!d.open.includes(app)) d.open.push(app)
      d.front = app
      if (opts.mail) d.want = opts.mail
      S.mode = 'desk'
      S.pc = pid
      render()
    },
    closeMail: (m) => set(m, { closed: true, res: null }),
    viewDoc: (pid, docId, from) => {
      let v = S.views.find(x => x.pid === pid && x.docId === docId && !x.closed)
      if (!v) { v = { id: `v${++S.viewN}`, pid, docId, from, res: null, seq: 0, dying: false, frozen: null }; S.views.push(v) }
      S.vtab[pid] = v.id
      ctx.goDesk(pid, 'edge')
      ask(v, docId)
    },
    setVtab: (pid, id) => { S.vtab[pid] = id; render() },
    closeView: (v) => { v.closed = true; v.res = null; if (S.vtab[v.pid] === v.id) S.vtab[v.pid] = null; render() },
    saveFile: (pid, docId, from) => {
      if (!S.files.some(f => f.pid === pid && f.docId === docId && f.from === from)) {
        S.files.push({ id: `f${++S.fileN}`, pid, docId, from, tdf: true, res: null, seq: 0, at: stampNow(S), name: fileNameOf(unitsOf(docId)[0]) })
      }
      S.apps.files = true
      say('Saved to Downloads')
      render()
    },
    openFile: (f) => ask(f, f.docId),
    sendMail: ({ from, toAddr, subject, body, docs, via, quiet }) => {
      const addr = toAddr.trim().toLowerCase()
      const hit = people.find(x => x.id !== 'gcap-ryan' && emailOf(x).toLowerCase() === addr)
      const pid = hit ? hit.id : 'gmail'
      const to = who(pid)
      const m = { id: `m${++S.mailN}`, pid, from, docs: [...docs], res: null, seq: 0, subject, body, at: stampNow(S), day: 'Today', read: false, via, toAddr: hit ? undefined : toAddr.trim() }
      S.mails.push(m)
      const name = auditName(who(from))
      if (docs.length) log(name, 'shared this change request with {0}', 'sys', to.name)
      else log(name, 'emailed {0}', 'sys', to.name)
      if (!quiet) say(`Sent to ${hit ? to.name : toAddr.trim()}`)
      render()
      return m
    },
    postChat: (pid, ch, text, docs) => {
      const m = { id: `p${++S.chN}`, ch, from: pid, day: 'Today', at: stampNow(S), text, docs: [...docs], likes: 0 }
      S.chat.push(m)
      S.apps.teams = true
      if (docs.length) log(auditName(who(pid)), 'posted a protected file in the {0} channel', 'sys', CHANNELS.find(c => c.id === ch).name)
      render()
      return m
    },
    backToScm: () => backToScm(),
    inspectDoc: (pid) => { S.insp = { wid: null, pid, docId: S.doc, idx: 0 }; render() },
    detach: (w, docId) => {
      S.att = S.att.filter(d => d !== docId)
      if (S.doc === docId && S.att.length) S.doc = S.att[0]
      log(auditName(who(w.pid)), 'removed {0}', 'sys', DOC_BY_ID[docId].title)
      if (S.insp?.docId === docId) S.insp = null
      say('Removed from the change request. Copies already sent are not affected.')
      render()
    },
    attach: (w, docId) => { attachDoc(docId, auditName(who(w.pid))); render() },
    post: (w) => {
      if (!w.c.trim()) return
      log(auditName(who(w.pid)), w.c.trim(), 'c')
      set(w, { c: '' })
    },
    approve: (w) => { S.approved = true; log(auditName(who(w.pid)), 'approved the change as design authority', 'sys'); render() },
    send: (w) => {
      if (w.to === 'teams') {
        ctx.postChat(w.pid, 'integration', `${FIRST_CR}: the current baseline is attached. Comments by Thursday please.`, S.att)
        say('Posted to Teams · Integration')
      } else {
        const to = who(w.to)
        ctx.sendMail({ from: w.pid, toAddr: emailOf(to), subject: `Shared: ${FIRST_CR} · ${CR_TITLE}`, body: ['The current baseline is attached.', 'Please review and comment in Meridian.'], docs: S.att, via: 'scm' })
      }
      set(w, { share: false })
    },
  }

  function backToScm() {
    const last = [...S.mails].reverse().find(m => m.pid === 'gmail' && m.from !== 'gmail')
    const sender = S.wins.slice(0, S.n).find(w => last && w.pid === last.from)
    if (sender) Object.assign(sender, { view: 'cr', cr: FIRST_CR, tab: 'history', menu: false, res: null })
    S.mode = 'stage'
    render()
  }
  const notes = S.mails.filter(m => m.via === 'scm' && !m.closed)
  const desk = S.mode === 'desk'
  const deskPeople = [...ctx.people, EXTERNAL]
  const castIds = MAIN.includes(S.pc) ? MAIN : [...MAIN, S.pc]
  const seats = castIds.map(id => deskPeople.find(x => x.id === id)).filter(Boolean)
  const others = deskPeople.filter(x => !castIds.includes(x.id))
  const visible = S.wins.slice(0, S.n)
  const openCopies = allWins().filter(w => w.res?.status === 'done' && w.res.result.granted).length
  const refused = S.log.filter(e => e.k === 'deny').length
  const edited = [...vault.values()].filter(e => e.original).length
  const accounts = [...new Map(visible.map(w => [w.pid, who(w.pid)])).values()]
  const whoNow = accounts.some(a => a.id === S.who) ? S.who : accounts[0]?.id
  const steps = [
    ['Delivered', 'Same encrypted file in every inbox', true],
    ['Opened', 'Switch persona or document', S.log.some(e => e.k === 'permit')],
    ['Shared on', 'Share from any window', S.mails.length > 0],
    ['Pulled', 'Disable an account', revokedIds.size > 0],
  ]

  const insp = S.insp
  const inspWin = insp && findWin(insp.wid)
  const inspEntries = insp ? unitsOf(insp.docId) : []

  return (
    <div className="scm">
      <div className="beats">
        {steps.map(s => <div key={s[0]} className={`beat ${s[2] ? 'done' : ''}`}><b>{s[0]}</b><span>{s[1]}</span></div>)}
        <span className="seg modes" role="group" aria-label="Scene">
          <button className={`btn ${!desk ? 'on' : ''}`} aria-pressed={!desk} onClick={() => { S.mode = 'stage'; render() }}>Meridian SCM</button>
          <button className={`btn ${desk ? 'on' : ''}`} aria-pressed={desk} onClick={enterDesk}>Desktop</button>
        </span>
        <button className={`btn lang ${S.tr ? 'on' : ''}`} aria-pressed={S.tr} onClick={() => { S.tr = !S.tr; render() }}>{S.tr ? 'Translated: Italian, Japanese' : 'Translate for Italy and Japan'}</button>
      </div>

      {desk ? <>
        <div className="pcs" role="tablist" aria-label="Whose desktop">
          <span className="k">Sitting at</span>
          {seats.map(x => (
            <button key={x.id} role="tab" aria-selected={S.pc === x.id} className={`${S.pc === x.id ? 'on' : ''} ${revokedIds.has(x.id) ? 'off' : ''}`} onClick={() => { S.pc = x.id; render() }}>
              <i style={{ background: x.color }}>{x.id === 'gmail' ? 'RM' : initialsOf(x)}</i>{x.id === 'gmail' ? 'Ryan (outside)' : x.name.split(' ')[0]}
            </button>
          ))}
          <span className="sp" />
          <button className={`btn pdbtn ${pdOpen ? 'on' : ''}`} aria-pressed={pdOpen} aria-keyshortcuts="Control+. Meta+." title="Presenter controls (Cmd/Ctrl + .)" onClick={() => setPdOpen(o => !o)}>Presenter</button>
        </div>
        <div className="dkwrap">
          <Desktop key={`${S.gen}-${S.pc}`} ctx={ctx} pid={S.pc} onBack={backToScm} />
          {pdOpen && (
            <Presenter
              ctx={ctx} pc={S.pc} scene={S.scene} revoked={revokedIds} others={others}
              tally={{ open: openCopies, refused, off: revokedIds.size }}
              onClose={() => setPdOpen(false)}
              onScene={(sc) => resetScene(sc)} onReset={() => resetScene()}
              onDisable={disable} onRestore={restoreOne}
              onSeat={(id) => { S.pc = id; render() }} onApp={setApp} onInspect={() => ctx.inspectDoc(S.pc)}
            />
          )}
        </div>
      </> : <>
      <div className="stage" style={{ gridTemplateColumns: `repeat(${S.n}, minmax(0, 1fr))` }}>
        {visible.map(w => <AppWindow key={w.id} ctx={ctx} w={w} />)}
      </div>
      {notes.length > 0 && (
        <div className="notes">
          {notes.map(m => {
            const to = who(m.pid)
            return (
              <div key={m.id} className="note">
                <span><b>Email delivered to {to.name}</b><small>{emailOf(to)} · from {who(m.from).name}</small></span>
                <button className="ab pr" onClick={() => ctx.goDesk(m.pid, 'outlook', { mail: m.id })}>{m.pid === 'gmail' ? 'Open Ryan\u2019s inbox' : `Open ${to.name.split(' ')[0]}\u2019s Outlook`}</button>
                <button className="mx" onClick={() => ctx.closeMail(m)} aria-label="Dismiss">✕</button>
              </div>
            )
          })}
        </div>
      )}

      <div className="dir">
        <div className="g"><span className="k">Windows</span>
          <span className="seg">{[1, 2, 3].map(n => <button key={n} className={`btn ${S.n === n ? 'on' : ''}`} onClick={() => { S.n = n; render() }}>{n}</button>)}</span>
        </div>
        <div className="g"><span className="k">Document in play</span>
          <select className="sel" value={S.doc} onChange={e => { attachDoc(e.target.value, 'GIGO Document Control'); render() }} aria-label="Document in play">
            {DOCUMENTS.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
          <button className="btn p" onClick={() => visible.forEach(w => { Object.assign(w, { view: 'cr', cr: FIRST_CR, tab: 'summary', menu: false }); ask(w, S.doc) })}>Open it in every window</button>
        </div>
        <div className="g"><span className="k">Account</span>
          <select className="sel" value={whoNow} onChange={e => { S.who = e.target.value; render() }} aria-label="Account">
            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}{revokedIds.has(a.id) ? ' (disabled)' : ''}</option>)}
          </select>
          {revokedIds.has(whoNow)
            ? <button className="btn" onClick={() => restoreOne(whoNow)}>Restore account</button>
            : <button className="btn d" onClick={() => disable(whoNow)}>Disable account</button>}
        </div>
        <div className="g" style={{ marginLeft: 'auto' }}><button className="btn" onClick={startOver}>Start over</button></div>
      </div>
      </>}

      {!desk && <div className="tally">
        <div><b>{openCopies}</b>copies open</div>
        <div><b>{refused}</b>refused</div>
        <div><b>{revokedIds.size}</b>accounts disabled</div>
        <div><b>0</b>files recalled</div>
        <div><b>{edited}</b>files touched</div>
      </div>}

      {insp && inspEntries.length > 0 && (
        <TdfInspector
          entries={inspEntries} index={insp.idx} cr={FIRST_CR} holder={inspWin ? who(inspWin.pid).name : insp.pid ? who(insp.pid).name : '—'}
          nameOf={(id) => who(id).name}
          onIndex={(i) => { insp.idx = i; render() }}
          onClose={() => { S.insp = null; render() }}
          onToast={say}
        />
      )}
      {toast && <div className="toast on" role="status">{toast}</div>}
    </div>
  )
}
