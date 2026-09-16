/**
 * Verifies a user-built scenario end to end against the running platform.
 *
 *   node scripts/verify-scenario.mjs          # run it with the app open
 *
 * The scenario builder lets an SE invent attribute names the platform has never seen and seed them
 * live. That is the one feature in this app where a mistake is invisible: an invented definition
 * that silently fails to seed, or a subject mapping written against the wrong FQN, produces a
 * scenario where every policy denies everybody — which looks exactly like a strict demo until
 * somebody notices that the persona who should be granted never is. So the whole path is exercised
 * here against real KAS decisions, with the expected grid written by hand from each persona's
 * stated grants rather than derived from the same data it is checking.
 *
 * What it proves, in order:
 *   1. A well-formed scenario validates clean, and seven specific malformations are each caught
 *      with a sentence naming the problem.
 *   2. `save` refuses to store a scenario that could not be seeded.
 *   3. `reId` moves every subject id and both default pointers under a fresh prefix — the thing
 *      that stops an imported bundle from taking over another scenario's personas.
 *   4. Built-in identities cannot be redefined or unregistered by a scenario.
 *   5. Seeding is idempotent: the second run creates zero new subject mappings.
 *   6. Every cell of the persona grid and the agent grid matches, live.
 *   7. The two invariants the agent feature rests on hold here too — some document is reachable
 *      by a person and refused to their agent, and no agent opens everything a person can.
 *   8. An exported bundle, re-imported under a new id, enforces identically. This is the claim
 *      that makes a scenario shareable at all, and it can only be true because the bundle carries
 *      plaintext plus policy: TDF ciphertext is wrapped to the KAS that made it.
 *
 * Attribute definitions cannot be deleted from the platform (see the note in electron/ai-seeder.js),
 * so this leaves three behind. They are prefixed `vtest` to be recognisable, and they are inert:
 * the attribute picker only ever offers the built-ins plus the *active* scenario's own vocabulary,
 * so a definition belonging to a scenario that no longer exists is invisible in the app.
 *
 * Exits non-zero on any failure.
 */

import { mkdtempSync, existsSync, rmSync } from 'node:fs'
import { tmpdir, homedir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'

const require = createRequire(import.meta.url)

const scenarios = require('../electron/ai-scenarios.js')
const seeder    = require('../electron/ai-seeder.js')
const jwtIssuer = require('../electron/jwt-issuer.js')
const identities = require('../electron/ai-identities.js')

const { NS } = identities

const PLATFORM_URL = 'http://localhost:7777'
const KAS_URL      = `${PLATFORM_URL}/kas`

const ANY_OF    = 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF'
const HIERARCHY = 'ATTRIBUTE_RULE_TYPE_ENUM_HIERARCHY'

// ── The issuer's real keypair ────────────────────────────────────────────────
//
// Tokens are signed in this process rather than fetched over HTTP, because the app's issuer knows
// nothing about a scenario that was never saved into its own userData. Signing with the keypair it
// already loaded means the platform validates these tokens against the JWKS it is already serving —
// same key, same issuer URL, so the KAS cannot tell the difference.

const CANDIDATES = [
  join(homedir(), 'Library', 'Application Support', 'virtru-demo-center'),
  join(homedir(), 'Library', 'Application Support', 'Virtru Demo Center'),
]

const userDataPath = CANDIDATES.find(p => existsSync(join(p, 'keys', 'issuer-private.pem')))
if (!userDataPath) {
  console.error('No issuer keypair found. Start the app once (npm run dev) so it generates one.')
  process.exit(1)
}
jwtIssuer.loadOrGenerateKeys(userDataPath)

const store = mkdtempSync(join(tmpdir(), 'virtru-ai-scenario-'))
const fakeApp = { getPath: () => store }

// ── The scenario under test ─────────────────────────────────────────────────
//
// Three invented definitions, one of them a hierarchy, plus one persona granted a *built-in*
// attribute — a scenario is allowed to mix its own vocabulary with what already exists, and the
// merged-definitions path in seedScenario is what makes that work.

const SID = 'sc-vtest001'
const s = (name) => `${SID}-${name}`

const VOCAB = [
  { name: 'vtestprogramme',   rule: ANY_OF,    values: ['orion', 'cassini'] },
  // Highest first. A holder is granted this level and everything below it, so tagging a document
  // `internal` admits the `restricted` holder too.
  { name: 'vtestsensitivity', rule: HIERARCHY, values: ['restricted', 'internal', 'public'] },
  { name: 'vtestpartner',     rule: ANY_OF,    values: ['primeco', 'subco'] },
]

const fqn = (attr, value) => `${NS}/${attr}/value/${value}`

const SCENARIO = {
  id: SID,
  name: 'Orion Programme (verifier)',
  short: 'Orion',
  tagline: 'Invented vocabulary, seeded live',
  icon: 'public',
  accent: '#6366f1',
  premise: 'A synthetic scenario used only by scripts/verify-scenario.mjs.',
  vocabulary: VOCAB,
  personas: [
    { id: s('lead'),     name: 'Programme Lead',  icon: 'analyst', color: '#6366f1',
      grants: { vtestprogramme: ['orion', 'cassini'], vtestsensitivity: 'restricted' } },
    { id: s('eng'),      name: 'Orion Engineer',  icon: 'analyst', color: '#0ea5e9',
      grants: { vtestprogramme: 'orion', vtestsensitivity: 'internal' } },
    { id: s('supplier'), name: 'PrimeCo Supplier', icon: 'contractor', color: '#f59e0b',
      grants: { vtestprogramme: 'orion', vtestpartner: 'primeco', vtestsensitivity: 'public' } },
    // Holds nothing at all: authenticates and reaches only the empty-policy document.
    { id: s('outsider'), name: 'Outside Reviewer', icon: 'anonymous', color: '#64748b', grants: {} },
    // Granted a built-in attribute rather than an invented one.
    { id: s('cleared'),  name: 'Cleared Staffer', icon: 'medal', color: '#10b981',
      grants: { clearance: 'secret', vtestprogramme: 'orion' } },
  ],
  agents: [
    { id: s('agent-broad'),  name: 'Programme Agent', icon: 'agent', color: '#6366f1',
      grants: { vtestprogramme: ['orion', 'cassini'], vtestsensitivity: 'internal' } },
    { id: s('agent-narrow'), name: 'Supplier Agent',  icon: 'agent', color: '#f59e0b',
      grants: { vtestprogramme: 'orion', vtestpartner: 'primeco', vtestsensitivity: 'public' } },
  ],
  documents: [
    {
      id: 'charter', label: 'Programme Charter', classification: 'PUBLIC',
      keywords: ['charter'], policy: [], text: 'The Orion programme charter. Unrestricted.',
    },
    {
      id: 'orion-internal', label: 'Orion Internal Review', classification: 'INTERNAL // ORION',
      keywords: ['orion review'],
      policy: [fqn('vtestprogramme', 'orion'), fqn('vtestsensitivity', 'internal')],
      text: 'Orion milestone slip, internal only.',
    },
    {
      id: 'cassini-restricted', label: 'Cassini Restricted Brief', classification: 'RESTRICTED // CASSINI',
      keywords: ['cassini'],
      policy: [fqn('vtestprogramme', 'cassini'), fqn('vtestsensitivity', 'restricted')],
      text: 'Cassini restricted brief.',
    },
    {
      id: 'supplier-pack', label: 'Supplier Pack', classification: 'INTERNAL // ORION',
      keywords: ['supplier pack'],
      tiers: [
        {
          id: 'full', label: 'Full pack', classification: 'INTERNAL // ORION',
          policy: [fqn('vtestprogramme', 'orion'), fqn('vtestsensitivity', 'internal')],
          text: 'Full supplier pack including unit costs.',
        },
        {
          id: 'redacted', label: 'Redacted pack', classification: 'PARTNER RELEASABLE',
          policy: [fqn('vtestpartner', 'primeco')],
          text: 'Redacted supplier pack, costs removed.',
        },
      ],
    },
    {
      // A built-in attribute inside a user-built scenario.
      id: 'secret-brief', label: 'Cleared Brief', classification: 'SECRET',
      keywords: ['cleared brief'],
      policy: [`${NS}/clearance/value/secret`],
      text: 'A brief carrying a shipped clearance attribute.',
    },
  ],
  teaches: [{ title: 'Invented vocabulary is real vocabulary', detail: 'Seeded on save, enforced by the same KAS.' }],
  prompts: [{ label: 'Charter', text: 'What does the programme charter say?' }],
  defaultPersonaId: s('lead'),
  defaultAgentId: s('agent-broad'),
}

/**
 * unit key → subject ids expected to be GRANTED. Everyone else is expected to be refused.
 *
 * Written from the grants above by hand. `vtestsensitivity` is a hierarchy with `restricted`
 * highest, so a document tagged `internal` releases to the `restricted` holder as well — which is
 * why the lead reaches the internal review and the supplier does not.
 */
const EXPECTED = {
  'charter':                 ['lead', 'eng', 'supplier', 'outsider', 'cleared'],
  'orion-internal':          ['lead', 'eng'],
  'cassini-restricted':      ['lead'],
  'supplier-pack:full':      ['lead', 'eng'],
  'supplier-pack:redacted':  ['supplier'],
  'secret-brief':            ['cleared'],
}

const EXPECTED_AGENTS = {
  'charter':                 ['agent-broad', 'agent-narrow'],
  'orion-internal':          ['agent-broad'],
  // The broad agent holds cassini and only `internal` sensitivity, so the one document the lead
  // can reach and nothing else can is closed to every agent in the scenario.
  'cassini-restricted':      [],
  'supplier-pack:full':      ['agent-broad'],
  'supplier-pack:redacted':  ['agent-narrow'],
  // No agent holds a clearance. A shipped attribute inside a scenario behaves like any other.
  'secret-brief':            [],
}

// ── Harness ─────────────────────────────────────────────────────────────────

let failures = 0
const fail = (msg) => { console.error(`  ✗ ${msg}`); failures++ }
const pass = (msg) => console.log(`  ✓ ${msg}`)
const check = (cond, msg) => (cond ? pass(msg) : fail(msg))

/** The platform's Connect-over-HTTP calling convention, same as electron/ai-seeder.js uses. */
async function rpc(token, service, method, body = {}) {
  const res = await fetch(`${PLATFORM_URL}/${service}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${method} failed ${res.status}: ${await res.text()}`)
  return res.json()
}

const client = (accessToken) => new OpenTDF({
  interceptors: [authTokenInterceptor(() => accessToken)],
  platformUrl: PLATFORM_URL,
  disableDPoP: true,
})

async function drain(stream) {
  const chunks = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c)))
}

async function encrypt(unit, adminToken) {
  const out = await client(adminToken).createTDF({
    source: { type: 'stream', location: new Blob([new TextEncoder().encode(unit.text)]).stream() },
    defaultKASEndpoint: KAS_URL,
    autoconfigure: false,
    attributes: unit.policy,
  })
  return drain(out)
}

async function canDecrypt(tdfBytes, subjectId) {
  try {
    const out = await client(jwtIssuer.issueToken(subjectId).access_token).read({
      source: { type: 'stream', location: new Blob([tdfBytes]).stream() },
      allowedKASEndpoints: [KAS_URL],
    })
    await drain(out)
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: (err?.message ?? String(err)).split('\n')[0].slice(0, 90) }
  }
}

/** The corpus units of a scenario, keyed the way EXPECTED is. Mirrors src/ai/corpus.js. */
function units(scenario) {
  const out = []
  for (const doc of scenario.documents) {
    if (doc.tiers) {
      for (const t of doc.tiers) out.push({ key: `${doc.id}:${t.id}`, policy: t.policy, text: t.text })
    } else {
      out.push({ key: doc.id, policy: doc.policy, text: doc.text })
    }
  }
  return out
}

const pad = (s, n) => String(s).padEnd(n)

// ── 1. Validation ───────────────────────────────────────────────────────────

console.log('\nValidation')

const clean = scenarios.validate(SCENARIO)
check(clean.length === 0, `the scenario under test validates clean${clean.length ? ` — got: ${clean.join(' | ')}` : ''}`)

const mangle = (patch) => ({ ...structuredClone(SCENARIO), ...patch })

const NEGATIVE = [
  {
    what: 'a built-in attribute name reused under a different rule',
    scenario: mangle({ vocabulary: [...VOCAB, { name: 'clearance', rule: ANY_OF, values: ['secret'] }] }),
    expect: /HIERARCHY/,
  },
  {
    what: 'a persona id not prefixed with the scenario id',
    scenario: (() => {
      const m = mangle({})
      m.personas[1] = { ...m.personas[1], id: 'eng' }
      return m
    })(),
    expect: /must start with/,
  },
  {
    what: 'a grant naming vocabulary that does not exist',
    scenario: (() => {
      const m = mangle({})
      m.personas[1] = { ...m.personas[1], grants: { vtestnothing: 'x' } }
      return m
    })(),
    expect: /no attribute in this scenario defines/,
  },
  {
    what: 'a policy over the 20-value ceiling',
    scenario: (() => {
      const m = mangle({})
      // 21 real, seeded values, so the only thing wrong with it is the count.
      m.vocabulary = [...VOCAB, {
        name: 'vtestwide', rule: ANY_OF,
        values: Array.from({ length: 21 }, (_, i) => `v${i}`),
      }]
      m.documents[1] = {
        ...m.documents[1],
        policy: Array.from({ length: 21 }, (_, i) => fqn('vtestwide', `v${i}`)),
      }
      return m
    })(),
    expect: /Past 20|21 attribute values/,
  },
  {
    what: 'no documents at all',
    scenario: mangle({ documents: [] }),
    expect: /at least one document/,
  },
  {
    what: 'a starting persona that is not in the list',
    scenario: mangle({ defaultPersonaId: 'sc-vtest001-nobody' }),
    expect: /starting persona/,
  },
  {
    what: 'an attribute name that is not lowercase',
    scenario: mangle({ vocabulary: [...VOCAB, { name: 'VtestUpper', rule: ANY_OF, values: ['a'] }] }),
    expect: /lowercase/,
  },
]

for (const { what, scenario, expect } of NEGATIVE) {
  const problems = scenarios.validate(scenario)
  const hit = problems.some(p => expect.test(p))
  check(hit, `rejects ${what}${hit ? '' : ` — got: ${problems.join(' | ') || '(nothing)'}`}`)
}

let threw = false
try { scenarios.save(fakeApp, mangle({ documents: [] })) } catch { threw = true }
check(threw, 'save refuses a scenario that could not be seeded')

// ── 2. Re-iding, which is what makes an import safe ─────────────────────────

console.log('\nRe-id on import')

const reIded = scenarios.reId(structuredClone(SCENARIO), 'sc-vtest002', '2026-01-01T00:00:00.000Z')
check(reIded.personas.every(p => p.id.startsWith('sc-vtest002-')), 'every persona id moves to the new prefix')
check(reIded.agents.every(a => a.id.startsWith('sc-vtest002-')), 'every agent id moves to the new prefix')
check(reIded.defaultPersonaId === 'sc-vtest002-lead', 'the starting persona pointer follows')
check(reIded.defaultAgentId === 'sc-vtest002-agent-broad', 'the starting agent pointer follows')
check(reIded.importedFrom === SID, 'the original id is recorded')
check(SCENARIO.personas[0].id === s('lead'), 'the original scenario is left untouched')
check(scenarios.validate(reIded).length === 0, 'the re-ided scenario validates clean')

// ── 3. The identities a scenario may not claim ──────────────────────────────

console.log('\nBuilt-in identities')

for (const reserved of ['dow-sarah', 'le-agent-case', 'admin']) {
  let refused = false
  try { jwtIssuer.registerIdentity(reserved, { name: 'Impostor', grants: {} }) } catch { refused = true }
  check(refused, `refuses to redefine "${reserved}"`)
}
check(jwtIssuer.unregisterIdentity('dow-sarah') === false, 'refuses to unregister a built-in identity')

// ── 4. Seeding ──────────────────────────────────────────────────────────────

console.log('\nSeeding')

const stored = scenarios.save(fakeApp, SCENARIO)
check(scenarios.list(fakeApp).length === 1, 'the scenario is persisted')

const defs = scenarios.scenarioDefs(stored)
const identityTable = scenarios.scenarioIdentities(stored)
check(
  Object.keys(identityTable).length === SCENARIO.personas.length + SCENARIO.agents.length,
  'personas and agents both become issuable identities'
)

for (const [id, identity] of Object.entries(identityTable)) {
  jwtIssuer.registerIdentity(id, identity, defs)
}

// The lead holds the top of an invented hierarchy, so their entity attributes must include the
// levels below it — the same expansion `clearance` gets, driven by the scenario's own definition.
const leadFqns = jwtIssuer.getEntityAttributes(s('lead'))
check(
  ['restricted', 'internal', 'public'].every(v => leadFqns.includes(fqn('vtestsensitivity', v))),
  'an invented hierarchy expands downward in the token, exactly as clearance does'
)
check(
  !jwtIssuer.getEntityAttributes(s('eng')).includes(fqn('vtestsensitivity', 'restricted')),
  'and does not expand upward'
)

const adminToken = jwtIssuer.issueToken('admin').access_token

await seeder.seedScenario(adminToken, { ...stored, identities: identityTable })
const second = await seeder.seedScenario(adminToken, { ...stored, identities: identityTable })
check(second.mappings === 0, `re-seeding writes nothing the second time (${second.mappings} created)`)

// Asked of the platform rather than of the seeder's return value, because the seeder can only
// report what *it* created and this scenario's mappings may have been written by an earlier run of
// this script. What has to be true either way: every FQN a subject's grants imply is mapped to
// them for `read`, and mapped exactly once. Counting is the point — CreateSubjectMapping will
// duplicate a mapping on request, so "exactly one" is what proves the dedupe in the seeder works
// across launches rather than only within one.
const counts = new Map()
for (let offset = 0; ; offset += 1000) {
  const page = await rpc(adminToken, 'policy.subjectmapping.SubjectMappingService', 'ListSubjectMappings',
    { pagination: { limit: 1000, offset } })
  const items = page.subjectMappings ?? []
  for (const m of items) {
    if (!(m.actions ?? []).some(a => a.name === 'read')) continue
    const valueFqn = m.attributeValue?.fqn
    for (const set of m.subjectConditionSet?.subjectSets ?? []) {
      for (const group of set.conditionGroups ?? []) {
        for (const c of group.conditions ?? []) {
          if (c.subjectExternalSelectorValue !== '.sub') continue
          for (const v of c.subjectExternalValues ?? []) {
            const key = `${valueFqn}|${v}`
            counts.set(key, (counts.get(key) ?? 0) + 1)
          }
        }
      }
    }
  }
  const total = Number(page.pagination?.total ?? items.length)
  if (items.length === 0 || offset + items.length >= total) break
}

const missing = []
const duplicated = []
for (const id of Object.keys(identityTable)) {
  for (const f of jwtIssuer.getEntityAttributes(id)) {
    const n = counts.get(`${f}|${id}`) ?? 0
    if (n === 0) missing.push(`${id} → ${f}`)
    else if (n > 1) duplicated.push(`${id} → ${f} (${n}×)`)
  }
}
check(missing.length === 0, `every implied grant is mapped${missing.length ? ` — missing ${missing.join(', ')}` : ''}`)
check(duplicated.length === 0,
  `and mapped exactly once${duplicated.length ? ` — duplicated ${duplicated.join(', ')}` : ''}`)

// ── 5. The live grid ────────────────────────────────────────────────────────

const short = (id) => id.replace(`${SID}-`, '')

async function grid(label, vault, subjects, expected) {
  console.log(`\n${label}`)
  const COLW = Math.max(10, ...subjects.map(x => short(x).length + 2))
  const KEYW = Math.max(...Object.keys(expected).map(k => k.length)) + 2
  console.log('  ' + pad('UNIT', KEYW) + subjects.map(x => pad(short(x), COLW)).join(''))

  const verdicts = new Map()
  for (const { key, tdfBytes } of vault) {
    const row = []
    for (const subject of subjects) {
      const r = await canDecrypt(tdfBytes, subject)
      const want = (expected[key] ?? []).includes(short(subject))
      verdicts.set(`${key}|${subject}`, r.ok)
      if (r.ok !== want) {
        failures++
        row.push(pad(r.ok ? 'GRANT!!' : 'DENY!!', COLW))
        if (!r.ok) console.error(`    ↳ ${key} / ${short(subject)}: ${r.reason}`)
      } else {
        row.push(pad(r.ok ? '✓' : '·', COLW))
      }
    }
    console.log('  ' + pad(key, KEYW) + row.join(''))
  }
  return verdicts
}

const personaIds = SCENARIO.personas.map(p => p.id)
const agentIds = SCENARIO.agents.map(a => a.id)

const vault = []
for (const unit of units(stored)) {
  vault.push({ key: unit.key, tdfBytes: await encrypt(unit, adminToken) })
}
check(vault.length === Object.keys(EXPECTED).length, `${vault.length} unit(s) encrypted`)

const pVerdicts = await grid('People', vault, personaIds, EXPECTED)
const aVerdicts = await grid('Agents', vault, agentIds, EXPECTED_AGENTS)

// ── 6. The invariants the agent feature rests on ────────────────────────────

console.log('\nInvariants')

const gate = []
for (const { key } of vault) {
  for (const p of personaIds) {
    if (!pVerdicts.get(`${key}|${p}`)) continue
    for (const a of agentIds) {
      if (!aVerdicts.get(`${key}|${a}`)) gate.push(`${key}: ${short(p)} granted, ${short(a)} refused`)
    }
  }
}
check(gate.length > 0, `the agent gate bites in ${gate.length} place(s)`)

for (const a of agentIds) {
  const missed = vault.filter(({ key }) =>
    personaIds.some(p => pVerdicts.get(`${key}|${p}`)) && !aVerdicts.get(`${key}|${a}`))
  check(missed.length > 0, `"${short(a)}" is refused something a person can reach (${missed.length})`)
}

// ── 7. Export, re-import, and enforce again ────────────────────────────────
//
// The whole portability claim in one pass: serialise the bundle, re-id it as an import would,
// seed it, re-encrypt from the plaintext it carries, and check that the verdicts did not move.

console.log('\nExport → import → enforce')

const bundle = JSON.parse(JSON.stringify(stored))
check(bundle.format === scenarios.FORMAT, 'the bundle carries the format marker an import checks')
check(
  JSON.stringify(bundle).includes('Full supplier pack including unit costs'),
  'the bundle carries document plaintext, which is what lets the recipient re-encrypt'
)

const imported = scenarios.save(fakeApp, scenarios.reId(bundle, 'sc-vtest003', '2026-01-01T00:00:00.000Z'))
const importedIdentities = scenarios.scenarioIdentities(imported)
for (const [id, identity] of Object.entries(importedIdentities)) {
  jwtIssuer.registerIdentity(id, identity, scenarios.scenarioDefs(imported))
}
await seeder.seedScenario(adminToken, { ...imported, identities: importedIdentities })

const importedShort = (id) => id.replace('sc-vtest003-', '')
let moved = 0
let importedCells = 0
for (const unit of units(imported)) {
  const tdfBytes = await encrypt(unit, adminToken)
  for (const p of imported.personas) {
    const want = (EXPECTED[unit.key] ?? []).includes(importedShort(p.id))
    const got = (await canDecrypt(tdfBytes, p.id)).ok
    importedCells++
    if (got !== want) {
      moved++
      fail(`imported ${unit.key} / ${importedShort(p.id)}: expected ${want ? 'GRANT' : 'DENY'}, got ${got ? 'GRANT' : 'DENY'}`)
    }
  }
}
check(moved === 0, `the imported copy enforces identically (${importedCells} decisions re-checked)`)

// ── 8. Deletion ─────────────────────────────────────────────────────────────
//
// Deleting a scenario has to stop its people being impersonable without touching the platform's
// vocabulary, because a scenario is allowed to name shipped attributes and removing `clearance`
// would take the DoW mode with it.

console.log('\nDeletion')

const dropped = scenarios.remove(fakeApp, SID)
check(Array.isArray(dropped) && dropped.length === Object.keys(identityTable).length,
  `deletion reports its ${dropped?.length} identity(ies) as no longer issuable`)
check(!scenarios.list(fakeApp).some(x => x.id === SID), 'the scenario is gone from the index')
check(scenarios.remove(fakeApp, SID) === null, 'deleting it again is a no-op rather than an error')

for (const id of dropped) jwtIssuer.unregisterIdentity(id)
let stillIssuable = false
try { jwtIssuer.issueToken(s('lead')); stillIssuable = true } catch { /* expected */ }
check(!stillIssuable, 'its personas can no longer be issued a token')

const attrs = await rpc(adminToken, 'policy.attributes.AttributesService', 'ListAttributes',
  { namespace: 'demo.com' })
const names = (attrs.attributes ?? []).map(a => a.name)
check(names.includes('vtestprogramme'), 'its invented vocabulary is deliberately left on the platform')
check(names.includes('clearance'), 'and the shipped vocabulary it borrowed is untouched')

for (const id of scenarios.remove(fakeApp, 'sc-vtest003') ?? []) jwtIssuer.unregisterIdentity(id)

// ── Done ────────────────────────────────────────────────────────────────────

rmSync(store, { recursive: true, force: true })

const cells = vault.length * (personaIds.length + agentIds.length) + importedCells
console.log(
  failures === 0
    ? `\n✓ Scenario builder verified — ${cells} live decisions, all as expected.\n`
    : `\n✗ ${failures} failure(s).\n`
)
process.exit(failures === 0 ? 0 : 1)
