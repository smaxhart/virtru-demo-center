# GCAP Demo Script — One Environment, Three Nations

**Status:** DRAFT. The page does not exist yet; every click target below is the *planned* one.
**Runtime:** ~11 minutes (cut list at the bottom gets it to ~8)
**Page:** GCAP — Advanced Collaborative Environment (ACE)
**Narrative:** Interoperability and supply-chain management for a three-nation fighter programme, with data sovereignty as the spine — and a competitor, a compromised supplier, and a platform administrator as the three ways it could go wrong.

**Markings are illustrative.** The equivalences (GCAP SECRET ≈ UK SECRET / IT SEGRETO / JP 秘, and so on) were written from memory and have not been checked by anyone from a partner nation. Do not show them to a UK, Italian or Japanese audience until someone has.

---

## The Scenario

The UK, Italy and Japan are jointly developing a sixth-generation fighter. The three governments fund it through the GCAP agency (GIGO). **Edgewing** is the design authority; **BAE Systems**, **Leonardo** and **Mitsubishi Heavy Industries** build to its design; a long tail of Tier-2 and Tier-3 suppliers build to theirs.

All of them work in one **Advanced Collaborative Environment** — a shared digital workspace so that people at different clearances, in different nations, at different tiers of the supply chain can work on the same programme without a copy of the data in every enclave.

That is the hard part, and it is where the demo lives: **one workspace, two programme levels (GCAP RESTRICTED, GCAP SECRET), each nation's own clearances on top, and data that one nation will never share with the other two.**

Every file in ACE is an encrypted object. The workspace is the same for everyone. **What you can see in it is what the data lets you see** — a file you can't open isn't greyed out, it isn't there.

---

## How to Read the Screen

- **The tree is trimmed by policy.** A persona's file tree lists only what they can open. There are no padlocks and no "restricted" placeholders, because a file's *name* is intelligence.
- **The counter shows what you can see, never the total.** "9 objects" — not "9 of 14." A total would tell a competitor how much they're missing. (COP shows "X of Y"; this page deliberately doesn't.)
- **Probe by link.** A **Probe** box takes a file link, as if someone forwarded it in an email. It asks the KAS directly, bypassing the tree, so a refusal proves the data said no and not just the UI. The **custody panel** names which nation's custodian released or refused, and every probe lands in the audit log.
- **Auditor view (presenter only).** A presenter shortcut — not a persona, not a nav item, unreachable from any seat — opens a persona × document grid of all 14 documents, showing who can open what. It is the proof that files were hidden rather than absent, and it is computed from the same policy decisions as the tree, never typed in. See Act 6 and "When Someone Asks".
- **The trim and the open share one decision path.** The tree is not filtered by a separate client-side list; it is built from the same policy decision that gates opening.

---

## Personas Used

| Persona | Employer | Nation / tier | Sees | What they show |
|---|---|---|---|---|
| **Marco Bellandi** | Edgewing (design authority) | ITA · GCAP SECRET · all work packages | 9 | The broadest view — and a tree with no UK or Japanese sovereign files in it |
| **Harriet Lowe** | GIGO (programme security) | GBR · national TOP SECRET | 8 | Programme reach, no sovereign reach into Italy or Japan |
| **Kenji Watanabe** | Mitsubishi Heavy Industries | JPN · GCAP SECRET | 7 | Japan is in GCAP, not NATO |
| **Priya Nair** | BAE Systems | GBR · GCAP SECRET · sensors | 6 | Same nation as Harriet, lower tier |
| **Oliver Hartley** | Edgewing (funding controller) | GBR · GCAP RESTRICTED · finance | 4 | Money without design |
| **Giulia Ferraro** | Leonardo (export) | ITA · GCAP RESTRICTED · export | 4 | Authority is not rank |
| **Wren Castellan** | Tier-2 supplier | GBR · GCAP RESTRICTED · airframe | 3 | Gets the interface extract, not the design |
| **Owen Pryce** | Tier-3 supplier | GBR · GCAP RESTRICTED · airframe | 2 | The compromised credential |
| **Sanjay Rao** | Edgewing IT (ACE administrator) | GBR · unclassified · admin | 2 | Runs the platform, sees almost none of it |
| **Ryan Mercer** | A competing prime | USA · unclassified | 1 | Authenticated, sees one file |

Counts are tree items. The interface control document is one item whose contents depend on who opens it (see Act 3).

---

## Pre-Demo Setup

1. Open the Virtru Demo Center → **GCAP** page.
2. Reset the scenario (clears the compromise and revocation state).
3. Set the active persona to **Marco Bellandi**.
4. Confirm the custody panel and the **Probe** box are visible.

---

## ACT 1 — One Workspace, Many Clearances (1.5 min)

**Setup line:**
> "This is ACE — the shared environment three nations and a few hundred companies build an aircraft in. The hard requirement is that people at different clearances, in different countries, work in the *same place*. The usual answer is separate enclaves and copying data between them. Here there's one workspace, and every file in it decides for itself who can see it."

**Point at Marco's tree and counter**
> "Marco sees nine objects. There are more in the programme — I'll show you what happens to them."

**Click Programme Overview**
> "Public. Anyone authenticated opens it. A system that only ever says no proves nothing."

**Click GIGO Governance & Workshare Summary**
> "GCAP RESTRICTED. That's the programme's own marking. Underneath it, what each partner nation calls the same level: OFFICIAL-SENSITIVE in the UK, RISERVATO in Italy, 取扱注意 in Japan. Marco holds an Italian clearance, and ACE reads it as GCAP SECRET."

**Click Common ICD** (opens the full tier)
> "Marco is the design authority at Edgewing, so he opens the full interface control document. The marking is a rendering of the policy — it isn't typed on the file, so it can't disagree with what's enforced."

---

## ACT 2 — The Sovereign Wall (2 min)

**Setup line:**
> "Marco is the most powerful person in this workspace. He sees the whole design. Look at what his tree *doesn't* contain."

**Point at Marco's tree**
> "No UK electronic-warfare library. No Japanese range plan. They aren't greyed out — they aren't there. Marco can't tell they exist."

**Paste the UK EW library link into Probe**
> "Say someone forwarded him the link. The KAS refuses — and look at the custody panel: the *UK custodian* said no. Not Edgewing, not ACE. The nation that owns the data. And that attempt is now in the audit log."

**Switch persona to Harriet Lowe (GIGO security)**
> "Harriet runs programme security for all three governments. Her clearance is national TOP SECRET."

**Point at Harriet's tree**
> "The UK EW library has appeared — she's British, she holds the sensors work package, the UK custodian agrees. And the Japanese range plan is still absent."

**Paste the Japan range-plan link into Probe**
> "Refused — by the Japanese custodian. Programme-level reach is not sovereign reach. The three governments agreed to share a programme; they did not agree to share each other's national data, and the environment enforces that even against the people running the programme."

**Switch persona to Kenji Watanabe**
> "Kenji is Japanese, Mitsubishi, propulsion. The Japanese range plan appears in his tree."

**Switch between Marco and Kenji, watching the NATO Interoperability Paper**
> "The NATO paper is in Marco's tree and not in Kenji's. Japan is in GCAP; Japan is not in NATO. Releasability is a roster of nations, not a club membership — the policy names NATO's members and Japan isn't one of them."

---

## ACT 3 — Interoperability Without Disclosure (1.5 min)

**Setup line:**
> "A supplier has to know enough to make a part that fits. It doesn't need the design."

**Switch persona to Marco → click Common ICD**
> "The full interface control document — GCAP SECRET."

**Switch persona to Wren Castellan (Tier-2 supplier) → click Common ICD**
> "Same item in the tree, same click. Wren is served a different tier — the supplier extract, GCAP RESTRICTED. Dimensions, interfaces, tolerances. Not the design. One object, two releases, decided by who's asking."

**Switch persona to Owen Pryce (Tier-3)**
> "Owen's a Tier-3 machine shop. The interface document isn't in his tree at all — not even the extract. He sees his own work order and nothing above it."

---

## ACT 4 — The Supplier Register (1 min)

**Setup line:**
> "There's one file in here a competitor or an adversary would pay more for than the design."

**Switch persona to Priya Nair (BAE) → click Bill of Materials & Supplier Register**
> "Who supplies what, at every tier. Knowing that is a targeting list for an adversary and a poaching list for a competitor. GCAP SECRET, programme partners only. Priya sees it — she's a partner at the secret tier."

**Switch persona to Wren**
> "Wren is a supplier. It isn't in her tree. Suppliers know their own tier; they don't get the map of everyone else — and they don't get to know the map exists."

---

## ACT 5 — Money Without Design (1 min)

**Setup line:**
> "Edgewing is paid by the governments through GIGO, and it draws that funding down through a portal. Budgets, milestone payments and workshare percentages are commercially sensitive — and the person who runs the money shouldn't be reading the design."

**Switch persona to Oliver Hartley**
> "Oliver is Edgewing's funding controller. His tree has four things: the overview, the governance summary, the Funding Drawdown Schedule, and the supplier extract of the interface document. No engine report, no sensor spec."

**Switch persona to Marco**
> "And Marco, the design authority with the broadest view in the building, has no Funding Drawdown Schedule. Design and money are separate inside the same JV, and the data enforces it."

**Switch persona to Giulia Ferraro**
> "One more: whether GCAP can be sold to a third country. The Third-Country Export Assessment is in Giulia's tree — she's Leonardo's export lead — and not in Marco's. Marco outranks her. Rank isn't need."

---

## ACT 6 — The Competitor (1 min)

**Setup line:**
> "A competing prime gets a login. Maybe a shared-supplier relationship, maybe a mistaken invite. Authenticated is not authorized."

**Switch persona to Ryan Mercer**
> "One object. The public overview. He can't see that there's an engine test report, or a supplier register, or that funding is being drawn down. If this screen showed thirteen padlocks he'd learn exactly what this programme is testing and buying. A file name is intelligence — so the names aren't there."

**Paste the Engine Thermal Test Report link into Probe**
> "And the trim isn't just the UI. If he goes looking for it by link, the KAS refuses — and that attempt is in the audit log. Someone probing for a file they shouldn't know exists is precisely the signal programme security wants to be told about."

**Optional — open the Auditor view (Ctrl/Cmd+Shift+A, Esc to close)**
> "If you'd rather not take my word that those files exist, this is the view only the presenter has. Fourteen documents down, ten people across, and the cell is the decision. Ryan's column is one tick. Nobody in this environment can open this screen — not Ryan, not Harriet, not the administrator."

---

## ACT 7 — The Compromise (2.5 min) — centrepiece

**Setup line:**
> "The realistic threat isn't a stranger at the front door. It's a Tier-3 machine shop with a phished password."

**Switch persona to Owen Pryce (the "If it is taken" card is below the viewer)**
> "Owen's credential has been taken by an adversary — valid login, valid token. Everything from here is the attacker, in Owen's shoes."

**Attacker browses the workspace**
> "This is the blast radius. Two objects: the public overview and one work order. There's nothing to walk — they can't enumerate what they can't see, so they can't even map the programme to decide what to go after. The design, the register, the funding, every sovereign file: not in the tree."

**Click "Copy files to an unmanaged device"**
> "They copy what Owen can see to a laptop of their own. On that machine the policy is readable — it travelled with the file — and the payload is ciphertext."

**Click "Open without identity"**
> "No identity, so the KAS refuses. A copy on its own is worthless."

**Click "Open with stolen credential"**
> "With Owen's stolen credential it opens — the key server released the key, because as far as it knows this is still Owen. This is the real problem, and it is what revocation is for."

**Click "Programme security: revoke Owen", then "Open with stolen credential" again**
> "Programme security withdraws Owen's account. Same file, same credential, same key server — refused. The key was never on the laptop, it lives behind the KAS, and the KAS now says no."

*(Restore Owen or press Reset demo before the next run. One quirk to know: the open-to-everyone overview still opens for a revoked account — its policy is empty, so there is nothing to withhold. Owen's tree drops to one object after revoke, and that is correct.)*

**Open the audit log**
> "And here's exactly what was accessed, when, and by which credential — the record of what they saw before we cut them off."

*(Be ready for: "what if they'd already read it before you revoked?" Answer honestly — a page already decrypted and saved in plaintext is outside the policy's reach; the audit log is what bounds the exposure, and the blast radius is why it was two files and not fourteen.)*

*(Be ready for: "what about a token they already hold?" The revoke happens at the identity provider — the account's grants are withdrawn, so every new token and every new rewrap is refused. A bearer token already issued stays valid until it expires (an hour in this build), which is why token lifetimes are short and why the audit log matters. The demo mints a fresh token on every operation, so the cut looks instant; say so if asked.)*

---

## ACT 8 — The Administrator (1 min)

**Setup line:**
> "Last threat: the people who run ACE."

**Switch persona to Sanjay Rao (ACE administrator)**
> "Sanjay keeps the platform running. Root on the environment. His tree has two things: the public overview and the ACE Access & Key-Custody Log."

**Click ACE Access & Key-Custody Log**
> "What he can see is the operational record — who touched what, which custodian released it. Metadata, not content. Every design, funding and sovereign file is absent. Running the platform is not access to its data. That's the same answer for a cloud provider, a compromised admin account, or a subpoena served on the operator."

---

## Close (0.5 min)

> "One workspace. Two programme levels and three nations' clearances in it. Each nation keeps custody of its own data. A supplier learns its tier, a competitor sees one file, a stolen credential costs two objects, and the administrator can't read any of it. None of that is a separate enclave. It's the data."

---

## When Someone Asks

- **"How do I know those files are really there?"** Open the Auditor view. The grid is built from the live policy decisions, so a hidden file shows as a hidden file, not as a missing one.
- **"Who can see the auditor view?"** Only the presenter. It is deliberately not a role in the demo, because a role would be an attribute someone could hold.
- **"Can a competitor tell the programme is bigger than what they see?"** Not from the tree or the counter, and a probe for a specific file is refused and logged. What they can know is only what they can already guess.

## What Not to Claim

- **Not an accreditation.** This shows the enforcement mechanism. It does not replace accredited enclaves or a cross-domain solution, and it has not been approved by any of the three governments.
- **Custody is simulated.** The "UK custodian / Italian custodian / Japanese custodian" panel is a model of per-nation key custody on a single platform. If asked, say so, and that per-nation key servers are the real mechanism.
- **Trimming is not secrecy of the policy.** It hides *which files exist for a persona*. It does not hide that a programme exists or that ACE has a policy engine.
- **Markings are illustrative** (see the top of this file).
- **No attribution, no named competitor.** The compromise is "an adversary" and the competitor is "a competing prime." Do not name a state or a company on screen or in the room.

## If You're Short on Time

Cut Act 5 and Act 8 (~8 min). Act 4 folds into Act 3 by opening the register in the same persona switch. Never cut Act 2 or Act 7.

## Build Notes (feasibility check, 2026-10-05)

- **Trimmed listing = one live KAS rewrap per document**, kept if it succeeds. Same call as opening, so trim and open cannot disagree. There is no catalog endpoint; `getEntitlements` is per-FQN and is not used. A persona switch costs ~14 rewraps against cached clients.
- **Unmanaged device** = the raw `.tdf` bytes plus `inspectZtdf` (ciphertext and manifest, no identity). "Open with the stolen credential" is a normal rewrap as Owen.
- **Revoke** = withdraw the identity's grants in the local token issuer; the next rewrap of the copy is refused by the real KAS. Collaborate has no revoke, so this is new (one IPC handler, plus restore on reset).
- **Auditor view** = the same rewrap loop across all 10 personas (140 attempts); it is also this page's matrix check.
- **Custody panel is simulated**: a per-document `custodian` field, pluggable so real per-nation key servers can replace it.
