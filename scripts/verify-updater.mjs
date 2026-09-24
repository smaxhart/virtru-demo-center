/**
 * Checks the auto-updater's "is this download actually newer?" guard.
 *
 *   node scripts/verify-updater.mjs        # no platform, no app — pure logic
 *
 * This exists because the guard cannot be exercised any other way. `setupUpdater()` returns
 * early when `!app.isPackaged`, so no dev run touches it, and the only way to see it decide is
 * to cut two releases and watch a real machine — which is how the original bug survived: a
 * string comparison called 1.8.3 older than 1.8.3-beta.1, so the app downloaded 310 MB of the
 * stable release and silently discarded it, leaving the machine on the beta forever.
 *
 * It requires the real `electron/update-version.js`, not a copy, so this cannot pass while the
 * shipped comparator is wrong.
 *
 * Exits non-zero on any failure.
 */

import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { isNewerVersion } = require('../electron/update-version.js')

const GRN = s => `\x1b[32m${s}\x1b[0m`
const RED = s => `\x1b[31m${s}\x1b[0m`
const DIM = s => `\x1b[2m${s}\x1b[0m`

// [ candidate, installed, expected, why it matters ]
const CASES = [
  ['1.8.3',        '1.8.3-beta.1',  true,  'the hop that was broken — stable supersedes its own beta'],
  ['1.8.3-beta.1', '1.8.3',         false, 'and not the other way round: never downgrade a stable install'],
  ['1.8.4',        '1.8.3',         true,  'ordinary stable → stable'],
  ['1.8.3',        '1.8.4',         false, 'an older stable is not an update'],
  ['1.8.3',        '1.8.3',         false, 'same version re-downloaded — the guard\'s original job'],
  ['1.8.3-beta.2', '1.8.3-beta.1',  true,  'beta → newer beta'],
  ['1.8.3-beta.1', '1.8.3-beta.2',  false, 'beta → older beta'],
  ['1.8.3-beta.10','1.8.3-beta.9',  true,  'prerelease counters compare numerically, not as strings'],
  ['1.8.3-beta.1', '1.8.3-beta.1',  false, 'same prerelease re-downloaded'],
  ['1.9.0',        '1.8.3-beta.1',  true,  'a later minor outranks any earlier prerelease'],
  ['2.0.0',        '1.9.9',         true,  'major bump'],
  ['1.8.3',        '1.8.2',         true,  'the 1.8.2 → 1.8.3 path real installs took today'],
]

console.log(`\nverify:updater — ${CASES.length} version comparisons\n`)

let failed = 0
for (const [candidate, installed, expected, why] of CASES) {
  const got = isNewerVersion(candidate, installed)
  const ok = got === expected
  if (!ok) failed++
  const verdict = expected ? 'install it' : 'ignore it'
  console.log(`  ${ok ? GRN('✓') : RED('✗')} ${candidate} over ${installed} → ${verdict}`)
  console.log(`    ${DIM(why)}`)
  if (!ok) console.log(`    ${RED(`expected ${expected}, got ${got}`)}`)
}

// The specific regression, stated once more in the terms the bug appeared in: string collation
// with numeric ordering gets this exact pair wrong, and that is what shipped.
const collation = '1.8.3'.localeCompare('1.8.3-beta.1', undefined, { numeric: true, sensitivity: 'base' }) > 0
if (collation) {
  console.log(`\n  ${RED('✗')} localeCompare now agrees with semver here — this check has gone stale, rewrite it`)
  failed++
} else {
  console.log(`\n  ${GRN('✓')} localeCompare still gets 1.8.3 vs 1.8.3-beta.1 wrong, and is no longer used for it`)
}

if (failed) {
  console.log(`\n${RED(`${failed} comparison(s) wrong — the updater would act on this.`)}\n`)
  process.exit(1)
}
console.log(`\n${GRN(`All ${CASES.length} comparisons correct — prerelease → stable installs, downgrades do not.`)}\n`)
