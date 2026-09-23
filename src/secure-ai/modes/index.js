/**
 * The mode registry.
 *
 * A mode is a self-contained scenario: its own personas, its own corpus, its own slice of the
 * attribute vocabulary, and its own teaching points. Nothing about the platform is per-mode —
 * one namespace, one seed, one set of attribute definitions covering all five. Switching modes
 * changes which documents get encrypted and which personas the switcher offers, not the
 * enforcement path.
 *
 * Order here is the order the home page shows them. `dib` sits next to `civilian` because the two
 * are the unclassified pair and are best shown together: the same CUI vocabulary inside one
 * government, then across the boundary between a government and its suppliers.
 */

import dow from './dow.js'
import civilian from './civilian.js'
import dib from './dib.js'
import ic from './ic.js'
import leer from './leer.js'

export const MODES = [dow, civilian, dib, ic, leer]

const byId = new Map(MODES.map((m) => [m.id, m]))

export const getMode = (id) => byId.get(id) ?? null
