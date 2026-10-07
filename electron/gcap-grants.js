/**
 * GCAP · editing what a person is entitled to, for real.
 *
 * The KAS does not read a person's attributes off their token. Entity resolution runs in claims
 * mode and the attributes come from subject mappings written to the platform's policy store, one
 * `.sub IN [persona id]` mapping per attribute value (see `ensureSubjectMappings` in
 * ai-seeder.js). So changing what a person can open means changing those mappings, and this module
 * is the only place that does. Nothing here touches a token: the issuer's grants are kept in step
 * by the caller so the UI's explanation of a verdict reads the same entitlements the KAS resolves.
 *
 * The edit is persistent (it lives in the platform's database), which is why `resetToCanonical`
 * exists and is also run at every launch: a session that ends mid-demo must not leave Priya demoted
 * for the next one.
 *
 * Only the five GCAP vocabularies are editable, and only on `gcap-` subjects.
 */

const { IDENTITIES, ATTRIBUTE_DEFS, NS, NAMESPACE, grantsToFqns } = require('./ai-identities.js')

const PLATFORM_BASE = 'http://localhost:7777'
const SM = 'policy.subjectmapping.SubjectMappingService'

const EDITABLE = ['clearance', 'nationality', 'workpackage', 'supplytier', 'role']
const ADDED_PREFIX = 'gcap-x-'

/** Seeded values per editable vocabulary, so a picker can only offer what the platform created. */
const VOCAB = Object.fromEntries(
  EDITABLE.map(name => [name, ATTRIBUTE_DEFS.find(d => d.name === name).values]),
)

const CANONICAL = Object.fromEntries(
  Object.entries(IDENTITIES)
    .filter(([id]) => id.startsWith('gcap-'))
    .map(([id, p]) => [id, { name: p.name, grants: p.grants }]),
)

/** Clean a grants object down to known attributes and seeded values; throw on anything else. */
function validateGrants(grants) {
  const out = {}
  for (const [name, raw] of Object.entries(grants ?? {})) {
    if (!EDITABLE.includes(name)) throw new Error(`"${name}" is not an editable GCAP attribute`)
    const values = [].concat(raw).filter(v => v !== undefined && v !== null && v !== '')
    if (values.length === 0) continue
    for (const v of values) {
      if (!VOCAB[name].includes(v)) throw new Error(`"${v}" is not a seeded value of ${name}`)
    }
    // clearance is a hierarchy: one floor, not a set
    out[name] = name === 'clearance' ? values[0] : (values.length === 1 ? values[0] : values)
  }
  return out
}

async function rpc(token, service, method, body = {}) {
  const res = await fetch(`${PLATFORM_BASE}/${service}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} failed ${res.status}: ${await res.text()}`)
  return res.json()
}

async function valueIndex(token) {
  const list = await rpc(token, 'policy.attributes.AttributesService', 'ListAttributes', { namespace: NAMESPACE })
  const byFqn = {}
  for (const a of list.attributes ?? []) {
    for (const v of a.values ?? []) if (v.id) byFqn[`${NS}/${a.name}/value/${v.value}`] = v.id
  }
  return byFqn
}

/**
 * `.sub IN [one id]` read-mappings for the subjects `wants` accepts, as sub → (value id → mapping ids).
 * Only mappings shaped exactly like the seeder's are considered; a compound condition means
 * something narrower than "this subject" and is left alone.
 */
async function mappingsFor(token, wants) {
  const out = new Map()
  const LIMIT = 1000
  for (let offset = 0; ; offset += LIMIT) {
    const page = await rpc(token, SM, 'ListSubjectMappings', { pagination: { limit: LIMIT, offset } })
    const items = page.subjectMappings ?? page.subject_mappings ?? []
    for (const m of items) {
      const valueId = (m.attributeValue ?? m.attribute_value)?.id
      if (!valueId || !(m.actions ?? []).some(a => a.name === 'read')) continue
      const set = m.subjectConditionSet ?? m.subject_condition_set
      const sets = set?.subjectSets ?? set?.subject_sets ?? []
      if (sets.length !== 1) continue
      const groups = sets[0].conditionGroups ?? sets[0].condition_groups ?? []
      if (groups.length !== 1 || (groups[0].conditions ?? []).length !== 1) continue
      const c = groups[0].conditions[0]
      if ((c.subjectExternalSelectorValue ?? c.subject_external_selector_value) !== '.sub') continue
      const values = c.subjectExternalValues ?? c.subject_external_values ?? []
      if (values.length !== 1 || !wants(values[0])) continue
      const bySub = out.get(values[0]) ?? new Map()
      bySub.set(valueId, [...(bySub.get(valueId) ?? []), m.id])
      out.set(values[0], bySub)
    }
    const total = Number(page.pagination?.total ?? items.length)
    if (items.length === 0 || offset + items.length >= total) break
  }
  return out
}

/**
 * Make the platform's mappings for `desired` subjects match the given grants exactly.
 * `sweep` additionally removes every mapping for subjects it accepts that are not in `desired`.
 */
async function converge(token, desired, sweep = () => false) {
  const ids = await valueIndex(token)
  const existing = await mappingsFor(token, sub => desired.has(sub) || sweep(sub))
  let created = 0
  let deleted = 0
  const jobs = []

  for (const [sub, bySub] of existing) {
    if (desired.has(sub)) continue
    for (const mappingIds of bySub.values()) {
      for (const id of mappingIds) jobs.push(rpc(token, SM, 'DeleteSubjectMapping', { id }).then(() => { deleted++ }))
    }
  }

  for (const [sub, grants] of desired) {
    const want = new Set()
    for (const fqn of grantsToFqns(grants)) {
      if (!ids[fqn]) throw new Error(`No attribute value on the platform for ${fqn}`)
      want.add(ids[fqn])
    }
    const have = existing.get(sub) ?? new Map()
    for (const [valueId, mappingIds] of have) {
      if (!want.has(valueId)) for (const id of mappingIds) jobs.push(rpc(token, SM, 'DeleteSubjectMapping', { id }).then(() => { deleted++ }))
    }
    for (const valueId of want) {
      if (have.has(valueId)) continue
      jobs.push(rpc(token, SM, 'CreateSubjectMapping', {
        attribute_value_id: valueId,
        actions: [{ name: 'read' }],
        new_subject_condition_set: {
          subject_sets: [{
            condition_groups: [{
              conditions: [{
                subject_external_selector_value: '.sub',
                operator: 'SUBJECT_MAPPING_OPERATOR_ENUM_IN',
                subject_external_values: [sub],
              }],
              boolean_operator: 'CONDITION_BOOLEAN_TYPE_ENUM_AND',
            }],
          }],
        },
      }).then(() => { created++ }))
    }
  }

  await Promise.all(jobs)
  return { created, deleted }
}

const isGcap = (sub) => typeof sub === 'string' && sub.startsWith('gcap-')

/** Set one person's grants. Every other subject is untouched. */
async function applyGrants(token, personaId, grants) {
  if (!isGcap(personaId)) throw new Error(`"${personaId}" is not a GCAP identity`)
  return converge(token, new Map([[personaId, validateGrants(grants)]]))
}

/** Put every shipped GCAP person back on their canonical grants and drop every added one. */
async function resetToCanonical(token) {
  const desired = new Map(Object.entries(CANONICAL).map(([id, p]) => [id, validateGrants(p.grants)]))
  return converge(token, desired, sub => sub.startsWith(ADDED_PREFIX))
}

/**
 * The live roster: who exists right now and what each holds. Shipped people start canonical;
 * free play edits them and adds `gcap-x-` people. Kept here (not the renderer) so a reload of the
 * window cannot disagree with the platform about what the day looks like.
 */
const roster = new Map()
const copy = (g) => JSON.parse(JSON.stringify(g))

function seedRoster() {
  roster.clear()
  for (const [id, p] of Object.entries(CANONICAL)) roster.set(id, { id, name: p.name, grants: copy(p.grants), added: false })
}
seedRoster()

const people = () => [...roster.values()].map(p => ({ ...p, grants: copy(p.grants) }))

/** Platform first, because it is what decides; the issuer's copy only explains the verdict. */
async function setPerson(token, issuer, id, grants) {
  const p = roster.get(id)
  if (!p) throw new Error(`No GCAP person "${id}"`)
  const clean = validateGrants(grants)
  const result = await applyGrants(token, id, clean)
  p.grants = clean
  issuer.setGcapIdentity(id, { name: p.name, grants: clean })
  return { ...result, people: people() }
}

async function addPerson(token, issuer, { name, employer, title, nation, grants }) {
  const label = String(name ?? '').trim().slice(0, 40)
  if (!label) throw new Error('A person needs a name')
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'guest'
  let n = 1
  while (roster.has(`${ADDED_PREFIX}${slug}-${n}`)) n++
  const id = `${ADDED_PREFIX}${slug}-${n}`
  const clean = validateGrants(grants)
  await applyGrants(token, id, clean)
  roster.set(id, { id, name: label, grants: clean, added: true, employer, title, nation })
  issuer.setGcapIdentity(id, { name: label, grants: clean })
  return { id, people: people() }
}

async function removePerson(token, issuer, id) {
  const p = roster.get(id)
  if (!p?.added) throw new Error('Only people added in free play can be removed')
  await converge(token, new Map(), sub => sub === id)
  roster.delete(id)
  issuer.dropGcapIdentity(id)
  return { people: people() }
}

async function reset(token, issuer) {
  const result = await resetToCanonical(token)
  for (const p of roster.values()) if (p.added) issuer.dropGcapIdentity(p.id)
  seedRoster()
  for (const p of roster.values()) issuer.setGcapIdentity(p.id, { name: p.name, grants: p.grants })
  issuer.restoreAllIdentities()
  return { ...result, people: people() }
}

module.exports = {
  EDITABLE, VOCAB, CANONICAL, ADDED_PREFIX,
  validateGrants, applyGrants, resetToCanonical, grantsToFqns,
  people, setPerson, addPerson, removePerson, reset,
}
