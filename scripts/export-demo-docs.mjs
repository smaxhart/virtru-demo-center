#!/usr/bin/env node
/**
 * Write the federal sample documents to disk as real files.
 *
 *   node scripts/export-demo-docs.mjs [outDir]
 *
 * Default outDir is ~/Desktop/virtru-demo-docs.
 *
 * Why this exists: the samples are compiled into the app, so the only way to demo the *upload* path
 * is with a file that actually exists. These are the same bytes, written out, which means each one
 * carries its own banner line on the first non-blank line — drag one back into TDF Explorer or AI
 * Protection and the marking detector derives the policy in front of the room.
 *
 * It regenerates from `src/data/federalDocs.js` rather than keeping a second copy, so the files on
 * disk cannot drift from the samples in the app. Re-run it after editing a document.
 */

import { writeFile, mkdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { FEDERAL_DOCS, docBytes, formatSize } from '../src/data/federalDocs.js'
import { groupPolicy, groupLabel } from '../src/data/policyMatch.js'

const outDir = process.argv[2]
  ? resolve(process.argv[2])
  : join(homedir(), 'Desktop', 'virtru-demo-docs')

await mkdir(outDir, { recursive: true })

const README = `Virtru Demo Center — federal sample documents
${'='.repeat(45)}

Generated from src/data/federalDocs.js by scripts/export-demo-docs.mjs.
Edit the documents there and re-run the script; do not edit these files.

Every document's first non-blank line is its classification banner, which is
what src/ai/markingParser.js reads to derive a policy. Drag one into TDF
Explorer's "Upload your own file" and the policy is proposed from the document
itself.

A policy is read per attribute definition, not per value: separate definitions
AND together, and a releasability roster is ANY_OF, so one nation off the list is
enough. That is why the lines below say "any of" rather than listing thirteen
requirements a single person could never all hold.

${FEDERAL_DOCS.map(d => `${d.name}\n    ${d.banner}\n${groupPolicy(d.policy).map(g => `    requires ${groupLabel(g)}`).join('\n')}\n    ${d.summary}`).join('\n\n')}

One deliberate exception: CYBER_INCIDENT_G6-2291.txt derives clearance:secret
from its banner but the in-app sample also carries mission:cyber, taken from the
LIMDIS handling line. Need-to-know is not written in a banner, and no parser can
infer it.
`

await Promise.all([
  ...FEDERAL_DOCS.map(d => writeFile(join(outDir, d.name), d.body, 'utf8')),
  writeFile(join(outDir, 'README.txt'), README, 'utf8'),
])

console.log(`Wrote ${FEDERAL_DOCS.length} documents + README.txt to ${outDir}\n`)
for (const d of FEDERAL_DOCS) {
  console.log(`  ${d.name.padEnd(32)} ${formatSize(docBytes(d)).padStart(9)}   ${d.banner}`)
}
