/**
 * The banner on a GCAP document, derived from the policy on it.
 *
 * Nothing in `data.js` says "this file is GCAP SECRET". The marking is read back off the policy, so
 * the label and the lock cannot disagree: change a document's policy and its banner changes with it.
 *
 * Two naming conventions meet here, and the rule for which one leads is the one agreed for the demo:
 *   shared documents  lead with the programme marking (GCAP RESTRICTED / GCAP SECRET)
 *   sovereign ones    carry the originating nation's marking alone
 * TOP SECRET exists only as a national marking; the programme itself stops at GCAP SECRET.
 *
 * UNVERIFIED. The equivalences and the caveat wording below are from memory, not from a published
 * standard. Confidence is high for the UK and Italy and medium for Japan. "Tokutei himitsu" is the
 * name of a different Japanese legal category, so the Japanese SECRET is shown as 秘 alone rather
 * than as 特定秘密. Have someone from the programme check all of it before a customer sees it.
 */

import { groupPolicy, parseFqn } from '../data/policyMatch.js'
import { coalitionNations } from '../data/coalitions.js'
import { GCAP_NATIONS } from './data.js'

/** Tier codes used by the clearance ladder, mapped to the four GCAP-relevant levels. */
const LEVEL = {
  'ts-sci':       { rank: 4, programme: null,              tone: '#9a3412' },
  secret:         { rank: 3, programme: 'GCAP SECRET',     tone: '#b91c1c' },
  cui:            { rank: 2, programme: 'GCAP RESTRICTED', tone: '#b45309' },
  unclassified:   { rank: 1, programme: null,              tone: '#15803d' },
}

/** Each nation's name for each level, in ladder order. */
const NATIONAL = {
  gbr: { 'ts-sci': 'UK TOP SECRET', secret: 'UK SECRET',  cui: 'OFFICIAL-SENSITIVE', unclassified: 'OFFICIAL' },
  ita: { 'ts-sci': 'SEGRETISSIMO',  secret: 'SEGRETO',    cui: 'RISERVATO',          unclassified: 'NON CLASSIFICATO' },
  jpn: { 'ts-sci': '極秘',           secret: '秘',          cui: '取扱注意',            unclassified: '—' },
}

const NATION_NAME = { gbr: 'UK', ita: 'ITA', jpn: 'JPN', usa: 'USA' }
const nameOf = (n) => NATION_NAME[n] ?? n.toUpperCase()

const sameSet = (a, b) => a.length === b.length && a.every(x => b.includes(x))

/**
 * The nationality part of a marking. A roster that equals a known coalition is named for it; the
 * three programme nations are "GCAP"; a single nation is "<NATION> ONLY"; anything else is listed.
 * The order of these checks matters: GCAP is checked first so it is never mistaken for a coalition.
 */
function releasability(nations) {
  if (nations.length === 0) return { label: null, kind: 'none' }
  if (sameSet(nations, GCAP_NATIONS)) return { label: 'REL TO GCAP PARTNERS', kind: 'gcap' }
  if (nations.length === 1) return { label: `${nameOf(nations[0])} ONLY`, kind: 'sovereign', nation: nations[0] }
  if (sameSet(nations, coalitionNations('nato'))) return { label: 'REL TO NATO', kind: 'coalition' }
  if (sameSet(nations, coalitionNations('fvey'))) return { label: 'REL TO FVEY', kind: 'coalition' }
  return { label: `REL TO ${nations.map(nameOf).join(', ')}`, kind: 'list' }
}

/**
 * @param {string[]} policy attribute FQNs
 * @returns {{banner: string, level: string|null, tone: string, programme: string|null,
 *   sovereign: boolean, nation: string|null, equivalents: object|null, caveats: string[]}}
 */
export function markingOf(policy) {
  const groups = groupPolicy(policy)
  const get = (name) => groups.find(g => g.name === name)?.values.map(v => v.value) ?? []

  const clearances = get('clearance')
  const nations = get('nationality')
  const level = clearances.length
    ? clearances.reduce((lo, v) => (LEVEL[v].rank < LEVEL[lo].rank ? v : lo))
    : null

  const rel = releasability(nations)
  const sovereign = rel.kind === 'sovereign'

  const caveats = [
    ...get('workpackage').map(v => `WP ${v.toUpperCase()}`),
    ...(get('supplytier').length === 3 ? ['ALL SUPPLY TIERS']
      : get('supplytier').length ? [`TIER ${get('supplytier').map(v => v.toUpperCase()).join('/')}`] : []),
    ...(get('role').length ? [`${get('role').map(v => v.toUpperCase()).join('/')} ROLE`] : []),
  ]

  if (!level) {
    return {
      banner: 'OPEN // ANY AUTHENTICATED ACE USER', level: null, tone: LEVEL.unclassified.tone,
      programme: null, sovereign: false, nation: null, equivalents: null, caveats: [],
    }
  }

  const def = LEVEL[level]
  let head
  if (sovereign) head = NATIONAL[rel.nation]?.[level] ?? level.toUpperCase()
  else if (def.programme) head = def.programme
  else head = level === 'unclassified' ? 'OFFICIAL' : 'TOP SECRET'

  const parts = [head, rel.label, ...caveats].filter(Boolean)

  // A programme-level document has an equivalent in each nation; a sovereign one is national only.
  const equivalents = sovereign || !def.programme
    ? null
    : Object.fromEntries(GCAP_NATIONS.map(n => [n, NATIONAL[n][level]]))

  return {
    banner: parts.join(' // '),
    level,
    tone: def.tone,
    programme: def.programme,
    sovereign,
    nation: rel.nation ?? null,
    equivalents,
    caveats,
  }
}

/** What a holder from `nation` would call this level in their own system, or null if unknown. */
export function nationalEquivalent(level, nation) {
  return NATIONAL[nation]?.[level] ?? null
}

/** `nationality:gbr` → `gbr`, for prose. */
export const valueOf = (fqn) => parseFqn(fqn)?.value ?? fqn
