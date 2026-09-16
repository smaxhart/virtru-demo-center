/**
 * Federal Civilian — CUI, statutory need-to-know, and no clearances at all.
 *
 * This mode exists to break the assumption the DoW scenario plants: that access control
 * means classification. Nothing here is classified. Every restriction comes from a statute
 * (IRC §6103, the Privacy Act, FAR procurement integrity) attached to a CUI category, and
 * the deciding attribute is which authority you hold — not how senior you are.
 */

import { cui, agency, role } from './vocab.js'

const personas = [
  {
    id: 'fed-dana',
    name: 'Dana Okafor',
    title: 'Revenue Agent, IRS',
    icon: 'finance',
    color: '#0ea5e9',
    note: 'Holds cui:taxinfo and agency:irs. Return information is a §6103 matter, so nobody outside that pair reaches it regardless of grade.',
  },
  {
    id: 'fed-luis',
    name: 'Luis Ferrer',
    title: 'Claims Specialist, SSA',
    icon: 'claims',
    color: '#8b5cf6',
    note: 'Privacy Act system-of-records access for SSA. Opens the benefits file including PII — and nothing at IRS.',
  },
  {
    id: 'fed-grace',
    name: 'Grace Nakamura',
    title: 'Contracting Officer, GSA',
    icon: 'contract',
    color: '#f59e0b',
    note: 'The only persona cleared for pre-decisional source selection material. Procurement integrity is its own compartment.',
  },
  {
    id: 'fed-omar',
    name: 'Omar Haddad',
    title: 'Special Agent, OIG',
    icon: 'investigator',
    color: '#ef4444',
    note: 'Investigative access at the OIG. Broad authority in his own lane, and still no basis for taxpayer or benefits records.',
  },
  {
    id: 'fed-tess',
    name: 'Tess Reilly',
    title: 'Program Analyst, HHS',
    icon: 'analyst',
    color: '#10b981',
    note: 'A badged federal employee holding no CUI category. Gets the public package and the de-identified summary — the honest answer for most staff.',
  },
  {
    id: 'fed-priya',
    name: 'Priya Sharma',
    title: 'FOIA Requester (public)',
    icon: 'public',
    color: '#6b7280',
    note: 'Outside the agency entirely. Reaches exactly the record that was cleared for release, which is the point of publishing one.',
  },
]

/**
 * The assistants. Grants live in `electron/identities.js`; this is the display half.
 *
 * There is deliberately no agent here that opens tax, privacy, procurement and OIG material at
 * once. CUI categories do not nest, and an agent that held all four would be a category error
 * dressed up as convenience.
 */
const agents = [
  {
    id: 'fed-agent-public',
    name: 'Public Records Assistant',
    title: 'No entitlements',
    icon: 'agent',
    color: '#6b7280',
    note: 'Holds nothing and still reaches the FOIA package, because that record carries an empty policy. Authentication is not authorization for machines either.',
  },
  {
    id: 'fed-agent-program',
    name: 'Program Analysis Agent',
    title: 'role:analyst',
    icon: 'agent',
    color: '#0ea5e9',
    note: 'A role and no CUI category, so it opens the de-identified summary and never the identified record. This is the shape most analytics agents should have and almost never do.',
  },
  {
    id: 'fed-agent-caseworker',
    name: 'SSA Caseworker Agent',
    title: 'CUI privacy · agency:ssa',
    icon: 'agent',
    color: '#8b5cf6',
    note: 'The widest agent in this scenario still holds exactly one category. Pair it with Dana from IRS: she is entitled to the taxpayer file and this agent is not, so it stays shut.',
  },
]

const documents = [
  {
    id: 'foia',
    label: 'FOIA Release Package',
    classification: 'PUBLIC RELEASE',
    keywords: ['foia', 'freedom of information', 'public release', 'released records', 'disclosure log', 'press'],
    // No attributes at all. A TDF with an empty policy rewraps for any authenticated
    // caller — worth demonstrating, because a system that only ever denies teaches nothing.
    policy: [],
    policyNote: 'No attributes in the policy. Any authenticated caller can open it, including the FOIA requester — encryption without restriction is still encryption.',
    text: `
FOIA RELEASE PACKAGE — CLEARED FOR PUBLIC RELEASE
Request FOIA-2026-00318 · Determination: partial grant

Records released (3):
  1. Program Office organizational chart, current as of this quarter.
  2. Summary obligations report, FY26 Q1–Q3: $41.2M obligated against $52.0M appropriated.
  3. Contract award notice, GS-00F-2291A — award value $8.4M, base year plus four options.
Withheld in part: 14 pages under Exemption 4 (confidential commercial information) and
  9 pages under Exemption 5 (deliberative process). Withholding rationale attached.
Appeal rights: 90 days from the date of this determination, to the agency FOIA Appeals Officer.
Note: released records carry no further distribution restriction.
    `.trim(),
  },
  {
    id: 'taxpayer',
    label: 'Taxpayer Account File',
    classification: 'CUI // TAX // §6103',
    keywords: ['taxpayer', 'tax return', 'return information', '6103', 'irs', 'audit examination', 'tax account'],
    policy: [cui('taxinfo'), agency('irs')],
    policyNote: 'CUI category taxinfo AND agency IRS. §6103 makes return information a criminal-liability compartment — the OIG agent is refused, and so is everyone else.',
    text: `
TAXPAYER ACCOUNT FILE — CUI // TAX // §6103
TIN (masked): ***-**-8842 · Examination cycle: TY2024, opened this quarter

Taxpayer: NORTHLINE HOLDINGS LLC — pass-through, 3 members
Filed: Form 1065, TY2024. Gross receipts reported $14.7M.
Examination basis: Discriminant Function scoring flagged Schedule K-1 allocations inconsistent
  with member capital accounts across three prior years.
Findings to date: $2.31M in disallowed deductions proposed. Accuracy-related penalty under
  §6662 under consideration; no fraud referral at this time.
Third-party contacts: 2 issued under §7602(c), taxpayer notified.
Disclosure: Return information under 26 U.S.C. §6103. Unauthorized disclosure or inspection is
  a felony under §7213 and creates civil liability under §7431.
    `.trim(),
  },
  {
    id: 'benefits',
    label: 'Benefits Determination',
    classification: 'CUI // PRIVACY',
    keywords: ['benefits', 'disability', 'ssa', 'social security', 'determination', 'claim', 'entitlement'],
    policy: [cui('privacy'), agency('ssa')],
    policyNote: 'CUI category privacy AND agency SSA. A Privacy Act system of records is scoped to the agency that maintains it, not to the federal government at large.',
    text: `
BENEFITS DETERMINATION — CUI // PRIVACY ACT SYSTEM OF RECORDS
Claim: DIB-2026-77104 · Title II disability insurance benefits

Claimant: Ruth Alvarado, DOB 1971-03-14, SSN ***-**-2290
Alleged onset date: 14 months prior to filing. Date last insured: satisfied.
Sequential evaluation: Steps 1–3 not met at listing level. Residual functional capacity assessed
  as light work with postural limitations.
Step 4: Unable to perform past relevant work (warehouse supervisor, medium exertion).
Step 5: Vocational expert testimony identifies 2 occupations in significant numbers.
Determination: DENIED at Step 5. Notice of reconsideration rights issued.
Medical evidence of record: 214 pages, 4 treating sources, 1 consultative examination.
Routine uses: Per SORN 60-0089. Disclosure outside a published routine use requires written consent.
    `.trim(),
  },
  {
    id: 'source-selection',
    label: 'Source Selection Recommendation',
    classification: 'CUI // PROCUREMENT // PRE-DECISIONAL',
    keywords: ['source selection', 'procurement', 'award recommendation', 'bid', 'proposal', 'evaluation', 'solicitation', 'contract award'],
    policy: [cui('procurement'), role('contracting')],
    policyNote: 'CUI procurement AND the contracting role. Deliberately excludes the program staff who wrote the requirement — pre-decisional procurement material is walled off inside the agency.',
    text: `
SOURCE SELECTION RECOMMENDATION — CUI // PROCUREMENT // PRE-DECISIONAL
Solicitation 47QFCA26R0112 · Enterprise data protection services

Offerors evaluated: 4 (two small business set-aside eligible).
Technical evaluation:
  Offeror A — Outstanding. Demonstrated ABAC enforcement at the data layer; no compliance gaps.
  Offeror B — Acceptable. Relies on gateway-only enforcement; residual insider-access risk noted.
  Offeror C — Marginal. Two past-performance references did not respond.
  Offeror D — Unacceptable. Failed to meet mandatory FIPS 140-3 requirement.
Price: A $9.86M / B $7.42M / C $7.10M / D $6.95M over base plus four.
Best-value tradeoff: Technical superiority of A justifies a 33% price premium over B given the
  insider-risk exposure in B's architecture.
Recommendation: Award to Offeror A without discussions.
Handling: Pre-decisional. Source selection information under FAR 2.101 and 41 U.S.C. §2102.
  Disclosure to an offeror before award taints the competition.
    `.trim(),
  },
  {
    id: 'oig',
    label: 'OIG Investigation Memo',
    classification: 'CUI // LAW ENFORCEMENT',
    keywords: ['oig', 'inspector general', 'investigation memo', 'misconduct', 'whistleblower', 'referral', 'fraud'],
    policy: [cui('lawenforcement'), agency('oig')],
    policyNote: 'CUI law enforcement AND agency OIG. Investigative files are closed to the agency being investigated — which is the whole reason an OIG is independent.',
    text: `
OIG INVESTIGATION MEMO — CUI // LAW ENFORCEMENT SENSITIVE
Case OI-2026-0431 · Allegation of procurement irregularity

Predication: Hotline complaint alleging that a program official disclosed competitor pricing to
  an incumbent contractor during an active source selection.
Investigative steps completed: 11 interviews, 3 preservation notices, review of 42,000 email items.
Findings to date: Metadata confirms a proposal volume was accessed by an account outside the
  evaluation team on two occasions. Access predates the announced award by 19 days.
Subject: Program official, GS-14. Not yet interviewed; counsel retained.
Referral posture: Prospective referral to DOJ under 18 U.S.C. §1905. Coordination with the agency
  suspension and debarment official deferred pending interview.
Whistleblower: Complainant identity protected under 5 U.S.C. §2302(b)(8). Do not disclose.
    `.trim(),
  },
  {
    // The tier boundary here is statutory rather than hierarchical: the de-identified
    // version is releasable to any analyst, the identified version only under the SORN.
    id: 'case-file',
    label: 'Beneficiary Case File',
    classification: 'CUI // PRIVACY',
    keywords: ['case file', 'beneficiary', 'caseworker', 'pii', 'personally identifiable', 'ruth alvarado', 'overpayment'],
    tiers: [
      {
        id: 'identified',
        label: 'Identified Record (PII)',
        classification: 'CUI // PRIVACY // SORN 60-0089',
        policy: [cui('privacy'), agency('ssa')],
        policyNote: 'The named record. Only the SSA caseworker holds both attributes.',
        text: `
BENEFICIARY CASE FILE — CUI // PRIVACY // IDENTIFIED
Case DIB-2026-77104 · Overpayment recovery

Beneficiary: Ruth Alvarado · SSN ***-**-2290 · DOB 1971-03-14
Address of record: 4118 Kenwood Ave, Baltimore MD 21206 · Phone (410) 555-0173
Overpayment: $11,482.60 across 14 months, cause — unreported return to substantial gainful activity.
Recovery posture: Waiver request pending under §204(b). Financial statement received; monthly
  disposable income calculated at $118.
Caseworker notes: Beneficiary reports the reporting requirement was explained by phone only.
  No written acknowledgement in file — this materially supports the waiver request.
Representative payee: None. Direct deposit on file, account verified.
Handling: Contains PII. Disclosure only per SORN 60-0089 routine uses or with written consent.
        `.trim(),
      },
      {
        id: 'deidentified',
        label: 'De-identified Summary',
        classification: 'CUI // BASIC',
        policy: [role('analyst'), role('auditor'), role('caseworker'), role('contracting'), role('investigator')],
        policyNote: 'Any of five federal roles (ANY_OF). Same case, no identity — which is exactly what program analysis and audit actually need. The FOIA requester holds no role and is refused.',
        text: `
BENEFICIARY CASE SUMMARY — CUI // BASIC // DE-IDENTIFIED
Case reference: DIB-2026-77104 (identity withheld)

Benefit type: Title II disability insurance.
Overpayment amount: $11,482.60 · Duration: 14 months · Cause code: unreported SGA.
Waiver request: Pending under §204(b). Documented financial hardship on file.
Contributing factor: No written acknowledgement of the reporting requirement in the case record.
Program observation: This is the 9th case this quarter where the reporting requirement was
  conveyed by phone without written follow-up. Recommend a notice-process review.
Identity, address, and account details: withheld — available only under the applicable SORN.
        `.trim(),
      },
    ],
  },
]

const prompts = [
  { label: 'FOIA release',        text: 'What was released in the FOIA package and what was withheld?' },
  { label: 'Taxpayer exam',       text: 'What did the IRS examination find on the taxpayer account file?' },
  { label: 'Benefits denial',     text: 'Why was the disability benefits claim denied?' },
  { label: 'Award recommendation',text: 'Which offeror does the source selection recommendation pick, and why?' },
  { label: 'OIG case',            text: 'What are the findings so far in the OIG investigation memo?' },
  { label: 'Beneficiary case',    text: 'Tell me about the beneficiary case file and the overpayment.' },
  { label: 'What is CUI?',        text: 'What is CUI and how is it different from classified information?' },
]

export default {
  id: 'civilian',
  name: 'Federal Civilian',
  short: 'Fed Civ',
  tagline: 'CUI categories, statutory need-to-know, no clearances',
  icon: 'capitol',
  accent: '#0ea5e9',
  premise: `Four agencies handling tax, benefits, procurement, and investigative records. Nothing here is classified — every restriction traces to a statute, and the deciding attribute is which authority you hold rather than how senior you are.`,
  teaches: [
    {
      title: 'Unclassified is not unrestricted',
      detail: 'Most federal data has no classification and strict handling rules. §6103 return information carries criminal liability for disclosure; a clearance would not help you read it, because clearances are not what it asks about.',
    },
    {
      title: 'The compartment is the statute',
      detail: 'Each CUI category pairs with the agency that holds the authority. The OIG agent has broad investigative powers and still cannot open a tax or benefits record — his authority runs in a different lane.',
    },
    {
      title: 'One document is genuinely public',
      detail: 'The FOIA package carries an empty policy, so every caller opens it including the outside requester. A system that only ever denies proves nothing; this one shows the boundary sitting where the law puts it.',
    },
    {
      title: 'The assistant is entitled too',
      detail: 'Retrieval asks the KAS twice — once as you, once as the agent acting for you — and releases the document only if both are granted. No agent here holds more than one CUI category, so the SSA caseworker is refused her own benefits record the moment she works through the program analysis agent.',
    },
  ],
  vocabulary: [
    { name: 'cui',    rule: 'ANY_OF', detail: 'privacy, taxinfo, procurement, lawenforcement — the CUI category per 32 CFR 2002.' },
    { name: 'agency', rule: 'ANY_OF', detail: 'irs, ssa, gsa, hhs, oig — which authority the caller acts under.' },
    { name: 'role',   rule: 'ANY_OF', detail: 'caseworker, auditor, analyst, contracting, investigator — the function, used for de-identified material.' },
  ],
  defaultPersonaId: 'fed-luis',
  // Luis is the SSA caseworker, so the matching agent keeps the default pairing coherent and
  // leaves the cross-category refusals to be found by switching either side.
  defaultAgentId: 'fed-agent-caseworker',
  personas,
  agents,
  documents,
  prompts,
}
