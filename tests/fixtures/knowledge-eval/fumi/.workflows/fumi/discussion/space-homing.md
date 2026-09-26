# Discussion: Space Homing

## Context

A fumi remembers the macOS Space it lives on and returns there on every launch. The mechanic is deliberately quiet — not the headline feature, just furniture that stays where you left it. This discussion turns a heavily-measured research record into decisions: which API route places the windows, what a "home" is keyed on, where a note goes when its home is gone, and how the whole thing degrades when Apple moves the private surface underneath it.

### Inherited position — from discovery

Carried forward as working ground, not re-opened — with one exception noted below. *(Amended 2026-08-30 — the Space-1 fallback bullet was never closed to revision: research reopened it against note-window's ordinal ladder, which the research inheritance below records as a live tension. It is the **incumbent** position here, not settled ground — and `fallback-destination` has since decided it. Determined by that later input.)*

- A note's home Space is the OS-level **managed-space UUID** (persists across reboots and Space reordering), never an ordinal position.
- Notes return to their home Space **silently** on relaunch, across reboots. No Space switch, no attention demanded.
- **Deleted-Space fallback: Space 1** — predictable rather than arbitrary, and it covers cross-machine restore for free ~~(the home UUID simply isn't in the managed-spaces set on another Mac)~~. *(Amended 2026-08-30 — the outcome holds, the mechanism does not for one class of home: Space 1's id is the empty string and `""` resolves on every Mac, so a note homed to Space 1 lands on the new machine's Space 1 by **resolution**, never entering the fallback path. This matters wherever a rule keys off "did this home resolve here?" — such a test passes for `""` on any machine, and the pre-flight existence check passes with it. Determined by the measured empty-string behaviour this Context already records under the research inheritance.)*
- CLI Space addressing: default is the **current Space**; an optional **ordinal** flag (`--space 2`) resolves to a UUID at call time and is pinned by UUID. The ordinal is never stored.
- Fumi has **no awareness of Space labels/names** and no coordination with Spaceman — macOS provides no native labels and Fumi won't invent its own.

Rejected in discovery and not revisited: Space-name/label addressing; ordinal position as identity; positioning this as the headline feature.

### Inherited position — from research

The research phase measured almost all of the discovery brief's open questions on one machine (macOS 26.5.2 build 25F84, arm64, SIP enabled, Studio Display main + MacBook Pro built-in via a CalDigit TS5, 16 user Spaces on main + 1 on secondary). What it established:

- **The acceptance bar is eager placement.** At launch, every fumi is materialised on its home Space *before* the user goes there. The test is Mission Control immediately after launch at 15–16 Spaces. Executed: 16 windows onto 16 Spaces, verified by readback and by human inspection, ~135 ms create + 135 ms place + 242 ms show.
- **Two viable routes, both private.** The private-AppKit route (`NSWindowRestorationOptions` / `_windowRestorationOptions` hook over public `restoreStateWithCoder:`, the Space riding inside the blob as `NSWindowWorkspaceID`) and the private-SkyLight route (`SLSMoveWindowsToManagedSpace`). Every route to placing a window on a non-active Space is private — scanned across all 59 apps in `/Applications`, no public route found. So the off-App-Store distribution decision stands, but on a corrected derivation: App Review policy 2.5.1, not a runtime capability wall (the App Sandbox does *not* block the SkyLight move on an app's own windows).
- **No TCC permission of any kind** is needed to place your own windows — not Accessibility, not Screen Recording, not Automation. yabai's permission story was inherited from manipulating *other* apps' windows. Reading a window's home Space and reading display identity are both fully public; only *placement* is private.
- **The launch-timing problem is a sequencing rule, not a race.** Both routes latch the destination while the window is ordered out, then materialise it directly on the target — no flash, no wait-for-WindowServer machinery. The show step must be the non-activating kind (`orderWindow:NSWindowBelow`), or activation drags the user to that Space.
- **Identity is the UUID, measured.** One undock/redock cycle changed a Space's `ManagedSpaceID` from `19` to `272` while its UUID held. A sid-keyed home would silently point at nothing.
- **Space 1's UUID is the empty string**, and `""` is a *working* identifier — AppKit resolves it to Space 1 from a different active Space. It is a value to carry, not a gap to normalise away.
- **Failure is silent on both routes.** A bogus UUID or an unknown sid leaves the window on the active Space and reports success. `SLSSpaceGetType(cid, sid)` is the existence oracle, and it must run **before** placing, against a freshly enumerated sid. *(The predicate was later widened from `== 0` to types 0 and 4 — see Fullscreen Spaces.)*
- **AppKit restores Spaces on system restart only.** Quit-and-relaunch does not restore natively — Chromium had to override AppKit's default to always restore. Fumi's requirement (confirmed 2026-08-24) is every launch.

Live tensions the research recorded rather than settled: the route choice (three considerations, two directions); whether `""` is unique across topologies; the two disagreeing fallback destinations (Space 1 vs note-window's ordinal ladder); whether a fumi should be homeable to an ephemeral fullscreen Space; and the entire OS range below macOS 26 — the project floor is macOS 14, and nothing was measured on 14 or 15, on Intel, or on a single-display machine.

### References

- [Discovery brief](../discovery/briefs/space-homing.md)
- [Research: Space Homing](../research/space-homing.md)

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture. The Discussion Map lives in the manifest.*

---

## Placement Route

### Context

Placing a window on a macOS Space the user is not currently looking at has no public API. `NSWindowCollectionBehaviorMoveToActiveSpace` moves a window to the Space you are *on* and nothing names another Space; Chromium hits the same ceiling. Research scanned every app in `/Applications` (59, executables plus embedded frameworks and helpers) and found no counter-example using a public route.

So the choice is between two private surfaces, both undocumented, both subject to Apple's churn:

```
/System/Library/Frameworks/AppKit.framework            public framework, private hook
/System/Library/PrivateFrameworks/SkyLight.framework   private framework
```
`ls -d /System/Library/Frameworks/AppKit.framework /System/Library/PrivateFrameworks/SkyLight.framework` → both present (macOS 26.5.2)

Both end in the same place — WindowServer (`pgrep -l WindowServer` → running) is the only process that can move a window. The question is whether Fumi asks it directly or asks AppKit to ask it.

### Options Considered

**AppKit route** — build an `NSKeyedArchiver` blob carrying `NSWindowWorkspaceID` (the managed-space UUID), hand it to `restoreStateWithCoder:`, with a `NSKeyedUnarchiver` subclass overriding the private `_windowRestorationOptions` so AppKit honours the Space. Chrome's mechanism.

- Pros: degrades quietly — `NSClassFromString` returns nil, the hook vends nothing, fumis open on the current Space and nothing crashes. Ten shipping apps on this machine carry the same hook (1Password, Claude, Discord, Figma, Google Chrome, Obsidian, Paper, Signal, Slack, Spark Desktop), all Electron-derived, so Apple removing it breaks a large installed base.
- Cons: indirect — placement is a side effect of state restoration rather than an instruction. Two capabilities measured only on the other route (below).

**SkyLight route** — `SLSMoveWindowsToManagedSpace(cid, windowList, sid)`. Direct.

- Pros: says what it means; takes a window *list*, so a batch lands in one call; addresses Space 1 by numeric sid without the empty-string special case.
- Cons: `dlsym` returns `NULL` when a symbol goes, so an unguarded call site is a crash at login on an `LSUIElement` app with no window to explain itself. Zero apps in the `/Applications` scan carry any SkyLight placement symbol — nothing else breaks when it moves, so nothing else pressures Apple to keep it.

### Journey

**The research file's own scorecard was wrong, and it inverted the answer.** `space-homing.md:728` closes the route thread with *"three considerations pulling in two directions (failure shape → SkyLight; `restorable = NO` entanglement → SkyLight; ecosystem exposure → AppKit)"* — 2–1 for SkyLight. But that sentence's own parenthetical reads *"AppKit degrades quietly, SkyLight crashes on a null pointer"*, which points the opposite way, and `space-homing.md:258` states it plainly: *"the failure asymmetry favours the AppKit route."* Failure shape favours AppKit. The tally is 2–1 for AppKit, not against it. Research had leaned SkyLight, then AppKit, then mis-tallied itself back toward SkyLight; the contradiction is why this looked settled and wasn't.

**The reframe that did most of the work: this is not a choice of framework.** Two capabilities the tradeoff table charged to SkyLight are needed on *both* routes and are read-only — enumerating Spaces (to resolve the CLI's `--space N` ordinal) and the `SLSSpaceGetType(cid, sid)` pre-flight existence check (because both routes silently no-op on a destination that no longer exists). Fumi links SkyLight either way. The route decides who performs the **write**, and nothing else.

That costs the failure-shape argument something worth naming: if SkyLight read symbols are being `dlsym`'d regardless, the null-guard discipline charged to SkyLight's account is already owed. The argument narrows from "the whole route" to "the single placement call" — real, but smaller than the research framed it.

**Two SkyLight-only advantages turned out not to be.** Moving a live, already-visible window (`fumi mv --space 7`) works on AppKit — measured, deep-dive experiment H, and the research amended its own table to say so (`space-homing.md:707`). Space 1 works on AppKit: its UUID is the empty string and AppKit resolves `""` to Space 1 from a different active Space (`sp3.m`). Batch placement is genuinely SkyLight-only, but 16 windows placed with one call each took ~135 ms, so it is an optimisation, not a reason.

**The one live objection was the reboot collision, and it dissolves.** At a system restart macOS restores windows to Spaces natively — so macOS may place Fumi's windows from its saved application state at the same moment Fumi places them from its own store. Two placers. The fix is `restorable = NO`; the objection was that the AppKit route places *through* restorable state and cannot opt out of the mechanism it uses. But `restorable` governs whether **AppKit saves and restores automatically**, not whether `restoreStateWithCoder:` works when Fumi calls it (`space-homing.md:690`). And Fumi is not replaying captured blobs — a synthesised 242-byte two-key archive placed a borderless window on a target Space (`synth.m`). So `restorable = NO` plus a hand-driven restore leaves one placer with the route intact.

**Accepted as an inference, not a measurement.** Three probes would close the question and none were run — the scratchpad they lived in is gone (`ls scratchpad/t/` → no such directory), so each is a rebuild:

1. `restorable = NO` composing with a hand-driven `restoreStateWithCoder:`.
2. The N-window launch burst on AppKit. The 16-across-16-Spaces run that proved the acceptance bar used `SLSMoveWindowsToManagedSpace`; AppKit was only ever measured one window at a time. This is the headline requirement, proven on one route only.
3. Live create onto a non-current Space on AppKit — measured on SkyLight, never on AppKit (`space-homing.md:709`).

The user chose to take the direction on argument and let implementation find out, on the grounds that the driver seam (below) makes a reversal cheap. All three failures are loud and immediate — a burst that lands every fumi on the launch Space is unmissable on day one — which is what makes deferring them affordable.

### Decision

**The AppKit route for placement. SkyLight for reads, on either route.**

Deciding factors, in order: ten shipping apps depend on the AppKit hook and none on the SkyLight placement symbols, so breadth of exposure protects it; and it fails quietly (feature stops working) rather than fatally (crash at login). ~~Apple has already removed `CGSAddWindowToSpace` — named in the discovery brief as *the* API for this feature — with, on the evidence, no shipping dependent to notice.~~ *(Amended 2026-09-11 — the exhibit is withdrawn. `platform-support`'s symbol-table sweep found that `CGSAddWindowToSpace` never shipped under that spelling, and the sweep re-runs here on macOS 26.6.2 build 25G83. The singular is absent and the plural is alive, as a re-export:*

`dyld_info -exports /System/Library/{PrivateFrameworks/SkyLight.framework/SkyLight,Frameworks/CoreGraphics.framework/CoreGraphics} | grep -E '_CGSAddWindowToSpace$|AddWindowsToSpaces'` →
```
0x002F21D4  _SLSAddWindowsToSpaces
    [re-export] _CGSAddWindowsToSpaces (_SLSAddWindowsToSpaces from SkyLight)
```

*And the `CGS`→`SLS` rename is complete with the compatibility shim still maintained: SkyLight exports 1456 symbols named `_SLS*` and zero named `_CGS*` (`dyld_info -exports /System/Library/PrivateFrameworks/SkyLight.framework/SkyLight | awk 'NF>=2{print $2}' | grep -c '^_CGS'` → 0), while CoreGraphics carries the old namespace forward as 789 re-export aliases (`dyld_info -exports /System/Library/Frameworks/CoreGraphics.framework/CoreGraphics | grep -c '\[re-export\] _CGS'` → 789). The discovery brief named a function under a spelling that never existed and this topic's sweep correctly found nothing; reading that absence as removal was the error. The exhibit does not merely fail, it reverses — a namespace Apple renamed and is still aliasing is evidence of compatibility being maintained.)*

*(Amended 2026-08-30, review-001 F4 — the two factors were not weighed equally well and the order should be read the other way round.* **The exposure factor is narrower than stated.** *All ten apps are Chromium/Electron builds of one upstream codebase, and they arrived on the hook recently and as a workaround: Apple broke `NSWindowRestoresWorkspaceAtLaunch` in the macOS 15 betas in autumn 2024, and Chrome shipped no fix for roughly eighteen months. So both private surfaces carry a breakage on record, and the installed base is the current Electron consensus rather than a large set of independent vendors.* **The failure-shape factor is what carries the decision**, *and that same counter-precedent illustrates it: Apple broke the AppKit hook and the observable consequence was windows opening on the wrong Space for eighteen months. No application crashed at login. That is the trade this decision buys.)*

**Which half the decision stands on** *(2026-09-11)*. Failure shape — unchanged by the withdrawal, because the exhibit sat on the other half. The reweighting above had already demoted exposure, and the counter-precedent it turns on is independent of anything the sweep touched: Apple broke `NSWindowRestoresWorkspaceAtLaunch` in the macOS 15 betas, Chrome shipped no fix for roughly eighteen months, and no application crashed at login. What the withdrawal removes is a decoration on the factor that had already lost its weight.

Trade-offs accepted: no batch placement call (~135 ms for 16 placements makes it moot); Space 1 handled through the empty-string value rather than a numeric id; and four unmeasured items carried into implementation rather than proven ground — three capabilities, each failing loudly, plus the OS span (below).

**One implementation, because the OS floor moved** *(2026-08-30, review-001 F4)*. Chromium restricts `NSWindowRestoresWorkspaceAtLaunch` to macOS 14 and earlier and uses the private `NSWindowRestorationOptions` class from 15 onward, so an AppKit route spanning a macOS 14 floor risked **two implementations inside the supported range**, or no resolution at all on 14. The project floor was 14+ — a minimum inherited from CloudKit's `CKSyncEngine`, never a decision to support macOS 14 specifically. It is now **15+ across the board** (user's call, 2026-08-30), which removes the two-implementation risk: the private class exists across the whole supported range. *(Softened 2026-09-01, review-002 F10 — "one implementation on every OS Fumi runs on" claimed more than the evidence carries. Chromium's version gate establishes that the class **exists** from 15; nothing establishes that the rest of the mechanism behaves identically across 15–26. See the span entry on the risk list below.)*

The floor is not this topic's to hold — the change is delivered to `build-and-release`, which records the project-wide constraint, and bears on `storage-and-sync`, where the `CKSyncEngine` minimum originated. Supporting evidence for the timing: macOS 14 Sonoma shipped September 2023 and macOS 27 is due on Apple's September cadence within weeks of this decision, at which point 14 falls outside Apple's own current-plus-two security-update window.

Confidence: medium-high on the direction, medium on the three unmeasured items. Reversal is contained by the driver seam below — that containment is part of what makes this decision affordable, so the two are decided together rather than independently.

*Sibling check: engine-architecture — its Context holds that the engine owns the private-CGS Space-pinning, and its scope is the runtime seam (process shape, socket, clients), not internal code layering. Nothing there is displaced.*

---

## Private API Isolation

### Context

Whichever route places the window, the call is undocumented and Apple can remove it between releases — ~~demonstrated once already in this project's lifetime~~ *(Amended 2026-09-11 — the demonstration cited was the withdrawn `CGSAddWindowToSpace` exhibit; see Placement Route. What stands in its place is Apple breaking the AppKit hook in the macOS 15 betas, and `SLSSetSpaceOwner`'s absence from SkyLight's exports — the surface does move, and the evidence for it is a break and a removal rather than the one that was cited)*. Undocumented calls spread through a codebase mean every macOS release is an audit of everywhere they landed.

### Journey

The user's position, and the reason the route decision above could be taken on argument rather than on probes: private and fragile work sits behind an interface Fumi owns, with drivers doing the work, so a change to the private surface is contained rather than codebase-wide.

The seam turned out smaller than expected, and for a reason that came out of the route analysis: only the *write* varies between routes. Reads are SkyLight on both.

```
Engine
  └─ SpacePlacement                     <- Fumi's own layer. Named, documented, tested.
       ├─ spaces() -> [Space]                 SkyLight read   ─┐ identical
       ├─ space(of: window) -> Space?         SkyLight read   ─┘ on both routes
       └─ place(window, on: Space)       <-- the only driver seam
            ├─ AppKitPlacementDriver          (built)
            └─ SkyLightPlacementDriver        (not built)
```

One method behind the driver. Everything else this topic decides — ordinal resolution, the `SLSSpaceGetType` pre-flight, the Space-1 empty-string case, the deleted-home fallback — is ordinary route-independent code in Fumi's layer, written once. That is most of the logic in this topic.

**Rejected: shipping both drivers.** Tempting — AppKit default, SkyLight fallback, flip a config when Apple breaks the hook. Three arguments against, uncontested:

- A fallback nobody exercises does not work. Knowing `SkyLightPlacementDriver` still functions means running it on every macOS beta — exactly double the churn-tracking the layer exists to avoid.
- Two private surfaces to track permanently, ~~against a failure that has occurred once and cost nothing~~. *(Amended 2026-09-11 — the cheap-failure premise rested on the withdrawn `CGSAddWindowToSpace` exhibit; see Placement Route. The one breakage actually on record is Apple breaking the AppKit hook in the macOS 15 betas, which cost roughly eighteen months of Chrome windows opening on the wrong Space. The premise inverts from a cheap failure to an expensive one, which reads as an argument **for** the second driver — and the conclusion is unmoved, because this bullet was never what carried it. The first bullet is: a `SkyLightPlacementDriver` sitting unrun through eighteen months of betas rescues nobody, and the degraded state is identical either way — fumis open on the Space you are standing on.)*
- Chromium's own insurance was not a second implementation. `kAlwaysMoveWindowsToOriginalSpaces` (`FEATURE_ENABLED_BY_DEFAULT`) turns the feature *off*.

**Rejected on the same day it was proposed: a local preference disabling Space homing as an emergency-off** *(2026-08-30, review-001 F6)*. It entered alongside the single-driver call, carried over from Chromium's flag, and does not survive being looked at on its own. Chromium's is a **remote** flag — flipped server-side across an installed base. Fumi has no remote config, so the proposal was a local preference the user must find and toggle, which is a different object with a different justification, and the justification was never re-derived.

What kills it is that on this route the disabled state and the broken state are the same state:

```
Apple removes the hook   → every fumi opens on the Space you are standing on
Space homing switched off → every fumi opens on the Space you are standing on
```

A switch producing the failure it is meant to rescue you from buys nothing. It would have earned its place on the SkyLight route, where the failure is a null pointer and a crash at login and "turn it off so the app starts" is a real rescue — but that route was not chosen.

Nor does it survive as an ordinary user preference rather than a safety mechanism: the feature is a no-op for anyone who does not use Spaces, and nobody who does use them has a reason to want their notes *not* to come back. There is no user on either side of that line asking for the switch.

### Decision

**A `SpacePlacement` layer owned by Fumi, with the placement write behind a driver. One driver built (AppKit). No kill switch.**

The second driver is a contained addition when it is needed — that being the point of the seam, not a thing paid for up front.

Trade-off accepted: if Apple breaks the AppKit hook, the fix ships in an update and there is nothing the user can do in the meantime. Accepted because there was never anything a switch could have done either — the degraded behaviour is what the switch would have produced.

Confidence: high.

---

## Fallback Destination

### Context

A fumi's home Space no longer resolves at launch. Where does the note open?

The record carried three answers to that one question, from three documents, none of which cited the others:

```
discovery / note-model      → Space 1
note-window ladder rung 2   → same ordinal position on the same display
note-window ladder rung 3   → main display, CURRENT Space
```

Rung 3 is the one to look at hardest: "current Space" is precisely what both placement routes do *by default* when a destination does not resolve — a bogus UUID or an unknown sid leaves the window on the active Space and reports success. It is the failure that looks like success, promoted to a rule.

### Options Considered

**A — Drop rung 2. Unresolvable → Space 1, always.**

- Pros: one rule. No positional key, so nothing to be stale. Predictable enough to put in a support answer.
- Cons: loses the ordinal's best-effort recovery for the external display's destroyed first Space.

**B — Gate rung 2 on scale.** Run the ladder when a few homes fail; go to Space 1 for all when essentially every home fails, since the Space set is then not the one these homes were written against.

- Pros: keeps the undock case working, catches the bulk case.
- Cons: a threshold nobody can defend, on a signal that is a proxy for the thing actually being asked.

**C — Keep the ladder as written.** Accept the reinstall behaviour.

- Pros: no sibling change.
- Cons: note-model already states the opposite and would owe a correction.

### Journey

**The case that separates them is a reinstalled Mac.** note-model's tiering means coordinates and home *display* come back — the Machine tier is backed up per device — while every home Space UUID is dead, because the reinstall destroyed the Spaces. Display present, UUID gone is exactly rung 2's condition, so it fires for every note at once:

```
100 notes, reinstalled Mac

rung 2 (ordinal)   Space 2: 14 notes   Space 5: 9   Space 11: 22  …
                   scattered by positions that meant something on the old
                   install. Looks like it worked.

Space 1            all 100 stacked on Space 1.
                   Obviously "these need re-placing".
```

**The objection, and the measurement that answered it.** Undocking could be a daily event where an OS reinstall is very rare, which reads as an argument for keeping rung 2. Two corrections turned it around:

*Undocking does not invoke this at all.* Fumi places windows only at relaunch; macOS itself migrates windows when a display goes. The case is launching Fumi while undocked, not unplugging.

*And the main display's Space list survives undocking wholesale.* From the three-snapshot capture: the surviving configuration inherits the main display's list entire — every sid, UUID and ordinal — and the other display's Spaces are discarded. With the Studio Display as main, that means the 16 working Spaces keep their UUIDs and resolve at rung 1 while undocked; rung 1 never consults the display, which is why note-window put the UUID first. The only casualty is the laptop's single Space.

And for that one casualty the options agree. The laptop had exactly one Space, so its recorded ordinal is 1, and ordinal 1 on the now-main built-in is the empty-UUID Space — Space 1, the same destination A gives. Redock and relaunch and the laptop's Space returns carrying the identical UUID (its `ManagedSpaceID` moved `19` → `272`, the UUID did not); rung 1 resolves, the note goes home. Nothing was rewritten in between, because resolution never rewrites intent, so the cycle is lossless.

So on this topology A and C are indistinguishable for the frequent case and differ only on reinstall. Rung 2's defensible output here is a coincidence of the secondary display having one Space; with two or more, ordinal 2 on the undocked laptop lands on some inherited Space of the other display — arbitrary, and wrong in a way that looks right.

**A supporting detail found while checking the sibling record: note-model never stored the ordinal.** Its Machine tier is *"window coordinates, home display, home-Space UUID, float-on-top, last-opened"* — three fields for placement, no positional index. Rung 2 required a fourth field that the note record does not carry. Dropping it reconciles the two documents rather than trading one for the other.

*Rarity cuts for A rather than against it: the rarer the reinstall, the less likely anyone is to recognise a scattered desktop as a failure rather than as how it is.*

### Decision

#### 2026-08-31 — revised
*Trigger: review finding — "Space 1" was never display-qualified. Under* Displays have separate Spaces *(on by default, and the configuration every measurement here was taken in) each display owns its own Space list with its own first Space, and the empty-string measurement pinned "Space 1" as the **main** display's first. So for a note whose home display is present but is not the main display, the Space half and the display half of the rule named different screens and could not both be honoured.*

**A note whose home Space UUID resolves opens on that Space. Otherwise it opens on the first Space of its home display. Where the home display is itself absent, that becomes the main display's first Space. There is no positional fallback.**

The display half is unchanged: home display present → its recorded coordinates; home display absent → main display, clamped to the visible frame. The two halves now agree by construction — a note stays on the screen it lived on, and only leaves it when that screen is gone.

**An absent home takes the same destination** *(2026-09-01, resolves review-002 F9)*. "Otherwise" covers absence as well as non-resolution. The four states a home can be in:

| `home_space` | Means | Destination |
|---|---|---|
| a UUID that resolves | the note's Space is here | that Space |
| `""` | Space 1 — resolves on any Mac | that Space, by resolution |
| a UUID that does not resolve | intent that cannot be honoured | first Space of the home display |
| absent | no home was ever recorded on this machine | first Space of the home display |

Absent is the state of a **genuinely new** Mac, where the Machine tier holds no record for this device — distinct from a *restored* Mac, which gets its Machine tier back and whose homes dangle. With no home display recorded either, the absent case degrades through the display half to the main display's first Space, with position cascaded rather than restored. That is what `note-model` already asserts for arrival on a new Mac (*"notes stack down-and-right on Space 1"*), which held only if absence was read into this rule; it now is.

**An absent home is not a verification failure.** A dangling home is intent that could not be honoured and is worth recording; an absent home is no intent at all, and treating it as a mismatch would report a defect every time someone opens Fumi on a new machine.

What made Space 1 the right destination survives intact, because it was never about that specific Space: it was predictability. *"It is on the first Space of the screen it was on"* is as sayable as *"it is on Space 1"*, and it is true on a one-display machine in exactly the original form.

Cost accepted: the destination is no longer literally singular. On a two-display machine a bulk dangle produces two stacks rather than one — which is the better outcome anyway, since each stack is on the screen its notes lived on.

#### 2026-08-30

**A note whose home Space UUID resolves opens on that Space. Otherwise it opens on Space 1. There is no positional fallback.**

The display half of a home is unchanged and independent: home display present → its recorded coordinates; home display absent → main display, clamped to the visible frame.

Deciding factor: rung 2's only failure mode is silent, bulk, and indistinguishable from success, and the case it was designed for is already covered by the fallback on the measured topology. Legibility over recovery — "they are all on the first Space of that screen" is a sentence a user can act on.

**The fallback's domain is narrower than this section argues** *(2026-09-01, review-002 F8)*. The deleted-Space case is walked through here as though it were the common path. It is not: with Fumi running, deleting a Space re-homes the affected notes where macOS puts them and the fallback is never reached. The fallback fires for Spaces destroyed **while Fumi is not running** — closing Fumi, deleting Spaces, reopening later, which the user describes as run-of-the-mill — and for homes that never resolve on this machine at all.

Trade-off accepted: a secondary display with several Spaces loses a best-effort guess that would sometimes have been right. Given that a wrong guess is unnoticeable and a right one saves one drag, the asymmetry favours not guessing.

Confidence: medium-high. The measurement base is one dock cycle on one topology, and the probes are no longer on disk (`ls scratchpad/t/` → no such directory), so the undock inheritance behaviour is read from research's capture rather than re-run.

*Sibling check: note-window — its ladder (`note-window.md:914`) holds a home as display identity · Space UUID · ordinal index, with rung 2 rebinding on the ordinal and rung 3 never writing. This decision removes rung 2 and replaces rung 3's "current Space" with Space 1, keeping rung 3's display half and the "resolution never rewrites intent" rule intact. The ladder is note-window's decision, so this is delivered there rather than amended here. note-model — its Machine tier already stores exactly the two fields this decision needs and no ordinal, and it already holds that an unresolvable home falls back to Space 1 (`note-model.md:728`); nothing there is contradicted.*

---

## Home Identity

### The empty-string Space id is unique — measured 2026-08-30 (resolves review-001 F3)

Two decisions now rest on Space 1's managed-space UUID being the empty string: the placement route accepted *"Space 1 handled through the empty-string value rather than a numeric id"* as a trade-off, and the fallback destination made Space 1 the sole destination for every unresolvable home, which makes `""` the most trafficked value in the design.

Research measured `""` on a topology that could not exhibit its one dangerous failure. The main display's first Space carried the empty UUID; the secondary display had exactly one Space. If a secondary display's first Space *also* got an empty UUID, `""` would name two different Spaces and a note homed on the secondary would resolve onto the main display — silently, in the right position and at the right size, on the wrong Space. Unlike the three probes deferred at the route decision, that failure is invisible, so the affordability argument used there did not reach it.

**Run, on the configuration research said would settle it** — a second Space added to the built-in display, both displays live through the CalDigit dock. Probe source preserved below, because the previous round's probes are no longer on disk.

```
Display 92A6EDE8-8675-40D8-8EAC-9BB53576A226   CurrentSpace sid=12   (15 Spaces)
   ord | sid  | type | SLSSpaceGetType | uuid
     1 |    1 |    0 |               0 | (EMPTY)
     2 |    3 |    0 |               0 | 1F092BD9-0E7C-4FAD-8C40-2F9DC3A73BE3
     …
    15 |   17 |    0 |               0 | 2583B79D-A871-4D25-A18A-567533B4FFAB

Display 37D8832A-2D66-02CA-B9F7-8F30A301B230   CurrentSpace sid=272   (2 Spaces)
   ord | sid  | type | SLSSpaceGetType | uuid
     1 |  272 |    0 |               0 | 19155053-ADEA-40EC-B8C9-1D9E5F1D865D
     2 |  787 |    0 |               0 | 1731A2D9-D182-436E-913D-AD8CB3E7F5EF

Spaces carrying an empty UUID: 1
  92A6EDE8-… ord 1 (sid 1)

SLSSpaceCopyName(cid, 1) -> ""
```

**The collision does not occur.** The built-in display's newly created second Space received a real UUID (`1731A2D9-…`), and its *first* Space kept the real UUID it already had (`19155053-…`). Exactly one Space on the machine carries `""`, and it is the main display's first. So `""` is a usable identity key: a home keyed on the Space UUID covers every Space, including Space 1, provided the empty string is carried as a legitimate value rather than normalised to nil — normalising it strands those notes on whatever Space the user happens to be standing on.

**What this does not settle.** Whether `""` attaches to *sid 1* or to *the first slot of the main display's list* is still undiscriminated — on this machine they are the same Space. The two changes that would separate them are deleting Desktop 1 in Mission Control, and changing which display is main. Neither was run.

**A second confirmation that the numeric id drifts while the UUID does not.** The built-in's original Space reports `ManagedSpaceID 272` carrying UUID `19155053-…` — the same UUID it held when that Space was `sid 19`, before research's undock/redock cycle renumbered it. The renumbering has persisted across the intervening days rather than reverting, so sid instability is not confined to the moment of a display change.

<details>
<summary>Probe source — <code>uuniq.m</code></summary>

```objc
// clang -fobjc-arc -framework Foundation -o uuniq uuniq.m && ./uuniq
#import <Foundation/Foundation.h>
#include <dlfcn.h>

typedef int (*SLSMainConnectionIDFn)(void);
typedef CFArrayRef (*SLSCopyManagedDisplaySpacesFn)(int cid);
typedef int (*SLSSpaceGetTypeFn)(int cid, uint64_t sid);
typedef CFStringRef (*SLSSpaceCopyNameFn)(int cid, uint64_t sid);

int main(void) {
    @autoreleasepool {
        void *sky = dlopen("/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight", RTLD_LAZY);
        if (!sky) { printf("cannot open SkyLight\n"); return 1; }
        SLSMainConnectionIDFn         mainCID  = dlsym(sky, "SLSMainConnectionID");
        SLSCopyManagedDisplaySpacesFn copyMDS  = dlsym(sky, "SLSCopyManagedDisplaySpaces");
        SLSSpaceGetTypeFn             getType  = dlsym(sky, "SLSSpaceGetType");
        SLSSpaceCopyNameFn            copyName = dlsym(sky, "SLSSpaceCopyName");
        if (!mainCID || !copyMDS) return 1;

        int cid = mainCID();
        NSArray *displays = CFBridgingRelease(copyMDS(cid));
        int emptyCount = 0;

        for (NSDictionary *d in displays) {
            NSArray *spaces = d[@"Spaces"];
            printf("Display %s   CurrentSpace sid=%s   (%lu Spaces)\n",
                   [d[@"Display Identifier"] UTF8String],
                   [[d[@"Current Space"][@"ManagedSpaceID"] stringValue] UTF8String],
                   (unsigned long)spaces.count);
            NSUInteger ord = 0;
            for (NSDictionary *s in spaces) {
                ord++;
                uint64_t sid = [s[@"ManagedSpaceID"] unsignedLongLongValue];
                NSString *uuid = s[@"uuid"];
                BOOL isEmpty = (uuid == nil || uuid.length == 0);
                if (isEmpty) emptyCount++;
                printf("   %3lu | %4llu | %4d | %15d | %s\n",
                       (unsigned long)ord, sid, [s[@"type"] intValue],
                       getType ? getType(cid, sid) : -1,
                       isEmpty ? "(EMPTY)" : uuid.UTF8String);
            }
        }
        printf("Spaces carrying an empty UUID: %d\n", emptyCount);
        if (copyName) {
            NSString *n1 = CFBridgingRelease(copyName(cid, 1));
            printf("SLSSpaceCopyName(cid, 1) -> \"%s\"\n", n1 ? n1.UTF8String : "(null)");
        }
    }
    return 0;
}
```

</details>

*Sibling check: note-model — its field-shape rule holds that `home_space` is a string whose empty value is meaningful, `""` meaning Space 1 and absent meaning no home recorded (`note-model.md:789`). This measurement supports that rule rather than moving it: `""` is unambiguous, so the field needs no display qualifier to disambiguate it.*

### When a home is written (resolves review-001 F8)

#### Context

Create-time was covered by discovery: a new fumi homes to the Space it is born on, and `--space N` resolves an ordinal to a UUID at call time and pins it. The update half was never written down anywhere. It surfaced only as an aside in research — *"the user drags it back, which re-homes it correctly under the existing rule"* — naming a rule no document contains.

What made it more than an oversight is that research had already rejected the machinery such a rule appears to need. On whether Fumi should notice a failed restoration and compensate: *"the detector cannot distinguish OS failure from user intent — a discrepancy is equally produced by the user deliberately dragging the note somewhere. Guessing wrong moves a window the user placed on purpose."* If nothing watches, nothing sees the drag.

#### Options Considered

**Record on any observed Space change.** Simple, no timing window.

- Cons: macOS moves windows too, and those moves would rewrite homes nobody asked to change.

**Record only on an explicit command** — `fumi mv --space 7`, Move to Display ▸ — with a drag moving the window and leaving the home alone.

- Pros: nothing to disambiguate; the home changes only when someone says so.
- Cons: the everyday gesture does not stick. Drag a fumi somewhere and it goes back on the next launch.

**Record on observed change, suppressed while the display topology is changing.**

- Pros: drags stick; bulk OS-driven moves do not corrupt homes.
- Cons: relies on a suppression window being wide enough.

#### Journey

**A false path, and the test that killed it: "record when Fumi *handles* the move, never when it merely observes one."** Attractive because it draws the same line research drew when it rejected the detector — act on events you own, never infer intent from state. It is not implementable for the one gesture it exists to support. A drag between Spaces is not handled by Fumi: the user drags the window to a screen edge, WindowServer switches Space and carries the window along. Fumi receives the same signal it receives when macOS migrates a window during a display change. Same observation, opposite intent, and the distinction is invisible from inside the app.

**A scenario used to argue the point, which turned out to be wrong, and the correction narrows the whole finding.** The undock case was put as: macOS migrates fifteen Studio-homed fumis onto the laptop, and re-homing on observation would rewrite all fifteen. That is not what happens. The surviving display inherits the main display's Space list wholesale — same sids, same UUIDs — so those Spaces *become* the laptop's rather than being replaced by it. Every home still resolves and Fumi observes no Space change at all.

What survives is one note. The built-in's own first Space is the only Space macOS genuinely destroys on undock, so a fumi homed there is moved by the OS to somewhere else, and that is the single case where an observed move carries no intent. The bulk-corruption argument is gone; a one-note argument remains.

**What made the suppression window the answer anyway** is that the discriminator is available and cheap. A display appearing or disappearing announces itself (`NSApplicationDidChangeScreenParametersNotification`), so "a topology change is in flight" is a fact Fumi holds rather than infers. That keeps the rule on the right side of the line research drew: the rejected detector compared a window's current Space against its stored home and inferred that something had failed; this reacts to a change as it happens and never re-reads a stored value to judge it.

#### Decision

**A fumi re-homes on drag. Dragging a fumi to another Space records that Space as its home.**

Mechanically: Fumi records a new home on an observed Space change, except while a display topology change is in flight, where the change is macOS's and the stored home is left untouched.

Deciding factor: *wherever the user puts a note is its new home* is the behaviour the product already promises, and a drag is the ordinary way a user puts a note somewhere. A rule that required a command for the common gesture would make the promise false in the case it is most often tested.

Trade-off accepted: the suppression window is a timing judgement rather than a guarantee. Getting it wrong rewrites the home of a fumi that lived on a disconnected display's first Space — one note, recoverable by dragging it back.

**Why deleting a Space is not suppressed** *(2026-09-01, resolves review-002 F8)*. Deleting a Space in Mission Control also moves windows without the user having moved those windows, and it announces nothing analogous to `NSApplicationDidChangeScreenParametersNotification`, so the suppression above does not cover it. That is correct rather than an omission, and the discriminator is reversibility.

A display change is reversible: undock and the Spaces migrate, redock and they return carrying the same UUIDs — measured. Suppressing there protects an arrangement that is coming back. Deleting a Space is permanent. The Space is gone the moment it is confirmed, the home is dead, and where macOS put the window is the only place the note actually is. Suppressing would leave fumis visibly sitting on one Space while the record insisted they lived on a Space that no longer exists, and they would jump elsewhere at the next launch.

The deletion is also **a user action** — the user removed the Space, and where their notes ended up is the consequence of something they did, not the OS overriding an intent they hold. So recording the new home is the same rule the drag case follows, not an exception to it.

**Unmeasured:** that macOS relocates the windows of a deleted Space to a neighbouring Space, rather than closing, hiding or stranding them. Nothing in the research exercised it; the rule above assumes relocation. Testable in a minute — a window on a scratch Space, delete the Space, read back where it landed.

*Sibling check: note-window — its Positioning decision holds that a preset does not capture a Space and that wherever the user puts a note is its new home, and its ladder holds that resolution never rewrites intent. This decides when a **user action** writes intent, which neither document covered; the resolution-never-writes rule is untouched and is what keeps the two separable. note-model — `home_space` is Machine-tier state, so a re-home is an ordinary Machine-tier write and needs no new field.*

### Ordinal addressing is a human affordance; agents address by UUID (review-001 F9)

A macOS setting absent from the brief, the research and this document until now: **Mission Control → "Automatically rearrange Spaces based on most recent use"**, which is on by default and continuously reorders a user's Spaces by recency. Under it, `--space 3` names whatever Space was third-most-recently used at the instant of the call — unpredictable rather than merely position-dependent, which is a different problem from the ones already recorded against ordinals.

`defaults read com.apple.dock mru-spaces` → `0` on this machine, so the setting is off here and no measurement taken so far could have exposed it.

**The framing that resolves it, from the user:** the ordinal is correct *because a human types it while looking at their Spaces*. At that moment they know which one is third, whatever reordered it since. An agent has no such moment — so an agent either resolves a UUID first or passes one directly, and never counts.

That keeps discovery's decision intact (the ordinal resolves at call time and is never stored) and adds the missing half: the ordinal is a convenience for the human at the keyboard, not the addressing model. Notes are already addressed by UID rather than list position throughout the product for the same reason.

The consequences for the CLI and MCP grammar are **agent-surface's**, where a related concern (`009-space-ordinals-not-machine-unique`) already sits covering per-display ambiguity and fullscreen ordinal slots. Delivered there rather than settled here; this topic's resolver implements whatever grammar that topic lands on.

### What a home stores

#### Decision

**Settled by derivation** — not discussed. Determined by the fallback-destination decision, which dropped the ordinal rung, together with note-model's Machine tier, which already stores window coordinates, home display and home-Space UUID and no positional index.

**A home is display identity plus the Space UUID. Nothing positional is stored.**

The home record therefore needs no field the note record does not already carry, and nothing in it can be invalidated by a Space reorder or a dock cycle — the two events measured to move numbers while leaving UUIDs intact. The empty string is a legitimate value of the Space half, meaning Space 1; absent means no home recorded, which is a different state.


---

## Launch Sequencing

### The readiness signal is the pre-flight check, not a new mechanism (resolves review-001 F7)

#### Context

`engine-architecture` decided its restart-and-restore behaviour around a hole it assigned here, and shipped a rule that depends on the answer:

> *"Restoration waits a bounded interval for readiness. On timeout it restores anyway — geometry and window state first — and re-attempts home-Space placement as the space list becomes plausible."*

with the gap named outright: *"Not decided here: the readiness signal itself. Polling CGS until the space list looks plausible, watching for the Dock, or some notification — which is canonical is exactly what space-homing's brief flags as the hard part… Dependency: space-homing owes the readiness signal."* It also fixed a constraint the answer must respect: a fallback taken on timeout is never written back as intent.

The debt was live and unacknowledged — this topic's Context recorded research's finding (*"a sequencing rule, not a race … no wait-for-WindowServer machinery"*) without noticing that a sibling had already built a bounded wait on the assumption that a signal would arrive.

#### Journey

**Research's answer reads at first like a deletion rather than an answer.** Chromium has no readiness machinery at all: no wait-for-WindowServer signal, no polling for Space existence, no retry loop, no off-screen staging. It sequences instead — apply state while the window is ordered out, then show it non-activating. On that reading, engine-architecture's bounded interval, timeout and re-attempt loop are apparatus for a problem that does not exist.

**The reason it cannot simply be deleted** is the measurement base. Every placement result in this topic was taken in a warm session — a desktop in use for hours, all Spaces long since materialised, windows created by hand from a terminal. Fumi's primary launch is an `LSUIElement` app started by a login item while macOS is still bringing the session up. If Spaces materialise lazily at login, placement onto a not-yet-existing Space is a silent no-op, every fumi piles onto the launch Space, and nothing reports an error — on every login, in the one situation the feature exists for. That test was parked deliberately (it costs a reboot) and remains unrun.

**The resolution: the signal is already a required computation.** Every placement must run a pre-flight existence check — `SLSSpaceGetType(cid, sid)` against a freshly enumerated list — because both routes silently no-op on a destination that no longer exists, and a sid may never be cached across a display change. Run that check across the homes a restore is about to place and the result *is* readiness:

```
enumerate Spaces
  ├─ every home this restore needs is present  → ready. Place.
  └─ some are missing                          → not ready. Wait, re-check.
                                                  (bounded; then place anyway)
```

No Dock-watching, no notification archaeology, no additional private surface. It also does not answer readiness in the abstract — it answers the only form of the question that matters, which is whether *these* Spaces can be placed on right now.

**A by-product worth stating: the parked reboot test stops being load-bearing.** If Spaces materialise lazily the check waits for them; if they are all present immediately it passes on the first pass. The same code is correct either way, so the design no longer depends on knowing which is true.

**A collision found by review, and the correction it forced.** The predicate was first written over the *homes* — ready when every home Space this restore needs enumerates. That conflates two questions the design answers differently. A user who deletes a Space while Fumi is closed, then reopens it, has one or more homes that will never enumerate again; under the home-based predicate every launch on that machine fails the check on every pass, pays the full bounded wait, and then places anyway — forever, for a condition the fallback already handles in one step.

```
launch
  homes needed:  [A ok] [B ok] [C deleted last week] [D ok]
  every home present?  no
  -> wait... re-check... wait... re-check...  (full bound, every launch)
  -> timeout -> place anyway -> C lands on Space 1
```

The user's framing settled it: closing Fumi, deleting some Spaces and reopening later is *run-of-the-mill*, not an unusual circumstance — the fumis that lived there land on Space 1 as agreed, everything else opens where it belongs, and nothing about it should be slow or exceptional. A permanently dead home is a steady state, not a condition to wait out.

It also punctured the by-product claimed above: *the same code is correct either way* holds for the transient case only. For the permanent case the home-based predicate waits the full bound on every login and learns nothing.

#### Decision

**Readiness is a property of the Space list, not of the homes. Restoration waits until the enumerated Space list stops growing, then places. A home that resolves gets its Space; a home that does not takes the fallback immediately, because there was never anything to wait for.**

The enumeration is the same call the pre-flight check already owes, so the cheap part of the original answer survives. What is dropped is the part that asked the wrong question — "are all my homes here?" cannot distinguish *not yet* from *never*, and only the first is a reason to wait.

Deciding factor: the wait exists for one condition only — Spaces materialising lazily during login — and that condition is visible in the Space list itself. A dead home is not that condition and must not be treated as it.

Trade-off accepted: this is a poll, where `engine-architecture` was hoping for a signal. Both the interval and the settling bound are numbers chosen rather than derived. "The list stopped growing" is also a weaker signal than "the list is complete" — nothing distinguishes a settled list from a slow one except time.

### What the timeout places, stays placed *(2026-09-01, resolves review-002 F3)*

`engine-architecture`'s rule has an *after* half this topic had not answered: *"On timeout it restores anyway — geometry and window state first — and **re-attempts home-Space placement as the space list becomes plausible**."* Read against Placement Verification's *"No retry, no re-placement, no correction of any kind"*, the two documents together give a specification both a re-attempt loop and a prohibition on re-placement, with nothing saying which governs.

> **No re-attempt. What the timeout places stays placed until the next launch.**

The reason is the line the whole design already draws at the show step. Before a window is shown, placement is free — the destination is latched while the window is invisible and nothing the user can see moves. After the show, moving a window is an act, and the only actor entitled to it is the person looking at the screen. A re-attempt is a live move of a visible window, which is the detector research rejected, and the re-home decision makes it worse than a stylistic inconsistency: a fumi dragged in the seconds after launch has already recorded a new home, so a re-attempt would be overriding a choice the user just made.

The timeout is a bound, not a mechanism to design around. Under the settling predicate the wait is for the Space list rather than for individual homes, and Spaces are a low-level OS construct that exists early in a session — so the expected case settles on the first pass and the timeout never fires.

Cost accepted, and it is real: a login pathological enough to hit the bound leaves some fumis on the fallback Space until the user quits and reopens.

This makes `engine-architecture`'s re-attempt clause wrong rather than underspecified, so a correction is delivered there rather than recorded only here.



*Sibling check: engine-architecture — its restart-and-restore decision holds that restoration fires once at the first session-ready moment, waits a bounded interval and restores anyway on timeout, re-attempts home-Space placement as the space list becomes plausible, never activates a Space, and never writes a timeout fallback back as intent. This answer fits that shape rather than moving it — "as the space list becomes plausible" is the check described in other words — and is delivered there so the topic can close its stated dependency.*

### The show step is always non-activating

#### Decision

**Settled by derivation** — not discussed. Determined by the measured latch-then-show behaviour on both routes, and by Chromium's stated reason for avoiding `orderFront:` during restore.

**Placement state is applied while the window is ordered out; the window is then shown without being activated.**

There is no flash because there is no visible window to flash — the destination is latched before the window exists on screen. Measured on both routes: immediately after applying state and before order-in the window still reports `isOnActiveSpace = 1`, and after order-in it reports `0`; on the SkyLight route a move issued before the first `orderFront:` materialised the window directly on the target Space.

The activating variant is what makes this a rule rather than an implementation note. Activating a window during restore can pull the user to that window's Space — Chromium avoids `orderFront:` explicitly for this, and downgrades its own show to `kShowInactive` while a session restore is underway. The stake is higher here than for a browser: a fumi that drags the user to Space 11 at login inverts the quiet-furniture intent the whole feature exists to serve.


### Fumi's windows opt out of macOS's own restoration

#### Decision

**Settled by derivation** — not discussed. Determined by the route decision's finding that `restorable` governs AppKit's *automatic* save and restore, not whether a hand-driven `restoreStateWithCoder:` works.

**Fumi's note windows set `restorable = NO`, so macOS never places them. Fumi is the only placer.**

At a system restart macOS restores windows to their Spaces natively — the one launch case it handles itself — which would otherwise place Fumi's windows from saved application state at the same moment Fumi places them from its own store. Two systems, each believing it owns the answer.

The flag removes Fumi from that mechanism without costing the placement route anything: the window-shape measurements included a borderless, floating, `restorable = NO` window and its blob was still readable and its placement still worked, because `encodeRestorableStateWithCoder:` and `restoreStateWithCoder:` are ordinary calls that work when invoked directly. What the flag suppresses is macOS deciding to invoke them.


---

## Placement Verification

### Context

The route decision chose AppKit partly *because* its failure is quiet: `NSClassFromString` returns nil, the hook vends nothing, restore runs, and every fumi opens on the active Space with no crash and no error. ~~The private-API isolation decision then made a local preference the emergency-off, reachable *"via a one-line support instruction"*.~~ *(Amended 2026-08-30, review-002 F1 — the kill switch was rejected the same day this was written; the Decision below carries that amendment and this Context did not.)*

That choice presumes someone finds out. Nothing in the design made that happen. The pre-flight existence check covers exactly one cause — a destination that no longer exists — and passes cleanly in the case that matters here, because every Space did exist; what failed was the mechanism for reaching them.

```
Space deleted since the home was recorded
   pre-flight catches it → Space 1 → handled

Apple removes the hook in a future macOS
   hook vends nothing, restore runs, no error, no crash, no log
   every fumi opens on the launch Space
   ← pre-flight passed. Nothing was wrong to check.
```

### Journey

The gap is one call wide. Reading a window's Space needs no private API and `space(of:)` already exists in the `SpacePlacement` layer, so placement can verify itself: place, show, read back, compare.

**What to do with a mismatch is where the obvious answers fail.** Retrying is pointless — nothing about a second attempt differs from the first when the hook is gone. Re-placing is worse: that is the detector research rejected, which cannot distinguish OS failure from a window the user deliberately moved, and whose failure mode is dragging a note off a Space someone just chose.

**So the verification's value is diagnostic, not corrective, and the signal is in the aggregate.** One window landing wrong is noise — a Space can be destroyed microseconds after the pre-flight passes. Every window landing on the active Space is a diagnosis, and it is the precise signature of the placement mechanism having gone away.

### Decision

**`SpacePlacement` verifies placement after the fact — read the window's landed Space and compare against the target — and treats a whole-set mismatch as the signal that the placement route is not working on this OS. It is logged and never surfaced in the app.**

**The predicate splits by path, not by count** *(2026-09-01, resolves review-002 F4 in part)*. A whole-set mismatch has no reading at one window, and the two placement paths differ in whether a single miss means anything:

| Path | Predicate | On mismatch |
|---|---|---|
| Restore burst | Aggregate — one window off is noise (a Space can die microseconds after the pre-flight); all of them off is a diagnosis | Logged, nothing surfaced |
| Explicit target (`fumi new --space 7`, `fumi mv --space 7`) | Per-window — the caller named a Space and the window is not on it | Loud error to the caller |

Nothing is ambiguous in the second row, which is why it does not need the aggregate. It is the same asymmetry the create-time rule already draws: an instruction has someone waiting for an answer, a restore does not.

No retry, no re-placement, no correction of any kind. *(Amended 2026-08-30, review-001 F6 — this originally continued "the record is what makes the emergency-off reachable", which no longer applies: the kill switch was dropped the same day. The log's value is unchanged and simpler — it turns "Space homing stopped working" from something a user reports as a feeling into something diagnosable.)*

Deciding factor for logging rather than notifying: this is quiet-furniture software, and a notice that fires on a broken OS release is exactly the kind of thing that ends up firing for the wrong reason. A wrong Space is visible on its own — the user can see where their fumis are — so the record exists for the post-mortem, not to tell someone what they are already looking at.

Trade-off accepted: a user whose Space homing has silently stopped working learns it by noticing, not by being told. The log turns "it stopped working" into a diagnosable report rather than preventing the experience.

*Sibling check: engine-architecture — its Observability decision holds that the reader decides the surface: state a person reads live is exposed to the management window in-process, everything read after the fact goes to the system log, and there is no health subsystem and no status operation. This lands in the after-the-fact half and adds no surface of its own.*

---

## Fullscreen Spaces

### Context

A fullscreen Space is created when an app enters fullscreen and destroyed when it leaves — unlike user Spaces, which persist. Research measured that an ordinary floating window *can* be placed on one and genuinely renders there (`requested sid=391 -> landed on (391)`, `isOnActiveSpace=0`, confirmed visually over fullscreen Safari). That settles birth: a fumi created from the global hotkey while an app is fullscreen appears where the user is looking, which is what "the currently active Space" plainly means to them.

What birth does not settle is homing. A fumi homed to a fullscreen Space has a home with a shorter life than the note.

### Options Considered

- **Homes to the fullscreen Space.** Consistent with the existing rule; the home dangles as soon as the user exits fullscreen.
- **Homes to the underlying user Space.** Tidier; Fumi invents a home the user never chose, and the underlying Space may not be recoverable.
- **No home recorded until placed somewhere durable.** `home_space` absent is already legal and distinct from `""`; adds a state to reason about.

### Decision

**A fumi born on a fullscreen Space homes to that fullscreen Space, like any other.**

No special case. When the user exits fullscreen the Space is destroyed, the home stops resolving, and the note opens on Space 1 at the next launch — which is precisely what the fallback exists for. The alternatives buy tidiness for one Space type and spend the rule that has held everywhere else: *wherever the user puts a note is its new home*.

Trade-off accepted: a fumi created over a fullscreen app quietly relocates to Space 1 on the next launch, with nothing having gone wrong.

### The existence oracle admits fullscreen Spaces *(2026-09-01, resolves review-002 F5)*

The decision above collided with the gate every placement runs. The pre-flight was written as `SLSSpaceGetType(cid, sid) == 0`, and a fullscreen Space measures type **4** — so the oracle rejected by definition the destination this decision calls a valid home.

```
type 0   user Space         placeable, durable
type 2   system Space       never a destination
type 4   fullscreen Space   placeable, ephemeral   <- was excluded
```

The `== 0` form was inherited from research's own line — *"type 0 means a real user Space; nothing else does"* — measured on a sample containing no fullscreen Space. It is a true statement about which Spaces are **durable**, borrowed as a statement about which are **placeable**, and those are different questions. Placement onto a fullscreen Space was separately measured working and visually confirmed, so the strict form was excluding a destination already proven usable.

Only one path is affected. At restore, a fullscreen home has almost certainly ceased to exist, the oracle rejects it whichever form it takes, and the fallback fires — unchanged. At **live create** the Space does exist and the user is looking at it, and the strict form refused the one case the fullscreen decision exists to serve.

> **The pre-flight asks whether the destination exists and is placeable: `SLSSpaceGetType(cid, sid)` of 0 or 4. Type 2 stays excluded.**

Trade-off accepted: the looser predicate is less strict against a private API whose return values could change. It buys the live-create case; nothing measurable was being bought by the stricter form.

*Sibling check: note-window — its Positioning decision (a new fumi is born on the currently active Space of the pointer's display) is unchanged and now has a defined behaviour in the case its own implementation checkpoint flagged as unanswerable. That correction was already delivered to it as `002-floating-window-can-join-fullscreen-space`; this adds only the homing consequence, which follows from that topic's own rule rather than amending it.*

---

## Create Time Placement

### An unresolvable `--space` target at create time is a loud error

#### Decision

**Settled by derivation** — not discussed. Determined by the asymmetry the record already draws between an instruction and a historical fact.

**`fumi new --space 7` where no Space 7 resolves returns an error the caller sees. It does not fall back.**

This is the mirror of the launch-restore rule, and the two only look contradictory:

| Situation | Behaviour | Why |
|---|---|---|
| Launch-restore: a note's remembered home Space no longer exists | Silent fallback to Space 1 | A historical fact went stale. Nobody is waiting on an answer; the note has to go somewhere predictable. |
| Create-time: an explicit `--space N` does not resolve | Loud error | A caller gave an instruction that cannot be honoured, and there is someone — or some agent — to tell. |

### Placing a fumi on a Space you are not on never switches you to it

#### Decision

**Settled by derivation** — not discussed. Determined by engine-architecture's decided rule that restoration never activates a Space, and by the quiet-furniture intent governing the whole feature.

**Placement on a non-current Space that exists is silent. No Space switch, no window in front of you.**

The fumi is sitting there when you next visit that Space. This holds for the launch burst and for a live `fumi new --space 7` alike — correct Space, no attention demanded. It is the same property that makes the non-activating show step mandatory: a fumi that drags you to Space 11 at login inverts the feature's intent, and one that drags you there mid-afternoon because an agent created a note is worse.

### One placement path for both create paths and the launch burst

#### Decision

**Settled by derivation** — not discussed. Determined by the pre-flight existence check being required before every placement regardless, the same derivation that made it the readiness signal.

**Creating on the current Space, creating on another Space, and restoring at launch are one code path, gated on the existence check.**

They differ only in what the check answers. Creating where the user already is makes it instant and affirmative — there is nothing to move, the window is born where you are. Creating elsewhere resolves the target first. The launch burst runs the same check across every home it is about to place on, which is what readiness means. There is no separate live-create path to keep in step with the restore path.

**The one create-time behaviour still unmeasured on the chosen route** *(2026-09-01, review-002 F4)*: creating a window directly onto a *non-current* Space was measured on SkyLight and never on AppKit — deferred probe 3 from the route decision. It is not a corner case; it is what `fumi new --space 7` promises, and what `agent-surface` carries as silent create on other Spaces.

Its failure shape is what made deferring it uncomfortable. Unlike the launch burst, which fails unmissably, this one lands the note on the Space the caller is already standing on and returns success — the silent no-op wearing a success message. The per-window verification predicate (see Placement Verification) removes that: a targeted create that lands elsewhere is a definite mismatch reported to the caller, so the unmeasured capability now fails loudly by construction rather than by luck. That is what makes carrying it into implementation affordable rather than merely cheap.


---

## OS Range And Degradation

### Context

*From: platform-support · discussion · 2026-09-11*

`platform-support` settled the supported range at macOS 15.0 and later, open-ended, and sent back the one thread it judged design-shaping rather than support policy: how Fumi notices for itself that the placement surface stopped working. Every mechanism that question reaches for is already decided here: the `SpacePlacement` layer and its single driver seam, and place / show / read back / compare.

The residue it brought: this topic's degradation decision below describes the hook failing to resolve, and that cannot happen anywhere in the supported range. The private `NSWindowRestorationOptions` class exists from macOS 15 onward — that is why the floor moved there. So a capability check written as *is the class present* answers yes on every supported machine, and a reader reaching for it as **the** capability check has covered a future OS while learning nothing about the versions nobody has run. `platform-support` offered AltTab as the reference implementation: `#available` for the public class, then member presence on the private selector (`class_getInstanceMethod(…, NSSelectorFromString("set_variant:")) != nil`), computed once and lazily — with the OS triple logged when the member is absent, as a diagnostic and never a gate.

Withdrawn there and recorded so it is not re-raised: a suggestion that restoration could stop partway on macOS 15, returning some fumis and not others. It cannot — `restorable = NO` and Fumi drives restoration itself, synthesising an archive per window rather than replaying a captured blob, so there is no OS-driven transaction to fail halfway.

### What a broken placement surface looks like to a user

#### Decision

**Settled by derivation** — not discussed. Determined by the route's chosen failure shape, the verification decision (logged, never surfaced) and the rejection of a kill switch, which together leave exactly one degraded behaviour.

**On an OS where the placement hook does not resolve, Space homing degrades to fumis opening on the current Space. No crash, no retry, no user-facing notice. The post-placement verification records it and the fix ships in an update.**

This is the failure the route was chosen for rather than a failure it suffers: `NSClassFromString` returns nil, the hook vends nothing, restoration runs and windows open where the user is standing. Notes, positions, sizes and recorded homes are all intact — only the placement is lost, and it returns when the update lands, because resolution never rewrote intent in the meantime.

Nothing is offered to the user in the moment because nothing useful exists to offer: there is no second driver to fall back to, no switch that would produce a different outcome, and the wrong Spaces are visible without being told about.


### When a SkyLight *read* symbol is the one that goes *(2026-09-01, resolves review-002 F7)*

The route decision's reframe established that Fumi links SkyLight on either route — the reads are shared, only the write varies — and its failure-shape factor then reasoned entirely about the write. Nothing said what happens if a read symbol stops resolving, and three decided mechanisms depend on two of them:

```
SLSCopyManagedDisplaySpaces -> NULL      SLSSpaceGetType -> NULL

   pre-flight existence check      cannot run
   readiness (list settling)       cannot run
   --space N ordinal resolution    cannot run
```

These carry the same exposure problem counted *against* SkyLight for placement — zero shipping apps in the `/Applications` scan depend on them — and ~~`CGSAddWindowToSpace` vanishing is~~ **`SLSSetSpaceOwner`'s absence is** the worked precedent. *(Amended 2026-09-11 — the CGS exhibit is withdrawn; see Placement Route. The precedent is replaced rather than dropped: `SLSSetSpaceOwner` is genuinely gone — `dyld_info -exports /System/Library/PrivateFrameworks/SkyLight.framework/SkyLight | grep -c SLSSetSpaceOwner` → `0` on macOS 26.6.2, and `platform-support` confirmed it by walking SkyLight's retained `LC_SYMTAB` rather than by `dlsym` alone, so it is absent rather than merely internal. The clause needed only that the SLS namespace does lose symbols, and that still holds.)* The route section conceded that null-guard discipline is owed on both routes regardless; it named the discipline and not the behaviour behind it, which is what a specification needs.

#### Decision

**No enumeration, no placement.** Restoration proceeds with geometry and window state, every fumi opens on the launch Space, and the verification records it. This is the same degraded state as a broken placement hook, reached by a different door — no new machinery, and the log already exists.

**An explicit `--space N` fails loudly**, as it does for any target that cannot be resolved. A caller is waiting for an answer, and "I could not determine what Space 3 is" is an accurate one; silently creating on the current Space would answer a question the caller did not ask.

**Rejected: place anyway, unchecked.** Worse than doing nothing. Placing without the pre-flight is the silent no-op trap — an unresolvable destination reports success and the window stays on the active Space — so the visible outcome is identical while the ability to know it happened has been thrown away.

**Rejected: treat every home as unresolvable and send the library to the fallback.** It stacks every fumi on one Space per display, where leaving them where they open is no harder and looks less like something went badly wrong.


### There is no capability gate on the write side *(2026-09-11)*

#### Journey

The concern's framing invited a finer check — AltTab's member presence rather than class presence — and the finer check turns out to serve nothing, for two separate reasons.

**It cannot see the failure it was proposed for.** Member presence answers *is the selector still there*. The span risk is not a missing selector: it is `NSWindowWorkspaceID` meaning something else inside the blob, the synthesised two-key archive not being accepted, `""` not resolving to Space 1 on 15. Every one of those passes a member check and lands the window silently wrong. There is no capability check at any granularity that sees them — the read-back comparison is the only thing that does, and Placement Verification already decided it.

**And the span it would serve is not a constraint on this build.** The build target is macOS 26 and the floor is 15+, with backwards compatibility deferred until after the thing is built (user's call, 2026-09-11). So on the build target a class-presence check is *supposed* to answer yes; 15 is a verification owed later, not a case to detect now.

What that leaves is the question the concern did not ask: what would a write-side capability check gate? Nothing branches on the answer. There is no kill switch, no second driver, and exactly one degraded behaviour. If the class is gone the code runs anyway, `NSClassFromString` hands back nil, the hook vends nothing, and verification records the whole-set miss.

#### Decision

**No capability gate on the write side. Fumi attempts placement, verifies by read-back, and logs. The `NSClassFromString` guard exists so nothing crashes, not so something branches.**

The read side keeps the gate it already has — *no enumeration, no placement* — and the asymmetry is what justifies the difference: a missing read symbol removes the ability to **know** (the pre-flight cannot run, and placing without it is the silent no-op trap), while a missing write hook removes the ability to **act**, which is the decided degradation rather than a condition to detect.

What is borrowed from AltTab is the diagnostic half, not the gate: when a guard does trip, the log names the missing symbol alongside the OS triple, so the post-mortem reads *the hook went on 27.1* rather than *placement stopped*.

Deciding factor: nothing branches on the answer. A gate is only worth having where it selects between behaviours, and the rejection of a kill switch and of a second driver left exactly one.

Trade-off accepted: on an OS where the hook is gone, every launch runs the full placement path and every placement fails, and nothing short-circuits it. The cost is a read-back per window on a machine where the feature is already not working.

Confidence: high on the write side, which follows from decisions already made. Medium on the diagnostic detail — what a useful log line carries is worth revisiting once there is something to read it against.

*Sibling check: platform-support — its research holds the range as 15 and 26 and carries the open item "what a user on the oldest supported version actually gets — nothing has run on 15"; this answers the mechanism question it routed here and leaves that item standing. build-and-release — the floor (queue entry `009`) and the build-target ordering (entry `013`) are both queued there and neither is decided here; this decision cites the ordering rather than setting it.*

### The OS span is unverified, and that is the fourth risk *(2026-09-01, resolves review-002 F10)*

Every measurement in this topic was taken on macOS 26.5.2 build 25F84, arm64, two displays. The supported range is now 15+, so the span 15–25 is unexercised for every mechanism the design rests on:

```
macOS 15  16  ...  25  26.5.2   <- every measurement lives here
          |______________|
   _windowRestorationOptions (the hook name itself)
   NSWindowWorkspaceID inside the restorable-state blob
   the synthesised two-key archive
   the empty-string Space-1 identity
   SLSCopyManagedDisplaySpaces / SLSSpaceGetType
```

yabai is the counter-pattern worth respecting rather than dismissing: it version-tiers its own handling across 12.7, 13.6, 14.5 and 15, which is what a project that actually exercised a range ended up needing.

This differs in kind from the three deferred probes. Those are capabilities, each with a loud failure, testable on this machine. The span is not testable here at all — it needs virtual machines or old hardware — and it is a property of the range rather than of a behaviour.

**What bounds it.** The degradation is already decided: on an OS where the hook does not resolve, homing degrades to fumis opening on the current Space, logged, nothing else affected. So an unverified span risks *the feature on an old OS*, never the product on it. That is what makes carrying it a listed risk rather than a blocker.

**Not this topic's to price.** How much verification a supported range earns, and what a user on the oldest supported version is promised, is the product-facing matrix — `platform-support`'s, ~~which has not run~~. Recorded here as the input that topic will need. *(Amended 2026-09-11 — `platform-support` has since run and set the range at macOS 15.0 and later, open-ended, with verification on 15 deferred to a release-candidate check before shipping. Its open item — what a user on the oldest supported version actually gets — is unchanged. What bounds the span here is narrower than this block assumed: the build target is macOS 26 and backwards compatibility is deferred until after the thing is built, so 15–25 is a verification owed later rather than an unexercised span the design must currently absorb. The risk is unchanged in kind; its timing is decided.)*

---

## Summary

### Key Insights

1. **The route choice was not a choice of framework.** Both routes need SkyLight for reading — enumerating Spaces and the type check — so only the *write* varies. That reframe shrank the decision from "which stack" to "one method behind a driver", and cost the failure-shape argument some of its force, since the null-guard discipline charged to SkyLight is owed either way.
2. **Ecosystem breadth is a stability signal, and it is not the same as independence.** Ten shipping apps carry the AppKit hook, which reads as protection until you notice all ten are builds of one upstream codebase that arrived there recently, as a workaround for Apple breaking the previous mechanism. The factor survived; its weight did not.
3. **A record can contradict itself in the same sentence.** The research file's closing tally read *"failure shape → SkyLight"* while its own parenthetical described AppKit degrading quietly. The direction of the whole decision hung on which half was right.
4. **The disabled state and the broken state were the same state.** The kill switch died on that observation the day it was proposed — a switch producing "opens on the current Space" rescues nobody from a failure whose symptom is opening on the current Space. It would have earned its place on the route we did not take.
5. **Reversibility is the discriminator for whether an OS-driven move writes intent.** Undock and redock returns the Spaces with their UUIDs, so suppressing is protecting an arrangement that is coming back. Deleting a Space is permanent and is itself a user action, so where macOS puts the window is the only place the note is — and recording it is the same rule a drag follows, not an exception to it.
6. **Asking whether *these* Spaces are placeable is a better question than asking whether the session is ready.** The readiness signal turned out to be a call the design already owed. But the first form asked it over the *homes*, which cannot distinguish "not yet" from "never" — a home dead since last week failed on every pass and bought a full timeout at every launch, forever. Readiness is a property of the Space list, not of the homes.
7. **A predicate borrowed from one question quietly answers another.** `SLSSpaceGetType == 0` was a true statement about which Spaces are *durable*, reused as a statement about which are *placeable*, and it excluded fullscreen Spaces that had been measured working. Type 0 and type 4 are both placeable; only one of them lasts.
8. **A destination named on one axis is under-specified when the design has two.** "Space 1" was machine-wide in a design where every display owns its own Space list — so for a note on a secondary display the Space half and the display half of the same rule named different screens. What made Space 1 right was predictability, never that particular Space, and the display-qualified form keeps it.
9. **Verification's predicate follows the path, not the count.** A single miss in a restore burst is noise; a single miss against an explicit `--space 7` is a definite failure with a caller waiting. The same asymmetry that makes create-time errors loud and restore-time fallbacks silent.
10. **A capability check only sees failures shaped like a missing symbol.** Asking for a finer one — member presence rather than class presence — sounds like more rigour and buys nothing against a blob key that changed meaning or an identifier that stopped resolving. Those are seen by the read-back or not at all. And once the design has no kill switch and no second driver, the check gates nothing anyway: the guard is there so nothing crashes, not so something branches.
11. **A loud failure is what makes a deferred measurement affordable.** Three probes were carried into implementation on that basis. The one that did not qualify — the empty-string collision, which fails invisibly — was the one worth running, and it took one probe to close.

### Open Threads

- **Three capabilities unmeasured on the chosen route**, each failing loudly and carried into implementation: `restorable = NO` composing with a hand-driven restore; the N-window launch burst on AppKit (measured only on SkyLight); and live create onto a non-current Space on AppKit. The last is de-risked by the per-window verification predicate rather than by measurement.
- **The OS span 15–25 is unexercised.** Every measurement in this topic was taken on macOS 26.5.2. Bounded by the decided degradation — the feature stops, the app does not — and the supported-range matrix belongs to `platform-support`. *(Amended 2026-09-11 — `platform-support` has run and set the range at 15.0+, open-ended. With the build target at macOS 26 and backwards compatibility deferred until after the thing is built, the span is a verification owed before shipping rather than an open question shaping the design. The symbol-table re-measurements added this session ran on 26.6.2 build 25G83, the machine having taken a point update; everything else here is 26.5.2.)*
- **The cold-login path was never tested** (it costs a reboot). Under the settling predicate the same code is correct whether Spaces materialise lazily or all at once.
- **Whether macOS relocates the windows of a deleted Space to a neighbouring Space** is assumed rather than measured; the re-home rule depends on it.
- **What the empty-string Space id attaches to** — `sid 1`, or the first slot of the main display's list — is undiscriminated, since on the measured machine they are the same Space.
- **Delivered to siblings, awaiting their own sessions:** the ladder losing its ordinal rung and the display-qualified fallback (`note-window`); the readiness answer and the re-attempt clause (`engine-architecture`); Space addressing for agents (`agent-surface`); the macOS 15+ floor (`build-and-release`).

### Current State

- **Resolved** — the placement route and the layer that contains it; what a home stores and when it is written; where a note goes when its home does not resolve; how launch sequencing establishes readiness and what happens on timeout; create-time placement and its error semantics; fullscreen Spaces as legitimate homes; how a broken placement or read surface degrades, and that the write side takes no capability gate.
- **Uncertain** — the four unmeasured items above, all bounded by degradations that are decided rather than open.
