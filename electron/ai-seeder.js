/**
 * Seeds the vocabulary and grants the AI Protection page needs, alongside what `electron/seeder.js`
 * already seeds for the rest of the app.
 *
 * Deliberately a *second* seeder rather than an extension of the first. Both write into the same
 * `demo.com` namespace and both are create-or-ignore, so the platform ends up with the union; but
 * they carry separate version markers, which means changing what the AI page needs can never
 * trigger a re-seed of what every other page depends on, and vice versa. The pages that shipped
 * before this one run on byte-identical seed code.
 *
 * The overlap between the two was checked value by value before this file was added:
 *
 *   clearance    identical rule and identical ordering — and it is the only HIERARCHY, so a
 *                different ordering would have quietly changed what existing documents release to
 *   mission      identical
 *   role         a superset here; the four extra values are backfilled onto the existing definition
 *   nationality  a subset here; nothing is created
 *   relto        not used here at all
 *
 * Everything else below (`needtoknow`, `coi`, `agency`, `cui`, `sci`, `dissem`, `cjis`,
 * `caseaccess`, `jurisdiction`, `discipline`) is a name the platform has never seen. No definition
 * is redefined under a different rule and no hierarchy is reordered, which is what makes adding
 * this safe to an install that already has documents encrypted under the older vocabulary.
 *
 * Entity resolution runs in `claims` mode, so the JWT itself is the entity object.
 * Subject mappings are what turn that object into attribute values the KAS can
 * compare against a document's policy — the `.sub` selector matches persona ids.
 *
 * The vocabulary and the grants both come from `electron/ai-identities.js`, which all four AI modes
 * share. One namespace, one set of definitions, one set of mappings: the modes differ only in which
 * attributes their documents name.
 */

const fs = require('fs')
const path = require('path')

const {
  NAMESPACE, NS, ATTRIBUTE_DEFS, IDENTITIES, BUILTIN_DEFS_BY_NAME, grantsToFqns,
} = require('./ai-identities.js')

const PLATFORM_BASE = 'http://localhost:7777'

/**
 * Bump when the AI page's seed data changes — triggers a re-seed on existing installs.
 *
 * Its own counter, tracked in its own marker file (`seeded-ai.txt`), independent of the `'9'` in
 * `electron/seeder.js`. Starting at 1 because no released build has ever run this seeder: every
 * install picking up this version is seeing the AI vocabulary for the first time, whatever else
 * it already has.
 *
 * Re-seeding is additive — nothing is ever deleted. A grant that stops being correct is removed
 * from `ai-identities.js`, which stops the *token* from carrying it, and the leftover mapping goes
 * inert because nothing selects it any more. That asymmetry is deliberate: deleting mappings is the
 * only destructive operation available here, and a definition name shared with another page
 * (`clearance`, `mission`, `role`) would take that page down with it.
 *
 * A bump matters most for identities. Adding a persona without bumping leaves them able to
 * authenticate and entitled to nothing — every document withheld, with a trace that blames the
 * persona for holding no attributes rather than the seeder for never having written them.
 */
const SEED_VERSION = '1'

async function rpc(token, service, method, body = {}) {
  const res = await fetch(`${PLATFORM_BASE}/${service}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(`${method} failed ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

function isAlreadyExists(err) {
  const m = err.message
  return m.includes('already_exists') || m.includes('already exists') ||
         m.includes('AlreadyExists') || m.includes('409') || m.includes('unique')
}

async function ensureNamespace(token) {
  try {
    const r = await rpc(token, 'policy.namespaces.NamespaceService', 'CreateNamespace', { name: NAMESPACE })
    console.log(`[ai-seeder] Created namespace ${NAMESPACE}:`, r.namespace?.id)
    return r.namespace?.id
  } catch (e) {
    if (!isAlreadyExists(e)) throw e
    const r = await rpc(token, 'policy.namespaces.NamespaceService', 'ListNamespaces', {})
    const id = r.namespaces?.find(n => n.name === NAMESPACE)?.id
    console.log('[ai-seeder] Namespace already exists:', id)
    return id
  }
}

/**
 * Creates every attribute + value, returning a map of value FQN → value UUID.
 *
 * `defs` is a parameter so a user-built scenario can seed its own vocabulary through this exact
 * function rather than a parallel one. Everything here is already idempotent — create, fall back
 * to list on already-exists, backfill missing values — which is what makes it safe to call again
 * at runtime against a platform that has been seeded several times already.
 */
async function ensureAttributes(token, nsId, defs = ATTRIBUTE_DEFS) {
  const valueIdByFqn = {}

  for (const def of defs) {
    let attrId = null
    let attrValues = []

    try {
      const r = await rpc(token, 'policy.attributes.AttributesService', 'CreateAttribute', {
        namespace_id: nsId,
        name: def.name,
        rule: def.rule,
        values: def.values, // repeated string per the proto
      })
      attrId = r.attribute?.id
      attrValues = r.attribute?.values ?? []
      console.log('[ai-seeder] Created attribute:', def.name, attrId)
    } catch (e) {
      if (!isAlreadyExists(e)) {
        console.warn('[ai-seeder] Attribute warning:', def.name, e.message)
        continue
      }
      const list = await rpc(token, 'policy.attributes.AttributesService', 'ListAttributes', { namespace: NAMESPACE })
      const existing = list.attributes?.find(a => a.name === def.name)
      if (existing) {
        attrId = existing.id
        attrValues = existing.values ?? []
        console.log('[ai-seeder] Attribute already exists:', def.name, attrId)
      }
    }

    if (!attrId) continue

    // Backfill any values missing from an attribute created by an earlier seed version
    const have = new Set(attrValues.map(v => v.value))
    for (const value of def.values) {
      if (have.has(value)) continue
      try {
        const r = await rpc(token, 'policy.attributes.AttributesService', 'CreateAttributeValue', {
          attribute_id: attrId,
          value,
        })
        if (r.value) {
          attrValues.push(r.value)
          console.log('[ai-seeder] Created missing value:', `${def.name}/${value}`)
        }
      } catch (e) {
        if (!isAlreadyExists(e)) console.warn('[ai-seeder] Value warning:', def.name, value, e.message)
      }
    }

    for (const v of attrValues) {
      if (!v.id) continue
      if (v.fqn) valueIdByFqn[v.fqn] = v.id
      if (v.value) valueIdByFqn[`${NS}/${def.name}/value/${v.value}`] = v.id
    }
  }

  return valueIdByFqn
}

/**
 * Every (attribute value, subject id) pair the platform already maps for `read`.
 *
 * `CreateSubjectMapping` does not deduplicate: asking twice for the same value, the same subject
 * and the same action creates a *second* mapping rather than failing with already-exists. No
 * decision changes because of a duplicate — both mappings say the same thing — but scenarios are
 * re-seeded on every launch, so without this the table would grow by one row per grant per launch
 * for as long as the app is installed. One extra request replaces that.
 *
 * Only mappings shaped exactly like the ones written below are indexed: one subject set, one
 * condition group, one `.sub IN [id]` condition. A compound condition set means something narrower
 * than "this subject", so treating it as a match could skip a mapping that genuinely needs writing.
 */
async function existingMappingKeys(token) {
  const have = new Set()
  const LIMIT = 1000

  for (let offset = 0; ; offset += LIMIT) {
    const page = await rpc(token, 'policy.subjectmapping.SubjectMappingService', 'ListSubjectMappings',
      { pagination: { limit: LIMIT, offset } })
    const items = page.subjectMappings ?? page.subject_mappings ?? []

    for (const m of items) {
      const valueId = (m.attributeValue ?? m.attribute_value)?.id
      if (!valueId) continue
      if (!(m.actions ?? []).some(a => a.name === 'read')) continue

      const sets = (m.subjectConditionSet ?? m.subject_condition_set)?.subjectSets
        ?? (m.subjectConditionSet ?? m.subject_condition_set)?.subject_sets ?? []
      if (sets.length !== 1) continue
      const groups = sets[0].conditionGroups ?? sets[0].condition_groups ?? []
      if (groups.length !== 1) continue
      const conditions = groups[0].conditions ?? []
      if (conditions.length !== 1) continue

      const c = conditions[0]
      if ((c.subjectExternalSelectorValue ?? c.subject_external_selector_value) !== '.sub') continue
      const values = c.subjectExternalValues ?? c.subject_external_values ?? []
      if (values.length !== 1) continue
      have.add(`${valueId}|${values[0]}`)
    }

    const total = Number(page.pagination?.total ?? items.length)
    if (items.length === 0 || offset + items.length >= total) break
  }

  return have
}

/**
 * Maps each identity's grants onto the seeded attribute values.
 *
 * `identities` and `defs` are parameters for the same reason as in `ensureAttributes` — a
 * scenario's personas and agents need mappings written exactly the way the built-in ones are, and
 * `defs` is what tells `grantsToFqns` which of the scenario's definitions rank.
 */
async function ensureSubjectMappings(token, valueIdByFqn, identities = IDENTITIES, defs = undefined) {
  let created = 0
  let skipped = 0

  // If the listing itself fails, fall back to writing unconditionally rather than not seeding at
  // all: a duplicate mapping is inert, an unwritten one denies a persona who should be entitled.
  let have = new Set()
  try {
    have = await existingMappingKeys(token)
  } catch (e) {
    console.warn('[ai-seeder] Could not list existing subject mappings, writing unconditionally:', e.message)
  }

  for (const [personaId, { grants }] of Object.entries(identities)) {
    for (const fqn of grantsToFqns(grants, defs)) {
      const valueId = valueIdByFqn[fqn]
      if (!valueId) {
        console.warn('[ai-seeder] No value id for FQN:', fqn, '— skipping mapping')
        skipped++
        continue
      }
      const key = `${valueId}|${personaId}`
      if (have.has(key)) { skipped++; continue }
      try {
        // The action must be "read" — that is what the KAS passes to authz v2
        // (ActionNameRead), so a mapping under any other action never matches.
        await rpc(token, 'policy.subjectmapping.SubjectMappingService', 'CreateSubjectMapping', {
          attribute_value_id: valueId,
          actions: [{ name: 'read' }],
          new_subject_condition_set: {
            subject_sets: [{
              condition_groups: [{
                conditions: [{
                  subject_external_selector_value: '.sub',
                  operator: 'SUBJECT_MAPPING_OPERATOR_ENUM_IN',
                  subject_external_values: [personaId],
                }],
                boolean_operator: 'CONDITION_BOOLEAN_TYPE_ENUM_AND',
              }],
            }],
          },
        })
        have.add(key)
        created++
      } catch (e) {
        if (isAlreadyExists(e)) skipped++
        else console.warn('[ai-seeder] Subject mapping warning:', personaId, fqn, e.message)
      }
    }
  }

  console.log(`[ai-seeder] Subject mappings — created ${created}, skipped ${skipped}`)
  return created
}

async function seedAi(adminToken, markerPath) {
  if (fs.existsSync(markerPath)) {
    const existing = fs.readFileSync(markerPath, 'utf8').trim()
    if (existing === SEED_VERSION) {
      console.log(`[ai-seeder] Already seeded (version ${SEED_VERSION}) — skipping`)
      return
    }
    console.log(`[ai-seeder] Seed version mismatch (have ${existing}, need ${SEED_VERSION}) — re-seeding`)
  }

  console.log('[ai-seeder] Starting platform seed...')

  const nsId = await ensureNamespace(adminToken)
  if (!nsId) throw new Error('Could not resolve namespace id — aborting seed')

  const valueIdByFqn = await ensureAttributes(adminToken, nsId)
  console.log('[ai-seeder] Indexed', Object.keys(valueIdByFqn).length, 'attribute value FQNs')

  await ensureSubjectMappings(adminToken, valueIdByFqn)

  fs.mkdirSync(path.dirname(markerPath), { recursive: true })
  fs.writeFileSync(markerPath, SEED_VERSION)
  console.log(`[ai-seeder] Seeding complete (version ${SEED_VERSION})`)
}

/**
 * Seed one user-built scenario's vocabulary and identities into the running platform.
 *
 * Deliberately *not* version-gated the way `seedAi()` is. The version marker exists so the shipped
 * seed data is written once per install; a scenario is created or imported at a moment the user
 * chose, and has to take effect then. Running it twice is harmless — every write underneath is
 * idempotent, including the subject mappings, which the platform itself would happily duplicate
 * (see `existingMappingKeys`) — so it is called on save, on import, and on every launch of the
 * scenario, which means a platform whose policy store was reset still ends up correct without the
 * user knowing that is what happened.
 *
 * Attribute definitions are never deleted when a scenario is deleted. Deletion would be the one
 * destructive operation in here, and a definition name shared with a built-in mode (`clearance`,
 * say) would take that mode down with it — and a name shared with another page of this app
 * (`clearance`, `mission`, `role`, `nationality`) would take that page down with it. Orphaned
 * definitions are inert: nothing names them in a policy and no token resolves to them.
 *
 * @param {string} adminToken
 * @param {{id: string, vocabulary: Array, identities: object}} scenario
 * @returns {Promise<{values: number, mappings: number}>}
 */
async function seedScenario(adminToken, scenario) {
  const defs = scenario.vocabulary ?? []
  const identities = scenario.identities ?? {}

  const nsId = await ensureNamespace(adminToken)
  if (!nsId) throw new Error('Could not resolve namespace id — cannot seed scenario')

  // Both the scenario's own definitions and the built-ins, because a scenario is allowed to write
  // grants against shipped vocabulary (a persona holding `clearance:secret`). Without the
  // built-ins in this list the FQN would have no value id and the mapping would be skipped.
  const merged = [...ATTRIBUTE_DEFS, ...defs.filter(d => !BUILTIN_DEFS_BY_NAME.has(d.name))]
  const valueIdByFqn = await ensureAttributes(adminToken, nsId, merged)

  const mappings = await ensureSubjectMappings(adminToken, valueIdByFqn, identities, merged)
  console.log(`[ai-seeder] Scenario ${scenario.id}: ${defs.length} definition(s), ` +
    `${Object.keys(identities).length} identity(ies), ${mappings} new mapping(s)`)
  return { values: Object.keys(valueIdByFqn).length, mappings }
}

module.exports = { seedAi, seedScenario, NAMESPACE, NS }
