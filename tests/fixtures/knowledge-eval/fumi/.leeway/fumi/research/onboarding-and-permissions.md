# Research: Onboarding and Permissions

What a new user meets the first time they open Fumi, and which macOS permissions it asks them for.

*Framing corrected 2026-09-15: this document opened describing a permission wizard for the Accessibility grant the Space-homing APIs were assumed to need, plus storage-location setup. Neither exists — no grant is requested and there is no location to choose. The original framing is preserved verbatim under Starting Point as the position the research began from; what the topic actually covers is the line above.*

## Starting Point

What we know so far:
- **Soft decisions from discovery**: a first-run wizard that explains each permission and why, with a button opening the relevant System Settings pane. Storage-location setup and the trial intro ride along as standard parts.
- **The crux**: the permission-request-plus-relaunch has to be flawless. macOS commonly forces a quit after an Accessibility grant, and apps notoriously quit without coming back. Fumi must not.
- **Always-on-engine wrinkle**: a permission-triggered relaunch is not "reopen the app" — it restarts the engine and restores every open fumi exactly as it was, seamlessly.
- **Graceful degradation**: if permission is denied, fumis still work; only Space-homing is lost.
- **Why it is research, not discussion**: the canonical macOS approach here is not known, and this is the biggest non-obvious risk to the product — the signature feature is one denied prompt away from not working.
- **Adjacent settled ground**: the engine architecture (one always-on app over a local socket, thin clients), Space homing (private CGS/SkyLight APIs, Chromium/yabai as reference implementations), and platform support are decided topics whose conclusions this research inherits rather than reopens.

---

### The brief's premise is gone — what first run is actually for

*Session opening, 2026-09-14.*

Two of the brief's three legs do not survive contact with decisions made elsewhere since it was written.

**No Accessibility grant, therefore no permission relaunch.** `space-homing` measured (2026-09-11) that placing your *own* windows on another Space requests no TCC grant of any kind — Accessibility governs controlling *other* applications, and the assumption's origin was ownership mistaken for privilege (yabai's permission story rides with its cross-application technique, which Fumi does not use). `engine-architecture` folded the consequence on 2026-09-02 and struck its own permission-restart accommodation: "there is no permission case: no grant is requested, so this cost is zero and every relaunch is Sparkle's, inherited whole."

The brief's crux — the flawless permission-request-plus-relaunch, and the engine restart restoring every open fumi across it — describes an event that does not occur. The restart-and-restore requirement itself is untouched and still real; it is owned by `restart-and-restore` (engine-architecture), driven by Sparkle updates rather than by anything this topic does.

**No storage-location setup, because there is no location to choose.** `storage-and-sync` locked local-truth at `~/Library/Application Support/Fumi/` (2026-07-31), with CloudKit via `CKSyncEngine` as the v1 transport (2026-07-22, spike-confirmed). Dropbox and a generic folder driver are deferred future drivers behind the sync-driver seam. The topic's own words: "no folder picker in v1 is now trivially consistent — there is nothing to pick."

**What replaces them.** First run's remaining surface, as it now stands:

1. **iCloud account state** — CloudKit sync presumes a signed-in Apple ID. `storage-and-sync` decided the *running* behaviour (no account → keep running on local truth, sync resumes on sign back into the same account; a different account quarantines the current store rather than merging). What first run does about a Mac with no iCloud account — whether it asks, explains, defers, or says nothing — is unexamined. This is a condition to detect and explain, not a permission to request.
2. **The notification permission** — a real TCC ask, in service of whatever `status-and-alerts` settles it needs to tell the user.
3. **The trial intro** — product framing; `commercialization` owns the mechanics (visible metered counter).

The brief's framing — a wizard whose job is to obtain a grant the signature feature depends on — no longer describes any of these. Whether first run is still a wizard at all is open.

### iCloud sync as a start-up opt-in — the user's shape, and what it has to absorb

*2026-09-15. Supersedes the "state it once, plainly" option floated earlier this session, which presumed a first-run surface that does not exist.*

**User's direction (stated, not yet a discussion decision):** start-up offers iCloud sync as an opt-in. The user toggles it on or leaves it off, and the screen states the consequences of each side — what syncing gives you, what not syncing costs you. Their choice.

This is architecturally coherent: `storage-and-sync` made the local store authoritative and sync a transport over it, so a Fumi that never syncs is a complete product rather than a degraded one. The toggle is genuinely offering a choice, not gating the app.

Three things the shape has to absorb.

**The state is ternary, not binary.** Signed into iCloud with sync on; signed in with sync off; and no iCloud account on this Mac at all. The third cannot be expressed as a toggle position — there is nothing to enable — yet it is the case that prompted the thread (the work Mac, or the Mac signed out entirely). A screen that renders it as a plain off toggle tells the user they made a choice they never made. Open: whether that state is a disabled toggle with an explanation, or a route out to System Settings and back.

**Opting out is not a free deferral.** `storage-and-sync` (account handling, 2026-07-22): "The no-account/local-only store is its own partition (binds to the first account that enables sync)." Everything written during the opt-out period therefore binds to whichever Apple ID is signed in at the moment the toggle is later flipped. The failure: a user opts out *because* the Mac is signed into an Apple ID they do not want their notes on, works locally for months, later flips sync on without reconsidering the account, and the whole store binds to that account. The opt-out screen is honest; the opt-in-later moment carries the actual risk and currently has no surface at all.

**It is a deliberate departure from the platform norm.** Apple Notes and Bear do not ask — they sync when you are signed in, silently. An explicit opt-in adds friction against the stated product principle ("it just works"), and is defensible precisely because Fumi's pitch rests on the user knowing where their notes are. Naming it as a departure rather than letting it read as the obvious default.

**Open on the screen itself:** whether it names the Apple ID ("Sync to *name@example.com*") or speaks generically ("Sync with iCloud"). Naming it makes the wrong-account case visible at the cost of a string; not naming it leaves that case invisible in the exact situation the screen exists to serve.

*Convergence note: this is decision-shaped. Recorded here as the direction and its open edges; the decision itself belongs to this topic's discussion.*

### The disabled face — user's shape, and the states it collapses

*2026-09-15.*

**User's direction:** when iCloud is not signed in, the sync option is simply disabled — it is not Fumi's job to sign the user in. The screen carries a note: to activate sync, sign into iCloud; do it now and the screen refreshes (ideally reactively, without a user action). If they do not sign in, they skip, and sync can be reactivated later. If they are signed in, they sync or they do not.

**What this does not yet cover.** "Signed in or not" is treated as the only axis, and it is probably not the only one. Raised in conversation, held as *unverified* — stated from recollection, not measured:

- **Restricted accounts.** An employer-managed Mac with iCloud disabled by MDM policy, or an account under parental controls. The user may be signed in; the account is simply unusable, permanently. The note "sign into iCloud, then refresh" is then an instruction that cannot be followed, and reads as though the user has misconfigured something.
- **A transient indeterminate state** at launch, before the account status resolves.
- **A per-app iCloud switch** — the account fully available, but Fumi's own sync turned off in iCloud settings. Fixable by the user, but not by signing in.

If these are real, the single disabled face has several causes and only one is answered by "sign in" — which changes what the note can say.

**Reactivity.** The user's "hopefully it automatically just reactively updates" is likely achievable rather than hopeful — the platform notifies an app when the iCloud account changes beneath it. Also held unverified.

**Still unhomed:** the surface where sync is reactivated later. It now serves two populations — those who declined, and those who could not — and it is where the account-binding risk recorded above actually lands.

**Scoped out (user, 2026-09-15):** restricted / MDM-disabled iCloud accounts are not a population Fumi designs for — the user's experience is that employer-managed Macs do not restrict iCloud sign-in, and the case is not worth a screen state. The disabled face therefore serves "not signed in" only.

*Remaining from that thread, as lookups rather than research:* whether the app is notified of a sign-in while running (the user's "reactively updates"), and whether a user can switch Fumi's sync off in iCloud settings while the account stays available. The second matters only as a later-silently-stopped-syncing case, which is `status-and-alerts`' subject rather than first run's.

### What the screen promises

*2026-09-15. Open.*

The user defined the screen's job as stating the consequences of each side. Neither side's content is settled.

**Syncing** is straightforward: your fumis on every Mac you sign into.

**Not syncing** is where the copy can go wrong. The intuitive line — "your notes only live on this Mac" — overstates the risk, because `storage-and-sync` put the store in `~/Library/Application Support/Fumi/`, which Time Machine covers. Declining sync costs the user a second Mac and an off-machine copy; it does not cost them backup. A screen that implies otherwise converts an honest choice into a nudge.

**The open fork, and it governs every word on the screen:** is this a neutral choice presented evenly, or a recommendation to sync with an opt-out? Lean (session): neutral — the reason for putting a toggle in front of the user rather than syncing silently, as Notes and Bear do, is the belief that the choice is genuinely theirs. Presenting it and then leaning on it would be the worst of both.

**Settled (user, 2026-09-15): neutral.** The screen presents the choice evenly — no recommendation, no nudge toward sync. Still open: what each side's copy actually says, within that constraint.

> *(Refined later the same day — see **The framing stance** under *Storage facts the first-run flow must sequence around*. Flat neutrality did not survive: the screen recommends sync and states its positives, while declining to dramatise what declining costs. The reasoning here stands as how the question was worked.)*

### Notification permission — needed for the first-delete education

*From: note-window · discussion · 2026-07-27*

**The entry.** `note-window` dropped the confirm prompt on delete. Deleting a fumi happens immediately — the note animates away and is recoverable from Recently Deleted. The premise changed underneath discovery's original decision: discovery framed delete as "the one destructive act", but `storage-and-sync` then settled soft-delete as a reversible flag (the note keeps syncing, lands in Recently Deleted, and never auto-purges), so deleting stopped being destructive. Validated against the platform — Apple Notes, Mail and Finder all delete with no prompt; the macOS line is *reversible → no prompt; irreversible → confirm*.

What makes dropping the prompt safe is a one-time education: the first time a user ever deletes a fumi, a macOS system notification says *"Deleted. You can always recover this from Recently Deleted."* Shown once, never again. An in-app toast was considered and rejected (a component used exactly once); a system notification is a platform primitive, is the natural voice for a menu-bar app, and persists in Notification Centre if missed.

It landed here because system notifications require user permission — a behaviour `note-window` decided now depends on something first run controls.

**Its three questions are spent.** Whether Fumi requests the permission and when, what else would use notifications, and what denial costs were all overtaken by `status-and-alerts` (queue entry 004, 2026-09-12), which was written to answer them and carries the reasoning. Not re-decided here.

**What this topic inherits, and the user confirmed (2026-09-15):** the first-delete education is *education, not safety*. If the permission is denied the notification simply never appears, and `note-window` accepted that — the safety net is Recently Deleted, no auto-purge, and ⌘Z. **First run must therefore never treat a denied notification permission as grounds to ask harder.** That is a constraint on how hard first run is allowed to push, not merely a degradation note.

*Sibling check: note-window — its 2026-07-27 decided text states the accepted position directly ("if permission isn't granted, the education simply never appears... should not be treated as a reason to force a permission prompt"); this adopts it unchanged as a first-run constraint rather than re-deciding it. status-and-alerts — its 2026-09-12 decision holds the same line from the other side: no re-prompt ever, no menu-bar mark for a denied permission, because a denial is a state the user chose. No conflict.*

### Storage facts the first-run flow must sequence around

*From: storage-and-sync · discussion · 2026-08-04*

Three decided storage facts, sent as inputs rather than questions.

**1. The `.fumi` UTI registers itself on first run.** Declared in the app's `Info.plist` and registered automatically by Launch Services — no user prompt, no onboarding step. The one ordering nuance: on a fresh Mac where note bundles arrive (a restore, or a second Mac syncing) *before* Fumi is installed, those bundles show as plain folders in Finder until Fumi runs once. Automatic and self-healing — awareness for the flow, not a wizard gate. Related, so the flow does not over-promise: with the store in `~/Library/Application Support/Fumi/`, double-click-to-open still works but is not a promoted entry path. Standard macOS install-hygiene edge also noted — Launch Services may bind `.fumi` to an old copy of the app lingering in Downloads.

**2. The sync toggle ships default-OFF and onboarding is where enabling gets encouraged.** v1 is CloudKit-only with no folder picker. Flipping the toggle on triggers a background, non-blocking, resumable bulk backfill with quiet "Backing up… N of M" progress. Toggle off is pause, not destroy — CloudKit data is left intact and re-enabling resumes without re-uploading. There is deliberately no in-app "remove my data from iCloud" action, ever: macOS owns it (System Settings → iCloud → Manage).

**3. No iCloud → no backup, stated rather than worked around.** A macOS account with no iCloud is valid, detected as `CKAccountStatus = noAccount`. Fumi does not offer sync; the app works fully on local truth. Signing in is a macOS action, not a Fumi flow. "No backup" covers window placement as well as note content. Time Machine remains the fallback for a same-Mac wipe-and-restore (store and per-device blob both live in Application Support) and is the only backup leg a sync-off user has — also the only home for assets over the 50 MB `CKAsset` ceiling, kept local-only by design.

#### The framing stance — settled (user, 2026-09-15)

*Supersedes the flat-neutral call recorded earlier this session, which this refines rather than reverses.*

> **Recommend sync. Frame it on what sync gives. Do not dramatise what declining costs.**

The screen is not flat-neutral and not loss-framed. Sync is recommended and its positives are stated; declining stays a real, unpunished option described plainly. In the user's words: *"we don't need to dramatise the negative choice by the user... erring on positive to frame it in a positive way to encourage it, but not negativize it."*

This **reconciles with `storage-and-sync`'s "onboarding asks and encourages enabling it"** — the encouragement stands. What does not survive is the instrument storage reached for.

**Storage's second encouragement leg is the wrong tool, twice over.** It reads: *"with sync off there is no authority to back it up to, so a wipe loses the desk as well as the notes."*

- **It is loss-framed**, which the stance above rules out for first-run copy.
- **It is overstated on storage's own facts.** The same entry records that Time Machine captures both the store and the per-device blob, both living in Application Support. A sync-off user restoring the same Mac therefore recovers the desk *and* the notes. What sync actually buys is a second Mac and a backup leg that is not Time Machine.

~~The desk material survives as a positive — *your notes and your desk follow you to every Mac* — and is dropped as a threat.~~ *(Amended 2026-09-16 — the positive is false on `storage-and-sync`'s own decided mechanism: each Mac keeps its own desk by design, and no Mac reads another's layout. The desk comes out of the encouragement entirely rather than being restated; see **The desk leg is withdrawn, not restated** below, where the reroute came back.)*

**Rerouted to `storage-and-sync` triage (2026-09-15).** The inconsistency above is internal to that topic's own entry — the desk-loss argument against its own Time Machine coverage fact — and was delivered there as `desk-loss-argument-contradicts-time-machine-coverage` rather than worked around here.

*Sibling check: storage-and-sync — its 2026-08-04 entry holds the toggle default-off, onboarding as the place enabling is encouraged, and Time Machine as the sync-off user's only backup leg. The framing stance adopts the encouragement unchanged; only the loss-framed argument is declined, and the factual tension behind it is routed back rather than decided here.*

### The Accessibility permission this topic is scoped around does not exist

*From: space-homing · research · 2026-08-25*

The measurement and its consequence are recorded above (*The brief's premise is gone*), folded at session open from the knowledge base before the queue was worked. Summary of record: macOS 26.5.2, SIP enabled, probes ad-hoc signed with no entitlements and again inside a verified App Sandbox container — moving the process's **own** window between Spaces via `SLSMoveWindowsToManagedSpace` succeeded, succeeded while ordered out (the flash-free primitive), and **produced no TCC prompt of any kind**. The opposite was assumed because yabai's permission story was inherited along with its technique; yabai needs a scripting addition and partial SIP because it moves *other applications'* windows. Reading a window's home Space is public API (`$top.NSWindowWorkspaceID`); display identity is public (`CGDisplayCreateUUIDFromDisplayID`). Only placement is private. The Developer-ID distribution consequence is unchanged.

**The entry's live remainder — "no Accessibility" is not "no permissions at all."** It named three candidates. Worked through, the first-run inventory closes:

| | asks for | note |
|---|---|---|
| Space placement | nothing | measured, above |
| File access to the store | nothing | the entry says "the chosen store folder" — stale; `storage-and-sync` fixed the store at `~/Library/Application Support/Fumi/` on 2026-07-31, and an app writing its own Application Support asks for nothing |
| Notifications | one TCC grant | decided by `status-and-alerts`; queue entry 004 |
| Login-item registration | not a permission | but not silent — see below |

**So first run asks for exactly one permission.**

#### Launch at login — settled (user, 2026-09-15)

> **Offered, recommended, conventionally worded. Declining is unremarkable and unpunished.**

Registering a login item prompts for nothing, but macOS announces it — the user gets a system notification that Fumi was added to Login Items, with a switch in System Settings. That notification is outside Fumi's control and cannot be worded by it.

**The rejected framing, and why.** The session put up a stronger reading — that launch-at-login is constitutive of a notes-on-your-desk product, and should be framed as *"keep your fumis on your desk"* rather than *"open at login"*, because a user who declines restarts to a bare desktop. **The user rejected it, and the argument that carried is the right one: Fumi is an app.** Nobody considers Mail broken because it is not running; you open it. Not running is not a failure state, and the missing fumis and an agent's "Fumi isn't running" are obvious rather than mysterious. The session's framing was also loss-framed — the instrument ruled out under the framing stance above — and it argued against a trade `engine-architecture` had already taken deliberately ("a crashed engine stays dead until the user reopens it... the recovery is one Spotlight invocation").

**Rerouted to `engine-architecture` triage (2026-09-15)** as `launch-at-login-is-a-first-run-choice`: its record treats registration as unconditional — *"`SMAppService.mainApp` registers the app itself for launch-at-login. That is the entire contract"* — with no user opt-in anywhere in the fork it took. Making it a first-run choice changes that assumption and is theirs to absorb.

*Sibling check: engine-architecture — Fork 1 Option A is a plain login item via `SMAppService.mainApp`, and the topic accepts that nothing relaunches a stopped engine. Consent at registration is absent from its record rather than decided against; routed back rather than decided here. space-homing — the measurement is adopted whole, unchanged.*

### Notification permission is decided: asked once up front, framed on backup

*From: status-and-alerts · discussion · 2026-09-12*

**Inherited, not re-decided.** Fumi requests notification authorisation once, during the first-run flow, with its own reason shown before the system dialog, framed on backup: *"Fumi will tell you if your notes ever stop backing up."* Fixed by `status-and-alerts`: that it is asked, that it is asked up front rather than at first use, and what it is asked for. Sequence and wording are this topic's.

**Why the earlier lean (ask lazily, from queue entry 001) flipped.** Two things changed. Notifications stopped being one education nicety — they now carry sync stopped, `quotaExceeded`, a fumi permanently rejected by CloudKit, plus `note-window`'s first-delete education and oversized-file refusal reason; the rejected-fumi case is the sharpest because it is the one message with no other live channel at all. And the permission-fatigue argument lost its first permission when the Accessibility premise evaporated, making an up-front ask affordable rather than greedy.

**Why not lazily** — the worked case that decided it: a new user deletes a throwaway note, macOS interrupts with *"Fumi would like to send you notifications"*, and **Don't Allow** is the reflex because they were deleting something rather than configuring anything. Six weeks later their change token expires and the channel that would have told them is gone. macOS asks once, ever, so a denial at a bad moment has no route back inside the app.

**Denial handling, inherited:** the management window states it once, quietly, where sync state already lives — notifications are off, what Fumi therefore cannot tell them, with a route to the System Settings pane. No re-prompt ever. No menu-bar mark, because a denied permission is a state the user chose. Sync-stopped and `quotaExceeded` keep their menu-bar dot; the first-delete education and oversized-refusal reason simply never appear, which `note-window` accepted for each; the one real loss is a permanently rejected fumi, falling back to the manager's per-note row.

#### The ask is conditional on the sync decision — settled (user, 2026-09-15)

> **⚠ Superseded the same day — see *The ask is unconditional, and under-explained* below.** The user's correction was that notifications are a general capability rather than a sync feature, which removes the premise this whole block rests on. Kept in full as the record of how the question was worked; its conclusion does not stand.

`status-and-alerts` left one point open: the backup framing is not true for every user at first run. The sync toggle ships default-off, so a user who declines sync is shown a reason describing something they do not have — and for them neither backup notification can ever fire. What remains for them is the first-delete education and the oversized refusal, both of which `note-window` explicitly accepted losing (queue entry 001), and which under that entry's constraint may never justify asking harder.

Three shapes were named there and none chosen: ask unconditionally; sequence the ask after the sync decision; or treat enabling sync later as the moment that earns the ask.

> **Sequence the ask after the sync decision, and ask only the users for whom the reason is true.** A user who enables sync is asked, framed on backup. A user who declines sync is not asked at first run at all — Fumi keeps its one prompt for the moment the reason becomes real, which is when they enable sync.

**The reasoning that selected it, and it corrects the entry's own objection.** `status-and-alerts` rejected the third shape because *"a user who enables sync in month three has no route back to a prompt macOS will not show again."* That trap only exists **if the prompt has already been spent**. Never asking the sync-off user *preserves* it. The failure runs the other way: ask them at first run, they decline out of indifference to a reason that means nothing to them, and month three — the moment the reason becomes true — is exactly when they can no longer be asked.

**Knock-on, now moot:** the conditional shape would have introduced a third state — *never asked* — that `status-and-alerts`' two-state denial handling had no words for. The unconditional ask below removes that class entirely; nothing was routed, because there is nothing left to route.

*Sibling check: status-and-alerts — its 2026-09-12 decision fixes that the permission is asked, asked up front, and framed on backup, and explicitly hands sequencing and wording here, naming this shape among three. Adopted within what it handed over; the third-state knock-on is routed back rather than decided here. note-window — its accepted position that the first-delete education may never justify pushing for the grant (queue entry 001) holds and supports the conditional shape.*

### The trial intro

*2026-09-15. Open — session lean recorded, user had not yet formed a position.*

The third leg of the original brief, and the only one still standing unexamined. `commercialization` owns the mechanics (one-time ~$19, no subscription, a visible usage-metered premium counter); the question here is what first run does about it.

**Session lean: first run does not explain the pricing model.**

- **The counter cannot work at first run.** It is conversion-forward by design — the user watches the runway shrink *while getting value* and decides the runway is worth buying. That requires usage to have happened. At first run there are zero fumis, nothing has been written, and what counts as a premium action is itself undecided (`commercialization`, parked). "You have 10 premium uses left" shown before any use reads as *here is the catch*, spending the mechanic at the only moment it cannot do its job. Discovery already flagged the adjacent version of this: a visible counter makes the parked "what's premium" decision more load-bearing, or watching it tick down just confuses.
- **First run is already accumulating, and this is the only non-load-bearing step.** The flow now holds the sync offer, the notification ask sequenced behind it, and the launch-at-login offer — three decisions before a new user has written a single fumi. Each of those three configures how the product behaves. A pricing screen would be a fourth that configures nothing.
- **The honest minimum instead:** one line acknowledging that Fumi is a one-time purchase with a free allowance, so nobody can claim ambush later. Not a screen. The counter introduces itself at the moment it first matters — the first time someone reaches for a premium action.
- **The objection, and why it lands elsewhere:** people dislike discovering an app is paid after investing time in it. True, and the answer is the landing page rather than a first-run screen. The user arrived from somewhere, and "one-time, no subscription" does selling work — it belongs where selling happens, not where interrupting happens.

**Dependency that would reverse this:** if `commercialization` lands on premium being something a user meets in the first few minutes, the counter starts ticking before any judgement of the product has formed, and a prior word becomes necessary. Theirs to decide; recorded here as a real dependency rather than an assumption.

## If Fumi never requests notification authorisation at first run, can it still raise the system dialog months later when the user enables sync — or does "macOS asks once" foreclose a deferred first ask? — deep-dive-001, 2026-09-15

### Answers

**The deferred first ask works, and `status-and-alerts`' stated reason for rejecting it is wrong.** The prompt is triggered by the app's first *call*, not by the app's age, install date, or launch count. Apple's reference: *"The first time your app calls the method, the system prompts the person to authorize the requested interactions... Subsequent calls to this method don't prompt the person again."* Nothing in the reference, the companion article, or the class overview conditions the dialog on first launch or elapsed time.

The stronger evidence is that **Apple instructs developers to defer it**: *"Make the request in a context that helps people understand why your app needs authorization. In a task-tracking app that sends reminder notifications, you might make the request after the person schedules a first task. Sending the request in context provides a better experience than automatically requesting authorization on first launch."* The HIG generalises it — *"wait to request permission until people actually use an app feature that requires access"*, *"avoid requesting permission at launch"*. Fumi's proposal (ask when the reason becomes true) is Apple's recommended pattern, not a workaround.

**What "once" actually is.** The one-shot is consumed by the app making its first authorisation request, which records a response and moves the app out of `.notDetermined`. Two propositions were collapsed in the sibling's text:

- **True:** once the app has made an authorisation request, no later request will prompt.
- **False:** once the app has been installed or running for some period, no request will prompt.

Denial is a *spent* one-shot. Deferral is an *unspent* one. Precision worth carrying: `granted: false` covers "denied" **and** "undetermined" — the durable fact is the authorisation status, not the boolean.

**Never-asked is durable.** No documented mechanism resolves `.notDetermined` on an app's behalf. The decision is keyed to the app and survives deletion and reinstall (stored in `com.apple.ncprefs.plist`, not the TCC database — which is why `tccutil reset` does not touch notification permissions). One documented exception, administrative rather than systemic: an MDM `com.apple.notificationsettings` payload can write state for a bundle ID by fiat. Irrelevant here — managed Macs are already scoped out.

**Nothing else spends the one-shot — except a dependency.** Constructing `UNUserNotificationCenter.current()`, setting a delegate, and registering categories do not prompt and do not register the app. But an Apple engineer on the developer forums, answering exactly this confusion: *"If you are not making this request in your app, it's possible that a third-party library you're using has implemented that request even though your app doesn't do anything with notifications. The only way to eliminate the pop-up is to remove the code that calls requestAuthorization()... whether yours or a third party's."* The deprecated `NSUserNotification` delegate path is a second hazard. **A single such call anywhere in Fumi's dependency graph spends the prompt before the user reaches the sync decision and silently defeats the whole design.** Whether `add()` while undetermined errors, drops silently, or alters the status is not documented — carried as a measurement.

**A never-asked app has no row in System Settings ▸ Notifications** — inference from convergent sources rather than Apple citation, but consistent across every source and contradicted by none. This is stronger than the session's reading and changes the shape of the argument:

- The user **cannot** grant Fumi notification permission manually, because there is no control to grant it with.
- A deep link to the Notifications pane opens a list Fumi is not in. Any "route to System Settings" copy is **wrong** for the never-asked state in a way it is not wrong for the denied state.
- The reserved prompt is therefore not merely preserved — it is the **sole remaining door** to notifications for that user.

**macOS specifics.** Four differences from iOS:

1. **Provisional authorisation is not a free preview.** `.provisional` exists on macOS 10.14+, but it *silently self-grants on first call and spends the one-shot* — the explicit Allow/Don't Allow dialog will then never be shown for that app. The decision moves to Keep/Turn Off buttons on a delivered notification. Its documented behaviour is written iOS-first and its macOS behaviour is thinly evidenced.
2. **macOS has a user-initiated reset iOS lacks** — selecting the app in System Settings ▸ Notifications and pressing Delete returns it to `.notDetermined`. Developer lore rather than Apple documentation, but if it holds for shipping apps it **qualifies `status-and-alerts`' "a denial has no route back"**.
3. **Notifications require a user-context app.** DTS: not possible from a system-level daemon or launch agent. Fumi's `LSUIElement` app in the user's GUI session satisfies this; the launchd-agent shape `engine-architecture` rejected would not have.
4. `.ephemeral` is the App Clip mechanism and has no macOS analogue.

**No change across the supported floor.** macOS 15 and macOS 26 release notes contain no UserNotifications authorisation changes; API availability is macOS 10.14+ throughout with no revisions or deprecations. The macOS 26 change is cosmetic — permission dialogs restyled for the new material.

### Material

**The documentary chain.** Apple documentation carries: the prompt binds to the first call; subsequent calls never prompt; deferral is recommended; `.notDetermined` means no choice has been made; provisional self-grants silently. Apple engineers (forum threads [694619](https://developer.apple.com/forums/thread/694619), [804854](https://developer.apple.com/forums/thread/804854)) carry: `requestAuthorization` is the only thing that raises the prompt, third-party libraries are a known accidental trigger, and a user-context app is required. Reputable third parties carry: the decision persists across reinstall and lives in `ncprefs`, not TCC. Developer lore carries the two weakest links — that a never-asked app has no settings row, and that deleting the row resets to `.notDetermined`.

Primary sources: [`requestAuthorization` reference](https://developer.apple.com/documentation/usernotifications/unusernotificationcenter/requestauthorization(options:completionhandler:)) · [Asking permission to use notifications](https://developer.apple.com/documentation/usernotifications/asking-permission-to-use-notifications) · [`UNAuthorizationStatus`](https://developer.apple.com/documentation/usernotifications/unauthorizationstatus) · [HIG Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) · [WWDC18/710](https://asciiwwdc.com/2018/sessions/710) · [macOS 15](https://developer.apple.com/documentation/macos-release-notes/macos-15-release-notes) and [macOS 26](https://developer.apple.com/documentation/macos-release-notes/macos-26-release-notes) release notes · [ncprefs storage](https://mrmacintosh.com/how-to-manage-catalinas-new-application-notifications-with-a-profile/) · [reset procedure](https://sarunw.com/posts/how-to-reset-push-notification-permission-on-macos/) · [never-asked app absent from Settings](https://github.com/anthropics/claude-code/issues/73370) · [launch-time caching bug pattern](https://github.com/charliek/roost/issues/355).

**A second implementation hazard the dive surfaced.** A shipping macOS app was reported reading authorisation status once at launch and caching it, so a permission change afterwards stays invisible until restart. Apple's guidance is the opposite — *"always check your app's authorization status before scheduling local notifications... People can change your app's authorization settings at any time."* An always-on engine that never restarts is precisely the shape that makes this bite.

**Opened lines folded as notes rather than threads.** Provisional authorisation's real macOS behaviour matters only if a silent self-grant is ever considered, which it is not. The MDM payload question is moot — managed Macs are scoped out. The never-asked-has-no-settings-row consequence is already carried by the third-state tangent owed to `status-and-alerts`; this dive supplies the platform reason its wording cannot be shared with the denied state.

**Limitations the dive states plainly.** The no-settings-row finding is inference from a DTS statement, one dated third-party report, and developer lore — consistent everywhere, cited nowhere by Apple. The durability of `.notDetermined` over the long tail is an argument from silence. Nothing was compiled, run, or observed on a machine.

### Sequence the notification permission ask after the sync decision

*From: status-and-alerts · discussion · 2026-09-12*

The entry made the ordering binding rather than this topic's: the ask comes after the sync decision so its backup framing is true when it appears. It also explicitly rejected asking only the users who enable sync, on the grounds that *"macOS asks once, so a user who enables sync in month three never sees a prompt and Fumi cannot raise one."*

**That platform claim is false** — see *deep-dive-001* above. The one-shot is spent by asking, not by elapsed time; a never-asked app can raise the dialog whenever it likes, and Apple recommends deferring the ask to the moment the feature is used.

**But the conditional shape it rejected is abandoned anyway, for a better reason than either topic had.**

#### The ask is unconditional, and under-explained — settled (user, 2026-09-15)

> **Fumi asks for notification authorisation once, during setup, for everyone. It does not depend on the sync decision in any direction. The ask is not explained or justified at length — it is an ordinary notification permission.**

**Why the conditional shape was wrong at the root (user's correction).** Both queued entries, and this session's own reasoning on top of them, treated notifications as a sync feature. They are not. Notifications are a general capability — *"they're just notifications that happen to be used mostly for syncing, but not exclusively."* The first-delete education is not sync. Neither is anything added later. Conditioning the permission on the sync toggle would weld two unrelated choices together: a user who declined sync would have silently also declined notifications, permanently, without ever being told that is what they had done.

Fixing the framing dissolves the problem this entry existed to solve. `status-and-alerts` only needed a sequencing constraint because the backup framing was false for sync-off users; a framing that describes what notifications actually are is true for everyone, and the ordering constraint goes with it.

**Why up front rather than in context, despite Apple's guidance.** *deep-dive-001* established that Apple recommends asking when the feature is used, and their worked example is a reminders app asking after the person schedules a first task — a feature the user has just opted into. Fumi's notifications are the opposite: things nobody asked for, wanted only when something has gone wrong. The in-context moment *is* the failure. Sync breaks, and instead of telling the user, Fumi would show a permission dialog and hope for a yes to what reads as an interruption — and a no means they never learn what happened. `status-and-alerts` had already worked the identical trap for the first-delete case. **In-context works when the context is a feature; it fails when the context is bad news being delivered.** Up front is also the ordinary shape for a Mac app, which is the user's own second argument for it.

**Do not over-explain it (user).** The ask is not framed as *"Fumi will tell you if your notes ever stop backing up"*, and is not accompanied by an enumeration of what notifications are used for. *"They're just notifications. It's pretty standard stuff. We don't have to over-explain these things to the user."*

#### Corrections rerouted to `status-and-alerts` (2026-09-15)

Both of that topic's queued entries are wrong at the root. Delivered as three separate triage entries, so each can be taken or refused independently:

1. **The backup framing (entry 004)** — *"with its own reason shown before the system dialog — framed on backup"* — is rejected. Notifications are general; the framing made a general permission look like a sync feature, and was false for any user without sync.
2. **The sequencing fix (entry 005)** — ordering the ask after the sync decision — is moot once the framing is corrected, and its stated reason for rejecting a deferred ask is factually wrong (deep-dive-001).
3. **The pre-dialog rationale screen** that entry 004 fixed does not survive the under-explain steer, and is theirs to reconsider rather than this topic's to quietly drop.
4. **"A denial has no route back inside the app"** is narrower than stated — macOS lets a user delete an app's row in System Settings ▸ Notifications, which resets it to never-asked. Developer lore rather than Apple documentation, and carried as a measurement.

Landed as `notification-framing-is-not-about-backup` (items 1 and 2), `the-pre-dialog-reason-screen` (item 3), and `a-denial-may-have-a-route-back` (item 4). The first delivery reopened that topic, which was `completed`.

*Sibling check: status-and-alerts — its 2026-09-12 entries fix that the permission is asked, asked up front, framed on backup, and sequenced after the sync decision. "Asked, once, up front" survives and is adopted. The framing, the sequencing rationale, the pre-dialog reason screen, and the no-route-back claim do not, and are routed back rather than rewritten here. note-window — its position that the first-delete education may never justify pushing for the grant is untouched; an unconditional ask that is never repeated does not push.*

**Supersedes** the conditional-ask position recorded earlier today under *Notification permission is decided* — that fold's reasoning stands as the record of how the question was worked, and its conclusion is replaced by this one.

### The shape of first run

*2026-09-15. Superseded 2026-09-16 — see the amendment at the foot of this section.*

**First run is not a wizard.** The word carried over from the discovery brief, where it described walking a user through obtaining an Accessibility grant. With that premise gone, and with storage having nothing to set up (no folder picker — the store location is fixed) and the pricing model deliberately unexplained, there is no sequence left to walk.

What remains is two choices and one system dialog:

| | what it is | default |
|---|---|---|
| iCloud sync | toggle | off (`storage-and-sync`), recommended, positively framed |
| Launch at login | toggle | recommended |
| Notification permission | macOS system dialog | fires for everyone, unconditional, unexplained |

**Derived shape: a single screen.** Two toggles, then Continue, with the notification dialog firing on the way out. Nothing about this needs steps.

**Both toggles carry defaults, so Continue-without-touching-anything is a complete path.** That matters: it is the only real defence against three decisions standing between a new user and writing their first fumi. Someone who wants to start writing is through in one click.

**Not settled, and remaining open:**
- The screen's actual copy on each side of the sync choice, within the recommend-but-don't-dramatise framing.
- What the screen is *called* and what its opening moment is, if anything precedes the choices.
- Whether the notification dialog firing on exit from the screen is the right moment, or whether it should follow the first fumi.

*Provenance: derived by the session from the decisions above after the user declined to pick a direction ("whatever"). Recorded as a lean so a later sitting can take or reject it deliberately rather than inherit it by default.*

#### Superseded — the single screen was taken, then dropped (2026-09-17)

*From: status-and-alerts · discussion · 2026-09-15*

> Your research record carries the single-screen first-run shape — two toggles (iCloud sync, launch at login), then Continue, with the notification dialog firing on the way out — under *The shape of first run*, marked *"Session lean — derived, not confirmed by the user, who left it open"*, with the provenance line *"derived by the session from the decisions above after the user declined to pick a direction ('whatever'). Recorded as a lean so a later sitting can take or reject it deliberately rather than inherit it by default."* Your Open Threads still lists it as a decision the discussion owns: *"Is the single-screen shape right — two toggles plus the notification dialog on exit — and what precedes it, if anything?"*
>
> **The user has since stated it as settled.** Working the pre-dialog-reason-screen concern in `status-and-alerts` today, they answered a proposal about where the notification dialog sits with: *"I thought we had agreed elsewhere to have a single screen which handles it all in one go? I cant keep repeating myself."*
>
> That is the user taking the lean rather than the session deriving it again. Whether their recollection matches how your sitting actually ended is beside the point — they have now said it plainly, and your record's own reason for holding it as a lean (so a later sitting takes or rejects it deliberately) is satisfied.
>
> **What this asks of you:** update the shape's provenance from derived-lean to user-settled, and close the Open Threads entry that asks whether the single-screen shape is right. The two sub-questions that entry bundles are *not* answered by this and should survive as their own threads — what the screen is called and what, if anything, precedes the choices; and whether the notification dialog firing on exit from the screen is the right moment, or whether it should follow the first fumi.
>
> **Why it comes from `status-and-alerts` rather than staying where it was said.** The shape is yours, and this topic only cites it. It became load-bearing here: the decision that Fumi draws no screen of its own before the system notification dialog rests in part on there being no position in a single-screen first run for one. That decision also stands on a second, independent argument — a macOS user has answered the dialog many times, and an app staging its own explanation in front of it treats an ordinary platform ask as though it needed defending — so nothing in `status-and-alerts` collapses if the shape later moves. The citation is recorded there with this reroute noted beside it.

**The promotion is not available, because the shape did not survive the day after.** The user reversed it on 2026-09-16 after seeing Raycast's onboarding in their own install, and the discussion recorded a five-step wizard in its place — intro, a walkthrough of what a fumi is and does, permissions, synchronisation, then launch onto the prepared demo fumi. So the arc is: derived by the session on the 15th, taken by the user, and dropped by them on the 16th. What closes the thread is the reversal, not the confirmation.

**Both sub-questions the concern asked to keep open are answered by the same move.** What precedes the choices is the intro and the walkthrough, which is what the single screen had no room for and is what changed the judgement. And the notification dialog no longer fires on exit from a screen: it belongs to the wizard's permissions step, with the walk continuing to the sync page afterwards.

**What the citing topic depends on is unaffected.** Its decision to draw no Fumi screen in front of the system dialog also stands on an argument that has nothing to do with the shape — a macOS user has answered that dialog many times, and staging an explanation in front of it treats an ordinary platform ask as though it needed defending. The wizard gives the dialog a step of its own rather than a moment on the way out; it does not give it a reason screen.

**Direction has since gone further, not back.** The user brought eleven screenshots of Dockset's onboarding on 2026-09-17 — see *Visual reference — Dockset's onboarding* — proposing content for the intro and walkthrough steps and a personalisation step the wizard does not yet have. The design has moved on from the question this concern was asking.

### Platform lookups — account-change notification, and what can spend the notification prompt

*2026-09-15. Sources fetched in-session; nothing measured or run.*

**1. Fumi is told when the iCloud account changes — with one condition that is a real trap.**

CloudKit posts `CKAccountChanged` when the account status changes — sign in, sign out, and the iCloud Drive capability switch being turned on or off. So the user's *"hopefully it automatically just reactively updates"* is achievable rather than hopeful: the sync screen can enable itself the moment the user signs in, with no refresh action.

The condition: **the notification is posted by a `CKContainer` instance, and if no instance is alive when the status changes, no notification is posted at all.** The app must hold a reference to the default container for as long as it wants to hear about changes. For an always-on engine this is natural, but it is a silent failure if missed — the screen simply never updates and nothing indicates why.

> "When the account status changes, a `CKAccountChanged` notification is posted by an instance of the `CKContainer` class... If no instance is alive when the account status changes, no notification is posted. That's why I recommend that you keep a reference to the default container."
> — [Handling Account Status Changes With CloudKit, Cocoacasts](https://cocoacasts.com/handling-account-status-changes-with-cloudkit); [`CKAccountChanged`, Apple](https://developer.apple.com/documentation/foundation/nsnotification/name/1399172-ckaccountchanged)

**2. Can a user switch Fumi's sync off while the account stays available? — not settled.**

macOS System Settings ▸ Apple ID ▸ iCloud lists third-party apps and lets the user turn each one off; on macOS 13.3+ the control is *"Apps Syncing to iCloud Drive"*. Apple's own guide does **not** distinguish apps storing documents in iCloud Drive from apps syncing their own data through CloudKit's private database, and says nothing about whether the latter appear in that list.

So whether a user can reach in and switch Fumi's sync off — while the account itself stays perfectly available — is unresolved from documentation. It matters because that state is sync silently stopping for a reason Fumi did not choose and may not distinguish from a failure. Carried as a measurement. *(Source: [Set up iCloud for third-party apps, Apple Support](https://support.apple.com/guide/icloud/set-up-third-party-apps-mmfeb236a772/icloud).)*

**3. Neither Sparkle nor CloudKit spends the notification one-shot — but Sparkle documents a pattern that would.**

- **Sparkle does not call `requestAuthorization` itself.** Its gentle-reminders documentation shows the *host app* calling it. Adding Sparkle does not cause a prompt the author did not write.
- **But Sparkle recommends a moment that is wrong for Fumi.** Its sample has the app request authorisation inside `updater(_:willScheduleUpdateCheckAfterDelay:)` — *"This delegate method will be called when Sparkle schedules an update check in the future, which may be a good time to request for notification permission."* Following that pattern would fire Fumi's one prompt at an updater-scheduled moment instead of during first run. The hazard is a footgun in the documentation, not in the code. *(Source: [Gentle Update Reminders, Sparkle](https://sparkle-project.org/documentation/gentle-reminders/).)*
- **CloudKit sync needs no notification permission.** `CKSyncEngine`'s change notifications are silent pushes — `shouldSendContentAvailable` on the subscription's notification info, no alert, badge or sound. Silent notifications are invisible to the user and require no authorisation. So the sync machinery never touches the one-shot.

**4. Whether a menu-bar app that is not frontmost can raise a noticeable dialog — moot.** The question existed only for the deferred/conditional ask, which was abandoned: Fumi now asks everyone during first run, when the app is frontmost and the user is looking at it. Parked rather than carried.

### The desk leg is withdrawn, not restated — and the positive it was to be restated as is also false

*From: storage-and-sync · discussion · 2026-09-15*

You reported the internal inconsistency in this topic's 2026-08-04 entry — the desk-loss argument for encouraging sync against this topic's own fact that Time Machine captures the per-device blob — and asked which of the two facts is wrong. It has been settled here the same day.

**Your reading of which fact is wrong is correct.** Time Machine does capture the blob; the fact stands and is load-bearing elsewhere in this topic (the blob was deliberately placed apart from the disposable index *so that* Time Machine would capture it distinguishably). **The desk-loss argument is the wrong statement, and it has been withdrawn here** — the 2026-07-31 addendum that created it is amended, and the "not durable" phrasing beside it now carries its Time Machine qualifier.

**The half you have already taken for your copy does not survive either, and that is the part worth your attention.** Your entry records the material surviving as a positive — *"your notes and your desk follow you to every Mac"* — and dropped only as a threat. That line is false on this topic's decided mechanism, more plainly than the loss-framed one it replaces:

> **Each Mac keeps its own desk, deliberately. Placement is per-device state; no Mac reads another Mac's layout.** The per-device record's whole shape rests on that — one record per device, each device its record's exclusive writer, chosen over per-note records precisely because *"nobody queries another Mac's layout"* and the addressability the alternative bought was addressability no reader wanted. The one field other Macs read is the machine's display name, narrowed and recorded as an exception in 2026-08-23. Recents differ per Mac by design for the same reason.

So the desk does not follow you anywhere. What the settings-zone copy of the blob is *for* is a **restored machine** — read once at first launch there — not a second one.

**And on the case the argument was reaching for, sync is the weaker of the two legs, not the stronger.** The device key is the hardware platform UUID, and this topic already records that a restore onto **replacement hardware** gets a new UUID and *"starts on defaults"*. Time Machine has no such limit: the blob file is the local authority and its map is keyed by note, not by machine, so restoring it onto replacement hardware restores the desk. The leg that was written to argue *sync saves your desk* loses to Time Machine in exactly the scenario a user is most afraid of.

**What sync genuinely adds for the desk, stated so nothing is overclaimed:** it covers a user with no Time Machine, and it is the recovery source when the blob file itself is unreadable (the settings-zone document is the second legitimate read of the zone; with no zone, placement falls back to defaults). Both real, both narrow.

**The decision here: the desk leg comes out of the encouragement entirely rather than being restated.** Three carve-outs — true only without Time Machine, does not travel to other Macs, loses to Time Machine on replacement hardware — is three too many for one line of first-run copy, and your own settled stance (*recommend sync, frame it on what sync gives, do not dramatise what declining costs*) is better served by a leg that needs no footnote. **The notes leg is untouched and carries the recommendation on its own:** your fumis on every Mac you sign into, and an off-machine copy of them.

**Nothing of yours is contradicted beyond that one line.** The framing stance, the toggle default-off, onboarding as the place enabling is encouraged, and "no iCloud → no backup" all stand exactly as you have them. Your "What the screen promises" thread is if anything reinforced — its observation that declining costs *"a second Mac and an off-machine copy; it does not cost them backup"* is precisely right, and now holds for the desk as well as for the notes.

**If you want a desk line anyway**, the only true one is narrow enough to judge for yourself: *sync backs up each Mac's arrangement, so a restored Mac comes back the way you left it.* Recorded as available rather than recommended — whether it earns space on the screen is yours.

#### Taken here — the desk comes off the screen (user, 2026-09-16)

**The sync screen promises the notes alone.** *Your fumis on every Mac you sign into, and a copy of them off this one.* The desk is not mentioned on either side — not as a positive, not as a cost of declining.

The narrow true line was put to the user and not taken. It is recorded as available rather than dead: *sync backs up each Mac's own arrangement, so a Mac you wipe and restore comes back the way you left it* — true, and scoped to the same Mac, since replacement hardware gets a new platform UUID and starts on defaults whatever sync holds. What ruled it out of first run is subject rather than truth: it is a promise about surviving a dead machine, and the screen in front of the user is about working on more than one.

This leaves the sync screen's positive side a single sentence, which is the point — the notes leg needs no carve-out, and every desk sentence needs at least one.

*Sibling check: storage-and-sync — its per-device-settings decision holds that each device is its record's exclusive writer and that no Mac queries another Mac's layout, with the machine's display name recorded as the one narrowed exception; the withdrawal adopts that mechanism rather than re-deciding it, and its own 2026-09-15 entry records the desk leg as withdrawn rather than restated. note-window — its positioning decisions treat a home as intent resolved per machine, which is the same property seen from the window side; nothing there is touched.*

### Visual reference — Dockset's onboarding (user, 2026-09-17)

Eleven screenshots the user captured from **Dockset**, a custom-Dock app for macOS, stored under `imports/`. A longer wizard than Fumi needs — its page indicator shows roughly nine steps — brought here for the shape of its opening and for two of its middle pages, not as a template to copy whole.

- [`dockset-01-explore.jpeg`](../imports/dockset-01-explore.jpeg) — the opening page. App icon centred, *"Explore Dockset."* in a large serif, two lines of explanation under it, and the product's own widgets scattered loose around the frame at slight angles. Step indicator bottom-left, primary action bottom-right (*Start Tour*, with a `↩` affordance).
- [`dockset-02-tour-profiles.jpeg`](../imports/dockset-02-tour-profiles.jpeg) — a tour page. Left: a category chip, a two-line serif title, a one-line explanation, then a stack of selectable rows (*Menu bar*, *Keyboard shortcut*, *Focus mode*), each an icon, a name and a one-line description, with a progress bar running under the selected one. Right: an animation showing that feature in the real interface. The rows advance themselves on the timer.
- [`dockset-03-choose-setup.jpeg`](../imports/dockset-03-choose-setup.jpeg) — a configuration choice: three radio rows, one pre-selected, each with a name and a one-line consequence.
- [`dockset-04-essentials-colour.jpeg`](../imports/dockset-04-essentials-colour.jpeg) — *"Start with your essentials"*: name field, a row of ten colour swatches with the current one ticked, then two dropdowns and a checkbox.
- [`dockset-05-material-liquid-glass.jpeg`](../imports/dockset-05-material-liquid-glass.jpeg) and [`dockset-06-material-picker-open.jpeg`](../imports/dockset-06-material-picker-open.jpeg) — *"At home on your desktop"*: a segmented above/behind control, a live preview, and two dropdowns (*Dock material*, offering Frosted and Liquid Glass; *Glass style*, set to Regular — its other values were not opened). The preview redraws as the material changes.
- [`dockset-07-more-than-apps.jpeg`](../imports/dockset-07-more-than-apps.jpeg) — the tour layout again for a second feature set.
- [`dockset-08-pick-widgets.jpeg`](../imports/dockset-08-pick-widgets.jpeg) — a full-width picker, six cards in two rows, each a live preview plus a name and a line of description, two pre-selected. *"Choose at least one widget to start with."*
- [`dockset-09-permissions.jpeg`](../imports/dockset-09-permissions.jpeg) — permissions: a row per item, icon, name, a *"Why this permission?"* link beneath, and a control on the right — checkboxes for what is switchable, *Allowed* as text for what is already granted. Open-at-login sits in the same list.
- [`dockset-10-ready.jpeg`](../imports/dockset-10-ready.jpeg) — *"Your Dock is ready"*, a page with nothing else on it.
- [`dockset-11-landing.jpeg`](../imports/dockset-11-landing.jpeg) — the result, shown in the frame, with *"Make changes anytime in the Dock Manager."* under it.

**What the user took from it**, in their own terms:

**The opening.** *"Explore Fumi"* with the app icon and fumis dotted around the frame, the way Dockset scatters its widgets — the product showing itself rather than describing itself. The step indicator bottom-left carries over; Fumi's would show fewer steps.

**The tour.** Dockset's tour page is the shape the user liked: a short list of features as selectable rows on the left, each with its own timer, and an animation on the right showing that feature working. A few of Fumi's things, shown rather than listed.

**A personalisation step.** *"Start with your essentials"* is a candidate Fumi has content for — showing the swatches, and introducing that a fumi has a colour and can be customised. What else would sit on that page is open.

**The tinted frame.** The wizard's background carries a wash of the currently-selected colour — heaviest bottom-left, lighter top-left, just inside the window's edge — and it changes as the user picks a different one. The user singled this out. What Fumi would put in that space is open, and is specific to the onboarding surface rather than to the note surface.

**The material page, and the part that reaches beyond this topic.** The user liked how the glass is *presented*: an outer container holding two widget tiles with a small grab handle at its right edge, each tile its own inner box, a browser window behind showing through and refracting at the edges and through the middle, and text sitting legibly on top of it. Fumi discarded Liquid Glass, and the user's reaction to this page is that **frosted glass may be worth reintroducing**, with a version-dependent fallback — Liquid Glass where macOS has it, frosted or similar where it does not. That is the note surface's material, not first run's, and it is rerouted rather than explored here. Rerouted to `note-window` discussion triage (2026-09-17), which reopened that topic. The user may install the app and capture more of it.

**Not applicable, noted anyway.** The widget picker's full-width card grid and its *choose at least one* requirement have no Fumi equivalent, but the layout was flagged as reusable if a step ever needs it.

**Where it lands against what is already decided.** The discussion settled a five-step wizard on 2026-09-16 — intro, walkthrough, permissions, synchronisation, launch. This reference does not contradict that order; it fills two of its steps in (what the intro looks like, what the walkthrough does) and proposes a third the current shape does not have (personalisation). The user's own ordering note — sync after permissions — matches the settled order. Whether the wizard gains a step is the discussion's to take.

## Open Threads

Everything this research did not close, for the discussion to pick up. Answers to threads already learned are in the body above.

**Decisions the discussion owns** — research surfaced the landscape and a lean on each; none is settled:

- **What do the wizard's intro and walkthrough steps actually contain, and does the wizard gain a personalisation step?** *(Open.)* Opened 2026-09-17 by the Dockset reference and entirely unsettled — the five-step wizard fixes the order and names the steps, and nothing fills them. The candidates the user named: an *"Explore Fumi"* opening with the app icon and fumis scattered loose in the frame; a walkthrough built as selectable feature rows on the left, each self-advancing on a timer, with an animation of that feature on the right; and a *"start with your essentials"* step showing the swatches and introducing that a fumi has a colour. Also open: what fills the wizard's colour-tinted background, which follows the current selection. See *Visual reference — Dockset's onboarding*.
- **Within a recommend-sync-but-don't-dramatise framing, what does the sync page actually say on each side?** *(Open.)* The framing stance is settled; the words are not. Two lines to avoid: *"your notes only live on this Mac"* overstates the cost, because Time Machine covers the store — declining sync costs a second Mac and an off-machine copy, not backup; and any promise about the desk, which does not travel between Macs by design (see *The desk leg is withdrawn*). The notes leg carries the recommendation alone.
- **How does the start-up sync opt-in handle the no-iCloud-account state, and does it name the Apple ID it would bind to?** *(Open.)* The face is settled — a disabled option with a note, reactive on sign-in, skippable, no route out, because it is not Fumi's job to sign anyone in. What is open is whether the page names the account: naming it makes the wrong-account case visible for the cost of a string, and not naming it leaves that case invisible in the exact situation the page exists to serve.
- **Where does the user turn sync on after opting out, and what does that surface tell them about the account their local store is about to bind to?** *(Open — the largest hole.)* That surface does not exist anywhere yet, and it is where the real risk lands: `storage-and-sync` binds the local-only store to the first account that enables sync, so a user who declined *because* the Mac was signed into the wrong Apple ID can bind a year of notes to it by flipping a toggle without thinking. The opt-out page is honest; the opt-in-later moment carries the consequence.
- **Does first run say anything about the pricing model, and if so what?** *(Open.)* Session lean: no pricing screen — the metered counter cannot mean anything before any usage, and first run already carries three decisions. One line at most, and the walkthrough step is where it would go. Reverses if `commercialization` puts premium within the first few minutes; the ball is already with that topic.

**Measurement, not discussion:**

- **Does a CloudKit private-database app appear in System Settings' iCloud app list, so a user can switch Fumi's sync off while the account stays available?** *(Open.)* Apple's guide does not distinguish CloudKit private-database apps from iCloud Drive apps, so no amount of reading settles it — it needs a machine. Matters as a silent-sync-stop case, which is `status-and-alerts`' subject.

**Parked, with the reason:**

- What is the clean way for a macOS app to relaunch itself after a permission grant — helper process, launchd, `open(1)` — and which approach survives sandboxing and notarization? — parked: no permission grant means no permission relaunch; `restart-and-restore` owns the Sparkle-driven case.
- How does the always-on engine restart across a permission relaunch and restore every open fumi — position, Space, content — with no visible seam? — parked: owned by `restart-and-restore` (engine-architecture); no first-run relaunch to survive.
- What is the canonical macOS pattern for asking for these permissions — when to prompt, how to deep-link System Settings, how to detect the grant without polling badly? — parked: premise gone. One permission, an ordinary dialog, deliberately unexplained; no deep-link or multi-permission problem left.
- Does a menu-bar-only agent that is not frontmost raise a visible, unmissable dialog months into the app's life? — parked: moot, the ask happens at first run with the app frontmost; the deferred shape was abandoned.

**Two implementation hazards to carry forward** — neither is a decision, both bite silently:

- `CKAccountChanged` is posted *by a live `CKContainer` instance*. Hold no reference and the app is never told the account changed — the sync page simply never updates, with nothing to indicate why.
- Sparkle's own documentation recommends requesting notification authorisation inside `updater(_:willScheduleUpdateCheckAfterDelay:)`. Following that pattern spends Fumi's one prompt at an updater-scheduled moment instead of during first run.
