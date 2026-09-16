/**
 * Scenarios the user built themselves, persisted across restarts and app updates.
 *
 * A scenario is a fifth, sixth, nth mode: its own vocabulary, its own personas and agents, its
 * own corpus, its own teaching points. Unlike an upload (`electron/uploads.js`), which adds a
 * document to a scenario somebody else designed, this brings the whole scenario — including
 * attribute definitions the platform has never seen, seeded live on save.
 *
 * Layout under userData:
 *   scenarios/index.json   every scenario, in full
 *
 * No sidecar blobs. Documents are stored as **plaintext plus a policy**, never as ciphertext,
 * which is the same reasoning as the `plaintext` upload kind: a TDF's key is wrapped to one KAS's
 * public key, so ciphertext is only meaningful on the machine that made it. Storing plaintext is
 * what makes a scenario portable — export writes this JSON, import re-encrypts every document
 * against the importing machine's KAS, and the result enforces identically without ever having
 * shipped a key.
 *
 * The index is written via a temp file and renamed, so a crash mid-write leaves the previous
 * index intact rather than a half-written one.
 *
 * What this module will not do:
 *
 *   It will not let a scenario redefine a shipped identity, because that would change what a
 *   built-in mode does. Ids are prefixed with the scenario's own id, so collisions are structurally
 *   impossible rather than merely checked for.
 *
 *   It will not let a scenario reuse a built-in attribute *name* under a different rule. The
 *   platform would keep the original rule and hand back a scenario that behaves differently than
 *   the builder showed — declaring `clearance` as ANY_OF and then watching HIERARCHY comparisons
 *   happen anyway is exactly the kind of thing nobody would think to check mid-demo.
 *
 *   It will not delete attribute definitions when a scenario is deleted. See the note on
 *   `seedScenario` in electron/seeder.js — a name shared with a built-in would take that mode
 *   down with it, and an orphaned definition is inert.
 */

const fs = require('fs')
const path = require('path')
const { randomUUID } = require('crypto')

const { NS, BUILTIN_DEFS_BY_NAME } = require('./ai-identities.js')

const FORMAT = 'virtru-secure-ai-scenario'
const FORMAT_VERSION = 1

const RULES = new Set([
  'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',
  'ATTRIBUTE_RULE_TYPE_ENUM_HIERARCHY',
])

// Attribute and value names travel inside an FQN, so they have to survive being a URL path
// segment. Lowercase-only for names because the platform normalises them anyway, and a definition
// that comes back cased differently than it went in is a confusing thing to debug.
const NAME_RE  = /^[a-z][a-z0-9]{0,30}$/
const VALUE_RE = /^[a-z0-9][a-z0-9._-]{0,62}$/

const dir       = (app) => path.join(app.getPath('userData'), 'scenarios')
const indexPath = (app) => path.join(dir(app), 'index.json')

function readIndex(app) {
  try {
    const raw = JSON.parse(fs.readFileSync(indexPath(app), 'utf8'))
    return Array.isArray(raw?.items) ? raw.items : []
  } catch {
    // Missing is the normal first-run case.
    return []
  }
}

function writeIndex(app, items) {
  fs.mkdirSync(dir(app), { recursive: true })
  const tmp = indexPath(app) + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify({ version: 1, items }, null, 2))
  fs.renameSync(tmp, indexPath(app))
}

/** Every attribute value FQN a scenario's own vocabulary creates. */
function scenarioFqns(scenario) {
  const out = new Set()
  for (const def of scenario.vocabulary ?? []) {
    for (const v of def.values ?? []) out.add(`${NS}/${def.name}/value/${v}`)
  }
  return out
}

/** Every FQN a policy in this scenario is allowed to name: its own, plus everything shipped. */
function allowedFqns(scenario) {
  const out = scenarioFqns(scenario)
  for (const def of BUILTIN_DEFS_BY_NAME.values()) {
    for (const v of def.values) out.add(`${NS}/${def.name}/value/${v}`)
  }
  return out
}

/**
 * The identity table a scenario contributes, in the shape `electron/identities.js` uses.
 *
 * Derived rather than stored, so a persona's grants can only ever live in one place. Storing both
 * a persona list and an identity map would allow them to disagree, and a disagreement there is
 * precisely the bug that shows up as an unexplainable denial.
 */
function scenarioIdentities(scenario) {
  const out = {}
  for (const s of [...(scenario.personas ?? []), ...(scenario.agents ?? [])]) {
    out[s.id] = { name: s.name, grants: s.grants ?? {} }
  }
  return out
}

/** The definitions a scenario's grants and policies resolve against: its own plus the built-ins. */
function scenarioDefs(scenario) {
  const own = (scenario.vocabulary ?? []).filter(d => !BUILTIN_DEFS_BY_NAME.has(d.name))
  return [...BUILTIN_DEFS_BY_NAME.values(), ...own]
}

/**
 * Everything wrong with a scenario, as sentences a person can act on.
 *
 * Runs on save and again on import, because an imported bundle is the one case where the data did
 * not come from our own builder and may have been hand-edited.
 *
 * @returns {string[]} empty when the scenario is fit to seed
 */
function validate(scenario) {
  const problems = []
  const s = scenario ?? {}

  if (!s.id || typeof s.id !== 'string') problems.push('The scenario has no id.')
  if (!s.name?.trim()) problems.push('The scenario needs a name.')

  // ── Vocabulary ─────────────────────────────────────────────────────────────
  const seenDef = new Set()
  for (const def of s.vocabulary ?? []) {
    const where = `Attribute "${def?.name ?? '(unnamed)'}"`
    if (!NAME_RE.test(def?.name ?? '')) {
      problems.push(`${where}: names must be lowercase letters and digits, starting with a letter.`)
      continue
    }
    if (seenDef.has(def.name)) problems.push(`${where} is defined twice.`)
    seenDef.add(def.name)

    if (!RULES.has(def.rule)) problems.push(`${where}: rule must be ANY_OF or HIERARCHY.`)
    if (!Array.isArray(def.values) || def.values.length === 0) {
      problems.push(`${where}: needs at least one value.`)
    }
    for (const v of def.values ?? []) {
      if (!VALUE_RE.test(String(v))) {
        problems.push(`${where}: value "${v}" must be lowercase alphanumeric, with . _ or - inside.`)
      }
    }
    if (new Set(def.values ?? []).size !== (def.values ?? []).length) {
      problems.push(`${where}: has a duplicate value.`)
    }

    // Reusing a shipped name is fine; reusing it under a different rule is not.
    const builtin = BUILTIN_DEFS_BY_NAME.get(def.name)
    if (builtin && builtin.rule !== def.rule) {
      problems.push(
        `${where} already exists in this app as ${builtin.rule.replace('ATTRIBUTE_RULE_TYPE_ENUM_', '')}. ` +
        `The platform keeps the original rule, so a scenario cannot redefine it — pick another name.`
      )
    }
    if (builtin) {
      const extra = (def.values ?? []).filter(v => !builtin.values.includes(v))
      if (extra.length && builtin.rule === 'ATTRIBUTE_RULE_TYPE_ENUM_HIERARCHY') {
        problems.push(
          `${where} is a shipped hierarchy. Adding values (${extra.join(', ')}) would put them at ` +
          `the bottom of the existing ranking, which is almost never what is meant — pick another name.`
        )
      }
    }
  }

  // ── Personas and agents ────────────────────────────────────────────────────
  const personas = s.personas ?? []
  const agents = s.agents ?? []
  if (personas.length === 0) problems.push('The scenario needs at least one persona.')

  const known = new Set()
  const grantable = allowedFqns(s)
  for (const [label, list] of [['Persona', personas], ['Agent', agents]]) {
    for (const p of list) {
      const where = `${label} "${p?.name ?? p?.id ?? '(unnamed)'}"`
      if (!p?.id) { problems.push(`${where}: has no id.`); continue }
      if (!String(p.id).startsWith(`${s.id}-`)) {
        problems.push(`${where}: id must start with "${s.id}-" so it cannot collide with another scenario.`)
      }
      if (known.has(p.id)) problems.push(`${where}: two subjects share the id "${p.id}".`)
      known.add(p.id)
      if (!p.name?.trim()) problems.push(`${where}: needs a name.`)

      // A grant naming vocabulary that does not exist would be silently dropped by the seeder and
      // show up as a subject who holds less than the builder said they do.
      for (const [attr, value] of Object.entries(p.grants ?? {})) {
        for (const v of [].concat(value)) {
          const fqn = `${NS}/${attr}/value/${v}`
          if (!grantable.has(fqn)) {
            problems.push(`${where}: granted ${attr}:${v}, which no attribute in this scenario defines.`)
          }
        }
      }
    }
  }

  if (s.defaultPersonaId && !personas.some(p => p.id === s.defaultPersonaId)) {
    problems.push(`The starting persona "${s.defaultPersonaId}" is not one of this scenario's personas.`)
  }
  if (s.defaultAgentId && !agents.some(a => a.id === s.defaultAgentId)) {
    problems.push(`The starting agent "${s.defaultAgentId}" is not one of this scenario's agents.`)
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  const documents = s.documents ?? []
  if (documents.length === 0) problems.push('The scenario needs at least one document.')

  const seenDoc = new Set()
  for (const doc of documents) {
    const where = `Document "${doc?.label ?? doc?.id ?? '(unnamed)'}"`
    if (!doc?.id) { problems.push(`${where}: has no id.`); continue }
    if (seenDoc.has(doc.id)) problems.push(`${where}: two documents share the id "${doc.id}".`)
    seenDoc.add(doc.id)
    if (!doc.label?.trim()) problems.push(`${where}: needs a label.`)

    // A tiered document holds its text and its policy on each tier, not on itself — one TDF per
    // tier, which is how the same document can serve a fuller version to a more entitled reader.
    // The checks below therefore run per *unit*, in the same shape corpusUnits() produces, because
    // a tier whose policy names nothing real is exactly as broken as a document that does.
    const tiers = Array.isArray(doc.tiers) ? doc.tiers : null
    if (tiers && tiers.length < 2) {
      problems.push(`${where}: a tiered document needs at least two tiers — with one, the tier is ` +
        `just the document.`)
    }
    const units = tiers
      ? tiers.map((t, i) => ({ ...t, where: `${where}, tier "${t?.label ?? t?.id ?? i + 1}"` }))
      : [{ ...doc, where }]

    const seenTier = new Set()
    for (const unit of units) {
      if (tiers) {
        if (!unit.id) { problems.push(`${unit.where}: has no id.`); continue }
        if (seenTier.has(unit.id)) problems.push(`${unit.where}: two tiers share the id "${unit.id}".`)
        seenTier.add(unit.id)
        if (!unit.label?.trim()) problems.push(`${unit.where}: needs a label.`)
      }
      if (!unit.text?.trim()) {
        problems.push(`${unit.where}: has no text, so there is nothing to encrypt.`)
      }

      const policy = unit.policy ?? []
      for (const fqn of policy) {
        if (!grantable.has(fqn)) {
          problems.push(`${unit.where}: policy names ${fqn}, which no attribute in this scenario defines.`)
        }
      }
      // Measured on this platform build: at 21 values the decision lookup fails outright and the
      // KAS then denies every caller, entitled or not. See ATTRIBUTE_DEFS in identities.js.
      if (policy.length > 20) {
        problems.push(`${unit.where}: ${policy.length} attribute values. Past 20 the platform refuses ` +
          `everyone, including holders who should qualify — model the community as a marking instead.`)
      }
    }

    if (!Array.isArray(doc.keywords) || doc.keywords.length === 0) {
      problems.push(`${where}: needs at least one keyword, or no question will ever retrieve it.`)
    }
  }

  return problems
}

/** Every saved scenario. */
function list(app) {
  return readIndex(app)
}

/**
 * Create or replace one scenario. Validates first and throws rather than storing something
 * unseedable — a scenario on disk that cannot be launched is worse than a rejected save.
 *
 * @returns {object} the stored scenario
 */
function save(app, scenario) {
  const items = readIndex(app)
  const existing = items.find(x => x.id === scenario.id)

  const stored = {
    ...scenario,
    format: FORMAT,
    formatVersion: FORMAT_VERSION,
    id: scenario.id || `sc-${randomUUID().slice(0, 8)}`,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const problems = validate(stored)
  if (problems.length) {
    throw new Error(`This scenario cannot be saved yet:\n• ${problems.join('\n• ')}`)
  }

  writeIndex(app, existing
    ? items.map(x => (x.id === stored.id ? stored : x))
    : [...items, stored])
  return stored
}

/**
 * Forget a scenario. The platform keeps its attribute definitions and subject mappings; both are
 * inert once nothing names them, and deleting definitions could take a built-in mode with them.
 *
 * @returns {string[]} the identity ids that should stop being issuable
 */
function remove(app, id) {
  const items = readIndex(app)
  const gone = items.find(x => x.id === id)
  if (!gone) return null
  writeIndex(app, items.filter(x => x.id !== id))
  return Object.keys(scenarioIdentities(gone))
}

/** A fresh id, for a builder that needs one before it has anything to save. */
const newId = () => `sc-${randomUUID().slice(0, 8)}`

/**
 * Rewrite every id in an imported bundle under a new prefix, keeping internal references intact.
 *
 * Not cosmetic. Two people can build scenarios that collide on `sc-1a2b3c4d`, and subject mappings
 * are global to the platform — an import that kept its original id could quietly take over another
 * scenario's personas. So the whole thing is rewritten, including the two `default*` pointers,
 * which would otherwise dangle and fail validation.
 *
 * Document ids are scoped to their scenario in the vault, so they do not need the prefix and are
 * left alone: renaming them would break nothing but would make an exported and re-imported
 * scenario diff confusingly against the original.
 */
function reId(bundle, id, importedAt = new Date().toISOString()) {
  const oldId = bundle.id
  const swap = (subjectId) => (
    typeof subjectId === 'string' && subjectId.startsWith(`${oldId}-`)
      ? `${id}-${subjectId.slice(oldId.length + 1)}`
      : subjectId
  )
  const reSubject = (s) => ({ ...s, id: swap(s.id) })

  return {
    ...bundle,
    id,
    personas: (bundle.personas ?? []).map(reSubject),
    agents:   (bundle.agents   ?? []).map(reSubject),
    defaultPersonaId: swap(bundle.defaultPersonaId),
    defaultAgentId:   swap(bundle.defaultAgentId),
    importedAt,
    importedFrom: oldId,
  }
}

module.exports = {
  list, save, remove, validate, newId, reId,
  scenarioIdentities, scenarioDefs, scenarioFqns, allowedFqns,
  FORMAT, FORMAT_VERSION,
}
