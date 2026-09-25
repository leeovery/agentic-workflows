# Discussion: Engine Architecture

## Context

Fumi's runtime shape: **one always-on process, four clients**. A single ordinary macOS app (`LSUIElement`, registered for launch-at-login via `SMAppService.mainApp`) stays running and owns the data model, the storage layer, the note windows themselves, and the private-CGS Space-pinning, and exposes a local socket. The `fumi` CLI, the `fumi-mcp` server, the menu-bar manager and the note windows are all thin clients over that one engine — **three surfaces in-process (the note windows, the menu-bar manager and the management window) and two over the socket**. *(Tally corrected 2026-08-20 — this read "two of them in-process, two over the socket", omitting the management window, which `change-notification` establishes is in-process and treats as structural rather than incidental. Discovery's "one engine, four clients" framing stands; the count beneath it was wrong.)* Single writer, one source of truth.

*(Amended 2026-08-12 — this read *"a single `LaunchAgent`"*, which `process-model`'s Fork 1 reversal overturned on the same day: there is no launchd agent, no plist and no supervision. The reversal was walked through every decided block and did not reach this paragraph, which is the description a reader takes from the topic first.)*

This topic owns the *runtime seam* — what the engine is, how clients reach it, what happens when it restarts or dies. It does not own the agent-facing command grammar (→ agent-surface), the store layout (→ storage-and-sync, decided), the window chrome (→ note-window, decided), or the permission wizard (→ onboarding-and-permissions, research).

### Inherited position (discovery brief, soft)

Carried forward as working ground, not re-litigated. Findings here may move it; nothing re-elicits it on entry. *(One of them did: the `LaunchAgent` bullet below was **superseded 2026-08-12** by `process-model`'s Fork 1 reversal. It is left as written because this block records what discovery handed over, not what the topic concluded.)*

**Soft decisions**

- ~~A single **always-running `LaunchAgent`** (`LSUIElement`, launch-at-login, does **not** quit when note windows close) owns the data model, storage, the note windows **and** the private-CGS Space-pinning, and exposes a **local socket**.~~ **Superseded 2026-08-12** — everything in this bullet holds except the mechanism: Fumi is an ordinary always-running `LSUIElement` app with a plain login item, not a launchd agent. See `process-model`.
- The `fumi` CLI and `fumi mcp` server are **thin clients** over that socket. "**One engine, four clients**": note windows, menu-bar manager, CLI, MCP server are all skins over one operation core — engine quality compounds across all four.
- **Single writer** (the engine) → one source of truth.
- **Menu-bar-first**: `LSUIElement`, no dock icon by default, with an option to *also* show a dock icon the user can toggle off. Fixes the Stickies dock-slot annoyance (present-but-unseen).
- Sequencing: design for both CLI + MCP from day one; ship the **CLI first** (trivially agent-usable, easiest to test), the MCP wrapper follows.
- Precedent: `yabai` (private-Spaces manipulation via a socket-driven launchd service — the reference for our hardest part), Ollama, Docker/Tailscale/espanso (daemon + thin clients).

**Rejected paths**

- **CLI cold-launches the GUI on demand** — wrong for a scripting-first product (cold-start latency; UI wakes when you wanted to script quietly).
- **CLI writes the store directly** — two writers + duplicated storage logic; breaks the one-engine principle.
- **Splitting a pure headless daemon from the UI** — a pure daemon can't own or move Fumi's own note windows (CGS ops act on the caller's own windows; a pre-login `LaunchDaemon` can't draw), so the window-owner is **not** split from the engine; they are one always-on agent.

**Open questions carried in**

- The app↔client transport specifics (unix socket vs alternatives).
- The always-on-engine **restart/relaunch that restores every open fumi** seamlessly — shared with onboarding-and-permissions (permission relaunch) and build-and-release (auto-update relaunch).

### Constraints arriving from decided siblings

Decided elsewhere; binding here unless a finding overturns them at their own topic.

- **storage-and-sync** — the engine is sole writer of the store *and* of the SQLite read-model index (`~/Library/Application Support/Fumi/`); CLI/MCP/windows go through it, never directly, which is what makes WAL safe. **No FSEvents in v1** — nothing outside the engine writes the store. Cross-Mac sync is `CKSyncEngine` (available from macOS 14.0, non-sandboxed, Developer-ID provisioning profile for the iCloud entitlements); single-writer is *per-Mac*, CloudKit reconciles across machines. **The project floor is macOS 15.0.0 and above**, and `CKSyncEngine`'s own availability sits slack beneath it. *(Amended 2026-09-11 — this read "`CKSyncEngine` (macOS 14+ floor…)", restating CloudKit's availability minimum as the project's. The user moved the floor to 15+ across the board on 2026-08-30 in `space-homing`, on the Space-placement route rather than on sync — Chromium restricts `NSWindowRestoresWorkspaceAtLaunch` to macOS 14 and earlier and uses the private `NSWindowRestorationOptions` from 15 onward, so a 14 floor risked two implementations inside the supported range — and confirmed on 2026-09-02 that the floor is a fixed number rather than a policy. `platform-support` decided on 2026-09-11 that it is the document stating the range as a product fact. The 14.0 availability measurement is unchanged and stays — re-measured 2026-09-11 on the macOS 26.5 SDK: `` grep -B6 'interface CKSyncEngine :' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/CloudKit.framework/Headers/CKSyncEngine.h" `` → `API_AVAILABLE(macos(14.0), ios(17.0), tvos(17.0), watchos(10.0))`. The concern arrived citing the same check with `-B1`, which does not reach the annotation — it sits four lines above the `@interface` behind `NS_REFINED_FOR_SWIFT`, `CK_SUBCLASSING_RESTRICTED` and `NS_SWIFT_SENDABLE`. The claim held; the recorded command did not reproduce it. Nothing else in this entry moves.)* The engine records sync state (syncing/paused/stopped, per-note synced/pending/rejected) and store-size-on-disk; management-window renders them. A launch **reconciliation walk** exists and gains rules (e.g. Time-Machine bundle drop-in → treated as a deliberate local edit).
- **note-model / storage-and-sync** — asset add is **one atomic engine operation** (bytes + manifest entry + content token); the wire counterpart publishes as one batch.
- **storage-and-sync (attribution)** — the engine knows the write's channel from *the connection it arrived on* (`app` | `cli` | `mcp`); nobody asserts it and nobody can spoof it. Engine-originated snapshots (dirty flush, pre-restore, pre-resolution) attribute the *work captured*, not the trigger.
- **note-window** — agent writes to open notes are the normal case; the dirty predicate is derived from synced inputs so it is *correct by construction across engine restart*, SQLite rebuild, and Macs.
- **build-and-release** ~~/ onboarding-and-permissions~~ — ~~both~~ depends on a seamless engine restart that restores every open fumi. *(Amended 2026-09-02 — onboarding-and-permissions no longer does: space-homing measured that no permission grant is requested to place windows on Spaces, so the permission relaunch this constraint was half-sourced from does not exist. A Sparkle update is the sole restart driver.)*

### References

- `.workflows/fumi/discovery/briefs/engine-architecture.md` — the discovery brief (carrier)
- `.workflows/fumi/discussion/storage-and-sync.md` — decided; store, index, sync transport, attribution
- `.workflows/fumi/discussion/note-model.md` — decided; bundle format, UID, self-containment
- `.workflows/fumi/discussion/note-window.md` — decided; window behaviour, editing model, concurrent agent writes
- `.workflows/fumi/discussion/agent-surface.md` — decided; the CLI/MCP verb set, the read token, the error-code vocabulary *(was the discovery brief, listed as undiscussed; updated 2026-09-14)*
- `.workflows/fumi/discussion/status-and-alerts.md` — decided; which classes of message exist and which channel carries each
- `.workflows/fumi/discovery/briefs/onboarding-and-permissions.md` — sibling, research; permission relaunch
- `.workflows/fumi/discovery/briefs/build-and-release.md` — sibling; Sparkle update relaunch
- `.workflows/fumi/discussion/space-homing.md` — decided; Space placement, the readiness predicate, placement verification
- `.workflows/fumi/discussion/platform-support.md` — decided; the supported range as a product fact (macOS 15.0.0 and above), and the degradation story the diagnostic path serves

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. The Discussion Map lives in the manifest, not this file.*

---

## Process Model

### Context

The brief says "a single always-running `LaunchAgent`" and moves on. That word carries more than it looks: on modern macOS at least two different mechanisms are loosely called launch-at-login, and they differ on exactly the property this product is most exposed on — whether anything brings the process back when it goes away.

Everything else in this topic hangs off the answer. Supervision, the seamless relaunch two sibling topics already treat as a hard requirement, the number of bundles Sparkle has to keep in step, and how many axes version-skew has are all downstream of it.

#### The post-permission-grant restart this topic re-homed does not exist

*From: space-homing · research · 2026-08-25*

This topic raised the question itself on 2026-08-12 ("Do the private Space APIs actually need the Accessibility permission?") and routed it to space-homing. It is now answered: **no Accessibility grant — no TCC grant of any kind — is required to place Fumi's own windows on Spaces.** The doubt as stated was correct. This entry delivers the answer back, because a decision here was propped on the assumption.

**What was measured.** macOS 26.5.2 (build 25F84), SIP `enabled`, on the user's own machine. Probes compiled and run ad-hoc signed with no entitlements, and again inside a real App Sandbox container (engagement verified via `NSHomeDirectory()` landing in `~/Library/Containers/…/Data`, `sandbox_check` positive, `~/Documents` writes denied).

Moving the process's **own** window between Spaces with `SLSMoveWindowsToManagedSpace`: succeeded; succeeded while ordered out; succeeded inside the sandbox; **produced no TCC prompt of any kind** (not Accessibility, not Screen Recording, not Automation); needed no scripting addition and no SIP change.

The assumption's origin was ownership, not privilege — as this topic's own entry suspected. yabai's scripting addition and partial-SIP requirement exist because yabai manipulates *other applications'* windows; its gate `workspace_use_macos_space_workaround()` (`src/workspace.m:17`) treats the plain path as unusable on macOS 15+, the exact OS where it was measured working here for an own window. OS version and SIP state were constant across both; ownership was the variable.

**What this asks of this topic.** The 2026-08-12 decision replaced the launchd agent with a plain login item, and one consequence that had to be re-homed was the restart after a permission grant — previously *"drain, exit non-zero, launchd brings it back"*, reassigned to the onboarding wizard. **If no grant is ever requested, that restart may not be a requirement at all**, and the accommodation made for it can be reconsidered.

Two cautions before treating it as removed:

1. "No Accessibility" is not "no permissions". The measurement covers Space placement specifically. First-run may still involve file access to the user's chosen store folder, notifications, or login-item registration — `onboarding-and-permissions` holds a parallel entry and owns that scoping.
2. A restart mechanism may still be wanted for reasons unrelated to permissions — Sparkle updates being the obvious one, since the always-on engine has to come back after an update. The question is whether *the permission-grant restart* specifically is still a driver, not whether restart handling exists at all.

**Not in question:** the App Store consequence is unchanged. Every route to placing a window on a non-active Space is private API, so Developer-ID direct distribution stands. Only the runtime permission story changed.

#### The crash-stays-dead argument rests on the menu-bar icon being present, and it may not be

*From: status-and-alerts · discussion · 2026-09-12*

The Fork 1 reversal accepted that **a crashed engine stays dead until the user reopens it**, and the argument it rests on is that the failure announces itself:

> *"Fumi's crash announces itself: every note on every Space vanishes at once and the menu-bar icon goes with them. Recovery is ⌃Space, 'Fumi', Enter. A loud failure with a two-second recovery does not need a supervisor; a silent one does."*

That was contrasted against Keyboard Maestro, which *"dies silently, and the user finds out weeks later"*, and generalised into this topic's first Key Insight: **protect the invisible failure, not the important one.**

**What that session established.** `status-and-alerts` built its standing surface on the premise that the menu-bar icon is the one part of Fumi always on screen, and had to retract the word *always*. macOS truncates status items when the menu bar runs out of room — on a notched laptop with a dozen of them, Fumi's may simply not be drawn — and users of this class of app routinely hide status items themselves. That was accepted there as a residual with no mitigation available: a menu-bar app has no other always-visible surface, forcing the item to be non-hideable fights the user for a slot macOS may take regardless, and Fumi cannot reliably detect that it is not being drawn, so it cannot fall back either.

**The consequence for this topic.** If the icon can be absent while Fumi is perfectly healthy, then **absence is not the signal the crash-stays-dead argument treats it as.** The argument has two legs and this affects them unevenly:

- *Every note on every Space vanishes at once* — untouched. A user with fumis open still sees them all disappear, and that remains a loud failure.
- *The menu-bar icon goes with them* — weakened. For a user whose icon was never drawn, the icon going is not observable, so this leg contributes nothing.

The case where the weakening bites is a user with **no fumis currently open** and a truncated or hidden status item. The engine dies, nothing on screen changes, the next `fumi` CLI call returns *"Fumi isn't running"* to an agent, and the human finds out when they next try to open a note. That is closer to the Keyboard Maestro failure the reversal was explicitly reasoning against than the argument allows for.

**What is not being asked.** This is not a case for reinstating `launchd` or `KeepAlive` — that reversal rests on more than this one clause, and the second leg still carries a great deal. It is a correction to a stated premise, raised because a decision was propped on it and because this topic set the standard of naming which half of a dying argument a conclusion survives on. The ask is to weigh whether the conclusion still holds with that leg discounted, and to record which half it stands on either way.

*(`status-and-alerts` accepted the same fact as a residual rather than engineering around it, softened its own claim from *the icon is always on screen* to *the only part of Fumi that can be on screen without the user opening anything*, and noted that a truncated icon coinciding with a notification swallowed by Focus mode leaves every channel dark at once. It has three channels to fall back on; this topic's crash detection has the vanishing fumis and nothing else.)*

### Options Considered

Two separate forks, taken in order.

**Fork 1 — what registers the engine at login**

**A. Login item** — `SMAppService.mainApp`. Register the app; macOS starts it at login. That is the entire contract.
- Pros: one line of code, no plist to ship or sign.
- Cons: no supervision. A crash at 11am leaves the engine gone until the user notices their fumis are missing and relaunches by hand. A deliberate relaunch (permission grant, Sparkle update) has to be the app relaunching *itself* — the quit-then-fail-to-come-back bug the brief singles out as the thing the user hates.

**B. launchd agent** — `SMAppService.agent`, plist in `Contents/Library/LaunchAgents/`. Same launch-at-login, plus `KeepAlive` and a first-class restart verb (`launchctl kickstart -k gui/$UID/{label}`).
- Pros: launchd relaunches on crash. Deliberate relaunch stops being the app's own job — the process exits and launchd brings it back, which structurally removes the failure mode the brief names.
- Cons: a plist to ship, sign and keep valid; `KeepAlive` semantics have to be got right or launchd fights every intentional exit.

**Fork 2 — what the plist points at** *(only live under B)*

**1. The main app's own executable** — `BundleProgram = Contents/MacOS/Fumi`. One bundle, one binary, one signature, one Sparkle target; launchd supervises the real app.
- Pros: nothing duplicated. Double-clicking `Fumi.app` in Finder hits an already-running app of that bundle id and activates it rather than spawning a second engine. *(Written as "single-instance comes free"; qualified by **Single instance** below — the guarantee is not inherited.)*
- Cons: launching a `.app`'s executable directly under launchd, rather than through LaunchServices, is not Apple's advertised path.

**2. A helper app inside the bundle** — `Fumi.app/Contents/Library/LoginItems/FumiEngine.app`, the outer bundle a launcher.
- Pros: the documented, blessed-looking shape for a bundled background job.
- Cons: discovery already ruled that the engine draws the note windows and owns the CGS calls — so the helper would *be* the entire product, and the outer bundle would have no job beyond being double-clickable in Finder. Two bundles to sign and notarize; ~~Sparkle replacing a bundle that contains the live process~~ *(struck — review-001 F3: shape 1's single bundle also contains the live process, plus the registered plist, so this cost is shared and discriminates nothing. Worked through under **Update path** below.)*; version-skew gains a second axis before the CLI is even in the picture.

### Journey

**Fork 1 turned on the sibling requirements, not on crash recovery.** Crash-restart is the obvious argument for launchd and it is the weaker one — an always-on engine that crashes often has a bug, not a supervision problem. What decides it is that *two other topics have already committed to a seamless relaunch*: onboarding-and-permissions ("the permission-request + relaunch must be flawless… restart the engine and restore every open fumi exactly as it was") and build-and-release (the Sparkle update relaunch). Under A those are self-relaunch, which is precisely the pattern that fails in the wild. Under B the app never relaunches itself; it exits, and something whose entire job is starting processes starts it. The precedent also lines up — `yabai`, already the reference for the hardest part of this product, is a launchd agent.

**Fork 2 was framed as "which is the sanctioned shape" and that framing was wrong.** The real question is what shape 2's outer bundle would be *for*. Because the engine must draw windows (the rejected daemon/UI split settles that), a helper-engine leaves the outer `Fumi.app` as a stub whose only purpose is to exist in `/Applications` and be double-clicked. Everything shape 2 costs is paid to keep a Finder icon in a separate bundle from the thing it launches.

**A correction landed mid-fork.** `KeepAlive: true` was the initial reading and it is wrong once the update path is in view: plain `true` means launchd restarts the process on *any* exit, so it fights Sparkle for the process on every update and fights the menu-bar Quit as well. `KeepAlive: {SuccessfulExit: false}` is the right shape — restart on crash or signal, respect a clean exit. That makes a deliberate exit authoritative and leaves crash-restart intact.

### Decision

#### 2026-09-14 — crash-stays-dead loses the icon leg and gains a better one

*Trigger: `status-and-alerts`'s retraction, delivered as a rerouted concern — the menu-bar icon is not guaranteed to be drawn, so its absence is not a signal.*

> **A crashed engine still stays dead until the user reopens it. The decision stands on two legs: every note on every Space vanishes at once, and the agent surface reports a dead engine explicitly. The menu-bar icon's absence is struck — it is not observable.**

##### Why the icon leg goes rather than being qualified

`status-and-alerts` established the fact and accepted it as a residual it cannot close: macOS truncates status items when the bar runs out of room, users hide them, and Fumi cannot detect that it is not being drawn. A signal the app cannot confirm is reaching the user is not a signal. Qualifying the clause — *the icon goes, where it was drawn* — leaves a premise a later reader can rebuild on, which is precisely what this topic's own fifth Key Insight forbids.

##### The replacement leg is stronger than the one it replaces

The concern's sharpest case is a user with **no fumis open** and a truncated icon: nothing on screen changes, so both original legs are dark. That was read as approaching the Keyboard Maestro failure the reversal argued against. It does not, and the reason names what the original argument was reaching for:

**Keyboard Maestro's failure is silent because its whole job is to act without being asked.** A dead KM means bindings quietly do nothing and nobody is told — the harm accrues in the interval. Fumi with no fumis open has **no job running**: nothing is silently not-happening. The one thing being asked of the engine in that state is the agent path, and that path is loud by construction — `client-connection-lifecycle` decided both clients fail with *"Fumi isn't running"* plus a machine-readable code, so an agent that meets a dead engine says so to its human. That is a better announcement channel than the icon ever was, and it is exactly the property Keyboard Maestro lacks.

```
09:14   engine crashes. No fumis open. Icon was never drawn.
14:30   agent: fumi list → "Fumi isn't running"   ← the announcement
17:02   user reaches for the menu bar. Not there.
        ⌃Space, "Fumi", Enter. Desk returns.
```

##### The residual, stated rather than closed

**A user with no fumis open, no agent running, and an undrawn icon is never told the engine died.** They do not need to be: their recovery gesture is the gesture they were already making. They wanted to open a fumi, the menu bar did not answer, Spotlight did — the same two seconds the reversal costed, reached from a different direction. Nothing was owed them in the interval, because nothing was running on their behalf.

**What would reopen this** is a usage pattern where something *is* running on the user's behalf while they are not watching and cannot report — which the agent path is not, because it reports. If Fumi ever grows a background job of its own (a scheduled action, a watcher), that job's silence would be the Keyboard Maestro failure for real, and supervision becomes a live question again rather than a closed one.

*Sibling check: status-and-alerts (discussion) — its decided text holds that the icon is not guaranteed to be drawn, softens its own claim to *the only part of Fumi that can be on screen without the user opening anything*, and accepts the residual with no mitigation available; that finding is adopted whole and nothing there is revised — the correction is to this topic's argument, which had leaned on the retracted word. Its own standing-surface decisions are untouched: this changes what a crash rests on here, not what any surface displays. client-connection-lifecycle (this topic) — its decided *"Fumi isn't running"* failure, with a human line and a machine-readable code for both clients, is cited as the replacement leg and is not revised.*

#### 2026-09-02 — the permission-grant restart is struck: no grant is requested

*Trigger: space-homing's measurement, delivered as a rerouted concern — the answer to the question this block itself raised and routed on 2026-08-12.*

> **No TCC grant of any kind is needed to place Fumi's own windows on Spaces. There is no permission-grant restart, and the restart machinery has exactly one driver: a Sparkle update.**

##### Why the assumption held, and what dislodged it

The measurement is in the Context block above. What it establishes for this decision is that **the assumption's origin was ownership, not privilege** — precisely what the 2026-08-12 entry suspected without being able to settle. yabai's scripting addition and partial-SIP requirement exist because yabai moves *other applications'* windows, and Fumi inherited yabai's permission story along with its technique. OS version and SIP state were constant across the probes; ownership was the variable.

##### Why the row is struck rather than generalised

The alternative on the table was keeping a **deliberate restart** row with the permission case removed as its motivating example. Rejected: the exit classification table already carries the Sparkle update on its own row, so a generalised row would be a category with no member — a slot kept warm for an instance that might arrive. `change-notification` set this document's precedent when a change stream was rejected outright rather than deferred, *"because the two read differently downstream: a deferred item implies work owed and shows up as an obligation in later phases."* A trigger row with no trigger is a deferred item wearing a table cell.

**Striking is the low-risk option rather than the bold one, and the reason is that nothing is deleted except a driver.** The drain, the exit, the going-down frame with its intent, the relauncher, and the arriving process standing down on `restarting` all stay, because a Sparkle update needs every one of them. If `onboarding-and-permissions` ever finds a grant that does require a relaunch, re-adding it means naming a second caller of machinery that already exists.

##### What this dissolves

- **The permission-grant restart itself** — its row in the exit classification table, and the "what brings it back" answer that row carried.
- **The choice this topic handed `onboarding-and-permissions`** — *which relaunch shape the permission grant uses, a helper or the user reopening*. There is nothing left to choose between.
- **The Fork 1 reversal's one un-inherited cost.** It accepted that *"Sparkle already carries that weight for updates; the permission case is the one that has to be built rather than inherited."* Nothing has to be built.

##### What survives, and what it now rests on

- **`restarting` has exactly one emitter: a Sparkle update.** The 2026-08-19 rule — *emitted only when something other than the user is bringing the engine back* — keeps its definitional job and loses its worked example, which was the permission restart under the *"or the user does"* shape. `Autoupdate` always brings the app back, so every planned exit is now either `restarting` (Sparkle) or `stopping` (Quit, `SIGTERM`). Stated as a narrowing of the protocol surface rather than left as a rule floating over a dead case.
- **A restart in progress belongs to whoever asked for it** (2026-08-18) keeps a live case in Sparkle; only its permission-restart sentence goes.
- **Every planned restart is user-initiated** (`restart-and-restore`) stands on Sparkle alone. It was generalised from two user moments — clicking Update, and clicking through a wizard — and one of them is gone. The rule is unaffected; it never needed two.
- **`onboarding-and-permissions` still owns a wizard.** Its brief's premise is gone, not its subject — space-homing delivered the same measurement to its queue, and it re-derives its own scope. Whatever it finds arrives here as new ground if it needs anything of this topic.

##### The caution that is not waved past

*"No Accessibility" is not "no permissions"* — the measurement covers Space placement specifically. The other permission surface in play is this document's own: the path-passing decision makes the engine the TCC subject for **Files-and-Folders** access (2026-08-18, rerouted to `onboarding-and-permissions`). That one needs no restart either — a TCC file grant applies to the running process, where Accessibility is the grant that historically requires a relaunch to take effect. *Confidence: medium-high on the mechanism, and it is that topic's surface to confirm rather than this one's to assume.* If it comes back needing a restart, that is a new driver arriving as new ground, and the machinery is still here to take it.

*Sibling check: space-homing (research) — its record holds that no TCC grant of any kind is required to place own windows, measured with SIP enabled and again inside a verified sandbox, with the assumption's origin identified as ownership rather than privilege; this adopts that answer and is the fold of the concern it delivered. onboarding-and-permissions (research, not yet run) — its brief scopes a first-run wizard around requesting the Accessibility grant and calls the permission relaunch its crux; that premise is space-homing's to retire and it delivered the same measurement there directly, so nothing is rerouted from here. build-and-release (not yet discussed) — it now carries the whole restart weight rather than one driver of two; its brief already holds the Sparkle update relaunch, and nothing here adds to it.*

#### 2026-08-12 — revised: Fork 1 reverses to A, and Fork 2 goes with it

*Trigger: user reversal, reached from the disabled-login-item problem (review-003 F2). Pressed on why an OS toggle could gate the whole app, the fork's deciding factor did not survive examination — and once it went, launchd's only remaining purchase was crash-restart, which Fumi is the wrong product to buy.*

> **Fork 1 → A: a plain login item. Fumi is an ordinary `LSUIElement` app that stays running, registered for launch-at-login via `SMAppService.mainApp`. There is no launchd agent, no plist, and no supervision.**

**Fork 2 is moot** — it only existed to ask what the agent's plist should point at.

##### What broke the original deciding factor

The fork chose B because *"two sibling topics depend on a relaunch that does not go through the app relaunching itself"* — Sparkle updates and the permission-grant restart — and characterised the alternative as self-relaunch, *"precisely the pattern that fails in the wild."*

**That is not the alternative.** Sparkle ships **`Autoupdate`**, a separate helper process that waits for the app to quit, swaps the bundle, and relaunches it. Supervising the relaunch is its entire job, in thousands of shipping apps. The update relaunch never needed launchd, and the argument that carried the fork was comparing B against a straw alternative.

##### Why crash-restart is not worth the bill

With the relaunch argument gone, `KeepAlive` was the only thing left, and the case for it inverts on examination.

**The original reasoning here was that Fumi dying is a louder failure than an ordinary utility dying, so supervision is worth more.** Backwards. **Keyboard Maestro is the app that needs `KeepAlive`** — it dies silently, and the user finds out weeks later when a binding they wrote months ago quietly does nothing, at which point diagnosis is a guessing game across three background apps. **Fumi's crash announces itself**: every note on every Space vanishes at once ~~and the menu-bar icon goes with them~~ *(icon leg struck 2026-09-14 — the status item is not guaranteed to be drawn; the replacement leg is the agent surface's explicit failure, see the 2026-09-14 entry)*. Recovery is ⌃Space, "Fumi", Enter. A loud failure with a two-second recovery does not need a supervisor; a silent one does.

The agent path was already decided to fail the same loud way — a dead socket returns *"Fumi isn't running"*, the user reopens, the agent retries. Nothing about that improves with supervision.

**The bill `KeepAlive` was being paid, all of it already on the board:** a plist to ship, sign and keep valid; the engine/launcher role split; conditional registration repair; a user-facing OS toggle that gates the whole app; `ExitTimeOut` bounding the drain; `ThrottleInterval` sitting under a claimed *"~2 second pause"*; a stale job definition after an in-place bundle swap; and open debt in both `supervision-and-failure` and `version-skew`. Three of the four findings open against this document when the fork was reopened were launchd mechanisms, and dissolved with it.

##### The false path taken on the way, recorded because it was nearly taken

Before the fork was reopened, a narrower fix was proposed and argued: **make launchd a preference rather than a gate** — the engine runs as the launchd job when the job will have it, and promotes itself to engine unsupervised when it will not. It kept every launchd benefit, removed the disabled-job problem, and took the spike off the critical path, since both answers then had defined behaviour.

**It lost because it was treating the symptom.** The user's objection was that the whole shape looked like a false path — *"we haven't built anything yet; we can do whatever we want"* — and that starting the app and starting-at-login should never have been the same question. Against that, the preference-not-a-gate fix is machinery to make a bad fork survivable rather than a reason to keep it.

**A framing error of this session's own is recorded with it**, because it nearly stopped the reopen: the daemon/UI split was described as something the product *could not* do, when it was something discovery had *decided*. The distinction matters and the two halves land differently — the split rejection **holds** (the CGS Space calls act on the caller's own windows; moving another process's windows is the yabai path, needing SIP partially disabled and unshippable), while the launchd choice was preference all along.

**The ordinary Mac shape was the other half of the argument.** Rectangle, Moom, Bartender and Tailscale are all the app-plus-login-item shape, where *launch at login* only ever means *open me at login*; the apps that split a GUI from a supervised daemon — Docker, Ollama — take a split Fumi cannot. No app refuses to run because its login item is switched off, and Fumi was on its way to being one.

##### What this dissolves

- **The `KeepAlive: {SuccessfulExit: false}` correction** and everything sized against it.
- **The whole *Update path* decision** — *"exactly one way the engine ever starts: launchd"* fixed a bug that cannot occur without a job to fall out of step with.
- **The engine/launcher role split** and conditional registration repair.
- **The disabled-job problem.** A login item switched off means *don't open at login*, which is what a user means by it and what every other Mac app does with it. Launching Fumi runs Fumi, unconditionally, with nothing to reconcile.
- **The TCC identity risk — the one *gating* verification item.** It existed because the executable was to be exec'd directly by launchd rather than launched through LaunchServices. Fumi now launches the ordinary way, so the grant attributes the ordinary way. *(Whether the Space APIs need Accessibility **at all** is a separate question, and one this topic should stop assuming — see below.)*
- **The `NSApplication`-under-launchd risk**, and the bundle-move registration worry that rode with it.

##### What survives, and what needs restating rather than deleting

- **The rejected paths at the head of this topic still hold.** A pure headless daemon split from the UI remains rejected, and on unchanged grounds: the private CGS Space calls act on the **caller's own** windows, so whoever draws the note windows must make them. Moving another process's windows across Spaces is the yabai path, which needs SIP partially disabled and is not shippable. Fumi is one process because of that, not because of launchd.
- **`LSUIElement`, menu-bar-first, the optional dock icon** — untouched.
- **Single instance** — the lock is kept, its justification restated; see that block.
- ~~**The permission-grant restart** loses *"drain, then exit non-zero and launchd brings it back"*, which was the neatest thing launchd bought. Replacement is conventional and consistent with `restart-and-restore`'s decided rule that **every planned restart is user-initiated**: the wizard offers a restart, the engine drains and exits, and either a relauncher helper of the same shape Sparkle uses reopens it, or the user does. Which of those is mechanism, and it belongs with the wizard.~~ *(Struck 2026-09-02 — space-homing measured that no grant is requested, so there is no permission-grant restart to re-home. The replacement described here never had a case to serve; see the 2026-09-02 entry.)*
- **The exit classification table** in `client-connection-lifecycle` loses its launchd column; the drain itself is unchanged.

##### Costs accepted, named plainly

**A crashed engine stays dead until the user reopens it.** That is the deal, taken deliberately: the failure is self-announcing and the recovery is one Spotlight invocation. *(Amended 2026-09-14 — "self-announcing" now means the vanishing fumis and the agent surface's explicit "Fumi isn't running", not the menu-bar icon's absence. A user with no fumis open and no agent running is not told, and is owed nothing, because nothing was running on their behalf. See the 2026-09-14 entry.)* macOS may also offer to reopen after a crash, though whether that applies to an `LSUIElement` app is unverified and nothing here leans on it.

**A relaunch is now something a helper or the user performs**, rather than a property of the process manager. Sparkle already carries that weight for updates; ~~the permission case is the one that has to be built rather than inherited.~~ *(Amended 2026-09-02 — there is no permission case: no grant is requested, so this cost is zero and every relaunch is Sparkle's, inherited whole.)*

##### The assumption this exposes, which is not this topic's to settle

*(Answered 2026-08-25, folded here 2026-09-02 — the assumption was wrong, for the reason proposed below. The permission restart is not a smaller problem; it is not a problem. See the 2026-09-02 entry above.)*

The brief asserts the private Space APIs need the **Accessibility** permission, and the whole permission-restart requirement rests on it. Chrome restores its own windows to their Spaces without ever asking for Accessibility — that permission governs controlling **other** applications. If the assumption is wrong, the permission restart is a much smaller problem, or not one at all. **Dependency: `space-homing` (research) and `onboarding-and-permissions` own this; it is flagged here because a decision in this topic was propped on it.**

*Sibling check: onboarding-and-permissions — its brief holds that a permission wizard exists and that the relaunch restoring every open fumi must be flawless. That requirement is unchanged; only the mechanism beneath it is, and it is now a user-initiated restart, which `restart-and-restore` already decided is the rule for every planned restart. **(Amended 2026-09-02 — the requirement is not unchanged after all: no grant is requested, so there is no permission relaunch. The wizard's remaining scope is that topic's to re-derive.)** build-and-release — its brief carries Sparkle auto-updates and the always-on-engine restart; this removes a constraint rather than adding one, since Sparkle's own relaunch helper is now the mechanism instead of `launchctl kickstart`. Neither topic has a decided document to revise; both are named so the change reaches them. storage-and-sync — single-writer is a per-process invariant and is untouched by how the process is started.*

#### Initial

**Fork 1 → B: a launchd agent, registered via `SMAppService.agent`, with a plist in `Contents/Library/LaunchAgents/`.** Deciding factor: two sibling topics depend on a relaunch that does not go through the app relaunching itself. `KeepAlive` is configured as `{SuccessfulExit: false}`, not `true`.

**Fork 2 → 1: the plist points at the main app bundle's own executable.** One bundle, one binary, one signature, one Sparkle target. Deciding factor: shape 2's outer bundle has no job.

**Accepted trade-off / named risk.** Shape 1 rests on a claim not yet verified: that an `.app` launched by launchd directly from its executable comes up as a full `NSApplication` — window-server connection, activation policy, `NSWorkspace` visibility, and the private CGS Space calls all working normally. This is expected (it is what yabai-class agents do) but it is not asserted. **If it comes back broken, shape 2 is the fallback**, and the reasoning above is what it would cost. Confidence: medium-high on the mechanism, high on the reasoning that selects it.

A second unverified point, smaller: whether the registration survives the user moving `Fumi.app` between `/Applications` and `~/Applications`. Login items have a history of breaking on that.

**Permission identity — the one item that gates** *(added by review-001 F4)*. The list above omitted **TCC**. The failure it admits:

```
first run   wizard: "Fumi needs Accessibility to remember Spaces"
            → System Settings ▸ Privacy & Security ▸ Accessibility
            → user adds Fumi, toggles it on          ✓
next login  launchd exec's Contents/MacOS/Fumi
            → CGS calls → denied
            → entry still says "Fumi", still switched on
```

The user did everything the wizard asked, the signature feature silently does not work, and there is nothing legible for them to look at.

Direct-exec makes this a real question rather than a paranoid one: TCC attributes a grant to a *responsible process*, and the attribution is not always the process one would expect — it is why running a CLI from Terminal prompts that **Terminal** wants to control your computer rather than the tool. What TCC makes of a bundled app whose executable was exec'd directly, rather than launched through LaunchServices, is the open question. *Expectation: it resolves to the bundle, since TCC works off code-signing information which for a bundled executable carries the bundle identifier. Confidence: medium — the yabai precedent evidences the LaunchAgent half but not the bundle half, because yabai is a bare binary, not a bundle.*

**This item is treated differently from the others, for two reasons.** A bad result takes down a *sibling topic's whole design* — onboarding-and-permissions is building its wizard on the grant sticking to the thing launched at login — and shape 2 genuinely fixes it, because a login-item helper registered through `SMAppService` is the conventional path TCC is built around. Every other item on the list fails softly; after the single-instance decision above, even `NSWorkspace` visibility no longer carries weight.

**Verification, and what each result means:**

- **TCC identity — gating.** Grant Accessibility to a direct-exec'd bundled app under a LaunchAgent; confirm the grant is recorded against the bundle identity and survives a relaunch. **A negative result selects shape 2**, rather than being engineered past.
- **Everything else on the list — non-gating.** Verified at planning/implementation; a negative changes the mechanism without reopening the fork, and shape 2 is the named fallback.

*(Relaunch mechanics themselves — how the engine asks to be restarted, and how open fumis are restored across it — are `restart-and-restore`. Crash-loop behaviour and what launchd should do about a wedged engine are `supervision-and-failure`.)*

### Engine and launcher roles

*(Opened by review-002 F1 — a seam between four separately-written decisions, not a gap inside any one of them.)*

**Three statements did not agree.** *"There is exactly one way the engine ever starts: launchd"* (Update path); *"it starts on user action, or at login when launch-at-login is registered — nothing else"* (client-connection-lifecycle); and *"the next launch is a cold start, so it restores"* (Lifecycle, after Quit). That next launch is a **Finder double-click — LaunchServices exec, not launchd**. So is the very first run after install. Both land in exactly the state the Update path decision identifies as the failure: the running engine is not the launchd job, `KeepAlive` supervises nothing, `kickstart` would start a second. The Sparkle case was fixed; the one gesture a human actually performs was left undefined.

**A second angle reached the same site.** *"The engine re-registers its agent on every launch"* was written unconditional, and the single-instance decision separately contemplates a stray copy in `~/Downloads`. The two were written in different passes and never ordered against each other — re-register *before* the lock check and the stray copy repoints the login job at `~/Downloads`; re-register *after* it and the losing process never re-registers, so the claimed self-healing does not fire for the copy the user actually launched.

#### Decision

##### 2026-08-12 — dissolved by the Fork 1 reversal

*Trigger: `process-model`'s Fork 1 reversed to a plain login item, so there is no launchd job and no second role.*

> **There are no roles. Every launch of Fumi is Fumi.** The process that starts acquires the single-instance lock and becomes the engine; a process that finds the lock held connects to the incumbent, forwards the reopen intent, and exits.

Everything below this entry was machinery for reconciling two ways of starting the same executable. With one way, it has nothing to reconcile:

- **The marker in the plist** — no plist, no marker, no role selection.
- **Registration repair, conditional or otherwise** — `SMAppService.mainApp` registers the app itself for launch-at-login; there is no program path recorded separately from the bundle to fall out of step with it, and the stray-`~/Downloads`-copy case is LaunchServices' to arbitrate by bundle identity, backed by the lock.
- **Kickstart-then-forward** — the process that loses the lock forwards directly, as **Single instance** always described.

**The reopen call made earlier today survives the dissolution and is the reason it is recorded rather than deleted.** *A reopen intent that accompanies a cold start does not open the management window* was derived from the Lifecycle decision's scope, not from the launcher's existence, so it applies unchanged to the one remaining path: a process that starts cold restores the desk and shows no manager, whatever gesture started it; a process that finds an incumbent forwards the intent and the manager appears.

##### 2026-08-12 — revised

*Trigger: review finding — the launcher forwards a reopen intent into a cold start, which is exactly the case the Lifecycle decision says shows no management window.*

**Settled by derivation** — not discussed. Determined by the Lifecycle decision's own scope, which is explicitly unconditional on how the engine was started (review-003 F1).

The role split below stands. Two steps in it were carried over from the flow it replaced and are corrected:

```
launched by launchd (marked)          → ENGINE
   ├─ acquire lock
   │    ├─ refused  → an engine is live → exit 0            ← no intent to forward
   │    └─ acquired → verify registration points at this bundle; repair if not
   │                  bind socket → restore when session-ready
launched any other way                → LAUNCHER  (never becomes the engine)
   ├─ registration absent, or points at a bundle that's gone? → register
   ├─ kickstart the registered job
   ├─ forward intent — only to an engine that was already live  ← not after a kickstart
   └─ exit 0
```

> **A reopen intent that accompanies a cold start does not open the management window. The manager appears only when an engine was already running and the intent reached it.**

**The derivation.** *Lifecycle: start, reopen, quit* decided that a cold start restores the desk and shows **no** management window, and that the manager is what a *reopen* means — *"already running… there is nothing to restore"*. `restart-and-restore` then made the scope explicit: *"the rule stays unconditional and stays independent of what started the engine"*. The launcher is a new actor on the start route, not a new kind of start, so it cannot move a gesture from one row of that table to the other. As written, the launcher fired the manager on a Finder double-click after Quit — which the table classifies as a cold start — and on first run after install, which the same section deliberately assigns to the onboarding wizard rather than to reopen logic.

**Which side suppresses it is mechanism, not product** — the launcher can withhold the intent when it had to kickstart, or the engine can discard a reopen arriving during its own start. Either satisfies the rule.

**The engine branch's `forward intent` was residue.** In the engine role the process was started by launchd, so there is no user gesture behind it and nothing to forward; the step was inherited verbatim from the pre-split **Single instance** flow, where every launch reached that lock. A refused lock in the engine role means only *stand down* — exit 0, which `KeepAlive: {SuccessfulExit: false}` correctly leaves alone. The forwarding behaviour the **Single instance** decision describes is the launcher's, and lives there.

##### 2026-08-11

> **One executable, two roles, selected by how the process was started. The plist marks the engine launch explicitly** — a declared flag, not environment sniffing.

```
launched by launchd (marked)          → ENGINE
   ├─ acquire lock
   │    ├─ refused  → an engine is live → forward intent, exit 0
   │    └─ acquired → verify registration points at this bundle; repair if not
   │                  bind socket → restore when session-ready
launched any other way                → LAUNCHER  (never becomes the engine)
   ├─ registration absent, or points at a bundle that's gone? → register
   ├─ kickstart the registered job
   ├─ forward intent (reopen → show manager)
   └─ exit 0
```

**This makes *"exactly one way the engine ever starts"* literally true rather than aspirational.** A Finder double-click after Quit now works properly: the launcher wakes the job, the engine comes up **under launchd** with supervision intact, and restoration fires. First run after install takes the same path.

**The ordering question dissolves once registration moves to the launcher and stops being unconditional.** Register only when it is absent or dangling. A stray `~/Downloads` launch then finds a registration pointing at a live `/Applications` bundle, leaves it alone, and kickstarts **the real one** — the user double-clicks the wrong copy and gets the right app. The app-moved case still self-heals, because the old path is genuinely gone.

*Amends the Update path decision below: registration repair was right, unconditional was not.*

#### The registration's status is read, never assumed

##### 2026-09-15 — revised: launch-at-login is offered, and registration follows the answer

*Trigger: triage from onboarding-and-permissions: "Launch-at-login is a first-run choice the user makes, not unconditional registration" — the user ruled there that the offer is made and declinable, which overturns this block's "on by default rather than asked".*

> **Fumi offers launch-at-login during first run, recommended. Registration happens when the user accepts, once, and never again. A decline registers nothing, and silence — onboarding dismissed without an answer — is a decline. Fumi registers a login item in exactly one circumstance, the user accepting that offer, and in no other.**

###### The argument that loses is this block's own, and it loses on its own terms

*"On by default rather than asked"* rested on one claim: *"a fumi that does not come back after a reboot is not a fumi… A wizard question whose wrong answer breaks the product is not a real question."* The user's ruling is precisely that the wrong answer breaks nothing — *"If it's not running, it's not running. That's like trying to read your emails, but your email client's not running."*

That is not a consideration arriving from outside. It is the reading this topic already took everywhere else: `process-model` accepted that **a crashed engine stays dead until the user reopens it**, on the grounds that not-running is an ordinary state with a one-gesture recovery. This block was the one place treating a not-running Fumi as a broken product, and it was inconsistent with the rest of the document before the ruling reached it.

###### The consent question was decided here, not omitted

The concern reads the record as silent — *"consent is absent rather than decided against"* — because it cites Fork 1's option text and the 2026-08-12 dissolution, neither of which is where the question was settled. It was settled in this block, deliberately, with an argument. Recorded so a later reader sees a reversal rather than a gap being filled: why on-by-default existed is on the record above, and what killed it is on the record here.

###### What survives, and carries more than it did

**Register once and never again** is unchanged, and the machine-local flag that enforces it now does more work. It recorded *registration has been attempted*; it now records *the user has been asked*, and there are **two ways to be off** — declined at first run, and switched off later in System Settings — which must both stick. The authority rule (*"the user's Login Items choice is authoritative and is never silently reversed"*) is what they stick by, and the flag is still what makes it structural rather than a discipline the app must remember to observe.

**The flag stays machine-local and out of the synced path**, for the reason already recorded: the per-device blob is mirrored to the settings zone, so a restored Mac reading a synced flag would decline to ask, decline to register, and never launch at login again. A flag that now also records a *decline* has a mirror failure available to it — a restored Mac inheriting a refusal it was never given — and the same rule prevents both.

###### Nothing re-registers, and there is no repair path to make conditional

The concern names a second hazard: a repair routine that registers unconditionally would overturn a decline on the next launch. **There is no such routine.** Registration repair was dissolved on 2026-08-12 along with the launchd agent — `SMAppService.mainApp` records no program path separately from the bundle, so there is nothing to fall out of step — and the 2026-08-20 entry below argued against reinstating it in any form: conditional re-registration *"cannot distinguish never registered from deliberately switched off, which is exactly the case that rule exists for."* The guard predates the user it now protects. What is new is only that it is said out loud, because the concern found the hazard by reading a record that never stated it.

**The bundle-move case is unchanged.** Whether an `SMAppService.mainApp` registration survives the user moving `Fumi.app` between `/Applications` and `~/Applications` stays unverified, on the spike list at the weight already assigned: the failure is *"Fumi stopped opening at login"* — visible, and fixed by the switch in System Settings. Nothing silently re-registers to repair it, which was already the answer and now holds for a second reason.

###### Silence is a decline, and that needs no machinery

A user who dismisses onboarding without answering has registered nothing, because registration is an act that follows acceptance. No *unanswered* state, no deferred prompt, no re-ask: the app is simply not registered, and someone who wanted it and missed the question finds the switch where every Mac app keeps it. The safe direction is also the cheap one.

###### What this does not decide

The **wording and placement of the offer are `onboarding-and-permissions`'**, including whether the flow says anything about the system notification macOS raises the first time an app adds a login item — which is outside Fumi's control and cannot be worded by it. This decides only that registration is conditional on the answer, and when it fires.

*Arriving with the concern and changing nothing: `onboarding-and-permissions`' research records Apple DTS as stating that notifications require a user-context app and are "not possible… from a system level daemon or launch agent". The `LSUIElement` app Fork 1 reversed to satisfies that; the launchd-agent shape it rejected would not have. Carried as an incidental confirmation of a decision already taken on other grounds, not as a reason for it, and unverified here.*

*Sibling check: onboarding-and-permissions (research) — its record holds that launch-at-login is offered, recommended and conventionally worded, that declining is unremarkable and unpunished, and that the stronger "keep your fumis on your desk" framing was put up and rejected because Fumi is an app and not-running is not a failure state; all of that is adopted, none revised, and the offer's copy stays theirs. process-model (this topic) — the accepted trade that a crashed engine stays dead until the user reopens it is cited as the reading this restores consistency with, not revised. storage-and-sync — the per-device blob and its settings-zone backup are cited again as where the flag must not live; nothing there is revised.*

##### 2026-08-12 — mostly dissolved by the Fork 1 reversal

*Trigger: the same reversal. There is no launchd job, so most of what this block guarded cannot arise.*

> **The login-item registration is a preference and nothing more. Launching Fumi runs Fumi; the preference decides only whether macOS opens it at login.**

The rule this block stated — *"the two are separable concerns"* — was right and is now **structurally** true rather than defended. Under `SMAppService.mainApp` a switched-off login item cannot gate anything, because nothing consults it to start the app. The disabled-job problem the review raised (review-003 F2) does not exist to be solved.

**What survives:** the registration's status is still read rather than assumed, and a registration that is **pending approval or disabled** is still surfaced quietly — the user asked for launch-at-login and will not get it, and that is the silent-tomorrow failure this block exists to prevent. It is now purely informational; nothing behaves differently.

**What goes:** re-registering over a deliberate opt-out cannot happen (there is no repair path to do it); *"whether a disabled job can be started on demand"* leaves the spike list, since no job is started on demand; and the `SMAppService.Status` question narrows to *which value means the user switched it off*, so the indicator can say so.

##### 2026-08-20 — who makes the registration, and when *(resolves review-006 F2)*

The registration act has had two owners in turn and ended with none. *"The engine re-registers its agent on every launch"* was struck by review-002 F1; registration moved to the **launcher** role, conditional on the registration being absent or dangling; and the Fork 1 reversal dissolved the launcher, noting only that *"`SMAppService.mainApp` registers the app itself for launch-at-login"* — which says what the registration **is**, not who calls it or when. Everything that survived decides the **read** side.

Two decided statements depend on the write side. `client-connection-lifecycle` lists *"**first run**, before registration has happened at all"* as one of three routes to no engine, and the entire restoration model assumes something opens Fumi at login.

> **Fumi registers its login item once, on first launch, and never again. It is on by default, and a preference turns it off.**

```
first launch     user opens Fumi. The engine runs — they opened it.
                 the app registers the login item, once.
                 macOS notifies: "Fumi added items that can run in the background."
                 onboarding explains: it stays running so your desk comes back.
later            user switches it off in System Settings.
next launch      the app does not re-register. It stays off.
```

**Never-again is what makes the authority rule structural.** *"The user's Login Items choice is authoritative and is never silently reversed"* was stated as a rule the app must observe; a **local flag recording that registration has been attempted once** turns it into something the app cannot break by accident. Re-registering conditionally — on absent-or-dangling, as the launcher did — cannot distinguish *never registered* from *deliberately switched off*, which is exactly the case that rule exists for.

**On by default rather than asked.** A fumi that does not come back after a reboot is not a fumi: the desk returning is the feature this whole topic serves, and every restoration decision assumes it. A wizard question whose wrong answer breaks the product is not a real question. The disclosure is real regardless — macOS raises its own background-item notification the first time an app registers one, and onboarding carries the explanation. **Dependency: onboarding-and-permissions** owns that copy.

**The flag is machine-local and never travels.** It belongs in local preferences, **not** in the per-device blob — the blob is mirrored to the settings zone as a backup, so a restored Mac would read the flag as *already registered*, decline to register, and never launch at login again. That is the one way this decision could fail silently, and keeping the flag out of the synced path is what prevents it.

*Sibling check: storage-and-sync — the per-device blob and its settings-zone backup are cited as the place this flag must **not** live; nothing there is revised. onboarding-and-permissions — the first-run explanation is theirs, and this supplies what it has to explain.*

##### Initial

*(Opened by review-002 F2.)* Making registration conditional fixes the ordering but not the second half: `register()` was treated as fire-and-forget, and its status was never read back. Two states that the document's own decisions say matter are invisible under that treatment.

**The user's Login Items choice is authoritative and is never silently reversed.** `client-connection-lifecycle` names *"the user switching Fumi off in System Settings → General → Login Items"* as a legitimate route to no engine, and `process-model` separately insists *"Quit is not 'stop Fumi launching at login'… Quit must not quietly imply it"* — the same respect for that intent, in the other direction. Re-registering over a deliberate opt-out is that rule broken by the app instead of by Quit.

**Registration can succeed without taking effect** — pending approval, or disabled — which is observationally identical to not being registered: no engine at next login, and nothing for the user to look at. So the status is read and acted on rather than assumed.

> **Launching Fumi manually always runs the engine, whatever the login-item preference says.** The two are separable concerns: *does it start itself at login* is the user's preference; *does it run when I open it* is not a preference at all.

**A not-active registration is surfaced, not swallowed** — a quiet indicator, owed to `observability` and to the onboarding wizard. The failure it prevents is the silent one: everything works today, nothing works tomorrow, and nothing ever said why.

**Mechanism flagged for verification, not decided here.** The exact `SMAppService.Status` value a user-disabled job reports, and whether a disabled job can be started on demand at all, decide *how* the rule above is implemented. The product rule stands regardless; the API behaviour joins the spike list rather than being guessed.

### Single instance

*(Opened by review-001 F2.)*

**A circularity in the fork above.** Shape 1's pro was that single-instance behaviour "comes free" — LaunchServices activating the incumbent rather than spawning a second process. But the accepted risk in the same decision lists `NSWorkspace` visibility as expected-but-not-asserted under direct-exec launch. The pro therefore rested on exactly the claim the risk declined to make. And the stake is the largest invariant in the architecture: storage-and-sync makes the engine sole writer of the store *and* the SQLite index, *"which is what makes WAL safe"*. Two engines is two writers.

**What is known, with confidence marked.** An app bundle's executable exec'd directly **does** register with LaunchServices — registration happens when AppKit initializes and checks in with the window server, so it follows from the app starting up rather than from how it was spawned. Observable: running `/Applications/TextEdit.app/Contents/MacOS/TextEdit` from a shell puts TextEdit in the Dock and Cmd-Tab, and a subsequent `open -a TextEdit` activates that process instead of starting a second. *Confidence: high.* ~~The same behaviour under launchd's `gui/$UID` domain with `LSUIElement` set is **expected, not verified**.~~ *(Superseded 2026-08-12 — the Fork 1 reversal dissolved this verification item along with the risk it belonged to; the Lifecycle block states that Fumi launches as an ordinary app, so `LSUIElement` and `setActivationPolicy` behave the ordinary way. See the Decision's 2026-08-12 restatement below.)*

**The reframe that decided it: LaunchServices and a process lock cover different doors.** "Fallback" was the wrong word for the second mechanism.

| | covers | provides |
|---|---|---|
| **LaunchServices** | launches that go *through* it — Finder, Dock, Spotlight, `open` | the UX — the incumbent activates |
| **Process lock** | ~~everything exec'd directly, including launchd itself~~ everything LaunchServices never sees | the invariant — never two writers |

~~launchd starts the engine by direct exec, so the launch path the product depends on most is the one LaunchServices never sees. Two launchd registrations pointing at two copies of the bundle would produce two engines with LaunchServices never consulted.~~ *(Superseded 2026-08-12 — there is no launchd, so this argument's premise is gone. The lock is kept on the two cases that remain, restated in the Decision below: a second copy of the bundle on disk, and a shell running the executable directly.)*

*Considered: leaving it to LaunchServices alone and keeping the process simple. Rejected — it leaves the single-writer invariant resting on a UX convenience. (The user's instinct was that a process-level lock "feels hacky… like we've slipped too far down"; the coverage argument is what answered it. A single-instance lock is what every daemon does, and Fumi is a daemon that happens to draw windows — it is the correct layer for process-shaped launches, exactly as LaunchServices is for app-shaped ones.)*

#### Decision

> **Both, for coverage rather than insurance.** LaunchServices arbitrates user-initiated launches; the engine enforces single-instance itself for everything else.

```
process starts
  ├─ acquire exclusive lock (flock on a lockfile in Application Support)
  │    ├─ acquired → I am the engine. Bind the socket, restore fumis.
  │    └─ refused  → an engine is already live.
  │                  Connect to its socket, forward the reopen intent, exit 0.
```

*(Written before the engine/launcher split as an unconditional `process starts`; scoped to the engine role by review-002 F1; **returned to unconditional 2026-08-12** when the Fork 1 reversal dissolved the two roles. This is the flow again, for every launch.)*

**The justification is restated rather than inherited, because the reversal removed the one it rested on.** The coverage table above argued that *"launchd starts the engine by direct exec, so the launch path the product depends on most is the one LaunchServices never sees."* There is no launchd, so that path is gone and LaunchServices now sees every ordinary launch. **The lock is kept anyway, on the two cases that remain**: a second copy of the bundle on disk (a freshly-downloaded `~/Downloads/Fumi.app` beside the installed one), and a shell running `Fumi.app/Contents/MacOS/Fumi` directly. LaunchServices arbitrates by bundle identity and should handle the first; the lock is what makes *should* into *does*, and the stake is unchanged — storage-and-sync makes the engine sole writer of the store and the index, so two engines is two writers. Cheap insurance on the largest invariant in the architecture.

**Why a lockfile rather than letting the socket `bind()` fail.** A `SIGKILL`'d engine leaves the socket file on disk, so `bind()` reports the address in use with nothing listening — recovering means connect-first-then-unlink-if-refused, a dance with a race in it. The kernel releases an `flock` when the holder dies, however it died. No staleness, no dance.

**Two consequences worth more than the fix.** The reopen behaviour decided below now holds *regardless* of whether LaunchServices cooperates — the losing process forwards "show the manager" to the incumbent and exits, which is `applicationShouldHandleReopen` semantics delivered over our own socket. And it covers a case nothing else does: two copies of `Fumi.app` on disk, one in `/Applications` and a freshly-downloaded one in `~/Downloads`, launched by accident.

~~**No research needed now.** `NSWorkspace` visibility is already on the spike list from the fork above, so it gets verified regardless; this decision removes anything that breaks if the answer comes back wrong.~~ *(Superseded 2026-08-12 — that spike item left the list with the risk it belonged to, so this rests on something that no longer exists. The conclusion survives on stronger ground: nothing here depends on `NSWorkspace` behaving unusually, because the launch is ordinary.)*

##### 2026-08-17 — the refused branch: live is not responsive *(resolves review-004 F5)*

The flow's refused branch reads *"an engine is already live. Connect to its socket, forward the reopen intent, exit 0"*, with no else. **Live is what the lock proves; responsive is what the branch assumed**, and three states in this document's own decisions hold the lock without answering: an engine **mid-drain** (step 1 has stopped accepting new work, and the drain may spend seconds on in-flight operations); an engine that has **acquired the lock but not yet bound the socket** at start; and the **wedged-but-alive** engine that `supervision-and-failure` is left holding.

**The Fork 1 reversal is what made this load-bearing.** Its cost was accepted on the grounds that *"a crashed engine stays dead until the user reopens it… the recovery is one Spotlight invocation"* — so reopening Fumi is now the design's **only** recovery gesture. A wedged engine is the one failure where that gesture does visibly nothing, on an app with no dock icon and, by then, no menu-bar item either:

```
fumis vanish from every Space (engine wedged — process alive, lock held)
user: ⌃Space, "Fumi", Enter
   → new process starts
   → flock refused: an engine holds it
   → connect, forward reopen intent …  no answer
   → exit 0
user: nothing happens. Tries again. Nothing.
```

> **A refused lock means an engine holds it, not that one is answering.**
>
> - **Incumbent answers** → forward the reopen intent, exit. Unchanged.
> - **Incumbent is going down, or has not bound the socket yet** → the lock will release shortly. Wait briefly and take it; the arriving process becomes the engine.
> - **Lock held and no answer** → surface it: *"Fumi isn't responding."*

**The two transient cases collapse into one path** — the arriving process does not need to tell a draining engine from a starting one, because both resolve the same way and on the same short timescale. It retries the lock; if it gets it, it is the engine. A double-click during a quit then brings Fumi back, which is exactly what the user was asking for by double-clicking.

**The wedged case inverts who reports.** The second process is **the only one in a position to tell the user anything**, because the wedged one by definition cannot — it is a GUI process and can draw an alert before it exits. It should also offer to **force-quit and reopen**, since the user's alternative is Activity Monitor. That works if **the lockfile carries the holder's PID**: a line of text beside the lock we already keep, letting the loser name the process and, on the user's say-so, terminate it and take the lock.

**A short wait here is not the constant this topic has twice refused to write.** Those bounds waited on an **app relaunch** — unbounded, machine-dependent, and wrong for somebody whatever number is chosen. This waits on a **local lock release or a socket answer**: fast, local, and with a benign fallback, since overrunning produces a visible alert rather than a wrong answer. The window is short and its size is implementation's.

##### 2026-08-20 — the arriving process reads the answer; silence means one thing *(resolves review-006 F4)*

Two blocks decided three days apart describe the same door differently. `Single instance` (2026-08-17) detects a wedge by **silence** — *"connect, forward reopen intent … no answer"* → surface *"Fumi isn't responding"* — with a short wait. `supervision-and-failure` (2026-08-19) then decided the engine **answers**: once the watchdog has seen the main thread stop, incoming requests fail with a distinct *not responding* error, and claimed that *"a client still needs no timeout of its own"* while this door keeps one.

Both are right about different windows:

```
t0        main thread stops
t0 … tw   watchdog has not noticed yet  → connect succeeds, silence
tw …      watchdog has tripped          → connect succeeds, "not responding"
```

> **The arriving process reads what it gets. Each case identifies itself.**

| what it receives | what it means | what it does |
|---|---|---|
| going-down frame | the engine is draining | stand down or wait, per `restarting` / `stopping` |
| connection refused | the engine has the lock but has not bound the socket | retry the lock |
| *not responding* | the watchdog has tripped | surface the alert immediately |
| silence on a live connection | a wedge the watchdog has not caught yet | short wait, then the same alert |

**The three other cases identify themselves, so silence carries exactly one meaning** — and the short wait is there to cover the watchdog's detection lag, not to distinguish cases. That is what the wait was doing implicitly on 2026-08-17, before the engine could answer at all.

**The contradiction resolves rather than being papered over.** *"No client needs a timeout of its own"* holds for `fumi` and `fumi-mcp`, because the engine always answers them. The arriving process keeps a wait for a different reason: it is the **backstop for the residual case `supervision-and-failure` already accepted** — a wedge that takes the socket queue with it, where nothing answers at all. A property about operations always being answered cannot cover the case where the answering machinery is itself stuck, and that is the only case this wait exists for.

**The alert is the same either way**, so nothing is gated on which window the process landed in. The force-quit-and-reopen offer is unchanged.

**Scope held:** this decides what a process that *meets* a wedged engine does. How a wedged engine might notice itself, and whether it can do anything from the inside, remains `supervision-and-failure`'s.

##### 2026-08-18 — a restart belongs to whoever asked for it *(resolves review-005 F4)*

The rule above — *"the lock will release shortly. Wait briefly and take it; the arriving process becomes the engine"* — was justified by the **menu-bar Quit**, where nothing else intends to start the engine. It was never run against the other two drains, where something does.

```
user clicks Update now
  → engine drains (seconds), the fumis vanish
  → user launches Fumi
  → that process waits out the lock and becomes the engine — pre-update binary
  → Autoupdate swaps /Applications/Fumi.app underneath it
  → Autoupdate reopens Fumi → finds the lock held → forwards intent, exits
  → the user is running the old engine; the update looks like it did not happen
```

~~The permission restart has the same shape against the wizard's relauncher.~~ *(Struck 2026-09-02 — no grant is requested, so there is no wizard relauncher. The rule below keeps its live case in Sparkle, which is the case it was diagrammed against.)* The Fork 1 reversal is what created the opening: it retired the *"relaunch mid-swap kills the process on an invalid signature"* hazard **on the grounds that nothing would relaunch anything**, and the 2026-08-17 rule then put a different relauncher in that place without the interaction being taken up.

> **A restart in progress belongs to whoever asked for it. An arriving process that learns the engine is `restarting` stands down rather than taking the lock, ~~and says what is happening~~. On `stopping` it takes the lock as decided — nobody else is coming.**

*(Clause struck 2026-09-15 — there is nowhere to say it. See the amendment below.)*

The going-down frame already carries the distinction, and an arriving process can obtain it: **during the drain the engine accepts connections and answers with that frame**, decided the day before. Standing down does not reintroduce the *"user launches Fumi and nothing happens"* silence the branch exists to prevent, ~~because the process reports the restart instead of exiting mutely~~ because that silence is **brief and self-resolving**: it ends when the relauncher reopens the app, and the launch gesture is answered by the desk coming back — which is what the user was asking for by making it.

*(Amended 2026-09-15 — this rested on the arriving process reporting the restart, and there is no such report. `status-and-alerts` has answered the question this topic routed to it: the restart-gap launch gets **no channel**. A modal is a dialog to dismiss while the app reappears behind it, drawn by a process that then exits; a notification persists in Notification Centre, and under that topic's rule that every notification opens the management window it would point at an update that finished hours earlier. The case lands on its existing *the user can already see it, or knows why* row — the user clicked Update — and the drain is logged like every other transition under this topic's Observability rule. **The rule is unaffected**, and so is the hazard it prevents: a pre-update binary seizing the lock leaves the user on the old engine with the update apparently not applied. The primary mitigation named below — expectation-setting in the update flow — is unchanged and still the real answer. **No duration is written here**: this topic has three times refused to write a constant it could not establish, twice over exactly this relaunch, and the concern's "about three seconds" would reintroduce one through the back door. Sibling check: status-and-alerts (discussion) — its decided text holds that this case gets no channel, that a notification would outlive the event it announces, and that it sits on the existing see-it-or-know-why row rather than adding one; all three are adopted and none revised.)*

**The likelihood framing was corrected in discussion, and the correction changes what this is for.** It was first put as a user panicking at a vanished desk. That is not the shape of it: **the user clicked Update, and expects the app to close and reopen.** So this is a guard against a narrow race, not a response to a likely event — and the primary mitigation is not this rule at all but **expectation-setting in the update flow**: an update that says *Fumi will close and reopen* makes the vanishing desk the thing the user was told to expect, and nobody reaches for Spotlight in the first place. **Rerouted to build-and-release triage (2026-08-20)**, whose brief already owns the update UX.

**Residual gap, accepted:** between the engine's exit and the relauncher reopening the app, there is no socket to carry an intent, so a launch in that window still takes the lock. It is brief, the relauncher is actively minimising it, and the failure is *"the update did not take, try again"* — the same outcome already accepted for a failed update. **Rejected: a marker on disk** recording that a restart is in progress. It is the same durable-state-for-a-coincidence this topic refused for the post-exit CLI case, with the same staleness problem, and it would be doing the job expectation-setting does better. **Rerouted to build-and-release triage (2026-08-20)** as a constraint on the relaunch instead: the relaunch must tolerate a user-initiated launch landing in that gap.

### Update path and the single start route

*(Opened by review-001 F3.)*

The Fork 2 write-up listed *"Sparkle replacing a bundle that contains the live process"* as a con of shape 2 and then chose shape 1 — whose single bundle also contains the live process, **plus** the `Contents/Library/LaunchAgents/` plist that `SMAppService.agent` registered. A shared cost was used to discriminate between shapes that both carry it. The cost is struck from the options list above and worked through here.

**The plist turns out not to be the interesting part.** This is:

```
        Sparkle asks the app to quit
        engine exits 0 (clean)          → launchd does NOT restart it  ✓
        Autoupdate swaps /Applications/Fumi.app
        Autoupdate relaunches the app   → via LaunchServices
                                        ↓
   the running engine is no longer the launchd job
        ├─ KeepAlive supervises nothing — crash recovery gone until logout
        ├─ `launchctl kickstart -k` would start a *second* engine
        └─ the job sits loaded-but-not-running
```

Two writers do not result — the single-instance lock catches the second process and it exits — but the supervision that Fork 1 was decided *for* is silently absent after every update, and the restart verb onboarding-and-permissions depends on points at a job that is not running.

**The `KeepAlive: {SuccessfulExit: false}` correction is load-bearing here, more than where it was made.** Under plain `true`, launchd would relaunch the engine *while Autoupdate was mid-swap* — a running process whose bundle is replaced underneath it, which is the classic invalid-code-signature kill. The correction was made for the menu-bar Quit; the update path needed it more.

#### Decision

##### 2026-08-12 — dissolved by the Fork 1 reversal

*Trigger: `process-model`'s Fork 1 reversed to a plain login item. This whole subtopic existed to keep the running process and the launchd job in step, and there is no job.*

> **Sparkle's ordinary relaunch is correct. `Autoupdate` quits the app, swaps the bundle, and reopens it — and the process that comes up is simply Fumi, as it was before.**

The failure diagrammed below cannot occur: nothing is supervising, so nothing can be *silently* not-supervising after an update. `launchctl kickstart` leaves the design along with the job it addressed, and `KeepAlive` with it — which also retires the *"relaunch mid-swap kills the process on an invalid signature"* hazard the correction above was protecting against, since launchd is not going to relaunch anything.

**What the update path still owes** is unchanged and belongs to the drain: an update is a planned exit, so the engine drains before quitting, and `restart-and-restore` already holds that the user chose the moment. `build-and-release` inherits a simpler constraint than before — Sparkle's own relaunch, not a `launchctl` verb.

**The bundle-move worry returns, and is smaller than it was.** Registration repair was what closed it; without repair, whether an `SMAppService.mainApp` registration survives the user moving `Fumi.app` between `/Applications` and `~/Applications` is once again unverified. It is a login-item preference rather than a start route now, so the failure is *"Fumi stopped opening at login"* — visible, and fixed by toggling the preference. Joins the spike list at that weight.

##### Initial

> **There is exactly one way the engine ever starts: launchd.**

- **Sparkle's relaunch step goes through launchd** — a `launchctl kickstart` of the job rather than an `open` of the bundle — so the running engine is always the launchd job. *(The Sparkle-side mechanism is build-and-release's to build; the rule is this topic's.)*
- ~~**The engine re-registers its agent on every launch.**~~ *(Amended by review-002 F1 — registration **repair** was right, **unconditional** was not: unconditional re-registration has no defined order against the single-instance lock, and lets a stray bundle repoint the login job. Registration is now the **launcher** role's, conditional on the registration being absent or dangling, with the engine verifying it points at its own bundle. See **Engine and launcher roles** above.)*

**Registration repair closes a second open item for free** — the *"does the registration survive the user moving `Fumi.app` between `/Applications` and `~/Applications`"* risk named in the fork above stops mattering, because the old path is gone and the next launch registers wherever the bundle now lives.

### Lifecycle: start, reopen, quit

**The question that unlocked it: what is the difference between "the engine running" and "the app running"?**

Under shape 1, none — they are the same process. There is no app to launch separately from the engine, and macOS will not start a second instance of a bundle already running. So *"launching Fumi when Fumi is already up"* is not a launch: the running process receives a **reopen** event. Two genuinely different situations had been wearing one gesture:

| | what actually happened | what the user is asking for |
|---|---|---|
| **Cold start** — login, reboot, or after a Quit | the process starts | *put my desk back* |
| **Reopen** — already running; Spotlight, Finder, Dock | the process is already up | *show me something* |

**The governing rule:**

> **Restoration fires once, at the first session-ready moment after process start — never on reopen.**

*(Originally written "fires on process start"; refined by review-001 F5 — see **Restart And Restore**. The refinement moves only **when** within a single start: the rule stays unconditional and stays independent of what started the engine.)*

Everything else follows from it:

- **Cold start** → the engine comes up and every fumi that was open returns to its Space, display and position. **No management window.** The restoration *is* the launch — the user asked for their desk back, and they got it.
- **Reopen** → there is nothing to restore; the fumis are already on screen. The gesture can only mean *show me something*, and the management window is the answer. (Precedent: Moom and its class behave this way.)
- **Quit** → closes everything, and stays quit. ~~this is `KeepAlive: {SuccessfulExit: false}` working as intended, not fighting it.~~ *(Amended 2026-08-12 — the Fork 1 reversal removed `KeepAlive`; Quit stays quit because nothing restarts a quit app, which needed no configuring in the first place.)* The next launch is a cold start, so it restores.

**Quit needs no confirmation dialog**, despite being much heavier here than in an ordinary app (the engine owns every window, so Quit clears every fumi from every Space at once). Ground decided elsewhere covers it: close is hide, autosave is always on, and delete is a separate, reversible action. Quitting loses nothing — it is the app equivalent of putting the notes away. *Sibling check: note-window — close-hides-not-deletes and always-autosave are both decided there; note-model carries no contrary rule.*

**Quit is not "stop Fumi launching at login".** That is a different verb living in preferences (`SMAppService.unregister`), and Quit must not quietly imply it.

**The dock-icon toggle** needs no debate — the inherited default-off-with-opt-in stands. `LSUIElement` in `Info.plist` plus `setActivationPolicy` at runtime flips it live, no relaunch. ~~*(It does touch the same unverified `NSApplication`-under-launchd surface named in the risk above.)*~~ *(Amended 2026-08-12 — that risk went with the Fork 1 reversal. Fumi launches as an ordinary app, so `LSUIElement` and `setActivationPolicy` behave the ordinary way and nothing here is unverified.)*

#### Journey

The first proposal was **reopen opens the management window**, full stop — argued from the failure mode that an `LSUIElement` app with no dock icon and no open windows does *visibly nothing* when launched, so the user concludes it is broken. That failure is real but the rule was too broad: it collapsed cold start and reopen into one event. The user's correction split them, and the split is better because it removes the failure mode without inventing anything — at cold start something *does* visibly happen (the fumis come back), so there is no silence to fill.

#### Decision

**Start restores; reopen shows the manager; quit closes everything and stays closed until the next launch, which restores.**

**Accepted trade-off, named rather than smoothed over:** the same user gesture does two different things depending on whether the process is alive. The user can tell — the menu-bar icon is present or absent — and it is the established pattern for this class of app, but the asymmetry is real and is accepted deliberately.

*(Amended 2026-09-14 — the icon is not guaranteed to be drawn, so "the user can tell" is weaker than written. It costs nothing here, unlike in the crash case: both outcomes of the gesture are benign — the desk returns, or the manager opens — so a user who cannot tell in advance simply gets whichever was appropriate. The asymmetry stays accepted; the confidence that it is always legible does not.)*

**One seam explicitly not decided here:** the very first run after install has nothing to restore, so under this rule nothing would appear. That belongs to the onboarding wizard (**onboarding-and-permissions**), not to reopen logic — recorded so it does not fall between the two topics.

---

## Client Connection Lifecycle

### Context

*(Opened by review-001 F1 — a consequence of the `process-model` decision rather than a fresh concern.)*

~~`KeepAlive: {SuccessfulExit: false}` was chosen so that a deliberate exit is authoritative.~~ *(Amended 2026-08-12 — the Fork 1 reversal removed `KeepAlive`. The consequence below is unchanged and now simply structural: nothing restarts a quit app, so a deliberate exit is authoritative by default rather than by configuration.)* The unexamined consequence: **after a clean exit there is no engine until the next login.** Three routes reach that state, and only the first had been discussed:

- the menu-bar **Quit**;
- the user switching Fumi off in **System Settings → General → Login Items** — a first-class OS affordance for exactly this class of process, and completely invisible to the app;
- **first run**, before registration has happened at all.

It bites hardest on the two clients with no UI. A note window or the menu-bar item cannot be clicked when the engine is dead, so those are self-explanatory. `fumi` and `fumi mcp` get invoked into a void:

```
5:00pm  Quit from the menu bar    → engine gone, fumis away
5:30pm  agent runs `fumi list`    → connects to the socket
                                  → nothing listening
                                  → ?
```

### Options Considered

**A. A client starts the engine on demand.** Discovery already rejected this ("CLI cold-launches the GUI on demand") on cold-start latency and *"UI wakes when you wanted to script quietly"*.

**B. A client starts the engine but suppresses restoration.** The apparent middle path — the engine comes up to serve the request without throwing windows on screen.

**C. A dead socket is a clean, structured failure.** No client ever starts the engine.

### Journey

**The original rejection of A is now considerably stronger than when it was written.** Under the rule just set in `process-model`, a process start restores every fumi. So `fumi list` at 5:30pm would not quietly wake a daemon — it would splash the user's entire desk back onto every Space while they were out. The 2026 discovery objection was about latency and unwanted UI; it now also collides with the restoration rule head-on.

**B was taken seriously and rejected on what it does to that rule.** Suppressing restoration makes *"restoration fires on process start"* conditional on **who** started the process, and the user's desk state starts depending on whether an agent happened to run a command while they were away. A rule one decision old should not acquire an exception that fast, and the exception buys only the convenience A was already denied.

**The user's framing settled it from the other direction: this is simply the ordinary shape for an MCP-served app.** Paper via MCP behaves this way — if the app is not running there is nothing to connect to, so the client dies. Fumi is not special here. Where Fumi *is* different is that it is a menu-bar app that is running whenever you have any fumis open, so in practice the dead-socket path is rare rather than routine. The design holds from either angle.

### Decision

> **The engine is never started by a client. It starts on user action, or at login when launch-at-login is registered — nothing else.**

- **CLI** → exit code 1 with a human-readable line ("Fumi isn't running"), plus a machine-readable error code the wrapper can act on.
- **MCP** → returns an error, same shape.

Both clients fail identically; neither has a wake path.

**Cost, accepted:** an agent mid-task hits a stop it cannot resolve itself — only the human can clear it.

**Live thread, not decided:** whether that cost argues for making **Quit less prominent** than an ordinary app's Quit. Raised while deciding this; the never-auto-start line was agreed, the prominence question was not taken up.

### Restart mid-connection

#### Context

The engine now restarts **by design** — ~~on a permission grant (onboarding-and-permissions) and~~ on every Sparkle update (`process-model` — the `Update path` subtopic it cited dissolved with the Fork 1 reversal; the restart it names still happens). *(Amended 2026-09-14 — the permission-grant driver was struck on 2026-09-02, when space-homing measured that no TCC grant is requested; a Sparkle update is the only restart driver. The sweep that annotated every peer occurrence that day did not reach this paragraph.)* So a client holding a connection when the engine goes down is a designed-in event, not a fault:

```
10:42:03  agent: fumi edit 01J9… <body>    → engine applies it, replies    ✓
10:42:04  agent: fumi edit 01J9… <body>    → engine applies it…
10:42:04  Sparkle: quit please
          engine exits 0                    → reply never sent
          agent sees: connection closed
          did it land?
```

**It bites differently per client.** `fumi` is exposed for milliseconds per invocation. `fumi-mcp` is connected for hours and will certainly be holding a connection across an update — and if it exits when the engine goes, the MCP host may not restart it, so the user's agent silently loses Fumi until they restart their client, with no visible link between the two events.

#### Options Considered

**A. Clients just handle drops.** Nothing special in the engine.
- Cons: every restart leaves every in-flight write ambiguous, permanently.

**B. The engine drains on planned exits.** Stop accepting new work, finish what is started, reject received-but-not-started work with a definite *not applied*, tell connected clients it is going down, exit. Clients reconnect with backoff.

**C. B plus request-id idempotency.** The client mints an id per operation; the engine records applied ids in SQLite; a retry with the same id returns the original result rather than re-applying. Covers crashes as well as planned exits.

#### Journey

**C was argued against explicitly, because it is the option that looks most rigorous.** Its state has to survive an engine restart to be worth anything — that is precisely the case it exists for — so it costs an extra SQLite write on every mutating operation, forever, to disambiguate an event that only occurs when the engine dies *un*cleanly. That is a crash, which should be rare, and which existing decisions already soften: version history captures every change regardless of author, so a duplicated append surfaces in the scrubber as an extra version the user can restore past. Permanent cost against a rare, already-recoverable failure.

**B's real payoff is not recovery — it is that the common case stops being ambiguous at all.** When the engine answers *"not applied"*, the client retries safely and needs no idempotency, because the question was answered rather than inferred. Planned restarts stop being a correctness problem and become ~~a ~2 second pause~~ *(amended 2026-08-12 — a pause of however long the relaunch takes, which is not ours to predict; the correctness claim is what mattered and is unaffected)* an interruption rather than an ambiguity.

#### Decision

##### 2026-08-13 — revised: the drain orders by recoverability, and has a deadline of its own

*Trigger: review finding — the drain's stated budget (*"well under a second"*) is contradicted by `operation-core`'s own decision that a single `create` can carry a remote asset fetch, seconds of network (review-004 F2).*

> **The drain orders by recoverability, not by arrival. Engine-owned state flushes first; in-flight client operations are waited on after it, within the drain's own deadline.**

1. Stop accepting new work.
2. **Flush engine-owned pending state** — the live editor buffer, the debounced per-device blob, the sync state.
3. Reject received-but-not-started operations with a definite **not applied** — safe to retry.
4. Finish operations already started, within the drain's deadline.
5. Signal connected clients that the engine is going down, with intent.
6. Exit.

**The old order was backwards on the only axis that matters.** Flushing engine-owned state sat *behind* waiting for in-flight client work, and the two have opposite recovery stories: a client whose `create` is in flight can retry, while the per-device blob has no retry path at all and is *"exactly what restoration reads back at the next start"*. So the grace running out mid-wait killed the process before the flush — precisely the loss that step was added to prevent, arriving through the door the wait left open:

```
user drops a URL image into a note → create: remote fetch, ~6s
+0.2s   quit please
        stop accepting new work                     ✓
        finish started operations                   ⟳ waiting on the fetch
                  · editor buffer: 3 words just typed
                  · per-device blob: dirty, a note moved 4s ago
+N      grace expires → SIGKILL
        → buffer and blob lost; at next start, notes return to
          where they were before the move
```

Flushing first is also cheap: local writes, no network, so it lands well inside any grace an actor gives.

> **An operation abandoned at the deadline is answered *not applied*, and that answer is exact.**

**This needed no new answer class, which was the surprise.** The instinct was that an abandoned operation is *indeterminate* — a third answer beside applied and not-applied, which is the ambiguity this subtopic built the drain to eliminate. But operations are **atomic** (`operation-core`): an asset add commits bytes, manifest entry and content token as one unit. An operation abandoned **before its commit point applied nothing**, so *not applied* is exact rather than a hedge, and identical to what step 3 already answers. Past the commit point it is *applied*. The commit point is the whole boundary.

**No number on the deadline.** Same reasoning as the retry bound retired the day before: a fetch on a slow network and a fetch on a fast one are not the same wait, and any constant written here is wrong for somebody. What matters is that a deadline exists and sits inside whatever grace the actor allows.

**The two actors fail very differently, and only one of them fails loudly.**

- **A Sparkle update** is user-initiated (`restart-and-restore`: *"every planned restart is user-initiated"*), so a drain that outruns Sparkle's wait-for-quit surfaces as *"update failed, try again"* with the app still running and nothing lost. That is an ordinary, recognisable outcome, and the user retries or force-quits. **This path needs no protection beyond the ordering.**
- **Logout or shutdown** is where the quiet loss lives. The user is not watching, macOS's grace is what it is, and nothing announces that a flush was cut short. This is the path the recoverability ordering is really for — and the exposure it leaves is small by construction, since autosave is always on and the blob debounce is a few seconds, so what is at risk is seconds of geometry rather than content.

**Named and accepted:** a late-completing operation can re-dirty state after the flush. It can, and the ordering does not make it impossible — it is the same small window the settle windows already accept, and it is bounded by the deadline above.

##### Initial

> **The engine drains on planned exits; only crashes stay indeterminate, and are reported as such.**

1. Stop accepting new work.
2. Finish operations already started.
3. Reject received-but-not-started operations with a definite **not applied** — safe to retry.
4. **Flush engine-owned pending state** — see below.
5. Signal connected clients that the engine is going down, with intent.
6. Exit (0 or non-zero per the exit table below).

**Step 4 exists because the drain was written entirely in terms of socket traffic** *(review-002 F6)*, and two categories of in-flight work never cross the socket:

- **The `app` channel.** A window edit is in-process — `client-transport` notes *"`app` is free"* — which also makes an in-progress edit invisible to a sequence built on accepting, starting and rejecting socket requests. Sparkle quits the engine while the user is mid-sentence.
- **The engine's own debounced writes.** storage-and-sync gives the per-device blob a debounce, the version-history snapshot a settle window, and `CKSyncEngine` a persisted change-token. A planned exit inside any of those windows drops work the **engine** owns rather than work a client submitted — and the per-device blob is exactly what restoration reads back at the next start, so the loss surfaces as notes returning to where they were some seconds before the update, on a path the product performs routinely.

So the drain flushes the live editor buffer, forces the debounced blob writes, and lets the sync state persist, before signalling clients. **The crash path leaves these unflushed, which is the loss the settle windows already accept** — no new exposure, and the reason the planned path must not inherit it.

**Clients reconnect with backoff rather than exiting.** `fumi-mcp` in particular must survive an engine restart, so a Sparkle update is invisible to the agent using it.

#### The going-down signal carries intent

*(Opened by review-002 F5.)* All three planned exits reached step 4 with the same undifferentiated signal, but they mean opposite things: a Sparkle update ~~and a permission restart~~ comes back, a menu-bar Quit is gone until the user acts. *(Amended 2026-09-14 — the permission restart was struck on 2026-09-02 and this occurrence was missed by that sweep. The distinction the block is drawing is unaffected: it needs one returning exit and one that does not, and Sparkle is the returning one.)* *(This read *"back in ~2 seconds"*; amended 2026-08-12 — that figure was an illustration reading as a specification, and the revision below removes every bound sized against it.)* Undifferentiated, `fumi-mcp` backs off forever against an engine that was quit deliberately — the failure this subtopic opens by naming, re-entering through the other door: a client that waits forever rather than one that exits. The CLI has the mirror problem — a *"not applied, safe to retry"* answer is safe only if something will be listening, while its other decided behaviour is to exit 1 immediately.

The engine already knows which case it is in: it is the same classification as the exit table above.

> **The going-down signal carries an intent — `restarting` or `stopping`.**

##### 2026-08-12 — revised: the intent buys a better error, not a wait

*Trigger: review finding — launchd's respawn throttle sat unnamed underneath the bounded retry (review-003 F5) — and then the user's objection, which dissolved the bound rather than sizing it: relaunch time is not a property we control. A loaded machine can take a minute; an idle one half a second. Any constant written here is wrong for somebody.*

| | `fumi` | `fumi-mcp` |
|---|---|---|
| `restarting` | report *"Fumi is restarting"* — a distinct answer from not-running. No wait. | reconnect with backoff, **no bound**; a tool call arriving meanwhile reports *restarting* |
| `stopping` | not-running error, unchanged | go idle; reconnect lazily on the next tool call, reporting not-running meanwhile |
| no signal (crash) | not-running | **takes the `stopping` behaviour** — go idle, reconnect lazily on the next tool call, reporting not-running meanwhile |

**Settled by derivation** — not discussed. The crash row originally stated only the reported answer and left `fumi-mcp`'s connection behaviour open. Determined by this entry's own reasoning: a silent drop is **indistinguishable** from every other unsignalled disappearance, so the client cannot select a behaviour specific to it; and the unbounded-backoff branch exists because an engine that announced `restarting` is coming back, which after the Fork 1 reversal nothing does (review-004 F4).

**The CLI has no case for waiting at all.** This subtopic already observes that *"`fumi` is exposed for milliseconds per invocation"*, so the window in which a call is in flight **and** the engine drains is a coincidence, not a scenario. Retrying is machinery for it.

##### 2026-08-13 — the signal's reach: who actually receives it *(resolves review-004 F3)*

The table above says what each client does **on receiving** the signal, and it is delivered at drain step 5 to clients holding a connection. Two populations hold none, and the table was silent on both:

```
t0   quit please
     engine drains ─────────────────────────┐
t1   engine exits                            │  ← a client connecting in
     ····· down window (unbounded) ·····     │    here: no defined answer
t2   relaunch completes                      │
                                             │
     a `fumi` invoked anywhere in this gap connects to nothing
```

> **During the drain, the engine accepts connections and answers with the going-down frame, then closes.**

*"Stop accepting new work"* is step 1; it does not mean stop answering the door. The socket is still bound and the process is alive, so a client arriving mid-drain can be told the intent instead of finding a refused connection. This matters more since the drain gained a deadline it may spend waiting on in-flight operations — the window is seconds, not instants.

> **After the engine has exited, a client that cannot connect reports not-running. That is the end of it.**

**The post-exit gap is left open deliberately, not overlooked.** The only way to close it is a marker on disk — *"I went down intending to come back"* — consulted by a client that cannot connect. Rejected: it is durable state invented to smooth a coincidence; it needs a staleness rule, since an engine killed after writing it would leave clients reporting *restarting* indefinitely; and sizing that rule means writing down exactly the kind of constant this subtopic has now twice refused to write.

**What decides it is who is actually confused.** A down window only follows a **user-initiated** restart — `restart-and-restore` holds that the engine never restarts on its own initiative — so the human clicked update or pressed a button in the permission wizard, and Sparkle or the wizard is telling them what is happening. The only party told *"Fumi isn't running"* is an agent, and the statement is **true**: Fumi is not running. It reports that, the user says they just updated it, and the agent retries. A fair exchange for no machinery.

**The subtopic's original justification did not cover this, and the review was right to say so.** *"Exposed for milliseconds per invocation"* is about being mid-request when the drain begins; it says nothing about being **invoked** during the down window, which the 2026-08-12 revision made explicitly unbounded (*"a loaded machine can take a minute"*). That case needed an answer rather than an inherited one — and the answer is the honest report it already produces.

**`fumi-mcp`'s case was never the wait — it was not saying something false.** It is long-lived, so waiting costs it nothing and needs no bound; what mattered is that *"Fumi isn't running"* tells an agent to give up, while *"Fumi is restarting"* tells it to try again. That is the whole value of the intent, and it is information rather than timing.

**The crash row corrects itself as a consequence.** It read *"treated as `restarting` — launchd will bring it back"*, which was only true while something was bringing it back. Nothing is. A silent drop is also the only thing a client can honestly infer from the outside, since a crash is indistinguishable from every other unsignalled disappearance.

**Cost, accepted:** an agent working during a Sparkle update gets an error rather than a seamless pause. It gets an **accurate** error that says retry — which is the best available answer when the wait might be a minute, and better than a bound that expires into a lie.

**The unestablished constant is gone rather than deferred.** There is no bound left to measure, so nothing here is sized against a number this topic never established.

###### 2026-08-19 — `restarting` describes a relauncher, not an intention *(resolves review-005 F5)*

`fumi-mcp` reconnects on `restarting` **with no bound**, and the bound was removed deliberately rather than sized. That is safe only while the engine is certain to return — and the Fork 1 reversal is what made it uncertain. The document already used exactly this reasoning to settle the crash row: *"the unbounded-backoff branch exists because an engine that announced `restarting` **is coming back**, which after the Fork 1 reversal nothing does."*

The same doubt reaches the `restarting` row. The permission restart is explicitly *"either a relauncher helper of the same shape Sparkle uses reopens it, **or the user does**"* — under the second shape the engine announces `restarting`, exits, and returns only if the user obliges. The agent is then told *"Fumi is restarting"* indefinitely about an app that is off: the failure this subtopic opened by naming, arriving through the door the intent was meant to close.

*(Amended 2026-09-02 — this worked example is gone: no grant is requested, so there is no permission restart and no exit whose return depends on the user obliging. The rule below is kept as written, because it is what makes the remaining assignment derivable rather than incidental — Sparkle's `Autoupdate` is bringing the engine back, so a Sparkle exit is `restarting`; nothing brings back a Quit or a `SIGTERM`, so those are `stopping`. `restarting` now has exactly one emitter. Keeping a definitional rule whose only live case is unambiguous costs a paragraph; losing it would leave the next restart driver to guess.)*

> **`restarting` is emitted only when something other than the user is bringing the engine back. Where the return depends on a human reopening the app, the intent is `stopping`, whatever the reason for the exit.**

**This sharpens what the two values mean, and the sharper definition is the better one.** They stop describing the engine's *intentions* and start describing **what the client should do** — which is the only thing the client can act on. It is a *back in five minutes* sign: worth hanging only if someone is actually coming back.

**It also decouples the protocol from an undecided sibling.** `onboarding-and-permissions` has not chosen which relaunch shape the wizard uses; under this rule it does not need to, because the engine emits the intent matching whichever it picks. *(Amended 2026-09-02 — there is no shape left for it to pick. The decoupling still holds, and now against a future driver rather than a pending one: any restart added later emits the intent matching whatever brings the engine back.)*

**Residual, accepted:** a relauncher can itself fail — Sparkle quits the app and the install dies — leaving the sign up wrongly. The client's backoff resolves the moment the user reopens Fumi, which is the recovery gesture every other decision in this topic already leans on. **Rejected: a floor on the client's trust in `restarting`**, since sizing one means writing the constant this topic has now refused three times.

##### Initial

| | CLI (`fumi`) | `fumi-mcp` |
|---|---|---|
| `restarting` | wait a bounded moment, retry — an update becomes a pause, not an error | reconnect tightly |
| `stopping` | fail immediately with the not-running error | go idle; reconnect lazily on the next tool call, reporting not-running meanwhile |
| no signal (crash) | treated as `restarting` — launchd will bring it back — falling through to the not-running error if the bound passes | same |

**Lazy beats polling for `fumi-mcp`**: Fumi being quit and relaunched mid-session then just works, with no timer anywhere.

~~**A crash that outlasts the bound is a crash loop** — what the engine and launchd should do about that is `supervision-and-failure`'s.~~ *(Amended 2026-08-12 — a crash loop needs something restarting the process in a loop, and after the Fork 1 reversal nothing does. A crash that outlasts the bound is simply a dead engine, and the client says so. What remains for `supervision-and-failure` is the wedged-but-alive engine, not the loop.)*

**Dependency named rather than assumed:** this rests on `fumi-mcp` not needing a *live* connection when idle. If no client subscribes to changes, it can be entirely lazy — connect per tool call and done. Whether any client subscribes is `change-notification`'s call, and it reaches back into this decision.

#### Exit classification — what triggers a drain, and what restarts

*(Opened by review-002 F4. The five steps above were written around a clean exit, which left signals classified as crashes by omission and left the permission-grant restart with nowhere to sit: it has no external actor, so `exit 0` means `{SuccessfulExit: false}` deliberately does **not** bring the engine back.)*

##### Restated 2026-08-12 for the Fork 1 reversal

*Trigger: `process-model` reversed to a plain login item, so the table's third column — what launchd does — no longer exists, and the permission relaunch loses the mechanism it was written around.*

##### Restated 2026-09-02 — the permission row goes

*Trigger: `process-model`'s 2026-09-02 entry — no TCC grant is requested, so the deliberate-restart row has no trigger.*

| trigger | engine does | what brings it back |
|---|---|---|
| menu-bar Quit | drain → **exit** | nothing — stays down until the user opens Fumi |
| `SIGTERM` (logout, shutdown) | drain → **exit** | nothing |
| Sparkle update | drain → **exit** | Sparkle's `Autoupdate` helper reopens the app |
| crash | — | nothing; in-flight work indeterminate, user reopens |

**The row is removed rather than generalised to a bare *deliberate restart*.** Sparkle is already its own row, so a generalised row would carry no trigger. If a second restart driver ever appears it is added then, against machinery that is entirely unchanged by this.

**One consequence worth stating positively: `restarting` now has exactly one emitter.** Every planned exit in the table is either Sparkle (`restarting` — `Autoupdate` is bringing it back) or the user's own (`stopping`). The going-down signal's two values each have exactly one class of case, which is what the 2026-08-19 rule was reaching for and could not have while the permission restart straddled both.

##### Restated 2026-08-12 for the Fork 1 reversal *(the permission row struck 2026-09-02, above)*

| trigger | engine does | what brings it back |
|---|---|---|
| menu-bar Quit | drain → **exit** | nothing — stays down until the user opens Fumi |
| `SIGTERM` (logout, shutdown) | drain → **exit** | nothing |
| ~~deliberate restart (permission grant)~~ | ~~drain → **exit**~~ | ~~a relaunch the user asked for — see below~~ |
| Sparkle update | drain → **exit** | Sparkle's `Autoupdate` helper reopens the app |
| crash | — | nothing; in-flight work indeterminate, user reopens |

> **`SIGTERM` is a planned exit, not a crash.** Unchanged, and still needed regardless — logout and shutdown deliver it.

> ~~**The permission relaunch is: drain, exit, and something the user asked for reopens Fumi.**~~ *(Struck 2026-09-02 — no grant is requested, so there is no permission relaunch.)* The exit-code distinction is gone — no policy is reading it — so every planned exit is simply an exit.

~~**What reopens it is the wizard's mechanism, not this topic's**, and both available shapes satisfy `restart-and-restore`'s decided rule that every planned restart is user-initiated: a relauncher helper of the shape Sparkle already uses, reopening the app after it quits, or the wizard telling the user to reopen it. **Dependency: onboarding-and-permissions.**~~ *(Struck 2026-09-02 — the dependency is discharged by being dissolved: there is no mechanism for that topic to choose.)*

*(The exit-code table above is superseded. It read: Quit / `SIGTERM` / Sparkle → **exit 0**, launchd does nothing; permission grant → **exit non-zero**, `{SuccessfulExit: false}` brings it back — with the note that the permission restart *"uses the property Fork 1 was chosen for directly."* That property is what Fork 1 gave up.)*

~~**Named dependency:** the drain runs inside launchd's `SIGTERM`-to-`SIGKILL` window (`ExitTimeOut`, 20 s by default).~~ *(Amended 2026-08-12 — no launchd, so no `ExitTimeOut`. The budget is now whatever the actor allows: macOS's own logout/shutdown grace on `SIGTERM`, and Sparkle's wait-for-quit on an update. ~~Both are generous next to a drain that should finish in well under a second,~~ but the constraint is still not chosen freely — it is set by whoever is asking the app to quit.)* *(Struck 2026-08-13 — the figure was retracted the next day: `operation-core` decides a single `create` can carry a remote asset fetch, seconds of network, which is the trigger for the drain's recoverability ordering. The graces are precisely **not** known to be generous relative to the drain — that is why engine-owned state now flushes first.)*

~~**Named cost, owed to `observability`:** routine non-zero exits are not failures here, so the engine must log the restart intent.~~ *(Amended 2026-08-12 — there are no routine non-zero exits any more. The logging is still owed for the opposite reason: with nothing recording why the process went away, a deliberate restart and a crash look identical after the fact. The engine logs the intent before draining.)*

**Crash case, accepted:** a connection that drops with no drain signal leaves an in-flight write indeterminate. Reads retry freely; writes are surfaced as indeterminate rather than silently retried. **Idempotency machinery (option C) is deferred, not rejected** — if crash-duplicates turn out to matter in practice, C is the answer and nothing here blocks it.

**Boundary not crossed:** note-window raised a **session declaration** on the agent surface — the CLI/MCP opening and closing an operation so the engine knows an agent is engaged *before* it writes — and left it open as **agent-surface's** call. Adjacent to this subtopic, deliberately not annexed by it. *(Answered 2026-09-13, recorded here 2026-09-14 — agent-surface decided the session declaration **does not exist**: a content write carries the read token for the body it replaces, and a stale token is refused. The boundary held; the thing on the other side of it turned out to be a guard rather than a session.)*

*Sibling check: note-window — its concurrent-agent-write decisions and the session-declaration thread are unchanged; this decides transport-level restart behaviour, not what a write means. storage-and-sync — single-writer and the version-history model are relied on here, not revised.*

*Left to other subtopics: the socket path and how a client discovers it (`client-transport`); ordering and concurrency across simultaneous clients (`operation-core`).*

---

## Client Transport

### Context

*(Opened by review-001 F6.)*

storage-and-sync arrives here as decided and binding: the version scrubber labels every write `app`, `cli` or `mcp`, and *"the engine knows this from the connection the write arrived on; nobody asserts it and nobody can spoof it."* That is not a property the engine has by default — it is a bill payable by the transport.

`app` is free: a window edit is in-process and never crosses the socket. The other two are the problem. `fumi` and `fumi mcp` connect to the same per-user socket path, which every process running as the user can open, and a connection carries no channel label unless something puts one there.

#### Path resolution moves engine-side now that a path is content, not an argument

*From: agent-surface · discussion · 2026-09-13*

**The decision that moved it.** `agent-surface` removed the asset-add operation from the client surface entirely. There is no `fumi add <path>` and no path argument anywhere on it. An agent attaches a file by writing a filesystem path into the note body where a `fumi://asset` token would go — `![shot](/Users/lee/Desktop/shot.png)` — and the engine's existing materialisation scan carries it: bytes copied into the destination bundle, a new id minted, that one token rewritten. This is the shape the user proposed directly, replacing a two-step add-then-embed: *"Can't Claude just put the image into the text and fumi engine turns it into the correct format, pulling the file in etc.?"*

**What that does to the path rule.** The 2026-08-18 decision below holds that *"the wire carries absolute paths. Resolving a relative path against the caller's working directory, and expanding `~`, happens client-side before the frame is built"* — with `fumi add ./board.png` as the worked case, and the absolute-path requirement framed as *"a constraint on the tool schema rather than a runtime fallback"*.

That rule was written for a path as an **operation argument**, which a client can normalise before building the frame. A path inside `content.md` is not an argument. A client cannot resolve it without **editing the user's text**, and note-model reserves that to the engine: the token rewrite during materialisation is *"the one app-authored mutation of `content.md`"*, performed engine-side, scoped to the tokens being materialised.

**So `~` expansion now happens engine-side**, during the same scan that materialises the token. `agent-surface` decided the form: **absolute paths are the form to use, `~` is expanded, and a relative path is not resolved at all** — it stays in the text as written and the write's response names it among what could not be carried, degrading exactly as an unresolvable token or an oversized file does.

**Two options were rejected there, and both touch this topic's area** — recorded so the reasoning arrives with the outcome:

- *The engine resolves a relative path against the calling process's working directory.* Technically available, since the engine already inspects the connecting peer to derive `via`. Rejected on two costs: that inspection runs **once at accept time** while a working directory would have to be read **per request**, and `fumi-mcp` is a long-lived server whose working directory is wherever its host launched it and therefore meaningless. Judged purely additive if it ever matters.
- *The client sends its working directory with the request.* Rejected because the `via` decision deliberately chose to **derive** context rather than accept it asserted, and this would add a field to every request for a rare case.

**What is asked.** Not a reversal — the case is one the rule did not contemplate rather than one it decided against, and `bytes never cross the socket` is untouched: a path still crosses, never contents. What is owed is that the client-side-resolution clause no longer covers the only route a path now takes, and that the `fumi add ./board.png` worked case names an operation that no longer exists.

### Options Considered

**A. The client asserts its channel in a handshake.** Simple, and correct in normal operation — the *caller* still cannot influence it, because our client code sets the field, not the agent's input.

**B. The engine derives the channel from the peer.** `LOCAL_PEERPID` on the accepted connection gives the connecting process's PID, and from there its executable path. Nothing about `via` crosses the wire.

**C. A separate socket per channel.** The channel is which door you came through. Cheap, but still assertion — by door-selection rather than by field.

### Journey

**A framing error had to be cleared first.** The concern was originally raised as *"if the socket is open to anything running as you, `via` cannot be unspoofable, so storage-and-sync's wording is overstated and owes a correction"*. The user's objection dismantled it: the label is set by **our code**, not by the caller. An agent talking to `fumi mcp` cannot make it say `cli` — it never touches that field. The property the decided wording actually needs — *the writer does not get to declare who it is* — holds under every option here. What was being defended against is a process choosing to mislabel its own writes in its own note library, which is nobody's problem and no adversary anyone has.

**The user then pushed past the stamp entirely** — *"I don't understand why we can't derive this"* — and derivation turns out to be literally achievable, which is strictly better than A: nothing is asserted at all, so storage-and-sync's wording is satisfied exactly as written rather than reinterpreted. **No correction is owed to that document.**

**That left one sub-choice: how cleanly does the executable path identify the channel?** If `fumi mcp` is the `fumi` binary with a subcommand, the engine must read the peer's `argv` (`sysctl KERN_PROCARGS2`) to tell them apart — workable same-user, but a fussier syscall and a weaker signal. Two separate binaries make the path alone decisive.

**A chained-client shape was floated and rejected on the derivation itself.** If `fumi-mcp` invoked `fumi` under the hood, the engine's peer inspection would see `fumi` as the connecting process and stamp `via: cli` on every agent write — attributing agent edits to the human, the precise failure storage-and-sync's attribution decision exists to prevent. It also pays process-spawn cost per request, discards connection state, and forces the MCP server to parse the CLI's human-readable output instead of speaking the protocol.

### Decision

> **`via` is derived engine-side from the connecting peer, never sent on the wire.** The engine reads the peer PID off the accepted connection and resolves its executable path.

**Two separate client binaries**, both shipping inside the one app bundle: `fumi` (one-shot CLI) and `fumi-mcp` (long-lived stdio server). The executable path alone identifies the channel — no argv reading, no string matching. The shapes are genuinely different jobs, and it keeps the CLI-ships-first sequencing clean.

> **Clients are siblings over the socket, never chained through each other.** Each is thin over the *engine*: parse arguments, one socket request, format the result. No note logic, no storage logic, no client calling another client.

**The socket stays open to anything running as the user — intended, not tolerated.** A scripting-first tool that locked out the user's own shell scripts would have the wrong shape, and ~~every process running as them can already read the files directly~~ *(struck 2026-08-20 — see below)*. No code-signature gate.

*(Premise struck, conclusion unchanged — resolves review-006 F5.)* The 2026-08-18 path-passing decision made that clause false for part of the disk: macOS gates Desktop, Documents, Downloads, iCloud Drive and removable or network volumes **per app**, and the engine is the one holding that access. So the property this decision now carries, named rather than left to be rediscovered:

> **A process that could not read a protected location itself can hand the engine a path there and have the bytes land in a note bundle — which lives in Application Support and is not gated at all.** Our access, someone else's request.

**The conclusion never rested on that premise alone**, and the load-bearing half is untouched: a scripting-first tool that locks out the user's own scripts has the wrong shape. **Every alternative costs exactly what the openness is for** — gating path-bearing operations on a code signature locks scripts out of the operation they would most want, and having the client read the bytes reverses *bytes never cross the socket* and puts TCC attribution back on whichever terminal happened to launch the tool.

**Accepted under this subtopic's declared non-adversarial threat model**, and parked the same way storage-and-sync parked at-rest encryption — *"revisit only if a security-conscious segment matters, a positioning/licensing question, not a storage one."* If Fumi is ever sold to people who care about this, it is a known item to revisit rather than a surprise.

**An unrecognised peer resolves to `cli`** *(review-002 F3)*. The socket is deliberately open to the user's own scripts, so the encouraged case — a shell or Python script speaking the protocol — presents an executable path matching neither binary, while storage-and-sync's enum is closed at three values. Mapping unknown → `cli` is right rather than merely convenient: `via` answers *"was this me or an agent"*, and a script the human wired up is the same class of thing as the CLI. A fourth value would need storage-and-sync's field to carry it and note-window's scrubber to render it, for a distinction with no meaning to the person reading the history.

*The single-instance loser is not a case here* — it connects to forward a reopen intent, not to write a note, so no `via` is stamped at all.

##### 2026-08-20 — the reopen forward is a control frame *(resolves review-006 F7)*

The exemption above was written for `via` alone, and two later decisions reach the same frame without classifying it. `operation-core` closed the operation set; `version-skew` decided *"a client whose number does not match refuses to operate"* and named the stray `~/Downloads` copy as one of exactly two ways old and new meet — the same copy `Single instance` keeps the lock for. So a user double-clicking a stale downloaded copy either gets the manager or a version-mismatch message, and nothing said which.

> **The reopen forward is a control frame: outside the closed operation set, and outside the version check.**

**It was never a model operation by `operation-core`'s own test** — *could two clients implementing it independently disagree?* They could not, because it reaches no model state. **And it carries no payload beyond *show yourself*, so there is nothing to mis-parse** — which is the whole reason the version check exists. `fumi` and `fumi-mcp` refuse on mismatch because they would misread operation **results**; there is no result here.

**It preserves a property the design already valued:** *"the user double-clicks the wrong copy and gets the right app."* Refusing an app-icon double-click with a version message would be a poor answer to a gesture that was never about versions.

**One classification explains all three exemptions**, which is why this is a naming rather than a new rule: no `via` because it is not a write, no membership because it is not a model operation, no version gate because it is not an operation at all. It belongs with the going-down signal and the connect-time version greeting in a small **control layer** that the protocol already had and had not named.

*Consciously accepted rather than overlooked:* the derivation runs once per connection at accept time, so a long-lived `fumi-mcp` peer is identified once and never rechecked; and `LOCAL_PEERPID` → path is PID-based and technically racy. Both are non-issues under this subtopic's explicitly non-adversarial threat model.

*Sibling check: storage-and-sync — its attribution decision holds that `via` is `app | cli | mcp`, known from the connection the write arrived on, with nobody asserting it and nobody able to spoof it. Engine-side derivation satisfies that text as written, and unknown → `cli` keeps the enum at three; nothing there is revised.*

~~**Still open in this subtopic:** the wire protocol and framing, the socket path, and how the protocol versions across an engine/client mismatch (the last of which is `version-skew`'s to settle).~~ *(The first two settled 2026-08-12 — below. Versioning remains `version-skew`'s.)*

### The wire protocol

#### Context

The operation set is closed and named, its arguments typed, and every operation individually atomic and rejectable (`operation-core`). The protocol carries **no change events** in either direction (`change-notification`), and two unsolicited engine→client frames: the going-down signal, and the protocol version stated on connect (`version-skew`). *(Amended 2026-08-20 — this read "one server-initiated frame… and no others", written before `version-skew` added the greeting. Stated as a scope rather than a count, because a count is what went stale.)* What remained was the byte-level shape those decisions ride on.

#### Decision — bytes never cross the socket

> **A file-bearing operation passes a path, never contents.** An asset add sends `/Users/…/board.png`; the engine opens it.

Same machine, same user, and the engine is already the sole writer — it can read the file directly. It also *wants* to: note-model and storage-and-sync make the asset add **one atomic engine operation** (bytes + manifest entry + content token), so the engine holds the file anyway. Streaming the bytes through a client would add a copy, a framing problem, and nothing else.

The consequence that matters for everything below: **the wire stays text.**

#### Decision — newline-delimited compact JSON, both directions

> **One JSON object per line, in both directions. Requests carry an `id`; responses echo it; a frame with no `id` is an engine event.**

```
→ {"id":7,"op":"append","args":{"uid":"01J9…","text":"Call Dana."}}
← {"id":7,"ok":true,"result":{…}}
← {"event":"going-down","intent":"restarting"}
```

**Options weighed.**

- **Length-prefixed frames** (4-byte header + body) — more robust and unambiguous about boundaries, and the conventional choice for a binary-safe protocol. **Rejected**, and on this subtopic's own decided value: *"the socket stays open to anything running as the user — intended, not tolerated. A scripting-first tool that locked out the user's own shell scripts would have the wrong shape."* A shell script can `echo '{"op":"list"}' | nc -U …` against newline-delimited JSON; it cannot hand-assemble a big-endian length header. Length-prefixing would leave the socket technically open and practically closed, which is the decision honoured in letter and broken in substance. The robustness it buys is also worth less here than usual — the bytes-never-cross rule means no payload contains a raw newline, since compact JSON escapes them inside strings.
- **A binary or typed encoding** (MessagePack, protobuf) — **rejected as premature.** The traffic is a human's note library and hand-typed CLI calls; debuggability and script access are worth more than bytes at this volume, and it fails the same script-access test.
- **HTTP over the unix socket** — **rejected.** It brings a request framing we don't need and makes the one server-initiated frame awkward, requiring SSE or a WebSocket upgrade to deliver a single lifecycle message.

**Why requests carry an id.** It makes the engine event distinguishable **by construction** rather than by convention — no `id`, not a reply — and it lets `fumi-mcp` hold two operations in flight, which per-note serialisation already permits since writes to different notes proceed independently. Without ids the client is forced into lockstep for no reason. `fumi` never needs it; the field costs it nothing.

**This is not the request-id idempotency `client-connection-lifecycle` rejected**, and the collision is worth naming because the words are identical. That option was **persisted** applied-ids in SQLite, so a retry after a crash could return the original result rather than re-applying — rejected for costing a write on every mutating operation forever, to disambiguate an event only an unclean exit produces. **This id is an in-memory correlation number scoped to one connection**, gone when the socket closes, and it makes no claim about whether anything was applied. Nothing here reopens that option, which remains deferred-not-rejected on its own terms.

**Errors carry a code and a message.** `client-connection-lifecycle` decided the CLI needs *"a human-readable line, plus a machine-readable error code the wrapper can act on"*, so the failure frame is `{"id":…,"ok":false,"error":{"code":"…","message":"…"}}`. **The shape is decided here; the code vocabulary is `agent-surface`'s** — the codes exist for an agent to react to, and choosing them is part of designing what an agent can do about a failure.

#### Decision — the socket path

> **A single well-known path in Fumi's Application Support directory, beside the lockfile. Every client computes it identically; nothing is discovered, negotiated, or read from the environment.**

storage-and-sync drew that directory by role — the store subdirectory, the SQLite index, the per-device blob, account quarantines — with names deferred to build; the socket and the single-instance lockfile join it as runtime siblings of the durable state rather than inside the store, which *"holds only bundles"*.

**Rejected: `$TMPDIR`.** It is the more orthodox home for a socket, and macOS gives each user a private one — but it is an opaque `/var/folders/…` path that differs per session, so a script author cannot be told where the socket is. Since the socket must be documentable for the user's own scripts to reach it, discoverability outranks orthodoxy here.

**A stale socket file is expected, not a problem.** A `SIGKILL`'d engine leaves the file behind, and **Single instance** already anticipated exactly this when it chose an `flock` over letting `bind()` fail: *"the kernel releases an `flock` when the holder dies, however it died. No staleness, no dance."* Liveness is the lock's question, so whoever acquires it unlinks the leftover file and rebinds without interpreting it.

**Left to `version-skew`:** how the protocol announces and reconciles a version across an engine/client mismatch. A `hello` frame on connect carrying the engine's protocol version is the obvious hook and this framing accommodates it, but whether it is needed — and what a mismatch does — is that subtopic's, narrowed considerably by both clients shipping inside the bundle.

#### Decision (2026-09-14) — the resolution rule is scoped to arguments; a path in content resolves engine-side

*Trigger: `agent-surface`'s rerouted concern — the asset-add verb is gone from the client surface, and a path now reaches the engine as note content rather than as an operation argument.*

> **Who resolves a path depends on how it arrives. A path passed as an operation argument is resolved by the client before the frame is built, as decided below. A path arriving inside note content is resolved by the engine during materialisation: `~` is expanded, and a relative path is not resolved at all — it stays in the text as written and is reported as uncarried.**

**The clause is scoped rather than struck, and the reason is whose question the subject is.** Striking it outright is only correct if no operation takes a path argument anywhere, and the operation set is this topic's — `agent-surface` can cut a client verb, but the socket is deliberately open to anything running as the user, so what the engine exposes is decided here. A scoping is correct whether that subject turns out to be populated or empty; a strike is a bet on the answer.

**The content route could not have gone the other way.** A client normalising a path inside `content.md` would be editing the user's prose, and `note-model` reserves that to the engine — the token rewrite during materialisation is *"the one app-authored mutation of `content.md`"*. So this is the rule following the only available mechanism, not a preference between two.

**The worked case is replaced.** `fumi add ./board.png` names an operation the client surface no longer has; the live example is a path written into the body and materialised on the write.

**No new error class is owed — settled by derivation.** *"The engine cannot read that path"* is its own class *because the transport produces it*. A relative path in content produces nothing: nothing attempted to read it, and it is not an argument to be invalid. The report that it could not be carried travels in the write's response, whose shape is `agent-surface`'s, alongside an unresolvable token or an oversized file. This topic's class list is unchanged.

**What is untouched:** *bytes never cross the socket* (a path still crosses, never contents), the TCC-subject reasoning below (the engine performs the read either way), and the two rejections `agent-surface` recorded against this topic's ground — reading the caller's working directory per request, and having the client assert its working directory — both of which stand on reasoning this topic already owns.

*Sibling check: agent-surface (discussion) — its decided text holds that there is no asset-add verb, that a path is written into the note body and materialised on the write, and that absolute is the form with `~` expanded and a relative path left as written and reported as uncarried; all of that is adopted and none of it revised, and the response shape carrying the uncarried report stays theirs. note-model — the token rewrite as the one app-authored mutation of `content.md` is cited as the reason the engine must be the resolver, not revised. client-connection-lifecycle (this topic) — the error frame's shape is unchanged and gains no member.*

#### Decision (2026-08-18) — what path-passing moves into the engine *(resolves review-004 F6)*

*"A file-bearing operation passes a path, never contents"* was decided on the engine being sole writer and wanting the file anyway. Sound, and it moves the `open()` from the caller's process into the engine's — which carries three things with it that were not taken up.

> **The wire carries absolute paths. Resolving a relative path against the caller's working directory, and expanding `~`, happens client-side before the frame is built.** *(Scoped 2026-09-14 to paths arriving as **operation arguments** — a path arriving as note content resolves engine-side. See the 2026-09-14 entry above.)*

The client is the only process that holds that context: ~~`fumi add ./board.png` typed in a shell~~ *(2026-09-14 — the add verb is gone from the client surface; the case holds for any surviving path argument)* a relative path typed in a shell means nothing to an engine whose cwd is not the user's. It also binds the other client, in the other direction — **MCP has no meaningful working directory at all**, so an agent must pass an absolute path, which is a constraint on the tool schema rather than a runtime fallback.

> **"The engine cannot read that path" is its own error class, distinct from an invalid argument.**

An agent has to tell them apart because the remedies differ — fix the path, versus ask the human to grant something — and it covers denied, missing, unmounted, and visible-only-to-the-caller alike. The class is named here because the transport produces it; the **code** stays with the rest of the vocabulary in `agent-surface`.

##### The engine becomes the TCC subject for file access

macOS gates Desktop, Documents, Downloads, iCloud Drive and removable or network volumes **per app**. With the engine performing the read, the engine is the subject — and it is an `LSUIElement` background app, so the first time an agent hands it a path under `~/Documents` the user meets a system prompt with no visible cause.

**Two things bound how large that is**, recorded so the size is not re-guessed later:

- **The store needs no grant.** Application Support is not TCC-protected, so nothing in normal operation touches this. The exposure is only ever *reading source files handed in from outside*.
- **The common path is a drag, which carries its own grant.** Dropping an image on a note is in-process and permitted by the drop itself. What remains is specifically an agent or a script passing a path into protected territory.

**The alternative is worse, which is why the path rule stands rather than being revisited.** If the client read the bytes instead, TCC would attribute to the **responsible process** — Terminal, iTerm, or whichever host launched the tool. This document already cites that behaviour when deriving `via` (*"running a CLI from Terminal prompts that **Terminal** wants to control your computer rather than the tool"*). The subject would then vary with how the user happened to invoke Fumi, which is more confusing than one app asking once, and it would also reverse *bytes never cross the socket* for no gain.

**So the engine needs Files-and-Folders access, and that is a second permission surface.** `onboarding-and-permissions` is scoped to the Accessibility grant the Space APIs need and does not know this one exists. Whether the wizard pre-requests it or the prompt is met lazily on first use is the wizard's call. **Rerouted to `onboarding-and-permissions`.**

*Sibling check: onboarding-and-permissions — its brief scopes the wizard to the Accessibility permission alone; nothing there is revised, and the second surface is delivered to its queue rather than decided here. agent-surface (discussion, decided 2026-09-13) — the error class is named, the code left to it, alongside the absolute-path requirement its tool schema must carry. note-model — the drag-and-drop entry route and the atomic asset add are cited, not revised.*

*Sibling check: storage-and-sync — the Application Support layout and the store-holds-only-bundles rule are cited, not revised; the socket and lockfile are runtime siblings of the store, not contents of it. note-model — the atomic asset add is relied on as the reason the engine wants the file itself. agent-surface (discussion, decided 2026-09-13) — the error **shape** is fixed here because the transport carries it; the error **codes** are explicitly left to that topic, along with the operation names the `op` field takes.*

---

## Restart And Restore

### Context

*(Opened by review-001 F5 — the exposure came from the launchd choice made in `process-model`. **It survives the Fork 1 reversal unchanged**: a login item opens the app early in the session too, so the race is with the window server, not with launchd. Amended 2026-08-12 to say so, since the original framing pinned it on a mechanism that no longer exists.)*

Whatever opens Fumi at login does so when the session comes up, which is not the same instant the window server, Dock and Spaces are in a state that can be interrogated:

```
login
  t+0     macOS opens Fumi (login item) → engine starts → restore fumis
  t+?     WindowServer settled, Dock up, Spaces enumerable
  t+?     external display finishes waking
```

The process model has arranged for the engine to query CGS at the earliest moment in the entire session. space-homing's brief already names this as the whole difficulty — *"the hard part is launch-time sequencing and timing, not the API call"*.

**The failure is not subtle.** space-homing's decided fallback is that an absent home Space falls back to Space 1. Query too early, get an empty or half-built space list, and *every* fumi takes the fallback: the user logs in to find their entire desk stacked on Space 1 — the signature feature failing in the loudest available way, self-inflicted by being eager.

**The worse version.** Geometry intent syncs (storage-and-sync). If restoration writes back where it *put* things, a timing fallback becomes the note's recorded home, propagates to every Mac, and the user's arrangement is permanently gone. A transient race turning into durable data loss.

#### The readiness signal is the placement pre-flight check, not a separate mechanism

*From: space-homing · discussion · 2026-08-30*

space-homing has now run, and decided the signal this subtopic assigned it.

**The answer.** Readiness is a property of the enumerated Space list, not of the homes being placed. Restoration waits until the enumerated Space list stops growing, then places. A home that resolves gets its Space; a home that does not takes the Space-1 fallback immediately.

*(Amended by space-homing 2026-08-31 — this first read "restoration is ready when every home Space it is about to place on enumerates as a real user Space". A review found that predicate cannot distinguish a Space that has not materialised yet from one that is never coming back. A user who deletes a Space while Fumi is closed then reopens it has a permanently dead home, so a home-based predicate fails on every pass and pays the full bounded wait at every launch, forever, for a condition the fallback already resolves in one step. The list-based predicate asks only the question the wait exists for.)*

**Why an enumeration, and not a notification or a Dock heuristic.** Every placement is already required to enumerate and check, for two independent reasons: both placement routes silently no-op on a destination that does not exist (a bogus UUID through AppKit, an unknown sid through SkyLight — measured, both report success and leave the window on the active Space), and a `ManagedSpaceID` may never be cached across a display change, so the list must be freshly enumerated anyway. Readiness therefore costs nothing beyond a question already owed. A separate signal would be a second mechanism to get right, and would answer a vaguer question than the one that matters — which is not "is the session up?" but "can these specific Spaces be placed on right now?"

**What this does to the rule as written: nothing.** *"Re-attempts home-Space placement as the space list becomes plausible"* is the check described in other words. The bounded interval, the restore-anyway-on-timeout, the never-persist-a-timeout-fallback constraint and the never-activate-a-Space rule all stand unchanged. This fills the hole rather than reshaping anything around it.

**One consequence worth knowing, and it is narrower than first stated.** Research measured every placement result in a **warm session** — a desktop in use for hours, all Spaces long materialised. The cold-login case (an `LSUIElement` app started by a login item while macOS is still bringing the session up) was parked deliberately, because testing it costs a reboot, and the worry there was real: if Spaces materialise lazily at login, placement onto a not-yet-existing Space is a silent no-op and every fumi piles onto the launch Space, on every login, with nothing reporting an error.

Under this answer that test stops being load-bearing: if Spaces materialise lazily the settling check waits for them, and if they are all present immediately it settles on the first pass. The same code is correct either way, so neither topic needs the measurement in order to proceed.

**Caveat carried honestly.** The pre-flight oracle's behaviour was measured on one machine (macOS 26.5.2, two displays), and the cold-login path itself remains unrun.

#### The re-attempt clause in restart-and-restore has to go

*From: space-homing · discussion · 2026-09-01*

A second, separable ask from the readiness answer above — that one can be accepted while this one is refused, which is why they arrived as two entries.

**The clause.** *"Restoration waits a bounded interval for readiness. On timeout it restores anyway — geometry and window state first — and **re-attempts home-Space placement as the space list becomes plausible**."* The readiness answer covers the *before* half. The bolded *after* half is the one space-homing cannot honour, because it decided the opposite on 2026-08-30 and 2026-09-01: *"No retry, no re-placement, no correction of any kind"* (Placement Verification); *"No re-attempt. What the timeout places stays placed until the next launch"* (Launch Sequencing). A specification reading both documents together gets a re-attempt loop from this topic and a prohibition on re-placement from space-homing, with nothing saying which governs.

**Why space-homing lands where it does.** The design draws a hard line at the show step. Before a window is shown, placement is free — the destination is latched while the window is ordered out, nothing visible moves, and there is no flash because there is nothing on screen to flash. After the show, moving a window is an *act*, and the only actor entitled to it is the person looking at the screen. Three decided rules converge there: **Placement Verification** verifies after the fact but never corrects, because re-placing cannot distinguish OS failure from a window the user deliberately moved; **Home Identity** decided a fumi re-homes on drag; and **Launch Sequencing** made the show step non-activating precisely so restoration never pulls the user anywhere.

**The cost, stated plainly.** A login pathological enough to hit the bound leaves some fumis on the fallback Space (the first Space of their home display) until the user quits and reopens. space-homing accepted that in preference to a mechanism that can move a window the user has already touched. A middle shape was considered and rejected there: a brief self-correcting window (a second or two after show, then never again), dropped because it still overrides a drag inside exactly the window where a user is most likely to be rearranging a freshly restored desk.

### Decision

#### 2026-09-02 — the re-attempt clause is struck: the timeout places once

*Trigger: space-homing's second entry, naming a live contradiction — this block's re-attempt loop against its own prohibition on re-placement, with nothing telling specification which governs.*

> **On timeout, restoration places once and what it places stays placed until the next launch. There is no re-attempt.**

The rest of the rule is untouched: the bounded interval, restoring anyway rather than never appearing, the fallback never persisting as intent, and never activating a Space.

##### The clause did not survive its own predicate

space-homing's case is the show-step line — after a window is visible, moving it is an act, and the only actor entitled to it is the person looking at the screen. That is sound, and it is not what settles this, because it is their frame applied to our desk. **What settles it is that the clause was written against a predicate that no longer exists.**

*"Re-attempts home-Space placement **as the space list becomes plausible**"* assumes the timeout fires while the list is still *becoming* plausible — a race lost and then won a moment later. Under the home-based predicate live when it was written, that was a real shape: a home that had not materialised yet kept failing, so a later attempt could succeed. Under the list-settling predicate — adopted in the signal entry below, decided the same day — the timeout fires only when the list **never stops growing**, and re-attempting after that is not waiting for a race to resolve; it is re-running a check already told it cannot get a stable answer.

##### And the collision it does have is with this topic's own rule

space-homing's **Home Identity** decided that a fumi re-homes on drag. So a note the user drags in the seconds after a slow login has *already recorded a new home*, and a re-attempt would move it off a Space the user picked moments earlier — overriding a decision rather than completing a restoration.

**That is this block's own principle running backwards.** It decided at the outset, unprompted, that *"a fallback taken during restoration is never written back as intent… a bad login is a bad login rather than a permanent one"* — care taken that a timing artefact never becomes durable data. Re-attempting is the same error pointed the other way: a timing artefact overwriting a deliberate act. The two halves of the clause were pulling in opposite directions and only one of them was examined.

##### The cost, and why it is small by construction

A login pathological enough to hit the bound leaves some fumis on the fallback Space until the next launch. The readiness answer makes the expected case settle on the first pass, so the timeout stays what this block wrote it as — **a bound against never-appearing, not a mechanism anything is designed around**. Nothing is designed to run after it.

*Sibling check: space-homing (discussion) — its Placement Verification holds that placement is verified after the fact and never corrected, its Launch Sequencing that what the timeout places stays placed until the next launch, and its Home Identity that a fumi re-homes on drag; all three are adopted, none revised, and the contradiction is resolved on this topic's side. note-window — its home-resolution rules are unaffected: this decides how many times a placement is attempted, not what a home resolves to.*

#### 2026-09-02 — the signal lands, and the sample rate is not the settle window

*Trigger: space-homing's answer, delivered as a rerouted concern. The dependency this block named is discharged; what it asks back is whether the bounded interval is still the right shape now that the signal underneath it is a poll rather than an event.*

> **The dependency is closed. Readiness is the placement pre-flight check: restoration waits until the enumerated Space list stops growing, then places.** Everything else this block decided stands — the bounded wait, restore-anyway-on-timeout, never persist a fallback, never activate a Space.

**"Fires once" survives, and it survives on a specific choice in the answer.** Readiness is a property of **the list**, not of the homes being placed, so there is still a single moment when the list settles and every placement goes. Had space-homing gone the other way — readiness per home — *"fires once, at the first session-ready moment"* would have quietly become *fires per note*, and this block's rule would have needed reopening rather than filling.

> **The poll interval and the settle window are separate numbers. Sampling the Space list and deciding it has stopped growing are two questions, and one number cannot answer both well.**

**Settled by derivation** — the entry hands back two numbers (poll interval, bound) and the shape underneath them is a third thing that has to be chosen rather than tuned. A settling detector declares *done* after the list has been unchanged for some period; unless that period is stated independently, it collapses into the poll interval, and the two jobs then pull in opposite directions:

```
sample fast    → responsive at cold login, where the list grows slowly
                 …but "unchanged since 50ms ago" is a coin flip
wait long      → confident the list has finished growing
                 …but every launch pays it, including the ones where
                   the list was already complete before we asked
```

**The case that decides it is the mid-session restart, not the login one.** A login restoration is invisible — *"the desk assembles before anyone is watching"* — so a conservative settle costs nothing there. A Sparkle-update restart is the visible one, and by this topic's own reading of it the user is *watching the desk come back*. Collapsing the two numbers means choosing between a shaky settle at login and adding the full settle window to every visible restart, on a machine where the list was complete on the first sample. Separating them costs one number and removes the choice.

**The values stay with implementation, and that is consistent rather than convenient.** This document's test for whether to write a constant is *what the wait is on*: an app relaunch is machine-dependent and unbounded, so any figure is wrong for somebody; a local enumeration settling is an ordinary bound on an ordinary operation, like the network fetch bound `supervision-and-failure` kept. The **shape** is decided here because "the sample rate doubles as the settle window" is a design choice with a visible consequence, not a tuning parameter.

*Sibling check: space-homing (discussion) — its decided text holds that readiness is a property of the enumerated Space list, that the check is the placement pre-flight every placement already owes, and that the two numbers are this topic's to pick; this adopts that answer whole and adds only the split between them, which is on the side of the boundary it drew. note-window — its home resolution (display identity · Space UUID, with a display-time fit) is what a placement resolves against; nothing there is revised, and a home that fails to resolve takes the Space-1 fallback exactly as before.*

#### Initial

> **Restoration gates on session readiness, not on process start.** It fires once, at the first session-ready moment after the process starts.

This refines the `process-model` rule rather than qualifying it — the rule stays unconditional and stays independent of what started the engine; only *when*, within a single start, moves.

> **A fallback taken during restoration is never written back as intent.**

Space 1 because the home Space could not be found is a **display** decision, not a **storage** decision. The note's recorded home Space is left untouched, so a bad login is a bad login rather than a permanent one.

**The wait is bounded, and the desk always comes back** *(review-002 F8)*. *"Fires once, at the first session-ready moment"* was unconditional on time, which produces the mirror of the failure this subtopic guards against — reached from the cautious side rather than the eager one: the engine is up, the menu-bar icon is there, and the desk never returns. A CGS query that keeps answering implausibly, or a display that never finishes waking, is enough.

> **Restoration waits a bounded interval for readiness. On timeout it restores anyway — geometry and window state first — and ~~re-attempts home-Space placement as the space list becomes plausible~~ places once.** *(Struck 2026-09-02 — the re-attempt contradicted space-homing's prohibition on re-placement, and did not survive the predicate change beneath it. See the 2026-09-02 entry above.)*

Never-appearing is a worse failure than appearing in the wrong place, because the wrong place is visible and fixable while an absent desk looks like a broken app. The fallback taken on timeout still never persists, per the rule above, so a slow login costs a Space re-shuffle rather than the user's arrangement. *(Amended 2026-09-02 — "fixable" now means by the user, or by the next launch; nothing in Fumi corrects it. That strengthens rather than weakens the argument here: the timeout's job was always to make the desk appear, and appearing in the wrong place is the cost it was accepted for.)* The timeout is logged — an unbounded silent wait is exactly the thing `observability` exists to make visible.

**Not decided here: the readiness signal itself.** Polling CGS until the space list looks plausible, watching for the Dock, or some notification — which is canonical is exactly what space-homing's brief flags as the hard part, and guessing it here would be inventing the answer to someone else's research question. ~~**Dependency: space-homing (research, not yet run) owes the readiness signal.**~~ *(**Closed 2026-09-02** — space-homing decided it on 2026-08-30 and it is the first of the three guesses, arrived at from the other direction: the list is polled until it stops growing, and the poll is the pre-flight check every placement already owes. See the 2026-09-02 entry above.)*

*Sibling check: space-homing — its brief holds the Space-1 fallback for a deleted or absent home Space, and names launch-time sequencing as the hard part. Nothing there is revised; this adds the constraint that the fallback must not persist, and leaves the signal to that research.*

### The mid-session restart

*(Opened by review-002 F7 — the subtopic was worked entirely for the login start, while the case both sibling topics actually depend on is the restart that happens while the user is looking at the screen.)*

Login restoration is invisible: the desk assembles before anyone is watching. A **mid-session** restart is not — every fumi on every Space is torn down and redrawn in front of the user, and onboarding-and-permissions' requirement (*"restore every open fumi exactly as it was"*) is a claim about the visible outcome, not just the recorded geometry. *(Amended 2026-09-02 — that requirement no longer arrives from onboarding-and-permissions, whose permission restart was struck; the same claim now rests on the Sparkle update alone, which is the visible restart and the one this block was written for. The requirement is unchanged and so is everything below it.)* `client-connection-lifecycle` characterised a planned restart as *"a ~2 second pause"*, which is true of a socket client and not obviously true of a desk of windows. *(That figure was retired 2026-08-12 — relaunch time is not ours to predict — which sharpens this subtopic's point rather than blunting it: the tear-down-and-return may be visibly longer on a loaded machine, and the decision below rests on the user having asked for it, not on it being quick.)*

#### Options Considered

Three shapes were put up, all concerned with how much the restart should get out of the user's way: **just do it** whenever the update lands; **wait for idle**, holding the restart while the user types; or **ask**, prompting for the restart.

#### Journey

**All three were solving for an update that installs itself, and the user removed that premise.** Updates **auto-download but never auto-install** — the install is a user action, on the Tailscale/Chrome pattern (*skip · remind me later · update now*, optionally with automatic downloading). Once the moment is chosen by the person it happens to, tearing down and reopening is exactly what anyone expects of an app that updates, and wait-for-idle is revealed as machinery for making an unwanted interruption less bad. Nobody needs it when the interruption is not unwanted.

**It generalises past updates.** The permission grant is a user moment too — they have just clicked through a wizard. So this is one rule rather than a policy. *(Amended 2026-09-02 — the second instance is gone: no grant is requested, so the rule stands on the Sparkle update alone. It is unaffected — a rule about who owns the moment never needed two moments to be right — and it remains stated generally so a later restart driver inherits it rather than re-deciding it.)*

#### Decision

> **Every planned restart is user-initiated. The engine never restarts on its own initiative.**

Unplanned restarts are crashes, and there the desk returning is the good outcome rather than an interruption.

**So a mid-session restart needs no special restoration behaviour.** It is the login path with the readiness gate trivially already open — one code path, not two — and the visible tear-down-and-return is expected rather than surprising, because the user asked for it.

> **Restoration never activates a Space.** Windows return to their recorded Spaces; the engine never switches the user to one.

Decided outright rather than weighed: being yanked to another desktop mid-sentence is the worst thing this architecture could do to someone, and nothing it would buy is worth that.

**Constraint exported to build-and-release** *(rerouted)*: auto-download is fine, auto-install never. Their brief calls silent-versus-prompted updates *"the real product choice"*, and this topic's restart model answers it — the always-on engine makes an unattended update a desk-wide event, so the update moment has to belong to the user.

---

## Operation Core

### Context

The brief's claim is that *"one engine, four clients"* means **engine quality compounds across all four** — the note windows, the menu-bar manager, the CLI and the MCP server are skins over one operation core. That only holds if there is a rule for what lives in the core, and the rule has to be drawn before agent-surface is discussed, because the two subtopics are easy to confuse.

**The boundary.** agent-surface owns the *grammar* — command names, flags, MCP tool schemas, JSON output shape, the list → read → reason → act loop. This subtopic owns the **operation set the engine exposes over the socket**, and the rule for what belongs in it.

The concrete case that makes the rule matter:

```
menu bar ▸ Recents             → last 8 notes, most-recently-modified
$ fumi ls --tag work --space 3 → filtered, sorted list
management window search box   → live-filtered list
```

Three surfaces, one question underneath: is that **one engine operation taking filters**, or a **generic list operation each client filters itself**?

#### `append` and `tag` are cut from the client surface — does the cut reach the operation set?

*From: agent-surface · discussion · 2026-09-13*

**What `agent-surface` cut, and why.** Two operations the discovery brief's verb sketch listed are no longer on the CLI or MCP surface:

- **`append`** — cut under Write Concurrency. The user's reasoning: *"I dont know why we need append, or how it would even work. agents arent always adding content to the end - its not a log. Its a note - meaning the content would be edited at the begining or middle or end."* A verb that only serves end-of-body is a log affordance on a document that is not a log. Every content change is now one operation: send the whole body with the read token that describes the live body.
- **`tag`** — cut under Command Grammar, on note-model's ground that tags are inline `#hashtag`s in the body with **placement the user's choice** and no enforced position. A `tag` verb would have to pick an insertion point that document deliberately refused to pin, so tagging is an ordinary content edit.

**Why this reaches this topic rather than staying theirs.** The boundary is explicit — *"agent-surface owns the grammar — command names, flags, MCP tool schemas, JSON output shape… This subtopic owns the operation set the engine exposes over the socket"* — so they can cut a client verb, and only this topic can cut an engine operation.

This topic's decided text still carries both. `append` is the worked example in the wire-protocol frame and again in the write-ordering illustration; `tag` is carried in the same family of sketch-derived verbs.

**The question is not cosmetic, because of a property decided deliberately.** *"The socket stays open to anything running as the user — intended, not tolerated"*, and newline-delimited compact JSON was chosen over length-prefixed framing precisely so *"a shell script can `echo '{"op":"list"}' | nc -U …`"*. So an engine operation with no CLI subcommand and no MCP tool is **not dead code** — it is a live route that anything running as the user can call.

That matters because `agent-surface` decided **every content write carries a read token describing the live body**, and refuses when it no longer matches. An engine-level `append` reachable by a script would be a second way to write content that carries no token. Nothing gets clobbered by an append — it adds rather than replaces, so there is no lost update — but it makes *read then write* a property of the CLI rather than of the system, with one undocumented exception.

**What is asked.** Whether the cut reaches the operation set — dropping `append` and `tag` from it and amending the passages that use `append` as their worked example — or whether the set deliberately retains operations no client exposes, in which case the token rule's scope wants stating.

*(`agent-surface` offered its own view rather than asserting it: that the cut should reach the engine, since the reasoning behind removing `append` was about **the model** rather than the client surface. It named the counter-argument itself — a script author appending a line is exactly the caller the open-socket decision exists to serve.)*

### Decision

#### 2026-09-14 — `tag` is cut, `append` is kept: the wire set does not mirror the client surface

*Trigger: `agent-surface`'s rerouted concern — two verbs cut from the CLI and MCP surface, asking whether the cut reaches the operation set.*

> **`tag` leaves the operation set. `append` stays, with no client exposing it. The operation set is not obliged to mirror the client surface — it answers to this subtopic's own intent-shaped test and to the script caller the open socket exists for.**

##### The layer the question is actually about

**The distinction came from the user's objection, not from the concern or from this session's first reading of it, both of which collapsed it.** The session's opening position was that the cut should reach the engine, argued from discoverability — no client exposes the verb, `operation-core` refuses a runtime catalogue, so a script author could never find it. The user refused the framing rather than the conclusion: *"it feels like we don't have to have symmetry between internal code and user-facing or agent-facing code"*, with the condition that if the engine can splice content more efficiently, keeping `append` internally is legitimate — *"if keeping append internally makes sense because of the way we've designed our system, then that's also okay"*, and the call delegated: *"we have to use our brains here. Let's do what's right."*

The principle is right and the layer it names is not the one in question, which is what pulls the three apart. There are three, and only two of them are this topic's:

```
1  client surface       CLI verbs, MCP tool schemas        agent-surface's
2  wire operations      what the socket accepts            this topic's
3  internal write path  how a change reaches the note      this topic's
```

**Layer 3 is already asymmetric and already decided**, which removes the efficiency argument for a wire-level `append` before it is weighed: *Write ordering and the live copy* holds that an open note's editor buffer is the live copy and the engine applies **patches** into it, and note-window has agent edits arriving as text patches that stream in. The engine never performs whole-body replacement internally — a whole-body write with a read token is diffed against the token's body and lands as a delta. Splicing efficiency exists whatever the wire accepts.

**Layer 2 is not internal code**, which is what makes the symmetry question unusual. `client-transport` decided the socket stays open to anything running as the user, *"intended, not tolerated"*, and chose newline-delimited JSON over length-prefixed framing so a shell script could speak it. The operation set is a wire surface with third-party callers, not a private function list.

##### `tag` is cut

Tagging is not a capability anywhere in the product. `note-model` made tags inline `#hashtag`s in the body with placement the user's choice, so a `tag` operation would have to pick an insertion point that document deliberately refused to pin — a verb for a capability that does not exist. If tagging ever becomes one, it arrives at all three layers together rather than being retrofitted from a stub that was kept warm.

##### `append` is kept, and the reason is this subtopic's own test

*Operations are intent-shaped, not field-shaped. An operation carries everything one user intent determines, and no more.* **"Add this line to that note" is plainly an intent** — nothing like the `recolour-and-move` that test was written to exclude. It passes, and the first reading of this concern argued past the test rather than applying it.

**What `agent-surface` cut it for does not transfer down**, and this is where the discoverability argument lost. Their argument is about **tool ergonomics for an agent**: a model that edits anywhere gets a verb serving only the end-of-body case, and must then reason about which verb to reach for on every write. That is a sound grammar argument and it is theirs to make. The caller on the wire is not an agent choosing between verbs — it is a shell doing quick capture, which is not the logging pattern *"it's a note, not a log"* was aimed at.

**The discoverability objection does not survive this document's own record.** The case against keeping an operation no client exposes was that `operation-core` refuses a runtime catalogue, so a script author could never find it — live in principle, dead in practice. But the socket-path decision rejected `$TMPDIR` on the grounds that *"the socket must be documentable for the user's own scripts to reach it, discoverability outranks orthodoxy here."* Publishing where the socket is, on the reasoning that script authors need to reach it, is already a commitment to publishing what to send it.

##### The token rule's scope, owed either way

> **The read token governs the replacing writes. The additive one carries none, because it has nothing to reconcile.**

Stated as scope rather than as an exception, because the difference is real: a whole-body write claims to supersede a body the caller read some time ago, so the engine must know which body that was or the user's in-flight keystrokes are lost. An append makes no such claim — its anchor is the end of whatever the body currently is, and it is well-defined against any concurrent edit. Nothing is carved out of a rule; this is a write whose reconciliation is degenerate.

##### Costs accepted

**An operation no client exposes gets none of the incidental testing the CLI and MCP paths get.** It is exercised only by scripts, so it is the one operation whose first real caller may be a stranger's shell script. Named rather than mitigated.

**The call is contingent on one thing, and the contingency is recorded so a later reader can check it rather than rebuild on it:** if the socket protocol is ultimately not documented, `append` loses its only caller and should go the way `tag` did. The socket-path decision is read here as having already settled that it will be.

*Sibling check: agent-surface (discussion) — its decided text holds that `append` and `tag` are off the CLI and MCP surface, and that every content write carries a read token describing the live body and is refused when stale; both are adopted and neither is revised. The client surface keeps its cut — this decides only what the socket accepts, and the two now differ deliberately. note-model — tags as inline hashtags with placement the user's choice is cited as the reason `tag` has no capability to serve, not revised. client-transport (this topic) — the open socket, the newline-JSON framing chosen for shell scripts, and the socket path's documentability are all cited as the ground `append` stands on; none is revised. note-window — agent edits arriving as text patches into the live buffer is cited as the internal path that makes the efficiency argument moot, not revised.*

#### Initial

> **Anything requiring knowledge of the model is an engine operation. Clients only translate arguments in and format results out.**

Filtering, sorting, searching, title derivation and ambiguity resolution are all engine-side.

**The test for whether something is an engine operation:** *could two clients implementing it independently disagree?* If yes, it belongs to the engine.

**Why the list case is the right example.** If clients filter, each needs to know what a tag is, how the derived title works, and what "recently modified" means against `modifiedAt` versus a snapshot. That knowledge *is* the model. Three copies of it drift, and the drift is invisible — the menu bar quietly showing a different set from `fumi ls` for the same library is a bug nobody files.

This also lines up with what storage-and-sync already forces: the SQLite index is engine-only, and `list`/search hit the projection, so a client physically cannot filter without either going through the engine or duplicating the projection.

**What "thin client" means, concretely:** not a style preference — a client with **no model knowledge in it at all**.

*Sibling check: storage-and-sync — its single-writer rule ("CLI/MCP/windows go through it, never directly") and the projection-backed `list`/search are relied on here, not revised. agent-surface (discussion, decided 2026-09-13) — the boundary above is stated so its grammar decisions land on top of this rule rather than against it.*

~~**Still open in this subtopic:** whether the protocol is a fixed named-operation set or something more general; and how composite operations work (create-with-content-and-Space as one operation or three — an atomicity question storage-and-sync already cares about via the atomic asset add).~~ *(Both settled 2026-08-12 — see below, along with **ordering and concurrency across simultaneous clients**, which `client-connection-lifecycle` routed here and which this list had never carried.)*

### The operation set's shape

#### Context

The rule above says what belongs in the engine. It does not say what the engine's surface *looks like* — a closed list of named operations with typed arguments, or something more general that clients drive.

#### Options Considered

**A. A closed, named operation set.** Each operation has a name and a typed argument struct; the set is fixed at build and versioned as a whole.

**B. A general surface.** A query/mutation language, or a generic apply-a-change endpoint, with clients composing what they need.

**C. Named operations plus runtime introspection.** The engine advertises its operation catalogue so a client can adapt to an engine it did not ship with.

#### Journey

**The constraint that does most of the work was already decided and easy to miss.** `client-transport` put both clients **inside the app bundle** — `fumi` and `fumi-mcp` ship with the engine, sign with it, and update with it under Sparkle. There is no independently-versioned client. Most of the case for a general surface is *"so a client can adapt to an engine it didn't ship with"*, and that client does not exist here. C's introspection is priced against the same absent consumer.

**The one non-lockstep consumer is the user's own script.** The socket is deliberately open to anything running as the user, and `client-transport` explicitly contemplated a shell or Python script speaking the protocol directly. That consumer wants **stability**, not generality — a documented, unchanging set is exactly what it needs, and a general surface would make it *more* exposed, not less, because there would be more shape to get wrong.

**The argument that decided it is downstream, in `agent-surface`.** MCP tools are a closed enumerated list by construction — each is a name, a JSON schema, and a description the model reads. If the engine's surface is open-ended, the MCP server has to close it again anyway, and it closes it one of two bad ways: a single generic execute tool the agent has to guess its way through, or a hand-maintained enumeration that drifts from what the engine actually does. **The closure has to exist somewhere, and the engine is the only place it can be authoritative.**

**B also breaks this subtopic's own rule.** A query language means either the client builds queries — model knowledge in the client, which the decision above forbids — or the user does, at which point the CLI has stopped being a CLI and become a database console.

**The cost was argued rather than waved past.** A closed set means every capability touches three places: engine operation, CLI subcommand, MCP tool. That tax is real. It is worth paying because the MCP schema wants hand-writing regardless — tool descriptions are prompt engineering, and generated-from-generic is strictly worse for the agent reading them — and the CLI layer is mechanical forwarding by construction.

#### Decision

> **A closed, named operation set with typed arguments. No general query surface, no runtime operation catalogue.**

**What "thin client" means is sharpened by this, not weakened.** Clients do restate the argument surface — `fumi new --space 3 --colour blue` and the equivalent MCP tool schema are the same operation described twice for two audiences. That restatement is mechanical and its failures are visible (a missing flag). What must never be restated is model knowledge — what a tag is, how a title derives, what "recently modified" means — because that failure is invisible, which is the whole point of the *"could two clients implementing it independently disagree?"* test. Argument parsing cannot disagree; "recent" can.

*(How the set is versioned across an engine/client mismatch is `version-skew`'s. The lockstep bundling narrows what it has to cover, but does not eliminate it — a long-lived `fumi-mcp` from the pre-update bundle can outlive its engine across a Sparkle restart.)*

### Composite operations

#### Context

`fumi new --space 3 --content "…" --colour blue` — one operation carrying initial state, or a create followed by three setters? storage-and-sync already has an atomicity requirement pointed at this seam: asset add is **one** atomic engine operation (bytes + manifest entry + content token).

#### Journey

**The general answer — a wire-level transaction frame — is ruled out by a decision already made.** "Apply these N operations atomically" would let clients compose freely, and it breaks the drain: `client-connection-lifecycle` decided the engine answers **not applied** definitively for anything received-but-not-started, and that definiteness is precisely what let idempotency machinery be deferred (*"the client retries safely and needs no idempotency, because the question was answered rather than inferred"*). A multi-operation transaction introduces **partially applied** as a third answer — the exact ambiguity that decision exists to eliminate.

**So composition lives inside single operations, and the line is intent.** Three round trips to create a configured note leave a half-configured note in between, and that intermediate state is not inert: it bumps `modifiedAt`, it enqueues for sync, and it can trip the version-history dirty flush. A failure mid-sequence syncs a note nobody asked for to every Mac.

**But intent is a line, not a licence.** The failure mode on the other side is an operation set that grows a combinatorial pile of do-everything verbs.

#### Decision

> **Operations are intent-shaped, not field-shaped. An operation carries everything one user intent determines, and no more.**

- **`create` carries the note's full initial state** — content, Space, colour, float — because creating-a-note-like-this is one thing a person asked for, and the engine can apply it as one transaction since it is the sole writer.
- **There is no `recolour-and-move`**, because recolouring and moving are two intents that merely happen to be adjacent.
- **No transaction frame on the wire.** Every operation is individually atomic and individually rejectable, which is what the drain's guarantee rests on.

*Sibling check: storage-and-sync — the atomic asset add and the engine-as-sole-writer rule are relied on here, not revised; its per-field conflict model and version-history cadence are what make an intermediate half-configured state costly rather than merely untidy. agent-surface (discussion, decided 2026-09-13) — the operation set's closure is stated here so its MCP tool enumeration and command grammar land on top of it; which verbs exist and what they are called remains its call.*

### Write ordering and the live copy

*(Opened by review-003 F4 — `client-connection-lifecycle` routed this here on closing and it never arrived: the subtopic was written twice without picking it up, and it was absent from the residual-opens list rather than parked in it.)*

#### Context

Three writers can reach one note inside a tenth of a second *(illustration refreshed 2026-09-14 — it read `fumi-mcp append` and `shell fumi append`, written before `append` left the client surface. The two socket rows now show the two shapes that actually reach the engine: a client's whole-body write carrying its read token, and a script speaking the wire operation directly)*:

```
10:42:03.100   fumi-mcp   edit 01J9… <whole body + read token>
10:42:03.104   script     {"op":"append","args":{"uid":"01J9…", …}}  over the socket
10:42:03.180   user       typing in that note's window on Space 3
```

storage-and-sync's single-writer rule covers less of this than it looks. It makes the engine the only **process** that writes the store and the index — which is what makes WAL safe — and says nothing about how the engine orders two socket requests that arrive together. The third writer never crosses the socket at all: the `app` channel is in-process (`client-transport`), so nothing in the transport serialises it against the other two.

#### Journey

**Two-thirds of the concern was already answered and the framing hid it.** Ordering *between socket clients* is arrival order at the accept loop — arbitrary but consistent, and neither client can claim priority over the other in any meaningful sense; `fumi-mcp` writing before a shell script that ran 4 ms later is not a wrong answer. Each operation is atomic and individually rejectable by the decisions above. What remained were two questions that "concurrency" was obscuring rather than naming.

**The first is where the live copy of an open note is, and this document had already caught it once without generalising.** The drain decision's step 4 exists precisely because *"a window edit is in-process… which also makes an in-progress edit invisible to a sequence built on accepting, starting and rejecting socket requests"* — the engine can be quit while the user is mid-sentence, so the drain flushes the live editor buffer. That establishes the buffer can be **ahead of the bundle at any instant**. It follows that a write to an open note cannot be *write the bundle, then tell the window*: the window would then reconcile against a bundle that is behind its own buffer, and whichever way it resolves that, someone's keystrokes or the agent's patch is lost. note-window reached the same place from the presentation side — agent edits arrive as **text patches** that stream into the buffer, which is exactly what keeps the user's caret alive.

**The second is the granularity of serialisation, and the naive answer is wrong for a reason already on the record.** One global mutation queue is simpler and would order everything trivially. But `create` can carry a **remote asset fetch** — note-model has remote/pasted URL media fetched and copied into the bundle — which is seconds of network inside a single operation. A global queue stalls every note behind it.

#### Decision

> **Mutations serialise per note, not globally. A note that is open has its editor buffer as the live copy, and every write to it goes through the buffer whatever channel it arrived on.**

- **Per-note serialisation** — two writes to the same note are ordered; writes to different notes proceed independently, so a slow asset fetch on one note never stalls another.
- **Open notes route through the buffer** — the engine applies the patch to the live buffer, which is what persists to the bundle. Closed notes are written directly. These are genuinely two write paths, and the open-note path is the one that keeps human and agent edits from clobbering each other.
- **Between socket clients, arrival order wins.** No priority, no fairness rule, no channel outranking another.

**Cost, named:** per-note serialisation means the engine holds a little per-note state — a queue or a lock — that has to be released when a note closes or is hard-deleted mid-flight. Two write paths are two code paths rather than one with a branch. Both are paid to avoid a stall that would be visible on the most ordinary operation the product has.

**Deliberately out of scope:** an agent that does `read` → reason → *replace the whole content* is a lost update no per-operation atomicity can fix, because the two operations are separated by the agent's own thinking. note-window raised the **session declaration** for exactly this and left it as `agent-surface`'s call; this decides how the engine orders writes, not how an agent avoids clobbering. *(Answered 2026-09-13, recorded here 2026-09-14 — agent-surface closed it with the **read token** rather than a session: a write that replaces existing content carries the token that came with the content it is replacing, and a token that no longer matches is refused. The scope line stands — this still decides ordering, not clobbering — but the clobbering is no longer an open thread elsewhere.)*

*Sibling check: note-window — its editor model holds that the buffer **is** the Markdown, that agent edits arrive as text patches merged into it, and that there is no write-locking during agent activity; the buffer-as-live-copy rule is the engine-side counterpart of that and is adopted, not re-decided, and its session-declaration thread is left with `agent-surface` where it parked it. storage-and-sync — single-writer and the atomic asset add are relied on, not revised; this says what the engine does inside the process that rule makes sole writer. note-model — remote media being fetched and copied at add time is what gives a single operation network latency, and is cited, not revised.*

---

## Change Notification

### Context

`client-connection-lifecycle` closed with a dependency it could not resolve from inside itself. Its `stopping` behaviour for `fumi-mcp` is *"go idle; reconnect lazily on the next tool call"* — no timer, no polling — and it named the condition out loud: *"this rests on `fumi-mcp` not needing a **live** connection when idle. If no client subscribes to changes, it can be entirely lazy… Whether any client subscribes is `change-notification`'s call, and it reaches back into this decision."*

So this subtopic is not a fresh design question. It either discharges that dependency or forces a decided block to be reopened.

The concrete case:

```
Space 3   fumi window open, user looking at it
          agent: fumi edit 01J9… <body>
             → engine applies, writes bundle, updates SQLite
             → the window on Space 3 shows … what, and when?
```

### Options Considered

**A. No subscription.** Every socket client is request/response. Anything that must react to a change is inside the engine process and observes the model directly.
- Pros: ~~no push frame,~~ no per-client subscription state, no fan-out on write, no reconnect-and-resync story. `fumi-mcp` stays lazy. *(Amended 2026-08-12 — "no push frame" overstated it: `client-connection-lifecycle`'s drain already sends one server-initiated frame, the going-down signal. What A actually avoids is subscription state, fan-out and resync, which is the rest of the line.)*
- Cons: an out-of-process client can only learn about a change by asking.

**B. A subscription frame on the socket.** A client registers interest; the engine pushes change events.
- Pros: an out-of-process client can be current without polling.
- Cons: the engine gains per-connection subscription state and a fan-out path on every write; a subscriber must hold a live connection, which contradicts the lazy-reconnect behaviour `client-connection-lifecycle` decided; a dropped subscriber needs a resync-on-reconnect story (what did I miss?), which is a second, harder problem than the push itself.

**C. Subscription for `fumi-mcp` only.** The long-lived client subscribes; the one-shot CLI does not.
- Pros: pays the cost only where a connection already persists.
- Cons: it is B with a narrower blast radius, and it buys the same nothing — see the Journey.

### Journey

**The "one engine, four clients" framing hid the split this subtopic turns on.** The phrase invites reading all four as symmetric peers over the socket. They are not:

```
in-process (no socket, no protocol)     over the socket
  note windows                            fumi
  menu-bar manager                        fumi-mcp
  management window
```

Under `process-model` shape 1 the engine *is* the app — it draws the note windows and owns the CGS calls, which is why the daemon/UI split was rejected at discovery. Three of the four clients therefore live inside the engine process. `client-transport` already recorded half of this in passing (*"`app` is free: a window edit is in-process and never crosses the socket"*) but recorded it as an attribution convenience rather than as the structural fact it is.

The consequence: **"the management window live-updates" is not a subscription requirement.** It is the same free in-process path the note windows take. The surface most obviously wanting a change feed — a live-filtered search box over a library the engine is mutating underneath — never needs one, because it is on the same side of the boundary as the mutation.

**That leaves two genuine out-of-process clients, and neither can consume a stream usefully.** `fumi` is one-shot: the process exits, so there is nothing to push to. `fumi-mcp` is agent-driven, and an agent that wants current state calls `list` or `read` — the worst-case staleness is one tool call, against a loop (`agent-surface`'s list → read → reason → act) whose whole idiom is re-reading before acting. C therefore buys nothing that B doesn't, on a client that does not want it.

**The cross-Mac case looked like the counter-example and confirmed the rule.** A change landing from another Mac via `CKSyncEngine` is applied by the engine, and the in-process windows redraw from the model exactly as they do for a local agent write. The case that most resembles "something happened elsewhere, tell the clients" never crosses the socket either.

**One shape was genuinely open: a `fumi watch`.** A `tail -f`-shaped CLI verb streaming changes for piping — the one CLI shape that is not request/response, and defensible for a scripting-first product on precedent (`kubectl get -w`, `docker events`). It is also cheap to add later *because* the engine needs an internal change bus regardless to drive its in-process surfaces; the socket frame would be the only new part.

**The user's position went further than deferral, and the distinction is deliberate.** Not *"leave it out for now"* — *"it's more not needed ever. That might change, but at the moment I don't see a use case."* Recorded as a rejection rather than a parked thread, because the two read differently downstream: a deferred item implies work owed and shows up as an obligation in later phases, while this owes nothing. If a use case appears it arrives as new ground, not as a promise being kept.

### Decision

> **No client subscribes. The engine pushes changes only to the surfaces it owns in-process; no change ever crosses the socket.**

*(Amended 2026-08-12 — this read *"every socket client is **strictly request/response**"*, which is wider than the reasoning below supports and collides with a decision already made: `client-connection-lifecycle`'s drain step 5 signals connected clients that the engine is going down, and **The going-down signal carries intent** builds the `restarting`/`stopping` client table on it. That is a server-initiated frame. The scope this subtopic actually decides is **change events**, and the wording now says so. The going-down signal stands unchanged — it is the later and load-bearing decision, and nothing in the reasoning here argues against it: every cost weighed below is subscription state, fan-out on write, or resync-on-reconnect, and a one-shot lifecycle frame incurs none of them.)*

> **No change event crosses the socket, in either direction. Nothing subscribes to anything.** The unsolicited engine→client frames the protocol does carry are lifecycle frames, not change events: the **going-down signal**, received by every connected client because the connection is about to end, and the **protocol version** stated on connect (`version-skew`).

*(Amended 2026-08-20 — this read "exactly one server-initiated frame", which `version-skew`'s connect-time greeting made wrong. The count is replaced by the scope this subtopic actually decided: the three costs weighed below — subscription state, fan-out on write, resync-on-reconnect — are incurred by change events and by neither lifecycle frame. Worth noting the count had already gone stale once, on 2026-08-12, when the going-down signal collided with an earlier "strictly request/response"; a scope statement is what stops it recurring.)*

- **In-process surfaces** — note windows, the menu-bar manager, the management window — observe the engine's model directly and update live. This covers a local edit, an agent write to an open note, and a change arriving from another Mac identically, because all three are the engine applying a change to its own model.
- **`fumi`** — one-shot request/response. Exits.
- **`fumi-mcp`** — request/response per tool call. Never holds a subscription, never needs a live connection when idle.

**The `client-connection-lifecycle` dependency is discharged as written.** Nothing subscribes, so the lazy `stopping` behaviour stands unchanged — no timer, no polling, and Fumi being quit and relaunched mid-session just works. That decided block needs no revision.

**A change stream is rejected, not deferred.** No `fumi watch`, ~~no push frame,~~ no subscription state in the engine, and no change event on the socket in any direction. *(Amended 2026-08-12 — "no push frame" is too wide, per the scoping above; what is rejected is a **change** stream, not the lifecycle frame the drain already sends.)* Nothing is owed here and no later phase inherits an obligation. The engine's internal change bus exists regardless — it is what drives the in-process surfaces — so if a use case ever appears, the socket frame is the only new part and this decision is cheap to revisit. That is a property of the shape, not a plan.

**Cost, accepted and small:** an agent's view of a note can be one tool call stale. This is invisible in practice for the loop `agent-surface` describes, and no worse than the file-on-disk view any external tool would get.

**What this does not decide:** how the engine's in-process change bus is structured, and how an agent write announces itself *to the note-window presentation* (the edge shimmer and streaming text) — note-window flagged the dispatch/notify mechanism as likely `agent-surface`'s, and the presentation as its own. This subtopic settles only whether a change crosses the socket.

*Sibling check: note-window — its decided text holds that agent edits arrive as text patches and visibly stream into an open note, with no write-locking during agent activity; that requires live in-process update and is relied on here, not revised. Its note that the agent-side dispatch/notify mechanism belongs to `agent-surface` is left standing. storage-and-sync — the engine as sole writer of the store and index, and inbound `CKSyncEngine` changes applied by the engine, are relied on, not revised. management-window — this decides only that its updates are in-process and therefore free; what it renders and how remains that topic's.*

---

## Supervision And Failure

### Context

This subtopic was carrying three debts parked by decided blocks: crash-loop behaviour, what launchd should do about a wedged engine, and launchd policy generally. **Two of the three dissolved on 2026-08-12** when `process-model`'s Fork 1 reversed to a plain login item — a crash loop needs something restarting the process in a loop, and there is no longer any process manager to hold a policy.

What is left is failure the engine has to face without a supervisor, and it separates into two problems that want opposite answers.

### Decision — a wedged main thread: the watchdog logs, and never acts

#### The property that shapes it

**A wedged main thread cannot report on itself.** Anything that notices has to live on another thread, and anything that *draws* has to run on the thread that is stuck. That rules out the obvious in-process response before it is considered.

#### What macOS already covers

More than we would build, and it arrives without us:

- ~~The **beachball** appears.~~ *(Struck 2026-09-14 — `status-and-alerts` established that the OS beachball needs a focused window, which a menu-bar app with nothing on screen does not have. For a user with no fumis open it never appears.)*
- **Force Quit** lists the app as *(not responding)*, so the user has a kill.
- A reopen attempt hits the **lock-refused branch** decided in `Single instance` — the arriving process finds the lock held with no answer, and surfaces *"Fumi isn't responding"* with an offer to force-quit and reopen.

~~Between them the user is told, offered a kill, and offered a relaunch. That is the entire recovery story, already assembled.~~

*(Restated 2026-09-14 — with the beachball gone, **nothing in the list announces**. The two survivors are both things the user finds after already suspecting something is wrong: one by going to Force Quit, one by reaching for Fumi. The recovery story is still assembled; it is discovery-driven rather than announced.)*

#### Decision

##### 2026-09-14 — the beachball leg goes; a freeze is a restart problem, not an announcement problem

*Trigger: the final review, against `status-and-alerts`'s decided text — the OS beachball needs a focused window, which a menu-bar app with nothing on screen does not have.*

> **Nothing announces a frozen engine to a user with no fumis open, and nothing will. A freeze is discovered when the user next reaches for Fumi. What the design owes is not a louder failure but a safe one: after a freeze, restarting must always work and must lose no more than a crash already loses.**

**The user's ruling, which is what settles it:** *"this feels like an edge case not worth over worrying about. if the app crashes or freezes most users are capabale to fixing. we just need to handle it internally so its safe to restart."*

**The watchdog decision below is untouched.** *Logs, never acts* rested on two grounds and the beachball was neither: self-exit converts a frozen desk into an empty one, and a wedged main thread cannot drain on the way out, so a self-kill is a crash the engine performs on itself. Both stand. What the review correctly found is that the **inventory above** claimed an OS-supplied announcement that a menu-bar app does not get — the same shape of error as the crash entry's menu-bar-icon leg, found the same way.

##### What "safe to restart" actually requires, gathered rather than assumed

The property is load-bearing now that it is the whole requirement, and the pieces sit in three different subtopics. Nothing new is decided here except the last item:

- **The lock releases however the process died.** `Single instance` chose an `flock` over letting `bind()` fail precisely for this: *"the kernel releases an `flock` when the holder dies, however it died. No staleness, no dance."* A force-quit leaves nothing to clear.
- **The stale socket file is expected, not a problem.** Whoever acquires the lock unlinks the leftover and rebinds, without interpreting it.
- **What is lost is exactly the crash path's losses, already accepted.** In-flight writes are indeterminate; the live editor buffer, the debounced per-device blob and the sync state are unflushed. The drain named this as *"the loss the settle windows already accept"*, and it is bounded by always-on autosave and a debounce of seconds — geometry, not content.

> **The force-quit offer must not wait on a drain that cannot run.** The arriving process's *force-quit and reopen* terminates a main thread that is by definition stuck, so a polite request to quit would be answered by nobody and the offer would appear to do nothing — the exact silence the lock-refused branch exists to prevent, re-entering through the button meant to fix it.

**That is the one thing this ruling adds**, and it follows directly from it: if a freeze is to be recovered by restarting, the restart gesture cannot be routed through machinery the freeze has disabled.

**Not built, deliberately:** no announcement channel for a freeze, no watchdog-triggered notification, no health indicator. `status-and-alerts` scopes its modal alert to the *arriving* process — the user has to reach for Fumi before anything speaks — and that is accepted as the whole of it.

*Sibling check: status-and-alerts (discussion) — its decided text holds that the OS beachball needs a focused window a menu-bar app does not have, that macOS never learns a second launch failed to take a lock, and that the modal alert belongs to the wedge specifically and is drawn by the arriving process; all three are adopted and none revised — this corrects the inventory that had claimed otherwise, and adds no channel to theirs. note-window — the editor buffer as the live copy is cited as part of what a force-quit loses, unchanged. storage-and-sync — the settle windows and always-on autosave are cited as what bounds that loss, not revised.*

##### Initial

> **A watchdog thread exists to log, not to act. It notices the main thread has stopped ticking and records it. It never force-exits the engine.**

**The logging earns its place from a consequence of the Fork 1 reversal.** With nothing supervising the process, a deliberate exit, a crash and a hang are **indistinguishable after the fact** unless the engine says which — the same debt the exit classification already handed `observability` for restart intent. Without it, every post-mortem starts by guessing.

**Rejected: self-exit on hang** — the familiar pattern, and wrong here on two counts.

- It **converts a frozen desk into an empty one**, and after the reversal nothing brings the engine back. That is choosing, on the user's behalf, to destroy state they can still see: a beachballed Fumi still has their notes on screen.
- It **cannot exit cleanly**. The drain's first act is flushing the live editor buffer, and that buffer belongs to the thread that is stuck. A self-kill from a wedged state is a crash the engine performed on itself, with the crash path's losses.

*Sibling check: note-window — the editor buffer as the live copy of an open note is its ground, cited here as the reason a wedged main thread cannot drain; nothing there is revised. observability (this topic, pending) — the hang record joins the restart-intent record it already owes; this names the debt rather than deciding its surface.*

### Decision — no operation waits unbounded on the outside world

#### Context

Nothing had this on a list, and it is a direct consequence of two decisions made on 2026-08-12. `operation-core` serialises mutations **per note**, and a single `create` **can carry a remote asset fetch** — seconds of network — because note-model has remote and pasted URL media fetched and copied into the bundle.

If that fetch has no bound, everything queued behind it **for that note** waits forever:

```
note A   create ─ remote fetch ─ (no response, ever)
              └─ append   queued behind it …
              └─ recolour queued behind it …
note B   fine.  note C   fine.  windows fine.  menu bar fine.
```

One note goes dead while the rest of Fumi looks healthy, and the client waiting on it never hears back. This is the failure a whole-process watchdog would never see, because the process is not wedged.

#### Decision

> **No engine operation waits unbounded on the outside world. Every operation completes or fails within its own bound, so a per-note queue cannot stall permanently.**

> **The engine always answers.**

**The second statement is the one worth keeping.** Because every operation terminates, **a client never needs a timeout of its own** — the same property the drain established from the other direction, where the engine answers *not applied* definitively rather than leaving the client to infer from silence. A protocol where the server always replies is one where no client has to guess, and this closes the last route by which a client could be left waiting on a live connection.

**The bound's value is implementation's; the rule is that one exists.** This is deliberately not the constant this topic has twice refused to write — those bounds waited on an **app relaunch**, which is unbounded, machine-dependent and wrong for somebody whatever number is chosen. A network fetch timeout is an ordinary bound on an ordinary operation, and the failure it produces is an operation that fails rather than an answer that is wrong.

**The failure surfaces as an ordinary operation failure**, which the error frame already carries: `client-transport` fixed the shape, `client-connection-lifecycle` requires a machine-readable code beside the human line, and the code vocabulary is `agent-surface`'s.

*Sibling check: note-model — remote and pasted URL media being fetched and copied at add time is what gives a single operation network latency, and is cited, not revised. Its rule that a failed fetch produces no asset and the paste degrades to a plain Markdown link already describes what a timed-out fetch does to the note; this adds only that the fetch must be bounded so the engine reaches that outcome. storage-and-sync — the atomic asset add is unaffected: an operation abandoned at its bound applied nothing, which is the same boundary the drain uses.*

### The wedged engine and the socket clients

*(Opened by review-005 F3 — a contradiction inside this subtopic: it accepts the wedged-but-alive engine as a real state, then decides two blocks later that **the engine always answers** and that a client therefore needs no timeout of its own.)*

#### Context

That property is derived from every **operation** being bounded. It does not survive the thread that runs operations being stuck. The recovery story assembled above is for the **human** — beachball, Force Quit, and the arriving app process surfacing *"Fumi isn't responding"* via the lock-refused branch. The two socket clients meet the same engine through a different door:

```
engine wedged (main thread blocked, socket still bound)

  arriving app process → lock refused, no answer → alert, force-quit offer   ✓
  fumi edit …          → connect() succeeds → request sent → …               ✗ forever
  fumi-mcp tool call   → same                                                ✗ forever
```

`client-connection-lifecycle` defines the CLI and MCP failure only for the **dead socket** case (*"exit code 1 with a human-readable line"*), and a wedged engine is not a dead socket. So the one failure the design cannot recover from on its own is also the one where an agent waits with no error and no code to act on — on a topic whose transport decision insists an agent must be able to tell error classes apart. A hung agent turn is worse than a failed one.

#### Decision

> **The engine's obligation is to answer. Where the work layer cannot, the transport layer answers for it: once the watchdog has seen the main thread stop, in-flight and incoming requests fail with a distinct *not responding* error.**

**The means are already in the subtopic.** The watchdog is off the main thread by construction — that is the only way it can notice the main thread has stopped — and the socket's accept loop is on its own queue. The work layer is jammed; the front desk is still staffed and can say so.

**This keeps *the engine always answers* true rather than aspirational**, and preserves the property built on it: a client still needs no timeout of its own. It also makes both doors say the same thing — the app process puts up *"Fumi isn't responding"*, the socket clients receive an error meaning exactly that, in the shape `client-transport` fixed and with a code from `agent-surface`'s vocabulary.

**It does not breach the watchdog's *logs, never acts* line.** Reporting a state is not acting on it: nothing is killed, nothing is restarted, no state is touched. That rule exists to stop the engine destroying visible state on the user's behalf, and answering a socket does none of that.

> **The socket layer runs off the main thread.**

Stated as a decision rather than left to implementation, because the whole answer above depends on it: an accept loop sharing the wedged thread leaves the front desk jammed too.

**Residual case, accepted:** a wedge that takes the socket queue with it — a lock the main thread holds and the socket queue also needs — leaves nothing to answer, and the client hangs. From outside that is indistinguishable from a crash, and it falls in the same accepted bucket as *"a crash leaves in-flight work indeterminate"*.

### What this leaves

**Nothing supervises the process, and that is settled rather than outstanding.** A crashed engine stays dead until the user reopens it — accepted in `process-model` on the grounds that the failure announces itself (every note on every Space vanishes at once, and the agent surface answers *"Fumi isn't running"* rather than falling silent) and the recovery is one Spotlight invocation. *(Amended 2026-09-14 — the second leg was the menu-bar icon's absence until `status-and-alerts` established the icon is not guaranteed to be drawn.)* The wedged case is now covered from the outside by `Single instance` and from the inside by the watchdog's record. What is lost in a crash was already stated by the drain: in-flight writes are indeterminate and unflushed engine state is gone, which is the exposure the settle windows already accept.
---

## Version Skew

### Context

`client-transport` left this seam explicitly: *"how the protocol announces and reconciles a version across an engine/client mismatch. A `hello` frame on connect carrying the engine's protocol version is the obvious hook and this framing accommodates it, but whether it is needed — and what a mismatch does — is that subtopic's, narrowed considerably by both clients shipping inside the bundle."*

**The narrowing is most of the answer.** `fumi` and `fumi-mcp` ship inside `Fumi.app`, sign with it and update with it, so there is no independently-versioned client — the property `operation-core` leaned on when closing the operation set. Old and new can meet in exactly two ways:

- **A long-lived `fumi-mcp` across an update.** The MCP host launched the binary before a Sparkle swap; the binary on disk was replaced, the **process** was not. An old client is now talking to a new engine. This is the real case.
- **A stray bundle copy.** A `~/Downloads/Fumi.app` whose `fumi` is run against the installed engine — the same shape, from the other direction, and the case `Single instance` already contemplates.

Data and record versioning is **not** in scope: `schemaVersion` on the note record, on document payloads and on the SQLite index is storage-and-sync's, with its own migration procedure.

### Journey

**A phrasebook is the right model, and it does most of the work.** If every edition only **adds** phrases, an old phrasebook still works — a client never asks for an operation it does not know exists, and unknown response fields are ignored. Additive change therefore needs no version at all, and additive is what almost every change will be.

**What is left is the day a meaning changes**, and the failure mode there is what decides the design: an old client **mis-reads a response it believes it understands**. That is silent wrong behaviour, which this document has consistently spent small amounts to avoid — the same instinct behind *rare silent loss is worse than rare visible annoyance* in storage-and-sync, and behind the drain answering *not applied* rather than leaving a client to infer.

**Rejected: capability negotiation.** `operation-core` already refused a runtime operation catalogue for a client that does not exist; a negotiation protocol is that refusal's larger cousin, priced against the same absent consumer.

**Rejected: nothing at all, on a commitment to additive-only.** It would work, and it is unenforceable — a discipline no mechanism upholds, of exactly the kind this document named as *"the one genuinely fragile part"* when storage-and-sync relied on a developer remembering to bump a constant. One integer converts that fragility into a clear message.

### Decision

#### 2026-09-14 — the third caller: what the stability promise is, and where the obligation sits

*Trigger: the final review — this subtopic scoped itself to Fumi's own binaries, and the 2026-09-14 operation-set entry made a user's shell script the sole justification for an operation's existence. That caller is outside the guard.*

> **The engine announces its protocol version to everything that connects, and the obligation to read it belongs to the caller. A caller that ignores the greeting is on its own. The engine never requires a version to be stated, and never withholds an answer from a caller that says nothing.**

> **The stability promise is: the documented operation set does not change meaning within a protocol version.** That is what a script author can build on. Across a bump it is the greeting, and nothing else, that says so.

**The gap is real and is accepted rather than closed.** *"Old and new can meet in exactly two ways"* was written when both ways were Fumi's own binaries, each of which ships inside the bundle and is obliged to check. A shell script is a third way: it receives the greeting, is under no obligation to read it, and on a breaking bump keeps sending and keeps being answered — mis-reading responses it believes it understands, which is the precise failure this subtopic spent an integer to avoid.

**Why the obvious fix is refused.** Gating operations on a stated version — the engine declining to answer a caller that has not identified itself — would close it completely, and would destroy the case the openness exists for. `client-transport` chose newline-delimited JSON over length-prefixed framing on exactly one worked example: *"a shell script can `echo '{"op":"list"}' | nc -U …`"*. A handshake makes that one-liner impossible. Length-prefixing was rejected for leaving the socket *"technically open and practically closed"*, and a mandatory handshake is that same trade wearing a different coat.

**So the promise is stated instead of enforced, and the honesty is the point.** The engine does everything it can from its side — it announces, unprompted, to every connection, before anything is asked of it. What it will not do is refuse to serve a caller who did not listen. A script author who reads the greeting is fully protected; one who ignores it has declined a guarantee that was offered rather than been denied one.

**Named and not taken, so a later reader sees it was weighed:** the engine could refuse a caller whose *stated* version is wrong while still answering one that states nothing. That keeps the `nc` one-liner working and hardens the scripts that do identify themselves. It is not adopted now because it protects only callers already reading the greeting — who are the ones already safe — and it puts a conditional branch in the protocol's front door for that. If breaking bumps turn out to be frequent enough that scripts are being mangled in practice, this is the change to make, and nothing here blocks it.

*Sibling check: agent-surface (discussion, decided 2026-09-13) — its closed error vocabulary carries `version_mismatch`, credited to this topic; the code is unchanged and nothing there is revised, since this adds no new failure an agent meets. client-transport (this topic) — the open socket, the `nc -U` worked example and the newline framing chosen for it are cited as what a handshake would cost, not revised. operation-core (this topic) — its 2026-09-14 entry keeps `append` for the script caller and records the documentation contingency; this states what that caller is actually promised.*

#### Initial

> **The engine states a protocol version when a client connects: one integer, bumped only on a breaking change. A client whose number does not match refuses to operate and reports what needs to happen.**

**The greeting is unsolicited, and that is deliberate.** A frame with no `id` is an engine event by the wire protocol's own rule, and the going-down signal already means a client — including a shell script — must tolerate unsolicited frames. Sending the version on connect makes that rule **the first thing anyone meets** rather than a footnote encountered later, which is worth more to a script author than the line it costs. The socket's openness to the user's own scripts is a decided value and this does not erode it.

> **The mismatch is reported as the result of whatever the client was asked to do, not only at connect time.**

**Because the recipient is an agent, and an agent watches tool results rather than connections.** A `fumi-mcp` that discovered the mismatch at startup and then sat quietly would leave the agent with a server that answers nothing and explains nothing. Returning the mismatch from the attempted tool call puts it in the one place the agent is looking, and the agent can then investigate and tell the user.

**The message names the remedy in host-agnostic terms** — *"the Fumi MCP server is running an older build and needs restarting"*, or for a stray copy, *"this `fumi` is from a different version of Fumi"*. How a particular MCP host restarts a server is the host's business and the agent's to work out; hardcoding one host's mechanism would be wrong in every other. **The error's shape is `client-transport`'s and its code belongs to `agent-surface`'s vocabulary**, alongside the other classes an agent must tell apart.

**Cost, accepted:** a breaking change makes every long-lived `fumi-mcp` from before the update refuse until it is restarted. That is the point — refusing is the alternative to guessing — and the user is told exactly what to do.

*Sibling check: storage-and-sync — its `schemaVersion` procedure covers the note record, document payloads and the SQLite index, each versioning what it owns; the protocol version is a fourth thing versioning what **it** owns, on the same principle, and nothing there is revised. agent-surface (discussion, decided 2026-09-13) — the error class is named here because the transport produces it; the code and the wording an agent reads are theirs. build-and-release — the update mechanism is what creates the one real skew window, and nothing here constrains it further.*

---

## Observability

### Context

This subtopic is a collection rather than an open design question. Six decided blocks landed on the condition that the engine record or surface something, and none of them chose a mechanism:

- **The restart intent** — after the Fork 1 reversal *"a deliberate restart and a crash look identical after the fact"* unless the engine says which.
- **The hang** — the watchdog's only job is to record that the main thread stopped.
- **A login-item registration that is present but not active** — pending approval or user-disabled, *"a quiet indicator… the failure it prevents is the silent one"*.
- **The restoration readiness timeout** — *"an unbounded silent wait is exactly the thing `observability` exists to make visible"*.
- **Sync state and store size** — storage-and-sync: *"the engine records sync state; management-window renders it"*, plus the store-size-on-disk figure with its per-lever breakdown.
- **The *not responding* error** the transport answers with when the work layer is wedged.

#### Does Copy Diagnostics carry enough to diagnose a placement failure?

*From: platform-support · research · 2026-09-06*

**The ask:** specify what the **Copy Diagnostics** export actually contains, and confirm it carries the placement-verification record. A support workflow now depends on it that did not exist when it was decided.

**What is already decided, and not in question.** Diagnostics go to Apple's unified log (`os_log`), not a file Fumi owns; retention is deliberately not Fumi's; and the support-attachment path is a **Copy Diagnostics** action that runs the `log show` export for the user, with placement assigned to `management-window`. The Observability rule — the reader decides the surface, live state to the management window in-process, after-the-fact to the system log, no health subsystem and no status operation — stands and this concern adds no surface to it.

**What changed, and why it reaches you.** On 2026-09-02 the user ruled on what Fumi does when the Space-placement surface breaks on a future macOS release:

> *"Fumi falls back and keeps working. Nothing is surfaced to the user — they stay unaware. Everything is logged. On a support contact, the user attaches a debug log that says what happened. The system still works; it just doesn't home."*

That is the same answer `space-homing` had already settled by derivation, so nothing new is decided by it. **But it makes the diagnostic path load-bearing in a way nothing previously did.** Silent degradation is only a supportable choice if the diagnosis is actually recoverable afterwards — the log is the entire mechanism by which a break is ever noticed, reported and fixed. Under the decided architecture there is no Fumi-owned log file for a user to attach; there is a unified-log export behind an action that no topic has yet specified the contents of.

**The specific question.** `space-homing` decided the placement self-check: place, show, read back the window's landed Space, compare against the target, treat a whole-set mismatch as the signal that the route is not working on this OS — *"logged and never surfaced in the app"*. For a support report to be diagnosable, the export needs at least:

- the **subsystem and category** the placement verification logs under, so `log show` selects it rather than burying it;
- the **aggregate mismatch record** itself — target Space versus landed Space per window, and the whole-set verdict;
- the **OS version triple** (`major.minor.patch`). `platform-support` established that reference implementations record the OS version *in the failure log and nowhere else* — never as a gate — precisely because the failure is a capability that stopped resolving, and the version is the thing that identifies which release did it. AltTab does exactly this when its private-member probe returns nil.

If `log show`'s default window or predicate excludes any of that, the user attaches something that does not contain the answer, and the silent-degradation choice quietly loses the property that justified it.

**Not in question.** The unified-log decision itself, the rejection of a Fumi-owned log file, retention, or the placement of the Copy Diagnostics action (that is `management-window`'s). This asks only what the export must contain for the placement case, which is the one case whose whole support story rests on it.

### Journey

**Splitting by reader collapses the six into two groups, and drops one.**

**The *not responding* error is not observability at all.** It is a reply on the socket, and `client-transport` already fixed its shape and left its code to `agent-surface`. What this subtopic owes at that moment is the log line, which is the same entry as *the hang*. Six become five.

**Two are read by a person, inside the app** — the inactive registration, and sync state with store size. Both were already assigned the same split by the blocks that raised them: the engine records, `management-window` renders. **No mechanism is needed for either**, because `change-notification` established that the management window is **in-process** and observes the engine's model directly. There is no protocol, no push, and nothing new to build.

**Three are read after the fact** — why the engine exited, that it hung, and that restoration gave up waiting. These have one thing in common that names the group: **since the Fork 1 reversal, nothing keeps a record of the engine except the engine.** There is no process manager logging starts, exits and restarts on its behalf. A quit, a crash and a hang are indistinguishable afterwards unless the engine wrote down which. It is a black box in the aircraft sense — carried so that something survives the event to explain it.

### Decision

#### 2026-09-11 — what Copy Diagnostics carries, and the two properties of the unified log that decide it

*Trigger: triage from platform-support: "Does Copy Diagnostics carry enough to diagnose a placement failure?" — silent degradation on a future macOS is only a supportable choice if the diagnosis survives to the support email, and nothing said what the export contains.*

> **Copy Diagnostics exports Fumi's own subsystem with no time bound — everything the system still holds. It is a file attachment, not something pasted into a mail body.**

**The narrow alternative was the one to beat, and it loses on when the report arrives.** The placement record is written at every launch, so an export scoped to the current process always contains the live placement verdict — which is the case this concern was raised for, and the case a narrow export serves perfectly. It fails everything else: a restart intent, a hang, a restoration timeout from three days ago are only in the paste if the window reaches back that far. **And a late report is the normal shape of one here**, because the whole premise of silent degradation is that the user notices by accumulation rather than by being told — *"my notes don't stay on their desktops any more"* is a sentence written days after the first bad login. An export that covers only the session the user happened to be in when they finally wrote in is an export sized for the one report we were not worried about.

Retention stays the system's, exactly as decided — no time bound is asked for and none is enforced. `log show` with no `--last` reaches as far back as the store holds, which on the machine this was measured on is nine days: `` /usr/bin/log show --predicate 'subsystem == "com.apple.securityd"' --style compact | wc -l `` → `90835`, oldest record `2026-09-02`, run `2026-09-11`. The count is a reading of a live store rather than a constant — a re-run twenty minutes later gave `90010` as records aged out — and what is load-bearing about it is the order of magnitude, not the figure: one busy subsystem over the retention window is tens of thousands of lines, so this is an attachment.

##### Two measured properties of `os_log`, and both are load-bearing

**The store has separate capture and persistence levels, so a diagnostic below `.default` is gone before anyone exports it.** `man log` documents both — `level: {off|default|info|debug}` for what is captured, `persist: {off|default|info|debug}` for what reaches disk — and `log show` states its own default: *"The output contains only default level messages unless `--info` and/or `--debug` are specified."* `.info` and `.debug` are memory-backed under the default persist mode, so the tempting shape — log verbosely at `.info`, have Copy Diagnostics pass `--info` — produces an empty file hours later, which is the only time anyone runs it.

> **Every record the support path depends on is logged at `.default` or above. Nothing a support report needs is ever carried at `.info` or `.debug`.**

**Dynamic values are redacted in an export unless the call site marks them public.** Measured: `` /usr/bin/log emit --subsystem com.fumi.probe3 --category placement --type default "PROBEMSG" `` then reading it back with `log show` returns

```
2026-09-11 16:04:54.232 Df log[9044] [com.fumi.probe3:placement] <private>
```

— the message itself, not a field within it. **So a wide export is safe by default and useless by default, and which one it is depends entirely on what each call site marks.** That is the property that makes "export everything" affordable: the privacy boundary is not the export's scope, it is the set of values Fumi deliberately publishes.

⚠️ **Implementation checkpoint, named rather than glossed:** what was measured is `log emit`, which passes its message as a dynamic string. A Swift `Logger` probe was written first and produced no readable record, so the redaction behaviour of an interpolated `Logger` call — and specifically that `privacy: .public` is what lifts it — is the documented mechanism rather than something exercised here. The decision above would not change if the marking syntax differs; what it rests on is that publishing is opt-in, which the emit probe does establish.

> **What identifies the failure is marked public. What identifies the user's content never is.**

- **Public** — Space ids (target and landed), the per-window and whole-set placement verdicts, the OS version triple, the restart intent, the hang record, the restoration-timeout record, and note **UIDs** where a record is per-window. A UID is opaque and carries no content, so publishing it costs nothing and buys the reader the ability to check a verdict rather than trust it.
- **Never public** — note content, derived titles, and **inbound file paths**. The path-passing decision hands the engine paths like `~/Documents/board.png`, and its unreadable-path error class wants to name the path to be useful. It names it **to the caller**, who supplied it and already has it; repeating it into a support attachment publishes the user's directory structure for no diagnostic gain.

##### What the export selects, and what the placement record holds

> **One subsystem for Fumi, a category per area.** The export is a single subsystem predicate — not a list of categories to keep in step with the code — and the category names the area (placement, lifecycle, sync, store) so a reader can narrow once they are looking at the file.

> **The placement record is per-window rows plus a verdict: note UID, target Space, landed Space, then the whole-set verdict, with the OS version triple on the verdict.**

Per-window because `space-homing`'s predicate splits by path — the restore burst reads in aggregate (*"one window off is noise… all of them off is a diagnosis"*), the explicit target reads per window. A support reader holding only the aggregate verdict has to trust the predicate that computed it; holding the rows, they can see whether it was every window (the route is gone) or three of them (homes on Spaces that no longer exist), which is precisely the distinction the verdict exists to draw. The triple sits on the verdict rather than on every row because it is a property of the run, and `platform-support` established the shape: the OS version goes in the failure log and nowhere else, never as a gate — the failure is a capability that stopped resolving, and the version is what identifies which release stopped it.

##### What this does not decide, and what it does not add

Where the action lives and what it is called is `management-window`'s, unchanged. The error codes an agent reads stay `agent-surface`'s. The literal subsystem string is the bundle identifier's, settled at build. **No surface is added**: this is the same after-the-fact half of the reader rule below, specified rather than extended — no health subsystem, no status operation, and nothing new for a user to look at.

*Sibling check: space-homing (discussion) — its Placement Verification holds that `SpacePlacement` reads the landed Space back and compares, that the predicate splits by path (aggregate for the restore burst, per-window for an explicit target), and that a mismatch is logged and never surfaced in the app; all three are adopted and none revised — this specifies what that log record contains, which that block left open. platform-support (discussion/research) — its finding that reference implementations put the OS triple in the failure log and never in a gate is adopted as written, and its rule that no decision licenses branching on the OS version at runtime is untouched: a version in a record is not a predicate. management-window — it still owns where Copy Diagnostics lives and what it is called; nothing there is revised and no placement is decided here. client-transport — its unreadable-path error class is cited, not revised; the path reaches the caller exactly as decided, and this constrains only what the engine publishes to the log. agent-surface (discussion, decided 2026-09-13) — the error-code vocabulary remains theirs.*

#### Initial

> **The reader decides the surface. State a person reads in the app is exposed to the management window in-process and never presented by the engine. Everything read after the fact goes to the system log.**

**The engine records and exposes; it never presents.** This is the rule storage-and-sync already stated for sync state, generalised to cover the registration indicator too — one rule instead of two conventions, and it keeps app-global presentation with the topic that owns app-global surfaces. **Where the indicator renders and what it says is `management-window`'s**; this decides only that the engine makes the state available and what it means.

> **Diagnostics go to Apple's unified log (`os_log`), not to a file Fumi owns.**

**Options weighed.**

- **The system log (chosen)** — free, structured, survives a crash, and requires no rotation, size cap or privacy scrubbing. Every one of those is work we would otherwise write and maintain forever, on a component whose entire purpose is to be reliable when things are going wrong.
- **A file in Application Support** — trivially findable by a user who needs to send it to us, and we own its whole lifecycle: growth, rotation, what it is safe to write into it, and what happens when the disk is full during the crash we are trying to record.

**Retention is not ours either, and that is part of the choice** *(added 2026-08-20, resolves review-006 F3)*. Records age out on the system's schedule. Under a file we would own that too — how large before rotating, how many to keep, and what to do when the disk is full during the crash we are trying to record. The last of those is the worst kind of work: a failure path inside the component whose entire purpose is to be reliable when things are already going wrong.

**The chosen option's one real cost is support friction** — a user cannot attach the log to an email without knowing `log show`. That is answered by a **Copy Diagnostics** action that runs the export for them, which is a small, bounded piece of work against an unbounded one. *(Where that action lives is `management-window`'s, by the same rule as the indicator.)*

**Deliberately not built:**

- **No health subsystem.** The five items above are the debts; a general framework for engine health is not one of them, and inventing one would be building for a reader nobody has named.
- **No `fumi status` operation.** Nothing has asked for engine state over the socket — the manager reads it in-process and the after-the-fact reader uses the log. If a scripting case appears, the verb is `agent-surface`'s to add on top of the operation set, not a gap here.

*Sibling check: management-window — it already owns rendering sync state and store size, and the same split is applied to the registration indicator and the Copy Diagnostics action; nothing there is revised and no placement is decided here. storage-and-sync — its rule that the engine records sync state and reports store-size-on-disk with a per-lever breakdown is adopted and generalised, not re-decided; the CloudKit-exposes-no-usage-API reasoning behind the store-size figure is unaffected. agent-surface (discussion, decided 2026-09-13) — the `not responding` error's code stays theirs, and any future status verb would be theirs to add.*

---

## Summary

### Key Insights

1. **A loud failure needs less machinery than a quiet one.** The launchd reversal turned on this, inverted: the first argument for supervision was that Fumi dying is *worse* than an ordinary utility dying. Backwards — Fumi's death announces itself (every note on every Space vanishes at once) and recovery is one Spotlight invocation, while Keyboard Maestro dies silently and is found out weeks later. Protect the invisible failure, not the important one. *(Sharpened 2026-09-14 — what makes Keyboard Maestro's failure quiet is that its **job runs without being asked**, so harm accrues in the interval. Fumi with nothing open has no job running, and the one thing asked of it — the agent path — answers explicitly. The test is not how loud the death is but whether anything was running on the user's behalf while they were not watching.)*
2. **Check what the alternative actually is before pricing a fork.** Fork 1 chose a launchd agent because the alternative was characterised as the app relaunching itself, *"precisely the pattern that fails in the wild"*. Sparkle ships `Autoupdate`, a relaunch helper, in thousands of apps — the alternative was never that. The argument that carried the decision was aimed at an option nobody was offering.
3. **A constant you cannot establish is a decision you have not made.** Three bounds were removed rather than sized — the CLI's retry, the drain's *"well under a second"*, and the client's unbounded trust in `restarting` — each time by finding the answer that needed no number. The test is what the wait is *on*: an app relaunch is machine-dependent and unbounded, so any constant is wrong for somebody; a local lock release or a network fetch is an ordinary bound on an ordinary operation, and those were kept.
4. **The reader decides the surface.** Observability looked like six obligations from six places until they were sorted by *who reads them* rather than *what produced them* — at which point one dissolved entirely (an error frame, not a record), two were already assigned, and three turned out to be one thing: the engine keeping its own black box, because after the reversal nothing else keeps a record of it.
5. **When a premise dies, the conclusion can survive — but the record must say which half it stands on.** Twice: the socket's openness was justified partly on *"every process running as them can already read the files directly"*, which the path-passing decision falsified; and the single-instance lock was justified on launchd exec'ing directly, which the reversal removed. Both conclusions held on their other half. Leaving the dead premise in place would have let a later reader rebuild on it.
6. **One classification can discharge several exemptions.** The single-instance loser's reopen forward had been exempted from `via` stamping for a reason that also exempts it from the closed operation set and from the version check — it touches no model and carries no payload. Naming the **control layer** it belongs to, alongside the going-down signal and the version greeting, replaced three separate rulings with one.
7. **An inherited slogan can hide the structure it summarises.** *"One engine, four clients"* invites reading four symmetric peers over a socket. Three of them are in-process and never touch the wire, which is what makes live-updating surfaces free and a change stream unnecessary — and the count beneath the slogan was wrong twice before it was stated as a split rather than a tally.
8. **A rule written against a predicate does not outlive it.** The re-attempt clause said *"as the space list becomes plausible"* — coherent under the home-based predicate live when it was written, where a later attempt could succeed, and incoherent under the list-settling one that replaced it, where the timeout means no stable answer is coming. It survived the swap because the swap was read as filling a hole rather than changing a shape. When a predicate is replaced, the sentences that named its failure mode are where to look first.
9. **A precedent's constraints arrive attached to its technique, and they are not the same thing.** yabai was adopted as the reference for the hardest part of this product, and its permission story came along uninspected — a scripting addition and partial SIP, which exist because yabai moves *other applications'* windows. Fumi moves its own. The unexamined inheritance cost a permission-restart requirement, a re-homing exercise when the launchd reversal took its mechanism away, and a worked example in two other decided blocks — all for a grant that is never requested. Ask what the precedent's constraint is *for* before assuming it transfers.
10. **A protocol that always answers is one no client has to guess about.** The drain's definite *not applied*, the bounded operation, and the transport answering *not responding* when the work layer is stuck are three faces of the same property — and it is what lets every client be written without a timeout of its own.
11. **A fact transfers between topics; an argument does not. Ask what the argument was *for*.** Two siblings sent findings on the same day and they landed differently. `status-and-alerts` sent a **fact** — the menu-bar icon is not guaranteed to be drawn — and it applied here exactly as it applied there, striking a leg of the crash-stays-dead argument outright. `agent-surface` sent a **cut**, and the reasoning behind it (a model that edits anywhere should not be given an end-only verb to choose between) was about the ergonomics of an agent picking a tool, which has no counterpart on a socket a shell script speaks. The cut was adopted for `tag`, where the reasoning was about the model, and refused for `append`, where it was about the grammar. The sibling's own view arrived with it and was wrong about its own scope, which is not a failure of theirs — a topic knows why it decided, and the layer that reasoning reaches is the receiving topic's to judge.
12. **A diagnostic export's privacy boundary is what it publishes, not how much it covers.** Copy Diagnostics looked like a trade between completeness and exposure until the unified log's redaction default was measured: a record emitted with a dynamic value reads back `<private>`, so a wide export is simultaneously safe by default and useless by default. The boundary moved from the export's scope to the set of call sites that deliberately mark a value public — which made "everything the system still holds" cost nothing to choose, and made the interesting work the enumeration of what gets published.

13. **A sibling's account of your record is not your record.** The launch-at-login concern arrived reading consent as *"absent rather than decided against"*. It had been decided against — in this document, deliberately, with an argument — two blocks from the ones the concern cited. Adopting that framing would have landed a gap being filled where a reversal belonged, and the reason on-by-default existed would have gone unrecorded with it. The ask was right either way; the shape of the answer was not. Check a concern's reading of what you hold against what you hold, before answering what it asks.

### Open Threads

**Verified at implementation, not before** — the items this document refers to as "the spike list", enumerated here because it is referenced in several places and listed in none:

- Whether an `SMAppService.mainApp` registration survives the user moving `Fumi.app` between `/Applications` and `~/Applications`. Failure weight is *"Fumi stopped opening at login"* — visible, and fixed by toggling the preference.
- Which `SMAppService.Status` value reports a login item the user switched off, so the indicator can say so rather than guess.
- That an interpolated Swift `Logger` call redacts its dynamic values in a `log show` export unless the call site marks them `privacy: .public`. The opt-in property was measured through `log emit` (2026-09-11); the `Logger` syntax that lifts it was not exercised. What rests on it is the public/never-public split under Observability, which holds under any marking syntax — this verifies the syntax, not the rule.

**Owed by other topics, and named where each is relied on:**

- ~~**space-homing** — the launch-time readiness signal restoration gates on; and whether the private Space APIs need the Accessibility permission at all, which a decision here was propped on.~~ **Both answered and folded 2026-09-02.** The readiness signal is the enumerated Space list settling — the placement pre-flight check rather than a separate mechanism (answered 2026-08-30). No TCC grant of any kind is needed to place own windows (answered 2026-08-25), which struck the permission-grant restart. space-homing owes this topic nothing further; what it sent back also removed the re-attempt clause.
- **onboarding-and-permissions** — ~~which relaunch shape the permission grant uses (a helper, or the user reopening);~~ *(dissolved 2026-09-02 — no grant, so no relaunch to shape)* the wording and placement of the first-run launch-at-login offer, including whether the flow says anything about the system notification macOS raises when an app adds a login item; and Files-and-Folders access, the second permission surface the path-passing rule creates — the one permission surface this topic still hands them, and the only route by which a restart driver could return here.
- **build-and-release** — how `fumi` and `fumi-mcp` become reachable from a shell and an MCP host, given both ship inside the bundle; the update flow telling the user Fumi will close and reopen; and a relaunch that tolerates a user-initiated launch landing in the gap.
- **management-window** — where the not-active registration indicator and the Copy Diagnostics action live, and how prominent Quit should be.
- ~~**agent-surface** — the error-code vocabulary (including the unreadable-path and *not responding* classes), the operation names the closed set takes, and the session declaration note-window raised and parked there.~~ **All three discharged 2026-09-13, recorded here 2026-09-14.** The code vocabulary is closed at eighteen members and carries every class this topic named — `path_unreadable`, `not_responding`, `not_running`, `not_applied`, `version_mismatch` — credited back here in its own table. The client verb set is assembled and named. The session declaration was decided **not to exist**, replaced by the read token. *What agent-surface still has no owner for* is the **wire** operation's own spelling and argument shape for `append`, which no client exposes — that lands on specification.

**Parked rather than solved:** the open socket makes the engine a confused deputy for file reads once it holds Files-and-Folders access — a process that could not read a protected location can hand the engine a path there. Accepted under this topic's declared non-adversarial threat model, and revisitable if positioning ever targets a security-conscious segment.

### Current State

- **Process model** — Fumi is an ordinary always-running `LSUIElement` app with a plain login item (`SMAppService.mainApp`). **Launch-at-login is offered during first run, recommended and declinable**: registration happens once when the user accepts, never again, and a decline — or onboarding dismissed without an answer — registers nothing, so a user who says no, or later switches it off, stays off. No launchd agent, no plist, no supervision: a crashed engine stays dead until the user reopens it, which is accepted because the failure announces itself — the fumis vanish from every Space, and the agent surface answers *"Fumi isn't running"* rather than falling silent — and the recovery is one gesture. **The menu-bar icon's absence is not one of those legs**: `status-and-alerts` established it is not guaranteed to be drawn. A user with no fumis open and no agent running is never told, and is owed nothing, because nothing was running on their behalf; a background job of Fumi's own would change that and reopen supervision. One executable, one role — a process that finds the single-instance lock held connects, forwards a reopen intent, and exits. **No permission grant is requested to place windows on Spaces** (space-homing measured it), so there is no permission-grant restart and a Sparkle update is the sole driver of the restart machinery.
- **Lifecycle** — a cold start restores every open fumi and shows no management window; a reopen shows the manager; Quit closes everything and stays closed, with no confirmation, because close-is-hide and always-autosave mean quitting loses nothing. A reopen intent arriving *with* a cold start does not open the manager.
- **Single instance** — an `flock` on a lockfile beside the socket, kept for the two cases LaunchServices does not settle (a second bundle copy, a shell running the executable directly). The lock proves an engine is *live*, not that one is *answering*: a refused lock resolves by reading what comes back — a going-down frame, a refused connection, a *not responding* error, or silence, each meaning one thing. A restart in progress belongs to whoever asked for it, so an arriving process stands down on `restarting` rather than taking the lock.
- **Client connection lifecycle** — the engine is never started by a client; a dead socket is a clean, structured failure for both. On a planned exit it drains, ordered by recoverability: engine-owned state (the live editor buffer, the debounced per-device blob, the sync state) flushes first, then in-flight operations are finished within the drain's own deadline, and anything abandoned before its commit point is answered *not applied* — exact, because operations are atomic. The going-down signal carries `restarting` or `stopping`, emitted by whether something other than the user is bringing the engine back, and it buys a better error rather than a wait — with the permission row struck, `restarting` has exactly one emitter (a Sparkle update) and `stopping` covers Quit and `SIGTERM`.
- **Restart and restore** — restoration fires once, at the first session-ready moment after process start, never on reopen; it waits a bounded interval and restores anyway on timeout rather than never appearing, **placing once with no re-attempt**; a fallback taken during restoration is never written back as intent; and it never activates a Space. **Readiness is the enumerated Space list settling** — the placement pre-flight check every placement already owes, not a separate signal — with the poll interval and the settle window as separate numbers, values left to implementation. Every planned restart is user-initiated.
- **Client transport** — `via` is derived engine-side from the connecting peer and never sent on the wire, with an unrecognised peer resolving to `cli`. Two client binaries ship inside the bundle, siblings over the socket and never chained. The wire is newline-delimited compact JSON both ways, requests carrying an `id` and unsolicited frames carrying none; bytes never cross the socket, so a path crosses and never contents. **Who resolves that path depends on how it arrives**: a path passed as an operation argument is resolved client-side, while a path written into note content is resolved by the engine during materialisation — `~` expanded, a relative path left as written and reported as uncarried. The socket is a single well-known path beside the lockfile in Application Support, open to anything running as the user.
- **Operation core** — anything requiring model knowledge is an engine operation; clients translate arguments in and format results out and hold no model knowledge at all. The surface is a closed, named operation set with typed arguments — no query language, no runtime catalogue — and operations are intent-shaped, so `create` carries a note's full initial state while nothing bundles two unrelated intents. No transaction frame on the wire. **The set does not mirror the client surface**: `tag` is cut (tagging is inline text, not a capability), while `append` stays with no client exposing it, because it is intent-shaped and the socket is a documented surface for the user's own scripts. The read token governs the replacing writes; the additive one carries none, having nothing to reconcile. Mutations serialise per note, and an open note's editor buffer is the live copy every write goes through.
- **Change notification** — no client subscribes and no change event crosses the socket in either direction. The in-process surfaces observe the model directly, which covers a local edit, an agent write and a change arriving from another Mac identically. A change stream is rejected rather than deferred.
- **Supervision and failure** — a watchdog thread records that the main thread stopped and never acts on it; self-exit on hang is rejected, because it converts a frozen desk into an empty one and cannot drain on the way out. **Nothing announces a freeze** — the OS beachball needs a focused window a menu-bar app lacks — and nothing will: a freeze is found when the user next reaches for Fumi, and what the design owes is a safe restart rather than a louder failure, which means the force-quit offer must not route through the drain the freeze has disabled. No engine operation waits unbounded on the outside world, so a per-note queue cannot stall permanently and the engine always answers — and where the work layer cannot, the transport answers *not responding* for it, which requires the socket layer to run off the main thread.
- **Version skew** — the engine states a protocol version on connect; one integer, bumped only on a breaking change. A client whose number does not match refuses and reports what needs to happen, returned from the attempted call rather than only at connect, because an agent watches results rather than connections. The reopen forward is a control frame and is exempt. **The obligation to read the greeting belongs to the caller**: the engine announces to everything that connects but never requires a version to be stated and never withholds an answer from a caller that says nothing, so a user's script that ignores the greeting is on its own — accepted, because gating on a stated version would destroy the `nc -U` one-liner the open socket exists for. The promise is that the documented operation set does not change meaning within a protocol version.
- **Observability** — the reader decides the surface. State a person reads is exposed to the management window in-process and never presented by the engine; everything read after the fact goes to the system log, whose retention is the system's rather than ours. **Copy Diagnostics exports Fumi's subsystem with no time bound** — an attachment, not a paste — because the report that matters arrives days after the first bad login. Everything the support path depends on is logged at `.default` or above, since `.info` and `.debug` do not reach disk; what identifies a failure is marked public and what identifies the user's content never is, which is what makes exporting everything affordable. One subsystem, a category per area; the placement record is per-window rows (UID, target Space, landed Space) plus the whole-set verdict carrying the OS version triple. No health subsystem and no status operation.
