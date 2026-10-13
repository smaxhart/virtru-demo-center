/**
 * Pure helpers for free play: grants ↔ entitlement FQNs, grants ↔ a document's policy, and a diff.
 * None of this decides anything. The KAS does; these only let the page explain what it decided.
 */

import { NS } from '../data/coalitions.js'

export const EDITABLE = ['clearance', 'nationality', 'workpackage', 'supplytier', 'role', 'company']
/** Highest first. Holding a level holds everything beneath it. */
export const LADDER = ['ts-sci', 'secret', 'cui', 'unclassified']

const fqn = (name, value) => `${NS}/${name}/value/${value}`
const list = (v) => [].concat(v ?? []).filter(x => x !== '' && x != null)

/** What the KAS resolves a person to. A clearance is a floor, so it expands to everything below it. */
export function entitlementsOf(grants = {}) {
  const out = []
  for (const name of EDITABLE) {
    const values = list(grants[name])
    if (name === 'clearance') {
      const i = LADDER.indexOf(values[0])
      if (i >= 0) for (const v of LADDER.slice(i)) out.push(fqn(name, v))
    } else {
      for (const v of values) out.push(fqn(name, v))
    }
  }
  return out
}

/** `{clearance: 'cui', nationality: ['gbr'], …}` for a policy's FQN list. The policy names the bar; the person holds the floor. */
export function specFromPolicy(policy = []) {
  const spec = Object.fromEntries(EDITABLE.map(n => [n, []]))
  for (const f of policy) {
    const m = /\/attr\/([^/]+)\/value\/(.+)$/.exec(f)
    if (m && spec[m[1]]) spec[m[1]].push(m[2])
  }
  return spec
}

export function policyFromSpec(spec = {}) {
  return EDITABLE.flatMap(name => list(spec[name]).map(v => fqn(name, v)))
}

/** One line per attribute that differs: `[{name, from: ['tier3'], to: []}]`. */
export function diffGrants(before = {}, after = {}) {
  const out = []
  for (const name of EDITABLE) {
    const from = list(before[name])
    const to = list(after[name])
    if (from.length === to.length && from.every(v => to.includes(v))) continue
    out.push({ name, from, to })
  }
  return out
}

export const describeGrants = (grants = {}) => EDITABLE
  .map(n => list(grants[n]).length ? `${n}:${list(grants[n]).join('/')}` : null)
  .filter(Boolean)
