# Research: Space Homing

Notes remember their macOS Space and return to it across relaunch via the private CGS/SkyLight APIs; deleted-Space falls back to Space 1; Chromium/yabai reference implementations, launch-time sequencing/timing, and multi-display.

## Starting Point

What we know so far:
- The signature quiet mechanic: a fumi remembers its home macOS Space by the stable managed-space UUID and returns there on relaunch.
- Requires the private CGS/SkyLight APIs, so distribution goes off the App Store; the hard part is launch-time sequencing and timing, not the API call.
- A deleted or absent home Space falls back to Space 1.
- Reference implementations to study: Chromium, Spaceman, yabai.

---

### Restore semantics: eager, not lazy

The bar is **eager placement** — at launch, every fumi is materialised on its home Space *before* the user goes there. Not "it appears when you swipe over."

The user's acceptance test is Mission Control (three-finger swipe down) immediately after launch: every fumi is visible on its own Space, in the right position and at the right size. Swiping to a Space and watching a window arrive is a fail.

Concretely, from the user's Chrome observation:

- Launch Chrome while sitting on Space 1, pick a profile. If no Chrome window's home is Space 1, **nothing appears on Space 1** — the app launches and the current Space stays empty.
- Swipe to Space 2 (a window's home) and it is *already there* — not animating in on arrival.
- Exposé confirms the whole set is placed across all Spaces at once.

Scale this has to hold at: the user runs 15–16 Spaces, one per project/business/topic, and uses effectively all of them. Chrome's *old* behaviour — dumping every window onto Space 1 on relaunch, forcing a manual drag-per-window while trying to remember which Space was which — is the exact anti-pattern (and the reason the user runs Spaceman for labels).

Consequences to carry:

- No lazy/on-visit placement strategy satisfies this. The launch path must place N windows across N Spaces in one go.
- Restore covers position and size too, not just Space membership.
- The visible-flash risk named in the brief is sharpened: the *correct* observed behaviour is that a window whose home is elsewhere never renders on the launch Space at all.

### Open fork — which mechanism actually places Chrome's windows? *(raised 2026-08-23, unresolved)*

*(Resolved later the same day — see **Fork resolved — 2026-08-23** below. The heading's "unresolved" is preserved as written; the question below is superseded, not the framing.)*

Discovery assumed Chrome records managed-space UUIDs and re-places windows via the private CGS Spaces APIs, and derived the off-App-Store distribution decision from needing the same. Worth testing before it hardens, because there is a second hypothesis:

- **(a) Explicit private-API placement** — the app persists a per-window managed-space UUID and calls `CGSAddWindowToSpace` (or equivalent) at launch. Requires private APIs.
- **(b) System window restoration** — the WindowServer already persists window→Space association (`com.apple.spaces` holds per-Space state), and an app that adopts Cocoa state restoration gets Space membership restored by the OS. Would require **no** private API for homing.

Not yet measured — both are hypotheses. If (b) turns out to carry the behaviour, the private-API dependency (and with it the direct-download-only distribution consequence) is narrower than discovery assumed. Flagged as a finding against that decision, not a reopening of it.

Note the timing of Chrome's change: the user places it within roughly the last six months and describes it as newly-correct after years of the old behaviour — consistent with deliberate engineering work, which favours (a), but not evidence for it.

### Two placement paths: launch burst vs live create

Fumi is an always-running menu-bar app, so it has a lifecycle Chrome does not: notes created *while the app is already running*, which is the common case (by hand, or by Claude via the CLI/MCP). Placement splits into two paths with very different difficulty:

- **Launch burst** — N windows onto N Spaces in one go, none of them the current Space necessarily. This is where the timing/sequencing problem lives.
- **Live create** — one window, app already up, WindowServer long since ready. If the target is the current Space there is nothing to move at all; the window is simply born where you are.

User's shape for the live path: one sensible code path for both, gated on an **existence check for the target Space** before placing. Creating on the current Space makes that check instant and affirmative. Creating on another Space resolves the target first.

**Absent target Space at create time = fail loudly.** `fumi new --space 7` where no Space 7 resolves is an error the caller sees ("that space doesn't exist"), not a silent fallback.

Worth holding against the Space-1 fallback decision from discovery — these look contradictory but aren't, and the distinction is the useful bit:

| Situation | Behaviour | Why |
|---|---|---|
| Launch-restore: a note's remembered home Space no longer exists | Silent fallback to Space 1 | A historical fact went stale. Nobody is waiting on an answer; the note has to go *somewhere* predictable. |
| Create-time: explicit `--space N` doesn't resolve | Loud error | A caller gave an instruction that cannot be honoured. There is someone (or some agent) to tell. |

Placement on a non-current Space that *does* exist is **silent** — no Space switch, no window in front of you. The fumi is sitting there when you next visit that Space. Consistent with the eager-restore semantics above: correct Space, no attention demanded.

Open: the CLI's `--space N` is an *ordinal* resolved to a UUID at call time (discovery). What "does Space 7 exist" means when the ordinal has to resolve against a per-display Space set is queued as a separate triage concern, not settled here.

*(Corrected 2026-08-25 — review-001 F10: no such concern was ever queued; the thread was bookmarked into a queue that never received it. Delivered to `agent-surface` on 2026-08-25 as `009-space-ordinals-not-machine-unique`, carrying the three facts measured since: each display has its own ordinal 1, sids are not ordinals, and a fullscreen Space occupies an ordinal slot.)*

### Fork resolved — 2026-08-23 (deep-dive-001 F1, F3)

*Supersedes the "Open fork" section above; that section's framing of the question stands, its two options do not divide the space correctly.*

**Answer: (b) — Chrome uses AppKit state restoration, not the CGS/SkyLight Spaces calls. But (b) is not private-API-free, so the fork's framing was wrong: it split on *which* private API, not on *whether* one is needed.**

The two private surfaces are distinct and it's worth keeping them apart:

| | private CoreGraphics / SkyLight | private AppKit |
|---|---|---|
| Symbols | `SLSMoveWindowsToManagedSpace`, `SLSCopySpacesForWindows`, … | class `NSWindowRestorationOptions`, selector `_windowRestorationOptions` |
| Chrome uses it | **no** — 0 source hits, absent from the shipping binary | **yes** — subclasses `NSKeyedUnarchiver` solely to override it |

Verified three ways: GitHub code search across `chromium/chromium` returns 0 hits for `CGSAddWindowToSpace` / `CGSCopySpacesForWindows` / `CGSSpace`; the installed `Google Chrome Framework` (151.0.7922.174) contains `_windowRestorationOptions`, `NSWindowRestorationOptions` and `AlwaysMoveWindowsToOriginalSpaces` as strings but not `SLSMoveWindowsToManagedSpace`; and the mechanism is readable in `components/remote_cocoa/app_shim/native_widget_ns_window_bridge.mm:120-140`.

**What Chrome actually does:** archives each window's restorable state (public `encodeRestorableStateWithCoder:`), base64s the blob into its own session file, and replays it through public `restoreStateWithCoder:` at launch. The Space rides inside that blob as `NSWindowWorkspaceID` — the stable managed-space UUID. Both those calls are public. The blob is inert without the private hook.

**Measured, not reasoned** (macOS 26.5.2 build 25F84, SIP enabled): rewrite a window's archived `NSWindowWorkspaceID` to another Space's UUID, restore, order in, read back the landed Space —

- hook not vending options → **window stays on the active Space; the UUID is ignored**
- hook vending options → **lands on the target Space** (`isOnActiveSpace == 0`, read-back UUID matches)
- `NSWindowRestoresWorkspaceAtLaunch` user default registered instead of the hook → **stays on active Space**; the documented-ish route is dead on macOS 15+
- bogus UUID with the hook armed → silently stays on the active Space, no crash

**Public-API ceiling:** `NSWindowCollectionBehaviorMoveToActiveSpace` — moves a window to the Space you are *currently on*. No public call names another Space. Chromium hits the same ceiling and uses this only for fullscreen (`native_widget_ns_window_bridge.mm:1834`).

**Consequence for the distribution decision:** it stands, but its stated reason was wrong. Discovery derived off-App-Store from *needing the private CGS APIs*. Correct derivation: **every route to placing a window on a non-active Space is private**, whichever surface you pick. Also measured — the App Sandbox does **not** block the SkyLight move on an app's own windows (probe ad-hoc signed with `com.apple.security.app-sandbox`, sandbox engagement confirmed via `NSHomeDirectory()` and `sandbox_check`, no TCC prompt). So the barrier is App Review policy (guideline 2.5.1), not a runtime capability wall — an App Store build would function, it would not be approved.

**What is genuinely free of private API:** *reading* a window's home Space. Archive the window's own restorable state and read `$top.NSWindowWorkspaceID` → the stable managed-space UUID. Only *placement* needs private API.

**Timeline** (answers "why did it take Chrome so long"): `NSWindowRestoresWorkspaceAtLaunch` worked through macOS 14.7; Apple broke it in the macOS 15 Sequoia betas, autumn 2024 (crbug 369865047, 373928194; Apple radar FB15644170). Chrome's fix shipped M147 (stable 2026-04-07) and M148 (stable 2026-05-05) by overriding AppKit's default. ~18 months of OS regression, not neglect.

Both routes remain open to Fumi — nothing about Chrome's choice constrains ours. Route selection is a discussion call, not settled here.

### Space 1 has no UUID — measured 2026-08-23 (deep-dive-001 F10)

Measured on this Mac (macOS 26.5.2 build 25F84, SIP enabled, 2 displays, 17 managed Spaces) with the active Space set to Space 1 for the test. Probe sources: `scratchpad/t/sp1.m`, `scratchpad/t/sp2.m`.

**Space 1 carries an empty UUID, everywhere.** Every other Space on the machine has a real one:

```
Display 92A6EDE8-…  CurrentSpace=1
   [ 0] ManagedSpaceID=1   type=0  uuid=            <-- EMPTY
   [ 1] ManagedSpaceID=3   type=0  uuid=1F092BD9-0E7C-4FAD-8C40-2F9DC3A73BE3
   [ 2] ManagedSpaceID=4   type=0  uuid=031079E9-6496-42AF-BCC4-0555DA5B57D9
   …
Display 37D8832A-…  CurrentSpace=19
   [ 0] ManagedSpaceID=19  type=0  uuid=19155053-ADEA-40EC-B8C9-1D9E5F1D865D
```

`SLSSpaceCopyName(cid, 1)` → `""`.

**And a window living on Space 1 records that as an empty string, not an absent key.** The open question F10 could not close — what `NSWindowWorkspaceID` holds for a window genuinely on Space 1 — is now answered. Window created while Space 1 was active, `SLSCopySpacesForWindows` → `(1)`, `isOnActiveSpace=1`:

```
$top keys: … NSWindowWorkspaceID …
NSWindowWorkspaceID -> uid 6 -> "" (class __NSCFConstantString), length=0
```

So the key is always present; on Space 1 its value is the empty string. Absent-vs-empty is distinguishable, but the empty string is not usable as an identity key.

**Space 1 *is* addressable by its numeric ManagedSpaceID.** The empty UUID does not make it unreachable — the SkyLight route takes the sid directly and `1` works:

```
start (on Space 1):          spaces=1   isOnActiveSpace=1
after move -> sid 7:         spaces=7   isOnActiveSpace=0
after move BACK -> sid 1:    spaces=1   isOnActiveSpace=1
```

**Ordered-out placement reconfirmed** on this run — a window moved to sid 7 *before* its first `orderFront:` materialised directly on Space 7 (`spaces=7`, `isOnActiveSpace=0`), never appearing on the launch Space. This is the flash-free primitive the eager-restore requirement needs.

Also reconfirmed: `CGSAddWindowToSpace` resolves to `NULL` on macOS 26 — `dlsym` returns `0x0`. `SLSMoveWindowsToManagedSpace` resolves at `0x18bfdb1f8`. The symbol discovery's brief named is gone.

**Consequences for the identity model:**

- "A note's home Space is the managed-space UUID" has a hole at Space 1 and only at Space 1. A note homed there cannot be keyed by UUID.
  *(Superseded 2026-08-23 — see **Empty-string workspace id resolves to Space 1**, below: `""` was measured placing a window on Space 1 from a different active Space, so it is a working identifier, not a hole. A UUID-keyed model does cover every Space, provided `""` is carried as a value rather than normalised to nil. Its uniqueness across topologies is separately questioned by review-001 F7.)*
- Two shapes are available and neither is settled here: key on the ManagedSpaceID (`uint64`, works for every Space including 1, but its stability across reboots/reordering is not measured), or keep the UUID as the key and treat empty-string as the sentinel meaning Space 1. Both are live options; the choice is a discussion call.
  *(Superseded 2026-08-25 — see **The decisive by-product: ManagedSpaceID is not stable; the UUID is**, below: sid `19` became `272` across one undock/redock while the UUID held. The fork is closed and the ManagedSpaceID shape is out; only the UUID shape remains.)*
- The Space-1 fallback needs explicit code either way: both routes degrade to the *active* Space, not Space 1, when a destination is unknown (bogus UUID through AppKit; unknown sid is a silent no-op through SkyLight). Neither raises an error. So restore must do an existence check against the enumerated Space list and redirect explicitly — the fallback is not inherited behaviour.

**Still untested:** whether restoring a blob whose `NSWindowWorkspaceID` is the empty string, while the active Space is *not* Space 1, lands the window on Space 1 or leaves it on the active Space. Requires the probe to run from a Space other than 1.

### Empty-string workspace id resolves to Space 1 — measured 2026-08-23 (deep-dive-001 F10, follow-up)

Closes the "still untested" item above. Probe: `scratchpad/t/sp3.m`. Method: archive a real window's restorable state on the active Space, rewrite the `$objects` entry that `$top.NSWindowWorkspaceID` points at, re-serialise, restore into a fresh window through a `NSKeyedUnarchiver` subclass overriding `_windowRestorationOptions`, then read back the landed Space with `SLSCopySpacesForWindows`. Run with the active Space = `ManagedSpaceID 3`.

```
workspace=""  (Space 1's value)   hook=YES -> landed sid=1  isOnActiveSpace=0
workspace=""  (Space 1's value)   hook=no  -> landed sid=3  isOnActiveSpace=1
workspace=<sid 7 uuid>            hook=YES -> landed sid=7  isOnActiveSpace=0
workspace=<sid 7 uuid>            hook=no  -> landed sid=3  isOnActiveSpace=1
workspace=<bogus uuid>            hook=YES -> landed sid=3  isOnActiveSpace=1
```

**The empty string is a working identifier for Space 1, not a gap.** AppKit resolves `""` to Space 1 and places the window there from a different active Space. So a UUID-keyed identity model does cover every Space, provided empty-string is carried as a legitimate value rather than normalised away to nil/absent — the failure mode of "helpfully" treating `""` as unset is placing the note on whatever Space the user happens to be on.

The hook rows re-confirm F3 on a second, independent code path: with the hook not vending options, both a valid UUID and the empty string are ignored and the window stays on the active Space.

**The bogus-UUID row is the cost that remains.** An unresolvable destination lands on the active Space and reports nothing. So "home Space was deleted" and "home is Space 1" are indistinguishable at the point of failure — both look like success. The existence check against the enumerated Space list before placement, plus the explicit Space-1 redirect, is still required.

**Incidental: user-facing ordinals and ManagedSpaceIDs are offset and do not track each other.** With the user on what they call "Space 2", the OS reported `ManagedSpaceID = 3`; `sid 2` does not exist on this machine (ids observed: 1, 3–17, 19). Consistent with discovery's decision that `--space N` is an ordinal resolved at call time — and it makes that resolution step load-bearing rather than cosmetic: passing the CLI's number through as a space id would silently target a different Space, or a non-existent one.

### The launch-timing problem is a sequencing rule, not a race (deep-dive-001 F4)

Discovery framed launch-time placement as the core technical risk: a window can only move to a materialised Space, the move fails silently if attempted before the WindowServer is ready, and there is a visible-flash risk. The dive went looking for the machinery that manages that in Chromium's restore path and found **none of it** — no wait-for-WindowServer signal, no polling for Space existence, no retry loop, no off-screen staging.

What Chromium does instead is ordering discipline (`components/remote_cocoa/app_shim/native_widget_ns_window_bridge.mm:898`):

1. `InitWindow` creates the `NSWindow` but does not order it in; the blob waits in `pending_restoration_data_`.
2. On the **first** `SetVisibilityState()`, `restoreStateWithCoder:` is applied — before any order-in. Consuming the blob doubles as the "session restore underway" flag.
3. That flag downgrades `kShowAndActivateWindow` → `kShowInactive`. Comment: *"Don't activate a window during session restore, to avoid switching spaces (or pulling it out of the dock) during startup."*
4. `kShowInactive` avoids `orderFront:` deliberately, using `[window_ orderWindow:NSWindowBelow relativeTo:NSApp.mainWindow.windowNumber]`. Comment: *"Avoid making it the front window (with e.g. orderFront:), which can cause a space switch."*

There is no flash because there is no visible window to flash — state is applied before the window exists on screen.

**Confirmed independently on both routes, on this machine.** The destination is *latched but not applied*:

- AppKit route: immediately after `restoreStateWithCoder:` and before order-in, `isOnActiveSpace` still reports `1`; after `orderFront:` it reports `0`.
- SkyLight route: `SLSMoveWindowsToManagedSpace` to sid 7 *before* the window's first `orderFront:` succeeded, and the subsequent order-in materialised it directly on Space 7 (`spaces=7`, `isOnActiveSpace=0`).

So both routes offer a latch-then-show primitive, and the eager-restore requirement is satisfied by sequencing rather than by timing. This materially de-risks the topic relative to the discovery brief's framing.

**The caveat that survives:** activating a window during restore can pull the user to that window's Space. Chromium avoids `orderFront:` for exactly this reason. For Fumi the stake is higher than for Chrome — a fumi that drags the user to Space 11 at login inverts the "quiet furniture" intent — so whichever route is chosen, the show step must be the non-activating kind.

**Eagerness is a consequence, not a feature.** Chromium places per-window at each window's first show; the set ends up distributed because session restore creates and shows every window during startup. There is no batch-placement API. *(Inferred from the code path; a live Chrome launch was not instrumented.)*

*(Superseded 2026-08-25 — review-001 F3: true of the **AppKit** route only. `SLSMoveWindowsToManagedSpace(cid, windowList, sid)` takes a window **list** — two windows to one Space in a single call, measured landing correctly. See **The N-window launch burst** below.)*

### No TCC permission is needed to place your own windows — measured (deep-dive-001 F6)

Measured on this Mac (macOS 26.5.2, SIP `enabled`), probe ad-hoc signed with no entitlements, and separately inside a real App Sandbox container:

- **Own-window move succeeds.** `SLSCopySpacesForWindows` went `(13)` → `(3)`; `isOnActiveSpace` went `1` → `0`.
- **Works while ordered out** — the latch-then-show primitive.
- **Works under App Sandbox.** Same code in a `.app` ad-hoc signed with `com.apple.security.app-sandbox`; engagement independently verified (`NSHomeDirectory()` in `~/Library/Containers/…/Data`, `sandbox_check` positive, `~/Documents` write denied).
- **No TCC prompt of any kind** — not Accessibility, not Screen Recording, not Automation.
- **Unknown space id is a silent no-op** — window stays on the active Space, no crash. (Same failure shape as the bogus-UUID case on the AppKit route.)
- `SLSSpaceCopyName(cid, sid)` returns the Space's UUID string, so sid → UUID needs no plist read.

**Why the opposite was assumed — ownership, not privilege.** yabai's own gate `workspace_use_macos_space_workaround()` (`src/workspace.m:17`) returns true for macOS 12.7+, 13.6+, 14.5+ and all of 15+ — i.e. yabai treats the plain `SLSMoveWindowsToManagedSpace` path as unusable on exactly the OS where it measured working here. OS version and SIP state were held constant across both, so the variable is **window ownership**: yabai's scripting addition and its partial-SIP requirement exist because yabai manipulates *other applications'* windows. An app moving its own windows is a different operation and the system treats it differently.

**Bears on the queued concern** `004-do-the-space-apis-need-accessibility` (from engine-architecture, 2026-08-12), whose stated doubt was correct. Recorded here as this topic's measurement; the concern's own fold happens when the triage queue is walked, not here.

Scope limit worth keeping: this measured *Space placement* specifically. It is not a claim that Fumi needs no permissions at all.

### Private-symbol stability, and how it shapes the route choice (deep-dive-001 F7)

`dlsym` sweep against `/System/Library/PrivateFrameworks/SkyLight.framework/SkyLight` on macOS 26.5.2:

| symbol | status |
|---|---|
| `CGSAddWindowToSpace` | **ABSENT** |
| `CGSAddWindowsToSpaces`, `CGSRemoveWindowsFromSpaces`, `CGSMoveWindowsToManagedSpace` | present |
| `SLSMoveWindowsToManagedSpace`, `SLSAddWindowsToSpaces`, `SLSRemoveWindowsFromSpaces` | present |
| `CGSCopySpacesForWindows` / `SLSCopySpacesForWindows` | present (same address) |
| `CGSCopyManagedDisplaySpaces` / `SLSCopyManagedDisplaySpaces` | present |
| `SLSSpaceCopyName`, `SLSSpaceGetType`, `SLSMainConnectionID`, `CGSGetActiveSpace` | present |
| `SLSSetSpaceOwner` | ABSENT |
| `SLSPerformAsynchronousBridgedWindowManagementOperation` | **ABSENT to `dlsym`** |

`CGS*` and `SLS*` are aliases at identical addresses for the surviving pairs.

**The churn already caught this project.** `CGSAddWindowToSpace` — the symbol the discovery brief names as the API for this feature — no longer exists. Nothing had been built on it, so the cost was zero, but it is a worked demonstration rather than a hypothetical risk.

`SLSPerformAsynchronousBridgedWindowManagementOperation` is invisible to `dlsym` because it has **internal linkage**. yabai reaches it by parsing the Mach-O symbol table for the mangled name `__ZL54SLSPerformAsynchronousBridgedWindowManagementOperationP47SLSAsynchronousBridgedWindowManagementOperation` (`src/yabai.c:149`, via `src/misc/macho_dlsym.h`); the `L` in `__ZL` is the internal-linkage marker.

**Two degradation styles observed, both effective:**

- **yabai** — four fallback tiers in `space_manager_move_window_to_space()` (`src/space_manager.c:685`): bridged operation if the mangled symbol resolved → plain `SLSMoveWindowsToManagedSpace` if the OS is old enough → the scripting addition → a `SLSSpaceSetCompatID(cid, sid, 0x79616265)` / `SLSSetWindowListWorkspace(...)` / `SLSSpaceSetCompatID(cid, sid, 0)` sandwich. Every tier is a null check or a version check; nothing hard-fails. It also version-gates WindowServer notification ids (`1204` on old macOS, `1327`/`1328` on Ventura+, extra `804` on Sequoia/Tahoe).
- **Chromium** — version-gates on `base::mac::MacOSMajorVersion() >= 15` and resolves the private class by string via `NSClassFromString`, so a missing class yields `nil` and restoration simply doesn't move the window rather than crashing.

**Tradeoff landscape for the route choice (not decided here).** The two routes fail differently, and the shape of the failure differs more than its likelihood:

| | AppKit route | SkyLight route |
|---|---|---|
| Private surface | one class + one selector | one or more C function symbols |
| Resolution | `NSClassFromString` → `nil` | `dlsym` → `NULL` |
| If it breaks | hook returns nil, restore runs, every fumi opens on the current Space — the old Chrome behaviour | null function pointer; crash unless every call site is guarded |
| Placement before show | latched, measured working | latched, measured working |
| Extra capability | — | addresses Space 1 by numeric sid; enumerate Spaces; move a live window at any time; place a list of windows in one call |

*(Amended 2026-08-25 — review-001 F4: "move a live window at any time" is **not** SkyLight-only. `restoreStateWithCoder:` with the hook armed moved an already-visible window to another Space (deep-dive experiment H), so the AppKit route can serve `fumi mv --space N` too. The row's other entries stand. Two further discriminators have since been recorded and are not in this table: the `restorable = NO` entanglement (favours SkyLight) and ecosystem exposure across 10 shipping Electron apps (favours AppKit) — see below.)*

Both are survivable. One degrades to "the feature quietly stopped working", the other to "crash on launch unless the guards were written and maintained".

*Orchestrator's lean, recorded as a lean:* the failure asymmetry favours the AppKit route, which revises an earlier lean toward SkyLight based on its ordered-out placement — that advantage turned out to exist on both routes (F4), leaving degradation shape as the discriminator. **The user concurred in session on 2026-08-24.** Route selection remains a discussion-phase decision; recorded here as a tradeoff with a lean, not as a decision of record.

**Convergence flag:** this thread has moved from "what are the options" to "which option", which is decision territory. Parked for discussion rather than settled here.

### One blob carries Space, frame and display identity together (deep-dive-001 F2)

`-[NSWindow encodeRestorableStateWithCoder:]` — fully public — emits more than the Space. `$top` for a plain 320×200 titled window:

```
NSWindowWorkspaceID                      <- managed-space UUID
_NSWindowLayouts
  +- NSWindowLayout
       +- NSWindowLayoutWindowFrame        {{200, 200}, {320, 232}}
       +- NSWindowLayoutScreenLayoutFrame
            +- NSScreenLayout
                 +- NSScreenLayoutUUIDString   <- display UUID
                 +- NSScreenLayoutSize
NSWindowFrame, NSUnmanagedWindowFrame2, NSStyleMask, NSTitle,
NSUIID, NSWindowNumber, NSFirstResponder, NSClassName,
NSPackagesWindowPropertyList, NSWindowManagementTilingState,
NSWindowManagementPersistentIdentifier,
_NSWindowLastUserWindowLayouts, _NSWindowMoveGeneration, _NSWindowResizeGeneration
```

Measured value of `NSWindowWorkspaceID` on this machine: `E7C6F1DE-34FE-45C3-81B4-B07E408637DE`, matching the `uuid` of `ManagedSpaceID = 13` in `com.apple.spaces`. Verified both as a write (encode, read the UUID) and as a read-back after a move (encode again post-move; the value had changed to the destination Space's UUID).

Space identity, window frame, display identity and display geometry travel together — which is the mechanical reason Chrome restores size and position correctly and not merely Space membership.

**AppKit models display identity as a fact separate from Space identity**, and keys the frame to the *screen layout* rather than to the Space. Bears on the queued concern `001-does-a-space-identify-a-home-on-its-own-or-is-a-home-a-display-space-pair` (from note-window, 2026-07-28): AppKit's own answer is that the two are distinct co-travelling facts, with geometry resolved against the display. Recorded as evidence; that concern's fold happens on the triage walk, not here.

**Reading the home Space needs no private API** — archive the window's own restorable state, read `$top.NSWindowWorkspaceID`, get the stable managed-space UUID. Only placement is private.

**Bookmarked cross-topic thread — how a fumi persists its placement.** Two shapes: explicit fields on the note record (home Space, x/y, w/h, display) with Fumi driving placement, or persisting the opaque AppKit blob per note and replaying it as Chrome does. The blob is free and battle-tested; against it, it is opaque — a fumi's home Space would live inside a base64 lump rather than a readable field, and `fumi list --space 7` would have to unarchive every note to answer, which matters here in a way it does not for Chrome because the CLI and MCP are first-class surfaces. *Orchestrator's lean:* explicit fields, treating the blob as a source to read from rather than the thing stored; the user indicated agreement in session on 2026-08-24. Belongs to note-model / storage-and-sync, not settled here — to be routed at the end of the current findings walk.

### The private-surface ladder across the three reference implementations (deep-dive-001 F8)

- **Spaceman** (v1.23.5) — read-only, and its entire private surface is three C prototypes in `Spaceman/Spaceman-Bridging-Header.h`:

  ```c
  int _CGSDefaultConnection();
  id  CGSCopyManagedDisplaySpaces(int conn);
  id  CGSCopyActiveMenuBarDisplayIdentifier(int conn);
  ```

  It walks `display["Spaces"]` and `display["Current Space"]["ManagedSpaceID"]`, refreshing on the public `NSWorkspace.activeSpaceDidChangeNotification` (`Spaceman/Helpers/SpaceObserver.swift`). Keys on `ManagedSpaceID`, not `uuid`. No window manipulation, no scripting addition, no SIP change.

- **Chromium** — writes, but only its own windows and only through AppKit (F1, F3). Its sole *public* Space manipulation is `NSWindowCollectionBehaviorMoveToActiveSpace` in `MoveToActiveFullscreenSpace()` (`native_widget_ns_window_bridge.mm:1834`), by temporarily setting and restoring `collectionBehavior` — and that can only target the **active** Space. Confirms the public ceiling from the opposite direction to F4.

- **yabai** — writes any application's windows: ~100 `SLS*` externs in `src/misc/extern.h`, window enumeration via `SLSCopyWindowsWithOptionsAndTags` + `SLSWindowQueryWindows` with hand-tuned tag/attribute bitmasks (`src/space.c`), and the scripting addition with SIP partially disabled. Space identity is the numeric `sid`; UUIDs come from `SLSSpaceCopyName(cid, sid)` and are cached on the view (`src/view.c:995`).

**Where Fumi sits.** Between Spaceman and Chromium, and closer to Spaceman than the discovery brief assumed. Required surface: Spaceman's read capability (enumerate Spaces, identify the current one) plus exactly one write capability, applied to Fumi's own windows. That is materially smaller than the yabai-shaped picture the brief carried, and consistent with everything measured on 2026-08-23/24 — no TCC grant, sandbox-clean, no scripting addition.

**What it does not shrink:** the App Store answer. Spaceman ships three read-only private functions and is still off-store. Small private surface, same policy wall (F9).

### AppKit restores Spaces on system restart only — every other launch needs an override (deep-dive-001 F5)

Chromium's fix landed as two commits in `chromium/src`:

| date | commit | subject | first stable |
|---|---|---|---|
| 2026-03-05 | `daf1cc3653a5` (CL 7633903) | Fix window space restoration | M147 — 2026-04-07 |
| 2026-03-13 | `f9a6ce0cb2f1` (CL 7656714) | Always restore windows to spaces | M148 — 2026-05-05 |
| 2026-03-17 | `51341b3f92d8` (CL 7648058) | Restore windows to spaces on a system restart | — |
| 2026-03-18 | `5942d5648342` (CL 7681130) | Revert of the above ("Likely causing 493833255") | — |

**The load-bearing fact.** CL 7656714's message: *"AppKit only restores windows to spaces upon system restart, but not if a user quits and restarts an app. It's not clear why that behavior was chosen … Therefore, always restore windows to spaces."*

The system's default is **restart-only**. Quit an app and reopen it and AppKit will not return its windows to their Spaces. For Fumi that default is inverted from what is wanted: a user quitting and relaunching, or Fumi restarting itself after a Sparkle update, is the normal path.

**Requirement confirmed with the user, 2026-08-24:** fumis return to their home Spaces on *every* launch, not only after a system restart. Restart-only would not satisfy the eager-restore bar recorded at the top of this file.

**The rejected approach, and why it is worth not repeating.** CL 7648058 tried to *detect* system-restart launches, overriding a private `NSApplication` method to inspect the Apple Event before the delegate callback fires:

```objc
if ([event paramDescriptorForKeyword:keyAERestoreAppState]) {
  views::NativeWidgetMacNSWindowHost::MoveWindowsToOriginalSpacesUponRestoration();
}
```

`keyAERestoreAppState` rides on `kAEOpenApplication`/`kAEReopenApplication` only when macOS relaunched the app after a system restart; by the time `NSApplicationDelegate` fires it is too late to read, hence the private funnel override. Landed 2026-03-17, reverted 2026-03-18 for causing crbug 493833255. It also costs a *second* private API on top of the placement one, for a distinction Fumi does not want to draw.

**The kill switch, worth copying.** Chromium gated the always-restore change behind `BASE_FEATURE(kAlwaysMoveWindowsToOriginalSpaces, base::FEATURE_ENABLED_BY_DEFAULT)` (`ui/views/cocoa/native_widget_mac_ns_window_host.mm:78`) — an emergency-off if it went wrong in the field. Fumi has no remote config, but a local preference disabling Space homing and falling back to opening on the current Space is cheap, and converts "the private hook broke on macOS 27" from a support crisis into a one-line instruction. Noted as an option; not decided here.

**Regression origin, for the record.** crbug 369865047 and 373928194, both filed against macOS 15 Sequoia betas in autumn 2024, both regressions from macOS 14.7 where `defaults write com.google.Chrome NSWindowRestoresWorkspaceAtLaunch -bool YES` worked (Apple radar FB15644170). The older manual-quit case (crbug 40101777 / 40531488) was never fixed until M148 chose to override AppKit's default.

### Does a Space identify a home on its own, or is a home a (display, Space) pair?

*From: note-window · discussion · 2026-07-28*

Arrived carrying six sub-questions, four of which its own sibling entry (`002`, note-window, 2026-07-29) had already answered or reframed: a home is neither a bare UUID nor a pair but a **resolution ladder** — *display identity · Space UUID · ordinal Space index on that display* — with step 2 rebinding and step 3 never writing. Two sub-questions were still live and are walked separately.

#### Sub-question 4 — flipping "Displays have separate Spaces" between launches

The setting (System Settings → Desktop & Dock → Mission Control) cannot change without a logout, so a flip guarantees a relaunch: Fumi always meets the new configuration cold, with every home recorded under the old one.

Current state on this machine — `defaults read com.apple.spaces spans-displays` → `0` (separate Spaces **ON**, the default). Matches the enumerated shape: display `92A6EDE8` owns sids 1 and 3–17, display `37D8832A` owns sid 19.

The two configurations differ structurally:

- **ON** — each display owns an independent Space set. A home recorded against the external's own Spaces is meaningful only while that configuration holds.
- **OFF** — one Space spans every screen; which display a note lands on is decided purely by its remembered coordinates.

So ON→OFF dangles every home recorded against a secondary display's Spaces, and OFF→ON creates Spaces on the secondary that nothing was ever homed to.

**Outcome: no special-casing. The resolution ladder already covers it.** A setting flip is not a new failure mode — it is a bulk instance of "the recorded Space is not there any more", which is what steps 2 and 3 exist for. Dangling homes degrade to ordinal-on-the-same-display, then to the main display clamped to the visible frame.

What makes this survivable rather than merely tolerable is note-window's existing rule that **resolving a home never writes one**. Notes land sensibly in the new configuration, their recorded intent is untouched, and flipping back restores them exactly. Detecting the flip and migrating homes was considered and rejected on that basis: migration means writing homes from a resolution path, which is precisely what the rule forbids — and one flip would then permanently rewrite every home with no way back.

*Sibling check: note-window — its 2026-07-29 entry holds that a home is intent, resolution never rewrites intent, step 2 rebinds for the same display + ordinal, and step 3 never writes. This outcome applies that rule rather than amending it.*

#### Sub-question 6 — should a preset carry or affect a Space?

note-window's assumption was that a user preset captures position and size only, never a Space, and that any re-home simply falls out of where the note ends up. **The assumption holds and is kept.** What needed settling is what "position" means when more than one display is attached.

**Measured — coordinates and Spaces are orthogonal.** One window, four Spaces on the same display, frame unchanged throughout (`scratchpad/t/sp5.m`):

```
start:                    frame={{140, 900}, {300, 212}}   sid=13
after move to Space 7:    frame={{140, 900}, {300, 212}}   sid=7
after move to Space 11:   frame={{140, 900}, {300, 212}}   sid=11
after move to Space 1:    frame={{140, 900}, {300, 212}}   sid=1
```

Every Space on a given display occupies the identical rectangle. A coordinate identifies *which display and where on it*; it can never identify a Space, because all of that display's Spaces share the same coordinates. Space membership is a separate per-window property — which is why swiping between Spaces moves no window by a pixel, and why the AppKit blob records `NSWindowWorkspaceID` and `NSScreenLayoutUUIDString` + frame as independent facts (F2).

**Measured — but a cross-display move does change Space** under *Displays have separate Spaces* ON (`scratchpad/t/sp4.m`). Moving a window by frame origin alone, no Space call involved:

```
spans-displays = FALSE  (Displays have separate Spaces = ON)
screen[0] {{0,0},{2560,1440}}       <- main (Studio Display)
screen[1] {{2560,-581},{1728,1117}} <- laptop, to the right

placed on screen[0]          -> sid=13
moved by coordinates to [1]  -> sid=19
moved back to [0]            -> sid=13
```

**Therefore the fork, and the outcome.** A stored `x` picks a *screen*, and picking a different screen drags the Space with it. So a Space-free preset can still re-home a note's Space, purely as a consequence of the coordinate.

- *Absolute* — the preset's stored coordinate is literal. Applying it can move a note to another screen and therefore another Space.
- *Relative* — **chosen.** The preset means "left edge of whatever screen this note is already on". A fumi on the laptop given a left-rail preset becomes a left rail on the laptop; it stays on its screen and its Space.

Rationale: it matches the request ("make it a left rail", not "move it to my other screen"), and it is the only option that behaves identically whether *Displays have separate Spaces* is ON or OFF — so the feature stops depending on a setting most users never see. Cross-display moves stay explicit acts (drag, or **Move to Display ▸**), where re-homing is correct because the user did it deliberately.

*Sibling check: note-window — its Positioning decision holds that a preset captures position + size, is global, does not capture a Space, and that wherever the user puts a note is its new home. This outcome preserves all of that and resolves only the ambiguity in how a stored coordinate is interpreted across displays.*

### Display disconnect / reconnect — residual questions

*From: note-window · discussion · 2026-07-29*

The entry is reference material, already settled by note-window and not re-decided here: a home is intent and resolution never rewrites it; the resolution ladder is *display identity · Space UUID · ordinal index on that display*; step 2 rebinds, step 3 never writes. macOS itself migrates the external's non-first Spaces to the primary on disconnect (retaining id and UUID), destroys only the external's *first* Space, and returns them on reconnect. Fumi places windows only at relaunch — the one moment macOS has nothing to restore from. Its five residual questions were flagged non-blocking; walked below.

#### Residual 1 — is the ordinal Space index readable and stable per display?

**Readable: confirmed, and cross-checked against a human.** `CGSCopyManagedDisplaySpaces`' per-display array order is the user-visible Mission Control order. Measured (`scratchpad/t/ord.m`):

```
Display 92A6EDE8-…   (16 Spaces)   active sid=13
   array idx | ordinal | sid | uuid
          0  |       1 |   1 | (empty)
          1  |       2 |   3 | 1F092BD9-0E7C-4FAD-8C40-2F9DC3A73BE3
          2  |       3 |   4 | 031079E9-6496-42AF-BCC4-0555DA5B57D9
         11  |      12 |  13 | E7C6F1DE-34FE-45C3-81B4-B07E408637DE  <- active
         15  |      16 |  17 | 2583B79D-A871-4D25-A18A-567533B4FFAB
Display 37D8832A-…   (1 Spaces)    active sid=19
          0  |       1 |  19 | 19155053-ADEA-40EC-B8C9-1D9E5F1D865D
```

The cross-check: earlier in this session the user moved to what they called "space number two" and the machine independently reported `sid = 3` — array index 1, ordinal 2. So the array order matches what a human counting Spaces on screen sees, verified against the user rather than against assumption.

**Space ids are not ordinals.** This machine's sids run 1, 3, 4 … 17 — `2` does not exist. Anything treating a space id as a position is wrong from the second Space onward.

**Stability: not measured, and the ladder does not require it.** Step 2 is a fallback reached only after the UUID has already failed, and it exists for one case — the external's first Space, the only Space macOS genuinely destroys. Its job is "put this note roughly where it used to be", not "restore it exactly". If Spaces were reordered while the display was unplugged and the ordinal now points elsewhere, the note lands on the wrong Space; the user drags it back, which re-homes it correctly under the existing rule. Demanding guaranteed stability from a best-effort rung would over-engineer it. *Stated in session 2026-08-24 and uncontested.*

Worth verifying eventually, narrower than the entry's full protocol: that the ordinal survives a plain reboot — the common case, and the one where a wrong answer would be noticed daily.

#### Residual 2 — display identity as the weakest link

**SkyLight's per-display key is the public CGDisplay UUID.** Measured (`scratchpad/t/disp.m`) — the `Display Identifier` that `CGSCopyManagedDisplaySpaces` buckets Spaces under is byte-identical to `CGDisplayCreateUUIDFromDisplayID`:

```
SkyLight "Display Identifier"              CGDisplayCreateUUIDFromDisplayID
92A6EDE8-8675-40D8-8EAC-9BB53576A226   ==  Studio Display
37D8832A-2D66-02CA-B9F7-8F30A301B230   ==  Built-in Retina Display
```

So the display rung of the resolution ladder needs **no private API**. Together with the home-Space read being public (F2), the only genuinely private operation left in this topic is *placement*.

**Raw material for distinguishing identical monitors is present:**

```
Studio Display   vendor=0x0610  model=0xAE3A  serial=0xD17C6D8E  builtin=0
Built-in         vendor=0x0610  model=0xA050  serial=0xFD626D62  builtin=1
```

Both report a real non-zero serial; two identical monitors would share vendor and model but differ here. Whether the UUID is *derived* from these attributes was not confirmed — a single reading cannot establish it — so this is observation, not fact.

**`CGDirectDisplayID` is session-scoped and churns** (`displayID=5` for the Studio, `1` for the built-in). Anything keying on it rather than the UUID breaks on the first unplug.

**Hub/adapter/port instability: unmeasured** — it needs a physical replug. The ladder absorbs it regardless: a changed display UUID fails step 1, fails step 2 (wrong display), and lands on step 3 — main display, clamped to the visible frame — which is where the note wants to be when the screen it lived on is effectively a different screen. Annoying, not lossy, and the home is never rewritten.

#### Residual 3 — does macOS's failed auto-restoration have a detectable signature?

**Outcome: don't detect. The question dissolves against the design already in place.**

The entry asks whether Fumi could notice that macOS's migrate-on-disconnect / restore-on-reconnect silently failed, and compensate. Three reasons not to:

1. **The same instinct already failed in the reference implementation.** Chromium tried to detect whether a launch was a system restart or a manual relaunch, which required overriding a private `NSApplication` method to read an Apple Event before the delegate saw it (CL 7648058, 2026-03-17). Reverted the next day for causing a crash (CL 7681130). The replacement was to stop detecting and always restore (F5).
2. **The detector cannot distinguish OS failure from user intent.** Noticing that a window is not where its home says means watching for a discrepancy — and a discrepancy is equally produced by the user deliberately dragging the note somewhere. Guessing wrong moves a window the user placed on purpose. The detector's failure mode is worse than the failure it detects.
3. **The backstop is already the answer.** note-window settled that Fumi places windows *only at relaunch* and that resolution never rewrites intent. A note homed to Space 19 keeps that home regardless of where macOS left it; the next relaunch resolves and replaces it.

Accepted cost: a failed restoration persists until the next launch. Preferred to a live watcher that occasionally drags a note off a Space the user just chose — and it keeps the private surface where it is rather than adding to it.

#### Residual 4 — fewer Spaces on return than the recorded ordinal

**Nothing throws, and the measurement produced the existence oracle this topic needs in three places.**

`SLSSpaceGetType` distinguishes real user Spaces from everything else (`scratchpad/t/exists.m`):

```
  sid | SLSSpaceGetType | SLSSpaceCopyName                     | verdict
     1 |               0 | "" (empty)                          | real user Space
     3 |               0 | 1F092BD9-0E7C-4FAD-8C40-2F9DC3A73BE3| real user Space
    13 |               0 | E7C6F1DE-34FE-45C3-81B4-B07E408637DE| real user Space
    19 |               0 | 19155053-ADEA-40EC-B8C9-1D9E5F1D865D| real user Space
     2 |               3 | (null)                              | NOT a user Space
    20 |               3 | mission-control                     | NOT a user Space
    99 |               3 | (null)                              | NOT a user Space
  9999 |               3 | (null)                              | NOT a user Space
     0 |               3 | (null)                              | NOT a user Space
```

Type `0` means a real user Space; nothing else does. Note sid 20 is a named internal Space (`mission-control`), so a non-null name is not evidence of a user Space — the type is.

The clamp is safe on two independent levels: it is array-index arithmetic over an enumerated list, which cannot throw, and a wrong result degrades to a silent OS no-op rather than a crash.

**The carried point: the silent no-op is a trap, not a safety net.** A move to a non-existent Space reports success and leaves the window on the active Space. This is the same failure shape as the bogus-UUID restore and the deleted-home fallback — three places in this topic where "it worked" and "it didn't" are indistinguishable afterwards. The oracle answers all three: check `SLSSpaceGetType(cid, sid) == 0` **before** placing; never infer from the result after. Best as one shared pre-flight helper rather than three call sites each remembering to do it.

#### Residual 5 — behaviour with *Displays have separate Spaces* OFF

Already closed under concern 001's sub-question 4: the resolution ladder handles both configurations with no special-casing, because a home dangling under either one is just a step-1 miss. No separate work.

### Does the destroyed first Space follow the disconnected display, or the built-in?

*From: note-model · discussion · 2026-08-03*

Settled empirically on 2026-08-25 with a three-snapshot capture on the user's own inverted topology — Apple Studio Display as **main**, MacBook Pro built-in as secondary, joined by a CalDigit TS5 Thunderbolt dock (single TB cable Mac→dock, second TB cable dock→display). Tool: `scratchpad/t/capture.m`; snapshots `cap1.txt` (docked), `cap2.txt` (undocked), `cap3.txt` (redocked).

**Both readings in the concern were wrong.** It is neither "the disconnected display's first Space is destroyed" nor "the built-in's is".

```
DOCKED                                    UNDOCKED
Studio (MAIN)    16 Spaces                Built-in (now MAIN)  16 Spaces
  ord 1  sid=1   uuid=(EMPTY)      ---->     ord 1  sid=1   uuid=(EMPTY)
  ord 2  sid=3   1F092BD9-...      ---->     ord 2  sid=3   1F092BD9-...
  ...                                        ...
  ord 16 sid=17  2583B79D-...      ---->     ord 16 sid=17  2583B79D-...
Built-in         1 Space
  ord 1  sid=19  19155053-...      ---->     GONE
```

**What actually happens going from two displays to one: the surviving configuration inherits the *main* display's Space list wholesale — every sid, UUID and ordinal position, the empty-UUID Space still at ordinal 1 — and the *other* display's Spaces are discarded.** Primacy carries the Space set; the secondary's Spaces are what is expendable. Here the destroyed Space (`sid 19`) belonged to the display that *stayed*.

**Consequence for the concern's actual worry — it inverts.** In this topology the user's 16 working Spaces are the ones that survive every undock with UUIDs intact, so the ladder's ordinal rung stays the rare fallback it was designed as, not the everyday path. The genuinely dangling home is one on the *laptop's* Space — a far rarer home than the concern feared. note-window's ladder holds as designed; only the expected frequency of rung 3 changes, downward.

#### The decisive by-product: ManagedSpaceID is not stable; the UUID is

```
                        DOCKED        UNDOCKED       REDOCKED
Studio display UUID     92A6EDE8-...  (absent)       92A6EDE8-...    unchanged
Studio's 16 Spaces      sids 1,3..17  migrated       sids 1,3..17    identical
Built-in's Space
   ManagedSpaceID       19            destroyed      272             CHANGED
   uuid                 19155053-...  destroyed      19155053-...    unchanged
```

The laptop's Space returned under a **different ManagedSpaceID** (`19` → `272`) carrying the **identical UUID**. Same Space by identity, new number.

**This resolves the identity fork left open under F10.** Two options were live: key the home on `ManagedSpaceID` (attractive because it addresses Space 1, whose UUID is empty), or keep the UUID as the key with empty-string as the Space-1 sentinel. **The first is disproven** — a sid-keyed home would silently point at nothing after one undock/redock cycle, which this user performs several times a day. Discovery's original instinct — identity is the managed-space UUID — is correct, now measured rather than assumed.

Corollary: nothing may cache a sid across a display change. The pre-flight existence check (`SLSSpaceGetType(cid, sid) == 0`) must run against a freshly enumerated sid, never a remembered one.

#### Two further confirmations from the same run

- **The dock does not break display identity.** The Studio's `CGDisplayCreateUUIDFromDisplayID` value survived a full round trip through the CalDigit TS5 unchanged. Residual 2's hub/adapter worry did not reproduce on this hardware — one cycle, so not a general rule, but the setup that matters is clean.
- **Spaces return to their original display.** The 16 went back to the Studio in identical order with identical UUIDs, and the built-in regained its own Space. macOS performs the round trip itself, corroborating the yabai-sourced claim in note-window's research.

*Sibling check: note-window — its resolution ladder (display identity · Space UUID · ordinal index) and its "resolution never rewrites intent" rule are unaffected; this measurement corrects the factual basis under rung 3 and lowers its expected frequency. note-model — its position that per-note home display is Machine-tier state is unaffected, as the concern's own scope note anticipated.*

### Do the private Space APIs actually need the Accessibility permission?

*From: engine-architecture · discussion · 2026-08-12*

**Answered: no — no TCC grant of any kind.** The entry's own stated doubt was correct, and for the reason it proposed: TCC's Accessibility grant governs *controlling other applications*, and Fumi placing Fumi's windows is not cross-application.

Measurements are recorded above under *No TCC permission is needed to place your own windows* — own-window moves succeeding with SIP enabled, ad-hoc signed with no entitlements and again inside a verified App Sandbox container, producing no Accessibility, Screen Recording or Automation prompt, with no scripting addition and no SIP change. The assumption's origin was ownership, not privilege: yabai's scripting-addition apparatus exists because it manipulates *other applications'* windows, and its permission story was inherited along with its technique.

Two adjacent facts that narrow the first-run surface further: reading a window's home Space is public API (`$top.NSWindowWorkspaceID`), and display identity is the public `CGDisplayCreateUUIDFromDisplayID`. Only *placement* is private.

**The answer was routed back to the two topics resting on it** — triage is one-way, so absorbing here would have left both holding a disproven assumption:

- `onboarding-and-permissions` (research) — its brief scopes a first-run wizard around requesting this grant; the premise is gone and the scope needs re-deriving. Delivered as `003-no-accessibility-grant-needed`.
- `engine-architecture` (discussion, was `completed`, now reopened) — its 2026-08-12 login-item decision re-homed the post-grant restart onto the wizard; that restart may not be a requirement at all. Delivered as `001-no-permission-restart-to-re-home`.

Both entries carry the caution that "no Accessibility" is not "no permissions" — the measurement covers Space placement specifically, not file access to the store folder, notifications, or login-item registration.

**Unchanged:** the App Store consequence. Every route to placing a window on a non-active Space is private API, so Developer-ID direct distribution stands. Only the runtime permission story moved.

*Sibling check: engine-architecture — its 2026-08-12 decision to drop the launchd agent for a plain login item stands; only the permission-restart driver behind one of its accommodations is withdrawn, and that is delivered to it for its own call rather than decided here.*

### The N-window launch burst — acceptance test executed 2026-08-25 (review-001 F3)

The review's charge was fair: the file defined the acceptance bar in the user's own terms — *Mission Control immediately after launch, every fumi on its own Space* at 15–16 Spaces — and then measured only ever **one** window to **one** Space. The primitives were measured and the burst inferred. Now run. Probe: `scratchpad/t/burst.m`.

**Method.** Enumerate the main display's Spaces; create one `NSWindow` per Space with `defer:NO`, all **ordered out**; place each on its target Space with `SLSMoveWindowsToManagedSpace` while still invisible; then order every one in with `orderWindow:NSWindowBelow relativeTo:0` — the non-activating show Chromium's rule requires. Then a separate two-window batch onto a single Space in one call.

```
timings: create 135 ms | +place 135 ms | +show 242 ms   (16 windows)

verification -- where each window actually landed:
   ord  1  want sid 1    got 1     ok
   ord  2  want sid 3    got 3     ok
   ...
   ord 16  want sid 17   got 17    ok

16 placed correctly, 0 wrong.
batch call (2 windows, 1 call) -> landed on sid 3   (wanted sid 3)
```

**Confirmed by human inspection, not only by readback.** The user opened Mission Control and reported a `BURST` window present on **every** Space of the main display, none on the secondary (correct — only main-display Spaces were targeted), and the `BATCH` pair doubled up on Space 2 / sid 3 as directed. No Space switch was reported during the burst. *(An artifact worth recording so the screenshots are not misread: two windows appeared per Space because two harness processes were live at once — a `pkill -f '/t/burst'` pattern that never matched the `./burst` command line left the first run running. A harness bug, not a placement one.)*

**Latch-then-show holds at N.** Sixteen windows latched while invisible and ordered in together all materialised on their targets; ordering discipline did not degrade in a burst.

**Batching: the plural call is genuinely plural — corrects an inferred claim.** The file previously carried *"There is no batch-placement API"* (deep-dive F4, marked inferred from Chromium's per-window code path). That is true of the **AppKit** route only. `SLSMoveWindowsToManagedSpace(cid, windowList, sid)` accepts a window **list**: two windows to one Space in a single call, both landed. Placement cost for all 16 was ~135 ms even issued one call per Space, so batching is an available optimisation rather than a necessity.

**Cost at realistic note counts remains unsized** — these were bare `NSWindow`s, not fumi windows with Liquid-Glass chrome, Markdown editors and autosave wiring. Launch latency and memory at a realistic library are still open (review-001 F6 covers the window-type gap).

### The cold login path (review-001 F2)

**The measurement base named honestly:** every placement measurement in this file was taken in a *warm session* — a desktop in use for hours, all Spaces already materialised, windows created by hand from a terminal. Fumi's primary launch is an `LSUIElement` app started by a login item while macOS is still bringing the session up. The discovery brief's original worry — *"the move fails silently if attempted before the window is realised or the WindowServer is ready"* — is a cold-boot condition, and this file dismissed it on warm-session evidence.

**What is actually at stake.** Placing to a Space that does not exist is a silent no-op (measured, twice). So if Spaces materialise *lazily* at login rather than all at once, Fumi would place notes onto not-yet-existing Spaces, they would pile onto the active Space, and nothing would report an error — on every login, in the one situation the feature exists for.

**Evidence already in hand.** The 16-window burst placed windows on all 16 Spaces from a single active Space, including Spaces not visited in that session; all 16 landed. So *unvisited Space is placeable* holds within a warm session. The untested residue is narrower than the finding frames it: only whether that remains true in the first seconds after login.

**Parked, not tested** (user's call, 2026-08-25; user's own read: Spaces are created and all exist immediately). Rationale: residual risk small, the test costs a reboot, and the failure signature would be unmissable on day one of implementation — every note on Space 1 at login. Recorded so a later reader knows it was weighed rather than missed.

#### Two placers at reboot — a genuine interaction, unexamined until now

F5 established that AppKit *does* restore windows to Spaces on a **system restart** — the one case macOS handles natively. So at a reboot, macOS may place Fumi's windows from its saved application state at the same moment Fumi places them from its own store. Two systems, each believing it owns the answer.

*Orchestrator's opinion (not a decision):* Fumi's windows should set `restorable = NO`, keeping them out of macOS's saved-state mechanism so Fumi is the only placer. Deterministic, and cheap.

**Consequence the discussion phase should weigh:** this pulls against the AppKit route, which places *through* restorable state — a route cannot opt out of the mechanism it uses to place. The SkyLight route carries no such entanglement. That is a second discriminator between the routes, independent of the failure-shape argument (F7 of the deep dive), and it points the same way. Recorded as evidence and an opinion; the route remains a discussion-phase call and the tradeoff table above stands as written.

### Fullscreen Spaces — measured 2026-08-25 (review-001 F1)

The one discovery open question never opened. Settled empirically with Safari fullscreened on the main display. Probe: `scratchpad/t/fs.m`.

**1. A fullscreen Space appears in the per-display array, at an ordinal slot, with type 4 and a real UUID.**

```
   ord | sid  | type | dict-type | uuid
    16 | 17   |    0 |         0 | 2583B79D-A871-4D25-A18A-567533B4FFAB
    17 | 391  |    4 |         4 | 417DD18F-8B59-4D20-BA25-A4B69534AA2D   <== fullscreen
```

`SLSSpaceGetType` and the dictionary's own `type` field agree on `4`. This **confirms the deep-dive source's taxonomy** (user `0`, system `2`, fullscreen `4`) and corrects the confidence of Residual 4's *"type 0 means a real user Space; nothing else does"* — that claim behaves correctly (a type-0 check excludes fullscreen) but was stated on a sample containing no fullscreen Space. It is now evidenced rather than lucky.

**2. Ordinals shift when a fullscreen app opens or closes.** The fullscreen Space took ordinal 17 — it occupies a slot in the array, and appeared at the end of the Mission Control strip too. So "Space 7" denotes a different Space depending on whether an app is fullscreened. This lands on both consumers of the ordinal: the CLI's `--space N` and ladder rung 2. Whether user-facing ordinals should *count* fullscreen Spaces is a design question (agent-surface owns the CLI's argument semantics); the fact that they shift is this topic's to supply.

**3. An ordinary floating window can be placed on a fullscreen Space — and is genuinely rendered there.**

```
requested sid=391  ->  landed on (391)   isOnActiveSpace=0
```

Confirmed visually: with a window held on sid 391, the user swiped to the fullscreen Safari Space and found the probe window **visibly floating over fullscreen Safari** in the lower-left quadrant. Safari remained fullscreen; the swipe felt normal; nothing flashed or vanished. This is not the placed-but-invisible failure mode seen elsewhere in this topic — it renders.

**This contradicts a premise note-window is holding.** Its checkpoint routed here states *"an ordinary floating window cannot join it, so 'the currently active Space' has no valid answer when the global hotkey fires from full-screen Safari."* True of the public API — `NSWindowCollectionBehavior` offers no way in — and false of the private one. So the question note-window framed as unanswerable has an ordinary answer: a fumi can be born on the fullscreen Space the user is actually looking at, which is what "current Space" plainly means to them.

**New consideration this raises: fullscreen Spaces are ephemeral.** They are created when an app enters fullscreen and destroyed when it leaves — unlike user Spaces, which persist. A fumi homed to one dangles as soon as the user exits fullscreen, and would take the deleted-home path on the next launch. Whether a fumi should be *homeable* to a fullscreen Space at all, or should be born there but home to the underlying user Space, is a design question the record does not currently anywhere ask. Flagged, not answered.

*Sibling check: note-window — its checkpoint (`note-window.md:848`) names this topic as owner of the private-API behaviour question and is answered by measurement 3 above; its Positioning decision that a new fumi is born on the currently active Space of the pointer's display now has a defined behaviour in the fullscreen case. Delivered back to note-window rather than decided here.*

### Two fallback destinations that disagree (review-001 F9)

This file carries both of the following without noticing they conflict:

- **Discovery's rule**, restated three times here — a note whose remembered home Space no longer exists falls back to **Space 1**, with the file adding that this needs explicit code because both placement routes degrade to the *active* Space instead.
- **note-window's ladder**, quoted and applied here — UUID gone with the display present → the **ordinal index on that display**; display absent → **main display, clamped**. Space 1 appears nowhere in it.

Same event, different destinations. The case where it matters most is the one note-model already decided against: a **restored or new Mac**, where every home dangles at once. Space-1 gives every note stacked on Space 1 — ugly but findable. The ladder scatters notes across Spaces by stale ordinals — which looks like it worked and has not. note-model's tier decision assumes the Space-1 behaviour and hands the mechanism here.

**Reconciliation to consider (not settled — spans note-model's tier decision and note-window's ladder, neither of which is this topic's to move).** The two are not competing rules for one case; they are rules for two different failure *shapes*, and this file muddled them by treating "home doesn't resolve" as a single event:

| Failure shape | Example | Why that destination |
|---|---|---|
| Home **temporarily** unresolvable | Display unplugged; the external's first Space destroyed on undock | The surrounding Spaces are still this machine's, so the ordinal is a reasonable guess — the ladder's rung 2 |
| Home **permanently meaningless** | Different Mac, restored library, imported store | No local context to guess from; an ordinal guess produces confident nonsense — Space 1 |

On that reading the ladder gains a **precondition** rather than a competitor: attempt the ordinal only when the Space set is plausibly *this machine's*; fall to Space 1 when it is not. The discriminator is whether the home was ever valid here, which is knowable — a home written on this machine and one arriving from another are distinguishable in the store (note-model's Machine-tier state).

*Orchestrator's framing, user concurred in session 2026-08-25. Recorded as the reconciliation to weigh in discussion, not as a decision.*

*Sibling check: note-model — its tier decision holds that per-note home display is Machine-tier state and that a restored Mac falls back to Space 1; this framing is consistent with it and supplies the discriminator its mechanism needs. note-window — its ladder is unchanged in shape; what is proposed is a precondition on rung 2, delivered for its own call.*

### Measurement base — stated plainly (review-001 F13, and the caveat this file was missing)

Everything measured in this topic was run on **one machine**: macOS 26.5.2 build 25F84, arm64, SIP enabled, two displays (Apple Studio Display as main + MacBook Pro built-in) joined by a CalDigit TS5 dock, 16 user Spaces on the main display and 1 on the secondary. Single OS version, single topology, single dock cycle. The upstream deep dive stated these limits; this file absorbed its results and dropped the caveats until now.

~~**Why it matters against the project floor.** The project minimum is **macOS 14+** (a decided, project-wide constraint from CloudKit's `CKSyncEngine`, recorded in build-and-release).~~ *(Amended 2026-09-11 — wrong on both halves. The floor is **15+ across the board** (user's call, 2026-08-30, recorded in this topic's discussion under* One implementation, because the OS floor moved*), and CloudKit is not what sets it: 14 was a minimum inherited from `CKSyncEngine`, never a decision to support macOS 14, and the floor moved on the **placement route**. `CKSyncEngine`'s 14.0 annotation is now slack beneath the floor.)*

**The build target is macOS 26, the supported floor is 15+** *(user's call, 2026-09-11)*. Fumi is built against the current macOS on the development machine; backwards compatibility down to the floor is deferred until after the thing is built. So the supported range is 15 and 26, and 15 is a verification owed later rather than a constraint shaping the build now.

**What the measurement base means under that.** Everything here ran on macOS 26.5.2 — which is the build target, not a gap against it. What stands unrun is 15, Intel, and a single-display machine (the last being the majority configuration), and 15 matters more under this floor than under the old one: it is now the oldest version Fumi claims to support, and nothing has executed on it.

Specific consequences, unpriced:

- ~~**The leaning AppKit route's mechanism inverts below macOS 15.** Chromium restricts `NSWindowRestoresWorkspaceAtLaunch` to macOS 14 and earlier and uses private `NSWindowRestorationOptions` for 15+. This file recorded "the documented-ish route is dead on macOS 15+" without the other half: on macOS 14 the private class may be absent or wrong. That is potentially **two implementations** of the leaning route, which the degradation-shape comparison did not price.~~ *(Struck 2026-09-11 — superseded by the floor move above, which is what killed it: the private `NSWindowRestorationOptions` class exists from 15 onward, so with a 15+ floor there is no version inside the supported range needing the other mechanism. Kept visible rather than deleted because the two-implementation risk is the argument that moved the floor.* **What survives is narrower:** *Chromium's version gate establishes the class **exists** from 15; nothing establishes the mechanism **behaves** the same across 15–26. Under the build-for-26-first ordering that span check is deferred work, not a live blocker — if 15 misbehaves the containment is to raise the floor, not to rewrite the placement layer.)*
- **The SkyLight sweep is one OS.** `CGSAddWindowToSpace` vanishing between the discovery brief and today is this file's own demonstration that the surface moves; nothing establishes what resolves on ~~14 or~~ 15. yabai version-tiers across 12.7 / 13.6 / 14.5 / 15. *(2026-09-11 — 14 is below the floor; only 15 is owed.)*
- ~~**The OS range Space homing is expected to work across is never stated**, and that is the input a kill-switch or graceful-degradation decision needs.~~ *(Struck 2026-09-11 — the range is stated: supported 15+, built against 26. The kill switch it points at no longer exists either — rejected outright by this topic's discussion on 2026-08-30.)*

### Window shape does not affect placement — measured (review-001 F6)

Every earlier measurement used a plain titled window; a fumi is borderless, may sit at floating level, and is hosted by an accessory-policy app with no Dock icon. Re-run across four shapes from an `NSApplicationActivationPolicyAccessory` app (`scratchpad/t/wintype.m`):

```
A. plain titled (baseline)               NSWindowWorkspaceID: YES   move OK
B. BORDERLESS (a fumi)                   NSWindowWorkspaceID: YES   move OK
C. BORDERLESS + Float-on-Top (level 3)   NSWindowWorkspaceID: YES   move OK
D. BORDERLESS + Float + restorable=NO    NSWindowWorkspaceID: YES   move OK
```

No difference on either route. The earlier measurements were not taken on the wrong object.

One precision worth keeping: case D still emits `NSWindowWorkspaceID` because `encodeRestorableStateWithCoder:` was called directly. The `restorable` flag governs whether **AppKit** saves state automatically, not whether the method works — so `restorable = NO` keeps a window out of macOS's own saved-state machinery while leaving the blob available to read.

### The AppKit route outside Chrome's exact usage (review-001 F4)

Every AppKit measurement had replayed a **captured** blob into a fresh not-yet-shown window — Chrome's usage and nothing else. Fumi needs three things Chrome does not.

**1. A synthesised blob — measured, works** (`scratchpad/t/synth.m`). This is the seam between the file's two recorded leans: storing *explicit fields* means constructing an archive rather than replaying one.

```
synthesised blob: 242 bytes (a captured one was ~1400)
  $top keys: NSWindowWorkspaceID, NSWindowFrame
before restore: sid=-1
after restore : sid=9   isOnActiveSpace=0   (target sid 9)
```

A two-key archive built from stored values alone, never captured from any window, placed a borderless window on the target Space. **The two leans are compatible.** Caveat recorded honestly: the `NSWindowFrame` key did *not* apply — the encoding used here does not match what AppKit expects — so geometry would come from `setFrame:` rather than the blob. Irrelevant in practice; the blob's job would be Space placement only.

**2. Moving a live, already-visible window — works** (deep-dive experiment H): `restoreStateWithCoder:` with the hook armed moved an already-visible window to another Space. So the AppKit route is not launch-only and can serve `fumi mv --space N`. This corrects the tradeoff table above, which lists "move a live window at any time" as a SkyLight-only capability — it is not.

**3. Live create onto a non-current Space** on the AppKit route remains untested; measured only on SkyLight (ordered-out placement to sid 7).

### "Every route is private" — tested against 59 shipping apps (review-001 F5)

The file's most expensive claim — the corrected derivation for off-App-Store distribution — rested on the three implementations inherited from the discovery brief. Widened: every app in `/Applications` (59), scanning main executables **and** embedded frameworks and helpers, since Chrome carries its symbols in a framework rather than its executable.

**Ten apps carry the private AppKit hook** — `_windowRestorationOptions` and `NSWindowRestorationOptions`:

```
1Password  Claude  Discord  Figma  Google Chrome
Obsidian   Paper   Signal   Slack  Spark Desktop
```

All Chromium/Electron-derived — they inherit it from the CL this file already traced.

**Zero apps carry any SkyLight placement symbol** (`SLSMoveWindowsToManagedSpace`, `CGSAddWindowsToSpaces`, `SLSAddWindowsToSpaces`, `SLSSetWindowListWorkspace`).

**No counter-example using a public route was found.** The claim moves from "we looked at three apps" to "we scanned every app on this machine and found no public route", which is the standard a distribution decision should rest on. Limits: one machine's 59 apps, and symbol-name matching cannot see a route that uses no distinctive symbol.

**This revises the orchestrator's earlier route lean, and the argument that moved it.** The failure-shape argument (AppKit degrades quietly, SkyLight crashes on a null pointer) previously pointed at SkyLight, reinforced by the `restorable = NO` entanglement. The exposure evidence points the other way and is stronger than I credited: `_windowRestorationOptions` is load-bearing for the entire Electron ecosystem on this machine — Slack, Discord, Figma, 1Password, Signal, Claude — so Apple breaking it breaks Space restoration across a large installed base. `CGSAddWindowToSpace` was removed with, on this evidence, no shipping app depending on it. **Ecosystem breadth is a stability signal, and it favours AppKit.** Recorded as a revised opinion, not a decision; the route remains discussion's call, now with three considerations pulling in two directions (failure shape → SkyLight; `restorable = NO` entanglement → SkyLight; ecosystem exposure → AppKit).

### The empty-UUID result is narrower than this file claimed (review-001 F7)

*"Space 1 carries an empty UUID, everywhere"* over-reaches its own evidence. The same enumeration shows the secondary display's ordinal-1 Space (sid 19) carrying a **real** UUID, and the 2026-08-25 capture shows the empty-UUID Space travelling with the **main display's list**, not with the machine. Corrected statement: **the main display's first Space carries the empty UUID** — measured on a machine whose secondary display had exactly one Space.

Three consequences, all unmeasured, all bearing on whether `""` is a usable identity key:

- **Uniqueness — the one that matters.** If a secondary display with two or more Spaces also gets an empty-UUID first Space, then `""` names two different Spaces, and a note homed on the secondary would resolve onto the main display. **Settled by one probe run after adding a second Space to the laptop.** Until then, `""`-as-identity rests on a topology that cannot exhibit the collision.
- **What the empty UUID attaches to** — sid 1, or "first slot of the main display's list". Two live changes discriminate: deleting Desktop 1 in Mission Control, and changing which display is main (a Displays-settings drag, needing no logout — unlike the spans-displays flip).
- **Cross-machine.** Every Mac has a `""` Space, so a note homed to Space 1 is the one home that *does* resolve on another machine — silently, onto a Space unrelated to the original. Consistent with note-model expecting Space-1 fallback there, but it arrives by coincidence rather than by the fallback path, which is worth knowing.

### UUID durability — measured across one display cycle only (review-001 F12)

The file states *"identity is the managed-space UUID — correct, now measured rather than assumed."* What was measured is **one docked → undocked → redocked cycle**. Discovery's actual claim is that the UUID persists across **reboots and Space reordering**; neither leg has been touched.

- **Reboot / logout** — the launch that matters most, and the one case where AppKit's own restoration also fires. Parked with the cold-login test above.
- **Space reordering** — dragging Spaces in Mission Control is the exact scenario discovery cited for rejecting ordinals as identity, and note-window names it as the ladder's known limitation. Never exercised.

**The persistence substrate — measured, and it contradicts a premise note-model holds.** note-model delegated this here: *"macOS Spaces have no identity surviving an erase-and-reinstall (they are persisted to neither iCloud nor Time Machine) … The how Space degrades/persists detail is space-homing's domain."*

```
~/Library/Preferences/com.apple.spaces.plist   2.4 KB
tmutil isexcluded  ->  [Included]
$top keys include:  Display Identifier | Spaces | Current Space |
                    ManagedSpaceID | uuid | type | windows | app-bindings
```

The plist is **not excluded from Time Machine** — it is backed up like any other preference file. It also carries `windows` and `app-bindings` per Space, which is the substrate behind the original fork's hypothesis (b): the WindowServer does persist per-Space window/app associations.

Stated precisely, because the distinction matters: the plist **is** captured by Time Machine. Whether restoring it onto another machine reinstates Space identity is **unverified** — the WindowServer plausibly regenerates UUIDs against actual display hardware, which would make the restored file inert. So note-model's conclusion may well hold; its stated *reason* ("persisted to neither iCloud nor Time Machine") does not, as far as Time Machine goes. Routed back to note-model rather than resolved here, since a Machine-tier decision and the whole cross-machine fallback story rest on it.

### `research/space-homing.md` still states a macOS 14 floor, and reading it alone reproduces the error

*From: platform-support · research · 2026-09-06*

The ask: this research file's floor figure contradicted this topic's own discussion file. `discussion/space-homing.md` records the user's 2026-08-30 call — **15+ across the board**, moved on the placement route rather than on CloudKit. The *Measurement base* section above still opened with *"the project minimum is **macOS 14+** … from CloudKit's `CKSyncEngine`"*, wrong on both the number and the attribution.

Not hypothetical: on 2026-09-02 `platform-support` read this file, took 14 as current, and wrote a measured section stating the supported range as "14, 15, 26" with CloudKit named as the cause. The user caught it in session. That file was corrected; this one was not, so the trap stayed armed for the next reader of a document every later topic treats as ground.

**What the session settled (2026-09-11).** Three sites were amended in place above rather than deleted, since the superseded text is what explains the floor move.

- The floor sentence is corrected to 15+ with CloudKit removed as its cause.
- The two-implementation bullet is struck — the floor move is precisely what killed it. What survives is narrower and is recorded there: the private class **exists** from 15, but nothing establishes it **behaves** identically across 15–26.
- The "range is never stated" bullet is struck — it is stated now.

**The user's steer, which is the substantive addition: build against macOS 26, support 15+, defer backwards compatibility until after the thing is built.** Fumi is built against the current macOS on the development machine. This re-reads the measurement base rather than weakening it — every probe in this file ran on 26.5.2, which is the build target, so the evidence is aligned with what is being built, and 15 becomes a verification owed later rather than a constraint shaping the build now. The residual span question (15–26 behavioural uniformity on the AppKit route) is parked on the same basis: its containment is to raise the floor, which is a shipping decision, not a rewrite of the placement layer.

The floor and the build target are both project-wide facts and neither is this topic's to hold — the floor was already delivered to `build-and-release` (queue entry `009`), and the build-target ordering is routed to it on the same grounds (entry `013`).

*Sibling check: platform-support — its research file already carries the floor correction (*Correction — the floor is already 15*, 2026-09-02) and states the range as 15 and 26; nothing there is displaced, and its open item* "what a user on the oldest supported version actually gets — nothing has run on 15" *is unchanged in substance and now has a stated reason for standing open. build-and-release — fresh, never opened, and its queue already holds the floor change; the build-target ordering joins it rather than being decided here.*
