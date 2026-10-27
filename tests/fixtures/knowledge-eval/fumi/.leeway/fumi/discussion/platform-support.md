# Discussion: Platform Support

## Context

Which macOS versions Fumi supports, what happens on a version that cannot do everything, and how the user finds out.

The topic arrived from gap analysis: three completed artifacts each set a version constraint and none owned the join. Research then ran and closed most of it. What this discussion inherits is a narrower and stranger position than the intake framing suggests — the range is *decided* but *unlanded*, and the thing that was expected to be the hard constraint turned out not to constrain anything.

**The range is macOS 15+, and it is a constant rather than a policy.** The user set it on 2026-08-30 in `space-homing`'s discussion, and confirmed on 2026-09-02 that it is *"fixed at 15 for now, revisited after release, or when the new OS ships"* — no auto-raise, no rolling security-patch window. The reason is the Space-placement route, not CloudKit: Chromium restricts `NSWindowRestoresWorkspaceAtLaunch` to macOS 14 and earlier and uses the private `NSWindowRestorationOptions` from 15 onward, so a 14 floor risked two implementations inside the supported range. Apple's numbering jump means the two versions that exist above the floor today are **15 and 26**. *(Amended 2026-09-11, resolves review-001 F5 — this originally read "the range is exactly 15 and 26 — two versions", which reads as a closed set and is not what Fumi enforces. The range is a floor with no ceiling; see* Range Ownership *below.)*

**Two constraints that were expected to bind, and do not.**

- *CloudKit.* `CKSyncEngine` is annotated `API_AVAILABLE(macos(14.0), ios(17.0), tvos(17.0), watchos(10.0))`. Re-measured 2026-09-11 against SDK 26.5: `grep -B6 'interface CKSyncEngine :' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/CloudKit.framework/Headers/CKSyncEngine.h"` → the annotation sits six lines above the `@interface`, behind `NS_REFINED_FOR_SWIFT`, `CK_SUBCLASSING_RESTRICTED` and `NS_SWIFT_SENDABLE`. *(The research file records this with `-B1`, which no longer reaches it and returns the interface line alone — the claim is sound, the recorded command is not.)* Real, but now slack beneath a floor set elsewhere.
- *Liquid Glass.* Every `glassEffect` / `.glass` entry point is `@available(macOS 26.0, *)` with no back-deployment — but the drawn note surface uses none of them. It is a bespoke stack: `border-radius: 14px`, a 1px inset white highlight, a gradient sheen, a `backdrop-filter: blur(40px) saturate(180%) brightness(106%)`. The parameterised blur is `NSView.backgroundFilters` plus a `CIFilter` chain — `API_AVAILABLE(macos(10.5))`, fifteen years below the floor. So `note-window`'s decisions hold on 15 unchanged, and the material does not bind the range.

**What research settled that this discussion should not re-open.** Degradation on placement failure is `space-homing`'s decision, reached 2026-08-30 and independently restated by the user here: silent graceful fallback to the current Space, logged, never surfaced — except on an explicit target (`fumi new --space 7`), where the caller gets a loud error. There is **no kill switch** — rejected outright on the argument that on the AppKit route the disabled state and the broken state are the same state. Diagnostic logging is `engine-architecture`'s: Apple's unified log, no Fumi-owned file, a **Copy Diagnostics** export placed in `management-window`.

**What research explicitly left for a decision.** Whether *this* topic states the range as a product fact or defers to `build-and-release`, which `space-homing` named as the recorder and which has never run a session. And the untested half of the floor: nothing has run on macOS 15 — a macOS 15 VM was offered and declined as premature (*"I don't want to pull a macOS 15 VM down at this stage"*) — while Sparkle's appcast requires a three-part `major.minor.patch` minimum, so Fumi asserts `15.0.0` by default.

**What research declined and left recoverable.** Population share by OS version, the Intel/architecture axis, a breakage-rate model, and a sweep of the decided corpus for stale version pins — all raised by review, all deferred as *not now*. The last is the one flagged as most likely to bite, because an unnoticed pin surfaces at implementation rather than in review.

**The framing the user gave, which governs how the above should be read:**

> *"What I don't want to do is over-stress about support, but I want us to set things up in a way that facilitates a proper, well-structured system with minimum support, and the ability to test this stuff as and when we get to that point. But we need to build it and release it first."*

**The build order, stated 2026-09-11 and governing everything below.** The user's goal is to build Fumi so it works on the machine they use — macOS 26 — and perfect it there, with older-version support a later concern: *"I'm really not fussed right now about locking in rules like this."* This does not move the floor: the supported range is still macOS 15.0.0 and above, and `Range Ownership` below states it as the product fact. What it does is set where effort goes and when — macOS 26 is the development target, macOS 15 is a supported version that gets looked at before release rather than designed around now. Findings in this topic that ask for a support matrix, an architecture claim, a verification checklist or a pre-purchase caveat are answered against this: state the minimum the range needs and leave the rest until there is something to run.

### References

- `.workflows/fumi/research/platform-support.md` — completed research, read in full
- Discovery map item `fumi.discovery.platform-support` — no brief was generated; the item `description` served as the carrier
- Cited throughout the research and consumed as decided ground: `space-homing` (discussion), `note-window` (discussion), `engine-architecture` (discussion), `storage-and-sync` (discussion), `build-and-release` (triage queue, no session yet)

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. Not every subtopic needs its own section — minor items resolved in passing can be folded into their parent. The Discussion Map (which subtopics exist and their states) lives in the manifest, not this file.*

---

## Asserted Vs Tested Floor

### Context

Fumi will claim "requires macOS 15 or later" against zero evidence on macOS 15. Every measurement in the project — `space-homing`'s placement probes, this topic's SDK header reads, the SkyLight symbol sweep — was taken on one arm64 machine running 26.5.2, later 26.6.2. `space-homing` recorded the gap as its fourth risk and drew the span explicitly: 15 through 25 is unexercised for the hook name itself, for `NSWindowWorkspaceID` inside the restorable-state blob, for the synthesised two-key archive, for the empty-string Space-1 identity, and for both SkyLight read symbols.

It also named who prices it: *"How much verification a supported range earns, and what a user on the oldest supported version is promised, is the product-facing matrix — `platform-support`'s, which has not run."*

The gap cannot be closed by deferring the number. The bundle's minimum system version and Sparkle's appcast both need one from the first build, and Sparkle requires `major.minor.patch`, so a number is asserted long before anything verifies it.

### Options Considered

**Ship and let the release be the test.** Sparkle's `feedParameters` reports every installed machine's exact OS triple on each update check, so the first release produces the real distribution with no analytics service. A placement failure on 15 arrives as a support contact with a log.
- Pros: costs nothing; the data only exists after shipping anyway.
- Cons: the claim is made before it is true, and the first person to find out is a user.

**Ship, but don't claim parity.** Same binary; the download page and release notes state that Space homing is verified on 26 and untested below it.
- Pros: the claim matches the evidence.
- Cons: publishes a caveat about a feature that may work fine, and prices a matrix the user declined to build.

**Verify at release-candidate time.** The macOS 15 VM was declined on 2026-09-05 as premature. "Premature" was true when there was no ship date; it stops being true when there is an RC.
- Pros: the claim is tested before it is made, and nothing is held up now.
- Cons: adds a step to a release process that has never run.

**Assert 26 and drop 15.** One version, fully verified.
- Pros: every claim backed by measurement.
- Cons: reverses the 2026-08-30 floor call and cuts the audience for a feature that would have degraded quietly anyway.

### Journey

The fork was framed as a release gate — verify, or ship untested — and that framing was wrong in a way that made the decision look more expensive than it is.

**A failing review needs no code change.** `space-homing`'s degradation decision covers a macOS version where the hook never resolved and a macOS version where Apple broke it as the same state: the hook vends nothing, restoration runs, windows open where the user is standing. Notes, positions, sizes and recorded homes are all intact. There is no branch to write, no fallback to build, no notice to design — it is the decided behaviour already, reached by a different door.

*(Amended 2026-09-11, resolves review-001 F1 — this originally read "`NSClassFromString` returns nil, the hook vends nothing…", which is the class-absent failure and cannot occur on macOS 15. The private `NSWindowRestorationOptions` class **exists** from 15 onward — that is the reason the floor is 15 at all, recorded in the Context above — so on the untested version the hook resolves and the mechanism runs. What bounds the failure there is `space-homing`'s `Placement Verification` decision rather than the class's absence: each window is placed, shown, and read back, and the restore burst's aggregate predicate treats one window off as noise and all of them off as a diagnosis, logged either way and never surfaced. The user-facing outcome — fumis on the wrong Space, everything else intact — is identical, so the decision below is unchanged; the reason it was argued from was not the one that applies on 15.*

*One failure mode considered and withdrawn: a restoration that stops partway, returning some fumis and not others. It cannot arise. `space-homing` set `restorable = NO` and drives restoration itself — each window is created by Fumi and handed a synthesised two-key archive Fumi built, rather than a captured blob replayed by AppKit — so there is no single OS-driven transaction to fail halfway, and no parse of stored state that a different macOS could reject.)*

So the review is not a gate. It is fact-finding that tells you what to write on the download page, and its failure case costs a number in an appcast at most.

That collapsed the remaining question to a product one: on a macOS 15 where fumis don't come back to their Spaces, does the user get Fumi with a degraded feature, or not get Fumi?

The argument for keeping them: Space homing is a feature of Fumi, not the point of it. A fumi that stays put, syncs, and is addressable by an agent is still the product on macOS 15 — it is a lesser Fumi, not a different one. Dropping the version pays a real audience cost to avoid a silent degradation already ruled acceptable when Apple causes it, which would be holding macOS 15 to a standard macOS 27 is not held to.

*Sibling check: `space-homing` — its `OS Range And Degradation` decision holds that on an OS where the placement hook does not resolve, homing degrades to fumis opening on the current Space, logged, nothing surfaced, and the fix ships in an update. It explicitly defers what a user on the oldest supported version is promised to this topic, so this decision answers its forward pointer rather than contradicting it.*

### Decision

#### 2026-09-11 — revised
*Trigger: review finding — the release-candidate check as written covers Space return, while the reason for keeping macOS 15 rests on everything else working there (review-001 F2).*

**Settled by derivation** — not argued. The user declined to weigh this and every finding after it, instructing that the calls be made rather than put to them (*"can you make sensible choices here. I don't really care"*, 2026-09-11). Determined by the build order above and by the demonstrated volatility of the borderless-window surface.

**The pre-release macOS 15 check is a sitting with the app, not a specified checklist.** Install the release candidate, open a fumi, use it — drag it, resize it, type in it — quit, relaunch, see what comes back. Anything obviously broken shows up in that; nothing is enumerated in advance and no pass/fail criteria are written now.

The finding is right that the narrow version tests the surface with no demonstrated volatility while skipping the one with a track record: a fumi is a borderless window with a custom style mask, and that surface broke twice inside macOS 26 alone — windows unresizable, borderless windows not receiving clicks or dragging, clicks falling through to the desktop, one of them landing between a release candidate and the final build of the same point release. Using the app for two minutes covers that; a checklist adds nothing a look would miss.

**Sync and first run stay out of it.** Both need an iCloud account and a clean machine, which turns a look into a setup exercise. They are carried as untested on macOS 15 rather than verified.

**Rejected: specifying what the pass covers.** Writing the criteria now prices a support matrix the build order above explicitly defers.

#### 2026-09-11 — revised
*Trigger: settled call — the decision above says when macOS 15 gets verified but not what number ships in the meantime, and the bundle needs one from the first build.*

**Settled by derivation** — not discussed. Determined by the decided floor (15, user's call 2026-08-30) and Sparkle's documented requirement that `sparkle:minimumSystemVersion` be a three-part `major.minor.patch`.

**Fumi asserts `15.0.0` from the first build.** The bundle's `LSMinimumSystemVersion` and the appcast's minimum both carry it, and both are set long before any verification runs. No evidence distinguishes 15.0 from any later point release — the point-granularity lean was closed during research when two of its three exhibits fell — so the floor's three-part rendering is its own number with zeroes, not a hedge. Deferring verification to release-candidate time changes nothing about what ships in the meantime.

*Sibling check: `build-and-release` — has never run a session. Its triage queue holds eleven entries, three of them on this ground: `009` (the floor moves to macOS 15), `010` (enforcing the OS minimum at install and update time), `011` (Sparkle carries the point-precise floor and free OS telemetry). None is opened, so nothing there contradicts this; `011` is where the three-part requirement originates.*

#### 2026-09-10

**Verification of macOS 15 happens before release, not now.** The macOS 15 VM stays declined at this stage. The check runs against a release candidate: install it on macOS 15, quit, relaunch, and see whether fumis return to their Spaces. Second-hand hardware is the fallback if a guest WindowServer turns out not to answer it.

**The review is fact-finding, not a gate.** It cannot block the release, because its failure case is a state the design already handles.

**If Space homing does not resolve on macOS 15, macOS 15 stays supported and homing degrades there.** The user gets notes, sync, the agent surface and every other behaviour; fumis open on the Space they are standing on. This is `space-homing`'s decided fallback applied to a version rather than to a regression.

**Rejected: raising the floor to 26.** It reverses a decided call to avoid a degradation already accepted when Apple causes it. Holding macOS 15 to a standard macOS 27 is not held to.

**Confidence: high on the shape, unknown on the outcome.** Nothing has run on macOS 15 and nothing here predicts what will. What is settled is that the answer changes what Fumi says, not what Fumi does.

**Live, and outside this decision:** macOS 27 was due on Apple's September cadence and today is 2026-09-10. If it ships before Fumi does, the range becomes 15/26/27 and the unexercised span widens rather than narrows.

---

## Range Ownership

### Context

The floor was decided on 2026-08-30 and delivered to `build-and-release` to record, because `space-homing` correctly ruled the project-wide constraint was not its to hold. `build-and-release` has never run a session. Its discussion queue holds eleven entries, three on this ground — `009` (the floor moves to macOS 15), `010` (enforcing the OS minimum at install and update time), `011` (Sparkle carries the point-precise floor and free OS telemetry) — and `001`, which predates all of them, still carries the superseded 14.

So the project's most load-bearing number is decided, correct, and written down nowhere a later phase reads. Research named the fork and declined to settle it alone: *"Whether this topic states the range itself or defers to `build-and-release` is a real fork, and it is not this file's to settle alone: `build-and-release` was named as the recorder by the topic that made the change."*

### Options Considered

**This topic states it.** `platform-support` becomes the document that says what the range is; `build-and-release` keeps enforcement.
- Pros: the number lands now, in the topic whose name is the question.
- Cons: two documents end up adjacent to the same subject, and a reader has to know which is which.

**Defer wholly to `build-and-release`.** Nothing here states the range; its eventual session reconciles all of it.
- Pros: follows the delivery `space-homing` actually made.
- Cons: nothing records the number until a `fresh` topic with eleven queued entries runs.

### Journey

The case for deferring is that it is what the record nominally says should happen — `space-homing` named `build-and-release` as the recorder, and the delivery was made properly.

What broke it is that *recorder* and *decider* were being treated as the same role. `build-and-release/010`'s own text says so, in as many words: *"What is settled and not in question. The project floor is macOS 15+… This concern does not reopen either."* It goes on to ask what a user on macOS 14 meets at download and launch, which bundle key governs the refusal, and whether the download page states the requirement. That is a question about **enforcement** — where the number is written and what a below-floor user meets — and it is genuinely `build-and-release`'s, because it is a property of the release, not of the product's supported set.

What the number *is* is a different question, and it is this topic's by name.

So the split is clean rather than awkward: this topic states the supported set as a product fact; `build-and-release` states where that fact is enforced and what happens to someone outside it. Both already exist as separate asks; they were only conflated because one document was doing neither.

*Sibling check: `build-and-release` — no session has run. Its queue entry `010` opens by declaring the floor settled and explicitly out of its own scope, then asks only the enforcement question. This decision agrees with that framing rather than contradicting it, and takes nothing `010` claims.*

### Decision

#### 2026-09-11 — revised
*Trigger: review finding — the supported set is stated in versions only while every measurement behind it ran on one arm64 machine (review-001 F8).*

**Settled by derivation** — not argued, under the same standing instruction as the entries below. Determined by the range being a version statement and by Apple still shipping macOS 15 to Intel Macs.

**The support claim is versions-only and carries no architecture dimension.** "Requires macOS 15 or later" means exactly that, for any Mac Apple ships macOS 15 to. There is no Apple-silicon qualifier in the claim.

**That commits the build to running on both architectures**, which is the one consequence worth naming: a versions-only claim plus an arm64-only build is a false claim to an Intel user on macOS 15, and Apple still ships macOS updates to Intel Macs. A universal build is the default and costs nothing to keep at this stage, so the claim is made on the assumption it stays one. Research records architecture as *"currently unknown and unowned anywhere in the epic"*, so the build has not in fact been decided either way. *Rerouted to `build-and-release` triage (2026-09-11).* If it ships Apple-silicon only, the correction is owed back here and the claim gains an architecture qualifier — a note on the download page does not fix it.

**Not the same question as the support matrix.** How many users are on Intel, what share sits on which version, and what a breakage-rate model would say were all declined as not-now and stay declined. This is only whether the stated claim has an architecture axis. It does not.

*If the build later turns out to be Apple-silicon only, the claim changes with it — that is a correction owed here, not a caveat to add to the page.*

#### 2026-09-11 — revised
*Trigger: review finding — the "don't claim parity" option was written up with pros and cons and then never disposed of in the Decision (review-001 F3).*

**Settled by derivation** — not argued, under the same standing instruction. Determined by `space-homing`'s silent-degradation reasoning, which a permanent website caveat contradicts.

**Nothing is claimed beyond the system requirement.** "Requires macOS 15 or later", and no footnote anywhere — download page, release notes, System Requirements line — about Space homing being verified on 26 and untested below it.

**Rejected: publishing the parity caveat.** It contradicts a decision already made rather than merely costing effort. `space-homing` ruled the degradation silent on the stated grounds that *"a notice that fires on a broken OS release is exactly the kind of thing that ends up firing for the wrong reason."* A line on the website saying Space homing may not work below macOS 26 is that notice, relocated and fired permanently, for a feature that on present evidence probably works. The app stays quiet about it and the website matching is the consistent position, not a gap in one.

The page's actual wording is `build-and-release`'s, already queued there as `010`. This removes an item from that question rather than adding one.

#### 2026-09-11 — revised
*Trigger: review finding — the range was stated as a closed two-version set while the only mechanisms that enforce it are floors, and macOS 27 is weeks away (review-001 F5).*

**The supported range is a floor, open-ended: macOS 15.0.0 and later.** "15 and 26" names the versions that exist above the floor today, never the set Fumi supports. A Mac running whatever Apple ships next is a supported Mac.

**No ceiling, and Sparkle's is deliberately unused.** `sparkle:maximumSystemVersion` exists and would express one. Setting it means that the day a new macOS lands, every existing user silently stops receiving updates — including the update fixing whatever that release broke. A ceiling withholds the fix at exactly the moment it is needed.

This sits with the floor being a constant rather than a policy: nothing rises on its own, and nothing is cut off on its own either. The first real datapoint about a new macOS is the developer's own machine upgrading to it, which is the order the build plan above already describes.

#### 2026-09-11

**`platform-support` is where the supported range is stated as a product fact.** The range is **macOS 15.0.0 and above**, fixed until revisited after release or when the next OS ships — not a rolling window, not tied to Apple's security-update cadence.

**`build-and-release` keeps enforcement, unchanged.** Where the number is written (`LSMinimumSystemVersion`, `sparkle:minimumSystemVersion`), what a user below the floor meets at download and at launch, and whether anything upstream of Apple's own refusal dialog states the requirement — all of that stays queued there as `010` already frames it.

**Rejected: deferring the range itself to `build-and-release`.** It conflates recording a number with deciding it, and leaves the number unwritten until a topic that has never run gets a session.

**Which document is authoritative, when both eventually say something** *(added 2026-09-11, resolves review-001 F4 — settled by derivation, not argued, under the standing instruction recorded above; determined by `build-and-release/010`'s own declaration that the floor is settled and outside its scope)*. This one, for the range. `build-and-release` recording the constraint — which `009` delivers and `010` will act on — is a restatement for the release's own purposes, not a second source of truth; where the two ever disagree, the range stated here is the one that holds and the other is stale. Stating the number here closes the ownership question rather than parking it: `build-and-release` is not waiting to decide anything about the range, only to enforce it.

---

## Stale Floor Propagation

### Context

The floor moved on 2026-08-30 and nothing propagated. Measured 2026-09-11 — `grep -rn -E "macOS 14|macos\(14|14\+" discussion research discovery` under `.workflows/fumi`, discounting this topic's own files — **six sites across three files still assert 14 as the current floor**:

- `discussion/storage-and-sync.md` — four sites, including *"Min macOS = 14+ — confirmed (CKSyncEngine floor; a project-wide constraint → build-and-release / planning)"* in its decided summary (line 543), repeated at 499 and 1904, with 1894 recording the 14+ floor as what it rerouted. Topic status: **completed**.
- `discussion/engine-architecture.md:39` — *"Cross-Mac sync is `CKSyncEngine` (macOS 14+ floor, non-sandboxed, Developer-ID provisioning profile…)"*. Topic status: **in progress**.
- `research/space-homing.md:669` — *"The project minimum is macOS 14+"*. Already has an unabsorbed entry in its own research triage queue (`001-the-research-file-still-states-a-macos-14-floor`) saying exactly this.

Every other hit is either recording the change itself (`space-homing`'s discussion at 103 and 105) or making a true statement about macOS 14.7 and Chromium's version gate. Those are correct and stay.

*(Re-run 2026-09-11, later the same day: the count is now **8 lines across three files**, and none of them is `storage-and-sync` — that topic absorbed this correction while this session was still open and struck or amended all four of its sites. So the command above no longer reproduces the six-site result, and a later reader re-running it should expect the smaller set. `engine-architecture:39` is unchanged, its entry still queued. The measurement is kept as taken because the decision below was made against it.)*

The queue at `build-and-release` holds both numbers simultaneously — `001` carries 14, `009` carries 15 — and `010` records reconciling them as part of its own job.

### Options Considered

**Correct the two discussion documents now, via triage.** Each owning topic gets an entry and amends its own line.
- Pros: the wrong number stops being readable as current before specification consumes it.
- Cons: reopens `storage-and-sync`, which is completed, for a one-line amendment.

**State the range here and leave the stale sites.** This topic is later and more specific; whatever reads the corpus works out which wins.
- Pros: nothing is disturbed.
- Cons: bets that specification notices a contradiction rather than reading the first confident statement it finds.

### Journey

The second option is the one that reads cheapest and is the worst bet. `storage-and-sync`'s line is not hedged — *"confirmed"* — and it names its own downstream route (*"a project-wide constraint → build-and-release / planning"*), so a specification reading it has no signal that anything supersedes it. The failure is silent and lands at implementation, which is exactly where research flagged it: *"an unnoticed version pin surfaces at implementation rather than in review."*

Against that, reopening a completed topic for one line is a real cost but a small one, and it is the mechanism the workflow provides for precisely this.

`research/space-homing.md` needs nothing from here — its own queue already holds the entry, raised when that topic's research next runs.

*Sibling check: `storage-and-sync` — its `CKSyncEngine` 14.0 floor is a true measurement and stays true; what is stale is only its restatement as the project minimum. `build-and-release/009` already recorded that raising the floor to 15 invalidates nothing there, so the correction is to one claim, not to the reasoning behind it. `engine-architecture` — same shape: its parenthetical carries the number incidentally inside a sync decision that is otherwise unaffected.*

### Decision

**Corrections go out to `storage-and-sync` and `engine-architecture`.** Each receives a triage entry naming the sites and the superseding decision; each amends its own document when its session next runs. `storage-and-sync` reopens for it.

*(`storage-and-sync` absorbed its entry the same day and amended all four sites — the `CKSyncEngine` 14.0 availability fact kept, its restatement as the project minimum struck. `engine-architecture`'s entry is queued and unworked.)*

**`research/space-homing.md` is left alone.** Its queue already carries the same correction.

**This is the known-stale set, not an audit.** One grep for a version number found these six sites. Research's declined sweep of the decided corpus — for version pins generally, and for APIs sitting above the floor — is not reopened here.

**The second half of that, stated plainly rather than left implicit** *(added 2026-09-11, resolves review-001 F6 — settled by derivation, not argued, under the same standing instruction; determined by the build order and by the failure mode being a compile-time one)*. "Everything decided so far runs on macOS 15" is an assumption, not a finding. The corpus was checked against the floor at exactly three points — CloudKit's `CKSyncEngine`, the Liquid Glass entry points, and `NSView.backgroundFilters` — each because something in this topic turned on it. That is a sample taken for three specific arguments, never a sweep for APIs sitting above the floor, and no one has read the decided documents looking for a fourth.

It stays a sample. Under the build order above, macOS 26 is the development target and an API that turns out to need 26 surfaces when someone builds against 15 — which is a compile-time failure with a name on it, not a silent one. Running the sweep now would price a matrix that is explicitly deferred, and the thing it would protect against announces itself.

*Distinct from the stale-number problem above, which does not announce itself: a wrong floor compiles fine and ships.*

---

## Capability Resolution

### Context

Research named this the one thread pulled back in from an otherwise-deferred support matrix, and said why: *"Only the thread that had to be settled before code is written: how the app notices for itself that the placement surface stopped working. That is design-shaping rather than support policy, costs nothing to decide now, and is expensive to retrofit."* It arrived on this topic's map on that basis.

### Journey

Working it turned up that every mechanism the thread names is already decided, and decided elsewhere. `space-homing` owns the `SpacePlacement` layer and its single driver seam, and owns place / show / read back / compare with its two predicates — aggregate across a restore burst, per-window against an explicit `--space N` target. Deciding capability resolution here would have put a second account of another topic's mechanisms into this document, competing with the first.

What this topic *did* contribute is the reason the question is sharper than it looked. Correcting the degradation argument (above) established that the class-absent failure cannot occur anywhere in the supported range: the private class exists from macOS 15 onward, which is why the floor is 15. So a capability check written as *"is the class there?"* returns yes on every supported Mac and says nothing about the case that matters — the class present, the hook vending, and the rest of the mechanism behaving differently on a version nobody has run.

That distinction is real and it is `space-homing`'s to act on, against decisions it already holds. It was delivered there on 2026-09-11 with the reference shapes research surveyed — AltTab's member-presence probe on the selector rather than the class, yabai's symbol-table walk, the OS triple logged as a diagnostic and never as a gate.

### Decision

**Nothing is owed here.** Capability resolution is `space-homing`'s, and the residue this topic found was delivered to it rather than decided in this document.

**What this topic keeps** is the constraint behind it: a version check is not the mechanism. The supported range is a product fact stated in this document; it is not a runtime predicate, and no decision recorded here licenses branching on the OS version at runtime.

---

## Summary

### Key Insights

1. **The constraint everyone expected to bind was slack, and the one that bound was never priced.** CloudKit's macOS 14 floor and Liquid Glass's macOS 26 floor were both cited across the corpus as what set the range. Measured, neither does: CloudKit sits below a floor set on the placement route, and the drawn note surface uses no macOS 26 entry point at all. The thing that actually moved the floor was Chromium's version gate on a private AppKit class.
2. **A decision can be real, correct, and have no home.** The floor moved on 2026-08-30 and every document that cited the old number still cited it eleven days later, because the topic named as recorder had never run a session. Recording and deciding were being treated as one role; separating them is what let the number land.
3. **A failure mode chosen for its quietness stopped applying at the moment the floor moved.** The route was picked partly because its failure is silent — the class is absent, nothing is attempted. Raising the floor to 15 guaranteed the class is present everywhere, which retires that failure inside the supported range and leaves a different, less-studied one in its place. The argument survived the correction; its stated reason did not.
4. **Shipping is the instrument.** Sparkle's update check reports every installed machine's exact OS triple, so the first release produces the version distribution that the next floor decision needs. Build, release, then test is not deferring the evidence — it is the only order in which this particular evidence exists.

### Open Threads

- **Nothing has run on macOS 15.** The range is asserted against zero evidence on its own floor. A look at a release candidate before shipping is the plan; it is fact-finding, not a gate.
- **Sync and first run are untested on macOS 15** and deliberately stay outside that look — both need an iCloud account and a clean machine.
- **The corpus has not been swept for APIs above the floor.** Three points were checked because three arguments turned on them. A fourth would surface as a build failure against the deployment target rather than silently.
- **Delivered to siblings:** the project floor correction — `storage-and-sync` (absorbed and amended the same day) and `engine-architecture` (queued); capability resolution's residue (`space-homing`); the colour-and-material checkpoint's effect on macOS 15 (`note-window`); whether the build ships universal, which the support claim depends on (`build-and-release`). The enforcement points — `LSMinimumSystemVersion`, the appcast minimum, and what a below-floor user meets at download — remain `build-and-release`'s, already queued there.

### Current State

- **Resolved** — the supported range as a stated product fact, and that this document states it; the range's shape as an open-ended floor with no ceiling; the three-part number asserted from the first build; what happens if macOS 15 turns out not to home fumis; what the pre-release look at macOS 15 covers and what it does not; what a prospective user is told before downloading; whether the claim has an architecture dimension; where the known-stale floor statements go.
- **Uncertain** — everything about macOS 15's actual behaviour, by choice: the development target is macOS 26 and older-version support is a later concern.
