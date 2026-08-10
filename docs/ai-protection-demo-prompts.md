# AI Protection Demo — Prompt Guide

Each query below is copy-pasteable into the AI Protection chat page.
The **Outcome** column states what actually happens based on the policy engine, not the LLM.

---

## Personas & Their Entitlements

| Persona | Clearance | Mission / Compartment | Coalition |
|---|---|---|---|
| Maj. Sarah Williams | TS/SCI | mission:intel | relto:fvey, relto:nato |
| CPT. James Rivera | Secret | mission:external | relto:fvey |
| Col. Patricia Lee | Secret | mission:legal | — |
| CW3 Marcus Johnson | Secret | mission:cyber | relto:nato |
| Flt Lt Emma Clarke (UK) | Secret | — | relto:fvey, relto:nato |
| Maj. Henri Dubois (FR) | Secret | — | relto:nato |
| Maj. Klaus Richter (DE) | Secret | — | relto:nato |

---

## Scenario 1 — Clearance Ceiling (TS/SCI vs Secret)

**Best for:** Showing that clearance level is enforced, not just "logged in."

| Persona | Prompt | Outcome |
|---|---|---|
| Sarah Williams | `What intercepts are flagged in the SIGINT collection summary?` | ✅ Granted — returns corpus with COLLECTION-ALPHA/BRAVO, TARGET-7 |
| James Rivera | `What intercepts are flagged in the SIGINT collection summary?` | ❌ Denied — requires clearance:ts-sci + mission:intel |
| Sarah Williams | `Give me the Q3 threat briefing highlights.` | ✅ Granted — VECTOR ALPHA/BRAVO/CHARLIE |
| James Rivera | `Give me the Q3 threat briefing highlights.` | ❌ Denied — requires clearance:ts-sci |

**Talk track:** "Same query. James is Secret-cleared, which is the right level for his role. But this corpus is TS/SCI. The policy check runs before the model sees anything — the document was never loaded."

---

## Scenario 2 — Compartment Enforcement (Same Clearance, Different Mission)

**Best for:** Showing that clearance alone isn't enough — mission attribute gates access too.

| Persona | Prompt | Outcome |
|---|---|---|
| Patricia Lee | `What are the details of the UCMJ Article 32 investigation?` | ✅ Granted — case file, LTC Williams, SSgt. Morales |
| Sarah Williams | `What are the details of the UCMJ Article 32 investigation?` | ❌ Denied — lacks mission:legal |
| Marcus Johnson | `What does the infrastructure security audit show?` | ✅ Granted — CVEs, firewall gap, remediation status |
| Patricia Lee | `What does the infrastructure security audit show?` | ❌ Denied — lacks mission:cyber |
| Sarah Williams | `What does the infrastructure security audit show?` | ❌ Denied — lacks mission:cyber |

**Talk track:** "Sarah has higher clearance than Patricia. But she doesn't have the legal compartment, so she's blocked from a document Patricia can read. Clearance is necessary but not sufficient."

---

## Scenario 3 — Coalition / Releasability (REL TO FVEY / NATO)

**Best for:** Showing how relto attributes control cross-coalition sharing.

| Persona | Prompt | Outcome |
|---|---|---|
| James Rivera | `What did the FVEY partners contribute to the joint maritime assessment?` | ✅ Granted — GBR/CAN/AUS/NZL contributions |
| Emma Clarke (UK) | `What did the FVEY partners contribute to the joint maritime assessment?` | ✅ Granted — same corpus |
| Henri Dubois (FR) | `What did the FVEY partners contribute to the joint maritime assessment?` | ❌ Denied — lacks relto:fvey (France is NATO only) |
| Marcus Johnson | `What is the NATO joint ops plan for Operation COASTAL SHIELD?` | ✅ Granted — Phase II objectives, allied force posture |
| James Rivera | `What is the NATO joint ops plan for Operation COASTAL SHIELD?` | ❌ Denied — James has relto:fvey but not relto:nato |
| Henri Dubois (FR) | `What is the NATO joint ops plan for Operation COASTAL SHIELD?` | ✅ Granted — France is NATO |

**Talk track:** "Henri can see the NATO plan but not the FVEY exchange. James is the reverse. The policy mirrors exactly how releasability marking works on a classified document — the attribute IS the marking."

---

## Scenario 4 — PHI / Medical Records

**Best for:** Showing the same enforcement model applies outside the IC context (healthcare, HIPAA).

| Persona | Prompt | Outcome |
|---|---|---|
| Any USA persona | `What is the status of patient Jane Doe from MCI case 47?` | ✅ Granted — ICU status, treatment notes |
| Henri Dubois (FR) | `What is the status of patient Jane Doe from MCI case 47?` | ❌ Denied — lacks relto:usa (foreign national) |
| Klaus Richter (DE) | `What is the status of patient Jane Doe from MCI case 47?` | ❌ Denied — lacks relto:usa |
| Emma Clarke (UK) | `What is the status of patient Jane Doe from MCI case 47?` | ❌ Denied — lacks relto:usa |

**Talk track:** "Same model, different domain. PHI is USA-only. Any foreign national is blocked regardless of clearance. Virtru's policy layer doesn't care what application is asking — the attribute check is universal."

---

## Scenario 5 — Open / General Queries (No Classification)

**Best for:** Showing the assistant is genuinely useful, not just a policy blocker.

| Persona | Prompt | Outcome |
|---|---|---|
| Any | `How does the KAS enforce policy on every decrypt?` | ✅ Answers from OPEN_CORPUS — TDF, KAS, live entitlement check |
| Any | `What is TDF and how does it differ from traditional encryption?` | ✅ Explains TDF format, bound policy, AES-256-GCM |
| Any | `How do subject mappings work in the DSP?` | ✅ Explains IdP → KAS → attribute resolution flow |
| Any | `What happens if someone loses their clearance?` | ✅ Explains live KAS check — existing files become inaccessible instantly |

---

## High-Impact Demo Sequences

### "Same Question, Different Outcome" (60 seconds)
1. Select **Sarah Williams**
2. Ask: `What intercepts are flagged in the SIGINT collection summary?`
3. Watch streaming response with classified corpus content
4. Switch to **James Rivera**
5. Ask the exact same question
6. Watch natural-language denial — corpus never loaded

### "Compartment vs Clearance" (90 seconds)
1. Select **Patricia Lee**
2. Ask: `What are the details of the UCMJ Article 32 investigation?`
3. Granted — legal corpus streams
4. Switch to **Sarah Williams** (higher clearance)
5. Ask the same question
6. Blocked — higher clearance, wrong compartment

### "Coalition Boundary" (60 seconds)
1. Select **James Rivera**
2. Ask: `What did the FVEY partners contribute to the joint maritime assessment?`
3. Granted — relto:fvey satisfied
4. Switch to **Henri Dubois**
5. Same question → blocked (no relto:fvey)
6. Ask: `What is the NATO joint ops plan for Operation COASTAL SHIELD?`
7. Granted — relto:nato satisfied

---

## Notes for the Demo Presenter

- **Typing indicator** appears while the policy check runs — useful to narrate "this is the enforcement happening in real time"
- **Policy Details panel** (right side) updates after every query — shows verdict, required attributes with ✓/✗ per attribute, and the full corpus access map for the current persona
- Blocked messages are delivered as natural AI prose — not error banners — so the experience feels like a real assistant that simply can't help, rather than a broken UI
- Switching personas resets the conversation but preserves the corpus access map so you can compare personas side by side
