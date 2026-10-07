/**
 * Verifies the GCAP page against a running platform.
 *
 *   node scripts/verify-gcap.mjs
 *
 * Needs the app open: the platform (:7777) and the JWT issuer (:7779) live in the Electron main
 * process, and the `gcap-` identities only exist once the AI seeder has run at seed version 4.
 *
 * What it proves, in order:
 *   1. Static seams — every GCAP persona is known to the issuer and vice versa, every policy FQN
 *      names a seeded value, no policy is over the 20-value cap. These fail at runtime as a flat
 *      denial with nothing in the error to say why.
 *   2. The 10 × 15 grid — a real rewrap for every persona against every encrypted unit, compared to
 *      EXPECTED below, which is written out by hand and deliberately NOT derived from the policies
 *      in data.js: a check that computed its own answer could never disagree with it.
 *   3. Tree sizes — the visible-item count per persona, which is the number the talk track quotes.
 *   4. Revocation — the compromised account opens its files, is revoked, is then refused the same
 *      files by the same KAS, and the restore brings it back. An unauthenticated client is refused
 *      throughout. Always restores, even on failure, so a red run never leaves an account withdrawn.
 *   5. Banners — the marking derived from a few policies, since those strings are what the audience reads.
 *   6. Free play — editing a person changes the KAS's answer at once (the platform's subject mappings
 *      are rewritten, not a token), an added person is entitled, a removed one is not, and reset puts
 *      everyone back. Needs the app started with `--remote-debugging-port=9333` so the edits can be
 *      made through the same IPC the page uses; without it this section is reported as SKIPPED,
 *      never as passed.
 *   7. A day on the programme — the four scripted events are applied in order and the units whose
 *      KAS answer changed must be exactly the hand-written set below. Policy editing: a unit
 *      re-encrypted under a wider policy opens for the people the new policy admits and nobody else.
 *   8. The "why" chips — the page's explanation of a decision (entitle.js + policyMatch.js) must agree
 *      with the KAS for every person and unit; the chips explain, they never decide.
 */

import { OpenTDF } from '@opentdf/sdk/singlecontainer'
import { authTokenInterceptor } from '@opentdf/sdk'
import identities from '../electron/ai-identities.js'
import { PERSONAS, DOCUMENTS, UNITS, COMPROMISED_ID } from '../src/gcap/data.js'
import { markingOf } from '../src/gcap/marking.js'
import { DAY, cleanGrants } from '../src/gcap/events.js'
import { entitlementsOf, specFromPolicy, policyFromSpec } from '../src/gcap/entitle.js'
import { satisfiesPolicy } from '../src/data/policyMatch.js'

const { IDENTITIES, ATTRIBUTE_DEFS, NS } = identities

const PLATFORM_URL = 'http://localhost:7777'
const KAS_URL = `${PLATFORM_URL}/kas`
const ISSUER_URL = 'http://localhost:7779'

/** persona → the tree, as doc id → the tier served (or `true` for an untiered document). */
const EXPECTED_TREE = {
  'gcap-marco':   { overview: true, governance: true, icd: 'full', engine: true, sensors: true, workorder: true, bom: true, 'it-avionics': true, 'nato-paper': true },
  'gcap-harriet': { overview: true, governance: true, icd: 'full', sensors: true, bom: true, 'uk-ew': true, 'nato-paper': true, 'custody-log': true },
  'gcap-kenji':   { overview: true, governance: true, icd: 'extract', engine: true, workorder: true, bom: true, 'jp-range': true },
  'gcap-priya':   { overview: true, governance: true, icd: 'extract', sensors: true, bom: true, 'nato-paper': true },
  'gcap-oliver':  { overview: true, governance: true, icd: 'extract', funding: true },
  'gcap-giulia':  { overview: true, governance: true, icd: 'extract', export: true },
  'gcap-wren':    { overview: true, icd: 'extract', workorder: true },
  'gcap-owen':    { overview: true, workorder: true },
  'gcap-sanjay':  { overview: true, 'custody-log': true },
  'gcap-ryan':    { overview: true },
}

const EXPECTED_COUNTS = {
  'gcap-marco': 9, 'gcap-harriet': 8, 'gcap-kenji': 7, 'gcap-priya': 6, 'gcap-oliver': 4,
  'gcap-giulia': 4, 'gcap-wren': 3, 'gcap-owen': 2, 'gcap-sanjay': 2, 'gcap-ryan': 1,
}

/** Raw per-tier decisions for the tiered document: the tier served is the more privileged one held. */
const EXPECTED_ICD_RAW = {
  full:    ['gcap-marco', 'gcap-harriet'],
  extract: ['gcap-marco', 'gcap-harriet', 'gcap-kenji', 'gcap-priya', 'gcap-oliver', 'gcap-giulia', 'gcap-wren'],
}

/** Units whose answer changes when the day's four events run, written out by hand. */
const EXPECTED_DAY = {
  'owen-acquired':    { 'gcap-owen':  { lost: ['workorder'], gained: [] } },
  'wren-compromised': { 'gcap-wren':  { lost: ['icd:extract', 'workorder'], gained: [] } },
  'priya-lapse':      { 'gcap-priya': { lost: ['sensors', 'bom', 'nato-paper'], gained: [] } },
  'kenji-moved':      { 'gcap-kenji': { lost: ['engine', 'jp-range'], gained: ['icd:full'] } },
}

const EXPECTED_BANNERS = {
  overview:      'OPEN // ANY AUTHENTICATED ACE USER',
  'uk-ew':       'UK TOP SECRET // UK ONLY // WP SENSORS',
  'jp-range':    '秘 // JPN ONLY // WP PROPULSION',
  'it-avionics': 'SEGRETO // ITA ONLY // WP INTEGRATION',
  'nato-paper':  'GCAP SECRET // REL TO NATO',
  governance:    'GCAP RESTRICTED // REL TO GCAP PARTNERS // TIER PARTNER',
  funding:       'GCAP RESTRICTED // REL TO GCAP PARTNERS // FINANCE ROLE',
}

// ── Static ───────────────────────────────────────────────────────────────────

function staticChecks() {
  const problems = []
  const seeded = new Set(ATTRIBUTE_DEFS.flatMap(d => d.values.map(v => `${NS}/${d.name}/value/${v}`)))

  const gcapIds = Object.keys(IDENTITIES).filter(id => id.startsWith('gcap-')).sort()
  const pageIds = PERSONAS.map(p => p.id).sort()
  for (const id of pageIds) if (!gcapIds.includes(id)) problems.push(`page persona ${id} is unknown to the issuer`)
  for (const id of gcapIds) if (!pageIds.includes(id)) problems.push(`issuer identity ${id} is not on the page`)

  for (const u of UNITS) {
    for (const fqn of u.policy) if (!seeded.has(fqn)) problems.push(`${u.key} names ${fqn}, which is not seeded`)
    if (u.policy.length > 20) problems.push(`${u.key} carries ${u.policy.length} values, over the 20-value cap`)
  }
  if (EXPECTED_COUNTS && UNITS.length !== 15) problems.push(`expected 15 units, found ${UNITS.length}`)
  if (DOCUMENTS.length !== 14) problems.push(`expected 14 documents, found ${DOCUMENTS.length}`)
  return problems
}

// ── Live ─────────────────────────────────────────────────────────────────────

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
  const blob = new Blob([new TextEncoder().encode(unit.text)], { type: 'text/plain' })
  const out = await client(adminToken).createTDF({
    source: { type: 'stream', location: blob.stream() },
    defaultKASEndpoint: KAS_URL,
    autoconfigure: false,
    attributes: unit.policy.map(fqn => ({ attribute: fqn })),
  })
  return drain(out)
}

async function canOpen(tdfBytes, accessToken) {
  try {
    const out = await client(accessToken).read({
      source: { type: 'stream', location: new Blob([tdfBytes]).stream() },
      allowedKASEndpoints: [KAS_URL],
    })
    return { ok: true, text: (await drain(out)).toString('utf8') }
  } catch (err) {
    return { ok: false, reason: (err?.message ?? String(err)).split('\n')[0].slice(0, 90) }
  }
}

async function cdpRoster() {
  const page = await cdp()
  if (!page) return null
  try {
    const { people } = await page.call('window.electronAPI.gcapPeople()')
    return Object.fromEntries(people.map(p => [p.id, p.grants]))
  } finally { page.close() }
}

async function issuer(path, username) {
  const res = await fetch(`${ISSUER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username }),
  })
  return { status: res.status, body: await res.json().catch(() => null) }
}


// ── Free play (through the app's own IPC, over the debug port) ───────────────

const CDP_PORT = process.env.GCAP_CDP_PORT ?? '9333'

async function cdp() {
  const targets = await fetch(`http://127.0.0.1:${CDP_PORT}/json`).then(r => r.json()).catch(() => null)
  const page = targets?.find(t => t.type === 'page' && t.webSocketDebuggerUrl && !t.url.startsWith('devtools:'))
  if (!page) return null
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('CDP connect failed')) })
  let n = 0
  const pending = new Map()
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data)
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id) }
  }
  return {
    async call(expr) {
      const id = ++n
      const done = new Promise(res => pending.set(id, res))
      ws.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression: expr, awaitPromise: true, returnByValue: true } }))
      const d = await done
      if (d.result?.exceptionDetails) throw new Error(d.result.exceptionDetails.exception?.description ?? 'evaluate failed')
      return d.result?.result?.value
    },
    close: () => ws.close(),
  }
}

let failures = 0
const check = (label, ok, detail = '') => {
  if (!ok) failures++
  console.log(`  ${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`)
}

// ─────────────────────────────────────────────────────────────────────────────

const problems = staticChecks()
if (problems.length) {
  console.error('Static checks failed:\n')
  for (const p of problems) console.error(`  ✗ ${p}`)
  process.exit(1)
}
console.log('Static checks passed: 10 personas, 14 documents, 15 units, every FQN seeded.\n')

const health = await fetch(`${PLATFORM_URL}/healthz`).catch(() => null)
if (!health?.ok) {
  console.error(`No platform on ${PLATFORM_URL}. Start the app first (npm run dev).`)
  process.exit(1)
}

try {
  await issuer('/restore', '*')
  const adminToken = await token('admin')

  console.log('Encrypting 15 units as admin…')
  const vault = new Map()
  for (const u of UNITS) vault.set(u.key, { unit: u, bytes: await encrypt(u, adminToken) })

  // Raw grid: one real rewrap per persona per unit.
  console.log('\nGrid (● granted, · refused):')
  const tokens = Object.fromEntries(await Promise.all(PERSONAS.map(async p => [p.id, await token(p.id)])))
  const raw = {}
  for (const p of PERSONAS) {
    raw[p.id] = {}
    const cells = await Promise.all(UNITS.map(async u => [u.key, await canOpen(vault.get(u.key).bytes, tokens[p.id])]))
    for (const [k, r] of cells) raw[p.id][k] = r
    console.log(`  ${p.id.padEnd(13)} ${UNITS.map(u => (raw[p.id][u.key].ok ? '●' : '·')).join(' ')}`)
  }
  console.log(`  ${''.padEnd(13)} ${UNITS.map((u, i) => String.fromCharCode(97 + i)).join(' ')}   (${UNITS.map((u, i) => `${String.fromCharCode(97 + i)}=${u.key}`).join(' ')})\n`)

  console.log('Tree per persona:')
  for (const p of PERSONAS) {
    const served = {}
    for (const d of DOCUMENTS) {
      const tiers = UNITS.filter(u => u.doc.id === d.id)
      const hit = tiers.find(u => raw[p.id][u.key].ok)
      if (hit) served[d.id] = hit.tier ? hit.tier.id : true
    }
    const want = EXPECTED_TREE[p.id]
    const same = JSON.stringify(Object.entries(served).sort()) === JSON.stringify(Object.entries(want).sort())
    const count = Object.keys(served).length
    check(`${p.id}: ${count} visible (expected ${EXPECTED_COUNTS[p.id]})`, same && count === EXPECTED_COUNTS[p.id],
      `got ${Object.keys(served).sort().join(',')} wanted ${Object.keys(want).sort().join(',')}`)
  }

  console.log('\nTearline (raw per-tier decisions):')
  for (const tier of ['full', 'extract']) {
    const got = PERSONAS.map(p => p.id).filter(id => raw[id][`icd:${tier}`].ok).sort()
    check(`icd:${tier}`, JSON.stringify(got) === JSON.stringify([...EXPECTED_ICD_RAW[tier]].sort()), got.join(','))
  }

  // Content must round-trip, not just open.
  const sample = raw['gcap-marco']['engine']
  check('decrypted text equals the original', sample.ok && sample.text === DOCUMENTS.find(d => d.id === 'engine').text)

  console.log('\nWhy chips agree with the key server:')
  {
    const roster = (await cdpRoster())
    if (roster) {
      let disagree = []
      for (const p of PERSONAS) for (const u of UNITS) {
        const chips = u.policy.length === 0 || satisfiesPolicy(entitlementsOf(roster[p.id]), u.policy)
        if (chips !== raw[p.id][u.key].ok) disagree.push(`${p.id}×${u.key}`)
      }
      check(`chips match the KAS for all ${PERSONAS.length * UNITS.length} person × unit pairs`, disagree.length === 0, disagree.join(', '))
    } else console.log('  SKIPPED — needs the debug port.')
  }

  console.log('\nRevocation:')
  const stolenFile = vault.get('workorder').bytes
  const before = await canOpen(stolenFile, await token(COMPROMISED_ID))
  check('credential opens the file while live', before.ok, before.reason)
  check('no identity is refused', !(await canOpen(stolenFile, 'no-credential')).ok)

  const rv = await issuer('/revoke', COMPROMISED_ID)
  check('issuer accepts the revoke', rv.status === 200 && rv.body?.ok === true, JSON.stringify(rv))
  const after = await canOpen(stolenFile, await token(COMPROMISED_ID))
  check('same file, same KAS, refused after revoke', !after.ok, 'still opened')
  const afterOverview = await canOpen(vault.get('overview').bytes, await token(COMPROMISED_ID))
  console.log(`    (open-to-all overview after revoke: ${afterOverview.ok ? 'still opens' : 'refused'} — ${afterOverview.ok ? 'empty policy needs no entitlement' : afterOverview.reason})`)
  const other = await canOpen(stolenFile, await token('gcap-wren'))
  check('a colleague with the same entitlement is unaffected', other.ok, other.reason)
  const bad = await issuer('/revoke', 'admin')
  check('a non-gcap identity cannot be revoked', bad.body?.ok === false, JSON.stringify(bad))

  await issuer('/restore', COMPROMISED_ID)
  const restored = await canOpen(stolenFile, await token(COMPROMISED_ID))
  check('restore brings the account back', restored.ok, restored.reason)

  console.log('\nFree play:')
  const page = await cdp()
  if (!page) {
    console.log(`  SKIPPED — no debug port on :${CDP_PORT}. Start the app with --remote-debugging-port=${CDP_PORT} to run these.`)
  } else {
    const api = (fn, ...args) => page.call(`window.electronAPI.${fn}(${args.map(a => JSON.stringify(a)).join(',')})`)
    const opens = async (personaId, unitKey) => (await canOpen(vault.get(unitKey).bytes, await token(personaId))).ok
    const grants = async (id) => (await api('gcapPeople')).people.find(p => p.id === id)?.grants
    try {
      await api('gcapResetPeople')

      // Priya (secret · gbr · sensors · partner) demoted to CUI: every SECRET unit goes, CUI ones stay.
      check('baseline: priya opens sensors, bom and governance',
        (await opens('gcap-priya', 'sensors')) && (await opens('gcap-priya', 'bom')) && (await opens('gcap-priya', 'governance')))
      const p0 = await grants('gcap-priya')
      const t0 = Date.now()
      await api('gcapSetPerson', 'gcap-priya', { ...p0, clearance: 'cui' })
      const refused = !(await opens('gcap-priya', 'sensors')) && !(await opens('gcap-priya', 'bom'))
      check(`demoted to CUI: sensors and bom refused on the very next rewrap (${Date.now() - t0} ms incl. edit)`, refused)
      check('demoted to CUI: governance and the icd extract still open',
        (await opens('gcap-priya', 'governance')) && (await opens('gcap-priya', 'icd:extract')))
      check('a colleague is unaffected by the edit', await opens('gcap-marco', 'sensors'))
      await api('gcapSetPerson', 'gcap-priya', p0)
      check('restored to SECRET: sensors opens again', await opens('gcap-priya', 'sensors'))

      // Ryan (unclassified · usa) is given a GCAP footing one grant at a time.
      const r0 = await grants('gcap-ryan')
      check('baseline: ryan refused governance', !(await opens('gcap-ryan', 'governance')))
      await api('gcapSetPerson', 'gcap-ryan', { clearance: 'cui', nationality: 'gbr' })
      check('cui + gbr alone is not enough for governance (needs tier partner)', !(await opens('gcap-ryan', 'governance')))
      await api('gcapSetPerson', 'gcap-ryan', { clearance: 'cui', nationality: 'gbr', supplytier: 'partner' })
      check('cui + gbr + partner opens governance', await opens('gcap-ryan', 'governance'))
      check('…but not funding (needs the finance role)', !(await opens('gcap-ryan', 'funding')))
      await api('gcapSetPerson', 'gcap-ryan', r0)

      // A person who never existed.
      const added = await api('gcapAddPerson', { name: 'Elena Rossi', nation: 'ita', grants: { clearance: 'cui', nationality: 'ita', workpackage: 'airframe', supplytier: 'tier3' } })
      check('an added person gets a gcap-x- id', /^gcap-x-elena-rossi-\d+$/.test(added?.id ?? ''), String(added?.id))
      check('added person (cui · ita · airframe · tier3) opens the work order', await opens(added.id, 'workorder'))
      check('…but not governance (tier3 is not partner)', !(await opens(added.id, 'governance')))
      check('…and not SECRET material', !(await opens(added.id, 'sensors')))
      await api('gcapRemovePerson', added.id)
      check('removed: the issuer no longer knows the person, so no token at all',
        (await fetch(`${ISSUER_URL}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ username: added.id }) })).status === 400)
      const mappingsLeft = await api('gcapResetPeople')
      check('removed: no mapping is left behind for them on the platform', mappingsLeft.deleted === 0, `reset had to delete ${mappingsLeft.deleted}`)
      check('a shipped person cannot be removed', await api('gcapRemovePerson', 'gcap-marco').then(() => false, () => true))

      // Values outside the seeded vocabulary are refused rather than silently mapped to nothing.
      check('an unseeded value is rejected', await api('gcapSetPerson', 'gcap-ryan', { nationality: 'atlantis' }).then(() => false, () => true))
      check('a non-gcap subject cannot be edited', await api('gcapSetPerson', 'dow-sarah', { clearance: 'cui' }).then(() => false, () => true))

      const r = await api('gcapResetPeople')
      check('reset: an edited person is back to shipped grants', (await grants('gcap-priya')).clearance === 'secret')
      await api('gcapSetPerson', 'gcap-ryan', { clearance: 'cui', nationality: 'gbr', supplytier: 'partner' })
      await api('gcapResetPeople')
      check('reset: ryan is refused governance again', !(await opens('gcap-ryan', 'governance')))
      check('reset: the roster is the ten shipped people', r.people.length === 10 && r.people.every(p => !p.added), String(r.people.length))
      check('reset is idempotent (a second one changes nothing)', (await api('gcapResetPeople')).created === 0)

      // ── A day on the programme ──
      console.log('\nA day on the programme (each event applied in order; changed units must equal the hand-written set):')
      const snapshot = async () => {
        const out = {}
        for (const p of PERSONAS) {
          const t = await token(p.id)
          out[p.id] = Object.fromEntries(await Promise.all(UNITS.map(async u => [u.key, (await canOpen(vault.get(u.key).bytes, t)).ok])))
        }
        return out
      }
      let prev = await snapshot()
      for (const ev of DAY) {
        if (ev.change.kind === 'revoke') await api('gcapRevoke', ev.person)
        else {
          const g = await grants(ev.person)
          await api('gcapSetPerson', ev.person, cleanGrants(ev.change.apply(g)))
        }
        const next = await snapshot()
        const got = {}
        for (const p of PERSONAS) for (const u of UNITS) {
          if (prev[p.id][u.key] === next[p.id][u.key]) continue
          const e = (got[p.id] ??= { lost: [], gained: [] })
          ;(next[p.id][u.key] ? e.gained : e.lost).push(u.key)
        }
        for (const e of Object.values(got)) { e.lost.sort(); e.gained.sort() }
        const want = Object.fromEntries(Object.entries(EXPECTED_DAY[ev.id]).map(([k, v]) => [k, { lost: [...v.lost].sort(), gained: [...v.gained].sort() }]))
        check(`${ev.time} ${ev.title}: ${JSON.stringify(got)}`, JSON.stringify(got) === JSON.stringify(want), `wanted ${JSON.stringify(want)}`)
        prev = next
      }
      const wrenOverview = await canOpen(vault.get('overview').bytes, await token('gcap-wren'))
      check('revoked Wren still opens the open-to-all overview (its policy needs no entitlement)', wrenOverview.ok, wrenOverview.reason)
      await api('gcapRestore', '*').catch(() => {})
      await issuer('/restore', '*')
      await api('gcapResetPeople')
      const back = await snapshot()
      check('start of day: the grid is the baseline again', PERSONAS.every(p => UNITS.every(u => back[p.id][u.key] === raw[p.id][u.key].ok)))

      // ── Editing a document's policy ──
      console.log('\nEditing a document policy (engine report re-encrypted with work package sensors added):')
      const engine = UNITS.find(u => u.key === 'engine')
      const widened = specFromPolicy(engine.policy)
      widened.workpackage = [...widened.workpackage, 'sensors']
      const widenedBytes = await encrypt({ ...engine, policy: policyFromSpec(widened) }, adminToken)
      const allowed = []
      for (const p of PERSONAS) if ((await canOpen(widenedBytes, await token(p.id))).ok) allowed.push(p.id)
      check('the wider policy admits exactly marco, kenji, harriet and priya', JSON.stringify(allowed.sort()) === JSON.stringify(['gcap-harriet', 'gcap-kenji', 'gcap-marco', 'gcap-priya']), allowed.join(','))
      check('the original ciphertext is unchanged: harriet is still refused', !(await canOpen(vault.get('engine').bytes, await token('gcap-harriet'))).ok)
    } finally {
      await api('gcapResetPeople').catch(() => {})
      page.close()
    }
  }

  console.log('\nBanners:')
  for (const [id, want] of Object.entries(EXPECTED_BANNERS)) {
    const doc = DOCUMENTS.find(d => d.id === id)
    const got = markingOf(doc.policy ?? []).banner
    check(`${id}: ${got}`, got === want, `wanted ${want}`)
  }
  for (const d of DOCUMENTS) console.log(`    ${d.id.padEnd(12)} ${markingOf(d.policy ?? d.tiers[0].policy).banner}`)
} finally {
  await issuer('/restore', '*').catch(() => {})
}

console.log(failures ? `\n${failures} check(s) failed.` : '\nAll GCAP checks passed.')
process.exit(failures ? 1 : 0)
