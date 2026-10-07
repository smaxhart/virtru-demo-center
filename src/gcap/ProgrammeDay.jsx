import { useEffect, useMemo, useRef, useState } from 'react'
import { DOCUMENTS, FOLDERS } from './data.js'
import { DAY } from './events.js'
import { stateOf } from './world.js'
import { entitlementsOf } from './entitle.js'
import { Avatar, Button, Card, WhyChips, MONO, SKY, RED, GREEN, AMBER } from './ui.jsx'

const RANK = { n: 0, e: 1, o: 2 }
const CSS = `
  @keyframes pd-lost { 0% { background: rgba(255,107,94,.55) } 100% { background: transparent } }
  @keyframes pd-gain { 0% { background: rgba(127,212,166,.55) } 100% { background: transparent } }
  .pd-lost { animation: pd-lost 2.6s ease-out 1 }
  .pd-gain { animation: pd-gain 2.6s ease-out 1 }
  .pd-cell:focus-visible { outline: 2px solid ${SKY}; outline-offset: -2px }
  @media (prefers-reduced-motion: reduce) { .pd-lost, .pd-gain { animation: none } }
`

function Mark({ s }) {
  if (s === 'o') return <i aria-label="opens" style={{ display: 'block', width: 11, height: 11, borderRadius: '50%', background: SKY }} />
  if (s === 'e') return <i aria-label="opens the lower tier" style={{ display: 'block', width: 11, height: 11, borderRadius: '50%', border: `2px solid ${SKY}`, background: `linear-gradient(90deg, ${SKY} 50%, transparent 50%)`, boxSizing: 'border-box' }} />
  if (s === 'n') return <i aria-label="refused" style={{ display: 'block', width: 10, height: 2, background: 'var(--c-text-6)', borderRadius: 1 }} />
  return <span style={{ color: 'var(--c-text-6)' }}>·</span>
}

const fmt = (v) => (v.length ? v.join(', ') : 'none')

export default function ProgrammeDay({ world, vault, active, onEditPerson, onAddPerson, onEditDoc }) {
  const { people, byId, cells, revokedIds } = world
  const [log, setLog] = useState([])
  const [pulses, setPulses] = useState({})
  const [running, setRunning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState(null)
  const timers = useRef([])
  const stop = useRef(false)

  useEffect(() => () => { stop.current = true; timers.current.forEach(clearTimeout) }, [])

  const done = useMemo(() => new Set(log.map(l => l.ev.id)), [log])
  const latest = log[log.length - 1]

  const pulse = (changes) => {
    const next = {}
    for (const c of changes) next[`${c.personId}:${c.docId}`] = RANK[c.to] < RANK[c.from] ? 'lost' : 'gain'
    setPulses(p => ({ ...p, ...next }))
    const keys = Object.keys(next)
    timers.current.push(setTimeout(() => setPulses(p => {
      const n = { ...p }
      for (const k of keys) if (n[k] === next[k]) delete n[k]
      return n
    }), 2800))
  }

  const play = async (ev) => {
    setBusy(true)
    setError(null)
    try {
      const { changes, diff, person } = await world.applyEvent(ev)
      pulse(changes)
      setLog(l => [...l, { ev, diff, changes, person }])
    } catch (e) {
      setError(e.message ?? String(e))
      throw e
    } finally {
      setBusy(false)
    }
  }

  const runDay = async () => {
    stop.current = false
    setRunning(true)
    try {
      for (const ev of DAY) {
        if (stop.current) break
        if (done.has(ev.id)) continue
        await play(ev)
        if (ev !== DAY[DAY.length - 1]) await new Promise(r => timers.current.push(setTimeout(r, 3200)))
      }
    } catch { /* surfaced in the banner */ } finally {
      setRunning(false)
    }
  }

  const startOfDay = async () => {
    stop.current = true
    timers.current.forEach(clearTimeout)
    setBusy(true)
    try {
      await world.resetAll()
      setLog([]); setPulses({}); setSelected(null); setError(null)
    } catch (e) {
      setError(e.message ?? String(e))
    } finally {
      setBusy(false)
      setRunning(false)
    }
  }

  const total = people.length * DOCUMENTS.length
  const out = useMemo(() => {
    const seen = new Map()
    for (const l of log) for (const c of l.changes) {
      if (c.to !== 'n') continue
      const key = `${c.personId}:${c.docId}`
      if (cells[c.personId]?.[c.docId] && stateOf(cells[c.personId][c.docId]) === 'n') seen.set(key, c)
    }
    return [...seen.values()]
  }, [log, cells])

  const sel = selected && byId[selected.personId] && cells[selected.personId]?.[selected.docId]
    ? { person: byId[selected.personId], doc: DOCUMENTS.find(d => d.id === selected.docId), r: cells[selected.personId][selected.docId] }
    : null
  const selUnits = sel ? [...vault.values()].filter(e => e.unit.doc.id === sel.doc.id) : []

  const counts = Object.fromEntries(people.map(p => [p.id, DOCUMENTS.filter(d => cells[p.id]?.[d.id]?.granted).length]))
  const ready = people.every(p => cells[p.id])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px minmax(0, 1fr) 260px', gap: 16, alignItems: 'start' }}>
      <style>{CSS}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button tone="primary" onClick={runDay} disabled={running || busy || done.size === DAY.length} style={{ flex: 1 }}>
            {running ? 'Running the day…' : done.size ? 'Continue the day' : 'Run the day'}
          </Button>
          <Button onClick={startOfDay} disabled={busy && !running}>Start of day</Button>
        </div>
        {DAY.map(ev => {
          const d = done.has(ev.id)
          return (
            <div key={ev.id} style={{
              borderLeft: `3px solid ${d ? SKY : 'var(--c-border-2)'}`, background: 'var(--c-surface-2)', padding: '9px 12px', borderRadius: '0 8px 8px 0',
              opacity: d || !done.size ? 1 : 0.75,
            }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ font: `12px ${MONO}`, color: d ? SKY : 'var(--c-text-5)' }}>{ev.time}</span>
                <b style={{ fontWeight: 600, color: 'var(--c-text-1)', fontSize: 14 }}>{ev.title}</b>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--c-text-4)', margin: '3px 0 7px', lineHeight: 1.4 }}>{ev.body}</div>
              {!d && <Button onClick={() => play(ev).catch(() => {})} disabled={busy || running}>Apply this one</Button>}
              {d && <span style={{ fontSize: 12, color: SKY }}>Applied. Every cell was re-asked.</span>}
            </div>
          )
        })}
        {error && <div role="alert" style={{ color: RED, fontSize: 12.5 }}>{error}</div>}
      </div>

      <div style={{ minWidth: 0 }}>
        <div style={{ overflowX: 'auto', border: '1px solid var(--c-border)', borderRadius: 10, background: 'var(--c-surface-2)' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--c-text-5)', fontWeight: 400, minWidth: 170 }}>
                  <Button onClick={onAddPerson} disabled={!world.live} title="Add a person with any access you choose">Add person</Button>
                </th>
                {people.map(p => (
                  <th key={p.id} style={{ padding: '8px 2px', fontWeight: 400, minWidth: 50 }}>
                    <button type="button" onClick={() => onEditPerson(p.id)} disabled={!world.live} title={`Edit ${p.name}`} style={{
                      background: 'none', border: 'none', cursor: world.live ? 'pointer' : 'default', color: 'var(--c-text-3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, width: '100%', padding: 0,
                    }}>
                      <Avatar persona={p} size={26} dim={revokedIds.has(p.id)} />
                      <span style={{ fontSize: 11.5, textDecoration: revokedIds.has(p.id) ? 'line-through' : 'none' }}>{p.name.split(' ')[0]}</span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FOLDERS.map(f => {
                const docs = DOCUMENTS.filter(d => d.folder === f)
                return [
                  <tr key={f}><td colSpan={people.length + 1} style={{ padding: '7px 10px 2px', fontSize: 11, color: 'var(--c-text-6)' }}>{f}</td></tr>,
                  ...docs.map(d => (
                    <tr key={d.id} style={{ borderTop: '1px solid var(--c-border)' }}>
                      <th scope="row" style={{ textAlign: 'left', padding: '0 10px', fontWeight: 400 }}>
                        <button type="button" onClick={() => onEditDoc(d.id)} title="Change this document's policy" style={{
                          background: 'none', border: 'none', color: 'var(--c-text-2)', cursor: 'pointer', padding: '5px 0', textAlign: 'left', font: 'inherit', fontSize: 12.5,
                        }}>{d.title}</button>
                      </th>
                      {people.map(p => {
                        const r = cells[p.id]?.[d.id]
                        const k = `${p.id}:${d.id}`
                        const isSel = selected?.personId === p.id && selected?.docId === d.id
                        return (
                          <td key={p.id} style={{ padding: 0, textAlign: 'center' }}>
                            <button type="button" className={`pd-cell ${pulses[k] ? `pd-${pulses[k]}` : ''}`} onClick={() => setSelected({ personId: p.id, docId: d.id })}
                              aria-label={`${p.name}, ${d.title}: ${stateOf(r) === 'o' ? 'opens' : stateOf(r) === 'e' ? 'opens the lower tier' : stateOf(r) === 'n' ? 'refused' : 'not yet asked'}`}
                              style={{
                                width: '100%', height: 26, display: 'grid', placeItems: 'center', cursor: 'pointer', border: 'none',
                                background: isSel ? 'rgba(127,194,232,.18)' : 'transparent',
                              }}>
                              <Mark s={stateOf(r)} />
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )),
                ]
              })}
              <tr style={{ borderTop: '1px solid var(--c-border-2)' }}>
                <th scope="row" style={{ textAlign: 'left', padding: '7px 10px', fontWeight: 400, color: 'var(--c-text-5)' }}>Can open</th>
                {people.map(p => <td key={p.id} style={{ textAlign: 'center', font: `12px ${MONO}`, color: 'var(--c-text-3)' }}>{ready ? counts[p.id] : '·'}</td>)}
              </tr>
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: 'var(--c-text-5)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Mark s="o" /> opens</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Mark s="e" /> opens the lower tier</span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Mark s="n" /> refused</span>
          <span>Every mark is a key-server answer. Click one to see why.</span>
        </div>

        {sel && (
          <div style={{ marginTop: 12 }}>
            <Card title={`${sel.person.name} · ${sel.doc.title}`} accent={sel.r.granted ? GREEN : RED}>
              <div style={{ padding: '6px 14px 12px' }}>
              <div style={{ fontSize: 13, color: 'var(--c-text-2)', marginBottom: 8 }}>
                {sel.r.granted
                  ? sel.r.tier ? `The key server released the ${sel.r.tier.label.toLowerCase()}.` : 'The key server released it.'
                  : 'The key server refused every tier.'}
              </div>
              {selUnits.map(e => (
                <div key={e.unit.key} style={{ marginTop: 6 }}>
                  {sel.doc.tiers && <div style={{ fontSize: 12, color: 'var(--c-text-5)', marginBottom: 4 }}>{e.unit.tier.label} needs</div>}
                  <WhyChips entitlements={entitlementsOf(sel.person.grants)} policy={e.unit.policy} />
                </div>
              ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Card title="What the key server did">
          <div style={{ padding: '4px 14px 12px' }}>
          <Stat n={world.decisionsChanged} of={total} label="decisions changed" tone={world.decisionsChanged ? AMBER : undefined} />
          <Stat n={0} label="files recalled" />
          <Stat n={world.reencrypted} label="documents re-encrypted" />
          </div>
        </Card>

        {latest && (
          <Card title="The only change anyone made" accent={SKY}>
            <div style={{ padding: '6px 14px 12px' }}>
            <div style={{ fontSize: 13, color: 'var(--c-text-1)', marginBottom: 6 }}>{latest.person.name}</div>
            {latest.diff.account && (
              <div style={{ font: `12px ${MONO}`, color: 'var(--c-text-3)' }}>account: {latest.diff.account.from} → <span style={{ color: RED }}>{latest.diff.account.to}</span></div>
            )}
            {latest.diff.attributes?.map(a => (
              <div key={a.name} style={{ font: `12px ${MONO}`, color: 'var(--c-text-3)', marginBottom: 2 }}>
                {a.name}: {fmt(a.from)} → <span style={{ color: a.to.length ? GREEN : RED }}>{fmt(a.to)}</span>
              </div>
            ))}
            <div style={{ fontSize: 12.5, color: 'var(--c-text-4)', marginTop: 8 }}>
              {latest.changes.length
                ? `${latest.changes.length} decision${latest.changes.length === 1 ? '' : 's'} moved. No document was touched.`
                : 'No decision moved.'}
            </div>
            </div>
          </Card>
        )}

        {out.length > 0 && (
          <Card title="Copies already out there">
            <div style={{ padding: '6px 14px 12px' }}>
            <div style={{ fontSize: 12.5, color: 'var(--c-text-4)', marginBottom: 6 }}>Still encrypted, and the next open is refused:</div>
            {out.slice(0, 8).map(c => (
              <div key={`${c.personId}:${c.docId}`} style={{ fontSize: 12.5, color: 'var(--c-text-2)', padding: '2px 0' }}>
                {byId[c.personId]?.name.split(' ')[0]} · {DOCUMENTS.find(d => d.id === c.docId)?.title}
              </div>
            ))}
            {out.length > 8 && <div style={{ fontSize: 12, color: 'var(--c-text-5)' }}>and {out.length - 8} more</div>}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

function Stat({ n, of, label, tone }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '3px 0' }}>
      <span style={{ fontSize: 24, fontWeight: 600, color: tone ?? 'var(--c-text-1)', minWidth: 30 }}>{n}</span>
      <span style={{ fontSize: 13, color: 'var(--c-text-4)' }}>{of != null ? `of ${of} ` : ''}{label}</span>
    </div>
  )
}
