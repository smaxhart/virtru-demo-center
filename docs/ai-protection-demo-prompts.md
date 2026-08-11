# AI Protection Demo — Prompt Guide

Each query below is copy-pasteable into the AI Protection chat page.
The **Outcome** column states what actually happens based on the policy engine, not the LLM.

---

## Personas & Their Entitlements

| Persona | Clearance | Mission | Nationality / COI |
|---|---|---|---|
| Maj. Sarah Williams | TS/SCI | mission:intel | USA (FVEY + NATO) |
| CPT. James Rivera | Secret | mission:external | USA (FVEY + NATO) |
| Col. Patricia Lee | Secret | mission:legal | USA (FVEY + NATO) |
| CW3 Marcus Johnson | Secret | mission:cyber | USA (FVEY + NATO) |
| Flt Lt Emma Clarke (UK) | Secret | — | GBR (FVEY + NATO) |
| Maj. Henri Dubois (FR) | Secret | — | FRA (NATO only) |
| Maj. Klaus Richter (DE) | Secret | — | DEU (NATO only) |

**COI model:** Coalition access is derived from `nationality`, not a personal `relto` grant.
`REL TO FVEY` = nationality is one of USA, GBR, AUS, NZL, CAN.
`REL TO NATO` = nationality is any of the 32 NATO member states.

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

**Best for:** Showing how nationality-based COI membership controls cross-coalition sharing.

| Persona | Prompt | Outcome |
|---|---|---|
| James Rivera | `What did the FVEY partners contribute to the joint maritime assessment?` | ✅ Granted — GBR/CAN/AUS/NZL contributions |
| Emma Clarke (UK) | `What did the FVEY partners contribute to the joint maritime assessment?` | ✅ Granted — same corpus |
| Henri Dubois (FR) | `What did the FVEY partners contribute to the joint maritime assessment?` | ❌ Denied — FRA nationality not in FVEY |
| Marcus Johnson | `What is the NATO joint ops plan for Operation COASTAL SHIELD?` | ✅ Granted — Phase II objectives, allied force posture |
| James Rivera | `What is the NATO joint ops plan for Operation COASTAL SHIELD?` | ✅ Granted — USA is NATO member |
| Henri Dubois (FR) | `What is the NATO joint ops plan for Operation COASTAL SHIELD?` | ✅ Granted — France is NATO |

**Talk track:** "Henri can see the NATO plan but not the FVEY exchange. The policy doesn't ask 'has someone granted Henri FVEY access?' — it asks 'is his nationality in the FVEY member list?' France isn't. The attribute IS the marking."

---

## Scenario 4 — PHI / Medical Records (Tiered Access)

**Best for:** Showing the same enforcement model applies outside the IC context, and that a single record can have multiple tiers with different policies.

| Persona | Prompt | Outcome |
|---|---|---|
| Patricia Lee | `What is the status of patient Jane Doe from MCI case 47?` | ✅ Full record — PII + treatment notes + legal hold details |
| Sarah Williams | `What is the status of patient Jane Doe from MCI case 47?` | ✅ Status only — identity withheld, mission:intel satisfies NTK tier |
| Marcus Johnson | `What is the status of patient Jane Doe from MCI case 47?` | ✅ Status only — mission:cyber satisfies NTK tier |
| James Rivera | `What is the status of patient Jane Doe from MCI case 47?` | ❌ Denied — mission:external satisfies neither tier |
| Henri Dubois (FR) | `What is the status of patient Jane Doe from MCI case 47?` | ❌ Denied — no mission attribute satisfies either tier |

**Tiers:**
- **Full Record (PII + Treatment):** requires `mission:legal`
- **Status Only (No PII):** requires `mission:intel` or `mission:ops` (need-to-know)
- No match → full denial

**Talk track:** "Patricia gets the full record with PII — she's JAG. Sarah gets a redacted status report — she's intel, need-to-know for operational impact, but not PII. James gets nothing. Same query, same document, three different responses based purely on entitlements."

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
1. Select **Emma Clarke (UK)**
2. Ask: `What did the FVEY partners contribute to the joint maritime assessment?`
3. Granted — GBR is in FVEY
4. Switch to **Henri Dubois (FR)**
5. Same question → blocked (FRA not in FVEY)
6. Ask: `What is the NATO joint ops plan for Operation COASTAL SHIELD?`
7. Granted — FRA is NATO

### "Tiered Record" (90 seconds)
1. Select **Patricia Lee**
2. Ask: `What is the status of patient Jane Doe from MCI case 47?`
3. Full record — name, SSN, treatment notes, legal hold
4. Switch to **Sarah Williams**
5. Same question → status only, identity withheld
6. Switch to **James Rivera**
7. Same question → full denial

---

## Notes for the Demo Presenter

- **Typing indicator** appears while the policy check runs — useful to narrate "this is the enforcement happening in real time"
- **Policy Details panel** (right side) updates after every query — shows verdict, required attributes with ✓/✗ per attribute, and the full corpus access map for the current persona
- **Tiered topics** (patient record) show an ACCESS TIERS ladder in the policy panel — each tier's match/no-match is visible
- Blocked messages are delivered as natural AI prose — not error banners — so the experience feels like a real assistant that simply can't help, rather than a broken UI
- Switching personas resets the conversation but preserves the corpus access map so you can compare personas side by side
- **COI note:** Entitlements panel filters out `nationality:` chips to keep it clean — nationality drives coalition access but is not shown as a card attribute
