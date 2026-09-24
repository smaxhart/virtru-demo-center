/**
 * Version comparison for the auto-updater's "is this download actually newer?" guard.
 *
 * Its own module for one reason: `scripts/verify-updater.mjs` can require the real function
 * instead of reimplementing it, which is how the rest of the verify suite works. Requiring
 * `electron/main.js` from a script is not an option — it boots Electron.
 *
 * The bug this replaces: the guard used
 *
 *     info.version.localeCompare(current, undefined, { numeric: true, sensitivity: 'base' }) > 0
 *
 * and `'1.8.3'.localeCompare('1.8.3-beta.1', undefined, { numeric: true })` is **-1**. Same
 * numeric prefix, and the prerelease string is longer, so a stable release reads as OLDER than
 * its own beta. Every prerelease → stable hop was therefore discarded after downloading — seen
 * for real on 2026-09-24, where 1.8.3-beta.1 fetched all 310 MB of 1.8.3 and then dropped it with
 * `Downloaded v1.8.3 is not newer than current v1.8.3-beta.1 — ignoring`. Silent, and the machine
 * stays on the beta forever.
 *
 * Semver rules, which string collation cannot express: a version with no prerelease tag outranks
 * the same version with one, so those two cases are spelled out rather than left to the collator.
 * The collator is still used for the tag-vs-tag case, where it is correct and numeric-aware
 * (`beta.10` > `beta.9`).
 */

function isNewerVersion(a, b) {
  const parse = v => {
    const [core, pre] = String(v).split('-')
    return { nums: core.split('.').map(n => parseInt(n, 10) || 0), pre }
  }
  const x = parse(a), y = parse(b)
  for (let i = 0; i < 3; i++) {
    if ((x.nums[i] || 0) !== (y.nums[i] || 0)) return (x.nums[i] || 0) > (y.nums[i] || 0)
  }
  if (x.pre === y.pre) return false                                     // same version, tag included
  if (!x.pre) return true                                               // 1.8.3 > 1.8.3-beta.1
  if (!y.pre) return false                                              // 1.8.3-beta.1 < 1.8.3
  return x.pre.localeCompare(y.pre, undefined, { numeric: true }) > 0    // beta.2 > beta.1
}

module.exports = { isNewerVersion }
