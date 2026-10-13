import { useEffect, useMemo, useState } from 'react'
import { Button, Verdict, MONO, SKY } from './ui.jsx'
import { LADDER, entitlementsOf, policyFromSpec, specFromPolicy } from './entitle.js'
import { markingOf } from './marking.js'
import { DOC_BY_ID } from './data.js'
import { groupLabel, groupPolicy } from '../data/policyMatch.js'

const LABEL = {
  clearance: 'Clearance', nationality: 'Nationality', workpackage: 'Work package', supplytier: 'Supply tier', role: 'Role', company: 'Company',
}
const HINT = {
  clearance: 'A floor: holding a level holds everything beneath it.',
  nationality: 'Releasability is decided by nationality alone.',
  company: "Whose intellectual property a file is. A company's IP opens only for that company's staff.",
}
const MAX_POLICY_VALUES = 20

function Chips({ options, value, onChange, single }) {
  const held = [].concat(value ?? [])
  const toggle = (o) => {
    if (single) onChange(held[0] === o ? '' : o)
    else onChange(held.includes(o) ? held.filter(x => x !== o) : [...held, o])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
      {options.map(o => {
        const on = held.includes(o)
        return (
          <button key={o} type="button" aria-pressed={on} onClick={() => toggle(o)} style={{
            fontFamily: MONO, fontSize: 11.5, padding: '3px 9px', borderRadius: 5, cursor: 'pointer',
            background: on ? 'var(--c-info-bg)' : 'transparent', color: on ? 'var(--c-text-1)' : 'var(--c-text-4)',
            border: `1px solid ${on ? SKY : 'var(--c-border)'}`,
          }}>{o}</button>
        )
      })}
    </div>
  )
}

function Field({ name, children }) {
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--c-text-3)', marginBottom: 2 }}>{LABEL[name]}</div>
      {HINT[name] && <div style={{ fontSize: 11.5, color: 'var(--c-text-5)', marginBottom: 6 }}>{HINT[name]}</div>}
      {children}
    </div>
  )
}

function Drawer({ title, sub, onClose, children }) {
  return (
    <aside role="dialog" aria-label={title} style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, maxWidth: '92vw', zIndex: 40, overflowY: 'auto',
      background: 'var(--c-surface-2)', borderLeft: '1px solid var(--c-border-2)', boxShadow: '-16px 0 40px rgba(0,0,0,.45)',
      padding: '18px 20px 28px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 650, color: 'var(--c-text-1)' }}>{title}</div>
          {sub && <div style={{ fontSize: 12.5, color: 'var(--c-text-4)', marginTop: 2 }}>{sub}</div>}
        </div>
        <Button onClick={onClose}>Close</Button>
      </div>
      {children}
    </aside>
  )
}

const blank = { clearance: '', nationality: '', workpackage: [], supplytier: [], role: [], company: [] }
const draftOf = (grants = {}) => ({
  clearance: [].concat(grants.clearance ?? [])[0] ?? '',
  nationality: [].concat(grants.nationality ?? [])[0] ?? '',
  workpackage: [].concat(grants.workpackage ?? []),
  supplytier: [].concat(grants.supplytier ?? []),
  role: [].concat(grants.role ?? []),
  company: [].concat(grants.company ?? []),
})

function GrantsForm({ draft, setDraft, vocab }) {
  const set = (name) => (v) => setDraft(d => ({ ...d, [name]: v }))
  return (
    <>
      <Field name="clearance"><Chips single options={LADDER.filter(l => vocab.clearance.includes(l))} value={draft.clearance} onChange={set('clearance')} /></Field>
      <Field name="nationality"><Chips single options={vocab.nationality} value={draft.nationality} onChange={set('nationality')} /></Field>
      {['workpackage', 'supplytier', 'role', 'company'].map(n => (
        <Field key={n} name={n}><Chips options={vocab[n]} value={draft[n]} onChange={set(n)} /></Field>
      ))}
    </>
  )
}

/** Edit one person, or (with no `person`) add a new one. */
export function PersonEditor({ world, person, onClose, onDone }) {
  const adding = !person
  const [draft, setDraft] = useState(() => (adding ? blank : draftOf(person.grants)))
  const [name, setName] = useState('')
  const [employer, setEmployer] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  useEffect(() => { setDraft(adding ? blank : draftOf(person.grants)); setNote(null) }, [person?.id, adding]) // eslint-disable-line react-hooks/exhaustive-deps

  const unchanged = !adding && JSON.stringify(draft) === JSON.stringify(draftOf(person.grants))
  const held = useMemo(() => entitlementsOf(draft), [draft])

  const run = async (fn, done) => {
    setBusy(true); setNote(null)
    try { const r = await fn(); setNote({ ok: true, text: done(r) }); return r }
    catch (e) { setNote({ ok: false, text: e.message }) }
    finally { setBusy(false) }
  }

  const apply = () => run(() => world.editPerson(person.id, draft), r => `Platform updated: ${r.created} grant${r.created === 1 ? '' : 's'} added, ${r.deleted} removed.`)
  const add = async () => {
    const id = await run(() => world.addPerson({ name, employer, title, grants: draft }), () => `${name.trim()} can sign in now.`)
    if (id) onDone?.(id)
  }
  const remove = async () => { await run(() => world.removePerson(person.id), () => 'Removed.'); onDone?.(null) }

  return (
    <Drawer
      title={adding ? 'Add a person' : person.name}
      sub={adding ? 'They are entitled on the platform the moment you add them.' : `${person.title} · ${person.employer}`}
      onClose={onClose}
    >
      {adding && (
        <div style={{ display: 'grid', gap: 8, marginTop: 14 }}>
          {[['Name', name, setName], ['Employer', employer, setEmployer], ['Title', title, setTitle]].map(([l, v, s]) => (
            <label key={l} style={{ fontSize: 12.5, color: 'var(--c-text-3)', fontWeight: 600 }}>{l}
              <input value={v} onChange={e => s(e.target.value)} maxLength={40} style={{
                display: 'block', width: '100%', marginTop: 3, padding: '7px 10px', fontSize: 13, borderRadius: 8,
                border: '1px solid var(--c-border)', background: 'var(--c-surface)', color: 'var(--c-text-1)', boxSizing: 'border-box',
              }} />
            </label>
          ))}
        </div>
      )}
      {!adding && <div style={{ marginTop: 12, fontSize: 12, color: 'var(--c-text-5)' }}>
        Changing these rewrites what the platform resolves this person to. No document is touched.
      </div>}
      <GrantsForm draft={draft} setDraft={setDraft} vocab={world.vocab} />
      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        {adding
          ? <Button tone="primary" disabled={busy || !name.trim()} onClick={add}>Add to the programme</Button>
          : <Button tone="primary" disabled={busy || unchanged} onClick={apply}>Apply to the platform</Button>}
        {!adding && !unchanged && <Button disabled={busy} onClick={() => setDraft(draftOf(person.grants))}>Discard</Button>}
        {!adding && person.added && <Button tone="danger" disabled={busy} onClick={remove}>Remove person</Button>}
      </div>
      {note && <div style={{ marginTop: 12 }}><Verdict granted={note.ok}>{note.text}</Verdict></div>}
      <div style={{ marginTop: 18, fontSize: 11.5, color: 'var(--c-text-5)' }}>Resolves to {held.length} entitlement{held.length === 1 ? '' : 's'}.</div>
    </Drawer>
  )
}

/** Edit the policy on each encrypted unit of one document. Saving re-encrypts that unit. */
export function PolicyEditor({ world, vault, docId, onClose }) {
  const doc = DOC_BY_ID[docId]
  const units = [...vault.values()].filter(e => e.unit.doc.id === docId)
  const [key, setKey] = useState(units[0].unit.key)
  const entry = vault.get(key)
  const [draft, setDraft] = useState(() => specFromPolicy(entry.unit.policy))
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState(null)

  useEffect(() => { setKey(units[0].unit.key) }, [docId]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(specFromPolicy(vault.get(key).unit.policy)); setNote(null) }, [key, docId, vault])

  const policy = policyFromSpec(draft)
  const tooMany = policy.length > MAX_POLICY_VALUES
  const same = JSON.stringify(policy) === JSON.stringify(entry.unit.policy)
  const marking = markingOf(policy)
  const groups = groupPolicy(policy)

  const apply = async () => {
    setBusy(true); setNote(null)
    try { await world.editUnit(key, policy); setNote({ ok: true, text: 'Re-encrypted under the new policy. Earlier copies still carry the old one.' }) }
    catch (e) { setNote({ ok: false, text: e.message }) }
    finally { setBusy(false) }
  }
  const restoreOriginal = () => {
    setDraft(specFromPolicy(entry.original.unit.policy))
    world.restoreUnit(key)
    setNote({ ok: true, text: 'Original encryption restored.' })
  }

  const setValue = (name) => (v) => setDraft(d => ({ ...d, [name]: name === 'clearance' ? (v ? [v] : []) : v }))

  return (
    <Drawer title={doc.title} sub="Change who may open it. The ciphertext is re-made under the new policy." onClose={onClose}>
      {units.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {units.map(u => (
            <button key={u.unit.key} aria-pressed={u.unit.key === key} onClick={() => setKey(u.unit.key)} style={{
              padding: '4px 10px', fontSize: 12, borderRadius: 6, cursor: 'pointer', color: 'var(--c-text-2)',
              background: u.unit.key === key ? 'var(--c-info-bg)' : 'transparent',
              border: `1px solid ${u.unit.key === key ? SKY : 'var(--c-border)'}`,
            }}>{u.unit.tier.label}</button>
          ))}
        </div>
      )}
      <div style={{ marginTop: 14, padding: '8px 10px', borderRadius: 6, background: marking.tone, color: '#fff', fontFamily: MONO, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', textAlign: 'center' }}>
        {marking.banner}
      </div>
      <Field name="clearance"><Chips single options={LADDER} value={draft.clearance[0] ?? ''} onChange={setValue('clearance')} /></Field>
      <Field name="nationality"><Chips options={world.vocab.nationality} value={draft.nationality} onChange={setValue('nationality')} /></Field>
      {['workpackage', 'supplytier', 'role', 'company'].map(n => (
        <Field key={n} name={n}><Chips options={world.vocab[n]} value={draft[n]} onChange={setValue(n)} /></Field>
      ))}
      <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--c-text-5)' }}>
        {groups.length === 0 ? 'Any authenticated user may open this.' : groups.map(groupLabel).join('  ·  ')}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
        <Button tone="primary" disabled={busy || same || tooMany} onClick={apply}>Re-encrypt with this policy</Button>
        {entry.original && <Button disabled={busy} onClick={restoreOriginal}>Restore original</Button>}
      </div>
      {tooMany && <div style={{ marginTop: 10 }}><Verdict granted={false}>A policy can name at most {MAX_POLICY_VALUES} values.</Verdict></div>}
      {note && <div style={{ marginTop: 12 }}><Verdict granted={note.ok}>{note.text}</Verdict></div>}
    </Drawer>
  )
}
