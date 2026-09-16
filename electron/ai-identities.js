/**
 * Who exists, and what each of them holds.
 *
 * This is the main-process half of the attribute vocabulary. `src/modes/vocab.js` is the
 * renderer half — it builds the FQNs that go into document policies. The two halves cannot
 * import each other: the issuer signs tokens in CommonJS in the main process while the corpus
 * is ESM in the renderer, and electron-builder ships them from different trees. So they are
 * mirrored deliberately and `scripts/verify-matrix.mjs` cross-checks them, which turns drift
 * into a test failure rather than a mystery denial.
 *
 * Everything downstream reads from here:
 *   jwt-issuer.js — turns `grants` into JWT claims and into the entity attributes the KAS sees
 *   seeder.js     — turns `grants` into subject mappings, and ATTRIBUTE_DEFS into definitions
 *
 * Persona ids are mode-prefixed (`dow-`, `fed-`, `ic-`, `le-`) so four scenarios can share one
 * namespace without colliding.
 *
 * Both the people and the agents live here, in two tables merged into one. Adding to either is
 * enough to get claims, entity attributes and subject mappings — but the seeder only writes
 * mappings once per SEED_VERSION, so a new identity also needs that version bumped or it will
 * authenticate perfectly and be denied everything with nothing to explain why.
 */

const NAMESPACE = 'demo.com'
const NS = `https://${NAMESPACE}/attr`

// Highest → lowest. A holder is granted this level and everything beneath it.
const CLEARANCE_HIERARCHY = ['ts-sci', 'secret', 'cui', 'unclassified']

/**
 * Every attribute definition, union across all four modes.
 *
 * Rules matter as much as values: separate definitions AND together, and values inside one
 * definition follow that definition's rule. Only `clearance` is a HIERARCHY; everything else
 * is ANY_OF, because compartments, categories, and caveats are held or not held — they do not
 * rank.
 *
 * A policy carries at most **20 attribute values**. An earlier version of the DoW mode
 * expressed REL TO NATO by enumerating all 32 member nationalities; at 21 values the
 * platform's decision lookup fails outright ("no rows in result set" → invalid_argument) and
 * the KAS then denies every caller regardless of entitlement — an unsatisfiable policy rather
 * than a strict one. Measured on this build; `scripts/verify-matrix.mjs` is what caught it.
 * Model communities as markings, not rosters.
 */
const ATTRIBUTE_DEFS = [
  // ── Department of War ──────────────────────────────────────────────────────
  { name: 'clearance',   rule: 'ATTRIBUTE_RULE_TYPE_ENUM_HIERARCHY', values: CLEARANCE_HIERARCHY },
  { name: 'mission',     rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['intel', 'ops', 'legal', 'cyber', 'external', 'admin'] },
  { name: 'needtoknow',  rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['intel', 'ops', 'legal', 'cyber', 'external'] },
  { name: 'coi',         rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['fvey', 'nato'] },

  // ── Shared ────────────────────────────────────────────────────────────────
  { name: 'role',        rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['analyst', 'contractor', 'counsel', 'operator', 'commander', 'admin', 'auditor', 'caseworker', 'contracting', 'investigator'] },
  { name: 'agency',      rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['irs', 'ssa', 'gsa', 'hhs', 'oig', 'nsa', 'cia', 'nga', 'dia', 'odni'] },

  // ── Federal Civilian ──────────────────────────────────────────────────────
  { name: 'cui',         rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['basic', 'privacy', 'taxinfo', 'procurement', 'lawenforcement'] },

  // ── Intelligence Community ────────────────────────────────────────────────
  { name: 'sci',         rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['si', 'tk', 'hcs', 'gamma'] },
  { name: 'dissem',      rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['orcon', 'relido', 'propin'] },

  // ── Law Enforcement / Emergency Response ──────────────────────────────────
  { name: 'cjis',         rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',   values: ['certified'] },
  { name: 'caseaccess',   rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',   values: ['2026-0047', '2026-0112'] },
  { name: 'jurisdiction', rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',   values: ['city-baltimore', 'state-md', 'federal', 'mutual-aid'] },
  { name: 'discipline',   rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',   values: ['sworn', 'ems', 'fire', 'dispatch', 'analyst', 'publicdefender'] },

  // Carried because it is true of the DoW liaison personas and reads well in the UI.
  // Deliberately not what any release caveat is decided on — see `coi`.
  { name: 'nationality', rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['usa', 'gbr', 'can', 'aus', 'nzl', 'fra', 'deu'] },
]

/**
 * Every persona, keyed by the id the renderer's mode files use.
 *
 * `grants` values may be a string or an array. A persona with no grants at all is not a bug:
 * they authenticate successfully and hold nothing, which is the cleanest way to show that
 * authentication is not authorization.
 */
const HUMANS = {
  // ── Department of War ──────────────────────────────────────────────────────
  'dow-sarah':    { name: 'Maj. Sarah Williams',  grants: { clearance: 'ts-sci', mission: 'intel',    role: 'analyst',    needtoknow: 'intel',    nationality: 'usa', coi: ['fvey', 'nato'] } },
  'dow-patricia': { name: 'Col. Patricia Lee',    grants: { clearance: 'secret', mission: 'legal',    role: 'counsel',    needtoknow: 'legal',    nationality: 'usa', coi: ['fvey', 'nato'] } },
  'dow-marcus':   { name: 'CW3 Marcus Johnson',   grants: { clearance: 'secret', mission: 'cyber',    role: 'admin',      needtoknow: 'cyber',    nationality: 'usa', coi: ['fvey', 'nato'] } },
  'dow-james':    { name: 'CPT. James Rivera',    grants: { clearance: 'secret', mission: 'external', role: 'contractor', needtoknow: 'external', nationality: 'usa', coi: ['fvey', 'nato'] } },
  'dow-emma':     { name: 'Flt Lt Emma Clarke',   grants: { clearance: 'secret', role: 'analyst',     needtoknow: 'intel', nationality: 'gbr', coi: ['fvey', 'nato'] } },
  // France and Germany are NATO but not Five Eyes — the whole point of the pair.
  'dow-henri':    { name: 'Maj. Henri Dubois',    grants: { clearance: 'secret', role: 'operator',    needtoknow: 'ops',   nationality: 'fra', coi: ['nato'] } },
  'dow-klaus':    { name: 'Maj. Klaus Richter',   grants: { clearance: 'secret', role: 'operator',    needtoknow: 'ops',   nationality: 'deu', coi: ['nato'] } },
  'dow-none':     { name: 'Uncleared User',       grants: {} },

  // ── Federal Civilian ──────────────────────────────────────────────────────
  'fed-dana':  { name: 'Dana Okafor',    grants: { cui: 'taxinfo',        agency: 'irs', role: 'auditor' } },
  'fed-luis':  { name: 'Luis Ferrer',    grants: { cui: 'privacy',        agency: 'ssa', role: 'caseworker' } },
  'fed-grace': { name: 'Grace Nakamura', grants: { cui: 'procurement',    agency: 'gsa', role: 'contracting' } },
  'fed-omar':  { name: 'Omar Haddad',    grants: { cui: 'lawenforcement', agency: 'oig', role: 'investigator' } },
  // A badged employee holding no CUI category — the honest posture for most federal staff.
  'fed-tess':  { name: 'Tess Reilly',    grants: { agency: 'hhs', role: 'analyst' } },
  // Outside the agency entirely; reaches only what was cleared for release.
  'fed-priya': { name: 'Priya Sharma',   grants: {} },

  // ── Intelligence Community ────────────────────────────────────────────────
  // Note how little work `clearance` does here: five of six hold TS-SCI, and the
  // compartment plus the dissemination control decide everything.
  'ic-diane':  { name: 'Diane Osei',   grants: { clearance: 'ts-sci', sci: ['si', 'tk'],    dissem: ['relido'],          agency: 'nsa' } },
  'ic-victor': { name: 'Victor Reyes', grants: { clearance: 'ts-sci', sci: ['hcs'],         dissem: ['orcon'],           agency: 'cia' } },
  'ic-mei':    { name: 'Mei Lin Zhao', grants: { clearance: 'ts-sci', sci: ['tk'],          dissem: ['relido'],          agency: 'nga' } },
  'ic-nadia':  { name: 'Nadia Petrov', grants: { clearance: 'ts-sci', sci: ['gamma', 'hcs'], dissem: ['orcon'],          agency: 'odni' } },
  'ic-frank':  { name: 'Frank Boyle',  grants: { clearance: 'secret',                        dissem: ['relido'],         agency: 'dia' } },
  // Cleared, holds no compartment and no dissemination control — not even the tearline.
  'ic-warren': { name: 'Warren Pike',  grants: { clearance: 'secret', role: 'contractor' } },

  // ── Law Enforcement / Emergency Response ──────────────────────────────────
  // Nina and Ray are the sideways pair: same agency, same certification, same
  // sworn status, different case. That single attribute is the whole difference.
  'le-nina': { name: 'Det. Nina Cortez',    grants: { cjis: 'certified', discipline: 'sworn',          caseaccess: '2026-0047', jurisdiction: ['city-baltimore', 'mutual-aid'] } },
  'le-ray':  { name: 'Det. Ray Whitfield',  grants: { cjis: 'certified', discipline: 'sworn',          caseaccess: '2026-0112', jurisdiction: ['city-baltimore', 'mutual-aid'] } },
  // CJIS-certified and civilian — certification without sworn status opens no CHRI.
  'le-sam':  { name: 'Sam Ostrowski',       grants: { cjis: 'certified', discipline: 'analyst',        jurisdiction: 'state-md' } },
  'le-jo':   { name: 'Jo Amari',            grants: {                    discipline: 'ems',            jurisdiction: 'mutual-aid' } },
  'le-hank': { name: 'BC Hank Molina',      grants: {                    discipline: 'fire',           jurisdiction: 'mutual-aid' } },
  'le-dee':  { name: 'Dee Kwan',            grants: {                    discipline: 'publicdefender' } },
}

/**
 * The agents, keyed the same way and granted the same way.
 *
 * An agent is not a special kind of subject. It is an identity with attributes, and the KAS
 * cannot tell it apart from a person — which is the entire point. Retrieval asks the platform
 * twice, once as the human and once as the agent acting for them, and releases the document
 * only when both are granted. So an agent's grants are a ceiling on what any user can pull
 * through it, and an over-granted agent is a real hole rather than a cosmetic one.
 *
 * Two things shape these deliberately:
 *
 *   Agents are given coarse authority and withheld fine-grained authority, because that is the
 *   honest posture for a machine identity. Clearance is easy to provision to a service; the
 *   compartment and the need-to-know are the parts a human sponsor actually has to justify.
 *   That asymmetry is what produces the interesting case — the analyst is cleared for the
 *   document and the assistant working on their behalf is not.
 *
 *   No agent is a superset of every persona. Even the broadest one in each scenario is refused
 *   something, so "just use the privileged agent" is never the whole answer.
 */
const AGENTS = {
  // ── Department of War ──────────────────────────────────────────────────────
  // Reaches only the status tier of the casualty report. Authenticated, almost unentitled —
  // the opening beat for "the assistant is running, and it can tell you nearly nothing".
  'dow-agent-general': { name: 'General Assistant', grants: { clearance: 'cui', needtoknow: 'ops' } },
  // SECRET and scoped to intel. Against Maj. Williams (TS-SCI) this is the agent that makes
  // the point: she is cleared for the Q3 threat briefing and the assistant is not.
  'dow-agent-intel':   { name: 'J2 Intel Agent',    grants: { clearance: 'secret', mission: 'intel', needtoknow: 'intel', coi: ['fvey', 'nato'] } },
  // Broad enough to never be the blocker, so switching to it hands the decision back to the
  // human and shows that the agent ceiling was the only thing in the way.
  // Deliberately not given mission:legal. With it, this agent would satisfy every policy in the
  // scenario and "use the broad agent" would be the whole answer. Without it, the two documents
  // you would never delegate to a command assistant — the JAG's legal file and the full medical
  // record — are out of reach of every agent in the mode, which is the same shape as IC's GAMMA
  // finding and LE's clinical record.
  'dow-agent-command': { name: 'Command Agent',     grants: { clearance: 'ts-sci', mission: ['intel', 'ops', 'cyber'], needtoknow: ['intel', 'ops'], coi: ['fvey', 'nato'] } },

  // ── Federal Civilian ──────────────────────────────────────────────────────
  // Holds nothing at all: the FOIA package has an empty policy, so an unentitled agent still
  // reaches exactly one document. Authentication is not authorization for machines either.
  'fed-agent-public':     { name: 'Public Records Assistant', grants: {} },
  // A role and no CUI category. Opens the de-identified summary and never the identified
  // record — which is precisely the access program analysis is supposed to have.
  'fed-agent-program':    { name: 'Program Analysis Agent',   grants: { role: 'analyst' } },
  // The widest civilian agent still holds one CUI category. Categories do not nest, so there
  // is deliberately no agent here that opens tax, privacy, procurement and OIG material.
  'fed-agent-caseworker': { name: 'SSA Caseworker Agent',     grants: { cui: 'privacy', agency: 'ssa', role: 'caseworker' } },

  // ── Intelligence Community ────────────────────────────────────────────────
  // SECRET with RELIDO: the estimate and the tearline, never the sourcing. An all-source
  // assistant working from sanitized product is the realistic deployment.
  'ic-agent-allsource':     { name: 'All-Source Assistant',  grants: { clearance: 'secret', dissem: ['relido'] } },
  'ic-agent-sigint':        { name: 'SIGINT Support Agent',  grants: { clearance: 'ts-sci', sci: ['si', 'tk'], dissem: ['relido'] } },
  // TS-SCI across three compartments and both controls, and still refused the covert action
  // finding — GAMMA is not delegated to a machine in this scenario.
  'ic-agent-compartmented': { name: 'Compartmented Agent',   grants: { clearance: 'ts-sci', sci: ['si', 'tk', 'hcs'], dissem: ['orcon', 'relido'] } },

  // ── Law Enforcement / Emergency Response ──────────────────────────────────
  'le-agent-dispatch': { name: 'Dispatch Assistant',   grants: { discipline: 'dispatch', jurisdiction: 'mutual-aid' } },
  // Clinical PHI and nothing with a case number on it. The pair with the case agent shows the
  // split running along discipline rather than along seniority.
  'le-agent-ems':      { name: 'EMS Field Agent',      grants: { discipline: 'ems', jurisdiction: 'mutual-aid' } },
  // Everything on case 0047 including the informant file, and refused the identified clinical
  // record — a sworn investigator's agent has no business in patient PHI.
  'le-agent-case':     { name: 'Case 0047 Agent',      grants: { cjis: 'certified', discipline: 'sworn', caseaccess: '2026-0047', jurisdiction: ['city-baltimore', 'mutual-aid'] } },
}

/**
 * Humans and agents share one map from here down.
 *
 * The issuer, the seeder and the KAS all treat them identically — same claim shape, same
 * subject mappings, same entity resolution. Keeping them in one table is what guarantees an
 * agent cannot accidentally be given a cheaper path to a key than a person has.
 */
const IDENTITIES = { ...HUMANS, ...AGENTS }

/** True for the machine identities. Used to keep agents out of the persona pickers. */
function isAgent(id) {
  return Object.prototype.hasOwnProperty.call(AGENTS, id)
}

/**
 * The encrypting identity. Used only to create TDFs and to seed policy — never to read.
 * Encryption never requires entitlement, so these grants are about reaching the policy API.
 */
const ADMIN_ID = 'admin'

/** True for a definition whose values rank rather than merely differ. */
const isHierarchy = (def) => def?.rule === 'ATTRIBUTE_RULE_TYPE_ENUM_HIERARCHY'

/**
 * Expand a persona's grants into a flat list of attribute value FQNs.
 *
 * HIERARCHY definitions are expanded downward: a TS-SCI holder is explicitly granted SECRET and
 * below. The rule mostly covers this on its own, but making it explicit keeps the subject
 * mappings and the entity attributes in the token identical, so a denial can only ever come
 * from the policy and never from the two paths disagreeing.
 *
 * The definition list is a parameter because a user-built scenario brings its own vocabulary,
 * including its own HIERARCHY definitions. Passing `ATTRIBUTE_DEFS` (the default) reproduces the
 * built-in behaviour exactly — `clearance` is the only built-in hierarchy and its `values` array
 * *is* the ranking, so nothing about the four shipped modes changes.
 *
 * @param {object} grants  attribute name → value or array of values
 * @param {Array}  defs    the definitions those attribute names belong to
 */
function grantsToFqns(grants, defs = ATTRIBUTE_DEFS) {
  const byName = new Map(defs.map(d => [d.name, d]))
  const fqns = []
  for (const [attr, value] of Object.entries(grants)) {
    const def = byName.get(attr)
    if (isHierarchy(def)) {
      // A hierarchy grant is a floor, so take the named value and everything ranked below it.
      // An unrecognised value expands to the whole ladder rather than to nothing, which is the
      // conservative direction for a demo: visibly over-granted beats silently unentitled.
      const idx = def.values.indexOf([].concat(value)[0])
      for (let i = idx >= 0 ? idx : 0; i < def.values.length; i++) {
        fqns.push(`${NS}/${attr}/value/${def.values[i]}`)
      }
    } else {
      for (const v of [].concat(value)) fqns.push(`${NS}/${attr}/value/${v}`)
    }
  }
  return fqns
}

/**
 * The names a user-built scenario may not claim.
 *
 * Identity ids are reserved because redefining `dow-sarah` would change what the shipped DoW mode
 * does — a scenario is additive or it is a bug. Definition *names* are not reserved: reusing
 * `clearance` in a new scenario is a reasonable thing to want, and the seeder's existing
 * already-exists handling makes it safe. What is not safe is reusing a name under a different
 * rule, which `electron/scenarios.js` rejects rather than letting the platform silently keep the
 * original rule and hand back a scenario that behaves differently than the builder showed.
 */
const RESERVED_IDENTITY_IDS = new Set([...Object.keys(IDENTITIES), ADMIN_ID])
const BUILTIN_DEFS_BY_NAME = new Map(ATTRIBUTE_DEFS.map(d => [d.name, d]))

module.exports = {
  NAMESPACE, NS, CLEARANCE_HIERARCHY,
  ATTRIBUTE_DEFS, IDENTITIES, HUMANS, AGENTS, ADMIN_ID,
  RESERVED_IDENTITY_IDS, BUILTIN_DEFS_BY_NAME,
  grantsToFqns, isAgent, isHierarchy,
}
