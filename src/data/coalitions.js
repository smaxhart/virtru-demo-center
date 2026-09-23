/**
 * Five Eyes and NATO membership, expressed as nationality values.
 *
 * REL TO FVEY is not an entitlement anybody holds. It is shorthand for a set of nations, and a
 * person qualifies by *being* one of them — `nationality` is ANY_OF, so a policy that lists the
 * member nations grants anyone holding one of them. There is deliberately no `fvey` value on a
 * persona: the roster belongs to the marking, not to the person.
 *
 * Two rules govern the lists below, and breaking either denies *everyone* with nothing in the
 * error to say why:
 *
 *   1. A policy carries at most 20 attribute values. NATO has 32 members, so its full roster is
 *      over the ceiling before a clearance value joins it.
 *   2. A policy may only name values the platform actually created. Naming a member nation that
 *      was never seeded fails exactly like exceeding the cap.
 *
 * `coalitionFqns` enforces both by construction: it intersects a roster with the seeded set, so
 * an unseeded nation is dropped instead of being shipped into a policy, and it throws if what
 * survives is still too large to leave room for the rest of the policy. Both failures are loud at
 * module load, which is the point — the alternative is a silent all-deny in front of an audience.
 *
 * The seeded set below was read off the running platform, not inferred:
 *   ListAttributes → demo.com/nationality ANY_OF
 *   [usa gbr can aus nzl fra deu bel nld nor dnk ita esp pol tur]
 * `electron/seeder.js` is what creates it and `electron/ai-identities.js` names a subset of the
 * same 15; neither can import this file (one is CommonJS in the main process), so the filter here
 * is what keeps a policy from naming something they never created.
 */

export const NS = 'https://demo.com/attr'

/** Read off the running platform. Extend only alongside `electron/seeder.js`. */
export const SEEDED_NATIONALITIES = [
  'usa', 'gbr', 'can', 'aus', 'nzl',
  'fra', 'deu', 'bel', 'nld', 'nor', 'dnk', 'ita', 'esp', 'pol', 'tur',
]

/** The real alliances, in full. What a policy may name is the intersection with the seeded set. */
const MEMBERSHIP = {
  fvey: ['usa', 'gbr', 'can', 'aus', 'nzl'],
  nato: [
    'alb', 'bel', 'bgr', 'can', 'hrv', 'cze', 'dnk', 'est', 'fin', 'fra', 'deu', 'grc', 'hun',
    'isl', 'ita', 'lva', 'ltu', 'lux', 'mne', 'nld', 'mkd', 'nor', 'pol', 'prt', 'rou', 'svk',
    'svn', 'esp', 'swe', 'tur', 'gbr', 'usa',
  ],
}

/**
 * How many values one coalition roster may contribute. The platform's ceiling is 20 for the whole
 * policy; 18 leaves room for a clearance value and a compartment, which is what the documents in
 * this app actually pair a roster with.
 */
export const MAX_ROSTER_VALUES = 18

export const COALITIONS = Object.keys(MEMBERSHIP)

/** ISO alpha-3 codes for one coalition, intersected with what the platform has. */
export function coalitionNations(coalition) {
  const all = MEMBERSHIP[coalition]
  if (!all) return []
  const seeded = all.filter(n => SEEDED_NATIONALITIES.includes(n))
  if (seeded.length > MAX_ROSTER_VALUES) {
    throw new Error(
      `coalition ${coalition} resolves to ${seeded.length} seeded nations, over the ${MAX_ROSTER_VALUES}-value `
      + 'roster budget. A policy past 20 values is denied to everyone by the KAS, so either narrow the '
      + 'roster or stop seeding nations that are not demonstrated.',
    )
  }
  return seeded
}

/** `nationality` FQNs for one coalition. This is what a REL TO marking becomes. */
export function coalitionFqns(coalition) {
  return coalitionNations(coalition).map(n => `${NS}/nationality/value/${n}`)
}

/** One nation, for a bare `REL TO USA`. Returns [] for a nation the platform does not have. */
export function nationFqns(nation) {
  const n = nation.toLowerCase()
  return SEEDED_NATIONALITIES.includes(n) ? [`${NS}/nationality/value/${n}`] : []
}

/** For prose: `REL TO FVEY` → `usa, gbr, can, aus, nzl`. */
export function coalitionLabel(coalition) {
  return coalitionNations(coalition).join(', ')
}

/**
 * The count a roster costs a policy, for the doc comments that quote it. Kept as a function so
 * the numbers in those comments cannot drift from the lists above.
 */
export function coalitionSize(coalition) {
  return coalitionNations(coalition).length
}
