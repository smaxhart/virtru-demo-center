import { DOCUMENTS, DOC_BY_ID, CUSTODIANS } from './data.js'
import { markingOf } from './marking.js'
import { hexRows, byteSize } from './cipher.js'
import { initialsOf } from './ui.jsx'
import { CRS, PARTS, SUPS, ORDS, NAV, OWNER_BY_PACKAGE, ROLE_ON_CR, TASKS, EXTERNAL } from './scmData.js'
import { evaluatePolicy, groupLabel, parseFqn } from '../data/policyMatch.js'

const first = (p) => p.name.split(' ')[0]
const Av = ({ p }) => <span className="av" style={{ background: p.color }}>{initialsOf(p)}</span>

const STATUS_TAG = { Approved: 'a', Implemented: 'a', 'In review': 'w', 'On hold': 'g', Draft: 'g' }

function Table({ cols, rows, q, t, ids }) {
  const shown = rows.filter(r => !q || r.text.toLowerCase().includes(q.toLowerCase()))
  return (
    <table className={ids ? 'dt ids' : 'dt'}>
      <thead><tr>{cols.map(c => <th key={c}>{t(c)}</th>)}</tr></thead>
      <tbody>
        {shown.map(r => (
          <tr key={r.key} className={r.onClick ? 'row' : undefined} onClick={r.onClick}>
            {r.cells.map((c, i) => <td key={i} data-l={t(cols[i])} className={typeof c === 'string' && c.length <= 9 ? 'nw' : undefined}>{c}</td>)}
          </tr>
        ))}
        {!shown.length && <tr><td colSpan={cols.length} style={{ color: '#7a8b98' }}>{t('Nothing matches.')}</td></tr>}
      </tbody>
    </table>
  )
}

function AttRow({ ctx, w, docId, removable }) {
  const doc = DOC_BY_ID[docId]
  const n = ctx.unitsOf(docId).length
  const t = ctx.tFor(ctx.who(w.pid))
  return (
    <div className="arow">
      <i>TDF</i>
      <div><b>{doc.title}</b><small>{n} {t(n > 1 ? 'encrypted files' : 'encrypted file')} · {byteSize(ctx.sizeOf(docId))}</small></div>
      <button className="ab pr" onClick={() => ctx.open(w, docId)}>{t('Open')}</button>
      <button className="ab ic" onClick={() => ctx.props(w, docId)} title={t('File properties')} aria-label={t('File properties')}>ⓘ</button>
      <button className="ab ic" onClick={() => ctx.download(docId)} title={t('Download the encrypted file')} aria-label={t('Download the encrypted file')}>⤓</button>
      {removable && <button className="ab ic" onClick={() => ctx.detach(w, docId)} title={t('Remove from this change request')} aria-label={t('Remove from this change request')}>✕</button>}
    </div>
  )
}

function Events({ items, t }) {
  return items.map((e, i) => (
    <div className="ev" key={i}>
      <time>{t(e.t)}</time>
      <span>
        <b>{t(e.w)}</b> {e.k === 'c' ? e.x : t(e.x, ...(e.a ?? []))}
        {e.k === 'permit' && <span className="k">{t('permit')}</span>}
        {e.k === 'deny' && <span className="k deny">{t('deny')}</span>}
      </span>
    </div>
  ))
}

function Home({ ctx, w, p }) {
  const { S } = ctx
  const t = ctx.tFor(p)
  const link = (cr, text) => <a href="#" onClick={e => { e.preventDefault(); ctx.nav(w, 'cr', cr) }}>{text}</a>
  const crTitle = (id) => t(CRS.find(c => c[0] === id)[1])
  const seen = ctx.rowsFor(p.id)
  const tasks = (TASKS[p.id] ?? []).filter(([, , cr]) => !cr || seen?.has(`crs:${cr}`))
  return (
    <>
      <div className="crumb">{t(p.employer)} · {t(p.title)}</div>
      <h3>{t('Good morning, {0}', first(p))}</h3>
      <div className="card"><h4>{t('My tasks')}</h4>
        {tasks.map(([due, text, cr]) => (
          <div className="ev" key={text + due}><time>{t('Due {0}', t.date(due))}</time>
            <span>{cr ? <>{link(cr, t(text, cr))} · {crTitle(cr)}</> : t(text)}</span></div>
        ))}
        {!tasks.length && <div style={{ color: '#7a8b98', fontSize: 12 }}>{t('Nothing assigned to you.')}</div>}
      </div>
      <div className="card"><h4>{t('Recent activity')}</h4><Events items={S.log.slice(0, 4)} t={t} /></div>
    </>
  )
}

function ChangeRequest({ ctx, w, p }) {
  const { S } = ctx
  const t = ctx.tFor(p)
  const c = CRS.find(x => x[0] === w.cr)
  const st = ctx.statusOf(c[0])
  const live = c[0] === ctx.firstCr
  const tabs = [['summary', t('Summary')], ['attachments', `${t('Attachments')}${live ? ` (${S.att.length})` : ''}`], ['approvals', t('Approvals')], ['history', t('History')]]
  const none = <div style={{ color: '#7a8b98' }}>{t('No attachments.')}</div>
  let body
  if (w.tab === 'summary') {
    const comments = S.log.filter(e => e.k === 'c').slice(0, 3)
    body = (
      <>
        <div className="fields">
          <div><small>{t('Work package')}</small><b>{t(c[3])}</b></div><div><small>{t('Your role')}</small><b>{t(ROLE_ON_CR[p.id] ?? p.title)}</b></div>
          <div><small>{t('Need-by')}</small><b>{t.date(`${c[4]} 2026`)}</b></div><div><small>{t('Owner')}</small><b>{OWNER_BY_PACKAGE[c[3]]}</b></div>
        </div>
        <div className="ah"><span>{t('Attachments')}</span><small>{live ? S.att.length : 0}</small></div>
        {live ? S.att.map(d => <AttRow key={d} ctx={ctx} w={w} docId={d} removable />) : none}
        <div className="ah" style={{ marginTop: 12 }}><span>{t('Comments')}</span></div>
        {comments.length ? <Events items={comments} t={t} /> : <div style={{ color: '#7a8b98', fontSize: 12 }}>{t('No comments yet.')}</div>}
        <div className="cbox">
          <input value={w.c} placeholder={t('Add a comment')} onChange={e => ctx.set(w, { c: e.target.value })} onKeyDown={e => e.key === 'Enter' && ctx.post(w)} />
          <button className="ab" onClick={() => ctx.post(w)}>{t('Post')}</button>
        </div>
      </>
    )
  } else if (w.tab === 'attachments') {
    body = live ? (
      <>
        {S.att.map(d => <AttRow key={d} ctx={ctx} w={w} docId={d} removable />)}
        <div className="inl"><span>{t('Attach from the programme library')}</span>
          <select value="" onChange={e => e.target.value && ctx.attach(w, e.target.value)}>
            <option value="">{t('Choose a document…')}</option>
            {DOCUMENTS.filter(d => !S.att.includes(d.id)).map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
          </select>
        </div>
      </>
    ) : none
  } else if (w.tab === 'approvals') {
    const tag = (ok) => <span className={`tag ${ok ? 'a' : 'w'}`}>{t(ok ? 'Approved' : 'Pending')}</span>
    body = (
      <>
        <Table t={t} cols={['Approver', 'Role', 'Decision']} rows={[
          { key: 'a', text: '', cells: ['Marco Bellandi', t('Design authority'), tag(st === 'Approved')] },
          { key: 'p', text: '', cells: ['Priya Nair', t('Sensors interface review'), tag(true)] },
          { key: 'k', text: '', cells: ['Kenji Watanabe', t('Propulsion interface review'), tag(false)] },
          { key: 'b', text: '', cells: [t('GIGO Airworthiness'), t('Programme authority'), tag(false)] },
        ]} />
        {p.id === 'gcap-marco' && live && !S.approved
          ? <div className="acts2" style={{ marginTop: 10 }}><button className="ab pr" onClick={() => ctx.approve(w)}>{t('Approve as design authority')}</button></div>
          : <div style={{ color: '#7a8b98', fontSize: 12, marginTop: 8 }}>{live && !S.approved ? t('Only an approver can act on this change.') : ''}</div>}
      </>
    )
  } else {
    body = <Events t={t} items={live ? S.log : [{ t: '5 days ago', w: 'Programme office', x: 'created the change request', k: 'sys' }]} />
  }
  return (
    <>
      <div className="crumb"><a href="#" onClick={e => { e.preventDefault(); ctx.nav(w, 'crs') }}>{t('Change requests')}</a> / {c[0]}</div>
      <h3>{t(c[1])}</h3>
      <div className="pills"><span className={st === 'Approved' || st === 'Implemented' ? 'ok' : 'st'}>{t(st)}</span><span>{t(c[3])}</span><span>{p.nation}</span></div>
      {live && <div className="acts2"><button className="ab" onClick={() => ctx.set(w, { share: !w.share })}>{t('Share')}</button></div>}
      {w.share && live && (
        <div className="inl"><span>{t('Share with')}</span>
          <select value={w.to} onChange={e => ctx.set(w, { to: e.target.value })}>
            {ctx.people.filter(x => x.id !== w.pid).map(x => <option key={x.id} value={x.id}>{x.name} · {t(x.employer)}</option>)}
            <option value="teams">{t('Teams channel')} · GCAP Programme / Integration</option>
            <option value="gmail">{EXTERNAL.name} ({t('external email')})</option>
          </select>
          <button className="ab pr" onClick={() => ctx.send(w)}>{t('Send')}</button>
        </div>
      )}
      <div className="ctabs">
        {tabs.map(x => <button key={x[0]} className={w.tab === x[0] ? 'on' : undefined} onClick={() => ctx.set(w, { tab: x[0] })}>{x[1]}</button>)}
      </div>
      {body}
    </>
  )
}

function Page({ ctx, w, p }) {
  const t = ctx.tFor(p)
  // What the key server released to this person. Null while it is being asked; a row not in the set is
  // simply not drawn, and nothing says how many were left out.
  const seen = ctx.rowsFor(p.id)
  const waiting = <div style={{ color: '#7a8b98', fontSize: 12 }}>{t('Asking the key server…')}</div>
  const plain = (table, rows, map) => rows
    .filter(r => seen?.has(`${table}:${r[0]}`))
    .map(r => ({ key: r[0], text: r.join(' '), cells: map ? map(r) : r }))
  if (!seen) {
    if (w.view === 'home') return <Home ctx={ctx} w={w} p={p} />
    const title = { crs: 'Change requests', cr: 'Change requests', parts: 'Parts', sups: 'Suppliers', ords: 'Orders' }[w.view]
    return <><h3>{t(title)}</h3>{waiting}</>
  }
  const view = w.view === 'cr' && !seen.has(`crs:${w.cr}`) ? 'crs' : w.view
  if (view === 'home') return <Home ctx={ctx} w={w} p={p} />
  if (view === 'cr') return <ChangeRequest ctx={ctx} w={w} p={p} />
  if (view === 'crs') {
    const rows = CRS.filter(c => seen.has(`crs:${c[0]}`)).map(c => ({
      key: c[0], text: c.join(' '), onClick: () => ctx.nav(w, 'cr', c[0]),
      cells: [c[0], t(c[1]), <span key="s" className={`tag ${STATUS_TAG[ctx.statusOf(c[0])] ?? ''}`}>{t(ctx.statusOf(c[0]))}</span>, t(c[3]), t.date(c[4])],
    }))
    return <><h3>{t('Change requests')}</h3><Table ids t={t} cols={['ID', 'Title', 'Status', 'Package', 'Due']} rows={rows} q={w.q} /></>
  }
  if (view === 'parts') return <><h3>{t('Parts')}</h3><Table ids t={t} cols={['Part', 'Description', 'Rev', 'Supplier', 'Lead', 'Stock']} rows={plain('parts', PARTS, r => [r[0], t(r[1]), r[2], r[3], t.days(r[4]), r[5]])} q={w.q} /></>
  if (view === 'sups') return <><h3>{t('Suppliers')}</h3><Table t={t} cols={['Supplier', 'Tier', 'Country', 'On-time', 'Open POs']} rows={plain('sups', SUPS, r => [r[0], t(r[1]), t(r[2]), r[3], r[4]])} q={w.q} /></>
  return <><h3>{t('Orders')}</h3><Table ids t={t} cols={['PO', 'Part', 'Description', 'Qty', 'Due', 'Status']} rows={plain('ords', ORDS, r => [r[0], r[1], t(r[2]), r[3], t.date(r[4]), t(r[5])])} q={w.q} /></>
}

/** `[['clearance', ['secret']], ['nationality', ['ita']]]`: a clearance shows its top level only, since it carries everything below. */
function heldGroups(ents) {
  const m = new Map()
  for (const f of ents) {
    const p = parseFqn(f)
    if (!p) continue
    if (!m.has(p.name)) m.set(p.name, [])
    m.get(p.name).push(p.value)
  }
  return [...m].map(([name, vals]) => [name, name === 'clearance' ? vals.slice(0, 1) : vals])
}

function Entitlements({ ctx, w, p, t }) {
  const off = ctx.revoked.has(p.id)
  const groups = heldGroups(ctx.entsOf(p, true))
  return (
    <span className={`entw ${w.ent ? 'open' : ''}`}>
      <button className="ent" onClick={() => ctx.set(w, { ent: !w.ent, menu: false })} aria-label={t('Entitlements')} aria-expanded={!!w.ent}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="M8 1.5 13.5 3.5v4.2c0 3-2.2 5.3-5.5 6.8C4.700 13 2.500 10.700 2.500 7.700V3.500L8 1.500Z" /><path d="m5.500 8 1.800 1.800L10.600 6.300" strokeLinecap="round" /></svg>
      </button>
      <div className="entcard" role="dialog" aria-label={t('Entitlements')}>
        {off && <div className="entoff">{t('Account disabled')}</div>}
        {groups.length === 0 && !off && <div className="entnone">{t('No programme attributes')}</div>}
        {groups.map(([name, vals]) => (
          <div className={`er ${off ? 'off' : ''}`} key={name}>
            <small>{name}</small>
            <span>{vals.map(v => <i key={v}>{v}</i>)}</span>
          </div>
        ))}
      </div>
    </span>
  )
}

/** The attributes that carried a decision: one line per attribute the file's policy names. */
function Why({ ctx, p, policy, t, refused }) {
  const groups = evaluatePolicy(ctx.entsOf(p), policy).groups
  if (!groups.length) return null
  return (
    <div className={`why ${refused ? 'no' : ''}`}>
      <b>{t(refused ? 'Checked against your attributes' : 'Opened on')}</b>
      {groups.map(g => (
        <span key={g.definition} className={g.satisfied ? 'ok' : 'bad'} title={groupLabel(g)}>
          {g.satisfied ? '✓' : '✗'} {g.satisfied ? `${g.name}:${g.matched.split('/value/')[1]}` : groupLabel(g)}
          {!g.satisfied && <em> · {g.held.length ? `${t('holds')} ${g.held.join(', ')}` : t('holds nothing')}</em>}
        </span>
      ))}
    </div>
  )
}

/** The in-app viewer: paper when the key server released a key, a locked card when it did not. */
function Viewer({ ctx, w }) {
  const r = w.dying ? w.frozen : w.res
  if (!r) return null
  const p = ctx.who(w.pid)
  const t = ctx.tFor(p)
  const doc = DOC_BY_ID[r.docId]
  let inner
  if (r.status === 'pending') {
    inner = <div className="lock"><div className="big" style={{ color: 'var(--sky)' }}>{t('ASKING THE KEY SERVER…')}</div></div>
  } else if (r.result.granted) {
    const { entry, tier, text } = r.result
    const marking = markingOf(entry.unit.policy)
    const [title, ...rest] = text.split('\n\n')
    const partial = !!doc.tiers && tier && tier.id !== doc.tiers[0].id
    const paper = (
      <div className="paper decrypt" key={`${entry.unit.key}-${r.result.tried?.[0]?.at ?? 0}`}>
        <div className="ban" style={{ background: marking.tone }}>{marking.banner}</div>
        <Why ctx={ctx} p={p} policy={entry.unit.policy} t={t} />
        <div className="pbody">
          <h4>{title}</h4>
          {rest.map((para, i) => <p key={i}>{para}</p>)}
          {partial && <div className="slot">{t('Withheld from this release')}<br />{t('Not part of this release. Not in this file.')}</div>}
        </div>
        <div className="foot"><span>{tier && doc.tiers ? tier.label : doc.title}</span><span>{t('key released by')} {CUSTODIANS[doc.custodian].label}</span></div>
      </div>
    )
    inner = w.dying ? <div className="dying">{paper}</div> : paper
  } else {
    const entry = ctx.unitsOf(r.docId)[0]
    inner = (
      <div className="lock">
        <div className="big">{t('REFUSED')}</div>
        <p>{t(r.why)}</p>
        {entry && <Why ctx={ctx} p={p} policy={ctx.unitsOf(r.docId).at(-1).unit.policy} t={t} refused />}
        {entry && <div className="bytes">{hexRows(entry.tdfBytes, 2, 16).join('\n')}{'\n…'}</div>}
        <p style={{ fontSize: 11.5, color: 'var(--t6)' }}>{t('The file is here, byte for byte. Still ciphertext.')}</p>
      </div>
    )
  }
  return (
    <div className="viewer">
      <div className="vh"><span>{doc.title}</span><button onClick={() => ctx.set(w, { res: null })} aria-label={t('Close')}>✕</button></div>
      {inner}
    </div>
  )
}

export function AppWindow({ ctx, w }) {
  const p = ctx.who(w.pid)
  const t = ctx.tFor(p)
  return (
    <section className="app" lang={t.lang}>
      <div className="tb">
        <span className="logo">Meridian SCM</span>
        <span className="gs"><input value={w.q} placeholder={t('Search')} onChange={e => ctx.set(w, { q: e.target.value })} aria-label={t('Search')} /></span>
        <Entitlements ctx={ctx} w={w} p={p} t={t} />
        <button className="me" onClick={() => ctx.set(w, { menu: !w.menu, ent: false })} aria-label={`Signed in as ${p.name}. Switch user`}>
          <Av p={p} /><span className="nm">{p.name}</span> ▾
        </button>
        {w.menu && (
          <div className="menu">
            <h6>{t('Sign in as')}</h6>
            {ctx.people.map(x => (
              <button key={x.id} className={x.id === p.id ? 'cur' : undefined} onClick={() => ctx.user(w, x.id)}>
                <Av p={x} />
                <span>{x.name}<small>{t(x.employer)} · {x.nation}{ctx.revoked.has(x.id) ? ` · ${t('disabled')}` : ''}</small></span>
              </button>
            ))}
            {ctx.live && <button onClick={() => { ctx.set(w, { menu: false }); ctx.editPerson(p.id) }}><span>{t("Edit {0}'s access", first(p))}</span></button>}
          </div>
        )}
      </div>
      <div className="shell">
        <nav className="rail">
          {NAV.map(n => (
            <button key={n[0]} className={w.view === n[0] || (w.view === 'cr' && n[0] === 'crs') ? 'on' : undefined} onClick={() => ctx.nav(w, n[0])}>{t(n[1])}</button>
          ))}
        </nav>
        <div className="main">
          <div className="pg"><Page ctx={ctx} w={w} p={p} /></div>
          <Viewer ctx={ctx} w={w} />
        </div>
      </div>
    </section>
  )
}
