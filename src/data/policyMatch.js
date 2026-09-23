/**
 * Does a set of entitlements satisfy a policy?
 *
 * "Does the holder have every FQN on the policy" is the wrong question, and asking it was a real
 * bug on two pages. The platform's rules are:
 *
 *   - Separate definitions AND together.
 *   - Values inside one definition follow that definition's rule. ANY_OF needs one match;
 *     HIERARCHY needs a value at or above the one named.
 *
 * So a policy naming the five Five Eyes nations is satisfied by holding exactly one of them, and a
 * UI testing `every()` reports a denial the KAS never made — it showed Emma, who holds
 * `nationality:gbr`, as refused the FVEY document written for her.
 *
 * This mirrors the decision; it does not make it. Every verdict in the app still comes from a live
 * KAS rewrap. This is only what the UI says *about* that verdict, and the chip/KAS cross-check in
 * the TDF Explorer probe is what keeps the two honest.
 */

/** Highest → lowest. Holding a level grants it and everything beneath it. */
const HIERARCHIES = {
  clearance: ['ts-sci', 'secret', 'cui', 'unclassified'],
}

/** `https://demo.com/attr/nationality/value/gbr` → { definition, name, value }. */
export function parseFqn(fqn) {
  const m = /^(.*)\/attr\/([^/]+)\/value\/(.+)$/.exec(fqn)
  if (!m) return null
  return { definition: `${m[1]}/attr/${m[2]}`, name: m[2], value: m[3] }
}

export function fqnLabel(fqn) {
  const p = parseFqn(fqn)
  return p ? `${p.name}:${p.value}` : fqn
}

/**
 * Group a flat policy by attribute definition, in first-appearance order.
 *
 * Returns `[{ definition, name, rule, values: [{ fqn, value }] }]`, where `rule` is 'HIERARCHY'
 * for a definition this app seeds as one and 'ANY_OF' otherwise. ANY_OF is the right default: it
 * is the rule every other seeded definition uses, and it is the permissive reading, so a
 * definition wrongly defaulted here shows as granted and is then contradicted by the KAS — which
 * is the failure mode you can see, rather than the one you cannot.
 */
export function groupPolicy(fqns) {
  const groups = []
  const byDefinition = new Map()
  for (const fqn of fqns) {
    const p = parseFqn(fqn)
    if (!p) continue
    let g = byDefinition.get(p.definition)
    if (!g) {
      g = {
        definition: p.definition,
        name: p.name,
        rule: HIERARCHIES[p.name] ? 'HIERARCHY' : 'ANY_OF',
        values: [],
      }
      byDefinition.set(p.definition, g)
      groups.push(g)
    }
    if (!g.values.some(v => v.fqn === fqn)) g.values.push({ fqn, value: p.value })
  }
  return groups
}

/**
 * Evaluate one definition's worth of policy.
 *
 * `matched` is the entitlement that carried the group, which is what the UI should name: "granted
 * by nationality:gbr" says more than "granted". `held` is every value of this definition the
 * holder has, so a denial can say what they do hold instead of only what they lack.
 */
export function evaluateGroup(entitlements, group) {
  const held = entitlements
    .map(parseFqn)
    .filter(p => p && p.definition === group.definition)

  if (group.rule === 'HIERARCHY') {
    const order = HIERARCHIES[group.name] ?? []
    // The lowest level the policy names is the bar to clear; the highest the holder has is their reach.
    const needed = Math.max(...group.values.map(v => order.indexOf(v.value)))
    const reach = Math.min(...held.map(h => order.indexOf(h.value)).filter(i => i !== -1), Infinity)
    const satisfied = needed !== -1 && reach <= needed
    return {
      ...group,
      satisfied,
      held: held.map(h => h.value),
      matched: satisfied ? `${group.definition}/value/${order[reach]}` : null,
    }
  }

  const hit = group.values.find(v => entitlements.includes(v.fqn))
  return {
    ...group,
    satisfied: !!hit,
    held: held.map(h => h.value),
    matched: hit?.fqn ?? null,
  }
}

/**
 * The whole policy. `satisfied` is the AND across definitions; `groups` carries each one's verdict
 * so a row can be rendered per definition rather than per value — a 13-nation NATO roster is one
 * decision, not thirteen.
 */
export function evaluatePolicy(entitlements, fqns) {
  const groups = groupPolicy(fqns).map(g => evaluateGroup(entitlements ?? [], g))
  return {
    satisfied: groups.length > 0 && groups.every(g => g.satisfied),
    groups,
    missing: groups.filter(g => !g.satisfied),
  }
}

export function satisfiesPolicy(entitlements, fqns) {
  return evaluatePolicy(entitlements, fqns).satisfied
}

/**
 * How a group reads in one line. "nationality: any of usa, gbr, can, aus, nzl" for a roster,
 * "clearance:secret or above" for a hierarchy, plain `name:value` for a single value.
 */
export function groupLabel(group) {
  if (group.values.length === 1) {
    const only = `${group.name}:${group.values[0].value}`
    return group.rule === 'HIERARCHY' ? `${only} or above` : only
  }
  return `${group.name}: any of ${group.values.map(v => v.value).join(', ')}`
}
