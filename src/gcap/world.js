/**
 * The live state of free play: who exists, what each holds, the person × document matrix, and the
 * operations that change them.
 *
 * Every verdict in `cells` is a KAS rewrap (`vault.js`). A mutation here does two things in order:
 * it changes the platform (subject mappings for a person, a re-encrypted TDF for a document), then
 * marks the affected row or column dirty so `sync` asks the key server again. Nothing is inferred
 * from the edit. If the platform ignored it the matrix would not move, which is what the
 * `verify-gcap` free-play section checks.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { PERSONAS, PERSONA_BY_ID, DOC_BY_ID } from './data.js'
import { cleanGrants } from './events.js'
import { diffGrants } from './entitle.js'
import { listFor, openDocument, rewrapsIn, reencryptUnit, restoreUnits, revoke, restore } from './vault.js'

const api = () => window.electronAPI
const PALETTE = ['#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6', '#f97316', '#14b8a6', '#eab308']

/** o = opens, e = opens the lower tier only, n = refused. */
export const stateOf = (r) => {
  if (!r) return null
  if (!r.granted) return 'n'
  return r.tier && r.doc.tiers && r.tier.id !== r.doc.tiers[0].id ? 'e' : 'o'
}

const freshDirty = () => ({ people: new Set(), docs: new Set() })

function viewsFrom(rawPeople) {
  let added = 0
  return rawPeople.map(p => {
    const base = PERSONA_BY_ID[p.id]
    if (base) return { ...base, grants: p.grants, added: false }
    const nat = [].concat(p.grants?.nationality ?? [])[0]
    return {
      id: p.id, name: p.name, employer: p.employer || 'Free play', title: p.title || 'Added in free play',
      nation: nat ? nat.toUpperCase() : '—', color: PALETTE[added++ % PALETTE.length],
      note: 'Added in free play. Removing them, or starting the day over, takes their access away.',
      grants: p.grants ?? {}, added: true,
    }
  })
}

const snapshot = (cells) => Object.fromEntries(
  Object.entries(cells).map(([id, row]) => [id, Object.fromEntries(Object.entries(row).map(([d, r]) => [d, stateOf(r)]))]),
)

export function useWorld(vault) {
  const live = !!api()?.gcapPeople
  const [raw, setRaw] = useState(() => PERSONAS.map(p => ({ id: p.id, name: p.name, grants: {}, added: false })))
  const [vocab, setVocab] = useState(null)
  const [epoch, setEpoch] = useState(0)
  const [revokedIds, setRevokedIds] = useState(() => new Set())
  const [cells, setCells] = useState({})
  const [syncing, setSyncing] = useState(false)
  const [reencrypted, setReencrypted] = useState(0)

  const peopleRef = useRef(viewsFrom(raw))
  const cellsRef = useRef({})
  const dirty = useRef(freshDirty())
  const touched = useRef(freshDirty())
  const baseline = useRef(null)
  const queue = useRef(Promise.resolve())
  const hold = useRef(0)

  const people = useMemo(() => viewsFrom(raw), [raw])
  const byId = useMemo(() => Object.fromEntries(people.map(p => [p.id, p])), [people])

  const commitRaw = (list) => {
    peopleRef.current = viewsFrom(list)
    setRaw(list)
  }
  const bump = () => setEpoch(e => e + 1)
  const mark = (personId, docId) => {
    if (personId) { dirty.current.people.add(personId); touched.current.people.add(personId) }
    if (docId) { dirty.current.docs.add(docId); touched.current.docs.add(docId) }
  }

  /** Re-ask the key server for whatever is dirty. Serialised, so overlapping callers queue up. */
  const sync = useCallback(() => {
    const run = async () => {
      if (!vault) return []
      const d = dirty.current
      dirty.current = freshDirty()
      const ids = peopleRef.current.map(p => p.id)
      const prev = cellsRef.current
      const next = {}
      for (const id of ids) if (prev[id]) next[id] = prev[id]
      const rowIds = ids.filter(id => d.people.has(id) || !prev[id])
      const docIds = [...d.docs]
      const stale = Object.keys(prev).length !== Object.keys(next).length
      if (!rowIds.length && !docIds.length) {
        if (stale) { cellsRef.current = next; setCells(next) }
        return []
      }
      setSyncing(true)
      try {
        for (const id of rowIds) {
          const results = await listFor(vault, id)
          next[id] = Object.fromEntries(results.map(r => [r.doc.id, r]))
          cellsRef.current = { ...next }
          setCells({ ...next })
        }
        const others = ids.filter(id => !rowIds.includes(id))
        await Promise.all(others.flatMap(id => docIds.map(async docId => {
          next[id] = { ...next[id], [docId]: await openDocument(vault, DOC_BY_ID[docId], id) }
        })))
        cellsRef.current = next
        setCells(next)
      } catch (e) {
        for (const id of rowIds) dirty.current.people.add(id)
        for (const docId of docIds) dirty.current.docs.add(docId)
        throw e
      } finally {
        setSyncing(false)
      }
      const changes = []
      for (const id of ids) for (const docId of Object.keys(next[id] ?? {})) {
        const from = stateOf(prev[id]?.[docId])
        const to = stateOf(next[id][docId])
        if (from && from !== to) changes.push({ personId: id, docId, from, to })
      }
      return changes
    }
    const p = queue.current.then(run, run)
    queue.current = p.catch(() => {})
    return p
  }, [vault])

  // Load the roster once the vault exists, then take the start-of-day picture.
  useEffect(() => {
    if (!vault) return
    let alive = true
    ;(async () => {
      if (api()?.gcapPeople) {
        // Every visit starts the day fresh: an earlier visit may have left edits in the platform.
        await api().gcapResetPeople()
        await restore('*')
        const { people: list, vocab: v } = await api().gcapPeople()
        if (!alive) return
        commitRaw(list)
        setVocab(v)
      }
      await sync()
      if (alive && !baseline.current && !touched.current.people.size && !touched.current.docs.size) {
        baseline.current = snapshot(cellsRef.current)
      }
    })().catch(() => {})
    return () => { alive = false }
  }, [vault, sync])

  // An edit made anywhere re-asks the key server. Scripted events and reset sync for themselves, so
  // they hold this off: a second sync racing them would take the dirty set and hide what moved.
  useEffect(() => {
    if (!vault || epoch === 0 || hold.current) return
    sync().catch(() => {})
  }, [epoch, vault, sync])

  const held = async (fn) => {
    hold.current++
    try { return await fn() } finally { hold.current-- }
  }

  // ── Mutations ──────────────────────────────────────────────────────────────

  const editPerson = async (id, grants) => {
    const res = await api().gcapSetPerson(id, cleanGrants(grants))
    commitRaw(res.people)
    mark(id)
    bump()
    return res
  }

  const addPerson = async (spec) => {
    const res = await api().gcapAddPerson({ ...spec, grants: cleanGrants(spec.grants ?? {}) })
    commitRaw(res.people)
    bump()
    return res.id
  }

  const removePerson = async (id) => {
    const res = await api().gcapRemovePerson(id)
    commitRaw(res.people)
    setRevokedIds(s => { const n = new Set(s); n.delete(id); return n })
    bump()
    return res
  }

  const revokeAccount = async (id) => {
    await revoke(id)
    setRevokedIds(s => new Set(s).add(id))
    mark(id)
    bump()
  }

  const restoreAccount = async (id) => {
    await restore(id)
    setRevokedIds(s => { const n = new Set(s); n.delete(id); return n })
    mark(id)
    bump()
  }

  const editUnit = async (key, policy) => {
    await reencryptUnit(vault, key, policy)
    mark(null, vault.get(key).unit.doc.id)
    setReencrypted(n => n + 1)
    bump()
  }

  const restoreUnit = (key) => {
    const entry = vault.get(key)
    if (!entry?.original) return
    vault.set(key, entry.original)
    mark(null, entry.unit.doc.id)
    bump()
  }

  /** One scripted event: change the platform, re-ask, and report what the KAS answered differently. */
  const applyEvent = (ev) => held(async () => {
    const person = byId[ev.person]
    let diff
    if (ev.change.kind === 'revoke') {
      await revokeAccount(ev.person)
      diff = { account: { from: 'active', to: 'disabled' } }
    } else {
      const grants = cleanGrants(ev.change.apply(person.grants))
      await editPerson(ev.person, grants)
      diff = { attributes: diffGrants(person.grants, grants) }
    }
    const changes = await sync()
    return { changes, diff, person }
  })

  /** Start of day: everybody on their canonical grants, every account restored, every policy original. */
  const resetAll = () => held(async () => {
    if (api()?.gcapResetPeople) {
      const res = await api().gcapResetPeople()
      commitRaw(res.people)
    }
    await restore('*')
    restoreUnits(vault)
    setRevokedIds(new Set())
    for (const id of touched.current.people) dirty.current.people.add(id)
    for (const d of touched.current.docs) dirty.current.docs.add(d)
    touched.current = freshDirty()
    setReencrypted(0)
    bump()
    return sync()
  })

  const decisionsChanged = useMemo(() => {
    if (!baseline.current) return 0
    let n = 0
    for (const [id, row] of Object.entries(cells)) for (const [docId, r] of Object.entries(row)) {
      const was = baseline.current[id]?.[docId]
      if (was && was !== stateOf(r)) n++
    }
    return n
  }, [cells])

  return {
    live, people, byId, vocab, epoch, revokedIds, cells, syncing, sync, reencrypted, decisionsChanged,
    editPerson, addPerson, removePerson, revokeAccount, restoreAccount, editUnit, restoreUnit, applyEvent, resetAll,
  }
}
