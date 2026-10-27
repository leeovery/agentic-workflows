# Discussion: Onboarding and Permissions

## Context

What a new user meets the first time they open Fumi, and which macOS permissions it asks them for.

The discovery brief framed this topic as a permission wizard: walk the user through obtaining the Accessibility grant the Space-homing APIs were assumed to need, handle the quit-and-relaunch macOS forces after that grant, restore every open fumi across the restart, and set up a storage location on the way. **Two of those three legs no longer exist.** `space-homing` measured that placing the app's *own* windows on another Space requests no TCC grant of any kind, so there is no permission to ask for and no permission-driven relaunch to survive (the restart-and-restore requirement is real but owned by `restart-and-restore` under `engine-architecture`, driven by Sparkle updates). `storage-and-sync` fixed the store at `~/Library/Application Support/Fumi/`, so there is no folder to pick.

What remains is a first run that carries two choices and one system dialog, and a set of open questions about how they are presented. *(As of 2026-09-16 those are carried by a short wizard rather than a single screen — see* First Run Shape*.)*

**Inherited position — settled with the user during research, carried forward as working ground rather than re-opened:**

- **The framing stance.** Recommend sync, frame it on what sync gives, do not dramatise what declining costs. Not flat-neutral and not loss-framed. (Supersedes an earlier flat-neutral call made the same day.)
- **The no-account face.** When iCloud is not signed in, the sync option is simply disabled with a note — it is not Fumi's job to sign anyone in. Reactive on sign-in, skippable, reactivatable later. Restricted/MDM-disabled accounts are scoped out as a population Fumi designs for.
- **Launch at login.** Offered, recommended, conventionally worded. Declining is unremarkable and unpunished. The "keep your fumis on your desk" framing was put up and rejected — Fumi is an app, and not running is not a failure state.
- **The notification ask.** Unconditional, once, during setup, for everyone. Not conditioned on the sync decision in any direction, and deliberately under-explained — *"they're just notifications, it's pretty standard stuff."* Not framed on backup.
- **The first-delete education is education, not safety.** A denied notification permission is never grounds for first run to ask harder.

**Platform ground established by research** (deep-dive-001 and in-session lookups, documentary rather than measured):

- The notification one-shot is spent by *asking*, not by elapsed time. A never-asked app can raise the dialog whenever it likes; Apple actively recommends deferring. `status-and-alerts`' claim that a deferred ask is foreclosed is false.
- A never-asked app has **no row** in System Settings ▸ Notifications, so "route the user to System Settings" copy is wrong for the never-asked state in a way it is not wrong for the denied state. (Inference from convergent sources, uncited by Apple.)
- `CKAccountChanged` makes the sync screen reactive on sign-in — but it is posted *by a live `CKContainer` instance*. Hold no reference and the app is never told.
- Sparkle's own documentation recommends requesting notification authorisation inside `updater(_:willScheduleUpdateCheckAfterDelay:)` — following that pattern would spend Fumi's one prompt at an updater-scheduled moment instead of during first run.

**Carried as measurements, not decisions:** whether a CloudKit private-database app appears in System Settings' iCloud app list (so a user could switch Fumi's sync off while the account stays available).

### Visual references

Raycast's onboarding, captured by the user 2026-09-16 from their own install, stored under `imports/`:

- [`raycast-permissions-screen.png`](../imports/raycast-permissions-screen.png) — a permissions page: a left-hand title block (*"Unlock the full potential"*, with a short line under it) and a right-hand list of rows, each an icon, a name, a one-line description, and a control on the right. Open at Login is a toggle; the three TCC grants show state (*Access Granted*) rather than a switch, with *Required* called out under the one that is. **What the user liked**: the way it shows the permissions.
- [`raycast-cloud-sync-screen.png`](../imports/raycast-cloud-sync-screen.png) — sync as its own full page: a large piece of product imagery, the title *Cloud Sync*, a two-line explanation of what it does, one large centred toggle, and a smaller line underneath saying what turning it on means and that it can be configured later. **What the user liked**: the centralised treatment — big toggle, simple explanation — and confirmed it as what they had been envisioning. **Not adopted**: the dark treatment. Fumi's is light — fumis are meant to read light, fluffy and cloudy.

Both are pages of Raycast's own multi-step wizard (its page indicator shows roughly eight steps). Seeing them is what moved this topic from a single configuration screen to a short wizard of its own — see *First Run Shape*'s 2026-09-16 entry.

Dockset's onboarding, captured by the user 2026-09-17 from a custom-Dock app and landed during research — eleven screenshots under `imports/`, of which three carry decisions here:

- [`dockset-01-explore.jpeg`](../imports/dockset-01-explore.jpeg) — the opening page. The app icon centred, *"Explore Dockset."* in a large serif, two lines of explanation under it, and the product's own widgets scattered loose around the frame at slight angles. Step indicator bottom-left, primary action bottom-right. **Taken**: the treatment, for the intro step — the product showing itself rather than describing itself.
- [`dockset-02-tour-profiles.jpeg`](../imports/dockset-02-tour-profiles.jpeg) — a tour page. A category chip, a two-line serif title and a one-line explanation on the left, then three selectable feature rows — icon, name, one-line description — with the selected feature animating inside a real desktop frame on the right. **Taken**: the layout, for the walkthrough's first page. **Not taken**: the reading that the rows advance on a timer — see *Wizard Step Content*.
- [`dockset-04-essentials-colour.jpeg`](../imports/dockset-04-essentials-colour.jpeg) — *"Start with your essentials"*: a name field, a row of ten colour swatches with the current one ticked, then two dropdowns and a checkbox. **Taken**: that a personalisation step exists and shows the swatches. **Not taken**: the name field and the dropdowns — see *Personalisation Step*.

The remaining eight are a longer wizard than Fumi needs (its indicator shows roughly nine steps) and are described in full in the research record. One of them reopened a different topic: the user's reaction to Dockset's material page — frosted glass presented with a browser window refracting behind it — was rerouted to `note-window` on 2026-09-17 as a case for reintroducing frosted glass with a version-dependent fallback. That is the note surface's material, not first run's.

### References

- `.workflows/fumi/discovery/briefs/onboarding-and-permissions.md` — the discovery brief (premise since superseded)
- `.workflows/fumi/research/onboarding-and-permissions.md` — completed research, including deep-dive-001 on the notification one-shot
- Adjacent decided topics inherited rather than reopened: `space-homing`, `engine-architecture`, `platform-support`, `note-window`
- Adjacent in-flight topics this depends on: `storage-and-sync` (store location, sync toggle, account binding), `status-and-alerts` (what notifications carry), `commercialization` (premium mechanics), `management-window` (where sync is reactivated)

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. The Discussion Map lives in the manifest, not this file.*

---

## Enabling Sync Later

### Context

Research handed this over as *"the largest hole"* — the surface where a user turns sync on after declining it at first run. The argument: `storage-and-sync` binds a local-only store to the first account that enables sync, so a user who declined *because* the Mac was signed into an Apple ID they did not want their notes on could bind a year of notes to it by flipping a toggle without reconsidering. That surface does not exist in any topic's record, and the risk lands there rather than on the first-run screen.

### Journey

The session opened on this as the place to start and put three routes up: name the account at the point of enabling; name it at both ends; or reroute the whole thing to `management-window`.

**The user rejected the premise, and the rejection holds.** The scenario is a mechanism, not a situation anyone is in. Nobody has a "work Apple ID" — companies that issue Macs generally allow sign-in with a personal Apple ID, and multiple Apple accounts on one Mac is not the shape a normal user has. Where it does happen it is the user's own arrangement to manage, and no comparable app designs a screen state for it.

The tell that this was invented rather than found: it is a solution looking for a problem. The binding fact is real and stays in `storage-and-sync`'s record where it belongs; what does not follow from it is a first-run obligation.

**What that leaves.** Strip the account risk and the subtopic has no first-run content at all. *Where* you turn sync on later is the settings surface — the sync toggle `storage-and-sync` ships default-off — and that surface belongs to `management-window`. Nothing is owed to it: the toggle is already its subject, and this topic was never adding a requirement to it. No reroute fires.

### Decision

> **Out of scope. First run says nothing about which Apple ID sync would bind to, at either end, and this topic owns no reactivation surface.**

The wrong-account binding case is not a population Fumi designs for — the same ruling that scoped out restricted and MDM-managed accounts during research, applied to the same instinct. Turning sync on later is the management window's toggle doing its ordinary job.

*Sibling check: storage-and-sync — its 2026-07-22 account-handling entry holds that the local-only store binds to the first account that enables sync. Untouched; this decision declines to build a first-run surface on top of it, and asserts nothing about the binding itself. management-window — the settings surface carrying the sync toggle is already its subject, and a brief from this topic's research is already queued there (`where-sync-is-turned-on-after-first-run`, 2026-09-15) asking it to settle the sync control, among other preferences. That brief argues from the wrong-account scenario this decision rejects and leans toward naming the Apple ID on the control. A correction was delivered rather than left standing — see the amendment below.*

*(Amended 2026-09-15 — this section originally recorded "nothing added, nothing routed" for `management-window`, which was false: research had already queued the brief named above. Surfaced by review-001 F6. A corrective concern was delivered to that topic the same day, superseding the brief's wrong-account motivation, its lean toward naming the Apple ID, and its now-stale statement that the sync toggle defaults off.)*

---

## First Run Shape

### Context

What a new user meets between double-clicking Fumi for the first time and writing their first fumi. The discovery brief called it a wizard, but that word described walking someone through obtaining an Accessibility grant — a step that no longer exists. With storage having nothing to set up either, the question is whether there is any first-run surface left at all, and if so how much of one.

*(Amended 2026-09-16 — this opening originally also counted "the pricing model deliberately unexplained" among the things leaving first run empty, citing* Pricing Mention*, which decides no such thing: it is blocked on `commercialization`. Surfaced by review-002 F7. The claim is struck rather than settled — the shape argument never needed it, and the wizard's length is set by the walkthrough and the two configuration steps regardless.)*

### Options Considered

**A. One screen.** Title, two toggles — iCloud sync and open at login, both recommended and both pre-enabled (see *Sync Toggle Default*, which settled the sync side after this section was written) — and Continue. The notification dialog fires on the way out. *(Chosen 2026-09-15, superseded 2026-09-16 — see the Decision's dated entries.)*
- Pros: both toggles carry defaults, so Continue-without-reading is a complete path — one click and you are writing. Each toggle changes how the product behaves, so nothing on screen is ceremony.
- Cons: three decisions, however lightly worn, stand between a new user and their first fumi.

**B. Two beats.** A welcome moment — what Fumi is, one line — then the same screen.
- Pros: a little warmth before the configuration.
- Cons: a click nobody needs twice, in front of a product whose whole pitch is a note that appears instantly.

**C. No screen.** First launch opens a fumi on the desktop with a cursor in it. Sync stays off, the login item registers silently, the notification permission is asked the first time something would send one. Everything is reachable in the manager afterwards.
- Pros: zero friction — the purest reading of *it just works*.
- Cons: the sync offer never happens. `storage-and-sync` decided onboarding is where enabling sync gets encouraged, and C silently decides the one thing the product wanted to put in the user's hands. A user who would have said yes is never asked.

### Journey

C was put up deliberately rather than as a straw man — it is the honest end of the anti-ceremony instinct that had just closed *Enabling Sync Later*, and the same instinct plausibly applies here. It does not survive its own consequence: the friction it removes is the friction of being asked, and being asked about sync is the thing the product decided it wanted. A silent default is not neutrality; it is a decision made for the user and hidden from them.

B lost on a narrower point. There is nothing a welcome beat could say that the toggles do not already imply, and a product whose signature moment is a note appearing instantly should not open with a page of prose.

### Decision

#### 2026-09-19 — extended

*Trigger: the steps this section named were filled in — see* Wizard Step Content *and* Personalisation Step*. The order below is unchanged; it gains one step and the walkthrough turns out to be two pages.*

> **Six steps: intro, walkthrough (two pages), personalisation, permissions, synchronisation, launch.**

The personalisation step sits between the walkthrough and permissions, so the tour's colour row hands straight into the swatch picker and the two system-facing steps stay together at the end. Everything the 2026-09-16 entry fixed holds: the order of the original five, what each is for, and every decision about content it deliberately left elsewhere.

One addition to that entry's own terms. It closed on the wizard being *short* and skippable, the defence against decisions standing in front of a new user. Six steps is still short, and every step that configures anything carries a default — sync pre-enabled, launch at login pre-enabled, the default swatch pre-selected — so continuing through the whole wizard without touching a control lands on the configuration the product recommends.

#### 2026-09-16 — revised

*Trigger: user reversal, after seeing Raycast's onboarding in their own install (screenshots in Context → Visual references). The one-screen call was made before that reference existed; presented with it, the user judged a walkthrough lighter and more suitable than a single configuration screen.*

> **A short wizard, in this order: an intro, a walkthrough of what a fumi is and what it does, permissions, synchronisation, then launch — which opens on the prepared demo fumi.**

The steps, and what each is for:

1. **Intro** — *"Hello. Here's Fumi. Let's get started."* The greeting *Screen Title* had compressed into a heading now has its own moment.
2. **Walkthrough** — what a fumi is, how it works, a short tour of the features. This is the step the one-screen shape had no room for, and it is what changed the judgement: there was nothing to put on extra pages when the only content was two toggles, and there is now.
3. **Permissions** — the notification authorisation, and the launch-at-login offer alongside it. Raycast's permissions page is the reference for the layout: a row per item, each an icon, a name, a one-line description, and its control on the right.
4. **Synchronisation** — sync as its own page, in the centralised treatment the user confirmed they had been envisioning: product imagery, a title, a short explanation, one large centred toggle. Light rather than dark — fumis read light, fluffy and cloudy.
5. **Launch** — the wizard closes onto the prepared demo fumi (*First Run Landing*, unchanged).

**What this reverses, and what it does not.** The single screen goes, and with it the argument that ignoring it is a complete path — a walkthrough is meant to be read. What survives untouched is every decision about *content*: the toggles' defaults and framing, what the sync page says (*Sync Offer Copy*), the notification ask's unconditional and unexplained character (*Notification Permission Ask*), the silence on the login-item banner, the lazy file-access prompt, and the landing. The wizard rearranges where those live; it re-decides none of them.

**What the earlier shape got right and is worth not losing:** a user who wants to start writing should not be made to work for it. The wizard is *short*, its steps carry defaults, and it is skippable — the entry below's concern was three decisions standing between a new user and their first fumi, and a walkthrough only escapes that criticism if it can be walked past.

#### 2026-09-15

> **One screen. Two toggles, both defaulted, then Continue. The notification dialog fires on the way out.**

Not a wizard and not a sequence — there is nothing left to walk through. The defence against three decisions standing in front of a new user is that all three have defaults, so ignoring the screen entirely is a complete and correct path.

Deliberately settled elsewhere: the toggles' defaults and framing (*Launch At Login Offer*, and the framing stance carried in from research), what the screen says (*Sync Offer Copy*), and the notification ask's character (*Notification Permission Ask*) — this decision fixes only that it fires as the screen is dismissed.

*Sibling check: storage-and-sync — its 2026-08-04 entry holds the sync toggle default-off and names onboarding as the place enabling is encouraged; a single screen carrying the offer is what that requires, and option C was rejected for contradicting it. (The default itself was subsequently re-decided — see* Sync Toggle Default *— and routed to that topic.) engine-architecture — the relevant decision is not Fork 1's mechanism but its 2026-08-20 ruling on who registers the login item and when: **on by default rather than asked**, registered once on first launch and never again. Placing the registration behind a first-run toggle contradicts it. That correction was already delivered to that topic by research on 2026-09-15 as* launch-at-login-is-a-first-run-choice *and is unworked at the time of writing; see* Launch At Login Offer *for why this topic holds its position.*

---

## Launch At Login Offer

### Context

The first-run screen's second toggle. Research settled this with the user on 2026-09-15 — offered, recommended, conventionally worded, declining unremarkable and unpunished — and this section carries it forward rather than re-deciding it. It is recorded here because a background review (review-001 F3) raised it again from `engine-architecture`'s side, and the record needs to say plainly why the position holds.

Registering a login item prompts for nothing, but macOS announces it — the user gets a system notification that Fumi was added to Login Items, with a switch in System Settings. That notification is outside Fumi's control and cannot be worded by it.

### Journey

**The stronger framing was put up and rejected — twice, on the same argument.** The reading offered was that launch-at-login is constitutive of a notes-on-your-desk product and should be framed as *keep your fumis on your desk* rather than *open at login*, because a user who declines restarts to a bare desktop. `engine-architecture` reaches the same place from its own side and goes further: *"A fumi that does not come back after a reboot is not a fumi... A wizard question whose wrong answer breaks the product is not a real question."*

**The user's argument, which carries: Fumi is an app.** Nobody considers Mail broken because it is not running; you open it. Not running is not a failure state, and the missing fumis — like an agent's *Fumi isn't running* — are obvious rather than mysterious. A user who switches this off has made an ordinary choice about an ordinary app, and it is not this product's business to design around it.

Two supporting points. The *keep your fumis on your desk* framing is loss-framed, which the framing stance already rules out for first-run copy. And it argues against a trade `engine-architecture` itself took deliberately elsewhere — *"a crashed engine stays dead until the user reopens it... the recovery is one Spotlight invocation."*

**What the review's raise actually surfaced.** Not a live fork — the position had been settled with the user before this session opened — but two defects in how this document recorded it: the *First Run Shape* sibling check cited `engine-architecture`'s mechanism fork rather than its on-by-default-rather-than-asked ruling, and made no mention of the correction already queued there. Both are now fixed in place.

### Decision

> **Offered, recommended, pre-enabled, conventionally worded. Declining is unremarkable and unpunished, and Fumi builds nothing to protect against it.**

A user who switches it off gets an app that is not running until they open it. That is the ordinary behaviour of an ordinary Mac app and needs no mitigation, no warning copy, and no later nudge.

*Sibling check: engine-architecture — its 2026-08-20 ruling holds registration is on by default rather than asked, registered once on first launch and never again, with a preference to turn it off. This topic's toggle contradicts the "rather than asked" half. The correction is already in that topic's queue as* launch-at-login-is-a-first-run-choice *(delivered by research, 2026-09-15, unworked), so nothing further is routed — the ask is already before its owner. Its never-re-register rule exists so a deliberate opt-out is never overturned, which this decision depends on rather than disturbs. status-and-alerts — it considered and rejected marking the menu bar when the login item is inactive, on the ground that a disabled login item is a preference rather than an error; that reasoning and this decision agree.*

---

## No iCloud Account State

### Context

The sync row has to render for a Mac with no iCloud account signed in, and research settled the user-facing shape with the user on 2026-09-15: **the option is simply disabled, with a note saying that signing into iCloud activates it.** It is not Fumi's job to sign anyone in — no route out to System Settings, no wizard step. If the user signs in while the screen is open it reactivates, ideally without them doing anything; if they do not, they skip and sync can be turned on later. Restricted and MDM-managed accounts were scoped out as a population Fumi does not design for, so the disabled face serves "not signed in" only.

Two things that direction did not cover, one of which a background review (review-001 F5) caught as dropped on the way into this discussion.

### Journey

**The screen has a third face, and every user passes through it.** The screen paints the instant Fumi launches; whether this Mac has an iCloud account is an asynchronous query to the system. For the first fraction of a second Fumi does not know the answer, so the row is in a state neither the enabled nor the disabled description covers. Research had named it — *"a transient indeterminate state at launch, before the account status resolves"* — alongside two others; the managed-account case was scoped out and the per-app switch was carried as a measurement, and this one silently dropped, leaving the carry-forward presenting the state space as binary.

Two ways to render it. Hold the row inert until the answer arrives, which trades the flicker for a screen that looks broken for a beat and is worse for everyone in service of the minority. Or render the common case immediately and correct it if the answer says otherwise.

The counter to the second, weighed: a toggle that starts on and switches itself off looks like the app changing its mind about something the user was on the point of agreeing to — arguably worse than a control that simply arrives a moment late. It does not carry, because the flicker is bounded by how long a local system query takes and lands only on the minority who have no account, while the inert version is paid by everyone on every launch of the screen.

**The reactivity is real rather than hopeful, with a trap.** CloudKit posts `CKAccountChanged` when account status changes — sign in, sign out, the iCloud Drive capability being switched — so the row can enable itself the moment the user signs in, with no refresh action. The condition carried from research: **the notification is posted by a live `CKContainer` instance, and if none is alive when the status changes, nothing is posted at all.** Natural for an always-on engine, and a silent failure if missed — the row simply never updates and nothing indicates why.

**An account can be signed in and still not be one Fumi can sync to** *(review-002 F6)*. The fallback above was keyed to a single answer — *no account* — and macOS has others: iCloud Drive switched off, statuses the system reports when it cannot determine the account, and the per-app iCloud switch this topic carries as an unmeasured question. In each the user meets a large toggle sitting on, presses Continue, and does not have sync. They were shown a confident control describing a state they are not in.

The repair is to stop enumerating macOS's answers and invert the rule: **enabled only on an affirmative yes, disabled face for everything else.** One rule rather than a list that the unmeasured case would extend anyway, and it fails in the safe direction — a user who could have synced sees a disabled control they can act on, instead of a live-looking one that quietly does nothing.

That makes the note's wording the open part, since *sign into iCloud* is not the remedy for every cause. Settled without needing the measurement: **the note names the remedy when Fumi knows the reason, and is neutral when it does not.** A detected absent account keeps the specific line it has now; anything Fumi cannot attribute gets a line that says sync is unavailable on this Mac without inventing a cause. Nothing is lost for the case that is understood, and nothing is asserted for the cases that are not.

### Decision

> **The sync toggle renders in its enabled, pre-enabled state from the moment the page appears, and is enabled only while the account is affirmatively usable. Every other answer — no account, an unusable account, an undeterminable one — gets the disabled face: a disabled control with a note, no route out, no wizard step. It re-enables itself when the account becomes usable.**
>
> **The note names the remedy where Fumi knows it (an absent account: sign into iCloud) and stays neutral where it does not.**

Whether the control names the Apple ID it would bind to is already answered and is not reopened here: it does not, at either end (see *Enabling Sync Later*).

*Sibling check: storage-and-sync — its "no iCloud → no backup" position and its detection of `CKAccountStatus = noAccount` are what this screen renders, adopted unchanged; its ruling that signing in is a macOS action rather than a Fumi flow is what makes the disabled face correct rather than lazy. Sync Toggle Default — the pre-enabled state decided there is what the indeterminate face shows first; consistent by construction. status-and-alerts — an account that goes absent later is a running-app condition and stays its subject; this covers the first-run screen only.*

---

## First Run Landing

*Raised by review-001 F2.*

### Context

What is on screen once the first-run screen closes and the notification dialog is answered. Fumi has no Dock icon, so the default answer is *nothing* — the user's own desktop, plus a menu-bar icon they have not yet learned to look for. They have just installed a notes app and there is nothing to show for it.

`engine-architecture` assigned this here rather than leaving it open. Its cold-start rule is *"a cold start restores the desk and shows no management window"*, and it carves out first-run-after-install explicitly, *"which the same section deliberately assigns to the onboarding wizard rather than to reopen logic"* — because that rule applied to a fresh install restores a desk with nothing on it.

### Journey

The session proposed one empty fumi, centre screen, focused, cursor in it: the product's central object as the first thing you meet, the interaction taught by being it, and *one click and you are writing* actually delivered rather than stopped one step short. Opening the management window instead was rejected as the worse empty state — a list with nothing in it.

The open question the session could not settle was whether that first note is real or scratch: a real note means a brand-new library's first entry is an empty note nobody asked for; a scratch one means the thing just handed to the user can vanish.

**The user dissolved it by changing what the note contains.** Ship a small set of prepared fumis rather than an empty one — the open note is filled, and what it demonstrates is the product: an attached file, a table, tags, and a link to another fumi. The question of whether an empty first note should persist stops existing, because the note is not empty and its content is the reason it is there.

This also makes the "and a few of them" part load-bearing rather than decorative: a link needs somewhere to point, so the set is at least two.

**The set then absorbed the teaching problem the review raised separately (F7).** Fumi's signature mechanic is that a fumi returns to the macOS Space it was left on, and nothing in the product taught it: `space-homing` decided the feature, `note-window` owns the window, neither owns explaining it, and the cancelled positioning research would have been the other candidate. A welcome beat had been rejected on the ground that nothing it could say is not already implied by the toggles — true for sync and launch at login, and false for Space homing, which appears on neither.

The sample set answers it in the register that made the set a good idea in the first place: the notes *are* the explanation. The user's shape for it — a mini demo, with Notion's first-run workspace as the precedent — covers the mechanic and the manipulations around it: that a fumi returns to its Space when the app is closed or the Mac restarts, so you can home a fumi to a Space and it stays there; changing a fumi's colour; moving and positioning it. Demonstrated content rather than a tutorial panel, and consistent with the product's existing habit of teaching a fact once rather than nagging.

**Most of the set is behind a door the user has not found yet** *(review-002 F5)*. One fumi opens; the rest sit in the library, and the library is the management window, which cold start deliberately does not show — reachable only via a menu-bar icon this section's own Context calls one the user has not yet learned to look for. So the mechanic that nothing else in the product teaches would be taught in an unopened note, and the stated exit would go unstated.

**The wizard resolved it rather than the note contents did.** First run became a walkthrough (*First Run Shape*, 2026-09-16), and the walkthrough step is where what a fumi is, how Space homing works, and the feature tour now live. That removes the load-bearing teaching from the sample set entirely: the notes demonstrate and reinforce, they are not the only place a fact appears. Nothing depends on the user opening a second note, and nothing depends on the note-to-note link shipping in first cut.

**And the set tells the user how to get rid of it.** A prepared library nobody asked for needs a stated exit, so one of the notes says how to delete them. A pleasant side effect: `note-window`'s first-delete education — the one-time notification that a deleted fumi is recoverable from Recently Deleted — now fires on a sample note the user does not care about, which is the best possible subject for it.

**One dependency to respect.** `note-window` records the note-to-note link as *"the feature itself is optional / possibly not first-cut"*. A sample note demonstrating a link that does not ship in v1 would be advertising a feature the product does not have, so the sample set's contents are contingent on what actually ships — the principle is *demonstrate real features*, and the specific list is the implementer's to trim against v1's surface.

**Three things once landed in the same instant** *(review-002 F2)*. Under the single-screen shape, pressing Continue opened the fumi, fired the notification dialog and triggered macOS's background-items banner together — so the note with a cursor in it, the whole point of the landing, was the one thing the user could not touch until a system alert had been dismissed.

The wizard dissolved it (*First Run Shape*, 2026-09-16): the notification ask and the login-item registration both belong to the permissions step, and the user walks on to the sync page before the wizard closes. Both interruptions are behind them by the time the fumi appears. Nothing was re-decided; the sequence stopped colliding.

One clause is worth pinning because it is what the landing exists for: **when the wizard closes, focus belongs to the opened fumi's cursor.**

### Decision

> **First run ends by opening a single prepared fumi, centre screen and focused — focus on its cursor, not on anything behind it — with a small set of further prepared fumis in the library behind it. They are real notes, and together they are a mini demo of the product.**

What they cover:

- **The mechanic**, which nothing else in the product teaches — a fumi returns to the Space it was left on when the app is closed or the Mac restarts, so you can home a fumi to a Space and it stays there.
- **The manipulations** — changing a fumi's colour, moving and positioning it.
- **The content features** — an attached file, a table, tags, a link to another fumi.
- **How to delete them**, so the user can clear the set out.

Not an empty state and not a scratch note. The set is trimmed to features that actually ship; nothing in it demonstrates a capability v1 does not have.

Deliberately not decided: an interactive onboarding demo. The user named it as a possible later addition and explicitly placed it beyond this pass.

*Sibling check: engine-architecture — its cold-start rule (restore the desk, show no management window) is untouched, and this decision fills the first-run-after-install exception that rule already carved out for onboarding. space-homing — the mechanic is decided there and is described by the sample set, never altered by it. note-window — the colour, positioning and note-link surfaces the demo names are its decided ground, adopted as they stand; its note-link interaction remains optional for first cut, so the sample set depends on that outcome rather than fixing it. Its first-delete education is unchanged — this decision only observes that a sample note is now the likeliest subject for it. note-model — the sample notes are ordinary fumis under its model (Markdown content, stable UID, tags, `[label](fumi://note/<uid>)` links); nothing about the model is amended to accommodate them. storage-and-sync — soft delete, Recently Deleted and no auto-purge apply to these notes exactly as to any other; nothing special-cased.*

---

## First Launch Definition

*Raised by review-002 F4.*

### Context

Every decision in this topic is conditioned on "first run", and nothing said what makes a launch a first one. It surfaced through the seeding rule, which assumed no-iCloud-account implied an empty library and therefore seeded tutorial notes into a year-old one on reinstall — but the gap is wider than seeding. The same undefined term governs whether the screen appears at all.

The worked case: someone has used Fumi for a year without sync, hits a problem, drags the app to the Trash and reinstalls it. The store is in `~/Library/Application Support/Fumi/` and the uninstall never touched it. Their notes are intact and Fumi treats them as a brand-new user.

### Options Considered

**A. A marker** — a flag written on first completion, checked thereafter.
- Pros: says exactly what it means.
- Cons: a small file whose loss re-runs onboarding over a real library, which is the failure being fixed. It is also a new artifact whose own absence is a new failure mode.

**B. The local library** — a launch is a first run when this Mac's store holds no fumis.
- Pros: local, so the answer is always available and instant; no new artifact; survives reinstall, restore and a copied store by construction, because the thing it reads is the thing those operations preserve.
- Cons: a user who deletes every fumi they own sees the screen again.

### Journey

B's cost was examined rather than waved past, because it is a real behaviour and not a bug: someone with zero fumis on this Mac gets the welcome screen and a fresh demo set. That is arguably the correct thing to happen — an empty Fumi is indistinguishable from a new one, and the demo is what an empty Fumi should offer. The user confirmed it as intended rather than tolerated.

A was rejected on the asymmetry of its failure. A marker that survives is no better than B; a marker that is lost — and files in Application Support are lost in exactly the restore-and-copy scenarios that motivated this — re-runs onboarding over a populated library, which is the outcome the whole finding is about.

The ordering matters and is not arbitrary: **local first, account second.** The local check always answers, so the common cases never depend on the network, and the account query is consulted only for the case it actually addresses — a second Mac with an existing cloud library.

### Decision

> **A launch is a first run when this Mac's local library holds no fumis.** No marker file. The first-run screen and the seeding both hang off that one condition, with the account query consulted afterwards and only when the local library is empty.

A user who deletes every fumi they own will see first run again on the next launch, with a fresh demo set. Intended.

*Sibling check: storage-and-sync — this reads the local store it owns (`~/Library/Application Support/Fumi/`, local truth, authoritative) and asks nothing new of it: no marker, no new record, no new field. Its ruling that the store survives independently of the app bundle is what makes the check correct, and is untouched. Sample Notes And Sync — amended above to sit behind this gate. note-model — "holds no fumis" counts notes under its model; soft-deleted notes in Recently Deleted are still notes, so a user who deletes everything without purging is not at zero and does not see first run again.*

---

## Sample Notes And Sync

### Context

The prepared sample fumis are real notes, and sync is pre-enabled. So first run on a **second** Mac would pull down an existing library *and* seed its own welcome set — leaving the user with two copies of the demo, or a year-old library with a fresh set of tutorial notes grafted onto it.

### Options Considered

**A. Seed always, accept the duplicates.** They are ordinary deletable notes and one of them explains how to delete them.
- Pros: nothing to detect, no conditional behaviour at all.
- Cons: scruffy on every Mac after the first, and the duplicate set arrives in a library the user already curated.

**B. Seed only if the local library is empty once the first sync settles.**
- Pros: no duplicates in the common case.
- Cons: makes first run's landing state depend on a network round-trip, and a slow or offline second Mac seeds anyway.

**C. Seed locally and never sync the samples.** Per-machine furniture rather than notes.
- Pros: no duplication by construction.
- Cons: creates a class of fumi that does not sync, which the storage model has no category for.

**D. Ask the account whether it already has fumis.** Before seeding, query the iCloud account this Mac would sync to; seed only if it holds none.
- Pros: a definite answer to the actual question, with no race and no new note class.
- Cons: one conditional at first run, and it only applies when there is an account to ask.

### Journey

The session proposed B with a seed-anyway fallback, and it was the wrong instrument: B keys on *local* library state settling, which is a race with the network, so the behaviour it produces depends on how fast a sync answers rather than on anything true about the user.

D replaces the race with a question that has an answer. "Does the account this Mac would sync to already contain fumis?" is a property of the account, available before any bulk transfer, and it is the thing actually being asked — the local library's emptiness was only ever a proxy for it.

C stayed attractive and stayed wrong for the same reason it was attractive: a note that does not sync is a concept the entire storage model would have to grow, bought for the sake of tidying one first run.

**The edges fall out correctly rather than needing rules.** No iCloud account, or the user declined sync: there is no account to ask, so seed. Account present with fumis in it: do not seed, and the user's own library arrives — which is the right landing state for a second Mac, better than either the demo or an empty desk. Account present and empty: seed, and the samples sync up like any other note and follow the user to their next Mac until they delete them.

**A gate this rule needed and did not have** *(review-002 F4)*. The no-account branch above originally read *"there is no account to ask, **the library is genuinely empty**, so seed"* — and that premise is true only for a Mac that has never run Fumi. It is false for a reinstall (the store lives in Application Support and survives dragging the app to the Trash), a restored Time Machine backup, or a store copied between machines. In each of those a year-old curated library acquires a set of tutorial notes, which is precisely what option A was rejected for.

The repair is to gate on the local store before consulting the account at all — see *First Launch Definition*. Only an empty local library reaches the account question.

**And the account question can go unanswered** *(review-002 F3)*. A first launch on a train, or on any flaky network, reaches the account query and gets nothing back. The rule as stated enumerated three edges and all three assumed an answer.

The session framed this as a timeout to tune — how long to wait before giving up. **The user rejected the framing rather than the direction:** this is the ordinary offline case every app has, Fumi cannot control whether someone is online, and the answer is to proceed and let synchronisation happen when connectivity returns. No blocking, no spinner between Continue and the user's first note, and no ceremony around a wait.

What that accepts: a second-Mac user who happens to be offline at first launch gets the demo set, and their real library arrives when the network does. The user's own read — *"if we inadvertently create the demo fumis, that's not a big deal"* — and the asymmetry supports it. A duplicate demo set is visible, self-explanatory, and one of its own notes says how to delete it; an empty desktop with an unfound menu-bar icon is a new user concluding the app did not install.

### Decision

> **If the local library already holds fumis, this is not a first run and nothing is seeded. Otherwise, ask whether the iCloud account this Mac would sync to already holds fumis; if it does, seed nothing. Only an empty local library and an empty, absent or unreachable account reach the seeding.**

The account query is **best-effort and never blocks.** If it cannot be answered — offline, slow, or failing — first run proceeds and seeds. Sync reconciles when connectivity returns, which may mean a user briefly holds both their own library and a demo set; that is an accepted, visible and deletable outcome, not a case to engineer around.

The sample notes stay ordinary fumis: they sync, they soft-delete, they carry no special class. The only conditional is whether they are created at all.

*Sibling check: storage-and-sync — the account query is a read of ground it already owns (`CKAccountStatus`, and its ruling that an absent zone stops rather than acts, which reads here as "no fumis, so seed"); its bulk backfill on enabling sync is untouched, and nothing asks it for a new record type or a non-syncing tier. Sync resuming on reconnection is its behaviour, relied on here rather than amended. First Run Landing — the sample set it decided is unchanged in content; this settles only when it is created. Sync Toggle Default — the pre-enabled toggle is what makes the second-Mac case common enough to matter, and is not revisited. First Launch Definition — the local gate this rule now sits behind.*

---

## Login Item Banner

*Raised by review-001 F4.*

### Context

Registering a login item prompts for nothing, but macOS announces it — *"Fumi added items that can run in the background"* — in a banner Fumi cannot word, suppress or time. `engine-architecture` named this topic as the owner of whatever gets said about it: *"onboarding carries the explanation. **Dependency: onboarding-and-permissions** owns that copy."* Its own sketch had onboarding saying something like *it stays running so your desk comes back*.

The timing half is this topic's alone. The notification permission dialog and the login-item registration land close together, so the product produces two system-level interruptions in quick succession.

*(Amended 2026-09-16 — this section was written when first run was a single screen and both landed at Continue. First run is now a wizard with a permissions step, which separates the two from the moment the user finishes: the registration and the notification ask both belong to that step, and the wizard continues to the sync page afterwards. The decision below is unaffected — it was never about how close together they land.)*

### Journey

The sketch reads naturally and is still wrong for this screen. Copy whose job is to pre-explain a standard OS banner makes the banner look like something that needed explaining — the opposite of the effect it is reaching for, and the same instinct the notification ask was deliberately settled against (*"they're just notifications. It's pretty standard stuff. We don't have to over-explain these things to the user."*). Every menu-bar app on the platform produces this banner; users who have installed one before have seen it, and users who have not are not helped by being warned.

The pile-up was weighed and accepted. Two interruptions arriving together is untidy, and the only real lever against it is delaying Fumi's own notification dialog until after the banner — machinery, and timing an event Fumi does not control, to buy tidiness rather than comprehension.

### Decision

> **First run says nothing about the login-item banner, and does not sequence around it.** The notification dialog fires where the permissions step puts it, whatever macOS is doing in the same moment.

The dependency `engine-architecture` handed over is answered: the copy is no copy.

*Sibling check: engine-architecture — it deferred this copy here by name rather than deciding it, so its sketch line is a lean awaiting this answer, not text owed a correction; nothing routed. Its registration timing is untouched. status-and-alerts — its rule that a denied notification permission gets no menu-bar mark and no re-prompt is unaffected; this concerns a macOS banner about a different subsystem.*

---

## Sync Toggle Default

*Settled in the same sitting as First Run Shape, after a background review found the two at odds (review-001 F1).*

### Context

`storage-and-sync` ruled the sync toggle ships default-off, and *First Run Shape* inherited that onto the first-run screen while simultaneously recommending sync and defending a path where the user never reads the screen at all.

The worked case that exposed it: someone installs Fumi on their **second** Mac. Their fumis are already in iCloud. First run appears, they press Continue without reading, and they land in an empty app — the screen recommended sync and then recorded a refusal on their behalf. For that user, "ignoring the screen is a complete and correct path" is false in every sense.

The same screen was also inconsistent with itself. Launch at login is recommended *and* pre-enabled; sync was recommended and pre-refused, with nothing in the record saying why two recommendations carry opposite defaults.

### Journey

*First Run Shape* rejected the no-screen option on the ground that **a silent default is not neutrality; it is a decision made for the user and hidden from them.** The review's catch is that a rendered-but-unread screen produces the same outcome by a different route: the offer was made, nobody answered, and the answer recorded is no. The argument that killed option C applies to the screen's own default.

The counter-position was weighed seriously: default-off means no user's notes leave their Mac without an explicit yes, which is a defensible privacy posture for a product whose pitch is that your notes are files you own. If that were the reason for the default, the repair would run the other way — qualify the ignore-the-screen claim and find something else to catch the second-Mac user.

It is not the reason. `storage-and-sync` decided default-off for the *running app*, and in the same entry named onboarding as the place enabling gets encouraged. A default set against that encouragement makes the recommendation decoration. The screen is the one moment the choice is deliberately in front of the user, and the toggle's starting position should point where the recommendation points.

### Decision

> **The sync toggle is pre-enabled on the first-run screen when an iCloud account is present. The recommendation and the default point the same way.**

With no iCloud account the control is disabled with its note, unchanged — there is nothing to pre-enable. The user still sees the toggle, still sees it on, and can switch it off before Continue; what changes is that inattention now lands on the recommended outcome rather than against it.

This repairs *First Run Shape*'s ignore-the-screen defence rather than weakening it: with both toggles pre-enabled, Continue-without-reading produces the configuration the product recommends, which is what made that path defensible in the first place.

**Owed to `storage-and-sync`.** Its 2026-08-04 default-off ruling is a decision this contradicts at the first-run surface, and the correction is theirs to absorb rather than ours to make — rerouted rather than decided here.

*Sibling check: storage-and-sync — its 2026-08-04 entry holds "the sync toggle ships default-OFF and onboarding is where enabling gets encouraged", and this decision takes the second half against the first at the first-run screen. Routed to that topic. Its separate rulings are untouched: toggle-off is pause not destroy, enabling triggers a resumable background backfill, and there is no in-app remove-from-iCloud action. no-icloud-account-state — the disabled face carried in from research is unchanged; this decision governs the enabled case only.*

---

## Who performs the restart after the Accessibility grant, and what the wizard says while it happens

### Context

*From: engine-architecture · discussion · 2026-08-12*

engine-architecture's `restart-and-restore` decided:

> **Every planned restart is user-initiated. The engine never restarts on its own initiative.**

The *update* half of that constraint was exported to build-and-release as a decision owed (auto-download fine, auto-install never). The *permission* half was only asserted in passing — *"the permission grant is a user moment too — they have just clicked through a wizard"* — and exported nowhere. This entry is that export.

**The gesture is not obviously the same shape as the update's.** A Sparkle update is something the user clicks *inside Fumi*, so "the moment belongs to the user" is satisfied by construction. A TCC grant lands when the user flips a toggle in **System Settings**, and they may still be in System Settings — or mid-wizard — when Fumi notices the grant arrived. Restarting on detection is the engine acting on its own initiative, which this rule forbids. Waiting for an explicit step means the wizard owns a *"Restart Fumi"* affordance, and also owns the state before it is pressed: a granted permission that the running engine cannot yet use.

**engine-architecture reversed its process model on 2026-08-12, and that makes this more yours, not less.** The topic previously chose a **launchd agent**, which gave the permission restart a very neat mechanism: the engine drained, exited non-zero, and launchd's `KeepAlive: {SuccessfulExit: false}` policy brought it straight back — no self-relaunch, no helper, no spawning. That fork has since reversed to a **plain login item** (`SMAppService.mainApp`); Fumi is now an ordinary `LSUIElement` app with no launchd job and no supervision. The mechanism that reopened the engine for free is gone.

**What engine-architecture still supplies, unchanged:** the engine **drains** on a planned exit (finishing in-flight work, rejecting received-but-not-started operations with a definite *not applied*, flushing the live editor buffer and its own debounced writes, signalling connected clients with a `restarting` intent) and then exits. Restoration on the way back up is also unchanged and gated on session readiness.

**What is now open and is the wizard's to decide:**

- **Who reopens Fumi.** Either a relauncher helper of the same shape Sparkle's `Autoupdate` uses — a separate short-lived process that waits for the app to quit and reopens it — or the wizard simply telling the user to reopen Fumi themselves. Both satisfy *user-initiated*, since the user pressed the button either way; they differ in polish and in how much machinery ships.
- **What the wizard says**, and what the state looks like between the grant landing and the restart being pressed. A granted-but-not-yet-active permission is a state the user can observe and be confused by.
- **Whether Fumi even notices the grant** before the restart, and whether the wizard waits on that or on the user.

**A related assumption engine-architecture flagged and could not settle**, because a decision there was propped on it: the discovery brief asserts the private CGS/SkyLight Space APIs require the **Accessibility** permission. Chrome restores its own windows to their Spaces without ever prompting for Accessibility — that permission governs controlling *other* applications, and the Space calls act on the caller's **own** windows. If the assumption is wrong, this entire restart requirement may be much smaller than assumed, or may not exist. That question is being routed to `space-homing` separately; it is named here because it bounds how much of this entry matters.

### Journey

The entry names its own escape hatch in its last paragraph, and that is the paragraph that resolved it. `space-homing` measured the assumption rather than reasoning about it: on macOS 26.5.2 with SIP enabled, probes ad-hoc signed with no entitlements and again inside a verified App Sandbox container moved the process's **own** window between Spaces via `SLSMoveWindowsToManagedSpace`, succeeded while the window was ordered out, and **produced no TCC prompt of any kind**. The Accessibility assumption came from inheriting yabai's permission story along with its technique — yabai needs a scripting addition and partial SIP because it moves *other applications'* windows.

So there is no grant, and with no grant there is no permission-driven restart. The three open questions the entry handed over — who reopens Fumi, what the screen says in the gap, whether Fumi notices the grant — all describe a moment that does not occur.

The one thing that would reopen it is a *different* permission that forces a restart. First run asks for exactly one permission, notifications, and that is an ordinary dialog with no restart behind it.

### Decision

> **Moot. There is no permission-driven restart during first run, so the gesture has nothing to own.**

The restart-and-restore requirement itself is untouched and still real — it is driven by Sparkle updates, and `restart-and-restore` owns it. What dissolves is the claim that first run is one of its triggers.

*Sibling check: engine-architecture — its `restart-and-restore` rule that every planned restart is user-initiated stands unaltered, and its Fork 1 login-item shape (`SMAppService.mainApp`, no supervision) is untouched; this decision removes one of the rule's supposed triggers rather than amending the rule. It had already flagged the Accessibility assumption as unsettled and routed it to `space-homing`, so nothing is owed back. space-homing — the measurement is adopted whole, as research adopted it.*

---

## The engine needs Files-and-Folders access — a second permission surface

### Context

*From: engine-architecture · discussion · 2026-08-18*

The onboarding brief scopes the first-run wizard to **one** grant: *"the Accessibility permission the private APIs need"*. A decision in engine-architecture creates a second, and nothing in your brief knows about it.

**Where it comes from.** `client-transport` decided that a file-bearing operation passes a **path**, never contents — `fumi add /Users/…/board.png` sends the path and the engine opens the file itself. That is right for several reasons (the engine is sole writer; note-model and storage-and-sync make the asset add one atomic engine operation, so the engine wants the bytes anyway; and it keeps the wire text-only, which is what lets a shell script speak the protocol). The consequence is that **the `open()` happens in the engine's process, so the engine is the TCC subject** for macOS's per-app file gates: Desktop, Documents, Downloads, iCloud Drive, and removable or network volumes.

**The failure it admits.** Fumi is an `LSUIElement` app with no dock icon. An agent — or a shell script — hands it a path under `~/Documents`, and the user meets a system permission prompt with no visible cause: they did not open a file dialog, they may not have touched the machine, and the app asking is one that lives in the menu bar.

**Two things bound how big this is**, and they are worth carrying so the size is not re-guessed:

- **The note store needs no grant at all.** It lives in `~/Library/Application Support/Fumi/`, which is not TCC-protected. Nothing about normal operation — creating notes, editing, syncing, restoring — touches this. The exposure is *only* reading source files handed in from outside.
- **The common entry route is a drag, which carries its own grant.** Dropping an image onto a note window is in-process and permitted by the drop itself. What remains is specifically an **agent or script passing a path** into protected territory.

**The alternative was checked and is worse**, so this is a cost to absorb rather than a decision to revisit. If the client read the bytes and streamed them instead, TCC would attribute to the **responsible process** — Terminal, iTerm, or whichever host launched the tool. engine-architecture already relies on that behaviour when deriving the `via` channel (*"running a CLI from Terminal prompts that **Terminal** wants to control your computer rather than the tool"*). The subject would then vary with how the user happened to invoke Fumi, which is more confusing than one app asking once, and it would reverse the bytes-never-cross-the-socket rule for no gain.

**What is yours to decide:**

- **Whether the wizard pre-requests Files-and-Folders access**, alongside whatever it does for Accessibility, or whether the prompt is met lazily the first time a path in protected territory arrives. Pre-requesting explains the ask in context but adds a step to onboarding for a capability many users may never exercise; lazy keeps onboarding shorter but surfaces a prompt at a moment the user did not cause.
- **What the wizard says about it**, given the honest framing is *"Fumi opens files you or an agent point it at"* rather than anything about the note store.

**Related, from the same session:** engine-architecture also named an error class for this — *"the engine cannot read that path"*, distinct from an invalid argument, so an agent can tell "fix the path" from "ask the human to grant something". The error **code** belongs to `agent-surface`; what the user is told when that surfaces may end up partly yours.

**Also queued on this topic** (separate entry, same session): who performs the restart after the Accessibility grant, and what the wizard says while it happens.

### Journey

The entry frames this as a choice between explaining the ask up front and meeting it cold. That framing is the same one the notification permission was settled under, and the two cases pull opposite ways for a reason worth stating: **the notification ask is up front because its in-context moment is bad news being delivered** — sync has broken, and a permission dialog is the worst possible thing to show someone instead of telling them. This prompt's in-context moment is the opposite. The user has just asked for something — *put this screenshot in a fumi* — and the prompt is the platform answering that request. Apple's own guidance describes exactly this shape.

The asymmetry that decided it: a declined file prompt fails **loudly and recoverably**. The engine returns the *cannot read that path* error, the agent hands the human something actionable, and the same request works after a grant. A declined notification permission fails **silently and permanently** — there is no second prompt and no way back inside the app.

**A platform point that may make the fork moot.** There is likely no clean way to pre-request this at all. macOS raises the Desktop/Documents/Downloads prompt when an app actually touches one of those folders — there is no API to request the category in the abstract, and an `NSOpenPanel` grants access to what the user picked rather than the folder. An up-front ask would therefore mean Fumi reaching into the user's Documents folder during onboarding with no reason to, which is more alarming than the surprise it was meant to prevent.

*Observation, not measured — stated from platform knowledge and not verified against a machine or an Apple source in this session. The decision does not rest on it: the in-context reasoning above stands alone, and this only narrows the alternative further. The user's position ("we don't need to pre-request") matched it independently.*

### Decision

> **Lazy. First run does not request Files-and-Folders access and says nothing about it. The prompt is met the first time a path in protected territory actually arrives.**

Nothing is added to the first-run screen, which keeps its two toggles and the single notification dialog. The user meets this prompt attached to a thing they asked for, and a refusal surfaces as a clear error rather than as silence.

What the human is told when the engine cannot read a path stays where the entry put it — the error code is `agent-surface`'s, and with no first-run surface there is nothing of it left here.

*Sibling check: engine-architecture — its `client-transport` decision that a file-bearing operation passes a path rather than bytes is what makes the engine the TCC subject, and is untouched; this decides only when the resulting prompt is met. agent-surface — the "cannot read that path" error class is already its subject, and this decision adds no requirement to it. status-and-alerts — a denied file prompt is a per-request failure returned to the caller, not a standing condition, so its dot criterion (facts about this Mac's backup relationship as a whole) does not reach it. No conflict.*

---

## Sync Offer Copy

### Context

The first-run screen carries an iCloud sync toggle, and research settled the *stance* it is written under without settling a word of it: **recommend sync, frame it on what sync gives, do not dramatise what declining costs.** Not flat-neutral and not loss-framed.

One line is ruled out by fact rather than taste. The intuitive copy — *"your notes only live on this Mac"* — overstates the risk: `storage-and-sync` put the store in `~/Library/Application Support/Fumi/`, which Time Machine captures. Declining sync costs a second Mac and an off-machine copy; it does not cost backup. Copy implying otherwise turns an honest choice into a nudge, which the stance forbids.

### Options Considered

**A. Plain capability.** *"Sync with iCloud"* — *"Your fumis appear on every Mac you sign into."*
- Pros: says what the toggle does and nothing else. Impossible to read as pressure.
- Cons: offers nothing a user could not assume, so the recommendation carries no weight.

**B. Capability plus the desk.** The same toggle, with the supporting line also carrying that a fumi's *placement* comes back — its position, its display, its Space — not only its text.
- Pros: the one thing Fumi can offer here that Apple Notes cannot. Positive by construction — it describes a gain, never a loss.
- Cons: a longer line on a screen that is otherwise deliberately quiet.

**C. Both sides stated.** B plus a second line naming what off means — *"Off: your fumis stay on this Mac."*
- Pros: symmetrical and honest about the choice being a choice.
- Cons: a sentence whose only job is to describe not-having-something, on a screen the stance says must not dramatise declining.

### Journey

C is the shape the stance was written to rule out. Stating the off-side is not neutrality here — there is nothing true and non-diminishing to say about it, because the honest version (*you keep everything, minus a second Mac*) is either reassurance nobody asked for or, phrased any tighter, the loss framing the stance rejects. Saying nothing about the off-side *is* the unpunished option.

B beat A on the substance available rather than on tone. `storage-and-sync`'s durable per-device tier — window position, home display, home Space — has no backup authority when sync is off, and that topic named this directly as a second argument onboarding could lean on: *"not merely your notes are backed up but your desk comes back."* It is a real capability, it is Fumi-specific, and it is a gain rather than a threat, which is exactly the instrument the stance permits.

Care taken with its inverse: the desk argument must not be run backwards. The same `storage-and-sync` entry records that Time Machine captures both the store and the per-device blob, so a sync-off user restoring the same Mac gets the desk back too. *Your desk follows you to every Mac* is true; *without sync a wipe loses your desk* is not, and that contradiction was already rerouted to `storage-and-sync` during research.

### Decision

#### 2026-09-19 — revised

*Trigger: research landed a correction from `storage-and-sync` on 2026-09-16 — placement is per-device by design, so the desk does not travel between Macs — and the user settled the same day that the desk comes off the sync screen on both sides. This document had already written the desk into the copy and last moved before either.*

**Settled by derivation** — not discussed. Determined by `storage-and-sync`'s per-device placement mechanism as research absorbed it on 2026-09-16, and by the user's call the same day that the desk comes off the screen.

> **Option A after all, on fact rather than tone. The page promises the notes alone — your fumis on every Mac you sign into, and a copy of them off this one. The desk is not mentioned on either side.**

**What unseated B: the desk does not travel, by design.** Placement is per-device state. Each Mac writes its own record and no Mac reads another's layout — the per-device record was chosen over per-note records precisely because nobody queries another Mac's arrangement, and the one field other Macs read is the machine's display name. *Your fumis and their placement follow you to every Mac* therefore promised something the product deliberately does not do. The Journey below weighed the desk line's tone and its inverse and missed that the positive statement was itself untrue; the care taken not to run the argument backwards was care spent on a line that had no forwards either.

**What sync genuinely adds for the desk, so nothing is overclaimed:** it covers a user with no Time Machine, and it is the recovery source when the per-device record itself is unreadable. Both real, both narrow. The only true desk line — *sync backs up each Mac's own arrangement, so a Mac you wipe and restore comes back the way you left it* — was put to the user during research and not taken, on subject rather than truth: it is a promise about surviving a dead machine on a page about working on more than one. Recorded as available, not dead.

Everything else in the 2026-09-15 entry stands. The off-side is still undescribed, the stance is unchanged, and the page still recommends sync — the notes leg carries the recommendation on its own, which it can, and which is the point: it needs no carve-out and every desk sentence needs at least one.

*Sibling check: storage-and-sync — its per-device-settings decision holds that each device is its record's exclusive writer and that no Mac queries another Mac's layout, with the machine's display name as the one narrowed exception; adopted as the reason this copy changes, never amended. Its own 2026-09-15 entry already records the desk leg as withdrawn rather than restated, so the two sides agree and nothing is routed. Its Time Machine coverage fact is untouched and is what keeps the off-side honest as well as silent.*

#### 2026-09-15

> **Option B. The toggle names the capability, and its supporting line carries both halves of what sync returns — the fumis and where they sat.** Nothing on screen describes the off-side.

*(Amended 2026-09-16 — the copy is unchanged, its surface is not: sync now has its own wizard page rather than a row on a single screen, in the centralised treatment the user confirmed from Raycast's — imagery, title, one large centred toggle, a short explanation under it, light rather than dark. The extra room is room for the same two halves, not licence to say more, and the off-side stays undescribed.)*

Exact wording is the implementer's within this shape; what is fixed is that the line says your fumis and their placement follow you to every Mac, and that no sentence exists whose subject is what declining costs. *(The placement half is struck by the 2026-09-19 entry above.)*

*Sibling check: storage-and-sync — its 2026-08-04 entry names onboarding as where enabling sync is encouraged, and its 2026-07-30 durable-tier entry supplies the desk-comes-back argument and the Time Machine fact that bounds it; both adopted as written, neither amended. The desk-loss argument in that same entry is already under correction there via research's reroute, and this decision declines to use it.*

---

## Notification Permission Ask

### Context

The one permission first run asks for. `status-and-alerts` fixed that it is asked, that it is asked up front rather than at first use, and that it is never re-prompted; research then worked the framing and sequencing with the user and settled both. This section lands that settlement in the discussion record — it is not re-decided here.

Notifications carry sync stopped, `quotaExceeded`, a fumi permanently rejected by CloudKit, `note-window`'s first-delete education, and its oversized-file refusal reason.

### Journey

The route to the answer is worth keeping, because two earlier positions were reversed along the way.

**An earlier lean had the ask made lazily**, at first use. It flipped on a worked case: a new user deletes a throwaway note, macOS interrupts with *"Fumi would like to send you notifications"*, and **Don't Allow** is the reflex because they were deleting something rather than configuring anything. Six weeks later their sync stops and the channel that would have told them is gone.

**A later position made the ask conditional on the sync decision** — ask only the users who enable sync, since the backup framing is false for anyone else. The user corrected it at the root: notifications are a general capability, *"just notifications that happen to be used mostly for syncing, but not exclusively."* Conditioning them on the sync toggle would weld two unrelated choices together, so a user who declined sync would silently also have declined notifications, permanently, without being told that is what they had done. Fixing the framing dissolved the problem the conditional shape existed to solve.

**Apple recommends asking in context, and this is the case where that fails.** Their worked example is a reminders app asking after the person schedules a first task — a feature the user just opted into. Fumi's notifications are the opposite: things nobody asked for, wanted only when something has gone wrong. The in-context moment *is* the failure — sync breaks, and instead of telling the user, Fumi shows a permission dialog and hopes for a yes. In-context works when the context is a feature; it fails when the context is bad news being delivered.

### Decision

**Settled by derivation** — not discussed. Determined by the settlement research reached with the user on 2026-09-15, and by `status-and-alerts`' 2026-09-12 ruling that the permission is asked, asked up front, and never re-prompted.

> **Fumi asks for notification authorisation once, during first run, for everyone. The ask does not depend on the sync decision in any direction. It is not explained or justified at length — it is an ordinary notification permission.**

No pre-dialog rationale screen, no backup framing, no enumeration of what notifications are used for. In the user's words: *"they're just notifications. It's pretty standard stuff. We don't have to over-explain these things to the user."*

*First Run Shape* fixes when. *(Amended 2026-09-16 — that section originally had the dialog firing as the single screen was dismissed; first run is now a wizard, and the ask belongs to its **permissions** step. That it is asked once, up front, unconditionally and unexplained is unchanged.)*

If the permission is denied, the first-delete education and the oversized-refusal reason simply never appear — `note-window` accepted that for each — and **first run never treats a denial as grounds to ask harder**.

*Sibling check: status-and-alerts — "asked, once, up front" is adopted as it stands. Its backup framing, its sequencing-after-sync fix, its pre-dialog reason screen, and its "a denial has no route back" claim were all corrected by research on 2026-09-15 and delivered to its queue as three separate entries; nothing further is owed from here. note-window — its position that the first-delete education may never justify pushing for the grant is untouched, and an unconditional ask that is never repeated does not push.*

---

## Screen Title

### Context

The line above the two toggles. It matters more than its size suggests because everything else has been stripped: no welcome beat, no explanation of what Fumi is, no pricing, no over-explaining the permission. The title is therefore doing the whole job of saying what this screen is.

### Options Considered

**A. Functional** — *"Set up Fumi"*, *"Get started"*. Says what the screen is and claims nothing.

**B. Product voice** — *"Welcome to Fumi"*. The conventional Mac shape.

**C. No title** — two toggles and Continue, unlabelled.

### Journey

C was the interesting one and lost on how it reads rather than on principle: a screen with no heading looks unfinished rather than confident, and the quiet this product is after comes from having little to say, not from withholding a label.

B against A turned on whether it reopens the welcome beat *First Run Shape* rejected. It does not. What was rejected there was a *screen* — a separate step whose content the toggles already imply. A one-line greeting above the toggles costs no click and no step, and it is the shape every Mac app of this kind uses. That is the same argument that settled launch at login: convention is not ceremony, and departing from it needs a reason this screen does not have.

### Decision

#### 2026-09-16 — revised

*Trigger: user reversal on First Run Shape — first run became a wizard, so the greeting is no longer a heading on a configuration screen.*

> **The greeting becomes the wizard's intro step — *"Hello. Here's Fumi. Let's get started."*** Its own moment rather than a line above two toggles.

The reasoning below is why a greeting exists at all, and it survives: the welcome beat was never the problem, a separate *screen* whose content the toggles already implied was. The wizard gives that content — the walkthrough — so the beat now has something to introduce.

#### 2026-09-15

> **A greeting — *"Welcome to Fumi"* or the implementer's equivalent in that register.** One line, above the toggles, no supporting paragraph.

Nothing precedes it and nothing accompanies it. The screen remains title, two toggles, Continue.

*Sibling check: no overlap found — the first-run screen's own chrome is introduced by this topic and named by no other.*

---

## Pricing Mention

### Context

`commercialization` owns the mechanics — one-time ~$19, no subscription, a visible usage-metered premium counter. The question here is only what, if anything, first run says about any of it.

### Journey

**The case for silence**, and it was the session's lean. The metered counter is conversion-forward by design: the user watches the runway shrink *while getting value* and decides the runway is worth buying. At first run there is no value yet — zero fumis written, nothing used — so *"10 premium uses left"* before any use reads as *here is the catch*, spending the mechanic at the one moment it cannot do its job. First run also already carries two toggles and a system dialog, each of which configures how the product behaves; a pricing screen would be a fourth that configures nothing.

**The objection, and where it lands.** People resent discovering an app is paid after investing time in it. True, and the answer is the landing page rather than a first-run screen — the user arrived from somewhere, and *"one-time, no subscription"* does selling work where selling happens rather than where interrupting happens.

**A vehicle that did not exist when research wrote this.** The prepared sample fumis (see *First Run Landing*) are a place a single honest line could sit — *Fumi is a one-time purchase with a free allowance* — without a screen and without interrupting anyone.

**Why it was on this topic's map at all, and why it comes off.** Discovery listed "the trial intro" as one of first run's three parts, alongside the permission wizard and the storage-location setup. The other two turned out not to exist; this one survived as the narrower question *does first run say anything about price*, which is a question about first-run content and so legitimately this topic's.

But no decision is available here at any length, and the ball has already been passed: the concern delivered to `commercialization` (2026-09-16, the seeded demo fumis and the trial meter) states in as many words that this topic holds no position on a pricing mention and will carry a line if told one is owed. Holding a subtopic open here to wait for an answer that has already been requested elsewhere is bookkeeping, not discussion.

### Decision

> **Not first run's to settle. `commercialization` decides whether a pricing line is owed at all; if it is, the wizard's walkthrough step is its home.**

This is a scope call rather than a deferral: the question leaves this topic's map because the topic cannot hold it, not because it is being set aside for later attention here. The reasoning above stands as the argument a line would have to beat, and the session's lean — no pricing screen, one honest line at most — is recorded as material for whoever picks it up.

**What would bring it back:** `commercialization` landing on premium being something a user meets in the first few minutes. Then the counter starts before any judgement of the product has formed, a prior word becomes necessary, and this topic is told so.

### Status of the earlier position

**Blocked, not deferred by preference.** The user's position when this was first parked: it cannot be settled while the shape of `commercialization` is undecided.

**And nothing elsewhere in this document may assume an answer.** *First Run Shape* originally argued from "the pricing model deliberately unexplained" as though it were settled here; that clause is struck (review-002 F7). The question is open, and the only thing this topic now holds about it is where a line would go if one is ever owed — the walkthrough step, which exists to explain what Fumi is and does, is the natural home and costs nothing to use later. Whether first run owes a prior word depends entirely on what premium turns out to be and when a user first meets it — research named the same dependency from the other side: *"if `commercialization` lands on premium being something a user meets in the first few minutes, the counter starts ticking before any judgement of the product has formed, and a prior word becomes necessary."*

So the lean above stands as the shape of the argument, and the call waits on that topic.

---

## Wizard Step Content

### Context

*First Run Shape* settled the wizard's five steps on 2026-09-16 and filled three of them. The intro and the walkthrough were named and left empty — the walkthrough being the step whose existence changed the shape in the first place ("there was nothing to put on extra pages when the only content was two toggles, and there is now"). Research carried the gap into its Open Threads on 2026-09-17, after the user brought eleven screenshots of Dockset's onboarding and proposed content for both steps.

What the reference offers, in the user's own terms: an *"Explore Fumi"* opening with the app icon and the product's own objects scattered loose around the frame, and a tour page built as a short list of features on the left with an animation of that feature working on the right.

### Options Considered

**A. One tour page.** Three or four feature rows on the left, each an icon, a name and a line of description, with an animation of the selected feature running on the right.
- Pros: one step, as settled. Fumi has a small number of things worth showing and they fit on a page.
- Cons: the animation panel is shared, so each feature gets a small frame rather than the screen.

**B. One feature per page.** Each feature gets a full-width animation and its own beat.
- Pros: every feature is seen at full size.
- Cons: turns a five-step wizard into eight or nine. Padding three good demos into a slideshow.

**C. No tour — a single "what a fumi is" page.** The prepared demo fumis do the teaching.
- Pros: shortest possible walkthrough.
- Cons: gives back the repair that closed review-002 F5. Space homing — the one mechanic nothing else in the product teaches — would go back to being explained inside a note the user has not opened, behind a menu-bar icon they have not learned to look for.

### Journey

A was taken quickly and the interesting work was in what it is *not*.

**Nothing advances on a timer.** The research record described Dockset's tour rows as self-advancing, each with its own progress bar running underneath. The user's reading of their own screenshots is that this is a step indicator styled like a progress bar — the social-media convention — rather than anything counting down, and they ruled out auto-advance for Fumi regardless. **Every move through this wizard is an explicit user action**: select an option and continue, or just continue. A wizard that walks itself takes the pace away from the person reading it, and a page that changes under someone still reading the last line is the failure that instrument buys.

**The tour splits into two pages rather than one, and the second one carries no animation.** A is the shape for features worth watching; it is a bad shape for a list, because every row on it implies an animation that has to be built. So page one is the primary features — the ones an animation actually explains — and page two is the rest, stated plainly and shown in no more than a line each. The wizard stays short, the feature surface gets stated in full, and nothing commits the implementer to animating a feature that does not need it.

**Colour appears in both the tour and the personalisation step, and they are two different things.** The tour row says a fumi can be coloured; the personalisation step picks the palette every colour is drawn from. Under `note-window`'s two-level model those are genuinely separate — a per-note *role* against the app-level *swatch* — and putting one immediately after the other reads as one idea opening into its setting rather than as repetition.

### Decision

> **The walkthrough is two pages. The first is the Dockset shape — a short list of primary features on the left, the selected one animating on the right. The second lists the remaining features in a line each, with no animation. Nothing on either page advances on its own: every step through the wizard is an explicit user action.**

**Page one — the features an animation earns**, as the user named them: what a fumi is and how one is made; writing in it; moving and resizing it; giving it a colour; an agent writing into it. Plus the one the session adds — that a fumi stays where you put it and comes back to the Space you left it on, which is the mechanic nothing else in the product teaches and the reason option C was rejected.

The agent row is the one nobody expects from a sticky-note app and the hardest to discover by poking at a note.

**Page two — the rest, stated.** One line each, no animation. The session's fill, from what the surrounding topics have decided: search, tags, attachments and tables, Recently Deleted, quick capture from the menu bar, the CLI.

**The intro keeps its greeting and takes Dockset's treatment** — the app icon, the greeting settled in *Screen Title*, and fumis scattered loose around the frame at slight angles. The product shows itself rather than describing itself, which is the whole reason the reference was brought.

The exact feature list is the implementer's to trim against what v1 actually ships — the same constraint the sample set carries in *First Run Landing*, and for the same reason: nothing in first run demonstrates a capability the product does not have.

*Sibling check: space-homing — the mechanic the tour's second row describes is decided there and is described, never altered. note-window — moving, resizing and per-note colour are its decided surfaces, adopted as they stand; the tour states them and adds no requirement to them. agent-surface — the CLI and MCP surface named on both pages is its subject; the tour shows it and asks nothing new of it. First Run Landing — its ruling that the walkthrough carries the teaching and the sample set reinforces it is what makes page one load-bearing, and is unchanged.*

---

## Personalisation Step

### Context

Dockset's *"Start with your essentials"* page — a name field, a row of ten colour swatches with the current one ticked, then two dropdowns and a checkbox — was brought as a candidate step the settled wizard does not have. The user's reason for wanting it: show the user up front that there are lots of different colour sets to choose from, rather than leaving them to find that out.

`note-window` settled on 2026-09-18 — after this topic last moved — what that choice actually is. Colour is two-level: a per-note **role** stored on the note, and an app-level **swatch** mapping every role to a curated, harmonious set of tinted-glass colours. Changing the swatch re-tints every note live, each note keeping its role. Ten ship, including Okabe–Ito for colour-vision deficiency and Graphite for achromatopsia, both first-class themes rather than an accessibility submenu.

### Journey

**The step earns its place on something stronger than pleasantness.** The two accessibility swatches are the case. `note-window` deliberately made them ordinary themes in the same list rather than a special setting, which is right — and the cost of that choice is that a user who needs one only finds it by opening the swatch switcher. A first-run step that shows all ten puts the set in front of everyone exactly once, at the one moment they are already looking at a setup screen, with no diagnosis to declare and nothing labelled as an accommodation. That is a real outcome, not decoration.

**What the step sets, rather than merely shows.** Every other step in this wizard configures something and carries a default — sync pre-enabled, launch at login pre-enabled — and a step that changed nothing would be the only ornament in the sequence. The choice applies: it sets the active swatch, live, which is exactly what the control does everywhere else in the product. The default swatch is pre-selected, so continuing without touching it is a complete path like every other step.

**Where it sits.** After the walkthrough, before permissions. The tour's colour row hands straight into it, and the two system-facing steps — permissions and sync — stay together at the end where the wizard's existing order already puts them.

**What it is not.** Not Dockset's page. Their version carries a name field and two unrelated dropdowns; Fumi has one personalisation choice worth making at first run and the step is that choice. If later customisation options arrive this is their home — the step is the room, and today it holds one thing.

### Decision

> **The wizard gains a personalisation step, between the walkthrough and permissions. It shows all ten swatches, applies the selection live, and ships with the default swatch pre-selected so continuing without a choice is a complete path.**

The wizard is therefore six steps: intro, walkthrough (two pages), personalisation, permissions, synchronisation, launch.

The step is also where the wizard's tinted background gets its colour — Dockset's page carries a wash of the current selection, and a swatch picker is the one page where that is the subject rather than a flourish. What the treatment is elsewhere in the wizard is the implementer's.

Nothing here changes how colour works. The swatch switcher keeps every surface `note-window` gave it; this adds a moment, not a control.

*Sibling check: note-window — its two-level colour model (per-note role, app-level swatch), its ten shipped swatches including Okabe–Ito and Graphite, and its ruling that switching is reachable from the note's strip, the manager and the app menu bar are all adopted unchanged. This decision adds a first-run moment for a control that already exists and asserts nothing about the model; no correction is owed and nothing is routed. Wizard Step Content — the tour's colour row states that a fumi can be coloured, this step picks the palette it is coloured from; consistent by construction. First Run Shape — its five-step order is extended by one step rather than rearranged; the steps it fixed keep their content and their sequence.*

---

## Summary

### Key Insights

1. **Two of the brief's three legs were premises, not requirements.** The Accessibility grant and the storage-location picker were both inherited assumptions that measurement and a sibling decision dissolved. Three of this topic's decisions are dissolutions, and in each the right move was to record why the thing does not exist rather than design around a ghost.
2. **A default that points away from the recommendation is the same failure as a silent default.** The screen was rejecting a no-screen option for hiding a decision from the user while doing it itself, one toggle over. The test that caught it: what does the user who reads nothing end up with, and is that what the product would have advised?
3. **In-context permission asks work when the context is a feature, and fail when the context is bad news.** Apple's guidance assumes the former. Fumi's notifications are the latter, which is why the platform's own recommendation is the wrong instrument here.
4. **The sample notes turned out to be the answer to several questions at once** — the landing state, the empty-first-note problem, and teaching the one mechanic nothing else in the product teaches. A vehicle that already exists beats a new surface.
5. **Scenarios need a population before they earn a screen state.** The wrong-Apple-ID case and the managed-account case were both mechanically real and both scoped out, because no user Fumi designs for is in them.
6. **An accessibility option made deliberately ordinary has to be met somewhere, or it is only findable by people who already know to look.** `note-window` put the colour-vision swatches in the same list as every other theme rather than behind an accessibility setting, which is the right call and costs discoverability. First run is where that gets paid back — a step showing all ten puts them in front of everyone once, with nothing to declare and nothing labelled as an accommodation.

### Open Threads

- **Whether a pricing line is owed at all** is `commercialization`'s, not this topic's — see *Pricing Mention*. If premium turns out to be something a user meets in the first few minutes, a prior word becomes necessary and this topic is told; the walkthrough step is where it would go.
- **The sample set's exact contents** are contingent on what ships: `note-window` records the note-to-note link as optional for first cut, and the demo must not advertise a capability v1 lacks. The walkthrough's feature list carries the same constraint for the same reason.

Rerouted from here, each awaiting its owner: `storage-and-sync` holds the pre-enabled sync toggle against its default-off ruling; `management-window` holds corrections to the sync-control brief research sent it; `engine-architecture` holds research's note that launch at login is a first-run choice.

### Current State

- **Resolved.** First run is a short wizard of six steps: intro, a two-page walkthrough, personalisation, permissions, synchronisation, then launch. The intro greets and shows the product — app icon, fumis scattered loose in the frame. The walkthrough's first page animates the primary features, its second lists the rest. Personalisation shows all ten swatches and applies the selection live. The notification authorisation and the launch-at-login offer sit on the permissions step; sync gets its own page with one large centred toggle, pre-enabled when an account is present, falling back to a disabled face with a note when there is none. Nothing advances on a timer — every step is an explicit user action — and every configuring step carries a default, so walking straight through lands on the recommended configuration. Nothing is said about which Apple ID sync would bind to, about the macOS login-item banner, or about Files-and-Folders access, which is met lazily when a path in protected territory first arrives. The wizard closes onto a prepared demo fumi, with a small set behind it — seeded only when the local library is empty and the iCloud account holds no fumis, and seeded anyway when that account cannot be reached.
- **Uncertain.** Nothing this topic holds. What remains is the implementer's wording and visual treatment within a fixed shape, plus the outcomes owed back by the four concerns routed to siblings.
