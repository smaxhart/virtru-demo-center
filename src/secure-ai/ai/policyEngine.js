/**
 * Query classification and prompt construction.
 *
 * Note what is NOT here: the access decision. In this app the decision belongs to the
 * KAS, which either rewraps a document key or refuses. The functions below classify a
 * query so the app knows which document to attempt, and — after a refusal — explain
 * which attributes were missing so the UI can say something useful.
 *
 * That explanation is derived from the same FQNs the KAS evaluated, but it is
 * commentary on a decision already made, never the decision itself.
 */

import { shortFqn } from './corpus.js'

/**
 * Which document a free-text query is asking about, or null for a general question.
 * @param {string} text the user's query
 * @param {Array} documents the active mode's `documents` array
 */
export function classifyQuery(text, documents) {
  const lower = text.toLowerCase()
  let best = null
  let bestScore = 0

  // Longest keyword hit wins, so "five eyes" beats a stray "intel" in the same sentence
  for (const doc of documents) {
    for (const kw of doc.keywords) {
      if (lower.includes(kw) && kw.length > bestScore) {
        best = doc
        bestScore = kw.length
      }
    }
  }
  return best
}

/**
 * Group a flat FQN list by attribute name.
 * ['clearance:secret', 'needtoknow:intel', 'needtoknow:ops']
 *   → { clearance: ['secret'], needtoknow: ['intel', 'ops'] }
 */
function groupByAttribute(fqns) {
  const out = {}
  for (const fqn of fqns) {
    const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
    if (!m) continue
    ;(out[m[1]] ??= []).push(m[2])
  }
  return out
}

/**
 * Explain a denial: which attribute definitions in the policy the persona failed.
 *
 * Mirrors how the platform composes rules — definitions AND together, values within a
 * definition are satisfied by any one match (or by holding an equal-or-higher clearance).
 * Called only after the KAS has already refused.
 *
 * @returns {Array<{attribute: string, required: string[], held: string[], satisfied: boolean}>}
 */
export function explainPolicy(policy, entityFqns) {
  const required = groupByAttribute(policy)
  const held = groupByAttribute(entityFqns)

  return Object.entries(required).map(([attribute, requiredValues]) => {
    const heldValues = held[attribute] ?? []
    return {
      attribute,
      required: requiredValues,
      held: heldValues,
      // The issuer already expands clearance downward into the entity attributes, so a
      // plain intersection is the right test for every definition including HIERARCHY.
      satisfied: requiredValues.some(v => heldValues.includes(v)),
    }
  })
}

/** The unmet attribute definitions, shortest useful form for a chat message. */
export function missingAttributes(policy, entityFqns) {
  return explainPolicy(policy, entityFqns)
    .filter(r => !r.satisfied)
    .map(r => r.required.length > 3
      ? `${r.attribute} (one of ${r.required.length})`
      : r.required.map(v => `${r.attribute}:${v}`).join(' or '))
}

// Answers when the query touches no classified document at all.
const OPEN_SYSTEM = `
You are Virtru Secure AI, an assistant running inside the Virtru Data Security Platform.
You are a capable general-purpose assistant — answer ordinary questions helpfully.

You also know this platform well:
- TDF (Trusted Data Format) wraps any file with AES-256-GCM encryption and binds the policy inside the file itself
- Every decrypt requires a live KAS check; the key is never held client-side
- Entitlements are attribute values resolved from the caller's identity token on every request
- Policy is enforced at the data layer, so the application cannot override it
- Subject mappings connect identity claims to policy attribute values
- ABAC means access follows the caller's attributes, not their identity or their role in an app
- The policy travels with the data, so it still applies after the file is copied or forwarded

Answer questions about Virtru, TDF, or KAS with real depth. Answer everything else like any
good assistant would. Never invent classified content: if a question needs a document you
were not given, say the retrieval layer did not release one.
`.trim()

function personaContext(persona, entityFqns) {
  const attrs = entityFqns.length > 0 ? entityFqns.map(shortFqn).join(', ') : 'none — uncleared user'
  return `You are answering ${persona.name}, ${persona.title}.\nAttributes resolved for this caller: ${attrs}.`
}

/**
 * The agent's own identity, stated to the model.
 *
 * This is framing, not enforcement — the enforcement already happened, twice, before any of
 * this text was assembled. It is here because the model is the agent, and an assistant that
 * knows its own entitlements can answer "why can't you see the briefing?" accurately instead
 * of guessing at it.
 */
function agentContext(agent, agentFqns) {
  if (!agent) return ''
  const attrs = agentFqns?.length > 0 ? agentFqns.map(shortFqn).join(', ') : 'none — you hold no entitlements'
  return `\n\nYou are running as ${agent.name}, a machine identity with attributes of its own.`
    + `\nAttributes resolved for you: ${attrs}.`
    + `\nA document reaches you only when the platform released it to both this caller and to you.`
    + ` If asked why something is unavailable, you may say which of the two was refused.`
}

/**
 * Build the system prompt.
 *
 * `documentText` is plaintext that came back from a successful KAS rewrap. If it is
 * null the model is given no document — not a redacted one, and not an instruction to
 * withhold. The model cannot leak what was never put in its context.
 *
 * `mode` only colours the framing sentence. Three of the five scenarios contain nothing
 * classified at all — Federal Civilian, the Defense Industrial Base and Law Enforcement name no
 * `clearance` anywhere — and telling the model otherwise makes it answer in the wrong register.
 */
export function buildSystemPrompt({ persona, entityFqns, unit, documentText, mode, agent, agentFqns }) {
  const ctx = personaContext(persona, entityFqns) + agentContext(agent, agentFqns)

  if (!unit || !documentText) {
    return `${OPEN_SYSTEM}\n\n${ctx}`
  }

  const setting = mode?.name ? `a ${mode.name} environment` : 'a controlled environment'

  return `
You are an AI assistant operating in ${setting}. The document below was released to
you by the data layer for this specific caller. Answer only from its contents.

DOCUMENT: ${unit.label}
CLASSIFICATION: ${unit.classification}

---
${documentText}
---

${ctx}

Answer the question strictly from the document above. Be concise and concrete. Do not
repeat the classification banner. If the answer is not in the document, say so plainly
rather than inferring it.
`.trim()
}
