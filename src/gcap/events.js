/**
 * A day on the programme: four things that happen in the world, each reduced to the one change
 * somebody actually makes at the identity provider.
 *
 * What an event does to the matrix is NOT written here. An event is a change to one person (or one
 * account); the page applies it to the platform and re-asks the key server, and the cells that
 * move are the ones the KAS answered differently. The expectations in `scripts/verify-gcap.mjs`
 * are the only place the outcome is written down, and they are compared with the live answer.
 */

import { EDITABLE } from './entitle.js'

const list = (v) => [].concat(v ?? []).filter(Boolean)

const drop = (grants, name, value) => ({ ...grants, [name]: list(grants[name]).filter(v => v !== value) })
const swap = (grants, name, from, to) => ({
  ...grants, [name]: [...new Set(list(grants[name]).map(v => (v === from ? to : v)))],
})
const floor = (grants, value) => ({ ...grants, clearance: value })

export const DAY = [
  {
    id: 'owen-acquired', time: '08:12', title: "Owen's shop is acquired",
    body: 'The supplier register drops the Tier-3 relationship. Nobody edits a document.',
    person: 'gcap-owen',
    change: { kind: 'grants', apply: (g) => drop(g, 'supplytier', 'tier3') },
  },
  {
    id: 'wren-compromised', time: '10:47', title: "Wren's account is compromised",
    body: 'Security disables the account at the identity provider. The files on Wren\'s laptop stay where they are.',
    person: 'gcap-wren',
    change: { kind: 'revoke' },
  },
  {
    id: 'priya-lapse', time: '13:30', title: "Priya's clearance lapses",
    body: 'A periodic review is overdue. Her clearance drops from SECRET to RESTRICTED.',
    person: 'gcap-priya',
    change: { kind: 'grants', apply: (g) => floor(g, 'cui') },
  },
  {
    id: 'kenji-moved', time: '16:05', title: 'Kenji moves to integration',
    body: 'Reassigned from propulsion to the integration work package.',
    person: 'gcap-kenji',
    change: { kind: 'grants', apply: (g) => swap(g, 'workpackage', 'propulsion', 'integration') },
  },
]

/** Keep only grants the platform will accept. Empty lists are dropped so an edit never sends `[]`. */
export function cleanGrants(grants) {
  const out = {}
  for (const name of EDITABLE) {
    const v = list(grants[name])
    if (!v.length) continue
    out[name] = name === 'clearance' ? v[0] : v
  }
  return out
}
