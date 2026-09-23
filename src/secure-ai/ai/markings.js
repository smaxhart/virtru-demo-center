/**
 * Reading classification markings out of a document and proposing a policy from them.
 *
 * This is a convenience, not an authority. It exists so that dropping in a file that already
 * carries `SECRET//SI//ORCON` does not mean hand-picking those three values again — but every
 * proposal is shown before anything is encrypted, and the picker stays editable. A detector that
 * silently decided policy would be the wrong thing to demo, because the point of the platform is
 * that policy is explicit and inspectable.
 *
 * Two hard rules:
 *
 *   1. It can only ever propose values the seeder actually created. A policy naming an attribute
 *      the platform has never heard of does not fail loudly — the decision lookup comes back
 *      empty and the KAS denies *everyone*, with nothing in the UI to explain it. So proposals
 *      are filtered against ATTRIBUTE_DEFS, fetched from the main process.
 *   2. What it cannot map, it says out loud rather than approximating. CONFIDENTIAL and IMCON have
 *      no equivalent in this vocabulary, and quietly dropping them (too loose) or rounding them up
 *      (too tight) both misrepresent the document.
 *
 * False positives are the real risk: `SI` and `TK` are two letters, and prose is full of them.
 * So compartments are only read out of things that look like markings in the first place — a
 * banner line or a parenthesised portion marking — never from running text.
 */

import { coalitionNations } from '../modes/vocab.js'

/** Marking-ish fragments: banner lines and parenthesised portion markings. */
function extractMarkings(text) {
  const found = []

  // Banner lines: short, shouty, and either delimited with // or naming a classification.
  for (const line of text.split(/\r?\n/, 400)) {
    const t = line.trim().replace(/^[/*#\s]+|[/*#\s]+$/g, '')
    if (!t || t.length > 120) continue
    const shouty = t === t.toUpperCase() && /[A-Z]{2}/.test(t)
    if (shouty && (t.includes('//') || /\b(TOP SECRET|SECRET|CONFIDENTIAL|CUI|UNCLASSIFIED|FOUO)\b/.test(t))) {
      found.push(t)
    }
  }

  // Portion markings: (S//SI), (TS//SI//OC), (U). Uppercase only, so ordinary parentheticals
  // in prose are skipped.
  for (const [, inner] of text.matchAll(/\(([A-Z][A-Z0-9/\-,. ]{0,70})\)/g)) found.push(inner)

  return found
}

/** Split a marking into its parts: TS//SI/TK//ORCON, REL TO USA, FVEY → tokens. */
function tokenize(marking) {
  return marking
    .split(/\/\/|\/|,|;/)
    .map(s => s.trim().replace(/\.$/, ''))
    .filter(Boolean)
}

// Classification, most restrictive first. The seeded `clearance` definition is a HIERARCHY, so
// tagging a document `secret` still admits ts-sci holders — picking the *document's* level is
// what these map to, not the audience's.
const CLASSIFICATION = [
  { value: 'ts-sci',       tokens: ['TOP SECRET', 'TOPSECRET', 'TS', 'TS-SCI', 'TS//SCI'] },
  { value: 'secret',       tokens: ['SECRET', 'S'] },
  { value: 'cui',          tokens: ['CUI', 'FOUO', 'SBU', 'CONTROLLED UNCLASSIFIED INFORMATION'] },
  { value: 'unclassified', tokens: ['UNCLASSIFIED', 'U', 'UNCLAS'] },
]

// Everything else is a flat token → attribute mapping. `name` must exist in ATTRIBUTE_DEFS.
//
// The CUI category and LDC tokens below are deliberately the same codes `ai/banner.js` *renders*,
// so a banner this app produced is a banner this app can read back. `CUI//SP-CTI//FEDCON` round
// trips to the two values it was derived from.
const MARKINGS = [
  { tokens: ['SI', 'SPECIAL INTELLIGENCE'], name: 'sci', value: 'si' },
  { tokens: ['TK', 'TALENT KEYHOLE'],       name: 'sci', value: 'tk' },
  { tokens: ['HCS', 'HCS-P', 'HCS-O'],      name: 'sci', value: 'hcs' },
  { tokens: ['G', 'GAMMA', 'SI-G'],         name: 'sci', value: 'gamma' },

  { tokens: ['ORCON', 'OC', 'ORIGINATOR CONTROLLED'], name: 'dissem', value: 'orcon' },
  { tokens: ['RELIDO'],                                name: 'dissem', value: 'relido' },

  // REL TO expands to the member nations. Nobody holds an entitlement called FVEY — they hold a
  // nationality — so these are the only multi-value entries here, and `expand` is what carries them.
  // Each nation still goes through the `allowed` filter below, so a roster can never propose a value
  // the platform lacks.
  { tokens: ['FVEY', 'REL TO FVEY', 'FIVE EYES'], expand: coalitionNations('fvey').map(n => ({ name: 'nationality', value: n })) },
  { tokens: ['NATO', 'REL TO NATO'],              expand: coalitionNations('nato').map(n => ({ name: 'nationality', value: n })) },
  { tokens: ['REL TO USA'],                       name: 'nationality', value: 'usa' },

  // CUI categories, NARA CUI Registry codes. `SP-` marks a CUI Specified category — a banner
  // carries the prefix, so both spellings are accepted.
  { tokens: ['PRIV', 'PRVCY', 'PRIVACY'],                        name: 'cui', value: 'privacy' },
  { tokens: ['TAX', 'SP-TAX', 'TAXINFO', 'FTI'],                 name: 'cui', value: 'taxinfo' },
  { tokens: ['SSEL', 'PROCURE', 'PROC', 'PROCUREMENT', 'SOURCE SELECTION'],
                                                                 name: 'cui', value: 'procurement' },
  { tokens: ['LEI', 'LE', 'LAW ENFORCEMENT'],                    name: 'cui', value: 'lawenforcement' },
  { tokens: ['CTI', 'SP-CTI', 'CONTROLLED TECHNICAL INFORMATION'], name: 'cui', value: 'sp-cti' },
  // EAR is left out on purpose. Every other token here is either an invented acronym or a phrase;
  // `EAR` is an English word, and the whole reason markings are only read out of banner lines and
  // parenthesised portion markings is that three-letter codes are what produce false positives.
  { tokens: ['EXPT', 'SP-EXPT', 'EXPORT CONTROLLED', 'ITAR'],    name: 'cui', value: 'expt' },
  { tokens: ['BASIC'],                                           name: 'cui', value: 'basic' },

  // Limited Dissemination Controls. Read these the way `dissem:orcon` reads: holding the value is
  // *eligibility to receive*, so a document marked FEDCON is tagged `ldc:fedcon` and opens only
  // for the personas granted it. NOFORN is not here — it is in AMBIGUOUS, for the reason given there.
  { tokens: ['FED ONLY', 'FEDONLY'],         name: 'ldc', value: 'fedonly' },
  { tokens: ['FEDCON'],                      name: 'ldc', value: 'fedcon' },
  { tokens: ['NOCON'],                       name: 'ldc', value: 'nocon' },
  { tokens: ['DL ONLY', 'DLONLY'],           name: 'ldc', value: 'dlonly' },

  { tokens: ['CJIS', 'CJI'], name: 'cjis', value: 'certified' },
]

/**
 * Tokens that name one thing in a CUI banner and a different thing in a classified one.
 *
 * `PROPIN` is genuinely two attributes: a CUI category in `CUI//PROPIN`, an IC dissemination
 * control in `SECRET//PROPIN`. The banner's own control level is what disambiguates, which is why
 * the classification pass runs first. With no classification token anywhere it resolves to
 * `dissem:propin` — the behaviour before `cui:propin` existed, so an unbannered document's
 * proposal does not change under this addition.
 *
 * `classified` may instead be a `{why}`, meaning the token only maps on the CUI side and the
 * classified reading belongs in `unmapped`.
 */
const AMBIGUOUS = [
  {
    tokens: ['PROPIN', 'PR'],
    cui:        { name: 'cui', value: 'propin' },
    classified: { name: 'dissem', value: 'propin' },
  },
  {
    // NOFORN is a CUI Limited Dissemination Control in `CUI//SP-CTI//NOFORN` and a classified
    // dissemination control in `SECRET//NOFORN`, and only the first has a seeded equivalent. `ldc`
    // is a CUI-side definition: no persona in the classified scenarios holds a value from it, so
    // proposing `ldc:noforn` for a SECRET document would tag it with an attribute nobody can
    // satisfy — rule 1 at the top of this file, the failure that denies everyone and explains
    // nothing. Saying so is better than a mapping that looks right and refuses the whole cast.
    tokens: ['NOFORN', 'NF', 'NO FOREIGN'],
    cui:        { name: 'ldc', value: 'noforn' },
    classified: { why: 'NOFORN on a classified document has no equivalent here — releasability in the classified scenarios is carried by coi, and ldc:noforn is the CUI-side control that no cleared persona holds. Pick a coi value, or leave it off and say so.' },
  },
]

// Markings this vocabulary has no answer for *whatever the document is*. Named explicitly so the
// UI can explain the gap instead of the detector appearing to have missed them. A token that maps
// in one control level and not the other goes in AMBIGUOUS instead — NOFORN, which used to be here.
const UNMAPPABLE = {
  CONFIDENTIAL: 'The clearance hierarchy has no CONFIDENTIAL step. Pick clearance:secret to be tighter or clearance:cui to be looser.',
  IMCON:  'Not in this vocabulary. The nearest available control is dissem:orcon.',
  EYES_ONLY: 'Not in this vocabulary.',
}

/**
 * Propose a policy from a document's own markings.
 *
 * @param {string} text
 * @param {{namespace: string, defs: Array<{name: string, values: string[]}>}} vocab
 *        as returned by `window.electronAPI.getAttributeDefs()`
 * @returns {{fqns: string[], hits: Array<{marking: string, fqn: string}>,
 *            unmapped: Array<{marking: string, why: string}>, banner: string|null,
 *            dropped: number}}
 */
export function detectMarkings(text, vocab) {
  const markings = extractMarkings(text)
  const allowed = new Map((vocab?.defs ?? []).map(d => [d.name, new Set(d.values)]))
  const fqn = (name, value) => `${vocab.namespace}/${name}/value/${value}`

  const hits = new Map()   // fqn → the marking that produced it (first wins, for display)
  const unmapped = new Map()
  let best = null          // most restrictive classification seen anywhere

  const tokensOf = new Map(markings.map(m => [m, tokenize(m).map(t => t.replace(/\s+/g, ' '))]))

  // Classification first, as its own pass. Two reasons it cannot be folded back into the pass
  // below: it is a whole-document answer (the most restrictive level found anywhere wins, whatever
  // order the markings appear in), and it is what tells an ambiguous token which attribute it means.
  for (const tokens of tokensOf.values()) {
    for (const key of tokens) {
      const cls = CLASSIFICATION.findIndex(c => c.tokens.includes(key))
      if (cls !== -1 && (best === null || cls < best)) best = cls
    }
  }
  const isCui = best !== null && CLASSIFICATION[best].value === 'cui'

  for (const marking of markings) {
    for (const key of tokensOf.get(marking)) {
      const gap = UNMAPPABLE[key] ?? UNMAPPABLE[key.replace(/[\s-]/g, '_')]
      if (gap) { unmapped.set(key, gap); continue }

      if (CLASSIFICATION.some(c => c.tokens.includes(key))) continue

      const both = AMBIGUOUS.find(a => a.tokens.includes(key))
      const hit = both ? (isCui ? both.cui : both.classified) : MARKINGS.find(m => m.tokens.includes(key))
      if (hit?.why) { unmapped.set(key, hit.why); continue }

      // Silently skipping a value the platform lacks is right here: a marking outside this
      // vocabulary is a gap in the demo's setup, not a defect in the document. A REL TO token
      // carries a whole roster, so this filters nation by nation — an unseeded member is dropped
      // and the rest of the coalition still proposes.
      for (const part of hit?.expand ?? (hit ? [hit] : [])) {
        if (!allowed.get(part.name)?.has(part.value)) continue
        const f = fqn(part.name, part.value)
        if (!hits.has(f)) hits.set(f, marking)
      }
    }
  }

  if (best !== null && allowed.get('clearance')?.has(CLASSIFICATION[best].value)) {
    const f = fqn('clearance', CLASSIFICATION[best].value)
    // Clearance first in the list — it is the value a reader looks for.
    hits.set(f, markings.find(m => tokenize(m).some(t => CLASSIFICATION[best].tokens.includes(t))) ?? '')
  }

  const ordered = [...hits.keys()].sort((a, b) =>
    (a.includes('/clearance/') ? 0 : 1) - (b.includes('/clearance/') ? 0 : 1)
  )

  // The platform caps a policy at 20 attribute values; past that the decision lookup fails and
  // the KAS denies everyone. Truncating is bad, but silently truncating is worse — the count
  // comes back so the UI can say what was left off.
  return {
    fqns: ordered.slice(0, 20),
    dropped: Math.max(0, ordered.length - 20),
    hits: ordered.slice(0, 20).map(f => ({ fqn: f, marking: hits.get(f) })),
    unmapped: [...unmapped].map(([marking, why]) => ({ marking, why })),
    banner: markings[0] ?? null,
  }
}

/**
 * Keywords for retrieval.
 *
 * `classifyQuery` picks the document whose longest matching keyword appears in the question, so
 * an uploaded document with no keywords is stored, encrypted, policy-enforced — and unreachable
 * by any question. These are a starting point the user can edit, not a search index: the
 * filename stem plus the most distinctive repeated words in the text.
 */
export function suggestKeywords(text, filename, limit = 8) {
  const stem = filename.replace(/\.(tdf|txt|md|json|csv)$/i, '').replace(/[_-]+/g, ' ')
  const stop = new Set(('the a an and or of to in for on at by with from is are was were be been this '
    + 'that these those it its as not but all any per will would shall may can').split(' '))

  const counts = new Map()
  for (const w of text.toLowerCase().matchAll(/[a-z][a-z-]{4,}/g)) {
    if (stop.has(w[0])) continue
    counts.set(w[0], (counts.get(w[0]) ?? 0) + 1)
  }

  const byWeight = (a, b) => b[1] - a[1] || b[0].length - a[0].length
  // Repeated words are the better signal, but a short document may not repeat anything, and
  // falling back to nothing would leave it unreachable by every question.
  const repeated = [...counts].filter(([, n]) => n >= 2)
  const top = (repeated.length >= 3 ? repeated : [...counts])
    .sort(byWeight)
    .slice(0, limit)
    .map(([w]) => w)

  // The filename's own words, individually as well as joined. Without them the text-derived
  // list skews long and generic — "immediately", "logistics" — while the terms someone would
  // actually type ("northern lantern") are exactly the ones a person put in the filename.
  const stemWords = stem.toLowerCase().split(/\s+/).filter(w => w.length >= 4)

  return [...new Set([stem.toLowerCase().trim(), ...stemWords, ...top])].filter(Boolean)
}
