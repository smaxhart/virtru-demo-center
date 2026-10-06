import { state, esc } from './state.js'
import { PERSONAS, personaById } from './data.js'
import { evaluate, describe, LEVEL_NAME } from './policy.js'
import { decideLook } from './vault.js'

export const cur = () => personaById[state.persona]
export const lv = (l) => `<span class="lv ${l}">${l}</span>`

export function polChips(p) {
  if (!p) return ''
  return `${lv(p.level || 'U')} ${(p.wp || []).map((w) => `<span class="chip wp">wp:${esc(w)}</span>`).join(' ')} ${(p.comp || []).map((c) => `<span class="chip comp">${esc(c)}</span>`).join(' ')}`
}

export const pill = (kind, text) => `<span class="pill ${kind}">${esc(text)}</span>`

export const nameOf = (id) => (personaById[id] ? personaById[id].name : id)
export const shortName = (id) => {
  const p = personaById[id]
  if (!p) return id
  return state.trim ? p.id : p.name
}

/**
 * The KAS's answer for this person and this policy: `{ok, reason}`. The persona-level mirror in
 * policy.js is consulted only to word a refusal, never to make one.
 */
export const dec = (persona, policy) => decideLook(persona.kas, policy)

export function why(persona, policy, d) {
  const m = evaluate(persona, policy).missing
  if (m.length) return m
  return [d.pending ? 'checking with the KAS' : (d.reason || 'refused by the KAS')]
}

export function access(persona, policy) {
  const d = dec(persona, policy)
  return { ok: d.ok, missing: d.ok ? [] : why(persona, policy, d), pending: !!d.pending }
}

// --- run / layer access ---------------------------------------------------
export function layerPolicy(run, L, slot) {
  if (!run.derived) return null
  if (L === 'L1') return run.derived.layers.L1[slot] || null
  return run.derived.layers[L]
}

/** The receipt is the one app-level rule here, not a TDF: the submitter and the JPO may see that a run exists. */
export function receiptVisible(run, persona) {
  return run.submitter === persona.id || persona.kind === 'gov'
}

export function layerAccess(run, persona, L) {
  if (run.status !== 'sealed') return { ok: false, missing: ['no result produced'] }
  if (L === 'L0') return { ok: receiptVisible(run, persona), missing: receiptVisible(run, persona) ? [] : ['submitter or JPO'] }
  if (L === 'L1') {
    const per = run.parts.map((p) => ({ part: p, ...access(persona, run.derived.layers.L1[p.slot]) }))
    return { ok: per.some((x) => x.ok), per, missing: per.length ? per.find((x) => !x.ok)?.missing || [] : ['no attributable part'] }
  }
  return access(persona, run.derived.layers[L])
}

export function personaCard(p, on) {
  const ini = p.name.replace(/^(Dr\.|Maj\.|Col\.)\s*/, '').split(' ').map((w) => w[0]).join('')
  return `<button class="pc ${on ? 'on' : ''}" data-kind="${p.kind}" data-act="persona" data-id="${p.id}">
    <span class="av">${ini}</span>
    <span><span class="n">${esc(p.name)}</span><br><span class="t">${esc(p.title)}</span><br><span class="o">${esc(p.org)}</span>
    <span class="chips">${lv(p.clearance)}${p.wps.map((w) => `<span class="chip wp">wp:${w}</span>`).join('')}${p.comps.map((c) => `<span class="chip comp">${c}</span>`).join('')}</span></span>
  </button>`
}

export { PERSONAS, describe, LEVEL_NAME, evaluate }
