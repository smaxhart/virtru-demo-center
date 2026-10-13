# GCAP Demo Script — One Environment, Three Nations

**Status:** All three tabs are built; see "The Three Pages" for how they fit together. Markings still need partner review.
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
- **The counter shows what you can see, never the total.** "7 objects" — not "7 of 18." A total would tell a competitor how much they're missing. (COP shows "X of Y"; this page deliberately doesn't.)
- **Probe by link.** A **Probe** box takes a file link, as if someone forwarded it in an email. It asks the KAS directly, bypassing the tree, so a refusal proves the data said no and not just the UI. The **Where the key came from** panel draws the request as a line from the person to the custodian that answered: solid blue with a tick when released, dashed red with a cross when refused. Every probe lands in the audit log.
- **Auditor view (presenter only).** A presenter shortcut — not a persona, not a nav item, unreachable from any seat — opens a persona × document grid of all 18 documents, showing who can open what. It is the proof that files were hidden rather than absent, and it is computed from the same policy decisions as the tree, never typed in. See Act 6 and "When Someone Asks".
- **The trim and the open share one decision path.** The tree is not filtered by a separate client-side list; it is built from the same policy decision that gates opening.

---

## Personas Used

| Persona | Employer | Nation / tier | Sees | What they show |
|---|---|---|---|---|
| **Marco Bellandi** | Edgewing (design authority) | ITA · GCAP SECRET · all work packages | 7 | The broadest view — and a tree with no UK or Japanese sovereign files in it |
| **Harriet Lowe** | GIGO (programme security) | GBR · national TOP SECRET | 7 | Programme reach, no sovereign reach into Italy or Japan |
| **Kenji Watanabe** | Mitsubishi Heavy Industries | JPN · GCAP SECRET · MHI IP | 8 | Japan is in GCAP, not NATO — and MHI's own IP |
| **Priya Nair** | BAE Systems | GBR · GCAP SECRET · sensors · BAE IP | 7 | Same nation as Harriet, lower tier — and BAE's own IP |
| **Oliver Hartley** | Edgewing (funding controller) | GBR · GCAP RESTRICTED · finance | 4 | Money without design |
| **Giulia Ferraro** | Leonardo (export) | ITA · GCAP RESTRICTED · export · Leonardo IP | 6 | Authority is not rank — and Leonardo's own IP |
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
4. Confirm the **Where the key came from** panel and the **Open by address** box are visible.

---

## ACT 1 — One Workspace, Many Clearances (1.5 min)

**Setup line:**
> "This is ACE — the shared environment three nations and a few hundred companies build an aircraft in. The hard requirement is that people at different clearances, in different countries, work in the *same place*. The usual answer is separate enclaves and copying data between them. Here there's one workspace, and every file in it decides for itself who can see it."

**Point at Marco's tree and counter**
> "Marco sees seven objects. There are more in the programme — I'll show you what happens to them."

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
> "Say someone forwarded him the link. The KAS refuses — and look at the key route: the line stops at the UK with a red cross. The *UK custodian* said no. Not Edgewing, not ACE. The nation that owns the data. And that attempt is now in the audit log."

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

## ACT 5b — Company IP (1.5 min)

**Setup line:**
> "Three companies build this aircraft, and they are partners and competitors at the same time. Each one has work it will not hand to the other two. That isn't a programme marking and it isn't a nation — it's whose intellectual property the file is."

**Point at the Company IP folder as Priya Nair (BAE)**
> "Priya sees two files here: the sensor fusion specification and the radar aperture calibration method. Both are marked BAE IP. She's BAE; they're hers to open."

**Switch persona to Kenji Watanabe (MHI)**
> "Kenji's Company IP folder is different. Engine thermal report, hot-section coating process — MHI IP. Not one of BAE's files is here, and he has no way to tell they exist."

**Switch persona to Giulia Ferraro (Leonardo)**
> "Giulia sees Leonardo's mission-computer architecture and defensive-aids notes. And she's at the lowest programme tier of the three — the company wall is a separate rule from rank."

**Switch persona to Marco Bellandi**
> "And Marco, the design authority, has none of it. Edgewing integrates the aircraft; it doesn't get to read each company's IP. Same pattern as the sovereign wall, one level down: the data says who it belongs to."

**Paste a BAE file link into Probe as Kenji**
> "Even with the link in hand, the key server refuses. The attempt is in the audit log."

---

## ACT 6 — The Competitor (1 min)

**Setup line:**
> "A competing prime gets a login. Maybe a shared-supplier relationship, maybe a mistaken invite. Authenticated is not authorized."

**Switch persona to Ryan Mercer**
> "One object. The public overview. He can't see that there's an engine test report, or a supplier register, or that funding is being drawn down. If this screen showed seventeen padlocks he'd learn exactly what this programme is testing and buying. A file name is intelligence — so the names aren't there."

**Paste the MHI Engine Thermal Test Report link into Probe**
> "And the trim isn't just the UI. If he goes looking for it by link, the KAS refuses — and that attempt is in the audit log. Someone probing for a file they shouldn't know exists is precisely the signal programme security wants to be told about."

**Optional — open the Auditor view (Ctrl/Cmd+Shift+A, Esc to close)**
> "If you'd rather not take my word that those files exist, this is the view only the presenter has. Eighteen documents down, ten people across, and the cell is the decision. Ryan's column is one tick. Nobody in this environment can open this screen — not Ryan, not Harriet, not the administrator."

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

## The Three Pages

The GCAP page has three tabs. They tell one story at three zoom levels:

| Tab | Question it answers | Time |
|---|---|---|
| **Workspace** | What can each person see, and who holds the key? | ~11 min (Acts 1–8 above) |
| **Three windows** | The file has already left the building. Who can still read it? | ~5 min |
| **A day on the programme** | Programmes change by the hour. Does access keep up? | ~3 min |

**Every visit starts the day fresh.** Opening the GCAP page resets every person, document and revocation to the shipped state, so an edit made in one run never leaks into the next. **Reset demo** does the same on demand.

Suggested run for a 15-minute slot: Workspace Acts 1, 2 and 7 (about 5 min), Three windows in full, A day on the programme to close. Each tab stands alone if you only have one of them.

---

## Tab 2 — Three Windows (~5 min)

**What the audience is looking at.** Meridian SCM is a stand-in for the supply-chain system a programme office lives in: change requests, parts, suppliers, orders. Three people are signed in to it at once, Marco (Rome, Edgewing), Priya (Filton, BAE Systems) and Kenji (Nagoya, Mitsubishi Heavy Industries). **The SCM is mocked. The attached files and every key-server answer are real.** Say that early and once; the page no longer says it for you.

**Who is who on the change request.** CR-4471, *Revise ICD baseline: mission bus, thermal loops, mounting pattern*, is an Integration change. Marco is the design authority and approver. Priya reviews the sensors interfaces, Kenji the propulsion interfaces. Each person's Home tab lists tasks that fit their job, and the Approvals tab shows the same three names. The one attachment is the Common Interface Control Document.

**Screen space.** Press **⌘ \\** (Ctrl+\\ on Windows), or the panel icon beside the page title, to hide the side navigation for the whole demo; press it again to bring it back. The choice is remembered.

**Setup.** Open the Three windows tab. All three windows show CR-4471 on its Summary tab. Nothing has been opened yet.

### Beat 1 — Delivered (30 s)

> "The same encrypted file is in all three inboxes. It came through the change request like any attachment. Nothing about this looks like security software."

Point at the shield button in each title bar, or hover it. It lists what the key server holds for that person: clearance, nationality, work packages, supply tier. Marco holds integration; Priya and Kenji do not.

### Beat 1b — The system itself is trimmed (1 min)

Meridian SCM's own tables are not the same for everyone. Every row of Changes, Parts, Suppliers and Orders is an encrypted record with a policy, and a window shows only the rows the key server releases to that person. A row you can't open isn't greyed out; it isn't there, and nothing says how many are missing.

> "This is the supply-chain system, not a document store. Same screen, three people, three different lists. The system doesn't filter anything; each row asks the key server whether you may see it."

Things to show, all from the **Parts**, **Suppliers**, **Orders** and **Changes** tabs:
- **Priya (BAE)** sees the avionics tray assembly (BAE IP); **Kenji (MHI)** sees the coolant fitting and its purchase order (MHI IP); neither sees the other's. Giulia (Leonardo) sees the harness assembly and its order.
- **Suppliers** is the same targeting list as the bill of materials: partners at GCAP SECRET only, and Japan's own suppliers (Kestrel, Okabe) are visible to Japan alone. Marco has four of the six, Kenji all six.
- Switch a window to **Owen Pryce** (Tier-3): parts and orders for his airframe work, no suppliers, no change requests. Switch to **Sanjay** or **Ryan**: every table is empty.
- **Disable an account** (Three windows controls): that person's tables empty out at once, because the key server now refuses every row.

Nuance for Q&A: the SCM data are mock, but each row's visibility is a real key-server decision made at the moment the window asks, so editing someone's access in **Free play** changes their tables too.

### Beat 2 — Opened (1 min)

Press **Open it in every window** (or **Open** on each attachment). Marco gets the **full release**. Priya and Kenji get the **supplier extract**, with the withheld block on their sheets.

> "Same file, three answers. The strip under the banner says what each person was opened on: clearance, nationality and, for Marco, the integration work package. Priya and Kenji were opened on the partner tier."

Switch Priya to **Oliver Hartley** (funding controller) or **Owen Pryce** (Tier-3 machinist) from the name menu to see a narrower answer for the same file. The strip shows what they were opened on, or, if refused, each attribute the file asks for with a ✗ and what they actually hold.

### Beat 3 — Proof it is a real TDF (1 min)

Press the **ⓘ** on the attachment in any window. The inspector shows the container listing, the policy written inside the file, where the key lives, the manifest, and a hex dump of the ciphertext with the sha256 of the file. **Download the encrypted file** (⤓) saves the actual `.tdf`; **Copy sha256** puts the hash on the clipboard.

> "You can open this in any zip tool. The policy is in the manifest, and the ciphertext is not readable without a key the server releases."

### Beat 4 — Shared on, to someone who isn't in the system (2 min)

The competing prime is **not a user of the SCM**: there is no Ryan Mercer in the name menus. In Marco's window press **Share**, choose **ryan.mercer@rival-prime.example (external email)**, and **Send**. A small "Delivered to an outside inbox" card appears under the windows.

Press **Open Ryan's Outlook** on the card. The scene switches to Ryan's Windows desktop with a new Outlook open on Marco's message and the `.tdf` attachment. **Double-click the attachment**, or use its chevron and choose **Download**, then open **File Explorer**, go to Downloads and double-click the `.tdf`. A Windows dialog appears: **"Error: unable to open file."** with the file name and a generic line that the file is protected and could not be decrypted. The wording is deliberately generic: Ryan's machine cannot know why a key was refused. The refusal itself is the real key server's answer.

Press **Back to the SCM** in Outlook's title bar. Marco's window lands on its History tab, which reads **"Unknown user tried to open Common Interface Control Document · sent by Marco Bellandi"**.

> "This is all Ryan gets: a file he can't open. He isn't a user here, so the system has no name for him, only that someone unknown tried. But it knows exactly who sent it. The copy went. The access didn't, and it's traceable back to the sender."

To take an attachment off the change request, press **✕** on its row. **Copies already shared are unaffected**, and the toast says so; that is the point to make. Each outside mailbox can be closed with its **✕**.

### Beat 4b — The Desktop (3 min, optional)

Press **Desktop** in the Meridian SCM | Desktop switch above the stage. The scene becomes a Windows machine for whoever is selected in **Sitting at** (Marco, Priya, Wren, Ryan). The taskbar carries Outlook and Edge only. Nothing on the desktop is a mock of the key server; every open goes through the real one.

**Presenter drawer.** The **Presenter** button (or Cmd/Ctrl + `.`, Esc to close) slides in the controls the audience doesn't need to see, and remembers whether it was open:

- **Scene.** *Start at the payoff* (default) opens on Priya's desk with Marco's mail already delivered to her and to Ryan, so you begin at the reading. *Fresh start* seats Marco with nothing sent, for composing live (the first bullet below). Picking a scene resets the desktops; **Reset scene** does the same for the current one.
- **Apps on the desktop.** Teams and File Explorer are off the taskbar by default. Tick them to show them; they also appear on their own when the story reaches for them (a download puts Explorer on the taskbar, a Teams post puts Teams there).
- **Pull access.** **Disable X's account** and **Restore** for whoever is selected. Ryan has no account to disable.
- **Under the hood.** Inspect the TDF, **Sit as someone else** for the other seven personas, the live audit log, and the copies-open / refused / disabled counters. Ctrl/Cmd + Shift + A still opens the who-can-open-what matrix.

- **Send protected mail.** As Marco open Outlook, press **New mail**, address it to Priya, attach the Common Interface Control Document (note the "Virtru · Protected" pill) and **Send**. It lands in Sent Items and in Priya's inbox.
- **Secure Viewer.** As Priya, double-click the attachment (or chevron, **Open in Secure Viewer**). Edge opens the Virtru Secure Viewer at `/secureviewer/`, signed in by SSO as Priya. The page carries the marking banner and a watermark of `username / email / name`. Download is on for low levels and switched off for Secret and above ("Download disabled by policy").
- **A refusal, in detail.** As Marco post *GIGO Governance and Workshare Summary* in Teams, then sit as Wren and click it. The viewer shows "Unable to open governance.tdf" and a table of what the file requires against what Wren holds, with a ✗ on the supply tier. Insiders get the detail; outsiders (Ryan) get only the generic dialog.
- **Teams.** Marco's **Attach** menu in the Integration channel posts a protected file as a card. Anyone can click it and it opens in their own Secure Viewer.
- **Pull it.** With a viewer tab open, open the Presenter drawer and press **Disable X's account**. The page dissolves and the tab re-asks, now reading "Your account can no longer decrypt files." **Restore** reverses it.

**Reset demo** and **Start over** clear the desktops, mail, files and chat and return to the SCM stage; the drawer's **Reset scene** does the same but stays on the Desktop.

### Beat 5 — Pulled (1 min)

In the **Account** control under the windows (on the Desktop, **Disable X's account** in the Presenter drawer), pick **Kenji Watanabe** and press **Disable account**. His open sheet dissolves and the window re-asks the key server, which refuses. His shield card now shows his attributes struck through under **Account disabled**. **Restore account** reverses it. The tally under the windows counts copies open, refusals and accounts disabled.

> "We didn't recall the file, and we didn't need to. Disable the account and every copy, wherever it is, stops opening."

### Translate for Italy and Japan

The button at the top right of the page switches Marco's window to Italian and Kenji's to Japanese; Priya's stays in English. Only the application's words change. **Document titles, document text and the classification markings are not translated**, because they belong to the file and to each nation. Toggle it back at any time.

### Free play

Change any window's person from its name menu (Ryan Mercer is deliberately not on it), open a different document (**Document in play**, which also attaches it), or press **Edit X's access** to change a person's attributes and watch open windows re-ask. **Start over** returns to the opening state.

### If asked

- **"Is that a real SCM?"** No. It is a stand-in so the file has somewhere realistic to live. Any system that carries an attachment would behave the same way.
- **"Does the shield show what the token says?"** No. It shows what the platform resolves for the person, which is the same thing the key server uses. The key server does not read token claims and does not cache.
- **"Can Priya see the design rationale in the extract?"** No. The extract is a different encrypted object. The withheld block is a label; the content is not in her file.

---

## Tab 3 — A Day on the Programme (~3 min)

**Run the day** plays four events 3 s apart; **Apply this one** plays any single event. Each event is one change at the identity provider, and the matrix shows only what the key server then answered differently (10 of 190 decisions over the whole day):

| Time | Event | Effect |
|---|---|---|
| 08:12 | Owen's shop is acquired (drops Tier-3) | Owen loses the work order |
| 10:47 | Wren's account is compromised (revoked) | Wren loses the ICD extract and the work order |
| 13:30 | Priya's clearance lapses to RESTRICTED | Priya loses her BAE sensor files, BoM and the NATO paper |
| 16:05 | Kenji moves to integration | Kenji loses engine and the Japan range plan; his ICD extract becomes the full ICD |

> "Nobody emailed anyone. Four changes at the identity provider, and ten answers changed."

Nuance for Q&A: revoked Wren **still opens the GCAP Programme Overview**, because its policy is empty and needs no entitlement. Say so before anyone else notices.

**Free play.** Click a person's header to edit their attributes, a document's row title to change its policy (the file is re-encrypted; earlier copies keep the old policy), **Add person** to create someone with any access, or any cell to see why. Each edit is a real change to the platform's subject mappings or ciphertext, and takes effect on the very next rewrap: the platform does not cache decisions.

**Bridge back to Three windows.** The 16:05 event is the same move as giving Kenji the integration package. If Three windows is open afterwards, his extract would now be the full release.

---

## What Not to Claim

- **Not an accreditation.** This shows the enforcement mechanism. It does not replace accredited enclaves or a cross-domain solution, and it has not been approved by any of the three governments.
- **Custody is simulated.** The "UK custodian / Italian custodian / Japanese custodian" route is a model of per-nation key custody on a single platform. If asked, say so, and that per-nation key servers are the real mechanism.
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
