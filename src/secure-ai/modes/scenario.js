/**
 * Turning a saved scenario into a mode.
 *
 * A user-built scenario is stored the way the main process needs it (`electron/scenarios.js`):
 * vocabulary as real attribute *definitions*, personas and agents carrying their grants, documents
 * as plaintext plus a policy. A mode is what the renderer needs: the same material with display
 * fields filled in, `vocabulary` reduced to the short form `HowItWorksPage` renders, and grants
 * dropped entirely — the renderer never reads a subject's grants, because the only grants that
 * count are the ones the issuer signed and the seeder mapped.
 *
 * Everything downstream of here treats a scenario mode identically to `dow.js` or `leer.js`. That
 * is deliberate and it is the whole design: `encryptCorpus` encrypts its documents against the
 * same KAS, retrieval asks the platform twice for it the same way, and no page has a branch for
 * "is this one of ours". A scenario that behaved differently would prove nothing.
 *
 * `raw` is kept on the mode so the builder can reopen a scenario for editing without a second
 * round-trip, and `isUserBuilt` so the launcher can offer Edit / Export / Delete on it — the only
 * two places in the renderer that care which kind of mode this is.
 */

const RULE_SHORT = (rule) => (String(rule).endsWith('HIERARCHY') ? 'HIERARCHY' : 'ANY_OF')

/** The short rule word plus a values list, for the vocabulary table on the How It Works page. */
function vocabularyDisplay(scenario) {
  return (scenario.vocabulary ?? []).map(d => ({
    name: d.name,
    rule: RULE_SHORT(d.rule),
    detail: d.detail?.trim()
      ? d.detail
      : `${(d.values ?? []).join(', ')}${RULE_SHORT(d.rule) === 'HIERARCHY' ? ' — highest first; a holder gets this level and everything below it.' : ''}`,
  }))
}

/**
 * One document, in corpus shape.
 *
 * Tiers are carried through untouched when present. A tiered document is not a special case in the
 * corpus — each tier is encrypted under its own policy, which is exactly what the builder collects.
 */
function toDocument(doc) {
  const base = {
    id: doc.id,
    label: doc.label,
    classification: doc.classification ?? '',
    keywords: doc.keywords ?? [],
  }
  if (Array.isArray(doc.tiers) && doc.tiers.length) {
    return {
      ...base,
      tiers: doc.tiers.map(t => ({
        id: t.id,
        label: t.label,
        classification: t.classification ?? '',
        policy: t.policy ?? [],
        policyNote: t.policyNote ?? '',
        text: t.text ?? '',
      })),
    }
  }
  return {
    ...base,
    policy: doc.policy ?? [],
    policyNote: doc.policyNote ?? '',
    text: doc.text ?? '',
  }
}

/** A persona or agent, display half only. */
const toSubject = (s, fallbackIcon) => ({
  id: s.id,
  name: s.name,
  title: s.title ?? '',
  icon: s.icon || fallbackIcon,
  color: s.color || '#6b7280',
  note: s.note ?? '',
})

/**
 * @param {object} scenario  as stored by electron/scenarios.js
 * @returns {object} a mode, the same shape src/modes/dow.js exports
 */
export function scenarioToMode(scenario) {
  const personas = (scenario.personas ?? []).map(p => toSubject(p, 'analyst'))
  const agents = (scenario.agents ?? []).map(a => toSubject(a, 'agent'))

  return {
    id: scenario.id,
    name: scenario.name,
    short: scenario.short?.trim() || scenario.name,
    tagline: scenario.tagline ?? '',
    icon: scenario.icon || 'public',
    accent: scenario.accent || '#6366f1',
    premise: scenario.premise ?? '',
    teaches: scenario.teaches ?? [],
    vocabulary: vocabularyDisplay(scenario),
    // Falling back to the first entry rather than null: a mode with no default persona would
    // leave the persona switcher empty and every retrieval unattributed.
    defaultPersonaId: scenario.defaultPersonaId ?? personas[0]?.id ?? null,
    defaultAgentId: scenario.defaultAgentId ?? agents[0]?.id ?? null,
    personas,
    agents,
    documents: (scenario.documents ?? []).map(toDocument),
    prompts: scenario.prompts ?? [],
    isUserBuilt: true,
    raw: scenario,
  }
}
