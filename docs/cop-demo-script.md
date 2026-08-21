# COP Demo Script — Operation COASTAL SURGE

**Runtime:** ~8 minutes
**Page:** Common Operating Picture (COP)
**Narrative:** Multi-Domain Response — humanitarian, law enforcement, and federal intelligence lanes running in parallel on the same map, each siloed by data-level policy.

---

## The Scenario

Hurricane COASTAL SURGE (Category 4) is tracking NNE toward the Carolina coast, landfall expected within 18 hours. A coordinated multi-agency response is active with three distinct operational lanes:

- **Humanitarian relief** — FEMA, USCG, EMS, medevac
- **Law enforcement** — FBI HRT securing critical infrastructure and evacuation checkpoints
- **Federal intelligence / continuity** — DHS surveillance and USMC QRF supporting the Groton National Coordination Center

Every asset on the map is an encrypted object. The map is public — the *data* enforces the policy.

---

## Personas Used

| Persona | Clearance | Compartment | Partner Access | What They See |
|---|---|---|---|---|
| **CW3 Marcus Johnson** | Secret | cyber | USA + MULTI | Humanitarian + LE lanes |
| **CPT. James Rivera** | Secret | external | USA + FED | Humanitarian + some federal facilities |
| **Maj. Sarah Williams** | TS/SCI | intel (LEI) | USA + FED | Full picture — all three lanes |

---

## Pre-Demo Setup

1. Open the Virtru Demo Center → **COP** page
2. Set active persona to **CW3 Marcus Johnson**
3. Click **▶ Simulate** — confirm the ● LIVE indicator is showing
4. Close any open detail panel

---

## ACT 1 — The Operational Picture (2 min)

**Setup line:**
> "This is a Common Operating Picture for a live multi-agency hurricane response. Every marker on this map is an encrypted object bound to policy at creation time. When I click something, the KAS is making an access decision in real time — not the app, not a permissions check. The data itself decides."

**Click MED-12** (Norfolk mass casualty ambulance)
> "MED-12 is a mass casualty ambulance staging near Norfolk. Marcus can read this — he's Secret-cleared and part of the mutual aid response. Watch the panel: entitlements satisfied, KAS grants access, the payload decrypts."

**Click LIFE FLIGHT 3** (Virginia coast, heading south)
> "Life Flight 3 is a medevac helicopter moving down the coast toward the surge zone. Same story — Marcus has the clearance, the KAS agrees."

**Click the INCIDENT marker** (offshore, hurricane eye)
> "Here's the incident itself — Hurricane COASTAL SURGE, tracked by FEMA Region IV. Mandatory evacuations across six counties. This is LIMITED — anyone with a mutual-aid stake can see the picture."

**Point at the moving icons**
> "These are live positions. The simulation runs at accelerated speed for demo purposes — but every unit is broadcasting telemetry, and every position update is visible to anyone whose entitlements allow it."

---

## ACT 2 — The Law Enforcement Layer (1.5 min)

**Click TACTICAL-7** (Wilmington NC, FBI HRT)
> "Now here's where it gets interesting. TACTICAL-7 is an FBI Hostage Rescue Team. They're not there for flood rescue — they're securing a coastal power substation where civil unrest has been reported at an evacuation checkpoint. This is a law enforcement operation running in parallel with the relief effort."

> "Marcus can see this because he's cleared MULTI — mutual aid. His clearance covers both the humanitarian and the LE lanes."

**Switch persona to CPT. James Rivera**
> "James is Secret-cleared, but FED only — federal agencies, not mutual aid. Watch what happens."

**Click TACTICAL-7**
> "James can't decrypt that. The marker didn't even render on his map. Not the UI — the data itself refused him. He doesn't have the MULTI releasability. The KAS returned a 403."

**Point at the sidebar object count**
> "See the count at the top left — 'X of Y objects accessible.' James is missing several. Not filtered by the app. Filtered by the data."

---

## ACT 3 — Add the Asset Live (2.5 min)

**Switch persona to Maj. Sarah Williams**
> "Sarah is our TS/SCI analyst. She has the full picture — RESTRICTED clearance, LEI compartment, federal releasability. She's going to add a new intelligence asset to this map right now. Live."

**Click + Create Object**

Fill in the form:

| Field | Value |
|---|---|
| Source Type | **AIR UNIT** |
| Classification | **RESTRICTED** |
| Need To Know | **LEI** |
| Releasable To | **FED** |
| Title | `OSPREY 1 — DHS/CBP Maritime Intercept` |
| Latitude | `34.5` |
| Longitude | `-74.8` |
| Unit Name | `Sikorsky HH-60 Jayhawk` |
| Callsign | `OSPREY 1` |
| Agency | `CBP Air and Marine Operations` |
| Unit Type | `Patrol Aircraft` |
| Status | `Active` |
| Speed | `190` |
| Altitude | `8000` |
| Heading | `225` |

**Click 🔒 Encrypt & Place**

> "Sarah just encrypted a field intelligence report — a CBP maritime interdiction aircraft tracking a vessel of interest in the storm corridor. It's now on the map, policy bound, living inside the platform. Watch the banner: RESTRICTED // LEI // REL TO FED. That policy is baked into the file itself."

**Click OSPREY 1** to decrypt and briefly show the payload
> "Sarah can read it — she created it, she has the entitlements. Standard flow."

---

## ACT 4 — The Punchline (1.5 min)

**Switch persona to CW3 Marcus Johnson**
> "Back to Marcus. Look at his sidebar count."

**Point at the accessible count in the top left**
> "OSPREY 1 isn't there. Not hidden by the UI — there's no CSS trick, no filter toggle. Marcus's token went to the KAS, the KAS checked his entitlements against the policy Sarah embedded at encrypt time, and it returned a 403. The marker doesn't render because the data never decrypted."

**Switch to James Rivera**
> "Same for James — he's FED-cleared, but he lacks the LEI compartment. He can see some of the federal facilities but this specific asset is out of reach. Same result: no marker, no data."

**Switch back to Sarah**
> "Only Sarah sees the full picture. Three agencies, one map, three completely different views of the same operational environment. The policy isn't in the app. The policy traveled with the data the moment Sarah hit Encrypt."

---

## Closing Line

> "This is what data-centric security looks like in an operational context. The map doesn't know who's looking at it. The data does. And that's the difference between perimeter security — which fails the moment your data leaves — and Virtru's approach, where the file itself is the boundary."

---

## Backup — Common Questions

**Q: "What happens if a persona's clearance changes?"**
A: The KAS check runs on every decrypt. If Marcus's clearance was revoked right now, every marker he currently sees would disappear on the next refresh — including markers he'd already opened. There's no offline copy of the plaintext.

**Q: "Where does the policy live?"**
A: Inside the TDF file itself — a manifest bound cryptographically to the encrypted payload. You can't strip it, forge it, or modify it without breaking the file. The KAS validates the manifest on every rewrap.

**Q: "Can two agencies see the same object with different content?"**
A: In this demo, no — one object, one payload. But the same policy engine supports content transformation (redaction, tiered payloads) — the Executive Brief and Patient Record demos in this app show that pattern.

**Q: "Does this work at scale?"**
A: Yes. This is a local demo but the exact same platform runs Virtru's production KAS handling millions of decrypts per day across federal and commercial customers.

---

## Asset Inventory (for reference)

**Humanitarian lane:**
- RESCUE 7102 (USCG MH-60T, Cape Cod)
- FEMA-7 (Disaster Assessment UAV)
- LIFE FLIGHT 3 (Medevac, VA coast)
- MED-12 (Norfolk ambulance)
- MEDCMD-3 (Mobile medical command, GA)
- Norfolk Regional EOC
- FEMA Camp Liberty FOB

**Law enforcement lane:**
- TROOPER 9 (NJ State Police, airspace mgmt)
- TACTICAL-7 (FBI HRT, Wilmington NC)

**Federal intelligence / continuity lane:**
- SHADOW 04 (DHS Predator B, Groton overwatch) — SENSITIVE // LEI // FED
- REACH 09 (USMC UH-1Y, Groton QRF) — RESTRICTED // LEI // FED
- FBI JOC Fort Meade Annex — SENSITIVE // LEI // FED
- FEMA National Coordination Center Groton — RESTRICTED // LEI // FED

**Cross-cutting:**
- INCIDENT — Hurricane COASTAL SURGE (LIMITED)
- Patient Record MCI-047 (LIMITED // USA)
