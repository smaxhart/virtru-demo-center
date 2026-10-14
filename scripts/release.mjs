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
 *   --resume            finish a release whose tag is pushed and whose draft is still open (see §5)
 *   --no-beta-gate      allow a stable release with no corresponding beta (escape hatch)
 *   --dry-run           run every check and print the plan; build and publish nothing
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
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
const resume  = flags.has('--resume')

if (!CHANNELS[channel]) {
  console.error(`usage: node scripts/release.mjs <beta|stable> [--bump] [--resume] [--no-beta-gate] [--dry-run]`)
  process.exit(2)
}

// Contradictory intent, so refuse rather than pick one: --resume finishes the version that is
// already committed and tagged, and --bump moves package.json off it — which would tag a second
// version while the first one's draft is still sitting there open.
if (resume && flags.has('--bump')) {
  console.error(`--resume and --bump are incompatible: --resume finishes the release already tagged from this commit`)
  process.exit(2)
}

const spec = CHANNELS[channel]

console.log(`\n${channel === 'beta' ? 'Staging' : 'Production'} release — ${channel} channel${resume ? DIM(' (resuming)') : ''}${dryRun ? DIM(' (dry run)') : ''}\n`)

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
//
//      Unless we are resuming. The one failure this script cannot gate against happens *after* the
//      tag is pushed: electron-builder's DMG step hits the `hdiutil detach` exit-16 bug once the .zip
//      is already uploading, and what is left behind is a pushed tag, a bump commit, and a draft
//      holding half the asset set. Starting over is then impossible by design — this very check trips
//      on the tag the failed run created. --resume says the tag and the draft are ours, so reuse
//      them; that is safe for exactly one reason, which is that a draft is invisible to every
//      install, so rebuilding into it can hold a partial asset set without anyone seeing one.
//
//      A draft is also the only thing electron-builder will resume into. getOrCreateRelease() lists
//      releases, matches on tag_name, and returns early on `release.draft` — reusing it and deleting
//      any same-named asset before re-uploading (overwriteArtifact). Match a *published* release
//      while releaseType is draft and it returns null instead, at which point doUpload logs
//      "skipped publishing" per file and the build exits 0 having uploaded nothing. So the published
//      case is refused here, loudly, rather than left to look like a success: installs may already
//      have taken that release, and the answer is the next version, not a second attempt at this one.
console.log(resume ? '\nResume state' : '\nCollision')
let releases = []
{
  const r = shSoft('gh', ['release', 'list', '--limit', '100', '--json', 'tagName,isPrerelease,isDraft,publishedAt'])
  if (!r.ok) {
    // Advisory normally, fatal when resuming: "is it still a draft?" is the entire precondition, and
    // assuming it wrong means uploading into something installs can already see.
    if (resume) fail('could not list releases — cannot confirm the draft this would resume into')
    else warn('could not list releases — skipping collision and ordering checks')
    note(r.out.split('\n')[0] || '')
  } else {
    releases = JSON.parse(r.out)
    if (tag) {
      const existing = releases.find(rel => rel.tagName === tag)
      // Resolve to the commit, not the tag object: `git rev-parse refs/tags/x` on an annotated tag
      // answers with the tag's own sha and would never equal HEAD.
      const tagged = shSoft('git', ['rev-list', '-n', '1', tag])
      if (!resume) {
        if (existing) fail(`${tag} is already published on GitHub`)
        else if (tagged.ok) fail(`${tag} already exists as a local git tag`)
        else ok(`${tag} is unused`)
      } else if (!existing) {
        fail(`GitHub has no release for ${tag} — there is nothing to resume`)
        note(tagged.ok
          ? `the tag exists but no release was ever opened: drop it (git tag -d ${tag}, and git push origin :${tag} if it was pushed), then run without --resume`
          : `run without --resume to cut ${tag} from scratch`)
      } else if (!existing.isDraft) {
        fail(`${tag} is published, not a draft — that is not a resumable state`)
        note('installs may already have it; bump to the next version rather than rebuilding this one')
      } else if (!tagged.ok) {
        fail(`${tag} has an open draft but no local git tag — nothing here pins the build to a commit`)
      } else if (tagged.out !== sh('git', ['rev-parse', 'HEAD'])) {
        // Same reason the clean-tree gate is fatal: the build comes from the working tree, so if the
        // tag is no longer on HEAD the artifacts would describe a commit nobody can look up.
        fail(`${tag} points at ${tagged.out.slice(0, 8)} but HEAD is ${sh('git', ['rev-parse', 'HEAD']).slice(0, 8)} — the rebuild would not match the tag`)
        note(`commits landed after the tag: release those as the next version instead of resuming`)
      } else {
        ok(`${tag} has an open draft release, and the tag is on HEAD`)
        note('tag and push will be skipped; the build uploads into that draft')
      }
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
//      either nothing changed or the branch is not where you think it is. Advisory when resuming:
//      the tag that would carry these notes already exists and already carries them, so an empty
//      range says nothing about whether the draft can be finished.
console.log('\nRelease notes')
let notes = ''
{
  const last = shSoft('git', ['describe', '--tags', '--abbrev=0', 'HEAD^'])
  const range = last.ok ? `${last.out}..HEAD` : 'HEAD'
  const log = shSoft('git', ['log', '--no-merges', '--pretty=format:- %s', range])
  notes = log.ok ? log.out : ''
  if (!notes) (resume ? warn : fail)(`no commits since ${last.ok ? last.out : 'the beginning'} — nothing to release`)
  else {
    const n = notes.split('\n').length
    ok(`${n} commit${n === 1 ? '' : 's'} since ${last.ok ? last.out : 'the beginning'}`)
    notes.split('\n').slice(0, 8).forEach(l => note(l))
    if (n > 8) note(`… and ${n - 8} more`)
  }
}

// 8b ── Bundled inputs. electron-builder skips a missing extraResources `from` without an error, and
//       resources/bin is gitignored, so a fresh worktree builds an app with no platform binary.
console.log('\nBundled inputs')
{
  const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  const missing = (pkg.build?.extraResources ?? []).map(r => r.from).filter(f => !existsSync(join(ROOT, f)))
  if (missing.length) {
    fail(`${missing.length} extraResources input(s) missing — the app would ship without them`)
    missing.forEach(f => note(f))
  } else ok('every extraResources input is present')
}

// 9 ── The update-feed token. It ships inside the .app, so a bad one is a bad one on every machine that
//      installs the build, failing silently as "no updates available" (the v1.8.x installs that went
//      quiet with a revoked classic PAT). Checked here, before a build is spent on it:
//        present and filled in → fine-grained, never classic → GitHub accepts it → it can read this repo's
//        releases → it cannot write → it is not about to expire.
//      Fatal, not advisory: a release whose installs cannot update is a release that cannot be fixed
//      remotely. See electron/update-token.example.js for how to make one.
console.log('\nUpdate-feed token')
{
  const tokenPath = join(ROOT, 'electron', 'update-token.js')
  const pkg = JSON.parse(readFileSync(PKG, 'utf8'))
  const { owner, repo } = pkg.build.publish
  const EXPIRY_FLOOR_DAYS = 30
  let token = null
  if (!existsSync(tokenPath)) {
    fail('electron/update-token.js is missing — this build would never check for updates')
    note('cp electron/update-token.example.js electron/update-token.js, then paste a fine-grained token')
  } else {
    // A plain CommonJS string export; read it as text so this script never executes the file.
    token = (/module\.exports\s*=\s*['"]([^'"]+)['"]/.exec(readFileSync(tokenPath, 'utf8')) ?? [])[1] ?? null
    if (!token || token.includes('REPLACE_ME')) { fail('electron/update-token.js still holds the placeholder'); token = null }
    else if (/^(ghp|gho|ghu|ghs|ghr)_/.test(token)) {
      fail('the feed token is a classic PAT — read-write across every private repo, and it would ship in the app')
      token = null
    } else if (!token.startsWith('github_pat_')) { fail('the feed token does not look like a fine-grained PAT (expected github_pat_)'); token = null }
  }
  if (token) {
    const api = (path, init = {}) => fetch(`https://api.github.com/repos/${owner}/${repo}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...init.headers },
    }).catch(() => null)
    const meta = await api('')
    if (!meta) warn('could not reach GitHub to validate the feed token')
    else if (meta.status === 401) fail('GitHub rejected the feed token (401) — expired or revoked')
    else if (meta.status === 404) { fail(`the feed token cannot see ${owner}/${repo} (404)`); note('fine-grained tokens are per repository — check Repository access') }
    else if (!meta.ok) fail(`GitHub returned HTTP ${meta.status} validating the feed token`)
    else {
      // Not `permissions.push` on the repo: for a fine-grained token that field reports the *user's* role
      // (admin, for the owner), whatever the token is limited to, and would fail every read-only token.
      // Ask the question directly instead. An empty-body PUT to the contents API cannot create anything,
      // and GitHub checks the token's permission before it validates the body: 403 "Resource not
      // accessible by personal access token" means no Contents write, 422 means write is allowed.
      const probe = await api('/contents/.feed-token-write-probe', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: '{}',
      })
      if (!probe) warn('could not probe the feed token for write access')
      else if (probe.status === 403) ok(`feed token reads ${owner}/${repo} and cannot write to it`)
      else if (probe.status === 422) fail('the feed token can write to the repo — it ships in the app, so it must be Contents: read-only')
      else warn(`unexpected HTTP ${probe.status} probing the feed token for write access`)
      const rel = await api('/releases?per_page=1')
      if (!rel?.ok) { fail(`the feed token cannot read releases (HTTP ${rel?.status ?? '—'})`); note('add Repository permissions → Contents → Read-only') }
      else ok('feed token reads the releases API')
      const expiry = meta.headers.get('github-authentication-token-expiration')
      if (expiry) {
        const days = Math.floor((new Date(expiry) - new Date()) / 86_400_000)
        if (days < EXPIRY_FLOOR_DAYS) fail(`the feed token expires in ${days} day(s) — builds shipped now would stop updating almost immediately`)
        else ok(`feed token valid for ${days} more days (expires ${expiry.split(' ')[0]})`)
      } else warn('the feed token reports no expiry — a dated one is safer')
    }
  }
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
  `tag        ${tag}${resume ? '  (exists — reusing its open draft)' : ''}`,
  `channel    ${channel} (GitHub ${spec.releaseType})`,
  `branch     ${branch}`,
  `artifacts  dmg + zip, mac arm64, channel file latest-mac.yml`,
  `start at   ${resume ? 'build and upload — no tag, no push' : 'tag and push'}`,
]
console.log(`Ready.\n${plan.map(l => `  ${DIM(l)}`).join('\n')}\n`)

if (dryRun) {
  console.log(DIM(`Dry run — stopping before ${resume ? 'build and publish' : 'tag, build, and publish'}.\n`))
  process.exit(0)
}

// Tag before building so the artifact and the tag describe the same commit. Pushed with the
// branch in one go; if the publish then fails, the tag is the thing to delete before retrying.
// On --resume both already happened, and §5 has confirmed the tag is on HEAD.
if (resume) {
  console.log(`Resuming ${tag}`)
  ok(`tag and branch are already pushed — picking up at the build`)
} else {
  console.log(`Tagging ${tag}`)
  sh('git', ['tag', '-a', tag, '-m', `${tag}\n\n${notes}`])
  sh('git', ['push', 'origin', branch])
  sh('git', ['push', 'origin', tag])
  ok(`pushed ${branch} and ${tag}`)
}

// The renderer bundle is built here rather than in the npm script so that a failed check costs
// nothing — every gate above runs before we spend a build on it.
//
// This ordering is load-bearing, and most of all on --resume. vite build carries emptyOutDir, so it
// is what clears dist/ — and on a resume dist/ still holds the failed attempt's .app, .zip and .dmg.
// Going straight to electron-builder packs those back into app.asar: measured at 357M → 760M, taking
// the .zip from 421M to 840M, during the v1.8.2-beta.1 recovery. build.files excludes them by pattern
// now (7371047), but that is the second line of defence. Never reorder these two.
//
// Ordering does NOT save us from dist/mac-arm64/, though, and that one was invisible for far longer:
// electron-builder creates the staging .app itself, mid-run, *before* it globs the file list, so a
// clean build packed a second copy of Electron.app into its own asar — 241.7 of app.asar's 364.8 MB,
// in every build through v1.8.2-beta.2. It hid because the .zip only moved ~40 KB between releases,
// so 421 MB read as the known-good size and 357 MB as a clean asar. Neither was clean. `!dist/mac*`
// is the only defence here; asar size, not artifact size, is what catches a regression.
console.log(`\nBuilding renderer`)
execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' })

// Always build as a *draft*, whatever the channel — then verify, prune, and flip it visible.
//
// electron-builder would happily publish straight to non-draft: gitHubPublisher.js sets
// `draft: this.releaseType === "draft"` at creation, so `releaseType: release` creates the release
// *before* uploading, and these artifacts are ~818 MB together. That leaves a live release holding
// a partial asset set for the whole upload window — and an install that checks in during it gets a
// latest-mac.yml pointing at a .zip that is not there yet. Draft-then-flip is the same shape the
// manual `gh` flow arrived at the hard way: while it is a draft, no installed copy can see it.
console.log(`\nBuilding and uploading (as a draft)`)
execFileSync(
  'npx',
  [
    'electron-builder', '--mac', '--arm64',
    '--publish', 'always',
    '-c.publish.releaseType=draft',
  ],
  { cwd: ROOT, stdio: 'inherit', env: { ...process.env, GH_TOKEN: ghToken } },
)

// Expected asset set, read from the feed the build just wrote rather than assumed: latest-mac.yml
// plus every file it names, at the size it claims. A truncated upload still lists as an asset, so
// size is the check that catches it.
console.log(`\nVerifying assets`)
const feedPath = join(ROOT, 'dist', 'latest-mac.yml')
const feed = readFileSync(feedPath, 'utf8')
const expected = new Map([['latest-mac.yml', null]])
for (const m of feed.matchAll(/^\s*-\s*url:\s*(\S+)[\s\S]*?^\s*size:\s*(\d+)/gm)) {
  expected.set(decodeURIComponent(m[1]), +m[2])
}
// electron-builder does list the .dmg under files[] as well as the .zip, so the loop above normally
// catches it with a size. Belt-and-braces for the case where it does not: auto-update only ever
// reads the .zip that `path:` names, but the .dmg is what the README links for fresh installs, so a
// release without one is broken for new sellers. Never downgrade an entry that already has a size.
for (const m of feed.matchAll(/(\S+\.dmg)/g)) {
  const name = decodeURIComponent(m[1])
  if (!expected.has(name)) expected.set(name, null)
}

const assetsOf = () => JSON.parse(sh('gh', ['release', 'view', tag, '--json', 'assets'])).assets

// Blockmaps are uploaded by electron-builder and deliberately not kept: a differential download
// needs the *previous* release's blockmap too, so the first one buys nothing, and electron-updater's
// differential path is the part that has broken before. Dropped while still invisible, which leaves
// the same three-asset release every version through 1.8.1 shipped.
{
  const blockmaps = assetsOf().filter(a => a.name.endsWith('.blockmap'))
  for (const b of blockmaps) {
    shSoft('gh', ['release', 'delete-asset', tag, b.name, '--yes'])
    ok(`dropped ${b.name}`)
  }
  if (!blockmaps.length) ok('no blockmaps to drop')
}

{
  const assets = assetsOf()
  const missing = []
  for (const [name, size] of expected) {
    const a = assets.find(x => x.name === name)
    if (!a) missing.push(`${name} — not uploaded`)
    else if (a.state !== 'uploaded') missing.push(`${name} — state=${a.state}`)
    else if (size != null && a.size !== size) missing.push(`${name} — ${a.size} bytes, feed says ${size}`)
    else ok(`${name}${size != null ? ` (${size} bytes)` : ''}`)
  }
  if (missing.length) {
    console.log(`\n${RED('Assets are incomplete — the release is still a draft, so no install can see it.')}\n`)
    missing.forEach(m => console.log(`  ${RED('✗')} ${m}`))
    console.log(`\n  Re-upload, then publish by hand. HTTP 500 on the big files is transient — retry it:\n`)
    console.log(`    gh release upload ${tag} dist/*.zip dist/*.dmg --clobber`)
    console.log(`    gh release edit ${tag} --draft=false${channel === 'beta' ? ' --prerelease' : ' --latest'}\n`)
    process.exit(1)
  }
}

// Only now does it become visible to anyone.
console.log(`\nPublishing`)
sh('gh', ['release', 'edit', tag,
  '--draft=false',
  ...(channel === 'beta' ? ['--prerelease'] : ['--latest']),
  '--title', `${tag}`,
])
ok(`${tag} is live as a ${spec.releaseType}`)

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
