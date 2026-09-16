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
export const coi        = def('coi')         // release caveats — FVEY, NATO

// ── Shared across modes ──────────────────────────────────────────────────────
export const role   = def('role')
export const agency = def('agency')

// ── Federal Civilian ─────────────────────────────────────────────────────────
export const cui = def('cui')                // CUI categories per 32 CFR 2002

// ── Intelligence Community ───────────────────────────────────────────────────
export const sci    = def('sci')             // compartments — SI, TK, HCS, GAMMA
export const dissem = def('dissem')          // dissemination controls — ORCON, RELIDO…

// ── Law Enforcement / Emergency Response ─────────────────────────────────────
export const cjis         = def('cjis')
export const caseaccess   = def('caseaccess')
export const jurisdiction = def('jurisdiction')
export const discipline   = def('discipline')

// Carried on personas for display; deliberately not decided on by any document policy.
export const nationality = def('nationality')
