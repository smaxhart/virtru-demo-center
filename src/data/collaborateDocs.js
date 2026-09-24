/**
 * The Collaborate file catalogue's actual contents.
 *
 * Collaborate's preview modal used to render a table of grey bar widths — `PREVIEW_CONTENT` in
 * `CollaboratePage.jsx`, eight numbers per extension — so every PDF, DOCX and TXT opened to the
 * same page of skeleton lines and the only file that appeared to hold anything was the one
 * spreadsheet, whose rows were hardcoded in the component. The page's whole argument is that KAS
 * decided whether you may read *this document*, which does not land when the thing behind the
 * decision is visibly a placeholder.
 *
 * Same problem `federalDocs.js` fixed for TDF Explorer, and mostly the same rules apply. Two
 * differences worth knowing before editing:
 *
 *   1. **No banner line here.** `federalDocs` bodies lead with their marking because those files
 *      get exported to disk and have to re-derive their own policy through
 *      `src/ai/markingParser.js`. Nothing in Collaborate exports plaintext — `downloadTdf` writes
 *      an encrypted-payload stub — and the modal already prints the banner above and below the
 *      page from `file.msLabel` + `file.relTo`. A banner in the body would be the third copy.
 *      Portion markings inside the text are decorative, as they are there.
 *   2. **These carry no policy.** The authoritative `visible` / `required` arrays stay in
 *      `BASE_FILES`, keyed by the same `id`. This module is content only, so adding a document
 *      cannot change an access decision and no attribute value is introduced by anything below —
 *      which is what keeps it clear of the vocabulary rule and the 20-value ceiling.
 *
 * Blocks rather than a text blob, because a rendered page needs headings, tables and lists and
 * inferring them from a string means guessing. The renderer in `CollaboratePage.jsx` handles
 * exactly these keys:
 *
 *   { h }      section heading
 *   { p }      paragraph
 *   { ul }     bullet list
 *   { kv }     [label, value] pairs — classification authority blocks, distribution, contract data
 *   { table }  { head, rows, accent?, status? } — `status` colours any cell matching one of its keys
 *   { pre }    monospace, preserved whitespace
 *
 * The content is notional. Unit designations, cryptonyms, case numbers and contract numbers are
 * invented and deliberately do not resemble real ones.
 */

const STATUS_COLORS = { Critical: '#dc2626', Warning: '#d97706', Nominal: '#16a34a' }

export const COLLABORATE_DOCS = [
  // ── briefing ── TOP SECRET // REL TO USA ── clearance:ts-sci ────────────────
  {
    id: 'briefing',
    title: 'Q3 FY26 CONSOLIDATED THREAT BRIEFING',
    subtitle: 'J2, Combined Joint Task Force 71 · Briefing 26-Q3-014 · 221400Z SEP 26',
    blocks: [
      { h: '1. (U) SCOPE' },
      { p: '(U) This briefing consolidates cyber, influence and collection-threat reporting for the period 01 JUL – 30 SEP 26 across the CJTF-71 area of responsibility. It supersedes briefing 26-Q2-011 in full. Judgements carry the confidence levels stated; where reporting is single-source that is said so in the line itself rather than left to the reader.' },

      { h: '2. (TS) KEY JUDGEMENTS' },
      { ul: [
        '(TS) SABLE CHORUS has shifted from opportunistic credential harvesting to pre-positioning in logistics and sustainment networks. We judge with high confidence that access is being held for later effect rather than exploited for collection now — four of the six confirmed footholds show no exfiltration at all after initial reconnaissance.',
        '(TS) The group\'s tooling is now predominantly built on utilities already present on the target host. This is a deliberate detection-avoidance choice and it has worked: mean time from initial access to discovery rose from 9 days in Q2 to 31 days this quarter.',
        '(TS) We judge with moderate confidence that a second actor is operating inside at least two of the same networks. Overlapping access with divergent tradecraft is the basis; we cannot yet say whether the two are coordinated or merely both present.',
        '(S) Influence activity against host-nation audiences remains steady in volume and has narrowed in theme, concentrating on the status of the basing agreement. Volume is not the useful indicator here — narrowing is.',
      ] },

      { h: '3. (TS) ADVERSARY ACTIVITY BY VECTOR' },
      { p: '(TS) Counts below are confirmed incidents only. Attempts blocked at the perimeter are excluded; including them triples every figure and tells you nothing about what got through.' },
      { table: {
        head: ['Vector', 'Confirmed', 'Trend vs Q2', 'Assessed intent'],
        rows: [
          ['Credential reuse against remote access', '14', 'Down from 22', 'Access, held'],
          ['Third-party maintenance channel', '6', 'Up from 1', 'Access, held'],
          ['Removable media at forward sites', '3', 'Unchanged', 'Collection'],
          ['Targeted social engineering of staff', '11', 'Up from 7', 'Access'],
          ['Public-facing application exploitation', '2', 'Down from 9', 'Collection'],
        ],
      } },
      { p: '(TS) The shift out of application exploitation and into the maintenance channel is the finding of the quarter. Contractor-held credentials sit outside the controls we manage and, in five of the six cases, outside any logging we can read. Recommendation 5.2 addresses this.' },

      { h: '4. (S) INDICATIONS AND WARNING' },
      { ul: [
        '(S) Any authentication to a sustainment system from a maintenance account outside a scheduled window. Three of the six footholds would have been caught in the first 48 hours by this alone.',
        '(S) Scheduled-task creation on logistics hosts referencing paths under user-writable directories.',
        '(S) Host-nation media coverage of the basing agreement appearing in translation before the local-language original. Seen twice; both times it preceded a surge by four to six days.',
      ] },

      { h: '5. (U) RECOMMENDATIONS' },
      { ul: [
        '5.1 (U) Extend continuous monitoring to the sustainment enclave. Currently monitored on a 30-day sampling basis, which against a 31-day mean dwell time is functionally no monitoring at all.',
        '5.2 (U) Require contract-held maintenance credentials to be brokered through the government-managed access path, with logging retained by the government. Blocks the vector that grew sixfold this quarter.',
        '5.3 (U) Re-scope the Q4 collection plan against the gaps at paragraph 4. The two we cannot currently see into are both in partner-held infrastructure.',
      ] },

      { kv: [
        ['Classified by', 'Maj. S. Williams, J2, CJTF-71'],
        ['Reason', '1.4(c), 1.4(g)'],
        ['Derived from', 'Multiple sources'],
        ['Declassify on', '20510930'],
      ] },
    ],
  },

  // ── sigint ── TOP SECRET // REL TO FVEY ── clearance:ts-sci + mission:intel ─
  {
    id: 'sigint',
    title: 'SIGINT COLLECTION SUMMARY — WEEK 38',
    subtitle: 'J2 SIGINT Cell, CJTF-71 · Serial 26-38-SIG · 220600Z SEP 26',
    blocks: [
      { h: '1. (U) PURPOSE' },
      { p: '(U) Weekly account of collection against the standing requirements, what it produced, and where it did not. Written for the requirements owners, so it reports yield against tasking rather than volume collected — a platform can fly a full week, return a great deal of traffic, and answer nothing that was asked.' },

      { h: '2. (TS) COLLECTION POSTURE' },
      { table: {
        head: ['Tasking', 'Platform', 'On-station hrs', 'Reportable items', 'Against requirement'],
        rows: [
          ['STANDING-04', 'Airborne, rotational', '96', '31', 'Satisfied'],
          ['STANDING-07', 'Ground, fixed', '168', '12', 'Partially satisfied'],
          ['PRIORITY-11', 'Airborne, dedicated', '42', '4', 'Not satisfied'],
          ['PRIORITY-12', 'Partner-provided', '—', '9', 'Satisfied'],
          ['AD-HOC-26-38-2', 'Ground, mobile', '18', '0', 'Not satisfied'],
        ],
      } },
      { p: '(TS) PRIORITY-11 is the third consecutive week not satisfied. The requirement assumes a communications path the target stopped using in August; it needs rewriting rather than more hours flown against it. Request the requirements board take it up at the next sitting.' },

      { h: '3. (TS) KEY REPORTING' },
      { ul: [
        '(TS//REL TO FVEY) Serial 26-38-SIG-009 confirms the relocation assessed in week 36 at moderate confidence. Confidence is now high. Two independent collection paths, seven days apart, consistent in every particular that both could see.',
        '(TS//REL TO FVEY) Serial 26-38-SIG-014 identifies a previously unreported node in the logistics coordination network. Partner reporting under PRIORITY-12 corroborated it within 36 hours, which is the fastest turn we have had on this target set.',
        '(TS//REL TO FVEY) Serial 26-38-SIG-022 is single-source and reported as such. It suggests a change in the movement pattern under STANDING-04. Do not act on it alone; corroboration tasking is submitted.',
      ] },

      { h: '4. (TS) GAPS' },
      { ul: [
        '(TS) No coverage of the maritime segment since 14 SEP. The gap is a platform allocation decision made outside this cell and is noted here so it is not later read as an absence of activity.',
        '(TS) Partner-held collection against the southern approaches cannot be re-tasked by us. Three of the five outstanding questions sit behind it.',
      ] },

      { h: '5. (U) NEXT PERIOD' },
      { p: '(U) Priority effort remains STANDING-04 and STANDING-07. AD-HOC-26-38-2 closes unless the originator revalidates it by 250001Z. PRIORITY-11 continues at reduced allocation pending the requirement rewrite at paragraph 2.' },

      { kv: [
        ['Handling', 'Releasable to FVEY partners'],
        ['Classified by', 'Maj. S. Williams, J2, CJTF-71'],
        ['Derived from', 'Multiple sources'],
        ['Declassify on', '20510922'],
      ] },
    ],
  },

  // ── nda ── SECRET // REL TO USA ── clearance:secret + mission:legal ─────────
  {
    id: 'nda',
    title: 'REPORT OF PRELIMINARY HEARING — ARTICLE 32, UCMJ',
    subtitle: 'Office of the Staff Judge Advocate, CJTF-71 · Case 26-0147 · 101545Z JUL 26',
    blocks: [
      { h: '1. (U) APPOINTMENT AND CONDUCT' },
      { p: '(U) The undersigned was appointed preliminary hearing officer by order dated 12 JUN 26 to conduct a hearing under Article 32, UCMJ, and R.C.M. 405. The hearing convened 08 JUL 26 and closed 09 JUL 26. The accused was present throughout and represented by detailed defence counsel. Government counsel and a court reporter were present.' },
      { p: '(S) The hearing was conducted in a closed session for the portions addressing exhibits 4 through 9, which are derived from classified reporting. That classification is the reason this report carries a SECRET marking; no charge in this case is itself classified.' },

      { h: '2. (U) CHARGES CONSIDERED' },
      { table: {
        head: ['Charge', 'Article', 'Specification', 'Finding'],
        rows: [
          ['I', '92', 'Failure to obey a lawful general order — handling of classified material', 'Reasonable grounds'],
          ['II', '107', 'False official statement', 'Reasonable grounds'],
          ['III', '134', 'Conduct prejudicial to good order and discipline', 'No reasonable grounds'],
        ],
      } },

      { h: '3. (U) EVIDENCE CONSIDERED' },
      { ul: [
        '(U) Exhibits 1–3: the charge sheet, the appointing order, and the accused\'s acknowledgement of the unit\'s standing order on removable media.',
        '(S) Exhibits 4–9: audit records from the enclave logging system covering 04–19 MAY 26, produced under a classification review completed 01 JUL 26.',
        '(U) Exhibits 10–12: sworn statements of three witnesses, all of whom testified and were available for cross-examination.',
        '(U) Testimony of the accused, who elected to make an unsworn statement and answered no questions.',
      ] },

      { h: '4. (S) FINDINGS' },
      { p: '(S) As to Charges I and II there are reasonable grounds to believe the accused committed the offences charged. The audit records at exhibits 4–9 place the accused\'s credential on the enclave at each of the six times alleged, and the accused\'s statement of 21 MAY 26 is inconsistent with those records in a manner that is not explicable by error of recollection.' },
      { p: '(U) As to Charge III there are no reasonable grounds. The specification rests entirely on the same conduct charged under Charge I and adds nothing to it. Charging it separately would be unreasonable multiplication.' },
      { p: '(U) No defect in form was found in the charge sheet. The accused is subject to court-martial jurisdiction and the offences charged are not barred by the statute of limitations.' },

      { h: '5. (U) RECOMMENDATIONS' },
      { ul: [
        '5.1 (U) Refer Charges I and II to a general court-martial.',
        '5.2 (U) Dismiss Charge III.',
        '5.3 (U) Any referral order should direct that exhibits 4–9 be handled under the protective order at appendix B. The classification review permits their use at trial in a closed session and not otherwise.',
      ] },

      { pre: 'P. LEE\nCol, JA, U.S. Army\nPreliminary Hearing Officer\n\nEnclosures: Appendices A (verbatim record), B (protective order),\n            C (exhibit list), D (classification review)' },

      { kv: [
        ['Classified by', 'Col. P. Lee, OSJA, CJTF-71'],
        ['Reason', '1.4(c)'],
        ['Derived from', 'Enclave audit reporting, CJTF-71 J6'],
        ['Declassify on', '20360710'],
        ['Distribution', 'Convening authority; trial counsel; defence counsel'],
      ] },
    ],
  },

  // ── audit ── SECRET // REL TO USA ── clearance:secret + mission:cyber ──────
  {
    id: 'audit',
    title: 'NETWORK SECURITY POSTURE — ENCLAVE B',
    subtitle: 'J6 Cybersecurity Division · Audit 26-CYB-031 · 091102Z JUL 26',
    sheet: {
      name: 'Findings',
      table: {
        head: ['Asset', 'Status', 'Priority', 'Assignee', 'Due'],
        accent: '#16a34a',
        status: STATUS_COLORS,
        rows: [
          ['FW-01', 'Critical', 'High', 'Chen, L.', 'Jul 20'],
          ['NET-04', 'Warning', 'High', 'Rivera, J.', 'Jul 22'],
          ['SRV-12', 'Nominal', 'Med', 'Johnson, M.', 'Jul 30'],
          ['VPN-03', 'Critical', 'High', 'Chen, L.', 'Jul 18'],
          ['DB-07', 'Warning', 'Med', 'Rivera, J.', 'Aug 01'],
          ['LOG-02', 'Critical', 'High', 'Johnson, M.', 'Jul 19'],
          ['WKS-118', 'Nominal', 'Low', 'Chen, L.', 'Aug 15'],
        ],
      },
    },
    blocks: [
      { h: 'FINDINGS' },
      { ul: [
        'FW-01 — the perimeter ruleset carries 41 rules with no stated owner and no review date, 6 of which permit inbound traffic to the sustainment segment. Two were added under an expedite waiver in 2024 that was never closed out.',
        'VPN-03 — remote access still accepts a single factor for 12 contract-held accounts. This is the finding that matters most on this sheet: it is the exact path used in three of the six incidents in the Q3 threat briefing.',
        'LOG-02 — enclave audit records are retained 30 days. Mean time to discovery in theatre this quarter was 31 days, so the record of an intrusion now expires, on average, just before anyone looks for it. Retention must exceed dwell time or the logging is decorative.',
        'NET-04 — 9 of 34 switch ports in the forward rack are enabled and unassigned. No evidence of misuse; the exposure is that nothing would have recorded it.',
        'DB-07 — backups run and have never been restore-tested. Untested backups are an assumption, not a control.',
      ] },

      { h: 'METHOD' },
      { p: 'Configuration review of all 34 in-scope assets against the enclave baseline, plus 14 days of log sampling and one announced credential test against remote access. No exploitation was attempted against production systems. Two assets (SRV-09, SRV-11) were unavailable during the window and are excluded rather than assessed as nominal.' },

      { h: 'RETEST' },
      { p: 'The three Critical findings retest on 25 JUL 26. Closure requires evidence, not assertion: a ruleset export for FW-01, an authentication policy screenshot with a test account for VPN-03, and a retention setting plus one successful retrieval of a 45-day-old record for LOG-02.' },

      { kv: [
        ['Assets in scope', '34 (32 assessed, 2 unavailable)'],
        ['Findings', '3 Critical, 2 Warning, 2 Nominal'],
        ['Classified by', 'CW3 M. Johnson, J6, CJTF-71'],
        ['Reason', '1.4(g)'],
        ['Declassify on', '20360709'],
      ] },
    ],
  },

  // ── fvey ── SECRET // REL TO FVEY ── clearance:secret + relto:fvey ─────────
  {
    id: 'fvey',
    title: 'COMBINED INTELLIGENCE EXCHANGE RECORD',
    subtitle: 'Five Eyes partner exchange · Session 26-09-B · 081015Z JUL 26',
    blocks: [
      { h: '1. (U) PURPOSE AND STANDING' },
      { p: '(U) Record of the quarterly combined exchange held 07–08 JUL 26. This document is the agreed record of what was exchanged and under what caveats; it is not an assessment and nothing in it should be cited as one. Each item below remains the property of the originating nation and carries that nation\'s handling instructions.' },

      { h: '2. (U) PARTICIPANTS' },
      { table: {
        head: ['Nation', 'Organisation', 'Representative'],
        rows: [
          ['USA', 'J2, CJTF-71', 'Maj. S. Williams (chair)'],
          ['GBR', 'Defence Intelligence', 'Flt Lt E. Clarke'],
          ['CAN', 'Canadian Forces Intelligence Command', 'Maj. R. Tremblay'],
          ['AUS', 'Defence Intelligence Organisation', 'Sqn Ldr H. Patel'],
          ['NZL', 'HQ Joint Forces New Zealand', 'Lt Cdr A. Ngata'],
        ],
      } },
      { p: '(U) Releasability is by nationality, not by membership of a name. Every participant above is admitted because of the nation they serve, which is why this record is marked REL TO FVEY and not to a body called FVEY — no such entitlement exists to hold.' },

      { h: '3. (S) ITEMS EXCHANGED' },
      { table: {
        head: ['Item', 'Originator', 'Subject', 'Caveat'],
        rows: [
          ['26-09-B-01', 'USA', 'Logistics network node identification', 'REL TO FVEY'],
          ['26-09-B-02', 'GBR', 'Maritime movement corroboration, southern approaches', 'REL TO FVEY, ORCON'],
          ['26-09-B-03', 'AUS', 'Influence narrative tracking, host-nation media', 'REL TO FVEY'],
          ['26-09-B-04', 'CAN', 'Technical indicators, maintenance-channel access', 'REL TO FVEY'],
          ['26-09-B-05', 'NZL', 'Pattern-of-life summary, two named vessels', 'REL TO FVEY, ORCON'],
        ],
      } },
      { p: '(S) Items 02 and 05 are originator-controlled. Onward passage to a non-participant, including to another national element of a participant\'s own service, requires the originator\'s written release. Two such requests from Q2 remain outstanding and are carried forward at paragraph 5.' },

      { h: '4. (S) POINTS OF AGREEMENT AND DIFFERENCE' },
      { ul: [
        '(S) All five nations now assess the relocation reported in week 36 as confirmed. This is the first item this year on which the group reached the same confidence level without reservation.',
        '(S) GBR and AUS assess the influence activity as centrally directed. USA assesses it as directed in theme and opportunistic in execution. The difference is one of reporting access, not of interpretation, and both readings are recorded rather than reconciled.',
        '(S) NZL entered a formal reservation on item 04\'s attribution language. The technical indicators are accepted; the named attribution is not, pending NZL\'s own review.',
      ] },

      { h: '5. (U) ACTIONS' },
      { ul: [
        '5.1 (U) USA to submit release requests for items 26-06-A-03 and 26-06-A-07 to the originators by 25 JUL 26.',
        '5.2 (U) GBR to host the next session, 06–07 OCT 26, agenda closing 22 SEP 26.',
        '5.3 (U) All nations to nominate a single point of contact for onward-release decisions. The two outstanding requests at 5.1 have each been open more than sixty days because there was nobody named to answer them.',
      ] },

      { kv: [
        ['Handling', 'Releasable to FVEY partners. Items marked ORCON require originator release.'],
        ['Record kept by', 'J2, CJTF-71'],
        ['Declassify on', '20360708'],
      ] },
    ],
  },

  // ── nato ── SECRET // REL TO NATO ── clearance:secret + relto:nato ─────────
  {
    id: 'nato',
    title: 'JOINT OPERATIONS PLAN — EXERCISE NORTHERN SENTINEL',
    subtitle: 'Allied Joint Force Command · OPLAN 26-4402 · 071400Z JUL 26',
    blocks: [
      { h: '1. (S) SITUATION' },
      { p: '(S) NORTHERN SENTINEL exercises the alliance\'s ability to reinforce the northern flank on short notice with forces from eleven contributing nations, under a single commander, across a contested information environment. The scenario is notional. The interoperability problems it is designed to surface are not: the last iteration lost nineteen hours at the reception and staging phase to incompatible movement-tracking data, and that is the principal thing this plan is written to fix.' },

      { h: '2. (S) MISSION' },
      { p: '(S) On order, Combined Joint Task Force NORTHERN SENTINEL deploys, receives and integrates contributing-nation forces in the joint operations area, establishes combined command and control, and conducts defensive operations to restore the integrity of the alliance\'s northern approaches.' },

      { h: '3. (S) EXECUTION' },
      { table: {
        head: ['Phase', 'Name', 'Dates', 'Decisive condition'],
        rows: [
          ['I', 'Preparation', '01–14 SEP 26', 'Movement plans deconflicted and loaded in the common tracker'],
          ['II', 'Deployment', '15–27 SEP 26', 'All contributing forces at their staging areas'],
          ['III', 'Integration', '28 SEP – 05 OCT 26', 'Combined C2 established; one commander, one picture'],
          ['IV', 'Defensive operations', '06–19 OCT 26', 'Northern approaches held under simulated contest'],
          ['V', 'Recovery', '20–31 OCT 26', 'Forces redeployed; lessons captured before dispersal'],
        ],
      } },
      { p: '(S) Phase III is the point of the exercise and the phase most likely to fail. Every contributing nation arrives with a national system of record and a national classification practice; the plan requires both to be reconciled inside eight days. Phase III will not be declared complete on a schedule — it completes when a single commander can see a single picture, and the exercise holds until it does.' },
      { p: '(S) Phase V begins before forces disperse, deliberately. Lessons captured after redeployment have consistently been lessons captured from the people who were least busy.' },

      { h: '4. (S) COMMAND AND SIGNAL' },
      { ul: [
        '(S) Command of assigned forces passes to Commander CJTF NORTHERN SENTINEL at 150001Z SEP 26 and reverts at 312359Z OCT 26.',
        '(S) National caveats on release of information remain in force throughout. Nothing in this plan overrides a contributing nation\'s own handling instructions, and no working practice adopted during the exercise may assume otherwise.',
        '(S) Combined reporting is at SECRET REL TO NATO unless a national originator directs narrower handling. Reporting that cannot be shared at that level is to be identified as such at origin, not discovered at the point somebody is denied it.',
      ] },

      { h: '5. (U) RELEASABILITY' },
      { p: '(U) This plan is releasable to NATO nations. Releasability follows the nationality of the reader against the member list, which is what allows a British officer to author it, a French officer to act on it, and a partner outside the alliance to be excluded without anyone maintaining a separate distribution list by hand.' },

      { kv: [
        ['Originator', 'Flt Lt E. Clarke, Defence Intelligence (GBR), on behalf of Allied JFC'],
        ['Contributing nations', '11'],
        ['Supersedes', 'OPLAN 25-4390'],
        ['Declassify on', '20360707'],
      ] },
    ],
  },

  // ── sow ── UNCLASSIFIED ── mission:external ────────────────────────────────
  {
    id: 'sow',
    title: 'STATEMENT OF WORK — ATLAS INTEGRATION SERVICES',
    subtitle: 'Contract W91XYZ-26-D-0042, Task Order 0003 · 060900Z JUL 26',
    blocks: [
      { h: '1. BACKGROUND' },
      { p: 'The Government requires integration support to consolidate four sustainment tracking systems, currently operated separately by three organisations, into a single authoritative data service. The present arrangement produces a reconciliation burden of roughly 300 staff-hours per month and, more importantly, produces four different answers to the question of where a given item is.' },

      { h: '2. SCOPE' },
      { p: 'The Contractor shall provide the analysis, software integration and transition support described below. This task order is unclassified in its entirety. The Contractor shall not require access to classified information to perform any task herein; where a task touches a system that also holds classified data, the Government will provide extracts at the unclassified level.' },
      { ul: [
        'Task 1 — Current-state analysis of the four source systems, including data model, update cadence, authoritative ownership of each field, and every point at which the four disagree.',
        'Task 2 — Design of a consolidated data service, with a written migration path per source system and an explicit position on each disagreement found under Task 1.',
        'Task 3 — Implementation and integration testing in the Government-provided development environment.',
        'Task 4 — Transition support, including operator training and thirty days of post-cutover assistance.',
      ] },

      { h: '3. DELIVERABLES' },
      { table: {
        head: ['CDRL', 'Deliverable', 'Task', 'Due', 'Format'],
        rows: [
          ['A001', 'Current-state analysis report', '1', 'Contract award + 45 days', 'PDF'],
          ['A002', 'Consolidated service design', '2', 'Award + 90 days', 'PDF + schema files'],
          ['A003', 'Integration test results', '3', 'Award + 150 days', 'PDF + test artefacts'],
          ['A004', 'Training materials', '4', 'Award + 165 days', 'Editable source'],
          ['A005', 'Monthly status report', '1–4', 'Tenth of each month', 'PDF'],
        ],
      } },
      { p: 'Deliverables are subject to Government review within fifteen working days of receipt. A deliverable returned for correction is not accepted until resubmitted and approved; the payment schedule at clause 4 follows acceptance, not submission.' },

      { h: '4. PERIOD AND PLACE OF PERFORMANCE' },
      { kv: [
        ['Period of performance', '180 days from award, one 90-day option'],
        ['Place of performance', 'Contractor facility, with on-site work as required for Tasks 3 and 4'],
        ['On-site access', 'Escorted, business hours, unclassified spaces only'],
        ['Government furnished', 'Development environment, unclassified data extracts, one technical point of contact'],
      ] },

      { h: '5. SECURITY AND HANDLING' },
      { ul: [
        'No personnel security clearance is required for any task under this order.',
        'Contractor personnel accessing Government networks shall use Government-issued credentials brokered through the Government-managed access path. Contractor-held credentials to Government systems are not authorised under this order.',
        'All data furnished under this order is unclassified. The Contractor shall not aggregate furnished extracts with other data sets without written Government approval, since aggregation can raise the classification of material that is individually unclassified.',
        'The Contractor shall return or certify destruction of all furnished data within thirty days of order completion.',
      ] },

      { kv: [
        ['Contracting officer\'s representative', 'CPT J. Rivera, CJTF-71 J4'],
        ['Distribution statement', 'A — approved for public release, distribution unlimited'],
        ['Classification', 'UNCLASSIFIED'],
      ] },
    ],
  },

  // ── readme ── UNCLASSIFIED ── no attributes required ───────────────────────
  {
    id: 'readme',
    title: 'Project_README.txt',
    subtitle: 'Enclave tooling repository · maintained by J6 Cybersecurity Division',
    blocks: [
      { pre: 'ENCLAVE TOOLING\n===============\n\nScripts the J6 cyber team runs against Enclave B. Unclassified by\nconstruction: nothing here stores results, and nothing here is\nallowed to. Findings live in the audit workbook, not in this repo.' },

      { h: 'WHAT IS IN HERE' },
      { pre: 'baseline/       the enclave configuration baseline, one file per asset class\ncollect/        read-only collectors — configuration export, no changes\ncompare/        diffs a collected configuration against the baseline\nreport/         renders a diff set into the audit workbook format\ndocs/           runbooks, including the retest evidence checklist' },

      { h: 'RUNNING A COLLECTION' },
      { pre: '$ ./collect/run --scope enclave-b --out ./work/$(date +%Y%m%d)\n$ ./compare/run ./work/20260709 --baseline baseline/enclave-b\n$ ./report/run ./work/20260709/diff.json --format workbook' },
      { p: 'The collectors are read-only and are meant to stay that way. If you need to change something on an asset, do it through the configuration management path and let the next collection observe it — a collector that writes is a collector nobody will let you run during an audit window.' },

      { h: 'RULES' },
      { ul: [
        'Do not commit collected output. Everything under work/ is ignored, and that is deliberate: a configuration export from a classified enclave is not unclassified just because the tooling that produced it is.',
        'Do not add credentials, hostnames or IP addresses to this repository. The collectors take them as arguments for exactly this reason.',
        'Baseline changes need a reviewer from outside the cyber cell. A baseline that the assessors also maintain is not an independent standard.',
        'Two assets (SRV-09, SRV-11) fail collection intermittently under a known agent bug. Record them as unavailable rather than nominal — see docs/runbook-unavailable-assets.md.',
      ] },

      { h: 'CONTACT' },
      { pre: 'Maintainer:  CW3 M. Johnson, J6 Cybersecurity Division\nIssues:      internal tracker, project ENCL\nRunbooks:    docs/' },
    ],
  },
]

const byId = new Map(COLLABORATE_DOCS.map(d => [d.id, d]))

/**
 * The document behind a Collaborate file id, or undefined for the files a user uploads at
 * runtime — those have ids like `upload-1758…` and no content the simulation could show.
 *
 * @returns {typeof COLLABORATE_DOCS[number] | undefined}
 */
export function collaborateDoc(id) {
  return byId.get(id)
}
