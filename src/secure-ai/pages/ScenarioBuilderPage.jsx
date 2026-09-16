/**
 * Building a scenario.
 *
 * The four shipped modes are source files. This is the same thing, typed in — vocabulary, people,
 * agents, documents, teaching points — and once saved it is indistinguishable downstream: the
 * platform gets the attribute definitions, the issuer gets the identities, `encryptCorpus`
 * encrypts its documents against the same KAS, and retrieval asks the platform twice for it
 * exactly as it does for DoW. A scenario that took a shortcut would demonstrate nothing.
 *
 * Two things the form is deliberate about:
 *
 *   Subject ids are derived from the name and prefixed with the scenario's id, never typed. Two
 *   scenarios that both invented a `chen` would otherwise share one set of subject mappings on the
 *   platform, and the second one saved would quietly change what the first one does.
 *
 *   Validation is not implemented here. `electron/scenarios.js` owns the rules because it is what
 *   the seeder trusts, and a second copy in the renderer would eventually disagree with it. This
 *   page asks the main process and renders the sentences it gets back.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import PersonaIcon, { ICON_KEYS } from '../components/PersonaIcon.jsx'
import { field, Label, Notice, AttributePicker } from '../components/ui.jsx'
import { NS } from '../modes/vocab.js'
import { AI_ROOT, aiPath } from '../routes.js'

const ANY_OF    = 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF'
const HIERARCHY = 'ATTRIBUTE_RULE_TYPE_ENUM_HIERARCHY'

const ACCENTS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#64748b']

const emptyScenario = (id) => ({
  id,
  name: '',
  short: '',
  tagline: '',
  icon: 'public',
  accent: ACCENTS[0],
  premise: '',
  vocabulary: [],
  personas: [],
  agents: [],
  documents: [],
  teaches: [],
  prompts: [],
  defaultPersonaId: null,
  defaultAgentId: null,
})

/** A stable, readable id from a display name — `Dr. Amara Chen` → `sc-1a2b3c4d-amara-chen`. */
function subjectId(scenarioId, name, taken) {
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'subject'
  let candidate = `${scenarioId}-${slug}`
  let n = 2
  while (taken.has(candidate)) candidate = `${scenarioId}-${slug}-${n++}`
  return candidate
}

const docId = (label, taken) => {
  const slug = String(label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'document'
  let candidate = slug
  let n = 2
  while (taken.has(candidate)) candidate = `${slug}-${n++}`
  return candidate
}

const csv = (s) => String(s).split(',').map(x => x.trim()).filter(Boolean)

// ── Small building blocks ─────────────────────────────────────────────────────

function Section({ title, hint, children, right }) {
  return (
    <div className="card" style={{ padding: '15px 18px 18px', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 12 }}>
        <span className="section-label">{title}</span>
        {hint && (
          <span style={{ fontSize: 10.5, color: 'var(--c-text-6)', lineHeight: 1.6, flex: 1 }}>{hint}</span>
        )}
        {right}
      </div>
      {children}
    </div>
  )
}

function AddButton({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      fontSize: 11, fontWeight: 600, padding: '5px 11px', borderRadius: 6, cursor: 'pointer',
      background: 'var(--c-surface-2)', border: '1px solid var(--c-border)', color: 'var(--c-text-3)',
      flexShrink: 0, whiteSpace: 'nowrap',
    }}>{children}</button>
  )
}

function RemoveButton({ onClick, title = 'Remove' }) {
  return (
    <button onClick={onClick} title={title} style={{
      fontSize: 11, lineHeight: 1, padding: '4px 7px', borderRadius: 5, cursor: 'pointer',
      background: 'transparent', border: '1px solid var(--c-border)', color: 'var(--c-text-6)',
      flexShrink: 0,
    }}>✕</button>
  )
}

/** A bordered row that a list item lives inside. */
const rowCard = {
  border: '1px solid var(--c-border)', borderRadius: 9, padding: '12px 13px',
  background: 'var(--c-surface-2)',
}

function IconPicker({ value, onChange, accent }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: 3, maxHeight: 74, overflowY: 'auto',
      border: '1px solid var(--c-border)', borderRadius: 6, padding: 5, background: 'var(--c-surface-2)',
    }}>
      {ICON_KEYS.map(k => (
        <button key={k} onClick={() => onChange(k)} title={k} style={{
          display: 'flex', padding: 4, borderRadius: 5, cursor: 'pointer',
          background: value === k ? 'var(--c-surface)' : 'transparent',
          border: `1px solid ${value === k ? accent : 'transparent'}`,
          color: value === k ? accent : 'var(--c-text-5)',
        }}>
          <PersonaIcon icon={k} size={16} />
        </button>
      ))}
    </div>
  )
}

// ── Vocabulary ────────────────────────────────────────────────────────────────

function VocabularyRow({ def, onChange, onRemove }) {
  const hierarchy = def.rule === HIERARCHY
  return (
    <div style={rowCard}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', marginBottom: 9 }}>
        <div style={{ width: 170 }}>
          <Label>Attribute name</Label>
          <input
            className="mono" style={field} value={def.name} placeholder="programme"
            onChange={e => onChange({ ...def, name: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '') })}
          />
        </div>
        <div style={{ width: 210 }}>
          <Label>Rule</Label>
          <select style={field} value={def.rule} onChange={e => onChange({ ...def, rule: e.target.value })}>
            <option value={ANY_OF}>ANY_OF — held or not held</option>
            <option value={HIERARCHY}>HIERARCHY — values rank</option>
          </select>
        </div>
        <div style={{ flex: 1 }} />
        <RemoveButton onClick={onRemove} />
      </div>

      <Label hint={hierarchy ? 'highest first — a holder gets this level and everything below it' : 'comma separated'}>
        Values
      </Label>
      <input
        className="mono" style={field}
        value={(def.values ?? []).join(', ')}
        placeholder={hierarchy ? 'restricted, internal, public' : 'orion, cassini, vela'}
        onChange={e => onChange({
          ...def,
          values: csv(e.target.value.toLowerCase()).map(v => v.replace(/[^a-z0-9._-]/g, '')),
        })}
      />

      <input
        style={{ ...field, marginTop: 7 }} value={def.detail ?? ''}
        placeholder="What this attribute means — shown on the How It Works page (optional)"
        onChange={e => onChange({ ...def, detail: e.target.value })}
      />
    </div>
  )
}

// ── Personas and agents ───────────────────────────────────────────────────────

/**
 * One subject. Grants are collected as FQNs through the same picker a document policy uses, then
 * folded back into the `{ attribute: [values] }` shape the issuer and the seeder read.
 */
function SubjectRow({ subject, vocab, accent, onChange, onRemove, kind }) {
  const selected = useMemo(() => {
    const out = []
    for (const [attr, value] of Object.entries(subject.grants ?? {})) {
      for (const v of [].concat(value)) out.push(`${NS}/${attr}/value/${v}`)
    }
    return out
  }, [subject.grants])

  const setSelected = (fqns) => {
    const grants = {}
    for (const f of fqns) {
      const m = f.match(/\/attr\/([^/]+)\/value\/(.+)$/)
      if (!m) continue
      grants[m[1]] = [...(grants[m[1]] ?? []), m[2]]
    }
    onChange({ ...subject, grants })
  }

  return (
    <div style={rowCard}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ display: 'flex', gap: 9 }}>
            <div style={{ flex: 1 }}>
              <Label>Name</Label>
              <input
                style={field} value={subject.name}
                placeholder={kind === 'agent' ? 'Programme Assistant' : 'Dr. Amara Chen'}
                onChange={e => onChange({ ...subject, name: e.target.value })}
              />
            </div>
            <div style={{ flex: 1 }}>
              <Label>Title</Label>
              <input
                style={field} value={subject.title ?? ''}
                placeholder={kind === 'agent' ? 'programme:orion · internal' : 'Programme Lead, Orion'}
                onChange={e => onChange({ ...subject, title: e.target.value })}
              />
            </div>
          </div>
          <div>
            <Label hint="what this one is here to show">Note</Label>
            <input
              style={field} value={subject.note ?? ''}
              onChange={e => onChange({ ...subject, note: e.target.value })}
            />
          </div>
        </div>

        <div style={{ width: 150 }}>
          <Label>Icon</Label>
          <IconPicker value={subject.icon} accent={accent} onChange={icon => onChange({ ...subject, icon })} />
          <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
            {ACCENTS.map(c => (
              <button key={c} onClick={() => onChange({ ...subject, color: c })} title={c} style={{
                width: 15, height: 15, borderRadius: 4, cursor: 'pointer', background: c,
                border: `2px solid ${subject.color === c ? 'var(--c-text-3)' : 'transparent'}`,
              }} />
            ))}
          </div>
        </div>

        <RemoveButton onClick={onRemove} />
      </div>

      <div style={{ marginTop: 11, paddingTop: 10, borderTop: '1px solid var(--c-border)' }}>
        <Label hint="what the platform will resolve this identity to">Holds</Label>
        <AttributePicker vocab={vocab} selected={selected} onChange={setSelected} footer={false} />
        {selected.length === 0 && (
          <div style={{ fontSize: 10, color: 'var(--c-warn)', marginTop: 7 }}>
            Holds nothing. They will authenticate and be refused everything with a real policy —
            a fine thing to show on purpose, and a mistake otherwise.
          </div>
        )}
      </div>
      <div className="mono" style={{ fontSize: 9, color: 'var(--c-text-6)', marginTop: 8 }}>
        {subject.id}
      </div>
    </div>
  )
}

// ── Documents ─────────────────────────────────────────────────────────────────

function TierRow({ tier, vocab, onChange, onRemove }) {
  return (
    <div style={{ ...rowCard, background: 'var(--c-surface)' }}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', marginBottom: 8 }}>
        <div style={{ flex: 1 }}>
          <Label>Tier label</Label>
          <input style={field} value={tier.label} placeholder="Full record"
            onChange={e => onChange({ ...tier, label: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <Label>Classification line</Label>
          <input style={field} value={tier.classification ?? ''} placeholder="RESTRICTED"
            onChange={e => onChange({ ...tier, classification: e.target.value })} />
        </div>
        <RemoveButton onClick={onRemove} />
      </div>
      <Label>Text</Label>
      <textarea
        style={{ ...field, minHeight: 90, resize: 'vertical', lineHeight: 1.6 }}
        value={tier.text ?? ''} onChange={e => onChange({ ...tier, text: e.target.value })}
      />
      <div style={{ marginTop: 9 }}>
        <Label>Policy</Label>
        <AttributePicker vocab={vocab} selected={tier.policy ?? []}
          onChange={policy => onChange({ ...tier, policy })} />
      </div>
      <div style={{ marginTop: 8 }}>
        <Label hint="one line, shown next to the policy">Why this policy</Label>
        <input style={field} value={tier.policyNote ?? ''}
          onChange={e => onChange({ ...tier, policyNote: e.target.value })} />
      </div>
    </div>
  )
}

function DocumentRow({ doc, vocab, onChange, onRemove }) {
  const tiered = Array.isArray(doc.tiers)

  /**
   * Turning a plain document into a tiered one keeps its text as the first tier, so the work
   * already typed in is not thrown away by a toggle.
   */
  const toggleTiers = () => {
    if (tiered) {
      const first = doc.tiers[0] ?? {}
      const { tiers, ...rest } = doc
      onChange({ ...rest, text: first.text ?? '', policy: first.policy ?? [], policyNote: first.policyNote ?? '' })
    } else {
      const { text, policy, policyNote, ...rest } = doc
      onChange({
        ...rest,
        tiers: [
          { id: 'full', label: 'Full record', classification: doc.classification ?? '', text: text ?? '', policy: policy ?? [], policyNote: policyNote ?? '' },
          { id: 'summary', label: 'Summary', classification: '', text: '', policy: [], policyNote: '' },
        ],
      })
    }
  }

  const setTier = (i, t) => onChange({ ...doc, tiers: doc.tiers.map((x, j) => (j === i ? t : x)) })

  return (
    <div style={rowCard}>
      <div style={{ display: 'flex', gap: 9, alignItems: 'flex-end', marginBottom: 9 }}>
        <div style={{ flex: 1 }}>
          <Label>Label</Label>
          <input style={field} value={doc.label} placeholder="Orion Programme Review"
            onChange={e => onChange({ ...doc, label: e.target.value })} />
        </div>
        <div style={{ flex: 1 }}>
          <Label>Classification line</Label>
          <input style={field} value={doc.classification ?? ''} placeholder="RESTRICTED // ORION"
            onChange={e => onChange({ ...doc, classification: e.target.value })} />
        </div>
        <RemoveButton onClick={onRemove} />
      </div>

      <Label hint="comma separated — this is how a question finds the document">Keywords</Label>
      <input
        style={field} value={(doc.keywords ?? []).join(', ')} placeholder="orion, programme review, milestone"
        onChange={e => onChange({ ...doc, keywords: csv(e.target.value) })}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '11px 0 9px' }}>
        <span className="section-label">{tiered ? 'Tiers' : 'Content'}</span>
        <span style={{ fontSize: 10, color: 'var(--c-text-6)', flex: 1, lineHeight: 1.6 }}>
          {tiered
            ? 'Each tier is its own TDF under its own policy. The same question returns whichever tier the caller can open.'
            : 'One policy, one TDF.'}
        </span>
        <AddButton onClick={toggleTiers}>{tiered ? 'Make single' : 'Split into tiers'}</AddButton>
      </div>

      {tiered ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {doc.tiers.map((t, i) => (
            <TierRow
              key={t.id ?? i} tier={t} vocab={vocab}
              onChange={next => setTier(i, next)}
              onRemove={() => onChange({ ...doc, tiers: doc.tiers.filter((_, j) => j !== i) })}
            />
          ))}
          <AddButton onClick={() => onChange({
            ...doc,
            tiers: [...doc.tiers, { id: `tier-${doc.tiers.length + 1}`, label: '', classification: '', text: '', policy: [], policyNote: '' }],
          })}>+ Tier</AddButton>
        </div>
      ) : (
        <>
          <textarea
            style={{ ...field, minHeight: 110, resize: 'vertical', lineHeight: 1.6 }}
            value={doc.text ?? ''} placeholder="The document itself. This is what gets encrypted."
            onChange={e => onChange({ ...doc, text: e.target.value })}
          />
          <div style={{ marginTop: 10 }}>
            <Label>Policy</Label>
            <AttributePicker vocab={vocab} selected={doc.policy ?? []}
              onChange={policy => onChange({ ...doc, policy })} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Label hint="one line, shown next to the policy">Why this policy</Label>
            <input style={field} value={doc.policyNote ?? ''}
              onChange={e => onChange({ ...doc, policyNote: e.target.value })} />
          </div>
        </>
      )}
    </div>
  )
}

// ── The page ──────────────────────────────────────────────────────────────────

export default function ScenarioBuilderPage() {
  const { scenarioId } = useParams()
  const navigate = useNavigate()
  const {
    scenarios, scenariosLoaded, saveScenario, deleteScenario, exportScenario, importScenario,
    platformPhase,
  } = useApp()

  const [draft, setDraft] = useState(null)
  const [builtins, setBuiltins] = useState(null)  // { namespace, defs } — the shipped vocabulary
  const [problems, setProblems] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(null)

  const set = useCallback((patch) => setDraft(d => ({ ...d, ...patch })), [])

  // The shipped vocabulary, so a scenario can grant `clearance:secret` without redefining it.
  useEffect(() => {
    window.electronAPI?.getAttributeDefs?.().then(setBuiltins).catch(() => setBuiltins(null))
  }, [])

  // Editing an existing scenario, or starting a new one with an id the main process minted.
  useEffect(() => {
    if (draft) return
    if (scenarioId) {
      if (!scenariosLoaded) return
      const found = scenarios.find(s => s.id === scenarioId)
      if (found) setDraft(structuredClone(found))
      else navigate(aiPath('build'), { replace: true })
      return
    }
    window.electronAPI?.newScenarioId?.()
      .then(id => setDraft(emptyScenario(id)))
      .catch(() => setDraft(emptyScenario(`sc-${Math.abs(Date.now() % 100000000).toString(16)}`)))
  }, [scenarioId, scenarios, scenariosLoaded, draft, navigate])

  /**
   * What the pickers offer: the shipped vocabulary plus whatever this scenario has invented so far.
   * A definition whose name collides with a shipped one is dropped from the *offer* — the platform
   * keeps its original rule, so the scenario's version of it is not what would be enforced.
   */
  const vocab = useMemo(() => {
    const shipped = builtins?.defs ?? []
    const shippedNames = new Set(shipped.map(d => d.name))
    const own = (draft?.vocabulary ?? [])
      .filter(d => d.name && !shippedNames.has(d.name) && (d.values ?? []).length)
      .map(d => ({ name: d.name, values: d.values, hierarchy: d.rule === HIERARCHY }))
    return { namespace: builtins?.namespace ?? NS, defs: [...own, ...shipped] }
  }, [builtins, draft?.vocabulary])

  const save = useCallback(async () => {
    setBusy(true); setError(null); setProblems([]); setSaved(null)
    try {
      const found = await window.electronAPI.validateScenario(draft)
      if (found.length) { setProblems(found); return }
      const stored = await saveScenario(draft)
      setDraft(structuredClone(stored))
      setSaved(stored)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [draft, saveScenario])

  if (!draft) return null

  const accent = draft.accent || ACCENTS[0]
  const takenSubjects = new Set([...(draft.personas ?? []), ...(draft.agents ?? [])].map(s => s.id))
  const takenDocs = new Set((draft.documents ?? []).map(d => d.id))
  const isSaved = scenarios.some(s => s.id === draft.id)

  const addSubject = (kind) => {
    const list = kind === 'agent' ? draft.agents : draft.personas
    const next = {
      id: subjectId(draft.id, `${kind}-${list.length + 1}`, takenSubjects),
      name: '', title: '', icon: kind === 'agent' ? 'agent' : 'analyst',
      color: ACCENTS[list.length % ACCENTS.length], note: '', grants: {},
    }
    set(kind === 'agent' ? { agents: [...draft.agents, next] } : { personas: [...draft.personas, next] })
  }

  // Ids are minted from the display name, but only while the name is still being typed for the
  // first time. Renaming a saved subject keeps its id, because the platform already holds subject
  // mappings against it and a rename is not meant to revoke anything.
  const setSubject = (kind, i, next) => {
    const list = kind === 'agent' ? draft.agents : draft.personas
    const prev = list[i]
    const stillDefault = /-(persona|agent)-\d+(-\d+)?$/.test(prev.id)
    const withId = stillDefault && next.name.trim() && next.name !== prev.name
      ? { ...next, id: subjectId(draft.id, next.name, new Set([...takenSubjects].filter(x => x !== prev.id))) }
      : next
    const updated = list.map((x, j) => (j === i ? withId : x))
    const patch = kind === 'agent' ? { agents: updated } : { personas: updated }
    // Keep the default pointer following a re-id, or saving would fail on a dangling reference.
    if (kind === 'agent' && draft.defaultAgentId === prev.id) patch.defaultAgentId = withId.id
    if (kind === 'persona' && draft.defaultPersonaId === prev.id) patch.defaultPersonaId = withId.id
    set(patch)
  }

  const removeSubject = (kind, i) => {
    const list = kind === 'agent' ? draft.agents : draft.personas
    const gone = list[i]
    const updated = list.filter((_, j) => j !== i)
    const patch = kind === 'agent' ? { agents: updated } : { personas: updated }
    if (kind === 'agent' && draft.defaultAgentId === gone.id) patch.defaultAgentId = updated[0]?.id ?? null
    if (kind === 'persona' && draft.defaultPersonaId === gone.id) patch.defaultPersonaId = updated[0]?.id ?? null
    set(patch)
  }

  const listOf = (key) => draft[key] ?? []
  const setAt = (key, i, next) => set({ [key]: listOf(key).map((x, j) => (j === i ? next : x)) })
  const removeAt = (key, i) => set({ [key]: listOf(key).filter((_, j) => j !== i) })

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--c-bg)' }}>
      <div style={{ maxWidth: 940, margin: '0 auto', padding: '10px 32px 60px' }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div style={{ flex: 1 }}>
            <button onClick={() => navigate(AI_ROOT)} style={{
              fontSize: 11, fontWeight: 600, padding: 0, marginBottom: 8, cursor: 'pointer',
              background: 'none', border: 'none', color: 'var(--c-text-5)',
            }}>← All scenarios</button>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--c-text-1)', margin: 0 }}>
              {isSaved ? 'Edit scenario' : 'Build a scenario'}
            </h1>
            <p style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--c-text-4)', margin: '8px 0 0', maxWidth: 700 }}>
              Attributes in a customer's own vocabulary, the people who hold them, the agents acting
              for those people, and documents to put under policy. Saving seeds the attribute
              definitions into the running platform and encrypts the corpus — after that it behaves
              exactly like the four scenarios that ship with the app, because it goes through the
              same code.
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 26 }}>
            <AddButton onClick={async () => {
              setError(null)
              try {
                const stored = await importScenario()
                if (stored) {
                  setDraft(structuredClone(stored))
                  navigate(aiPath('build', stored.id), { replace: true })
                }
              } catch (err) { setError(err.message) }
            }}>Import a bundle…</AddButton>
            {isSaved && (
              <AddButton onClick={() => exportScenario(draft).catch(err => setError(err.message))}>
                Export…
              </AddButton>
            )}
          </div>
        </div>

        {platformPhase !== 'ready' && (
          <div style={{ marginBottom: 14 }}>
            <Notice>
              The platform is still starting. You can build the whole scenario now — saving is what
              needs it, because that is when the attribute definitions are created.
            </Notice>
          </div>
        )}

        {/* ── Identity ───────────────────────────────────────────────────── */}
        <Section title="SCENARIO" hint="how it appears on the launcher">
          <div style={{ display: 'flex', gap: 10, marginBottom: 9 }}>
            <div style={{ flex: 2 }}>
              <Label>Name</Label>
              <input style={field} value={draft.name} placeholder="Orion Programme (Acme Aerospace)"
                onChange={e => set({ name: e.target.value })} />
            </div>
            <div style={{ flex: 1 }}>
              <Label hint="for the tab bar">Short name</Label>
              <input style={field} value={draft.short ?? ''} placeholder="Orion"
                onChange={e => set({ short: e.target.value })} />
            </div>
          </div>

          <div style={{ marginBottom: 9 }}>
            <Label>Tagline</Label>
            <input style={field} value={draft.tagline ?? ''} placeholder="Programme compartments and supplier access"
              onChange={e => set({ tagline: e.target.value })} />
          </div>

          <div style={{ marginBottom: 11 }}>
            <Label hint="the paragraph on the launcher card">Premise</Label>
            <textarea
              style={{ ...field, minHeight: 66, resize: 'vertical', lineHeight: 1.6 }}
              value={draft.premise ?? ''} onChange={e => set({ premise: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
            <div style={{ width: 300 }}>
              <Label>Icon</Label>
              <IconPicker value={draft.icon} accent={accent} onChange={icon => set({ icon })} />
            </div>
            <div>
              <Label>Accent</Label>
              <div style={{ display: 'flex', gap: 5 }}>
                {ACCENTS.map(c => (
                  <button key={c} onClick={() => set({ accent: c })} title={c} style={{
                    width: 22, height: 22, borderRadius: 6, cursor: 'pointer', background: c,
                    border: `2px solid ${accent === c ? 'var(--c-text-3)' : 'transparent'}`,
                  }} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        {/* ── Vocabulary ─────────────────────────────────────────────────── */}
        <Section
          title="VOCABULARY"
          hint="New attribute definitions, created on the platform when you save. Separate definitions AND together; values inside one follow its rule. The shipped attributes stay available, so you only define what is missing."
          right={<AddButton onClick={() => set({
            vocabulary: [...listOf('vocabulary'), { name: '', rule: ANY_OF, values: [], detail: '' }],
          })}>+ Attribute</AddButton>}
        >
          {listOf('vocabulary').length === 0 ? (
            <div style={{ fontSize: 11.5, color: 'var(--c-text-6)', lineHeight: 1.65 }}>
              None yet. A scenario can also be built entirely out of the attributes already on the
              platform — clearance, mission, CUI categories, compartments, case access.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {listOf('vocabulary').map((d, i) => (
                <VocabularyRow
                  key={i} def={d}
                  onChange={next => setAt('vocabulary', i, next)}
                  onRemove={() => removeAt('vocabulary', i)}
                />
              ))}
            </div>
          )}
        </Section>

        {/* ── Personas ───────────────────────────────────────────────────── */}
        <Section
          title="PEOPLE"
          hint="Each one gets a signed token and subject mappings, exactly like a shipped persona."
          right={<AddButton onClick={() => addSubject('persona')}>+ Person</AddButton>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {listOf('personas').map((p, i) => (
              <SubjectRow
                key={p.id} subject={p} vocab={vocab} accent={accent} kind="persona"
                onChange={next => setSubject('persona', i, next)}
                onRemove={() => removeSubject('persona', i)}
              />
            ))}
            {listOf('personas').length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--c-text-6)' }}>
                At least one person is required — there is nobody to ask a question otherwise.
              </div>
            )}
          </div>
        </Section>

        {/* ── Agents ─────────────────────────────────────────────────────── */}
        <Section
          title="AGENTS"
          hint="An agent is an identity with attributes, and the KAS cannot tell it from a person. Access needs both the person and the agent to clear, so an agent's grants are a ceiling on what anyone can pull through it — the useful case is an agent held deliberately narrower than the people using it."
          right={<AddButton onClick={() => addSubject('agent')}>+ Agent</AddButton>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {listOf('agents').map((a, i) => (
              <SubjectRow
                key={a.id} subject={a} vocab={vocab} accent={accent} kind="agent"
                onChange={next => setSubject('agent', i, next)}
                onRemove={() => removeSubject('agent', i)}
              />
            ))}
            {listOf('agents').length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--c-text-6)', lineHeight: 1.65 }}>
                None yet. With no agent, retrieval falls back to asking as the person alone — which
                works, and skips the point the app is otherwise making.
              </div>
            )}
          </div>
        </Section>

        {/* ── Starting state ─────────────────────────────────────────────── */}
        {(listOf('personas').length > 0 || listOf('agents').length > 0) && (
          <Section title="STARTS AS" hint="who is selected when the scenario opens">
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Label>Person</Label>
                <select style={field} value={draft.defaultPersonaId ?? ''}
                  onChange={e => set({ defaultPersonaId: e.target.value || null })}>
                  <option value="">— first in the list —</option>
                  {listOf('personas').map(p => <option key={p.id} value={p.id}>{p.name || p.id}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <Label>Agent</Label>
                <select style={field} value={draft.defaultAgentId ?? ''}
                  onChange={e => set({ defaultAgentId: e.target.value || null })}>
                  <option value="">— first in the list —</option>
                  {listOf('agents').map(a => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
                </select>
              </div>
            </div>
          </Section>
        )}

        {/* ── Documents ──────────────────────────────────────────────────── */}
        <Section
          title="DOCUMENTS"
          hint="Each becomes a real TDF with its policy bound inside it. Text is stored in plain form so the scenario can be exported and re-encrypted on another machine — a TDF's key belongs to the KAS that made it, so ciphertext would not travel."
          right={<AddButton onClick={() => set({
            documents: [...listOf('documents'), {
              id: docId(`document-${listOf('documents').length + 1}`, takenDocs),
              label: '', classification: '', keywords: [], policy: [], policyNote: '', text: '',
            }],
          })}>+ Document</AddButton>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {listOf('documents').map((d, i) => (
              <DocumentRow
                key={d.id} doc={d} vocab={vocab}
                onChange={next => setAt('documents', i, next)}
                onRemove={() => removeAt('documents', i)}
              />
            ))}
            {listOf('documents').length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--c-text-6)' }}>
                At least one document is required.
              </div>
            )}
          </div>
        </Section>

        {/* ── Teaching points ────────────────────────────────────────────── */}
        <Section
          title="WHAT IT TEACHES"
          hint="Shown on the launcher card and the How It Works page."
          right={<AddButton onClick={() => set({ teaches: [...listOf('teaches'), { title: '', detail: '' }] })}>
            + Point
          </AddButton>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            {listOf('teaches').map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <input style={field} value={t.title} placeholder="Two conditions, both required"
                    onChange={e => setAt('teaches', i, { ...t, title: e.target.value })} />
                  <textarea
                    style={{ ...field, minHeight: 48, marginTop: 6, resize: 'vertical', lineHeight: 1.6 }}
                    value={t.detail} placeholder="The detail, in a sentence or two."
                    onChange={e => setAt('teaches', i, { ...t, detail: e.target.value })} />
                </div>
                <RemoveButton onClick={() => removeAt('teaches', i)} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Prompts ────────────────────────────────────────────────────── */}
        <Section
          title="SUGGESTED QUESTIONS"
          hint="The buttons above the chat box. Each should hit a document's keywords."
          right={<AddButton onClick={() => set({ prompts: [...listOf('prompts'), { label: '', text: '' }] })}>
            + Question
          </AddButton>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {listOf('prompts').map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input style={{ ...field, width: 150 }} value={p.label} placeholder="Programme review"
                  onChange={e => setAt('prompts', i, { ...p, label: e.target.value })} />
                <input style={field} value={p.text} placeholder="What did the Orion programme review conclude?"
                  onChange={e => setAt('prompts', i, { ...p, text: e.target.value })} />
                <RemoveButton onClick={() => removeAt('prompts', i)} />
              </div>
            ))}
          </div>
        </Section>

        {/* ── Save ───────────────────────────────────────────────────────── */}
        {problems.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Notice tone="deny">
              <div style={{ fontWeight: 700, marginBottom: 5 }}>
                {problems.length === 1 ? 'One thing to fix' : `${problems.length} things to fix`}
              </div>
              <ul style={{ margin: 0, paddingLeft: 17 }}>
                {problems.map((p, i) => <li key={i} style={{ marginBottom: 2 }}>{p}</li>)}
              </ul>
            </Notice>
          </div>
        )}

        {error && <div style={{ marginBottom: 12 }}><Notice tone="deny">{error}</Notice></div>}

        {saved && (
          <div style={{ marginBottom: 12 }}>
            <Notice tone="grant">
              Saved. {saved.vocabulary?.length ? `${saved.vocabulary.length} attribute definition(s) seeded, ` : ''}
              {saved.personas?.length ?? 0} people and {saved.agents?.length ?? 0} agents are issuable now.
            </Notice>
          </div>
        )}

        <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
          <button onClick={save} disabled={busy} style={{
            fontSize: 12.5, fontWeight: 600, padding: '9px 20px', borderRadius: 8,
            cursor: busy ? 'default' : 'pointer', background: accent, border: 'none', color: '#fff',
            opacity: busy ? 0.6 : 1,
          }}>{busy ? 'Saving…' : isSaved ? 'Save changes' : 'Save and seed'}</button>

          {isSaved && (
            <button onClick={() => navigate(aiPath(draft.id, 'chat'))} style={{
              fontSize: 12.5, fontWeight: 600, padding: '9px 18px', borderRadius: 8, cursor: 'pointer',
              background: 'var(--c-surface)', border: '1px solid var(--c-border)', color: 'var(--c-text-2)',
            }}>Launch it →</button>
          )}

          <div style={{ flex: 1 }} />

          {isSaved && (
            <button
              onClick={async () => {
                setError(null)
                try { await deleteScenario(draft.id); navigate(AI_ROOT) }
                catch (err) { setError(err.message) }
              }}
              style={{
                fontSize: 11.5, fontWeight: 600, padding: '8px 14px', borderRadius: 7, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--c-deny-br)', color: 'var(--c-deny)',
              }}
            >Delete scenario</button>
          )}
        </div>

        <div style={{ fontSize: 10.5, color: 'var(--c-text-6)', marginTop: 12, lineHeight: 1.7 }}>
          Deleting forgets the scenario and stops its identities being issued. The attribute
          definitions it created stay on the platform — removing one that shares a name with a
          shipped attribute would break the mode that depends on it, and an unused definition is
          inert.
        </div>
      </div>
    </div>
  )
}
