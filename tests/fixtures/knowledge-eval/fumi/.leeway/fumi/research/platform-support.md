# Research: Platform Support

Which macOS versions Fumi supports, what happens on a version that cannot do everything, and how the user finds out. Prompted by gap analysis: three completed artifacts each set a version constraint, and no topic owns the join or the degradation story.

## Starting Point

What we know so far:
- ~~**A floor exists.** `storage-and-sync` fixed the minimum at macOS 14 via CloudKit's `CKSyncEngine`; `build-and-release` recorded it as a hard minimum that propagates everywhere.~~ *(Amended 2026-09-05, review-002 F4 — superseded before this topic opened: the user moved the floor to **15+** on 2026-08-30 in `space-homing`'s discussion, on the placement route rather than CloudKit. See* Correction — the floor is already 15 *below.)*
- **The floor is not uniform.** `space-homing` measured that the Space-placement mechanism differs across the supported range: Chromium restricts `NSWindowRestoresWorkspaceAtLaunch` to macOS 14 and earlier and uses the private `NSWindowRestorationOptions` from 15 onward — so the leaning AppKit route may need two implementations inside the range, or may not work on 14 at all. yabai version-tiers its own handling across 12.7, 13.6, 14.5 and 15.
- ~~**The private surface churns.** The SkyLight symbol sweep was run on macOS 26 only. `CGSAddWindowToSpace`, the symbol the discovery brief named, no longer exists.~~ *(Struck 2026-09-02, deep-dive-001 F1 — the symbol never existed under that spelling; see* The `CGS` namespace never churned *below. What survives of this point is only that the sweep was run on macOS 26 only.)*
- **Every probe ran on one machine.** arm64, macOS 26.5.2. Nothing establishes what resolves on 14 or 15, on Intel, or on a single-display Mac — the majority configuration.

What has no owner *(as framed at intake — four of five resolved during the session; kept for the record, marked inline)*:
- ~~The supported version range as a stated product fact.~~ **Decided, not open** — 15+, user's call 2026-08-30; it had no *landed home*, which is a different problem. Routed to `build-and-release` (queue `010`).
- What a user on the oldest supported version actually gets. **Still genuinely open** — nothing has run on 15.
- ~~Whether Space homing degrades silently, degrades visibly, or gates the version out.~~ **Decided by `space-homing` before this topic opened** — silently, logged, no notice.
- ~~The shape of the kill switch `space-homing` recorded as an option (a local preference disabling homing and falling back to opening on the current Space) and who owns turning it.~~ **There is no kill switch** — rejected outright by `space-homing` on 2026-08-30.
- ~~How a future macOS release breaking the private surface is detected and communicated, rather than discovered in support tickets.~~ **Reframed and routed** — the private surface is not the volatile one; detection is capability resolution plus the beta channel, routed to `build-and-release` (queue `011`).

Sits across `build-and-release` (owns what ships and the Sparkle update path), `space-homing` (owns the private-API surface) and `storage-and-sync` (set the floor). Each has a piece; none owns the matrix~~, and `space-homing` concluded without stating the range its findings apply to~~. *(Struck 2026-09-06 — false. `space-homing`'s discussion states the range as 15+ and carries a whole `OS Range And Degradation` section. This intake framing was written from its **research** file, which is the stale one — the trap described under* Correction — the floor is already 15*.)*

---
## Measured ground (2026-09-02)

Everything below was run against the toolchain on this machine — `sw_vers` → macOS 26.5.2 build 25F84, arm64; `xcrun --show-sdk-version --sdk macosx` → 26.5. *(Re-run 2026-09-06: `sw_vers` → **26.6.2 build 25G83**. The machine took a point update mid-session. Every measurement below was re-verified on it and is unchanged; noted because a topic about version churn should say when its own baseline moved.)*

**The range is three OS versions, not thirteen.** Apple's version numbering jumped 15 → 26, so a floor at 14 means supporting exactly **14, 15, 26**. *(Amended 2026-09-05, review-002 F4 — the floor is **15**, so the range is **15 and 26**: two versions. The discontinuity point stands; the arithmetic does not.)* The SDK's own list of deployment targets makes the discontinuity explicit:

`plutil -extract SupportedTargets.macosx.ValidDeploymentTargets json -o - "$(xcrun --show-sdk-path --sdk macosx)/SDKSettings.plist"` →
```
["10.13","10.14","10.15","11.0",…,"13.5","14.0","14.1","14.2","14.3","14.4","14.5","14.6",
 "15.0","15.1","15.2","15.3","15.4","15.5","15.6","26.0","26.1","26.2","26.3","26.4","26.5"]
```

**The tooling does not force the floor.** The 26.5 SDK still accepts deployment targets down to 10.13 (above). Whatever sets Fumi's minimum, it is not Xcode.

**The CloudKit floor is real and is exactly 14.0.** `storage-and-sync` asserted this from documentation; measured in the SDK header:

`grep -B1 'interface CKSyncEngine :' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/CloudKit.framework/Headers/CKSyncEngine.h"` → the class is annotated `API_AVAILABLE(macos(14.0), ios(17.0), tvos(17.0), watchos(10.0))`.

**Liquid Glass is exactly 26.0, with no back-deployment.** Every entry point the note-window surface leans on is annotated `@available(iOS 26.0, macOS 26.0, tvOS 26.0, watchOS 26.0, *)` in the shipped `.swiftinterface`:

`grep -B2 'GlassButtonStyle\|func glassEffect' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/SwiftUI{,Core}.framework/Modules/*.swiftmodule/arm64e-apple-macos.swiftinterface"` → `GlassButtonStyle` / `.glass`, `GlassProminentButtonStyle` / `.glassProminent`, `glassEffect(_:in:)`, `glassEffectID`, `glassEffectUnion`, `glassEffectTransition` — all macOS 26.0.

~~So the constraint set as measured: **CloudKit pins the floor at ≥ 14. Liquid Glass pins it at ≥ 26 for anything that uses it.** The gap between those two numbers is what this topic has to resolve, and it spans exactly two supportable versions.~~ *(Amended 2026-09-05, review-002 F4 and review-001 F8 — wrong twice over, and this was the file's most quotable line. **CloudKit does not pin the floor**: the floor is 15, set on the placement route, and the `CKSyncEngine` 14.0 annotation is slack beneath it. **Liquid Glass pins nothing either**, because the drawn design uses none of the entry points — see* What the note surface actually needs *below. Both measurements above stand as measurements; neither constrains the range. What the topic actually had to resolve was the Space-placement mechanism, not the material.)*

## What the note surface actually needs — measured against the Paper spike (2026-09-02)

The queued concern from `note-window` states the surface "assumes Liquid Glass… structurally rather than decoratively". Prompted by the user, the spike itself was read rather than the prose describing it — file **Fumi — Note Window Spike**, board `01 — Surface & Chrome`, the focused note. Computed styles, verbatim:

```
borderRadius:     14px
backdropFilter:   blur(40px) saturate(180%) brightness(106%)
boxShadow:        #FFFFFFD9 0px 1px 0px inset,      ← the "specular top edge"
                  #080A1E1F 0px 2px 4px,
                  #080A1E80 0px 26px 54px -18px
backgroundColor:  #F4F5F7D4
backgroundImage:  linear-gradient(in oklab 155deg, oklab(100% 0 0 / 50%) 0%,
                                  oklab(100% 0 0 / 8%) 36%, oklab(100% 0 0 / 0%) 68%)
border:           1px solid #FFFFFF94
```

The `Aa` popover: `backdropFilter: blur(30px) saturate(180%)`, `backgroundColor: #EDEFF6EB`, `borderRadius: 14px`. The close and `•••` controls: 13×13 frames, `borderRadius: 99px`, `backgroundColor: #1C20291C` — flat tinted circles, no material. Fonts across the file are **Inter** and **Geist Mono**, not SF Pro.

**So the drawn design is bespoke, not systemic.** Blur-behind, a 1px inset white highlight, a gradient sheen, a rounded rect, a drop shadow. Not one of those is a macOS 26 API. ~~Blur-behind is `NSVisualEffectView`, whose semantic materials are annotated `API_AVAILABLE(macos(10.11))` for `Menu`/`Popover`/`Sidebar` in the shipped AppKit header — thirteen years below the CloudKit floor.~~ *(Corrected 2026-09-05, review-002 F7 — right conclusion, wrong API; see* The parameterised blur is `backgroundFilters`, not `NSVisualEffectView` *below.)*

**The written record already narrowed the dependency further, in two places the triage entry doesn't cite:**

- *"the note surface does not use system vibrancy"* (note-window, decided, corrected 2026-07-29). The largest surface in the design **already opted out of the system material** — because vibrancy resolves label colour against system appearance, which is wrong when the background is a user-chosen swatch. Swatch-owned foregrounds instead.
- The agent shimmer is *"an angular gradient stroked around the window's rounded rect, masked to the edge, blurred, with the gradient rotating slowly"* — explicitly **not a public API**, hand-drawn either way. The document says Liquid Glass "helps rather than hinders" by giving the sheen "something real to ride on" — an enhancement, not a requirement, and its own Reduce Transparency answer already survives an opaque surface.

**What is left genuinely bound to 26** is much smaller than the concern states, and looks like one item:

- **`.glass` button style + vibrancy SF Symbols on the close and `•••` controls** (note-window: *"so it stays legible on any palette tint and at any opacity by construction"*). Measured: `GlassButtonStyle` / `.glass`, `.glassProminent`, `glassEffect(_:in:)`, `glassEffectID`, `glassEffectUnion`, `glassEffectTransition` are all `@available(macOS 26.0, *)` with no back-deployment. But the spike doesn't use it — it draws flat tinted circles — and the *by construction* legibility argument is exactly the argument the note surface already rejected for its own text, and solved by hand with swatch-owned foregrounds.

**Open, and the real question underneath.** The document is explicit that the spike is not the fidelity target — *"the real SwiftUI + Liquid Glass rendering takes precedence over anything drawn here… Where the spike and the material disagree, the material wins"* — and it books a **colour-and-material checkpoint** to tune against real Liquid Glass at implementation. So the collision is not spike-vs-prose; it is that the design's *intended* final material was never priced against a version range. What is not yet established: whether a hand-drawn surface at the spike's fidelity is the *same* design on 14, 15 and 26, or a visibly lesser one — and that is a look-at-it judgement no amount of header-reading settles.

### The note surface is specified in a macOS 26 material against a macOS 14 floor

*From: note-window · discussion · 2026-09-01*

**The concern as it arrived.** Every surface decision in note-window assumes Liquid Glass, and assumes it structurally rather than decoratively: the glass panel boundary is what makes edge-and-corner resize discoverable ("material edge + ~12–14 corner radius + sheen + drop shadow"); the close and `•••` controls are monochrome SF Symbols via `.glass`, chosen so they stay legible "on **any** palette tint and at **any** opacity **by construction**"; the agent shimmer animates the material itself, because "the specular top edge gives the sheen something real to ride on"; and the substrate-relative treatments (tag pill, attachment chip, inset block) lean on system materials going "opaque under Reduce Transparency automatically", with panels and menus separated as surface classes partly by material. Liquid Glass ships with macOS 26; the `CKSyncEngine` floor is 14. note-window asked that the material join this topic's constraint set before the range is stated, and said what it needed back: a floor at 26 leaves its decisions untouched, a range below it owes a defined pre-26 rendering for the panel, the controls, the shimmer and the panel/menu distinction. It also flagged, honestly, that its Reduce Transparency degradation (opaque solid tint, solid high-contrast text) happens to describe a shape that would serve as a pre-26 rendering — but that reusing it would be a decision, not an inference.

**What the measurement did to it.** Three of the four load-bearing claims do not survive contact with the spike — see *What the note surface actually needs* above. The panel boundary is `border-radius: 14px` plus a 1px inset white `box-shadow` plus a `box-shadow` stack; the shimmer is stroke-based by note-window's own decision and "not a public API" either way; the substrate treatments and the panel/menu split ride on `NSVisualEffectView`, whose `Menu`/`Popover`/`Sidebar` materials are annotated `API_AVAILABLE(macos(10.11))`. The fourth — `.glass` on the two corner controls, the one genuine 26 binding — is not what the spike draws either: the controls are 13×13 frames at `borderRadius: 99px`, `backgroundColor: #1C20291C`, flat tinted circles.

**Sibling check: note-window — its own later decision already specifies the flat circle, and the `.glass` text was never struck.** *control geometry & note padding (from the chrome spike)*, amended 2026-09-01, pins "**Control = a clean filled circle, 23px, no container well** … Ghostty's are plain circles"; *hover feedback is a third mechanism again* describes "**hovering a control darkens it and reveals its glyph** — the close circle shows its `✕`", called "macOS traffic-light behaviour, monochrome". A filled circle whose fill darkens on hover is not a `.glass` button. Lines 81 and 94 of note-window — "Monochrome SF Symbol via **vibrancy / `.glass` button style**" and "**Implementation reference:** … `.glass` button style + vibrancy SF Symbols for the controls themselves" — are residue from before the chrome spike. That correction is note-window's to make and is rerouted to it; nothing in this topic turns on which way it lands, because the drawn design is the same either way.

**What the user settled (2026-09-02).** The remaining half of the concern was not technical: note-window books a **colour-and-material checkpoint** at implementation to tune the surface against real Liquid Glass, and states that the real rendering "takes precedence over anything drawn here". Below 26 that checkpoint has nothing to tune against — the hand-drawn material *is* the final material, and has to be judged on its own rather than as an approximation of something better. Put to the user as the fork: hand-drawn surface as the real thing, or proper glass on 26 with a visibly plainer note on 14/15.

> **The hand-drawn surface is close enough to spike out at implementation, and the answer isn't knowable before it is mocked up for real.**

So the checkpoint note-window already booked is where the look gets settled, and it does not need a version answer first.

**The constraint this topic takes from it: the note surface's material does not bind the supported range.** No entry point in the drawn design requires macOS 26, and the surface renders on 14 without a defined fallback being owed *(2026-09-05, review-002 F4 — read **15**; the conclusion is unchanged and holds a fortiori, since 14 is below the floor)* — the Reduce Transparency path stays what it was, an accessibility fallback, and is not conscripted as a pre-26 rendering. note-window's decisions stand unchanged whatever the range turns out to be. ~~What still needs an owner is everything else in this topic's brief: the range as a stated product fact, the Space-homing degradation story across 14/15/26, the kill switch, and how a future macOS release breaking the private surface is detected.~~ *(Struck 2026-09-06 — every item on this list was answered or reframed later in the session; see the marked intake list under* Starting Point*.)*

## Correction — the floor is already 15, and the correction is itself the finding (2026-09-02)

*Amends* Measured ground *above, which stated the range as 14/15/26 and attributed the floor to `CKSyncEngine`. Both are wrong. Caught by the user in session.*

**The floor was moved to 15+ on 2026-08-30, by the user, in `space-homing`'s discussion** (*One implementation, because the OS floor moved*, review-001 F4):

> "The project floor was 14+ — a minimum inherited from CloudKit's `CKSyncEngine`, never a decision to support macOS 14 specifically. It is now **15+ across the board** (user's call, 2026-08-30), which removes the two-implementation risk: the private class exists across the whole supported range."

The reason is the placement route, not CloudKit. Chromium restricts `NSWindowRestoresWorkspaceAtLaunch` to macOS 14 and earlier and uses the private `NSWindowRestorationOptions` from 15 onward, so a 14 floor risked two implementations inside the supported range, or no resolution at all on 14. Supporting timing recorded there: macOS 14 Sonoma shipped September 2023, macOS 27 is due on Apple's September cadence within weeks, at which point 14 falls outside Apple's own current-plus-two security-update window.

**What this changes here.** The supported range is **15 and 26** — two versions, not three. `CKSyncEngine`'s `API_AVAILABLE(macos(14.0), …)` measurement stands but is no longer binding: CloudKit is now slack below the floor rather than the thing setting it. Everything measured about the note surface is unaffected — it was never near either number.

**Why it was missed, which matters more than the miss.** `space-homing`'s **research** file still reads "The project minimum is **macOS 14+** (a decided, project-wide constraint from CloudKit's `CKSyncEngine`, recorded in build-and-release)" — its **discussion** superseded it and the research file was not amended. Reading the research file alone reproduces the error exactly.

**And that is this topic's brief, in miniature.** `space-homing` correctly ruled the floor was not its to hold and delivered the change to **`build-and-release`**, which "records the project-wide constraint". `build-and-release` is `fresh` on the discovery map — **no session has ever opened it** — and its discussion triage queue now holds **nine** entries, including:

- `001-cloudkit-forces-a-provisioning-profile-a-macos-14-floor-and-one-open-verification` (from `storage-and-sync`, 2026-08-04)
- `009-the-project-os-floor-moves-to-macos-15` (from `space-homing`, 2026-08-30)

*(Updated 2026-09-06 — the queue now holds **eleven**: this session added `010` and `011`.)*

**Two queued entries stating two different floors, on a topic that has never run**, while `storage-and-sync` (*"Min macOS = 14+ — confirmed"*), `engine-architecture` (*"`CKSyncEngine` (macOS 14+ floor…)"*), this topic's own discovery brief and the gap analysis all still say 14. The decision is real and the user made it; it simply has no landed home, so every document that cited the old number still cites it and nothing propagates.

So the brief's *"the supported version range as a stated product fact"* is not an open question needing research. It is a **decided fact with no owner**, and the mechanism that would give it one — `build-and-release`'s session — has not run. Whether this topic states the range itself or defers to `build-and-release` is a real fork, and it is not this file's to settle alone: `build-and-release` was named as the recorder by the topic that made the change.

### The floor is a number, not a rule (user, 2026-09-02)

Put to the user as a fork: is the floor **macOS 15, fixed until changed**, or **"whatever Apple still security-patches"**, rising on its own each September? The two diverge within a month — macOS 27 is due on Apple's September cadence and today is 2026-09-02.

> **Fixed at 15 for now. Revisited after release, or when the new OS ships.** *"Can't worry about what might happen in the future."*

So the range is a **stated constant**, not a policy — no auto-raise, no rolling window, and no commitment about what a user on 15 gets when 27 lands. The cadence argument recorded in `space-homing` was supporting evidence for moving 14 → 15, not a rule adopted alongside it.

What this leaves open, and it is not a future-gazing question: **the floor is enforced somewhere at install and update time** — a `LSMinimumSystemVersion` in the bundle, and Sparkle's own minimum-OS gating on the appcast — and neither has an owner. That is `build-and-release`'s ground and it is already queued there.

### The range's granularity is assumed, not shown (review-001 F10)

*"The range is three OS versions, not thirteen"* — restated as two after the floor correction — is true of **deployment targets**, which is what the SDK's `ValidDeploymentTargets` list enumerates. It is assumed of **behaviour**, and the corpus points the other way:

- **19 point versions sit inside the range** (15.0–15.6, 26.0–26.5).
- **yabai tiers its Space handling at 12.7, 13.6, 14.5 and 15** — point releases, not majors (`space-homing`).
- **`NSWindowRestoresWorkspaceAtLaunch` "worked through macOS 14.7"** and broke in the 15 betas (`space-homing:102`) — a boundary that only exists at point granularity on one side of it.

**What this does to the product claim.** "Requires macOS 15 or later" would cover a user on 15.0 and a user on 15.6, and nothing establishes they get the same behaviour from the same build. That is not a triageable bug; it is a claim that cannot be stood behind. ~~The honest floor may need to be a point release — `15.6+` rather than `15` — and the range's *granularity* is therefore part of the stated product fact, not a detail beneath it.~~ *(Closed 2026-09-05, review-002 F5 — the lean is **not supported**. The deep-dive dispatched to test it reported back into this file: of the three exhibits cited above one is withdrawn and one is a major-boundary break, and granularity turns out to be a property of the surface rather than of the OS. The floor stays `15`. The first half of this paragraph still stands as the reason granularity would matter if it did — see* The volatile surface is the borderless window *below, where it does, for a different surface.)*

**One of the three evidence points is weaker for Fumi than it reads.** yabai's version tiers gate the **scripting-addition** path — moving *other applications'* windows — and `engine-architecture` absorbed the finding that own-window placement is a categorically different operation the system treats differently (ownership, not privilege). yabai's boundaries may be tiering a surface Fumi never touches. ~~What survives is the harder half and is untouched by that caveat: `CGSAddWindowToSpace` vanished between the discovery brief and today with no announcement, and Apple broke the AppKit hook mid-beta-cycle. Neither waited for a major version.~~ *(Amended 2026-09-02, deep-dive-001 F1 — the `CGSAddWindowToSpace` half is false and is struck; see* The `CGS` namespace never churned *below. The AppKit-hook break stands, and it landed at a **major** boundary (14.7 → 15), so it is not evidence for point granularity either. Of the three exhibits cited above, one is withdrawn and one is reclassified — the position this paragraph supported no longer rests on what it cited.)*

~~**Open — under investigation.**~~ **Closed 2026-09-05 (review-002 F5).** Deep-dive `deep-dive-001-private-surface-version-granularity` was dispatched 2026-09-02 and reported. Three of its four questions are answered in the sections below: the versions at which the surface actually changed, yabai's gates (they bear on cross-process moves only, so they never applied to Fumi), and Chromium's history as a rate.

**One dispatched question came back unanswered**: whether comparable off-store apps state **point-release** minimums. The survey found they state majors — yabai publishes `11.0.0+ / 12.0.0+ / 13.0.0+ / 14.0.0+ / 15.0+ / 26.0+` despite having the most point-release churn in the ecosystem — but no case was found of a private-API-dependent app publishing a point floor. This is live rather than academic: `build-and-release/011` records that Sparkle's appcast requires `major.minor.patch`, so **Fumi will assert `15.0.0` by default**, and nothing has tested 15.0.

### The `CGS` namespace never churned — the name was wrong (deep-dive-001 F1)

*Amends* Starting Point *and* The range's granularity is assumed, not shown *above, both of which cited `CGSAddWindowToSpace`'s disappearance as evidence that the private surface moves without announcement. It is not evidence of anything.*

Measured on this machine, 2026-09-02, by `dlsym` through `ctypes`:

```
SkyLight       CGSAddWindowToSpace     absent      <- the singular; no such symbol
SkyLight       CGSAddWindowsToSpaces   FOUND       <- the plural
SkyLight       SLSAddWindowsToSpaces   FOUND
SkyLight       SLSMoveWindowsToManagedSpace  FOUND
CoreGraphics   CGSAddWindowsToSpaces   FOUND       <- re-export alias
CoreGraphics   SLSAddWindowsToSpaces   absent
```

The deep-dive established the mechanism with `dyld_info -exports`: SkyLight exports **1669** `SLS*` symbols and **zero** `CGS*` symbols; CoreGraphics carries the `CGS*` namespace forward as **1112** re-export aliases (e.g. `_CGSAddWindowsToSpaces` re-exporting `_SLSAddWindowsToSpaces`). The `CGS`→`SLS` rename completed years ago and left a compatibility shim Apple is **still maintaining on macOS 26**. The discovery brief named a function under a spelling that never shipped; `space-homing`'s sweep correctly found nothing; this file read that as removal.

**What does hold.** `SLSSetSpaceOwner` is genuinely absent — confirmed by walking SkyLight's retained `LC_SYMTAB` (29,969 local symbols in the shared cache), not merely by `dlsym`, so it is gone rather than internal. `SLSPerformAsynchronousBridgedWindowManagementOperation` is present with internal linkage, mangled `__ZL54SLSPerformAsynchronousBridgedWindowManagementOperation...`, which is exactly why `dlsym` misses it — the discovery brief had this right.

**Consequence for this topic's own reasoning.** The point-granularity position recorded above rested on three exhibits. One is withdrawn here. A second — the AppKit hook breaking between 14.7 and 15 — is a **major**-boundary break, not a point-release one. The third, yabai's 12.7 / 13.6 / 14.5 / 15 tiers, was already flagged as possibly gating a surface Fumi never touches. The claim that the private surface moves at point granularity is therefore **not currently supported by the evidence this file cited for it**.

### The volatile surface is the borderless window, not the private hook (deep-dive-001 F6, with F4/F5)

This topic spent its session weighing the private Space-placement API. The evidence says that is not where the volatility is. *(Originally "the stable half" — corrected 2026-09-06, review-002 F6: the private hook is **untested**, not demonstrated stable. See the correction below.)*

**The private hook: ~~one break in seven years, at a major boundary~~ — see the correction below.** `native_widget_ns_window_bridge.mm` traces to a Chromium commit dated 2019-10-01 ("macOS: Restore window state and spaces"). Across macOS 10.15 → 26 the OS broke it **once**: it worked through 14.7, broke in the macOS 15 Sequoia cycle (reports pin the 15.1 beta 6/7 window, autumn 2024; Apple radar FB15644170, crbugs 369865047 and 373928194), and Chromium's fix shipped 2026-03-05 (`daf1cc365`, M147) and 2026-03-13 (`f9a6ce0cb`, M148) — roughly **18 months** of shipping breakage. Current `main` still gates it as `base::mac::MacOSMajorVersion() >= 15`, unbounded, with no point-level branch added in the ~6 months since. The surrounding comment records that Apple still ships no public API (FB22128442) and that `NSWindowRestoration` proper is *"insufficiently flexible enough for Chromium's usage"* (FB22128526). macOS 27's AppKit additions include no window-restoration-to-Space API — checked against WWDC26 session 289 (*Modernize your AppKit app*) and Michael Tsai's AppKit-in-macOS-27 roundup, which between them add `NSRefreshController`, `NSTextSelectionManager` gestures, `NSControl.Events`, Observable support and menu image changes; the session's only Spaces mention is that an autosave name helps restore a window to an **active** Space, which is the opposite of what this hook is for. *(Citation added 2026-09-06 — this was the file's one uncited factual claim.)*

**The public borderless-window surface: twice inside macOS 26, at point granularity.**

- **26.3 RC** — a regression from the 26.3 *beta*. Custom `NSWindow` `styleMask` handling broke: windows unresizable after `styleMask.remove(.titled)`, borderless windows not receiving clicks and not draggable, transparent regions intercepting mouse events, clicks falling through to the desktop. An Apple Frameworks Engineer confirmed multiple reports in Developer Forums thread 814798, citing **FB21879057** and **FB21879511**. Fixed **between RC and GM of the same point release**; reported returning in the 26.4 beta (second-hand).
- **26.0** — window *reopen* semantics changed so a closed window reopens on the Space where it was closed, switching the user's Space to reach it; applied inconsistently across Apple's own apps. Feedback **FB18016497**, filed at 26 Beta 1, confirmed still present at 26.4 in March 2026.

**Correction — the seven-year figure merges two different surfaces** *(2026-09-06, review-002 F6)*. The thing with the 2019–2024 track record is `NSWindowRestoresWorkspaceAtLaunch`, the **public user default**, which `space-homing` records as *"dead on macOS 15+"*. The private `NSWindowRestorationOptions` class is the **fix** for that break and reached Chromium stable in **March 2026** — roughly **six months** of shipping field exposure, not seven. How much of the pre-15 history transfers to it is not examined anywhere.

So the correct statement is weaker than the one made: the private hook is **not demonstrated stable, it is untested in the field**. The redirect of ongoing cost toward the borderless window still holds, because that surface has *demonstrated* volatility — two regressions inside macOS 26, both with Apple Feedback numbers — rather than because the private one has demonstrated stability. The comparison is proven-volatile against unproven, not proven-volatile against proven-stable.

**Why this is Fumi's problem specifically.** A fumi is a borderless window with a custom `styleMask`, dragged by its chrome band, on a Space it remembers. The 26.3 regression describes all of those failing at once.

**Granularity is a property of the surface, not of the OS.** Chromium demonstrates this from the inside: `base/mac/mac_util.h` exposes `MacOSVersion()` packing the full trio (`14'08'07`) precisely for point-level gating, and `main` carries live **bounded intervals** — `>= 26'00'00 && < 26'02'00` for an autofill main-thread stall, `< 26'04'00` for a Finder duplicate-dialog regression, `>= 14'00'00 && < 15'00'00` for a CATap sample-rate mismatch. It has made that call for Finder integration, snapshots and audio, and has **not** made it for window/Space restoration. So "does macOS move at point granularity" has no single answer; it has one answer per surface.

**What this changes, and what it does not.** It does not move the floor — 15 stands, and the earlier lean toward needing a *point* floor is not supported (see the amendment above: of its three exhibits, one is withdrawn and one is a major-boundary break). What it changes is where the ongoing cost sits: not in maintaining two implementations of a private hook, but in the ordinary window surface moving under a shipped build, sometimes after the RC. The mechanism that catches that is running against macOS betas — **`build-and-release`'s ground**, not this topic's, and routed there with this topic's other release-channel finding.

### How Fumi behaves when the placement surface breaks (user, 2026-09-02; deep-dive-001 F8, review-001 F5)

The scenario put to the user: macOS 27 ships, Apple changes something, and every fumi opens on whatever Space you happen to be on. Three options — do nothing, tell the user, or notice and stop trying.

> **Fumi falls back and keeps working. Nothing is surfaced to the user — they stay unaware. Everything is logged. On a support contact, the user attaches a debug log that says what happened. The system still works; it just doesn't home. Someone reports it, or the user notices it themselves, a fix is made, and it rolls out to everyone.**

So the shape is **silent graceful degradation plus complete diagnostics**, not user-facing error reporting.

~~That resolves the kill switch's inherited framing: `space-homing` recorded it as *"a local preference disabling Space homing and falling back to opening on the current Space"* — user-thrown, user-visible. Under this ruling the primary path is **self-thrown on failed capability resolution**, silent, with the log as the only signal. Whether the user-facing preference survives at all is note-window's or management-window's to settle; nothing here needs it.~~

~~**Sibling check: no overlap found.** A knowledge-base query for diagnostic logging and for graceful degradation on placement failure returned nothing owning either — `space-homing`'s kill-switch line is the only prior mention and is superseded above. Diagnostic logging as a subsystem (where the log lives, its rotation, how a user gets at it) has no owner and is not this topic's to define; the requirement recorded here is that placement failure is logged with enough detail to diagnose from, and that a user can attach it to a support request.~~

#### Corrected sibling check (2026-09-05, review-002 F1 and F2 — the check above was wrong in both halves)

**`space-homing` had already decided all of this, on 2026-08-30, before this topic opened.** Its `OS Range And Degradation` section, marked *Settled by derivation*: *"On an OS where the placement hook does not resolve, Space homing degrades to fumis opening on the current Space. No crash, no retry, no user-facing notice. The post-placement verification records it and the fix ships in an update."* The self-check is decided there too — place, show, read back, compare, *"logged and never surfaced in the app"* — with the deciding factor stated: *"a notice that fires on a broken OS release is exactly the kind of thing that ends up firing for the wrong reason."*

**The user's ruling above therefore restates a decided sibling rather than making a new decision.** It is kept as recorded — the two were reached independently and agree — but `space-homing` owns it, and a discussion consuming this file must read that topic's version as authoritative.

**The kill switch was not superseded here. It was rejected outright, the same day it was proposed** *(`space-homing`, 2026-08-30, review-001 F6)*, on an argument this file never carried: on the AppKit route **the disabled state and the broken state are the same state** — switch homing off and every fumi opens on the Space you are standing on; Apple breaks the hook and every fumi opens on the Space you are standing on. A switch producing the failure it is meant to rescue you from buys nothing. It would have earned its place on the SkyLight route, where the failure is a crash at login, but that route was not chosen. The decision reads **"No kill switch."** *(It also does not survive as an ordinary preference: the feature is a no-op for anyone who does not use Spaces, and nobody who does has a reason to want their notes not to come back.)*

**The predicate splits by path, and the ruling above flattened it** *(`space-homing`, 2026-09-01)*:

| Path | Predicate | On mismatch |
|---|---|---|
| Restore burst | Aggregate — one window off is noise (a Space can die microseconds after the pre-flight); all of them off is a diagnosis | Logged, nothing surfaced |
| Explicit target (`fumi new --space 7`, `fumi mv --space 7`) | Per-window — the caller named a Space and the window is not on it | **Loud error to the caller** |

**Confirmed with the user 2026-09-05:** the two are compatible and the split stands. *"Nothing surfaced to the user"* governs the **person and their notes**; an agent or a shell that named a Space asked a direct question and gets a truthful answer. The user's ruling is the human-surface half of `space-homing`'s decision, not a contradiction of it.

**Diagnostic logging is not ownerless either — `engine-architecture` decided it.** Diagnostics go to Apple's unified log (`os_log`), not a file Fumi owns; retention is deliberately not Fumi's; and the support-attachment path is a **Copy Diagnostics** action that runs the `log show` export for the user, with placement assigned to `management-window`. `space-homing` ran this same consult and recorded it. **One consequence for the user's ruling as worded**: it says *"the user attaches a debug log"*, and under the decided architecture there is no Fumi-owned log file to attach — there is a unified-log export behind an action no topic has yet specified. Whether that export carries what a placement-failure report needs to be diagnosable (the predicate's subsystem and category, the OS triple, the aggregate mismatch record) is unexamined, and this file is the one asserting the requirement.

**What this makes design-shaping, and therefore owed before implementation.** Four things, three of which need no further call — reference implementations were surveyed for how they notice they are on an untested OS, and *none of the three **in-app** mechanisms is a version comparison; they resolve capability instead*. The fourth is a version comparison, but it runs in the **update channel** rather than in the app, which is exactly why it is not a substitute for the other three: *(framing corrected 2026-09-06 — the original claimed all four, which item 4 contradicts)*

1. **Capability resolution, not version checks.** AltTab's shape: `#available` for the public class, member-presence for the private part — `class_getInstanceMethod(object_getClass(NSGlassEffectView()), NSSelectorFromString("set_variant:")) != nil`, computed once, lazily. yabai's equivalent for internally-linked symbols is a `LC_SYMTAB` walk of the loaded image, then a plain null check at the call site. Both treat the OS version as *not* the question.
2. **The OS triple appears in the failure log, never as a gate.** AltTab logs `major.minor.patch` when the private member is absent. That is the diagnostic the user's support attachment needs.
3. **Success is verifiable without private API.** deep-dive-001 F9 measured that the AppKit route's outcome can be checked with public calls, but only after the window is ordered in — which is the hook a self-check reads to decide whether homing worked.
4. **Sparkle carries a point-precise floor whether or not one is decided.** `sparkle:minimumSystemVersion` must be *"a three-part version in form of major.minor.patch"*. And `feedParameters` reports the exact OS triple on every update check (AltTab does this), giving a live point-granular distribution of the installed base with no analytics service — which is the population input review-001 F4 said the floor decision lacked. **Shipping is what produces it.** Sparkle's side of this is `build-and-release`'s.

~~**Still open:** the kill switch's user-facing half, if any, and where diagnostic logging lives as a subsystem. Neither is this topic's.~~ *(Struck 2026-09-05, review-002 F1 and F2 — neither thread exists. The kill switch was rejected outright by `space-homing`; diagnostic logging was decided by `engine-architecture`. Nothing is routed to `note-window` or `management-window` on either count.)*

**Still open, corrected:** whether `engine-architecture`'s **Copy Diagnostics** export carries enough to diagnose a placement failure from — the silent-degradation ruling is only supportable if the diagnosis is recoverable afterwards, and the log is the entire mechanism. *Rerouted to `engine-architecture` triage (2026-09-06).*

### The parameterised blur is `backgroundFilters`, not `NSVisualEffectView` (review-002 F7)

*Amends* What the note surface actually needs*, whose stated reason for the note surface not binding the range was wrong. The conclusion is unchanged; the API named for it is.*

**The objection, and it is correct.** `NSVisualEffectView` vends a **named** material, not a parameterised one. Measured — its entire property surface in the shipped AppKit header is:

`grep '@property' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/AppKit.framework/Headers/NSVisualEffectView.h"` →
```
material · interiorBackgroundStyle · blendingMode · state · maskImage · emphasized
```

No radius, no saturation, no brightness. The spike declares `backdrop-filter: blur(40px) saturate(180%) brightness(106%)` on the note and `blur(30px) saturate(180%)` on the `Aa` popover — two different radii over two different fills. A named material cannot express either, and cannot tell 40px from 30px. So citing `NSVisualEffectMaterialMenu`'s `API_AVAILABLE(macos(10.11))` did not establish what it was used to establish. Had `glassEffect(_:in:)` been the only parameterised path, the material would have pinned the range at 26 and the constraint sent to `note-window/001` would be false.

**It is not the only path, and the alternative predates everything in this topic.** Measured in the same header set:

`grep -B1 'backgroundFilters' "$(xcrun --show-sdk-path --sdk macosx)/System/Library/Frameworks/AppKit.framework/Headers/NSView.h"` →
```objc
@property (copy) NSArray<__kindof CIFilter *> *backgroundFilters API_AVAILABLE(macos(10.5));
```

An arbitrary `CIFilter` chain applied to the content **behind** the view — which is what a backdrop filter is. Core Image supplies the three terms the spike names: `CIGaussianBlur` takes a radius, `CIColorControls` takes saturation and brightness (`CIFilterBuiltins.h`, `gaussianBlurFilter` and `colorControlsFilter`). `macos(10.5)` is fifteen years below the floor and predates `NSVisualEffectView` itself.

**What this changes.** The conclusion stands: **the note surface's material does not bind the supported range**, and `note-window`'s decisions hold on 15. What changes is the mechanism the record names — implementation builds against `NSView.backgroundFilters` plus a `CIFilter` chain for the note's own material, not against a semantic `NSVisualEffectView` material. The distinction is load-bearing at build time and would otherwise have been discovered there.

**Unexamined, and flagged rather than resolved:** whether a `CIFilter` background chain composites identically to a system material under **Reduce Transparency** — the automatic opacity `note-window` relies on is a property of the semantic material, not of an arbitrary filter chain, so the accessibility fallback recorded as free may be implementation work. It does not bear on the range. *Rerouted to `note-window` triage (2026-09-06).*

### What the user is actually asking this topic for (2026-09-05)

Recorded because it governs how everything above should be read, and because two later decisions only make sense against it.

> **"What I don't want to do is over-stress about support, but I want us to set things up in a way that facilitates a proper, well-structured system with minimum support, and the ability to test this stuff as and when we get to that point. But we need to build it and release it first."**

Three consequences that actually landed in this session:

- **Verification method was declined as premature.** Offered a macOS 15 VM to establish what resolves on the oldest supported version — `Virtualization.framework` is present, Apple Silicon hosts macOS 12+ guests, and a guest runs its own WindowServer, so it plausibly has real Spaces. Declined: *"I don't want to pull a macOS 15 VM down at this stage. It's very premature."* So **nothing has run on 15, by choice**, and the honest statement of the range rests on evidence about other people's code rather than Fumi's. Second-hand hardware is the fallback if virtualisation ever turns out not to answer it — a guest WindowServer is not bare metal, and the expected failure is a VM having one Space with Mission Control disabled.
- **The support matrix was deliberately not built.** Population share by OS version, the Intel/architecture axis, a breakage-rate model, and a sweep of the decided corpus for version pins were all raised by review and all declined as *not now*. They are recoverable — the reviews are on record — and the last of them is the one most likely to bite, since an unnoticed version pin surfaces at implementation rather than in review.
- **What was pulled *back* in, and why.** Only the thread that had to be settled before code is written: how the app notices for itself that the placement surface stopped working. That is design-shaping rather than support policy, costs nothing to decide now, and is expensive to retrofit — and it is the concrete form of *"the ability to test this stuff as and when we get to that point"*, because the same capability check that degrades gracefully is the thing a later test harness reads.

**The inversion worth carrying forward.** The floor's next revision was scheduled for *after* release. That initially read as deferring the decision without evidence — but Sparkle's `feedParameters` turns the release itself into the instrument: ship, and the appcast host reports the exact OS triple and architecture of every installed base member on every update check. **Shipping is what produces the data the next floor decision needs.** The sequence the user described — build it, release it, then test — is not a deferral of the evidence; it is the only order in which this particular evidence exists.
