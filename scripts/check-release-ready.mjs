#!/usr/bin/env node
/**
 * Preflight for `npm run release`.
 *
 * The feed token ships inside the .app, so a bad one is not a local problem — it is a bad
 * one on every machine that installs the build, failing silently as "no updates available".
 * These checks run before electron-builder so that never leaves the room.
 *
 * Checked, in order of how badly each fails:
 *   1. the token exists and is not the placeholder
 *   2. it is fine-grained, not a classic PAT (classic = read-write on every private repo)
 *   3. GitHub still accepts it, it can actually read this repo's releases, and it has
 *      write access to nothing
 *   4. it is not about to expire mid-release-cycle
 *   5. the version is not one that already has a release — electron-updater ignores a
 *      release that is not strictly newer, so re-releasing looks like success and does nothing
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const pkg = require(path.join(ROOT, 'package.json'))
const { owner, repo } = pkg.build.publish

const TOKEN_PATH = path.join(ROOT, 'electron', 'update-token.js')
const EXPIRY_FLOOR_DAYS = 30

const fail = (msg, hint) => {
  console.error(`\n  ✗ ${msg}`)
  if (hint) console.error(`    ${hint}`)
  console.error()
  process.exit(1)
}
const ok = msg => console.log(`  ✓ ${msg}`)

// 1 — present and filled in
if (!fs.existsSync(TOKEN_PATH)) {
  fail(
    'electron/update-token.js is missing, so this build would never check for updates.',
    'cp electron/update-token.example.js electron/update-token.js — that file has the setup steps.',
  )
}
const token = String(require(TOKEN_PATH)).trim()
if (!token || token.includes('REPLACE_ME')) {
  fail('electron/update-token.js still holds the placeholder.', 'See electron/update-token.example.js.')
}

// 2 — fine-grained only
if (/^(ghp|gho|ghu|ghs|ghr)_/.test(token)) {
  fail(
    'That is a classic PAT. It ships inside the app, and classic `repo` scope is read-write ' +
    'across every private repository on the account.',
    'Create a fine-grained PAT limited to this repo with Contents: read-only.',
  )
}
if (!token.startsWith('github_pat_')) {
  fail('Token does not look like a fine-grained PAT (expected a github_pat_ prefix).')
}
ok('token present and fine-grained')

// 3, 4 — GitHub agrees, and the scope is what we think it is
const gh = (url) => fetch(url, {
  headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
})

const repoRes = await gh(`https://api.github.com/repos/${owner}/${repo}`)
if (repoRes.status === 401) fail('GitHub rejected the token (401) — expired or revoked.')
if (repoRes.status === 404) {
  fail(
    `Token cannot see ${owner}/${repo} (404).`,
    'Fine-grained tokens are per-repository — check Repository access on the token.',
  )
}
if (!repoRes.ok) fail(`GitHub returned HTTP ${repoRes.status} for the repo.`)

const meta = await repoRes.json()
if (meta.permissions?.push) {
  fail(
    'The token has write access. It ships inside the app, so it must be read-only.',
    'Set Repository permissions → Contents → Read-only (not Read and write).',
  )
}
ok(`token reads ${owner}/${repo}, and cannot write to it`)

// Releases specifically — Contents: read is what covers this, so a token with only
// Metadata would pass the check above and still fail at update time.
const relRes = await gh(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`)
if (!relRes.ok) {
  fail(
    `Token cannot read the releases API (HTTP ${relRes.status}).`,
    'Add Repository permissions → Contents → Read-only. Metadata alone is not enough.',
  )
}
ok('token reads the releases API')

const expiry = repoRes.headers.get('github-authentication-token-expiration')
if (expiry) {
  const days = Math.floor((new Date(expiry) - new Date()) / 86_400_000)
  if (days < 0) fail(`Token expired ${-days} day(s) ago.`)
  if (days < EXPIRY_FLOOR_DAYS) {
    fail(
      `Token expires in ${days} day(s). Builds shipped now would stop updating almost immediately.`,
      'Rotate it before releasing, and put the new expiry in a calendar reminder.',
    )
  }
  ok(`token valid for ${days} more day(s) (expires ${expiry.split(' ')[0]})`)
} else {
  console.log('  · token reports no expiry — a dated one is safer, but not fatal')
}

// 5 — version must be new
const releases = await relRes.json()
const clash = releases.find(r => r.tag_name === `v${pkg.version}` || r.name === pkg.version)
if (clash) {
  fail(
    `v${pkg.version} already has a release (${clash.tag_name}).`,
    'Bump "version" in package.json. electron-updater ignores a release that is not strictly ' +
    'newer, so this would upload fine and update nobody.',
  )
}
ok(`v${pkg.version} is unreleased`)

console.log('\nPreflight passed — building.\n')
