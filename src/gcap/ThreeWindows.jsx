import { useEffect, useMemo, useRef, useState } from 'react'
import { DOCUMENTS, DOC_BY_ID, FOLDERS, CUSTODIANS } from './data.js'
import { markingOf } from './marking.js'
import { openDocument } from './vault.js'
import { entitlementsOf } from './entitle.js'
import { evaluatePolicy, groupLabel } from '../data/policyMatch.js'
import { Avatar, Button, WhyChips, MONO, SERIF, SKY, RED, GREEN, AMBER, PAPER, INK } from './ui.jsx'

const DOC = DOC_BY_ID.icd
const DEFAULT_IDS = ['gcap-marco', 'gcap-priya', 'gcap-kenji']
const WHERE = {
  GBR: { city: 'Filton', tz: 'Europe/London' },
  ITA: { city: 'Rome', tz: 'Europe/Rome' },
  JPN: { city: 'Nagoya', tz: 'Asia/Tokyo' },
  USA: { city: 'Arlington', tz: 'America/New_York' },
}

const CSS = `
  @keyframes tw-draw { to { stroke-dashoffset: 0 } }
  @keyframes tw-row { from { background: rgba(127,194,232,.28) } to { background: transparent } }
  .tw-live { stroke-dasharray: 1; stroke-dashoffset: 1; animation: tw-draw .7s ease-out forwards; }
  .tw-fresh { animation: tw-row 1.4s ease-out 1; }
  @media (prefers-reduced-motion: reduce) { .tw-live { animation: none; stroke-dashoffset: 0 } .tw-fresh { animation: none } }
`

function useClock(active) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [active])
  return now
}

function Rail({ runKey, res }) {
  const paths = ['M150 44 C150 64 50 56 50 84', 'M150 44 L150 84', 'M150 44 C150 64 250 56 250 84']
  const lefts = ['16.6%', '50%', '83.3%']
  return (
    <div style={{ position: 'relative', height: 84, marginTop: 8 }}>
      <svg viewBox="0 0 300 84" preserveAspectRatio="none" aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
        {paths.map((d, i) => <path key={i} d={d} fill="none" stroke="#4A6072" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
        {res.map((r, i) => r && (
          <path key={`${runKey}-${i}-${r.status}`} className="tw-live" pathLength="1" d={paths[i]} fill="none"
            stroke={r.status === 'done' && !r.result.granted ? RED : SKY} strokeWidth="2" vectorEffect="non-scaling-stroke"
            style={{ animationDelay: `${i * 0.25}s` }} />
        ))}
      </svg>
      <div style={{
        position: 'absolute', left: '50%', top: 0, transform: 'translateX(-50%)', background: 'var(--c-surface)', whiteSpace: 'nowrap',
        border: '1px solid var(--c-border-2)', borderRadius: 8, padding: '7px 16px', textAlign: 'center',
      }}>
        <b style={{ fontWeight: 600, color: 'var(--c-text-1)' }}>{CUSTODIANS.gigo.label}</b>
        <small style={{ display: 'block', color: 'var(--c-text-5)', fontSize: 12 }}>holds the key, answers each request on its own</small>
      </div>
      {res.map((r, i) => {
        const done = r?.status === 'done'
        const tier = done && r.result.granted ? r.result.tier : null
        const label = !done ? '' : !r.result.granted ? 'refused' : tier ? (tier.id === DOC.tiers[0].id ? 'full release' : 'supplier extract') : 'released'
        const tone = !done ? 'var(--c-text-5)' : !r.result.granted ? RED : tier && tier.id !== DOC.tiers[0].id ? AMBER : GREEN
        return (
          <span key={i} style={{
            position: 'absolute', bottom: 4, left: lefts[i], transform: 'translateX(-50%)', font: `12px ${MONO}`, padding: '2px 9px',
            borderRadius: 999, border: `1px solid ${tone}`, background: 'var(--c-surface-2)', color: tone,
            opacity: done ? 1 : 0, transition: 'opacity .25s', transitionDelay: done ? `${0.4 + i * 0.25}s` : '0s',
          }}>{label || '·'}</span>
        )
      })}
    </div>
  )
}

function MiniTree({ row, onFresh }) {
  if (!row) return <div style={{ padding: 12, fontSize: 12, color: 'var(--c-text-5)' }}>Resolving…</div>
  const seen = DOCUMENTS.filter(d => row[d.id]?.granted)
  return (
    <div>
      {FOLDERS.map(f => {
        const items = seen.filter(d => d.folder === f)
        if (!items.length) return null
        return (
          <div key={f}>
            <div style={{ fontSize: 11, color: 'var(--c-text-6)', padding: '7px 12px 3px' }}>{f}</div>
            {items.map(d => {
              const r = row[d.id]
              const m = markingOf(r.entry.unit.policy)
              const sel = d.id === DOC.id
              return (
                <div key={d.id} className={onFresh === d.id ? 'tw-fresh' : undefined} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px 3px 0', fontSize: 12, lineHeight: 1.25,
                  color: sel ? 'var(--c-text-1)' : 'var(--c-text-3)', background: sel ? 'var(--c-surface)' : 'transparent',
                }}>
                  <i style={{ width: 4, height: 16, borderRadius: '0 2px 2px 0', background: m.tone, flex: 'none' }} />
                  <span>{d.title}</span>
                </div>
              )
            })}
          </div>
        )
      })}
      <div style={{ padding: '8px 12px', color: 'var(--c-text-5)', fontSize: 12, borderTop: '1px solid var(--c-border)', marginTop: 6 }}>
        {seen.length} item{seen.length === 1 ? '' : 's'}
      </div>
    </div>
  )
}

function Sheet({ r, person, clock }) {
  const open = r?.status === 'done' && r.result.granted
  const refused = r?.status === 'done' && !r.result.granted
  const marking = open ? markingOf(r.result.entry.unit.policy) : null
  const lines = open ? r.result.text.split(/\n{2,}/) : []
  const extract = open && r.result.tier && r.result.tier.id !== DOC.tiers[0].id
  return (
    <div style={{ background: PAPER, color: INK, borderRadius: 3, position: 'relative', overflow: 'hidden', flex: 1, minHeight: 300, boxShadow: '0 10px 28px rgba(0,0,0,.4)' }}>
      {open && (
        <>
          <div style={{ background: marking.tone, color: '#fff', font: `700 10px ${MONO}`, letterSpacing: '.06em', textAlign: 'center', padding: '4px 6px' }}>{marking.banner}</div>
          <h3 style={{ font: `600 14px/1.25 ${SERIF}`, margin: '12px 14px 4px' }}>{DOC.title}{r.result.tier ? ` — ${r.result.tier.label}` : ''}</h3>
          <div style={{ margin: '0 14px 8px', font: `11px ${MONO}`, color: '#51616E' }}>Key released by {CUSTODIANS[DOC.custodian].label} · {clock}</div>
          {lines.map((l, i) => <p key={i} style={{ font: `12.5px/1.45 ${SERIF}`, margin: '0 14px 6px', whiteSpace: 'pre-wrap' }}>{l}</p>)}
          {extract && (
            <div style={{ margin: '10px 16px 0', padding: '7px 10px', border: '1px dashed #93A1AB', color: '#51616E', font: `12px ${MONO}`, borderRadius: 3 }}>
              Withheld from this release: <span style={{ display: 'inline-block', width: 84, height: '.8em', background: '#17222B', borderRadius: 2, verticalAlign: -1 }} />
            </div>
          )}
        </>
      )}
      {!open && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 16 }}>
          <div style={{ textAlign: 'center', color: refused ? '#9A2B1F' : '#6A7B88', fontSize: 12.5, maxWidth: 230 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={refused ? '#9A2B1F' : '#6A7B88'} strokeWidth="1.8" style={{ display: 'block', margin: '0 auto 6px' }}>
              <rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            {refused ? `Refused. Nothing of this document is released to ${person.name.split(' ')[0]}.` : r ? 'Asking the custodian…' : 'Sealed. The key is not in this window.'}
            {[200, 170, 190].map(w => <div key={w} style={{ width: w * 0.9, height: 7, background: '#D5DBDD', borderRadius: 3, margin: '5px auto' }} />)}
          </div>
        </div>
      )}
    </div>
  )
}

function Window({ person, people, row, r, now, onPick, onEdit, canEdit, fresh, fullPolicy, extractPolicy }) {
  const where = WHERE[person.nation] ?? { city: person.nation, tz: 'UTC' }
  const clock = now.toLocaleTimeString([], { timeZone: where.tz, hour: '2-digit', minute: '2-digit', hour12: false })
  const ents = useMemo(() => entitlementsOf(person.grants), [person.grants])
  const fullEval = useMemo(() => evaluatePolicy(ents, fullPolicy), [ents, fullPolicy])
  const done = r?.status === 'done'
  const served = done && r.result.granted ? r.result.tier : null
  const mirror = done && (served?.id === DOC.tiers[0].id) !== fullEval.satisfied
  return (
    <div style={{ background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--c-surface)', borderBottom: '1px solid var(--c-border)' }}>
        <span style={{ display: 'flex', gap: 5 }}>{[0, 1, 2].map(i => <i key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--c-border-2)', display: 'block' }} />)}</span>
        <b style={{ fontWeight: 600, color: 'var(--c-text-1)' }}>{where.city}</b>
        <span style={{ marginLeft: 'auto', font: `12px ${MONO}`, color: 'var(--c-text-5)' }}>{clock} local</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--c-border)' }}>
        <Avatar persona={person} size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <select aria-label={`Person in the ${where.city} window`} value={person.id} onChange={e => onPick(e.target.value)} style={{
            background: 'transparent', color: 'var(--c-text-1)', border: 'none', fontWeight: 700, fontSize: 14, padding: 0, maxWidth: '100%', cursor: 'pointer',
          }}>
            {people.map(p => <option key={p.id} value={p.id} style={{ color: '#000' }}>{p.name}</option>)}
          </select>
          <div style={{ color: 'var(--c-text-4)', fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.title} · {person.employer}</div>
        </div>
        <span style={{ font: `11px ${MONO}`, border: '1px solid var(--c-border-2)', padding: '1px 7px', borderRadius: 4, color: 'var(--c-text-3)' }}>{person.nation}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '148px minmax(0, 1fr)', flex: 1, minHeight: 380 }}>
        <div style={{ borderRight: '1px solid var(--c-border)', padding: '8px 0', background: '#0F1A23' }}><MiniTree row={row} onFresh={fresh} /></div>
        <div style={{ padding: 10, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <Sheet r={r} person={person} clock={clock} />
          <div style={{ opacity: done ? 1 : 0, transition: 'opacity .3s', minHeight: 60 }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginBottom: 5 }}>What the full release needs</div>
            <WhyChips entitlements={ents} policy={fullPolicy} />
            <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginTop: 8 }}>
              {!done ? '' : !r.result.granted
                ? `The supplier extract needs ${evaluatePolicy(ents, extractPolicy).missing.map(groupLabel).join(', ') || 'nothing further'}.`
                : served.id === DOC.tiers[0].id
                  ? 'Served the full release.'
                  : `Served the supplier extract. The full release also needs ${fullEval.missing.map(groupLabel).join(', ')}.`}
              {mirror && <span style={{ color: AMBER }}> The chips disagree with the key server; trust the key server.</span>}
            </div>
          </div>
          {canEdit && <Button onClick={onEdit} style={{ alignSelf: 'flex-start' }}>Edit {person.name.split(' ')[0]}&apos;s access</Button>}
        </div>
      </div>
    </div>
  )
}

export default function ThreeWindows({ world, vault, active, onEditPerson }) {
  const { people, byId, cells, epoch, live } = world
  const [ids, setIds] = useState(DEFAULT_IDS)
  const [res, setRes] = useState([null, null, null])
  const [runKey, setRunKey] = useState(0)
  const [fresh, setFresh] = useState(null)
  const now = useClock(active)
  const seq = useRef([0, 0, 0])

  const policyOf = (tier) => vault.get(`${DOC.id}:${tier}`)?.unit.policy ?? DOC.tiers.find(t => t.id === tier).policy
  const fullPolicy = policyOf('full')
  const extractPolicy = policyOf('extract')
  const shown = ids.map(id => byId[id] ?? people[0])

  const openWindows = async (indices, { restart } = {}) => {
    if (restart) setRunKey(k => k + 1)
    setRes(rs => rs.map((r, i) => (indices.includes(i) ? { status: 'pending' } : r)))
    await Promise.all(indices.map(async i => {
      const mine = ++seq.current[i]
      const result = await openDocument(vault, DOC, shown[i].id)
      if (seq.current[i] === mine) setRes(rs => rs.map((r, j) => (j === i ? { status: 'done', result } : r)))
    }))
    if (restart) { setFresh(DOC.id); setTimeout(() => setFresh(null), 1600) }
  }

  // An edit made anywhere re-asks every window that is already open, so free play reads as live.
  const firstEpoch = useRef(epoch)
  useEffect(() => {
    if (epoch === firstEpoch.current || !active) return
    const open = res.map((r, i) => (r ? i : -1)).filter(i => i >= 0)
    if (open.length) openWindows(open)
  }, [epoch]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i, id) => {
    const next = ids.map((x, j) => (j === i ? id : x))
    setIds(next)
    if (res[i]) {
      setRes(rs => rs.map((r, j) => (j === i ? { status: 'pending' } : r)))
      const mine = ++seq.current[i]
      openDocument(vault, DOC, id).then(result => seq.current[i] === mine && setRes(rs => rs.map((r, j) => (j === i ? { status: 'done', result } : r))))
    }
  }

  const busy = res.some(r => r?.status === 'pending')

  return (
    <div>
      <style>{CSS}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap', marginBottom: 6 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: 'var(--c-text-1)' }}>{DOC.title}</h2>
          <p style={{ margin: '2px 0 0', color: 'var(--c-text-4)', maxWidth: '70ch' }}>
            One object. Nobody has a copy of it. Three people in three countries open it at the same moment, and the custodian answers each of them separately.
          </p>
        </div>
        <span style={{ font: `12px ${MONO}`, color: SKY, border: '1px solid var(--c-border-2)', padding: '2px 8px', borderRadius: 4, background: 'var(--c-surface-2)' }}>{DOC.link}</span>
        <span style={{ flex: 1 }} />
        <Button onClick={() => { seq.current = seq.current.map(n => n + 1); setRes([null, null, null]) }} disabled={!res.some(Boolean)}>Seal it again</Button>
        <Button tone="primary" onClick={() => openWindows([0, 1, 2], { restart: true })} disabled={busy}>Open for all three</Button>
      </div>

      <Rail runKey={runKey} res={res} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(320px, 1fr))', gap: 18, overflowX: 'auto', paddingBottom: 8 }}>
        {shown.map((p, i) => (
          <Window key={i} fullPolicy={fullPolicy} extractPolicy={extractPolicy} person={p} people={people} row={cells[p.id]} r={res[i]} now={now} fresh={fresh}
            onPick={id => pick(i, id)} canEdit={live} onEdit={() => onEditPerson(p.id)} />
        ))}
      </div>

      <div style={{ marginTop: 16, borderLeft: `3px solid ${SKY}`, padding: '8px 14px', color: 'var(--c-text-3)', background: 'var(--c-surface-2)', borderRadius: '0 6px 6px 0' }}>
        <b style={{ color: 'var(--c-text-1)' }}>What to notice.</b> The interface control document is one encrypted object, yet each window is served the tier its holder qualifies for.
        The tier is the key server&apos;s answer, not a setting on the file. Change someone&apos;s access and the window re-asks.
      </div>
    </div>
  )
}
