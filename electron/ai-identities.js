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
 * Persona ids are mode-prefixed (`dow-`, `fed-`, `dib-`, `ic-`, `le-`) so five scenarios can share
 * one namespace without colliding.
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
 * Every attribute definition, union across all five modes.
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
 *
 * The conclusion drawn at the time — model a community as a single value instead of a roster — was
 * wrong, and it is worth being precise about why, because the measurement itself was real. Two
 * separate faults were folded into one: the roster was over the ceiling *and* it named 17 nations
 * this file never seeded, which fails identically. A roster is the correct model, because nobody
 * holds an entitlement called NATO; what a person holds is a nationality. The fix is to bound the
 * roster rather than to replace it, which `coalitionFqns` in `src/secure-ai/modes/vocab.js` does by
 * intersecting the alliance with the `nationality` values seeded below: NATO resolves to 13 and
 * FVEY to 5, both verified granting live.
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

  // ── Federal Civilian · Defense Industrial Base ────────────────────────────
  // Lowercase slugs, deliberately. The NARA Registry codes (PRVCY, SP-CTI, SSEL) are rendered by
  // `src/secure-ai/ai/banner.js`; putting them here instead would be the first uppercase values in
  // the vocabulary, and if the platform normalised their case the seeder would index one spelling
  // while `grantsToFqns` built another — a skipped mapping and a silently unentitled persona, with
  // the static checks in verify-matrix passing because they read this same array.
  //
  // `privacy` is PRVCY and `lawenforcement` is LEI; they are not missing, they are these. Adding
  // the codes as extra values would put synonym pairs inside one ANY_OF definition.
  { name: 'cui',         rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['basic', 'privacy', 'taxinfo', 'procurement', 'lawenforcement', 'sp-cti', 'propin', 'expt'] },
  // Limited Dissemination Controls per 32 CFR 2002.20. ANY_OF, like `dissem` — these are held or
  // not held. `dlonly` is seeded and named by no policy, the same way `cui:basic` is: an assessor
  // expects the approved list to be present, and a value nothing decides on is inert.
  //
  // Note `cui:propin` and `dissem:propin` now coexist. Different vocabularies with a shared name —
  // PROPIN is a NARA CUI category and also an IC dissemination control — and the FQN keeps them
  // apart. `markings.js` maps the bare token PROPIN to the IC one, which is wrong for a CUI
  // document; noted there rather than guessed at.
  { name: 'ldc',         rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['noforn', 'fedonly', 'fedcon', 'nocon', 'dlonly'] },

  // ── Intelligence Community ────────────────────────────────────────────────
  { name: 'sci',         rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['si', 'tk', 'hcs', 'gamma'] },
  { name: 'dissem',      rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',    values: ['orcon', 'relido', 'propin'] },

  // ── Law Enforcement / Emergency Response ──────────────────────────────────
  { name: 'cjis',         rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',   values: ['certified'] },
  { name: 'caseaccess',   rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',   values: ['2026-0047', '2026-0112'] },
  { name: 'jurisdiction', rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',   values: ['city-baltimore', 'state-md', 'federal', 'mutual-aid'] },
  { name: 'discipline',   rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',   values: ['sworn', 'ems', 'fire', 'dispatch', 'analyst', 'publicdefender'] },

  // Releasability. This is what REL TO FVEY and REL TO NATO are decided on: a document names the
  // member nations and ANY_OF grants anyone holding one of them.
  //
  // Only seven of these are held by a persona (usa, gbr, fra, deu among the DoW cast). The other
  // eight exist so the NATO roster can name them — `src/secure-ai/modes/vocab.js` intersects the
  // alliance with exactly this list, so a nation missing here is dropped from the roster rather
  // than shipped into a policy, and a policy naming an unseeded value denies everyone. Keep this
  // list identical to `SEEDED_NATIONALITIES` in that file and in `src/data/coalitions.js`;
  // `scripts/verify-matrix.mjs` asserts all three agree.
  { name: 'nationality', rule: 'ATTRIBUTE_RULE_TYPE_ENUM_ANY_OF',
    values: ['usa', 'gbr', 'can', 'aus', 'nzl', 'fra', 'deu', 'bel', 'nld', 'nor', 'dnk', 'ita', 'esp', 'pol', 'tur'] },
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

  // ── Defense Industrial Base ───────────────────────────────────────────────
  // Not a clearance in sight, deliberately. Every attribute here is either a CUI category or a
  // limited dissemination control, and `ldc:fedonly` vs `ldc:fedcon` is what separates the
  // government from its contractors — so the org chart is expressed in policy rather than in titles.
  //
  // The government PM, and the only holder of `fedonly` or `nocon`.
  'dib-renee': { name: 'Renée Alvarez',    grants: { cui: ['sp-cti', 'propin', 'expt', 'procurement'], ldc: ['fedonly', 'fedcon', 'nocon', 'dlonly', 'noforn'], role: 'contracting', nationality: 'usa' } },
  // Tom and Dale are the sideways pair: both FEDCON-authorized contractors, both NOFORN-releasable,
  // and they differ by exactly `cui:sp-cti` — whether the 7012 flowdown carried CTI into their
  // subcontract. One attribute, and it is the whole compliance finding.
  'dib-tom':   { name: 'Tom Braddock',     grants: { cui: ['sp-cti', 'propin', 'expt'], ldc: ['fedcon', 'noforn'], role: 'contractor', nationality: 'usa' } },
  'dib-dale':  { name: 'Dale Whitcomb',    grants: { cui: ['propin', 'expt'],           ldc: ['fedcon', 'noforn'], role: 'contractor', nationality: 'usa' } },
  // Same employer as Tom, same program, same FEDCON authorization. Missing `expt` and `noforn`,
  // which is what actually stops her — not the `nationality` field, which no policy here reads.
  'dib-anika': { name: 'Anika Rautenberg', grants: { cui: ['sp-cti', 'propin'], ldc: ['fedcon'], role: 'analyst', nationality: 'deu' } },
  'dib-joy':   { name: 'Joy Nakashima',    grants: { cui: ['propin'],           ldc: ['fedcon'], role: 'admin',   nationality: 'usa' } },
  // A competitor with no role on the program. Authenticates, holds nothing, reaches the public
  // solicitation and not one page further.
  'dib-rhea':  { name: 'Rhea Solberg',     grants: {} },

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
 *
 * The two DoW agents that reach coalition material carry `nationality: 'usa'`, because releasability
 * applies to a machine identity exactly as it does to a person: once REL TO FVEY is a roster of
 * nations, an agent with no nationality is on no roster and is refused — which is correct, and would
 * have read as an unexplained denial of the two documents the J2 agent exists to retrieve. USA is on
 * both rosters, so it grants the agent no more than its coi grant did before.
 */
const AGENTS = {
  // ── Department of War ──────────────────────────────────────────────────────
  // Reaches only the status tier of the casualty report. Authenticated, almost unentitled —
  // the opening beat for "the assistant is running, and it can tell you nearly nothing".
  'dow-agent-general': { name: 'General Assistant', grants: { clearance: 'cui', needtoknow: 'ops' } },
  // SECRET and scoped to intel. Against Maj. Williams (TS-SCI) this is the agent that makes
  // the point: she is cleared for the Q3 threat briefing and the assistant is not.
  'dow-agent-intel':   { name: 'J2 Intel Agent',    grants: { clearance: 'secret', mission: 'intel', needtoknow: 'intel', nationality: 'usa', coi: ['fvey', 'nato'] } },
  // Broad enough to never be the blocker, so switching to it hands the decision back to the
  // human and shows that the agent ceiling was the only thing in the way.
  // Deliberately not given mission:legal. With it, this agent would satisfy every policy in the
  // scenario and "use the broad agent" would be the whole answer. Without it, the two documents
  // you would never delegate to a command assistant — the JAG's legal file and the full medical
  // record — are out of reach of every agent in the mode, which is the same shape as IC's GAMMA
  // finding and LE's clinical record.
  'dow-agent-command': { name: 'Command Agent',     grants: { clearance: 'ts-sci', mission: ['intel', 'ops', 'cyber'], needtoknow: ['intel', 'ops'], nationality: 'usa', coi: ['fvey', 'nato'] } },

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

  // ── Defense Industrial Base ───────────────────────────────────────────────
  // **No agent in this mode holds `noforn`, `fedonly`, or `nocon`.** Every limited dissemination
  // control in the scenario stops at a human, which is a sharper version of the GAMMA finding in
  // the IC mode: three of the eight units are unreachable through any assistant at all, so
  // "switch to the better agent" is not an available answer for the documents that matter most.
  //
  // None holds `fedonly` *and* `fedcon` either — that pair is the government/contractor boundary,
  // and an identity on both sides of it is the same category error as a civilian agent holding all
  // four CUI categories.
  'dib-agent-supplier':    { name: 'Supplier Portal Assistant', grants: { ldc: ['fedcon'] } },
  // The widest agent here, and it still holds two categories out of four and one control out of
  // five. Paired with Tom it produces the beat the tiering exists for: he personally opens the
  // NOFORN drawing set, the assistant does not, and he is served the releasable interface
  // document instead of being refused outright.
  'dib-agent-engineering': { name: 'Engineering Data Agent',    grants: { cui: ['sp-cti', 'propin'], ldc: ['fedcon'] } },
  // Export-controlled drawings and supplier agreements. Deliberately no `sp-cti`, so it is not a
  // superset of the engineering agent in either direction — neither one is simply the better choice.
  'dib-agent-quality':     { name: 'Supplier Quality Agent',    grants: { cui: ['propin', 'expt'],   ldc: ['fedcon'] } },

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
