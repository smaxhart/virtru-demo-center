# SABLE demo script: "Running a simulation you aren't allowed to read"

**Length:** about 15 minutes, or 8 if you cut beats 5 and 6.
**Audience:** a defense prime, a program office, or an engineering lead at a supplier with a multi-company program.
**Setup:** Demo Center running with the platform SERVING. Open **SABLE** in the sidebar and wait for the boot bar (about 15 seconds: it seals every file, database row and seed run as real TDFs). Start on the AFSIM Workbench as Dana, "trim names" off, PEP decision log open. Say up front that everything is synthetic.

## Opening (1 min)

> "Three companies are building one aircraft. Each owns a piece, and none of them can see the others' pieces. But to know whether the jet survives, somebody has to run all the pieces together, against a threat environment the government won't release. So the real question is: who gets to run it, and who gets to read the answer?"

Put the three companies on screen: Meridian (airframe), Corvane (engine), Halden (EW), plus the JPO. Then say: "Today's answer is usually a classification review after the fact, or an ACL on a folder. Watch what happens when the policy travels with the data instead."

## Beat 1: Execute without read (2 min)

**Click:** Workbench, Dana, preset `scn_02 ingress_integrated`.

> "Dana is Meridian's airframe engineer. Look at the per-include status. Her own model says READ + RUN. The other four say RUN ONLY. She can reference Corvane's engine and Halden's EW suite in a scenario. She cannot open them."

Point at the pill colours, then the Repositories tab: "That's the same thing in the code repo. A play icon means run but not read." Click a locked file: the key server refuses it, and the PEP log shows the DENY.
**Land:** access to use a model is separate from access to read it.

## Beat 2: The run succeeds and she doesn't get the answer (3 min)

**Click:** Submit as Dana. Let the log stream.

> "The pipeline checks her identity against every model's execute policy. All permitted. The runner decrypts five models in an enclave, runs 200 Monte Carlo replications, and seals the result."

When the banner appears, read it aloud: **"THE RUN COMPLETED. THE RESULT IS NOT YOURS."**

> "She did everything right, and the system still won't give her the composite. The output inherits the policy of everything that went in: airframe, propulsion, mission systems, all at Secret. She holds only one of those."

**Click:** L1 Open. Her row says "Decisive, meets target +10." Corvane's and Halden's rows say SEALED.
**Say:** "She learns her own part mattered. She learns nothing about her partners' contribution. We give her a band, not a number, because an exact delta would let her back out their numbers."
**Click:** Request on L4. Show the DENY and the missing list (`wp:propulsion, wp:missionsys, wp:threat, comp:KESTREL`).
**Land:** sealing is per layer. Each layer is its own TDF, and the denial comes from the key server, not from the page. A denied request tells you what's missing without leaking any content.

## Beat 3: Someone who can read all of it (3 min)

**Click:** switch to Col. Hale (Top Secret plus the KESTREL compartment), run the same scenario.

> "Same scenario, same seed, same models. Hale reads everything."

Walk the layers quickly: 81% survivability, 100% detected, 10 seconds of exposure. In L3 the IR short-range site is the only one that ever engages. In L4 the long-range SAM acquires at 40 km.
**Click:** Open replay, scrub to about T+12 minutes, point at the JAM markers and the acquisition and fire-control rings.

> "That 40 km number depends on the airframe's signature and the threat's parameters together. Either half alone is harmless. The combination is the most sensitive number in the run, which is why only Hale can read it."

**Land:** the policy on an output is derived from its inputs, not stamped on by a reviewer.

## Beat 4: The slices in between (1 min)

**Click:** Vasquez (threat analyst): open the latest run's replay. She sees the laydown and the shots but no aircraft. Then Okafor (program office): he reads the composite but not the threat side.

> "Nobody is the superuser. Each person reads the slice their need-to-know covers."

## Beat 5: Mosaic across databases (2 min)

**Click:** Data Sources, Dana, query 4 (federated flight-test + threats).

> "Three engines: Postgres, SQLite, Timescale. One PEP in front. For queries on a single source, the PEP rewrites the SQL to the caller's entitlements. Columns she can't read come back NULL, rows she can't read never come back. Every cell group is a TDF, and the values that do come back were decrypted as her."

Show the original SQL next to the rewritten SQL. Then run query 4 as Dana: **REFUSED.**

> "None of these columns is Top Secret. The join is. Airframe signature times threat fire-control range gives you engagement ranges. So the join gets its own derived policy, and she doesn't satisfy it."

Switch to Hale and run the same query: 40 rows.
**Land:** this is the mosaic problem, which column-level security alone can't catch.

## Beat 6: A rejected run (1 min)

**Click:** Tyler (Corvane, CUI, no work packages), submit the same scenario.

> "Tyler can't execute the airframe model at all, so nothing runs. Rejected at resolve, with the reasons. Compare this to Dana: she was allowed to run and not read. Tyler isn't allowed to run."

**Click:** Repositories, scenarios, Pipelines. He sees his own failed pipeline and the others as "pipeline exists, details not released."
> "The CI log is the classic side channel. Here, every log line and artifact carries the policy of what produced it."

## Beat 7: The audit answer (2 min)

**Click:** Auditor, pick Dana's run.

> "The question every security officer asks: who could have seen this? One matrix. Dana, the submitter, reads two layers. Hale reads five. The activity ledger counts the denied requests. The matrix on the left has three states, not two: read, execute-only and none. An ordinary ACL has no word for execute-only. And every cell in it is a live key-server decision, not a table someone maintains."

Flip to Hale's run and point out the note changes: "the submitter can read every layer."
Optionally toggle **trim names**: "If even the existence of a partner's file is sensitive, we can redact the filenames."

## Close (1 min)

> "Three things to take away. One: execute and read are separate rights. Two: an output's policy is derived from everything that went into it. Three: it holds at every surface, the code repo, the CI pipeline, the databases, and the result viewer, from one policy, enforced at the key server."

Then ask: **"Where does your program split data between companies today, and who signs off on a joint analysis run?"**

## Discovery questions to ask

- Who decides what a combined result is classified as, and how long does that review take today?
- Do your subs ever run a model they can't inspect, or do they get an export?
- Which tools do engineers run analyses in (AFSIM, MATLAB, a vendor tool) and where do results land?
- When a result gets shared past its audience, how would you find out?

## Likely objections

- **"Is this real AFSIM?"** No. It's an AFSIM-style scripting dialect with a deliberately simple physics model, and every number is synthetic. The point is the policy, not the fidelity. In a real deployment the runner wraps your actual AFSIM install.
- **"The runner can decrypt everything. Isn't that a hole?"** It's the trust boundary and we say so. The runner is an enclave with a service identity, scoped to one run at a time, and every decrypt is in the audit log. Hardening the enclave is a deployment conversation, and it's the known residual risk.
- **"Is the GitLab part real?"** The GitLab view and the database layer are mocks. The decisions behind them are real: every file, column group and result layer is a TDF, and the key server says yes or no. Say it plainly. Don't let them think a real GitLab is enforcing it in this demo.
- **"Does this work with classification markings?"** The clearance ladder here is a stand-in. Attribute names and levels map to whatever your program uses.

## Things not to say

- Don't present the KESTREL compartment, the company names, the markings or the 81% as real.
- Don't call the GitLab or the databases real. The PEP in front of them is a mock; the enforcement is the Virtru key server.
- Don't say the "run receipt" (L0) is a TDF. It's an app-level rule: submitter and JPO.
