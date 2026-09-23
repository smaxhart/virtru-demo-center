import { coalitionFqns, nationFqns } from '../data/coalitions.js'

const NS = 'https://demo.com/attr'

// REL TO expands to the member nations, because nobody holds an entitlement called FVEY.
//
// A person qualifies for REL TO FVEY by *being* American, British, Canadian, Australian or a New
// Zealander. `nationality` is ANY_OF, so listing the members grants anyone holding one of them —
// which is the actual policy, and it is also what makes a refusal legible: Henri is refused because
// FRA is not in the Five Eyes, not because he lacks an attribute named after the club.
//
// This was briefly modelled as a single `relto:fvey` value after the 32-nation NATO roster was
// measured denying all seven personas. That measurement was real but the diagnosis was wrong: the
// roster was over the platform's 20-value ceiling *and* named 17 nations that were never seeded.
// `src/data/coalitions.js` fixes both by intersecting the alliance with the seeded set — NATO comes
// out at 13 values and FVEY at 5, both verified granting live. `relto` still exists on the platform
// for the Collaborate and Architecture simulations; no file policy should name it.
const FVEY = coalitionFqns('fvey')
const NATO = coalitionFqns('nato')

// Parse standard US classification marking from first line of text.
// Returns { fqns, firstLine, tokens } — fqns is empty if no clearance token found.
export function parseMarkingToFqns(text) {
  const firstLine = text.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
  const tokens = firstLine.toUpperCase().split('//').map(t => t.trim()).filter(Boolean)

  const fqns = new Set()
  let foundClearance = false

  for (const token of tokens) {
    if (/^TOP\s+SECRET/.test(token) || token === 'TS' || token === 'TS/SCI' || token === 'SCI') {
      fqns.add(`${NS}/clearance/value/ts-sci`); foundClearance = true
    } else if (token === 'SECRET' || token === 'S') {
      fqns.add(`${NS}/clearance/value/secret`); foundClearance = true
    } else if (token === 'CONFIDENTIAL' || token === 'C') {
      fqns.add(`${NS}/clearance/value/cui`); foundClearance = true
    } else if (token === 'UNCLASSIFIED' || token === 'U') {
      fqns.add(`${NS}/clearance/value/unclassified`); foundClearance = true
    } else if (token.includes('FVEY')) {
      for (const f of FVEY) fqns.add(f)
    } else if (token.includes('NATO')) {
      for (const f of NATO) fqns.add(f)
    } else if (/^REL\s+TO\s+USA$/.test(token)) {
      // Only the bare form. `REL TO USA, FVEY` is a FVEY marking and is caught above.
      for (const f of nationFqns('usa')) fqns.add(f)
    } else if (token === 'INTEL' || token === 'SI') {
      fqns.add(`${NS}/mission/value/intel`)
    } else if (token === 'CYBER') {
      fqns.add(`${NS}/mission/value/cyber`)
    } else if (token === 'LEGAL') {
      fqns.add(`${NS}/mission/value/legal`)
    }
    // NOFORN, NF, ORCON, FOUO, etc. — display only, no FQN mapping
  }

  if (!foundClearance) return { fqns: [], firstLine: '', tokens: [] }

  return { fqns: [...fqns], firstLine, tokens }
}

export function fqnsToShortLabels(fqns) {
  return fqns.map(fqn => {
    const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
    return m ? `${m[1]}:${m[2]}` : fqn
  })
}
