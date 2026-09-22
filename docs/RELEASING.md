# Releasing

Three layers, one command each.

| Layer | What it is | How you get there | Who sees it |
|---|---|---|---|
| **dev** | `npm run dev` — Vite watch + Electron, no packaging | nothing to publish | you |
| **staging** | a `-beta.N` DMG published as a GitHub **prerelease** | `npm run release:beta` from `develop` | only machines already running a beta |
| **prod** | a plain `x.y.z` DMG published as a GitHub **release** | `npm run release` from `main` | every install |

## Why channels rather than environments

There is no server to deploy, so the only thing standing between an idea and every seller's laptop
is which release `electron-updater` is willing to see. That is decided by semver alone, in
`AppUpdater`'s constructor:

```js
this.allowPrerelease = hasPrereleaseComponents(currentVersion)
```

An installed `1.8.1` derives `allowPrerelease: false` and asks GitHub for `releases/latest`, which
excludes prereleases. A stable install therefore **cannot** be offered a beta — there is no
client-side flag to get wrong, and no build of the app needs to know which channel it is on. An
installed `1.9.0-beta.1` derives `true`, lists all releases, and takes the first prerelease it finds.

Two consequences worth knowing before you change any of this:

- **The channel file is always `latest-mac.yml`.** `PrivateGitHubProvider` requests
  `getChannelFilename(getDefaultChannelName())`, which resolves to `"latest"` regardless of
  prerelease status. Do **not** set electron-builder's `channel` for beta builds — a release
  carrying only `beta-mac.yml` fails with `ERR_UPDATER_CHANNEL_FILE_NOT_FOUND`. Beta differs from
  stable by exactly two things: the version string, and the prerelease flag on the GitHub release.
- **A beta install is sticky.** The provider picks `candidates.find(it => it.prerelease)` *before*
  comparing versions, so while any prerelease is still published, a machine on `1.9.0-beta.1` keeps
  being told it is current and never rolls forward to stable `1.9.0`. See *Promoting* below.

## The loop

```bash
git checkout develop        # all work lands here first
npm run dev                 # iterate
```

When something is worth trying on a real machine:

```bash
npm run release:beta -- --bump
```

That bumps `1.9.0-beta.1 → 1.9.0-beta.2` (or opens `1.9.1-beta.1` from a stable version), runs every
check below, tags, builds, and publishes a prerelease. Install that DMG yourself, then run the
verification suite against the running app:

```bash
npm run verify
```

`verify` needs the app **open** — the platform and the JWT issuer both live in the Electron main
process, so this is a manual gate, not an automated one. It is the real content of "staging verified
no breaks": [`verify-matrix`](../scripts/verify-matrix.mjs) re-derives every access decision in every
mode against a live KAS, which is the part of this app that breaks silently.

### Promoting

```bash
git checkout main
git merge --no-ff develop
npm run release -- --bump      # 1.9.0-beta.2 → 1.9.0
```

The stable release refuses to go out unless a beta was published for that exact version
(`--no-beta-gate` overrides it for hotfixes, and logs that it did). Afterwards the script prints the
`gh release delete` commands for any superseded prereleases — run them, or the machines on those
betas stay stuck. It does not delete published releases on its own.

## Checks

Every one of these is a release that would otherwise have shipped broken, or shipped to nobody.
Preview them any time with `npm run release:check` / `release:check:beta` (`--dry-run`: all checks,
no tag, no build, no publish).

| Check | Why |
|---|---|
| Clean tree | electron-builder packs from the filesystem, not from the commit — a dirty tree ships code the tag does not describe |
| Right branch | beta from `develop`, stable from `main`, so "what is in prod" is answerable by reading one branch |
| Version shape | a beta without a prerelease tag would be offered to every stable install; a stable with one would be offered to nobody |
| `gh` authenticated | the **publish** token is write-scoped and comes from the gh keyring at build time — it is never written to disk |
| Tag unused | reusing a tag leaves the release and the tag pointing at different commits |
| Version moves forward | `allowDowngrade` is false, so a version that is not strictly greater is silently ignored by every install |
| Staging gate | stable requires a matching beta (see above) |
| Notes non-empty | no commits since the last tag means nothing to release, or you are on the wrong branch |

## How it publishes

Both channels build as a **draft** and only flip visible once the assets check out, because these
artifacts are ~818 MB together and a release is visible the moment it is not a draft.
`electron-builder` on its own would create the release *before* uploading —
`gitHubPublisher.js` sets `draft: this.releaseType === "draft"` at creation — which leaves a live
release holding a partial asset set for the whole upload window. An install that checks in during it
gets a `latest-mac.yml` pointing at a `.zip` that is not there yet.

So the order is: tag → build → upload into a draft → drop blockmaps → verify → `--draft=false`.

- **Blockmaps are dropped on purpose.** electron-builder uploads them; every release through 1.8.1
  shipped without them. A differential download needs the *previous* release's blockmap too, so the
  first one buys nothing, and electron-updater's differential path is the part that has broken
  before. They are removed while the release is still invisible.
- **Assets are verified against the feed the build just wrote**, not against a hardcoded list: every
  file `latest-mac.yml` names must be `state=uploaded` at exactly the size it claims. A truncated
  upload still lists as an asset, so size is the check that catches it.
- **If verification fails the release stays a draft** — nobody can see it — and the script prints the
  two commands to finish by hand. `HTTP 500: Error saving asset` on the big files is transient and
  sometimes repeats on the same file; retry rather than assume the artifact is bad.

One check is advisory and never blocks: the embedded update-feed token is a classic PAT, which is a
**known and accepted** risk pending the product team taking this codebase for a PEP. It is surfaced
at every release so it stays known. Don't "fix" it without reading why v1.7.4 was reverted — the
token genuinely has to ship inside the build, because a `.app` launched from Finder inherits no
shell environment and `process.env.GH_TOKEN` is empty in the only case that matters.

## Not yet automated

- **Branch protection.** Unavailable — private repo on the free plan. The gates above live in
  `release.mjs`, not in GitHub, so they hold only for releases cut through `npm run release*`.
- **CI.** `.github/workflows/qa-agent.yml` exists but is untracked and has never run. Its
  `workflow_run: workflows: ["*"]` trigger combined with `push: main` is a self-trigger loop that
  needs fixing before it is committed.
- **Headless `verify`.** Would turn staging into a real automated gate. Needs the platform sidecar
  and Postgres to come up in CI.
