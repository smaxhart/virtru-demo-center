/**
 * The federal sample documents, with their actual content.
 *
 * These used to be three-sentence stubs carrying invented file sizes ("1.8 MB" for 200 bytes of
 * text). That is fine for a thumbnail and wrong for everything else: TDF Explorer encrypts the
 * sample and then shows you the plaintext it recovered, so a stub makes the most important frame
 * of the demo — the released document — look like a placeholder. These are full-length documents
 * in the formats they are imitating, and `size` is measured from the bytes below.
 *
 * Three rules held while writing them:
 *
 *   1. **The banner line is the first non-blank line.** `src/ai/markingParser.js` reads only that
 *      line, so a file exported to disk and dragged back in must derive its own policy. Every
 *      `banner` here round-trips through `parseMarkingToFqns` to the `policy` beside it — except
 *      `cyber`, deliberately, and that one says so in `detectDelta`.
 *   2. **Only values `electron/seeder.js` actually created.** A policy naming an attribute the
 *      platform never seeded does not fail loudly; the decision lookup comes back empty and the
 *      KAS denies *everyone*. The seeded set is clearance / mission / role / nationality / relto.
 *   3. **Releasability is a roster of nationalities, never a value named after the coalition.**
 *      Nobody holds an entitlement called FVEY; they hold a nationality, and `nationality` is
 *      ANY_OF, so listing the members is what grants one of them. `src/data/coalitions.js` owns
 *      those lists and intersects them with the seeded nations, which is what keeps NATO at 13
 *      values instead of the 32 that put the old policy over the ceiling and denied all seven
 *      personas — including both NATO officers it was written for.
 *
 * `policyWhy` is keyed by *definition* rather than by FQN, because a roster is one decision and not
 * thirteen: the reader needs to know why `nationality` is on the policy, not why Belgium is.
 *
 * Portion markings in the bodies are decorative — the policy is the `policy` array, not the
 * parentheticals. They are here because a document without them does not look like the thing it
 * claims to be, and the whole point of these samples is that the plaintext is worth reading.
 */

import { coalitionFqns, coalitionLabel, coalitionSize } from './coalitions.js'

const NS = 'https://demo.com/attr'
const A = (name, value) => `${NS}/${name}/value/${value}`

export const FEDERAL_DOCS = [
  {
    id: 'opord',
    name: 'OPORD_24-003_MERIDIAN.txt',
    icon: 'document',
    classification: 'SECRET',
    banner: 'SECRET//REL TO FVEY',
    summary: 'The base order for Operation MERIDIAN — five paragraphs, task organization, four phases.',
    policy: [A('clearance', 'secret'), ...coalitionFqns('fvey')],
    policyWhy: {
      clearance: 'SECRET in the banner line.',
      nationality: `REL TO FVEY in the banner line, which is ${coalitionLabel('fvey')}. `
        + 'ANY_OF, so holding one of them is enough — Emma is British and that is the whole reason she gets in.',
    },
    body: `SECRET//REL TO FVEY

HEADQUARTERS, COMBINED JOINT TASK FORCE 71
CAMP LEMONNIER, DJIBOUTI
221400Z SEP 26

OPERATION ORDER 24-003 (OPERATION MERIDIAN)

REFERENCES:
  a. (U) CJTF-71 WARNORD 24-011, 140900Z SEP 26.
  b. (S//REL TO FVEY) CJTF-71 INTSUM 0142, 201800Z SEP 26.
  c. (U) Annex C (Rules of Engagement) to this order.
  d. (U) CJCSI 3121.01B, Standing Rules of Engagement.

TIME ZONE USED THROUGHOUT THE ORDER: ZULU

TASK ORGANIZATION:
  (U) CJTF-71 Headquarters ................. COL M. Reyes, USA
  (U) Task Force ATLAS (ground maneuver) ... 1-187 IN
  (U) Task Force KESTREL (aviation) ........ 3-10 AVN
  (U) Task Force LANTERN (ISR) ............. 22 RS (DET 3)
  (U) Coalition Liaison Element ............ GBR, AUS, CAN, NZL
  (S//REL TO FVEY) TF KESTREL is OPCON to CJTF-71 effective D-2. TF LANTERN
      remains TACON to CJTF-71 for the duration of Phase II only.

1. (U) SITUATION.

   a. (S//REL TO FVEY) Enemy Forces. Two irregular formations assessed at
      battalion equivalent continue to contest the coastal corridor between
      OBJ HALYARD and the port district. Indirect fire remains the primary
      threat: eleven engagements in the last fourteen days, all 82mm or
      smaller, all from the escarpment north of Route CRIMSON. Command and
      control is assessed as cellular and degraded. Detail at reference b.

   b. (U) Friendly Forces. Higher headquarters (CJTF-HOA) retains priority of
      ISR through D+3 and will transfer it to this command on order. Adjacent
      units: 2-3 MAR to the south, no boundary changes anticipated.

   c. (U) Attachments and Detachments. See TASK ORGANIZATION above.

   d. (U) Civil Considerations. The port district holds an estimated 40,000
      residents. Two NGO clinics operate inside the objective area and are
      recorded on the no-strike list.

2. (S//REL TO FVEY) MISSION. On order, CJTF-71 conducts combined clearing
   operations along the coastal corridor to restore freedom of movement on
   Route CRIMSON, in order to permit the resumption of humanitarian resupply
   through the port of BERBERA NLT D+21.

3. (U) EXECUTION.

   a. (U) Commander's Intent. The purpose of this operation is freedom of
      movement, not attrition. I accept a slower tempo to keep the port open
      and the clinics untouched. Key tasks: secure Route CRIMSON from PL AMBER
      to the port gate; deny the escarpment as a firing position; hand the
      corridor to host-nation security forces on a schedule they can sustain.
      Endstate: Route CRIMSON open to unescorted humanitarian traffic, the
      escarpment under persistent observation, and host-nation forces holding
      three of four checkpoints without coalition augmentation.

   b. (S//REL TO FVEY) Concept of Operations. Four phases.

      PHASE I — SHAPE (D-14 to D-1). TF LANTERN establishes pattern-of-life
      coverage of the escarpment. Coalition liaison completes host-nation
      force assessment. No offensive action.

      PHASE II — SEIZE (D to D+4). TF ATLAS clears from PL AMBER north to
      PL SLATE. TF KESTREL provides armed escort and casualty evacuation on
      thirty-minute strip alert.

      PHASE III — HOLD (D+5 to D+18). Checkpoints established at grid
      intersections 1 through 4. Host-nation forces integrated one checkpoint
      at a time, beginning with CP 3.

      PHASE IV — TRANSITION (D+19 onward). Coalition presence reduced to a
      single quick-reaction force. Route security transfers to host nation.

   c. (U) Tasks to Subordinate Units.
      (1) (S//REL TO FVEY) TF ATLAS. Clear to PL SLATE NLT D+4. Be prepared to
          establish CP 1 through CP 4 on order.
      (2) (S//REL TO FVEY) TF KESTREL. Maintain two aircraft on thirty-minute
          strip alert D through D+18.
      (3) (S//REL TO FVEY) TF LANTERN. Persistent observation of the
          escarpment, priority to named area of interest 4.
      (4) (U) Coalition Liaison Element. Certify host-nation checkpoint
          readiness. Report weekly.

   d. (U) Coordinating Instructions.
      (1) (U) Rules of engagement are at Annex C. Every commander will confirm
          ROE brief completion by name before crossing PL AMBER.
      (2) (U) No-strike list is binding and is not delegable below this
          headquarters.
      (3) (U) CCIR: any engagement within 500m of a clinic; any host-nation
          casualty; any loss of ISR coverage over NAI 4 exceeding six hours.

4. (U) SUSTAINMENT. Class I and III(B) pushed from Camp LEMONNIER on a
   72-hour cycle. Role 2 care at FOB TRESTLE; Role 3 at Camp LEMONNIER.
   Ground casualty evacuation is primary inside the port district — rotary
   wing is not assured over the built-up area.

5. (U) COMMAND AND SIGNAL.

   a. (U) Command. Commander CJTF-71 is at FOB TRESTLE through Phase III.
      Succession: Deputy Commander, then Commander TF ATLAS.

   b. (U) Signal. Primary FM, alternate TACSAT, contingency runner. Coalition
      partners operate on the combined net; the FVEY-releasable common
      operational picture is authoritative for friendly force tracking.

ACKNOWLEDGE.

                                        REYES
                                        COL, USA
                                        Commander

OFFICIAL:
//s// J. TILLMAN, LTC, USA, J3

Classified by:   Commander, CJTF-71
Derived from:    CJTF-71 SCG 24-1, dated 4 JAN 26
Declassify on:   20360922

SECRET//REL TO FVEY`,
  },

  {
    id: 'sitrep',
    name: 'SITREP_D+14_CJTF-71.txt',
    icon: 'document',
    classification: 'SECRET',
    banner: 'SECRET//REL TO FVEY',
    summary: 'Daily situation report, reporting period ending 220600Z — the order above, fourteen days in.',
    policy: [A('clearance', 'secret'), ...coalitionFqns('fvey')],
    policyWhy: {
      clearance: 'SECRET in the banner line.',
      nationality: 'REL TO FVEY — the coalition liaison element has to be able to read this, and the '
        + `five nations it names (${coalitionLabel('fvey')}) are who that means.`,
    },
    body: `SECRET//REL TO FVEY

CJTF-71 DAILY SITUATION REPORT
REPORTING PERIOD: 210600Z to 220600Z SEP 26
SITREP NUMBER: 24-256
OPERATION: MERIDIAN (OPORD 24-003), PHASE III — HOLD, D+14

1. (U) COMMANDER'S ASSESSMENT.

   (S//REL TO FVEY) GREEN on mission, AMBER on transition. Route CRIMSON has
   been open to unescorted humanitarian traffic for six consecutive days and
   the port has cleared 1,840 metric tons in that window — ahead of the D+21
   objective. Transition is the problem: host-nation readiness at CP 2 has
   slipped twice and I am not willing to certify it on the current schedule.
   Recommend a seven-day extension to Phase III rather than a transfer we have
   to reverse.

2. (U) SIGNIFICANT ACTIVITY.

   a. (S//REL TO FVEY) 211145Z — Single 82mm round impacted 900m north of
      CP 4. No casualties, no damage. Point of origin fixed on the escarpment
      at NAI 4. TF LANTERN held coverage through the engagement; counter-fire
      was withheld under the no-strike list because the firing point sits
      inside the 500m clinic ring. Assessed as harassment, not a shift in
      posture.

   b. (U) 211930Z — Host-nation checkpoint element at CP 3 completed its
      fourth consecutive independent shift. Coalition Liaison Element
      recommends certification. Concur.

   c. (S//REL TO FVEY) 220315Z — ISR gap of four hours ten minutes over
      NAI 4 caused by an unscheduled maintenance abort. Under the six-hour
      CCIR threshold; reported here for completeness. Coverage restored.

3. (U) FRIENDLY FORCE STATUS.

   UNIT              PERSONNEL   COMBAT POWER   REMARKS
   TF ATLAS          94%         GREEN          Two personnel on quarters.
   TF KESTREL        88%         AMBER          One airframe in phase
                                                maintenance through D+17;
                                                strip alert still met with
                                                the remaining two.
   TF LANTERN        100%        GREEN          See paragraph 2.c.
   Coalition Liaison 100%        GREEN          GBR, AUS, CAN, NZL all
                                                present.

   (U) Casualties this period: none. Cumulative: 3 WIA (all RTD), 0 KIA.

4. (U) SUSTAINMENT.

   Class I:     7 days of supply on hand.
   Class III(B): 5 days. Next push 230400Z.
   Class V:     GREEN, no expenditure this period.
   Class VIII:  AMBER — Role 2 at FOB TRESTLE is short two units of whole
                blood. Requisition submitted 211200Z.

5. (U) CIVIL AND HUMANITARIAN.

   (U) Both NGO clinics operating normally. Clinic 2 reported a 30% increase
   in outpatient volume, attributed to the reopened road rather than to any
   change in the threat. No displacement reported this period.

6. (U) NEXT 24 HOURS.

   a. (U) CP 3 certification board, 221400Z.
   b. (S//REL TO FVEY) TF ATLAS conducts a mounted presence patrol from CP 1
      to the port gate, 221600Z to 221900Z.
   c. (U) Class VIII resupply expected 230400Z with the fuel push.

7. (U) DISTRIBUTION. CJTF-HOA J3; CJTF-71 J2/J3/J4/J6; TF commanders;
   Coalition Liaison Element.

                                        TILLMAN
                                        LTC, USA
                                        J3, CJTF-71

Classified by:   Commander, CJTF-71
Derived from:    CJTF-71 SCG 24-1, dated 4 JAN 26
Declassify on:   20360922

SECRET//REL TO FVEY`,
  },

  {
    id: 'intel',
    name: 'INTSUM_0142_SI.txt',
    icon: 'search',
    classification: 'TOP SECRET',
    banner: 'TOP SECRET//SI//ORCON',
    summary: 'The SIGINT-derived intelligence summary the order cites as reference b.',
    policy: [A('clearance', 'ts-sci'), A('mission', 'intel')],
    policyWhy: {
      clearance: 'TOP SECRET in the banner line.',
      mission: 'SI — compartmented reporting, so the policy adds the need-to-know the banner implies. Only one persona holds both.',
    },
    body: `TOP SECRET//SI//ORCON

CJTF-71 INTELLIGENCE SUMMARY 0142
AS OF: 201800Z SEP 26
PRODUCED BY: CJTF-71 J2 (ANALYSIS AND PRODUCTION)
SERIAL: J2-24-0142

WARNING: ORIGINATOR CONTROLLED. Further dissemination, extraction, or
inclusion in another product requires the originator's written approval.

1. (U) SCOPE. Adversary posture in the coastal corridor between OBJ HALYARD
   and the port district, covering 060001Z to 201800Z SEP 26. Supersedes
   INTSUM 0138.

2. (TS//SI) KEY JUDGMENTS.

   a. (TS//SI) We assess with high confidence that the two irregular
      formations contesting the corridor are not operating under a single
      command. Collection over the reporting period shows two distinct
      communications patterns with no cross-talk and no shared control
      element — consistent with coordination by accommodation rather than by
      order.

   b. (TS//SI) We assess with moderate confidence that indirect fire is being
      allocated locally rather than directed. Firing events do not correlate
      with any observed command traffic in the preceding six hours, and the
      pattern of expenditure is consistent with a standing permission to fire
      at targets of opportunity within a fixed sector.

   c. (TS//SI) We assess with moderate confidence that the escarpment firing
      positions are chosen for their proximity to protected sites, not for
      their observation. Three of four fixed points sit inside the 500m ring
      of a recorded clinic. Confidence is moderate rather than high because
      the terrain also favors those positions on military grounds alone.

   d. (S//SI) Alternative judgment, carried deliberately: a single degraded
      command element could produce the same observed pattern if it has lost
      the ability to communicate laterally. Two collection gaps in the period,
      totaling nineteen hours, are the reason this cannot be closed out.

3. (TS//SI) SUPPORTING REPORTING.

   a. (TS//SI) Eleven indirect fire events in the period. All 82mm or smaller.
      Points of origin cluster on four fixed positions along the escarpment,
      NAI 4.
   b. (TS//SI) Communications activity peaks between 0400Z and 0630Z local,
      consistent across both formations and unchanged since INTSUM 0138.
   c. (TS//SI) No indication of anti-air capability beyond small arms. This is
      a negative finding from two collection sources and should not be read as
      a cleared corridor.

4. (U) INTELLIGENCE GAPS.

   a. (U) Resupply route for 82mm ammunition. Unresolved across three
      reporting periods.
   b. (U) Identity and location of any element with authority over both
      formations, if one exists. See paragraph 2.d.
   c. (U) Effect of the reopened port on adversary revenue.

5. (U) OUTLOOK. (TS//SI) We expect harassment fire to continue at the current
   rate through the transition period. We do not expect a massed attack on the
   checkpoints: no formation in the corridor is assessed capable of
   concentrating above platoon strength without detection, and nothing in the
   reporting suggests intent to try.

6. (U) COORDINATION. Coordinated with CJTF-HOA J2. Not coordinated with the
   Coalition Liaison Element — this product is not releasable, and the
   FVEY-releasable extract is published separately as INTSUM 0142-E.

                                        HALVORSEN
                                        LTC, USA
                                        J2, CJTF-71

Classified by:   Director of Intelligence, CJTF-71
Derived from:    Multiple sources
Declassify on:   25X1, 20510920

TOP SECRET//SI//ORCON`,
  },

  {
    id: 'roe',
    name: 'ROE_ANNEX_C_MERIDIAN.txt',
    icon: 'document',
    classification: 'SECRET',
    banner: 'SECRET//REL TO NATO',
    summary: 'Annex C to the base order. Marked to the widest coalition that has to obey it.',
    policy: [A('clearance', 'secret'), ...coalitionFqns('nato')],
    policyWhy: {
      clearance: 'SECRET in the banner line.',
      nationality: `REL TO NATO — ${coalitionSize('nato')} member nations, which is every NATO member this `
        + 'platform has a nationality value for. Henri and Klaus are refused the FVEY documents and '
        + 'granted this one, on the same clearance: the difference is entirely which alliance they are in.',
    },
    body: `SECRET//REL TO NATO

ANNEX C (RULES OF ENGAGEMENT) TO OPERATION ORDER 24-003
HEADQUARTERS, COMBINED JOINT TASK FORCE 71
221400Z SEP 26

REFERENCES:
  a. (U) CJCSI 3121.01B, Standing Rules of Engagement for US Forces.
  b. (U) MC 362/1, NATO Rules of Engagement.
  c. (U) OPORD 24-003 (OPERATION MERIDIAN), base order.

1. (U) PURPOSE. This annex states the rules of engagement in force for all
   units under CJTF-71 operational or tactical control during OPERATION
   MERIDIAN, including coalition contingents. It is releasable to NATO because
   every force that must obey it has to be able to read it.

2. (U) GENERAL.

   a. (U) Nothing in this annex limits the inherent right and obligation of
      self-defense. Unit self-defense and individual self-defense are always
      authorized.

   b. (U) These rules are restrictive: what is not authorized here is not
      authorized. A commander who needs an authority not granted below
      requests it through the CJTF-71 J3.

   c. (S//REL TO NATO) Coalition contingents remain bound by national caveats.
      Where a national caveat is more restrictive than this annex, the caveat
      governs for that contingent. Contingents will declare caveats in writing
      to the J3 before their first employment.

3. (S//REL TO NATO) AUTHORIZED.

   a. (S//REL TO NATO) Use of force in self-defense, including force likely to
      cause death, against any person committing or demonstrating hostile
      intent toward friendly forces.

   b. (S//REL TO NATO) Use of force to defend designated protected sites:
      the two recorded NGO clinics, the port fuel farm, and the water
      treatment plant at grid intersection 2.

   c. (S//REL TO NATO) Detention of persons for force protection, for a period
      not to exceed 96 hours, after which transfer to host-nation authority or
      release is mandatory.

   d. (S//REL TO NATO) Warning shots, by trained personnel only, in the
      graduated force sequence at paragraph 5.

4. (S//REL TO NATO) NOT AUTHORIZED WITHOUT CJTF-71 APPROVAL.

   a. (S//REL TO NATO) Counter-fire against any point of origin inside the
      500m ring of a recorded protected site. This authority is retained at
      this headquarters and is not delegable. It is the single most likely
      decision a checkpoint commander will want to make without asking, and
      the answer is to ask.

   b. (S//REL TO NATO) Offensive operations north of PL SLATE.

   c. (S//REL TO NATO) Entry into either NGO clinic compound, except to
      render aid at the request of clinic staff.

   d. (S//REL TO NATO) Employment of riot control agents.

5. (U) GRADUATED FORCE SEQUENCE. Where time and circumstance permit, and
   self-defense does not require otherwise: shout, show, shove, warning shot,
   aimed fire. Skipping steps is lawful when the situation does not permit
   them. Reaching the end of the sequence is not a requirement before
   exercising self-defense.

6. (U) POSITIVE IDENTIFICATION. Force may not be directed at a person or
   object without positive identification — reasonable certainty that the
   proposed target is a legitimate military target. Uncertainty is resolved by
   not firing.

7. (U) PROPORTIONALITY AND THE NO-STRIKE LIST. The no-strike list at Appendix
   1 is binding on all contingents. Additions come from this headquarters;
   removals require CJTF-HOA approval. There is no tactical exception.

8. (U) REPORTING. Every use of force beyond a warning shot is reported to the
   J3 by the fastest means available, and in writing within 12 hours. Every
   engagement within 500m of a protected site is a CCIR and goes immediately.

9. (U) TRAINING AND CERTIFICATION. Commanders certify by name that every
   member of their element has been briefed on this annex before crossing
   PL AMBER. Certifications are held by the J3.

                                        REYES
                                        COL, USA
                                        Commander, CJTF-71

Classified by:   Commander, CJTF-71
Derived from:    CJTF-71 SCG 24-1, dated 4 JAN 26
Declassify on:   20360922

SECRET//REL TO NATO`,
  },

  {
    id: 'cyber',
    name: 'CYBER_INCIDENT_G6-2291.txt',
    icon: 'shield',
    classification: 'SECRET',
    banner: 'SECRET//NOFORN',
    summary: 'A closed cyber incident report. The one sample whose policy is deliberately tighter than its banner.',
    policy: [A('clearance', 'secret'), A('mission', 'cyber')],
    policyWhy: {
      clearance: 'SECRET in the banner line.',
      mission: 'LIMDIS in the handling line, not in the banner. This is the attribute that narrows the document to one reader.',
    },
    // The banner alone yields clearance:secret, so dragging the exported file back in produces a
    // looser policy than the sample's. That is the honest behaviour, not a bug: need-to-know is not
    // written in a banner line, and the page says so out loud rather than pretending otherwise.
    detectDelta: 'Dragged in from disk, this file derives clearance:secret only — the banner does not '
      + 'carry need-to-know. The sample adds mission:cyber from the LIMDIS handling line, which no '
      + 'banner parser can see.',
    body: `SECRET//NOFORN

SPECIAL HANDLING: LIMDIS — CJTF-71 G6 CYBERSPACE OPERATIONS ONLY

CYBER INCIDENT REPORT
INCIDENT NUMBER: G6-2291
CATEGORY: CAT 2 (USER-LEVEL INTRUSION)
STATUS: CLOSED — REMEDIATED
REPORTING ORGANIZATION: CJTF-71 G6, DEFENSIVE CYBERSPACE OPERATIONS

1. (U) SUMMARY.

   (S//NOFORN) On 151422Z SEP 26 the G6 sensor grid flagged anomalous SMB
   authentication from a maintenance workstation on SIPR cluster 7 to eleven
   hosts in under ninety seconds. Investigation established credential reuse
   by a contract technician, not adversary tooling. Containment completed
   within eighteen minutes of detection. No data exfiltration. No adversary
   presence. Incident closed 171100Z SEP 26.

2. (U) TIMELINE (ALL TIMES ZULU).

   151422  Sensor alert: lateral SMB authentication, workstation
           SIPR-C7-MX04 to 11 hosts in 87 seconds.
   151424  Watch officer validates the alert as true positive.
   151431  SIPR-C7-MX04 isolated at the switch port. Account
           SVC-MAINT-C7 disabled.
   151440  Containment confirmed. No further authentication attempts from
           the isolated host.
   151455  COOP plan activated for cluster 7 maintenance functions. No
           mission system degraded.
   151630  Forensic image of SIPR-C7-MX04 taken. Hash recorded.
   160210  Memory and disk analysis complete. No persistence mechanism, no
           unrecognized binaries, no outbound connection to any address
           outside the enclave.
   160915  Interview with the contract technician. Admits reusing a shared
           maintenance credential across the cluster to shorten a patch
           cycle.
   161400  Root cause confirmed as credential reuse under a shared service
           account. Reclassified from possible intrusion to policy
           violation with security impact.
   171100  Host rebuilt from baseline and returned to service. Incident
           closed.

3. (U) TECHNICAL FINDINGS.

   a. (S//NOFORN) Initial access: none. The activity originated from an
      authorized host using an authorized credential.
   b. (S//NOFORN) The shared service account SVC-MAINT-C7 was in use by four
      technicians and had not been rotated in 213 days.
   c. (S//NOFORN) Sensor coverage performed as designed. Detection to
      isolation was nine minutes, inside the fifteen-minute standard.
   d. (S//NOFORN) Logging gap: the workstation's local event log had rolled
      over at 11 days' retention, against a 90-day requirement. This did not
      affect the investigation because the network sensor record was
      complete, and it would have affected a real intrusion badly.

4. (U) IMPACT.

   Confidentiality:  No loss. No exfiltration path observed or available.
   Integrity:        No unauthorized modification identified.
   Availability:     One maintenance workstation offline 44 hours. No mission
                     system affected.
   Classification:   No spillage.

5. (U) CORRECTIVE ACTIONS.

   a. (U) SVC-MAINT-C7 deleted. Per-technician accounts issued with
      credential rotation enforced at 60 days. COMPLETE 171100Z.
   b. (U) Local log retention corrected to 90 days across cluster 7 by group
      policy. COMPLETE 180800Z.
   c. (U) Shared-credential audit across clusters 1 through 9. Four further
      shared service accounts found and remediated. COMPLETE 191500Z.
   d. (U) Contract technician's access suspended pending retraining.
      Retraining complete 201000Z; access restored with per-technician
      credential only.

6. (U) LESSONS.

   (S//NOFORN) The detection worked and the response worked. What nearly cost
   us the investigation was an 11-day log retention on the one host that
   mattered. A shared maintenance credential that looks like a convenience is
   the same artifact an intruder would use to move quietly, and for nine
   minutes we could not tell the two apart. Both are fixed; the second one
   will come back unless the audit at 5.c is recurring.

7. (U) DISTRIBUTION. CJTF-71 G6 (DCO); CJTF-71 J6; CJTF-HOA J6. LIMDIS —
   further distribution requires G6 approval.

                                        OKONKWO
                                        MAJ, USA
                                        Chief, Defensive Cyberspace Operations

Classified by:   CJTF-71 G6
Derived from:    CJTF-71 SCG 24-1, dated 4 JAN 26
Declassify on:   20360922

SECRET//NOFORN`,
  },

  {
    id: 'pws',
    name: 'PWS_SOCOM_J39_MERIDIAN.txt',
    icon: 'document',
    classification: 'UNCLASSIFIED',
    banner: 'UNCLASSIFIED',
    summary: 'An unclassified performance work statement — the control case. Everyone with any clearance opens it.',
    policy: [A('clearance', 'unclassified')],
    policyWhy: {
      clearance: 'UNCLASSIFIED in the banner line. clearance is a hierarchy, so every cleared persona satisfies it — an identity with no attributes at all still does not.',
    },
    body: `UNCLASSIFIED

DISTRIBUTION STATEMENT A. Approved for public release; distribution is
unlimited.

PERFORMANCE WORK STATEMENT
INFORMATION OPERATIONS PLANNING SUPPORT
SOLICITATION NUMBER: H92222-26-R-0147
REQUIRING ACTIVITY: USSOCOM J39
DATE: 22 SEP 2026

1.0 (U) SCOPE.

1.1 The contractor shall provide information operations planning support to
    USSOCOM J39 and to designated forward headquarters, including CJTF-71 in
    support of OPERATION MERIDIAN. Support includes planning, assessment, and
    product development. The contractor shall not perform inherently
    governmental functions, and shall not exercise approval authority over any
    government product.

1.2 Period of performance: one twelve-month base period and four twelve-month
    option periods.

1.3 Place of performance: contractor facility for 70% of effort; government
    facility at MacDill AFB for 20%; OCONUS forward locations for 10%.

2.0 (U) APPLICABLE DOCUMENTS.

    a. DoDD 3600.01, Information Operations.
    b. DFARS 252.204-7012, Safeguarding Covered Defense Information.
    c. NIST SP 800-171 Rev. 3.
    d. DoDM 5200.01, DoD Information Security Program.

3.0 (U) REQUIREMENTS.

3.1 (U) Planning Support. The contractor shall provide personnel to
    participate in operational planning teams, produce draft planning
    products, and maintain planning artifacts under government direction.
    Estimated level of effort: four full-time equivalents.

3.2 (U) Assessment Support. The contractor shall develop measures of
    performance and measures of effectiveness, collect against them, and
    deliver a written assessment monthly. Estimated level of effort: two
    full-time equivalents.

3.3 (U) Product Development. The contractor shall produce informational
    products to government specification. All products require government
    approval before release. The contractor shall maintain a production log
    available for government inspection on request.

3.4 (U) Surge. The contractor shall be capable of surging to 150% of baseline
    level of effort within 30 days of written notice, for a period not to
    exceed 120 days per option period.

4.0 (U) DELIVERABLES.

    CDRL   ITEM                          FREQUENCY    DUE
    A001   Monthly Status Report         Monthly      10th of the month
    A002   Assessment Report             Monthly      15th of the month
    A003   Planning Product Log          Quarterly    15 days after quarter
    A004   Personnel Roster and
           Clearance Status              Monthly      5th of the month
    A005   Transition-Out Plan           Once         60 days before end of
                                                      final option period

5.0 (U) PERSONNEL AND SECURITY.

5.1 (U) The contractor shall provide personnel holding a final SECRET
    clearance at minimum. Two positions require TOP SECRET with SCI
    eligibility; those positions are identified in the DD Form 254.

5.2 (U) Clearance eligibility does not convey access. Access to any specific
    program or product is granted by the government on a need-to-know basis
    and may be withdrawn at any time without effect on the contract.

5.3 (U) Foreign nationals may be proposed for positions not requiring access
    to classified information. The contractor shall identify any proposed
    foreign national in writing before assignment.

5.4 (U) The contractor shall report the departure of any cleared person within
    one business day.

6.0 (U) COVERED DEFENSE INFORMATION.

6.1 (U) Performance of this effort involves controlled unclassified
    information. The contractor shall implement NIST SP 800-171 Rev. 3 and
    shall flow the requirement down to every subcontractor that will handle
    covered defense information.

6.2 (U) Cyber incidents shall be reported to DoD within 72 hours of
    discovery, per DFARS 252.204-7012.

7.0 (U) PERFORMANCE STANDARDS.

    REQUIREMENT              STANDARD                      METHOD
    Deliverable timeliness   100% on or before due date    CDRL review
    Deliverable quality      Government acceptance without
                             major revision, 90% of items  CDRL review
    Staffing                 Baseline FTE filled 95% of
                             each month                    Roster review
    Surge responsiveness     Surge staffed within 30 days  Notice test

8.0 (U) GOVERNMENT-FURNISHED PROPERTY AND INFORMATION.

    The government shall furnish workspace, network access, and access to
    planning artifacts required for performance at government facilities. The
    government furnishes no equipment for contractor-facility work.

9.0 (U) TRANSITION.

    The contractor shall deliver a transition-out plan per CDRL A005 and shall
    support a 30-day overlap with any successor at no additional cost.

UNCLASSIFIED`,
  },
]

const byId = new Map(FEDERAL_DOCS.map(d => [d.id, d]))

/** @returns {typeof FEDERAL_DOCS[number] | undefined} */
export function federalDoc(id) {
  return byId.get(id)
}

/** Bytes of a document's body, the way the filesystem would count them. */
export function docBytes(doc) {
  return new TextEncoder().encode(doc.body).length
}

export function formatSize(bytes) {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
}

/**
 * The sample list. `size` is measured, not invented — the previous values claimed 1.8 MB for a
 * document that was 200 bytes long, and the first thing TDF Explorer does is print the real size
 * of the archive next to it.
 */
export const FEDERAL_SAMPLE_FILES = FEDERAL_DOCS.map(d => ({
  id: d.id,
  name: d.name,
  icon: d.icon,
  size: formatSize(docBytes(d)),
  classification: d.classification,
}))

/** The plaintext, keyed by id. Kept as an export because EncryptPage reads it by that name. */
export const FEDERAL_FILE_PREVIEWS = Object.fromEntries(FEDERAL_DOCS.map(d => [d.id, d.body]))

/** Policies by id, for TDF Explorer's sample encrypt path. */
export const FEDERAL_FILE_POLICIES = Object.fromEntries(FEDERAL_DOCS.map(d => [d.id, d.policy]))
