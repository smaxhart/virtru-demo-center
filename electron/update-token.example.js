/**
 * Template for `electron/update-token.js`, which is untracked.
 *
 * Copy this file to `update-token.js` and paste in a token. It ships inside the built .app
 * (electron-builder packs from the filesystem, so .gitignore does not exclude it) but never
 * enters git history.
 *
 *   cp electron/update-token.example.js electron/update-token.js
 *
 * The token must be a **fine-grained** PAT:
 *
 *   github.com → Settings → Developer settings → Personal access tokens → Fine-grained tokens
 *     Repository access : Only select repositories → smaxhart/virtru-demo-center
 *     Permissions       : Repository permissions → Contents → Read-only
 *                         (Contents is what covers the Releases API and asset downloads.
 *                          Metadata: Read-only is added automatically and is required.)
 *     Expiration        : as long as you are willing to babysit — see below
 *
 * Read-only and single-repo is the entire safety argument. A copy of this app can read the
 * repository it came from and nothing else. A classic `ghp_` token instead grants read-write
 * to every private repo on the account, so `setupUpdater()` refuses those outright.
 *
 * When it expires, update checks start failing with HTTP 401 and the app goes quiet — it will
 * not tell the user anything is wrong beyond a line in the log. Put the expiry date in a
 * calendar reminder, and rotate by editing this file and cutting a new release.
 */

module.exports = 'github_pat_REPLACE_ME'
