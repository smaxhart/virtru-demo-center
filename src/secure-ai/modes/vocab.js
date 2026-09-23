/**
 * The whole attribute vocabulary, in one place.
 *
 * Every FQN a document policy can name is built from a helper below. `electron/seeder.js`
 * mirrors this list as attribute *definitions* (with their rules) and `electron/jwt-issuer.js`
 * mirrors it as persona *claims* — three files, one vocabulary. That split exists because the
 * issuer signs tokens in the main process while the corpus lives in the renderer; there is no
 * import path between them. `scripts/verify-matrix.mjs` cross-checks all three, so drift is a
 * test failure rather than a mystery denial.
 *
 * Rules, restated because every policy in this app depends on them:
 *   - Separate definitions AND together.
 *   - Values within one definition follow that definition's rule (ANY_OF or HIERARCHY).
 *   - A policy carries at most 20 attribute values; past that the decision lookup fails and
 *     the KAS denies everyone. See the note in electron/seeder.js.
 */

export const NS = 'https://demo.com/attr'

export const fqn = (name, value) => `${NS}/${name}/value/${value}`
const def = (name) => (value) => fqn(name, value)

// ── Department of War ─────────────────────────────────────────────────────────
export const clearance  = def('clearance')   // HIERARCHY
export const mission    = def('mission')
export const needtoknow = def('needtoknow')
// Held by the coalition personas and no longer decided on by any built-in document policy —
// releasability is `nationality`, below. Kept granted rather than withdrawn because a vault carried
// over from an earlier install may hold documents tagged `coi:fvey`, and withdrawing the grant would
// make those unopenable by everyone with no way to tell why.
export const coi        = def('coi')

// ── Shared across modes ──────────────────────────────────────────────────────
export const role   = def('role')
export const agency = def('agency')

// ── Federal Civilian · Defense Industrial Base ────────────────────────────────
// CUI categories per 32 CFR 2002. Values are lowercase slugs; their NARA Registry codes
// (PRVCY, SP-CTI, SSEL…) are produced by `ai/banner.js`, not stored here — the marking is a
// rendering of the attribute, so there is one place that knows the codes and it is not this one.
export const cui = def('cui')
// Limited Dissemination Controls — NOFORN, FED ONLY, FEDCON, NOCON, DL ONLY. Same shape as the
// IC mode's `dissem`, and the same inversion: holding one is *release eligibility*, so
// `ldc:noforn` on a persona means NOFORN material may be released to them.
export const ldc = def('ldc')

// ── Intelligence Community ───────────────────────────────────────────────────
export const sci    = def('sci')             // compartments — SI, TK, HCS, GAMMA
export const dissem = def('dissem')          // dissemination controls — ORCON, RELIDO…

// ── Law Enforcement / Emergency Response ─────────────────────────────────────
export const cjis         = def('cjis')
export const caseaccess   = def('caseaccess')
export const jurisdiction = def('jurisdiction')
export const discipline   = def('discipline')

// ── Releasability ────────────────────────────────────────────────────────────
export const nationality = def('nationality')

/**
 * REL TO FVEY and REL TO NATO, as rosters of nationalities.
 *
 * Nobody holds an entitlement called FVEY. A person qualifies for REL TO FVEY by *being* American,
 * British, Canadian, Australian or a New Zealander, and `nationality` is ANY_OF, so a policy listing
 * the members grants anyone holding one of them. That is also what makes a refusal legible: Henri is
 * refused because FRA is not in the Five Eyes, not because he lacks a value named after the club.
 *
 * Two rules, and breaking either denies *everyone* with nothing in the error to say why:
 *
 *   1. A policy carries at most 20 values. NATO has 32 members, so the full roster is over the
 *      ceiling before a clearance value joins it.
 *   2. A policy may only name values the seeder created. An unseeded member nation fails exactly
 *      like exceeding the cap.
 *
 * `coalitionFqns` enforces both: it intersects the alliance with `SEEDED_NATIONALITIES` and throws
 * if what survives is too large, both at module load rather than in front of an audience.
 *
 * This duplicates `src/data/coalitions.js`, which does the same job for the rest of the app. The two
 * cannot import each other — this tree is a self-contained port of the standalone Secure AI app and
 * reaches outside itself nowhere else — so `scripts/verify-matrix.mjs` asserts the rosters agree,
 * which makes drift a test failure rather than a mystery denial.
 */
export const SEEDED_NATIONALITIES = [
  'usa', 'gbr', 'can', 'aus', 'nzl',
  'fra', 'deu', 'bel', 'nld', 'nor', 'dnk', 'ita', 'esp', 'pol', 'tur',
]

const MEMBERSHIP = {
  fvey: ['usa', 'gbr', 'can', 'aus', 'nzl'],
  nato: [
    'alb', 'bel', 'bgr', 'can', 'hrv', 'cze', 'dnk', 'est', 'fin', 'fra', 'deu', 'grc', 'hun',
    'isl', 'ita', 'lva', 'ltu', 'lux', 'mne', 'nld', 'mkd', 'nor', 'pol', 'prt', 'rou', 'svk',
    'svn', 'esp', 'swe', 'tur', 'gbr', 'usa',
  ],
}

/** 18 leaves room for a clearance value and a compartment under the platform's 20-value ceiling. */
export const MAX_ROSTER_VALUES = 18

export function coalitionNations(coalition) {
  const all = MEMBERSHIP[coalition]
  if (!all) return []
  const seeded = all.filter(n => SEEDED_NATIONALITIES.includes(n))
  if (seeded.length > MAX_ROSTER_VALUES) {
    throw new Error(
      `coalition ${coalition} resolves to ${seeded.length} seeded nations, over the `
      + `${MAX_ROSTER_VALUES}-value roster budget. A policy past 20 values is denied to everyone.`,
    )
  }
  return seeded
}

/** What a REL TO marking becomes. */
export function coalitionFqns(coalition) {
  return coalitionNations(coalition).map(n => fqn('nationality', n))
}

/** For prose: `fvey` → `usa, gbr, can, aus, nzl`. */
export function coalitionLabel(coalition) {
  return coalitionNations(coalition).join(', ')
}
