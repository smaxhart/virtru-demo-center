#!/usr/bin/env node
/**
 * The one way to cut a release. Two channels, one script.
 *
 *   node scripts/release.mjs beta      # staging  — publishes a GitHub *prerelease* from develop
 *   node scripts/release.mjs stable    # prod     — publishes a GitHub *release* from main
 *
 * Why channels and not environments: this is a desktop app distributed by auto-update, so the
 * thing standing between an idea and every seller's laptop is which release electron-updater is
 * willing to see. That is decided entirely by semver, in AppUpdater's constructor:
 *
 *     this.allowPrerelease = hasPrereleaseComponents(currentVersion)
 *
 * An installed 1.8.1 derives allowPrerelease=false and asks GitHub for `releases/latest`, which
 * omits prereleases — so a stable install *cannot* be offered a beta, with no client-side flag to
 * get wrong. An installed 1.9.0-beta.1 derives true, lists all releases, and takes the first
 * prerelease it finds. That is the whole gate: version string in, audience out.
 *
 * Two consequences that shape this script:
 *
 *   1. The channel *file* is always `latest-mac.yml` — PrivateGitHubProvider asks for
 *      getChannelFilename(getDefaultChannelName()) and that resolves to "latest" regardless of
 *      prerelease status. So we must NOT set electron-builder's `channel`; a beta build that
 *      emitted `beta-mac.yml` would 404 as ERR_UPDATER_CHANNEL_FILE_NOT_FOUND. Beta differs from
 *      stable only by the version string and the prerelease flag on the GitHub release.
 *
 *   2. A beta install is sticky. The provider picks `candidates.find(it => it.prerelease)`
 *      *before* comparing versions, so while any prerelease is still published, a machine on
 *      1.9.0-beta.1 keeps being told 1.9.0-beta.1 is current and will never roll forward to
 *      stable 1.9.0 on its own. Promoting therefore has a second step — retiring the beta — which
 *      this script tells you about but never does silently, because deleting a published release
 *      is not something a build script should decide.
 *
 * Every check below exists because it has been gotten wrong before or costs nothing to hold.
 * Nothing here is a lint pass: each failure is a release that would have shipped broken or a
 * release that would have shipped to nobody.
 *
 * Flags:
 *   --bump              bump package.json for the chosen channel before releasing (see BUMPS)
 *   --no-beta-gate      allow a stable release with no corresponding beta (escape hatch)
 *   --dry-run           run every check and print the plan; build and publish nothing
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PKG  = join(ROOT, 'package.json')

const CHANNELS = {
  beta:   { branch: 'develop', releaseType: 'prerelease', wantsPrerelease: true  },
  stable: { branch: 'main',    releaseType: 'release',    wantsPrerelease: false },
}

// ── Plumbing ──────────────────────────────────────────────────────────────────

const RED = s => `\x1b[31m${s}\x1b[0m`
const YEL = s => `\x1b[33m${s}\x1b[0m`
const GRN = s => `\x1b[32m${s}\x1b[0m`
const DIM = s => `\x1b[2m${s}\x1b[0m`

const problems = []
const warnings = []

const ok    = msg => console.log(`  ${GRN('✓')} ${msg}`)
const warn  = msg => { warnings.push(msg); console.log(`  ${YEL('!')} ${msg}`) }
const fail  = msg => { problems.push(msg); console.log(`  ${RED('✗')} ${msg}`) }
const note  = msg => console.log(`    ${DIM(msg)}`)

function sh(cmd, args, opts = {}) {
  return execFileSync(cmd, args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim()
}

/** Same, but a non-zero exit is an answer rather than an exception. */
function shSoft(cmd, args) {
  try { return { ok: true, out: sh(cmd, args) } }
  catch (e) { return { ok: false, out: ((e.stdout || '') + (e.stderr || '')).trim() } }
}

// ── Minimal semver ────────────────────────────────────────────────────────────
// Deliberately hand-rolled. `semver` is present in node_modules only as a transitive dependency
// of electron-updater; importing it here would be an undeclared dependency that a future dedupe
// could silently remove. We only ever compare shapes we ourselves produce: x.y.z[-tag.n].

function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(v)
  if (!m) return null
  return {
    raw: v,
    major: +m[1], minor: +m[2], patch: +m[3],
    pre: m[4] ? m[4].split('.').map(p => (/^\d+$/.test(p) ? +p : p)) : [],
  }
}

/** -1 / 0 / 1. Prerelease sorts below its own release, per semver §11. */
function cmpVersion(a, b) {
  for (const k of ['major', 'minor', 'patch']) {
    if (a[k] !== b[k]) return a[k] < b[k] ? -1 : 1
  }
  if (!a.pre.length && !b.pre.length) return 0
  if (!a.pre.length) return 1
  if (!b.pre.length) return -1
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    const x = a.pre[i], y = b.pre[i]
    if (x === undefined) return -1
    if (y === undefined) return 1
    if (x === y) continue
    if (typeof x === 'number' && typeof y === 'number') return x < y ? -1 : 1
    if (typeof x === 'number') return -1
    if (typeof y === 'number') return 1
    return x < y ? -1 : 1
  }
  return 0
}

/**
 * What --bump means per channel. Beta walks the prerelease counter and opens one from the next
 * patch when the current version is stable; stable drops the prerelease tag in place, so
 * 1.9.0-beta.3 promotes to exactly 1.9.0 — the version the betas were rehearsing.
 */
const BUMPS = {
  beta(v) {
    if (v.pre.length) {
      const pre = [...v.pre]
      const last = pre.length - 1
      if (typeof pre[last] === 'number') pre[last] += 1
      else pre.push(1)
      return `${v.major}.${v.minor}.${v.patch}-${pre.join('.')}`
    }
    return `${v.major}.${v.minor}.${v.patch + 1}-beta.1`
  },
  stable(v) {
    if (!v.pre.length) return `${v.major}.${v.minor}.${v.patch + 1}`
    return `${v.major}.${v.minor}.${v.patch}`
  },
}

// ── Main ──────────────────────────────────────────────────────────────────────

const argv    = process.argv.slice(2)
const channel = argv.find(a => !a.startsWith('-'))
const flags   = new Set(argv.filter(a => a.startsWith('-')))
const dryRun  = flags.has('--dry-run')

if (!CHANNELS[channel]) {
  console.error(`usage: node scripts/release.mjs <beta|stable> [--bump] [--no-beta-gate] [--dry-run]`)
  process.exit(2)
}

const spec = CHANNELS[channel]

console.log(`\n${channel === 'beta' ? 'Staging' : 'Production'} release — ${channel} channel${dryRun ? DIM(' (dry run)') : ''}\n`)

// 1 ── Clean tree. Modified tracked files are fatal: electron-builder packs from the filesystem,
//      not from the commit, so a dirty tree ships code that the tag does not describe. Untracked
//      files cannot end up in the app the same way and are only worth a nudge.
console.log('Working tree')
{
  const status = sh('git', ['status', '--porcelain'])
  const lines  = status ? status.split('\n') : []
  const dirty  = lines.filter(l => !l.startsWith('??'))
  const extra  = lines.filter(l =>  l.startsWith('??'))
  if (dirty.length) {
    fail(`${dirty.length} uncommitted change(s) — the build would not match the tag`)
    dirty.slice(0, 10).forEach(l => note(l))
  } else ok('no uncommitted changes to tracked files')
  if (extra.length) {
    warn(`${extra.length} untracked path(s) — will not be in the build`)
    extra.slice(0, 10).forEach(l => note(l))
  }
}

// 2 ── Right branch. Keeps the two channels from crossing: a beta must come off develop and a
//      stable off main, so "what is in prod" is answerable by reading one branch.
console.log('\nBranch')
const branch = sh('git', ['rev-parse', '--abbrev-ref', 'HEAD'])
if (branch === spec.branch) ok(`on ${branch}`)
else fail(`on ${branch}, but a ${channel} release must be cut from ${spec.branch}`)

// 3 ── Version, optionally bumped. electron-updater compares versions and ignores a release whose
//      version it already runs, so an un-bumped release publishes to complete silence.
console.log('\nVersion')
const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
let version = parseVersion(pkg.version)
if (!version) {
  fail(`package.json version "${pkg.version}" is not semver`)
} else if (flags.has('--bump')) {
  const next = BUMPS[channel](version)
  if (dryRun) {
    ok(`would bump ${version.raw} → ${next}`)
  } else {
    pkg.version = next
    writeFileSync(PKG, JSON.stringify(pkg, null, 2) + '\n')
    sh('git', ['add', 'package.json'])
    sh('git', ['commit', '-m', `v${next}`])
    ok(`bumped ${version.raw} → ${next} and committed`)
  }
  version = parseVersion(next)
}

if (version) {
  const hasPre = version.pre.length > 0
  if (hasPre === spec.wantsPrerelease) {
    ok(`${version.raw} is shaped for the ${channel} channel`)
  } else if (spec.wantsPrerelease) {
    fail(`${version.raw} has no prerelease tag — a beta needs one (e.g. ${version.major}.${version.minor}.${version.patch}-beta.1) or every stable install will be offered it`)
  } else {
    fail(`${version.raw} carries a prerelease tag — a stable release must not, or only beta installs would see it`)
  }
}

const tag = version ? `v${version.raw}` : null

// 4 ── gh, for both the publish token and the checks below. Per the app's own design the *feed*
//      token ships inside the build read-only; the *publish* token is write and stays here,
//      pulled from the gh keyring at build time and never written to disk.
console.log('\nGitHub CLI')
let ghToken = null
{
  const auth = shSoft('gh', ['auth', 'status'])
  if (!auth.ok) fail('gh is not authenticated — run: gh auth login')
  else {
    const t = shSoft('gh', ['auth', 'token'])
    if (!t.ok || !t.out) fail('gh auth token returned nothing — electron-builder cannot publish')
    else { ghToken = t.out; ok('authenticated, publish token available from keyring') }
  }
}

// 5 ── Not already published. Reusing a tag leaves the release pointing at one commit and the tag
//      at another, and electron-updater caches by version.
console.log('\nCollision')
let releases = []
{
  const r = shSoft('gh', ['release', 'list', '--limit', '100', '--json', 'tagName,isPrerelease,isDraft,publishedAt'])
  if (!r.ok) {
    warn('could not list releases — skipping collision and ordering checks')
    note(r.out.split('\n')[0] || '')
  } else {
    releases = JSON.parse(r.out)
    if (tag) {
      if (releases.some(rel => rel.tagName === tag)) fail(`${tag} is already published on GitHub`)
      else if (shSoft('git', ['rev-parse', '--verify', `refs/tags/${tag}`]).ok) fail(`${tag} already exists as a local git tag`)
      else ok(`${tag} is unused`)
    }
  }
}

// 6 ── Moving forward. A release that is not greater than what is already out is invisible to the
//      updater: allowDowngrade is false, so the client logs "not available" and users stay put.
if (version && releases.length) {
  const published = releases
    .filter(r => !r.isDraft)
    .map(r => ({ rel: r, v: parseVersion(r.tagName.replace(/^v/, '')) }))
    .filter(x => x.v)
  const highest = published.sort((a, b) => cmpVersion(b.v, a.v))[0]
  if (highest && cmpVersion(version, highest.v) <= 0) {
    fail(`${version.raw} is not newer than the published ${highest.v.raw} — installs would ignore it`)
  } else if (highest) {
    ok(`${version.raw} supersedes ${highest.v.raw}`)
  }
}

// 7 ── The staging gate itself. A stable release should be a beta that survived contact with a
//      real machine, so require that this exact version was rehearsed as a prerelease first.
//      --no-beta-gate exists for hotfixes, and says so in the log rather than passing quietly.
if (channel === 'stable' && version && releases.length) {
  console.log('\nStaging gate')
  const rehearsals = releases.filter(r => {
    const v = parseVersion(r.tagName.replace(/^v/, ''))
    return r.isPrerelease && v && v.major === version.major && v.minor === version.minor && v.patch === version.patch
  })
  if (rehearsals.length) {
    ok(`${version.raw} was staged as ${rehearsals.map(r => r.tagName).join(', ')}`)
  } else if (flags.has('--no-beta-gate')) {
    warn(`no beta was ever published for ${version.raw} — proceeding because --no-beta-gate was passed`)
  } else {
    fail(`no beta prerelease exists for ${version.raw} — stage it first (npm run release:beta), or pass --no-beta-gate`)
  }
}

// 8 ── Release notes, from the commits since the last release of any kind. Empty notes mean
//      either nothing changed or the branch is not where you think it is.
console.log('\nRelease notes')
let notes = ''
{
  const last = shSoft('git', ['describe', '--tags', '--abbrev=0', 'HEAD^'])
  const range = last.ok ? `${last.out}..HEAD` : 'HEAD'
  const log = shSoft('git', ['log', '--no-merges', '--pretty=format:- %s', range])
  notes = log.ok ? log.out : ''
  if (!notes) fail(`no commits since ${last.ok ? last.out : 'the beginning'} — nothing to release`)
  else {
    const n = notes.split('\n').length
    ok(`${n} commit${n === 1 ? '' : 's'} since ${last.ok ? last.out : 'the beginning'}`)
    notes.split('\n').slice(0, 8).forEach(l => note(l))
    if (n > 8) note(`… and ${n - 8} more`)
  }
}

// 9 ── Advisory only, and deliberately so: the embedded feed token is a known, accepted risk
//      pending the product team's fork. Flagged at every release so it stays known.
console.log('\nAdvisory')
{
  const main = readFileSync(join(ROOT, 'electron', 'main.js'), 'utf8')
  if (/['"](ghp|gho|ghu|ghs)_[A-Za-z0-9]{20,}['"]/.test(main)) {
    warn('the embedded update-feed token is a classic PAT (repo scope, read+write) and ships in this build')
    note('accepted risk, not a blocker — see the deferral note before "fixing" it')
  } else ok('no classic PAT found inline in electron/main.js')
}

// ── Verdict ───────────────────────────────────────────────────────────────────

console.log('')
if (problems.length) {
  console.log(RED(`${problems.length} problem${problems.length === 1 ? '' : 's'} — nothing was published.\n`))
  problems.forEach(p => console.log(`  ${RED('✗')} ${p}`))
  console.log('')
  process.exit(1)
}

const plan = [
  `tag        ${tag}`,
  `channel    ${channel} (GitHub ${spec.releaseType})`,
  `branch     ${branch}`,
  `artifacts  dmg + zip, mac arm64, channel file latest-mac.yml`,
]
console.log(`Ready.\n${plan.map(l => `  ${DIM(l)}`).join('\n')}\n`)

if (dryRun) {
  console.log(DIM('Dry run — stopping before tag, build, and publish.\n'))
  process.exit(0)
}

// Tag before building so the artifact and the tag describe the same commit. Pushed with the
// branch in one go; if the publish then fails, the tag is the thing to delete before retrying.
console.log(`Tagging ${tag}`)
sh('git', ['tag', '-a', tag, '-m', `${tag}\n\n${notes}`])
sh('git', ['push', 'origin', branch])
sh('git', ['push', 'origin', tag])
ok(`pushed ${branch} and ${tag}`)

// The renderer bundle is built here rather than in the npm script so that a failed check costs
// nothing — every gate above runs before we spend a build on it.
console.log(`\nBuilding renderer`)
execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' })

console.log(`\nBuilding and publishing`)
execFileSync(
  'npx',
  [
    'electron-builder', '--mac', '--arm64',
    '--publish', 'always',
    '-c.publish.releaseType=' + spec.releaseType,
  ],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, GH_TOKEN: ghToken } },
)

console.log(`\n${GRN('Published')} ${tag} as a ${spec.releaseType}.\n`)

// The sticky-beta problem from the header. Say it plainly and hand over the command, but do not
// delete a published release on the app's behalf.
if (channel === 'stable') {
  const stale = releases.filter(r => {
    const v = parseVersion(r.tagName.replace(/^v/, ''))
    return r.isPrerelease && v && cmpVersion(v, version) < 0
  })
  if (stale.length) {
    console.log(YEL('One step left.') + ` ${stale.length} prerelease(s) are still published, and any machine`)
    console.log(`running one will keep being told it is current — electron-updater picks the first`)
    console.log(`prerelease it finds before it compares versions. Retire them to release those installs:\n`)
    stale.forEach(r => console.log(`  gh release delete ${r.tagName} --yes`))
    console.log('')
  }
}

if (warnings.length) {
  console.log(DIM(`${warnings.length} warning${warnings.length === 1 ? '' : 's'} above did not block the release.\n`))
}
