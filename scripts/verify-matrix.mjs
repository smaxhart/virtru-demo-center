/**
 * Verifies every mode's access matrix against a running platform.
 *
 * For each mode: encrypts every corpus unit as the admin identity, then attempts a real rewrap
 * for every persona *and every agent* in that mode and compares the results against EXPECTED and
 * EXPECTED_AGENTS below. Nothing is simulated — each cell is a live KAS decision.
 *
 *   node scripts/verify-matrix.mjs            # all four modes
 *   node scripts/verify-matrix.mjs ic leer    # only the named modes
 *
 * Run it with the app open: the platform and the JWT issuer both live inside the Electron main
 * process. Exits non-zero on any disagreement, so it is usable in CI once the platform can be
 * started headlessly.
 *
 * It also checks the seams that no amount of UI testing would catch — that every persona and
 * agent a mode names exists in the issuer's identity table, and that every attribute FQN a
 * policy names was actually seeded. Both of those fail as a flat denial at runtime with nothing
 * in the error to say why, and a new identity added without bumping SEED_VERSION fails exactly
 * that way.
 *
 * Beyond the cells it checks two claims the scenarios make about themselves, which are the only
 * reason the agent feature is worth demoing at all: every mode must contain a case where the
 * human is granted and their agent is not, and no agent may be a superset of every persona in
 * its mode. Either one silently ceasing to hold would leave the feature present and pointless.
 *
 * Finally it round-trips one exported TDF per mode through the filesystem and re-runs the
 * verdicts against the file, since the app offers those downloads on the claim that the policy
 * travels inside them.
 */

import { writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MODES } from '../src/secure-ai/modes/index.js'
import { corpusUnits } from '../src/secure-ai/ai/corpus.js'
import identities from '../electron/ai-identities.js'
import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'

const { IDENTITIES, AGENTS, ATTRIBUTE_DEFS, NS } = identities

const PLATFORM_URL = 'http://localhost:7777'
const KAS_URL      = `${PLATFORM_URL}/kas`
const ISSUER_URL   = 'http://localhost:7779'

/**
 * mode id → { unit key → persona ids expected to be GRANTED }
 *
 * A unit key is the document id, or `docId:tierId` for a tiered document. Every persona not
 * listed is expected to be denied. For tiered documents these are the raw per-tier decisions,
 * not the tier the app ends up serving — a caller can be entitled to two tiers and be served
 * the more privileged one. The tier-served summary below the grid shows that resolution.
 */
const EXPECTED = {
  dow: {
    'sigint':           ['dow-sarah'],
    'threat-briefing':  ['dow-sarah'],
    'fvey':             ['dow-sarah', 'dow-patricia', 'dow-marcus', 'dow-james', 'dow-emma'],
    'nato':             ['dow-sarah', 'dow-patricia', 'dow-marcus', 'dow-james', 'dow-emma', 'dow-henri', 'dow-klaus'],
    'legal':            ['dow-patricia'],
    'cyber':            ['dow-marcus'],
    'patient:full':     ['dow-patricia'],
    'patient:status':   ['dow-sarah', 'dow-emma', 'dow-henri', 'dow-klaus'],
  },
  civilian: {
    // Empty policy — every authenticated caller, including the FOIA requester.
    'foia':                    ['fed-dana', 'fed-luis', 'fed-grace', 'fed-omar', 'fed-tess', 'fed-priya'],
    'taxpayer':                ['fed-dana'],
    'benefits':                ['fed-luis'],
    'source-selection':        ['fed-grace'],
    'oig':                     ['fed-omar'],
    'case-file:identified':    ['fed-luis'],
    // Any of five federal roles. Only the outside requester holds none.
    'case-file:deidentified':  ['fed-dana', 'fed-luis', 'fed-grace', 'fed-omar', 'fed-tess'],
  },
  ic: {
    'nie':                ['ic-diane', 'ic-victor', 'ic-mei', 'ic-nadia', 'ic-frank', 'ic-warren'],
    'sigint-product':     ['ic-diane'],
    'imagery':            ['ic-diane', 'ic-mei'],
    'humint':             ['ic-victor', 'ic-nadia'],
    'finding':            ['ic-nadia'],
    // ORCON holders reach the sourced version; RELIDO holders reach the tearline.
    // Nobody reaches both, which is the whole point of a tearline.
    'liaison:sourced':    ['ic-victor', 'ic-nadia'],
    'liaison:tearline':   ['ic-diane', 'ic-mei', 'ic-frank'],
  },
  leer: {
    'bolo':               ['le-nina', 'le-ray', 'le-sam', 'le-jo', 'le-hank', 'le-dee'],
    // Certified AND sworn. The certified civilian analyst is refused.
    'chri':               ['le-nina', 'le-ray'],
    'case-0047':          ['le-nina'],
    'informant':          ['le-nina'],
    'sitrep':             ['le-nina', 'le-ray', 'le-jo', 'le-hank'],
    'handoff:clinical':   ['le-jo'],
    // The medic is entitled to both tiers and is served the clinical one.
    'handoff:command':    ['le-nina', 'le-ray', 'le-jo', 'le-hank'],
  },
}

/**
 * mode id → { unit key → agent ids expected to be GRANTED }
 *
 * Same shape as EXPECTED, for the machine identities. These are written from each agent's stated
 * purpose (its `note` in the mode file), not derived from its grants — a table generated out of
 * the same data it is checking would agree with any mistake.
 *
 * The empty lists matter most: every mode has at least one document no agent can reach, so no
 * amount of switching assistants gets you there.
 */
const EXPECTED_AGENTS = {
  dow: {
    'sigint':           ['dow-agent-command'],
    'threat-briefing':  ['dow-agent-command'],
    'fvey':             ['dow-agent-intel', 'dow-agent-command'],
    'nato':             ['dow-agent-intel', 'dow-agent-command'],
    // No agent holds mission:legal, on purpose — see the note in electron/ai-identities.js.
    'legal':            [],
    'cyber':            ['dow-agent-command'],
    'patient:full':     [],
    'patient:status':   ['dow-agent-general', 'dow-agent-intel', 'dow-agent-command'],
  },
  civilian: {
    'foia':                    ['fed-agent-public', 'fed-agent-program', 'fed-agent-caseworker'],
    // No agent holds a tax, procurement, or law-enforcement CUI category.
    'taxpayer':                [],
    'benefits':                ['fed-agent-caseworker'],
    'source-selection':        [],
    'oig':                     [],
    'case-file:identified':    ['fed-agent-caseworker'],
    'case-file:deidentified':  ['fed-agent-program', 'fed-agent-caseworker'],
  },
  ic: {
    'nie':                ['ic-agent-allsource', 'ic-agent-sigint', 'ic-agent-compartmented'],
    'sigint-product':     ['ic-agent-sigint', 'ic-agent-compartmented'],
    'imagery':            ['ic-agent-sigint', 'ic-agent-compartmented'],
    'humint':             ['ic-agent-compartmented'],
    // No agent holds GAMMA. The one finding that needs it is unreachable through any assistant.
    'finding':            [],
    'liaison:sourced':    ['ic-agent-compartmented'],
    'liaison:tearline':   ['ic-agent-allsource', 'ic-agent-sigint', 'ic-agent-compartmented'],
  },
  leer: {
    'bolo':               ['le-agent-dispatch', 'le-agent-ems', 'le-agent-case'],
    'chri':               ['le-agent-case'],
    'case-0047':          ['le-agent-case'],
    'informant':          ['le-agent-case'],
    'sitrep':             ['le-agent-dispatch', 'le-agent-ems', 'le-agent-case'],
    // Only the EMS agent. The case agent outranks it everywhere else and cannot touch PHI.
    'handoff:clinical':   ['le-agent-ems'],
    'handoff:command':    ['le-agent-dispatch', 'le-agent-ems', 'le-agent-case'],
  },
}

// ── Static checks: the seams between the renderer and the main process ────────

const SEEDED = new Set(
  ATTRIBUTE_DEFS.flatMap(d => d.values.map(v => `${NS}/${d.name}/value/${v}`)),
)

function staticCheck(modes) {
  const problems = []
  for (const mode of modes) {
    for (const p of mode.personas) {
      if (!IDENTITIES[p.id]) {
        problems.push(`${mode.id}: persona "${p.id}" has no entry in electron/ai-identities.js`)
      }
    }
    // The agent roster is the newest of these seams and the easiest to get wrong: an agent in a
    // mode file but not in AGENTS authenticates as nobody, and one in AGENTS added without a
    // SEED_VERSION bump resolves to no attributes at all.
    const modeAgents = mode.agents ?? []
    if (modeAgents.length === 0) problems.push(`${mode.id}: no agents defined`)
    for (const a of modeAgents) {
      if (!AGENTS[a.id]) {
        problems.push(`${mode.id}: agent "${a.id}" has no entry in AGENTS in electron/ai-identities.js`)
      }
    }
    if (mode.defaultAgentId && !modeAgents.some(a => a.id === mode.defaultAgentId)) {
      problems.push(`${mode.id}: defaultAgentId "${mode.defaultAgentId}" is not one of this mode's agents`)
    }
    for (const unit of corpusUnits(mode.documents)) {
      for (const fqn of unit.policy) {
        if (!SEEDED.has(fqn)) {
          problems.push(`${mode.id}/${unit.key}: policy names "${fqn}", which ATTRIBUTE_DEFS does not create`)
        }
      }
      if (unit.policy.length > 20) {
        problems.push(`${mode.id}/${unit.key}: ${unit.policy.length} attribute values — over the 20-value ceiling, this policy will deny everyone`)
      }
    }
    const keys = new Set(corpusUnits(mode.documents).map(u => u.key))
    for (const [table, name] of [[EXPECTED, 'EXPECTED'], [EXPECTED_AGENTS, 'EXPECTED_AGENTS']]) {
      const expected = table[mode.id]
      if (!expected) { problems.push(`${mode.id}: no ${name} matrix defined`); continue }
      for (const key of Object.keys(expected)) {
        if (!keys.has(key)) problems.push(`${mode.id}: ${name} has "${key}", which is not a unit in the corpus`)
      }
      for (const key of keys) {
        if (!(key in expected)) problems.push(`${mode.id}: unit "${key}" has no ${name} entry`)
      }
    }
  }
  // Across modes, not per mode: an agent named by two scenarios would make one mode's matrix
  // depend on the other's edits. Only meaningful on a full run — a filtered run cannot see
  // the mode that would collide.
  if (modes.length === MODES.length) {
    for (const id of Object.keys(AGENTS)) {
      const owners = modes.filter(m => (m.agents ?? []).some(a => a.id === id))
      if (owners.length === 0) problems.push(`agent "${id}" exists in AGENTS but no mode offers it`)
      if (owners.length > 1) {
        problems.push(`agent "${id}" is claimed by more than one mode: ${owners.map(m => m.id).join(', ')}`)
      }
    }
  }
  return problems
}

// ── Live rewrap ──────────────────────────────────────────────────────────────

async function token(personaId) {
  const res = await fetch(`${ISSUER_URL}/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username: personaId }),
  })
  if (!res.ok) throw new Error(`token for ${personaId}: HTTP ${res.status}`)
  return (await res.json()).access_token
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
  const c = client(adminToken)
  const blob = new Blob([new TextEncoder().encode(unit.text)], { type: 'text/plain' })
  const out = await c.createTDF({
    source: { type: 'stream', location: blob.stream() },
    defaultKASEndpoint: KAS_URL,
    autoconfigure: false,
    attributes: unit.policy.map(fqn => ({ attribute: fqn })),
  })
  return await drain(out)
}

async function canDecrypt(tdfBytes, personaId) {
  try {
    const c = client(await token(personaId))
    const out = await c.read({
      source: { type: 'stream', location: new Blob([tdfBytes]).stream() },
      allowedKASEndpoints: [KAS_URL],
    })
    return { ok: true, bytes: (await drain(out)).length }
  } catch (err) {
    return { ok: false, reason: (err?.message ?? String(err)).split('\n')[0].slice(0, 90) }
  }
}

// ── The exported file ────────────────────────────────────────────────────────

/**
 * Both the Corpus page and a granted chat answer offer the TDF for download, on the claim
 * that the file you walk away with is still enforced. That is only true if what lands on the
 * disk is a complete TDF with its policy intact — so prove it against the file rather than
 * against the buffer it came from, once per mode.
 *
 * Picks a unit that separates somebody: a granted persona and a denied one both re-run
 * against the round-tripped copy. A truncated or mangled export would flip the grant.
 *
 * @returns {Promise<number>} failures found
 */
async function checkExport(mode, vault, expected, personas) {
  const pick = vault.find(({ unit }) => {
    const granted = expected[unit.key] ?? []
    return granted.length > 0 && personas.some(p => !granted.includes(p))
  })
  // A mode where every unit is reachable by everyone has nothing to prove here.
  if (!pick) {
    console.log(`\n  No unit in ${mode.id} separates any two personas — export check skipped.`)
    return 0
  }

  const yes  = expected[pick.unit.key][0]
  const no   = personas.find(p => !expected[pick.unit.key].includes(p))
  const file = join(tmpdir(), `verify-export-${mode.id}-${pick.unit.key.replace(/[^a-z0-9]+/gi, '-')}.tdf`)

  let failures = 0
  try {
    writeFileSync(file, Buffer.from(pick.tdfBytes))
    const onDisk = readFileSync(file)

    const size = onDisk.length === pick.tdfBytes.length
    const kept = await canDecrypt(onDisk, yes)
    const held = await canDecrypt(onDisk, no)

    if (!size)     { failures++; console.error(`    ✗ export ${pick.unit.key}: ${onDisk.length} B on disk vs ${pick.tdfBytes.length} B in the vault`) }
    if (!kept.ok)  { failures++; console.error(`    ✗ export ${pick.unit.key}: ${yes} could read it in the vault but not off the disk — ${kept.reason}`) }
    if (held.ok)   { failures++; console.error(`    ✗ export ${pick.unit.key}: ${no} was denied in the vault but read the exported file — the policy did not travel`) }

    if (!failures) {
      console.log(`\n  Exported ${pick.unit.key} (${onDisk.length} B) and re-read it from disk: ` +
        `${yes} still granted, ${no} still refused.`)
    }
  } finally {
    try { unlinkSync(file) } catch { /* already gone */ }
  }
  return failures
}

// ──────────────────────────────────────────────────────────────────────────────

const wanted = process.argv.slice(2)
const modes = wanted.length ? MODES.filter(m => wanted.includes(m.id)) : MODES
if (!modes.length) {
  console.error(`No such mode. Known: ${MODES.map(m => m.id).join(', ')}`)
  process.exit(1)
}

const problems = staticCheck(modes)
if (problems.length) {
  console.error('Static checks failed — fix these before the live run means anything:\n')
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log(`Static checks passed: every persona and agent is known to the issuer, every policy FQN is seeded.\n`)

const health = await fetch(`${PLATFORM_URL}/healthz`).catch(() => null)
if (!health?.ok) {
  console.error(`No platform on ${PLATFORM_URL}. Start the app first (npm run dev).`)
  process.exit(1)
}

const adminToken = await token('admin')
const pad = (s, n) => String(s).padEnd(n)
let failures = 0
let exportFailures = 0
let claimFailures = 0
let cells = 0

// Columns are labelled by the part after the mode prefix — the prefix is the same down every
// column and would just eat the width. Agents keep "agent-" too, so the two grids never look
// interchangeable.
const short = id => id.replace(/^[^-]+-/, '')

/**
 * One live grid: every unit × every subject, checked against its expectation.
 *
 * @returns {{grid: Map<string, {ok: boolean, reason?: string}>, failures: number}}
 *   grid keyed `unitKey|subjectId`
 */
async function runGrid(label, vault, subjects, expected, keyWidth) {
  const COLW = Math.max(10, ...subjects.map(s => short(s).length + 2))
  console.log(`\n  ${label}`)
  console.log('  ' + pad('UNIT', keyWidth) + subjects.map(s => pad(short(s), COLW)).join(''))

  const grid = new Map()
  let bad = 0
  for (const { unit, tdfBytes } of vault) {
    const row = []
    for (const s of subjects) {
      const r = await canDecrypt(tdfBytes, s)
      const want = (expected[unit.key] ?? []).includes(s)
      cells++
      if (r.ok !== want) {
        bad++
        row.push(pad(r.ok ? 'GRANT!!' : 'DENY!!', COLW))
        if (!r.ok) console.error(`    ↳ ${unit.key} / ${s}: ${r.reason}`)
      } else {
        row.push(pad(r.ok ? '✓' : '·', COLW))
      }
      grid.set(`${unit.key}|${s}`, r)
    }
    console.log('  ' + pad(unit.key, keyWidth) + row.join(''))
  }
  return { grid, failures: bad }
}

/**
 * The two claims the scenarios make about themselves, checked against the live grids.
 *
 * These are not cell comparisons — they are properties of the roster as a whole, and they are the
 * difference between a feature that is present and one that is worth showing. Both are asserted
 * from measured verdicts rather than from the grant tables, so narrowing a policy can break them
 * just as easily as narrowing a grant.
 *
 * @returns {number} failures found
 */
function checkClaims(mode, units, personas, agents, pGrid, aGrid) {
  const opens = (grid, key, id) => grid.get(`${key}|${id}`)?.ok === true
  let bad = 0

  // 1. Somewhere in this mode, a human is granted and their agent is refused. Without this the
  //    intersection never changes an outcome and the whole feature is invisible.
  const gaps = []
  for (const { key } of units) {
    for (const p of personas) {
      if (!opens(pGrid, key, p)) continue
      for (const a of agents) {
        if (!opens(aGrid, key, a)) gaps.push({ key, p, a })
      }
    }
  }
  if (gaps.length === 0) {
    bad++
    console.error(`    ✗ ${mode.id}: no unit is granted to a persona and refused to an agent — ` +
      `the agent gate never changes an outcome in this scenario`)
  } else {
    const g = gaps[0]
    console.log(`\n  Agent gate bites in ${gaps.length} place(s) — e.g. ${short(g.p)} is granted ` +
      `${g.key} and ${short(g.a)} is not.`)
  }

  // 2. No agent is a superset of every persona. If one is, "use the broad agent" is the whole
  //    answer and the ceiling stops meaning anything.
  for (const a of agents) {
    const reachable = units.filter(u => personas.some(p => opens(pGrid, u.key, p)))
    const missed = reachable.filter(u => !opens(aGrid, u.key, a))
    if (missed.length === 0) {
      bad++
      console.error(`    ✗ ${mode.id}: agent "${a}" opens every unit any persona can reach — ` +
        `it is a superset of the whole roster, so selecting it removes the ceiling entirely`)
    }
  }

  return bad
}

for (const mode of modes) {
  const units = corpusUnits(mode.documents)
  const personas = mode.personas.map(p => p.id)
  const agents = (mode.agents ?? []).map(a => a.id)
  const expected = EXPECTED[mode.id]
  const expectedAgents = EXPECTED_AGENTS[mode.id]

  console.log(`\n━━ ${mode.name} — encrypting ${units.length} units…`)

  const vault = []
  for (const unit of units) vault.push({ unit, tdfBytes: await encrypt(unit, adminToken) })

  const KEYW = Math.max(20, ...units.map(u => u.key.length + 2))

  const people = await runGrid('PEOPLE', vault, personas, expected, KEYW)
  failures += people.failures

  const machines = await runGrid('AGENTS', vault, agents, expectedAgents, KEYW)
  failures += machines.failures

  // Tier fallback: which version each caller is actually served. Shown for both subjects, since
  // the app serves the first tier they *jointly* open and that is not always either one's best.
  for (const doc of mode.documents.filter(d => d.tiers)) {
    console.log(`\n  ${doc.label} — tier served (most privileged first):`)
    for (const [who, ids, grid] of [['person', personas, people.grid], ['agent', agents, machines.grid]]) {
      for (const id of ids) {
        const served = doc.tiers.find(t => grid.get(`${doc.id}:${t.id}|${id}`)?.ok)
        console.log(`    ${pad(who, 8)}${pad(short(id), 18)} ${served ? served.id : '— nothing'}`)
      }
    }
  }

  claimFailures += checkClaims(mode, units, personas, agents, people.grid, machines.grid)
  exportFailures += await checkExport(mode, vault, expected, personas)
}

console.log()
if (failures === 0 && exportFailures === 0 && claimFailures === 0) {
  console.log(`All ${cells} cells across ${modes.length} mode(s) match the intended matrix for both ` +
    `people and agents, every scenario still demonstrates the agent ceiling, and every exported ` +
    `TDF was still enforced after a round trip through the filesystem.`)
} else {
  if (failures) console.log(`${failures} of ${cells} cell(s) disagree with the intended matrix — marked above.`)
  if (claimFailures) console.log(`${claimFailures} scenario claim(s) about the agent roster no longer hold — marked above.`)
  if (exportFailures) console.log(`${exportFailures} export check(s) failed — marked above.`)
  process.exit(1)
}
