/**
 * The CUI banner marking, derived from the policy rather than typed in.
 *
 * Every other mode in this app carries a hand-written `classification` string on each document.
 * That is fine for a classified scenario, where the banner is a summary of the document and the
 * audience is asked to believe it. It is not fine for a compliance scenario: an assessor's whole
 * job is to stop trusting labels, and a marking that was typed by hand can disagree with the
 * policy that actually enforces it without anything noticing.
 *
 * So for CUI, the marking is computed. `bannerFor(policy)` reads the attribute FQNs a document is
 * encrypted under and assembles the 32 CFR Part 2002 banner from them. Change an attribute and the
 * banner changes; there is no second place to keep in step, and no way to write a banner the policy
 * does not support.
 *
 * Banner anatomy, which is the whole of the grammar implemented here:
 *
 *   CUI//SP-CTI//FED ONLY
 *    │     │        └── Limited Dissemination Control    ← ldc:fedonly
 *    │     └── category marking, SP- prefixed when the    ← cui:sp-cti
 *    │         category is CUI Specified rather than Basic
 *    └── control level
 *
 * Two deliberate limits:
 *
 *   This derives CUI banners only. It returns null for a policy that names no `cui` or `ldc`
 *   value, so the classified modes keep their own strings and nothing here has to know a second
 *   marking grammar. Extending it to `TOP SECRET//SI//TK//NOFORN` would mean teaching it
 *   classification, compartments and caveats — and would immediately expose that a couple of the
 *   classified banners in this app say slightly more than their policies enforce.
 *
 *   It says nothing about decontrol. CUI carries decontrol dates and event-driven decontrol; DSP
 *   attributes are static, so a marking derived from them is a marking as of now. That is called
 *   out in the DIB mode's own text rather than papered over here.
 */

/**
 * `.../attr/cui/value/sp-cti` → `cui:sp-cti`.
 *
 * Deliberately a local copy of `corpus.js`'s `shortFqn` rather than an import of it: `corpus.js`
 * calls into this module, and a cycle between the two would work under ESM while being exactly the
 * kind of thing that stops working the first time either file grows a top-level constant.
 */
const short = (fqn) => {
  const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
  return m ? `${m[1]}:${m[2]}` : fqn
}

/**
 * CUI category value → its NARA CUI Registry marking.
 *
 * `specified` is the Basic/Specified distinction, and it is the reason the marking is stored as a
 * code plus a flag rather than as a finished string: the `SP-` prefix is not part of the category's
 * name, it is a statement about whether a law or regulation prescribes specific handling beyond the
 * CUI baseline. Keeping it separate lets the UI say which authority applies, and makes the prefix a
 * one-line correction if a registry entry is reclassified.
 *
 * Order matters — it is the order categories appear in an assembled banner, so the same policy
 * always produces the same string regardless of how the FQNs were listed.
 */
const CATEGORIES = [
  // CUI Basic with no category at all. Marked `CUI` and nothing further, which is why `code` is null.
  { value: 'basic',          code: null,     specified: false, name: 'CUI Basic, no category',            authority: '32 CFR 2002' },
  { value: 'sp-cti',         code: 'CTI',    specified: true,  name: 'Controlled Technical Information',  authority: 'DFARS 252.204-7012' },
  { value: 'expt',           code: 'EXPT',   specified: true,  name: 'Export Controlled',                 authority: 'ITAR 22 CFR 120-130 · EAR 15 CFR 730-774' },
  { value: 'taxinfo',        code: 'TAX',    specified: true,  name: 'Federal Taxpayer Information',      authority: '26 U.S.C. §6103' },
  { value: 'propin',         code: 'PROPIN', specified: false, name: 'Proprietary Business Information',  authority: '32 CFR 2002' },
  { value: 'privacy',        code: 'PRVCY',  specified: false, name: 'Privacy',                           authority: '5 U.S.C. §552a' },
  { value: 'procurement',    code: 'SSEL',   specified: false, name: 'Source Selection',                  authority: 'FAR 2.101 · 41 U.S.C. §2102' },
  { value: 'lawenforcement', code: 'LEI',    specified: false, name: 'Law Enforcement',                   authority: '32 CFR 2002' },
]

/**
 * Limited Dissemination Control value → its marking.
 *
 * The spacing is not a typo and is not ours to tidy: NARA's approved list has `FED ONLY` and
 * `DL ONLY` with a space and `FEDCON` and `NOCON` without. An assessor reads these as strings.
 *
 * Every one of these is *release eligibility* when it appears in a grant. Holding `ldc:noforn`
 * means the originator will release NOFORN material to you — the same inversion `dissem:orcon`
 * already uses in the IC mode, and the one thing about this vocabulary that reliably needs saying
 * out loud.
 */
const CONTROLS = [
  { value: 'noforn',  code: 'NOFORN',   name: 'No Foreign Dissemination' },
  { value: 'fedonly', code: 'FED ONLY', name: 'Federal Employees Only' },
  { value: 'fedcon',  code: 'FEDCON',   name: 'Federal Employees and Contractors Only' },
  { value: 'nocon',   code: 'NOCON',    name: 'No Dissemination to Contractors' },
  { value: 'dlonly',  code: 'DL ONLY',  name: 'Dissemination List Controlled' },
]

const CATEGORY_BY_VALUE = new Map(CATEGORIES.map(c => [c.value, c]))
const CONTROL_BY_VALUE  = new Map(CONTROLS.map(c => [c.value, c]))

/** The `cui` and `ldc` values a policy names, in registry order. */
function split(policy) {
  const named = new Set((policy ?? []).map(short))
  return {
    categories: CATEGORIES.filter(c => named.has(`cui:${c.value}`)),
    controls:   CONTROLS.filter(c => named.has(`ldc:${c.value}`)),
  }
}

/**
 * The banner marking a policy amounts to, or null if it is not a CUI policy.
 *
 * Null rather than a placeholder: a caller uses this as a fallback behind a document's own
 * `classification`, and a policy with no CUI attributes in it has no business being labelled CUI.
 *
 * @param {string[]} policy attribute value FQNs, as written into the TDF manifest
 * @returns {string|null} e.g. `CUI//SP-CTI//NOFORN`
 */
export function bannerFor(policy) {
  const { categories, controls } = split(policy)
  if (categories.length === 0 && controls.length === 0) return null

  const codes = categories
    .filter(c => c.code)
    .map(c => (c.specified ? `SP-${c.code}` : c.code))

  // `CUI//SP-CTI//NOFORN`, dropping any segment there is nothing to put in. A CUI Basic document
  // with no category and no control is just `CUI`, which is the correct banner for one.
  return ['CUI', codes.join('/'), controls.map(c => c.code).join('/')]
    .filter(Boolean)
    .join('//')
}

/**
 * The same derivation, itemised — what the UI shows to make the banner checkable.
 *
 * Each row names the attribute that produced a marking and the authority behind it, so the banner
 * stops being a claim about the document and becomes a reading of its policy. The `basic` category
 * is included even though it contributes no code, because "this is CUI Basic with no category" is
 * a statement worth seeing rather than an absence.
 *
 * @returns {{banner: string, level: 'CUI Basic'|'CUI Specified',
 *            rows: Array<{fqn: string, marking: string|null, name: string, authority: string|null,
 *                         kind: 'category'|'control'}>} | null}
 */
export function explainBanner(policy) {
  const banner = bannerFor(policy)
  if (!banner) return null
  const { categories, controls } = split(policy)

  return {
    banner,
    // One Specified category makes the whole document CUI Specified — the stricter authority wins.
    level: categories.some(c => c.specified) ? 'CUI Specified' : 'CUI Basic',
    rows: [
      ...categories.map(c => ({
        fqn: `cui:${c.value}`,
        marking: c.code ? (c.specified ? `SP-${c.code}` : c.code) : null,
        name: c.name,
        authority: c.authority,
        kind: 'category',
      })),
      ...controls.map(c => ({
        fqn: `ldc:${c.value}`,
        marking: c.code,
        name: c.name,
        authority: null,
        kind: 'control',
      })),
    ],
  }
}

/** Display name for one `ldc` or `cui` short FQN, for places explaining a single missing attribute. */
export function markingName(short) {
  const [name, value] = short.split(':')
  if (name === 'cui') return CATEGORY_BY_VALUE.get(value)?.name ?? null
  if (name === 'ldc') return CONTROL_BY_VALUE.get(value)?.name ?? null
  return null
}
