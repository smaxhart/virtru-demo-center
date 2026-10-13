/**
 * The SCM's rows as real TDFs, and the key server's answer to "may this person see this row".
 *
 * Same shape as `vault.js` and the same two primitives (`encryptText`, `decryptTdf`). Nothing here
 * decides anything: a row is visible to a person exactly when the KAS releases its key to them, so
 * a disabled account, an edited grant or a changed attribute moves the tables with no second edit.
 */

import { encryptText, decryptTdf } from '../api/tdf.js'
import { SCM_ROWS } from './scmData.js'

/** Encrypt every row as the platform admin. A few at a time: they are tiny, and boot is on screen. */
export async function encryptScmRows(onProgress) {
  const vault = new Map()
  const batch = 4
  for (let i = 0; i < SCM_ROWS.length; i += batch) {
    onProgress?.({ done: i, total: SCM_ROWS.length, label: 'Meridian SCM records' })
    await Promise.all(SCM_ROWS.slice(i, i + batch).map(async row => {
      const { tdfBytes } = await encryptText(row.text, row.policy, 'admin')
      vault.set(row.key, { row, tdfBytes })
    }))
  }
  onProgress?.({ done: SCM_ROWS.length, total: SCM_ROWS.length, label: 'Meridian SCM records' })
  return vault
}

/** The keys of every row this person may open: one real rewrap per row. */
export async function visibleScmRows(vault, personaId) {
  const keys = [...vault.keys()]
  const answers = await Promise.all(keys.map(async key => {
    try { await decryptTdf(vault.get(key).tdfBytes, personaId); return true } catch { return false }
  }))
  return new Set(keys.filter((_, i) => answers[i]))
}
