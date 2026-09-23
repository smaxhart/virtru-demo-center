/**
 * Compile-checks every page in src/pages/, including the ones no route imports.
 *
 *   node scripts/verify-pages.mjs
 *
 * Why this exists: `vite build` only compiles what the route graph in src/App.jsx reaches. Rolldown
 * tree-shakes the rest, so a page that lost its route is never parsed, never resolved, and never
 * type-adjacent-checked by anything. It can be broken for weeks and the build stays green.
 *
 * That is not hypothetical. Every page under src/pages/archived/ imports shared modules —
 * data/sectors.js, data/policyMatch.js, api/platform.js — and an edit to any of those can delete a
 * named export an archived page still asks for. The build will not notice. The failure only shows up
 * if someone reroutes the page, at which point the breakage is months old and its cause is buried.
 *
 * A second trap, specific to archiving: moving a page from src/pages/ into src/pages/archived/ puts
 * it one directory deeper, so every `../shared` import in it now resolves one level short. The four
 * pages archived before this script existed all carried that bug — a pure `git mv` preserves the
 * file byte-for-byte, which is exactly what you do not want for relative paths. This script catches
 * that on the next run instead of on the next reroute.
 *
 * What it proves, per page:
 *   1. The file parses as JSX under the repo's real vite config (same plugins, same transform).
 *   2. Every relative import resolves to a file that exists, at the right depth.
 *   3. Every named import it asks for is actually exported by the module it names.
 *
 * Bare specifiers (react, react-dom, react-router-dom) are left external: this checks our source
 * against our source, not node_modules, and keeping them external makes each build fast enough to
 * run one page at a time. One build per page is deliberate — a multi-entry build aborts on the first
 * error and would only ever name one victim.
 *
 * This does not run the pages, so it says nothing about whether an archived page still *works*.
 * It only proves the thing that silently rots: that it still compiles against today's shared data.
 */

import { build } from 'vite'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pagesDir = path.join(root, 'src', 'pages')

/** Every .jsx under src/pages, recursively, so archived/ and any future subfolder are included. */
function collectPages(dir) {
  const out = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...collectPages(full))
    else if (entry.name.endsWith('.jsx')) out.push(full)
  }
  return out
}

async function checkPage(file) {
  try {
    await build({
      root,
      logLevel: 'silent',
      build: {
        write: false,          // nothing is emitted; dist/ is left exactly as the real build left it
        emptyOutDir: false,    // belt and braces — never let a verify run clear a built dist/
        rollupOptions: {
          input: file,
          // Anything that is not a relative or absolute path is a package. Not our problem here.
          external: (id) => !id.startsWith('.') && !path.isAbsolute(id),
        },
      },
    })
    return null
  } catch (err) {
    return err
  }
}

const pages = collectPages(pagesDir).sort()
if (pages.length === 0) {
  console.error('verify:pages — found no .jsx under src/pages, which cannot be right')
  process.exit(1)
}

console.log(`verify:pages — compile-checking ${pages.length} pages under src/pages/\n`)

const failures = []
for (const file of pages) {
  const rel = path.relative(root, file)
  const err = await checkPage(file)
  if (err) {
    failures.push({ rel, err })
    console.log(`  ✗ ${rel}`)
  } else {
    console.log(`  ✓ ${rel}`)
  }
}

if (failures.length > 0) {
  console.log(`\n${failures.length} of ${pages.length} pages failed to compile:\n`)
  for (const { rel, err } of failures) {
    console.log(`── ${rel} ─────────────────────────────`)
    // Rollup resolution errors carry the useful detail on .message; the stack is noise here.
    console.log(`${err.message?.trim() ?? err}\n`)
  }
  console.log('An unrouted page failing here means a shared module changed under it. Fix the page or,')
  console.log('if it is genuinely dead, delete it — leaving it broken in archived/ helps nobody.')
  process.exit(1)
}

console.log(`\nAll ${pages.length} pages compile.`)
