/**
 * Corpus machinery, with no corpus in it.
 *
 * The documents themselves live in `src/modes/*.js` — one scenario per file, each carrying its
 * own personas and its own set of documents. Everything here is shape-handling: flattening
 * tiered documents into encryptable units and prettifying FQNs for display.
 *
 * Each document's `policy` is a list of attribute FQNs written verbatim into the TDF manifest
 * (`autoconfigure: false`). Nothing in this app simulates an access rule: at query time the
 * app asks the KAS to rewrap for the active persona, and the platform decides.
 *
 * How the rules compose, which is what makes the mode corpora interesting:
 *   - Separate attribute definitions are AND-ed. clearance + mission means both.
 *   - Values within one definition follow that definition's rule. `needtoknow` is ANY_OF,
 *     so listing two compartments means "holds either".
 *   - `clearance` is HIERARCHY, so tagging a document SECRET admits TS-SCI holders.
 *   - An empty policy is legal and rewraps for every authenticated caller — that is how the
 *     public documents in each mode work.
 * See `src/modes/vocab.js` for the vocabulary and the 20-value ceiling.
 */

import { bannerFor } from './banner.js'

/**
 * The marking to show for one unit: its own if it has one, otherwise derived from its policy.
 *
 * This single line is why the banner derivation reaches everything. Every surface that displays a
 * marking — the corpus list, the decision trace, the audit log, the system prompt handed to the
 * model, the filename of a downloaded TDF — reads `unit.classification` and goes through here, so
 * a mode that omits `classification` gets a computed banner in all of them at once.
 *
 * A document's own string still wins when it has one, which keeps the classified modes exactly as
 * they were and leaves the statutory references in the Federal Civilian banners (`§6103`,
 * `SORN 60-0089`, `PRE-DECISIONAL`) intact — a derived banner has no grammar for those, and
 * deriving over the top of them would trade real information for consistency.
 */
function marking(src) {
  return src.classification ?? bannerFor(src.policy) ?? null
}

/** True when the marking shown was computed from the policy rather than authored. */
const isDerived = (src) => !src.classification && Boolean(bannerFor(src.policy))

/**
 * Flat list of every encryptable unit in a document set: one per document, or one per tier.
 * @param {Array} documents a mode's `documents` array
 */
export function corpusUnits(documents) {
  const units = []
  for (const doc of documents) {
    if (doc.tiers) {
      for (const tier of doc.tiers) {
        units.push({
          key: `${doc.id}:${tier.id}`,
          docId: doc.id,
          tierId: tier.id,
          label: `${doc.label} — ${tier.label}`,
          classification: marking(tier),
          derivedMarking: isDerived(tier),
          policy: tier.policy,
          policyNote: tier.policyNote,
          text: tier.text,
        })
      }
    } else {
      units.push({
        key: doc.id,
        docId: doc.id,
        tierId: null,
        label: doc.label,
        classification: marking(doc),
        derivedMarking: isDerived(doc),
        policy: doc.policy,
        policyNote: doc.policyNote,
        text: doc.text,
      })
    }
  }
  return units
}

/** Shorten an FQN for display: .../attr/clearance/value/ts-sci → clearance:ts-sci */
export function shortFqn(fqn) {
  const m = fqn.match(/\/attr\/([^/]+)\/value\/(.+)$/)
  return m ? `${m[1]}:${m[2]}` : fqn
}

/** TDF sizes, for the places that show what a document actually weighs on disk. */
export function fmtBytes(n) {
  return n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`
}
