# Research: Restore Host Terminal Windows

Portal's resurrection layer restores the tmux/server layer after reboot, but not the **host-local terminal layer** — the actual terminal-emulator windows that were attached to sessions on this machine. This research explores whether Portal can track which terminal windows on *this host* were attached to which sessions, and then re-spawn and re-attach them on demand after a reboot, sparing the user from manually rebuilding their working state by hand.

## Starting Point

What we know so far:

- **Prompted by:** Portal's resurrection layer restores the tmux/server layer after reboot but NOT the host-local terminal layer. After a crash with ~32 Claude sessions, ~28 reattached correctly at the server level, but the user still had to manually rebuild every macOS terminal window by hand (~14 Spaces, one project zone per Space, each window holding a few sessions) — roughly an hour of work: open Ghostty, Cmd+N, drag to the right Space, attach, navigate, preview, confirm.
- **Already knows:** Feasibility is genuinely uncertain on two fronts — (1) distinguishing host-local attachment from tmux-level attachment that a mobile or other client could also hold, and (2) programmatically spawning terminal windows and re-attaching them to their sessions.
- **Starting point:** Technical feasibility — can Portal track which terminal windows on THIS host were attached to which sessions, and can it re-spawn + re-attach them on demand?
- **Constraints:** macOS Spaces placement (dropping each reopened window back onto its original Space) is explicitly out of scope — deferred as a separate Mac-specific follow-up. The user is biting this off in chunks; "reopen the windows" is its own job.

---

## Workflow & Topology (confirmed)

- **One Claude session ≈ one Ghostty window** is the norm. tmux *windows* used occasionally, panes rarely. So the unit of restore is: one host terminal surface per session.
- The tmux/server layer is **not in scope** — the existing resurrection layer already rebuilds tmux sessions/windows/panes on attach. This feature only restores the **host terminal surface** (the Ghostty window/tab) that fronts a session.
- macOS Spaces placement is **out of scope** (parked in inbox as a follow-up to build on top of this).

## The Refined Ask

Portal offers (never forces) a way to reopen N sessions, each springing into its own host terminal surface — **a Ghostty window or tab depending on how it was consumed before the reboot**.

Shape the user proposed: inside the Portal picker, a **multi-select keybinding** (e.g. `M`), select several sessions, `Enter`, and each attaches into its own new window/tab. Concrete scenario: go to Space 3, open Ghostty, `x`, `M`, select the project's 3 sessions, `Enter` → 3 surfaces spring open, each attached. *"Even if we stop there, that would be an amazing feature."*

## Key Reframe — multi-select dissolves most of the tracking problem

The manual multi-select trigger means we **do not** need to track the live window inventory ("what's open right now") or persist a window→session map for replay. The user drives the reopen by hand from a live Ghostty window. So:

- **Sessions already exist** post-reboot (resurrection layer restored them). Portal already knows them.
- The **only** new thing tracking buys is the **window-vs-tab consumption mode** per session — so a session that was a tab reopens as a tab, a window as a window.
- **Implication:** the MVP (multi-select + spring-open) needs *near-zero new tracking*. Window-vs-tab fidelity is a **separable refinement** — v1 could default to "always window" and add mode-tracking later. This is a natural scope seam, not a decision to make here.

**User preference (captured):** windows-only is acceptable for the MVP — the user rarely uses Ghostty tabs and is happy for a session that was a tab to reopen as a window. This **drops the window-vs-tab refinement from v1 scope** and, with it, the entire introspection requirement (see F2 below — Ghostty can't introspect tty/pid today anyway, so windows-only sidesteps the one hard blocker).

## Deep-Dive Findings (terminal automation surface — folded in as surfaced)

*Full report: `.workflows/.cache/restore-host-terminal-windows/research/restore-host-terminal-windows/deep-dive-001-terminal-automation-surface.md`. Verdict: **feature is feasible across all 5 target macOS terminals — spawn works everywhere.***

- **Spawn is solved on Ghostty today (F1).** Ghostty 1.3.x (user confirmed on 1.3.1) ships an AppleScript dictionary: `new window with configuration` where the config carries a `command` field — so Portal can open a new Ghostty window running `tmux attach -t <session>` directly. No keystroke hacks. The whole feature rests on spawn; spawn exists.
  - *Caveat (accepted):* each `new window` implicitly activates Ghostty / focuses the new window (issue #11457), so a burst multi-select flashes focus through the spawned windows. **User accepts this** — standard OS behaviour; only the end-state matters.
  - *Caveat:* Ghostty AppleScript is a "preview feature, breaking changes expected in 1.4" — the dictionary shape may churn.
- **Spawn command = `portal attach <session>` (code-validated, resolves review-002 F1).** Earlier note claimed the spawn runs bare `tmux attach` and "parity is free." Corrected against the code:
  - **`portal attach <name>` already exists** (`cmd/attach.go`): validates the session, then calls the **same connector the picker uses** — `SwitchConnector` (`tmux switch-client`) inside tmux, `AttachConnector` (`syscall.Exec` → `tmux attach-session -t =<name>`) outside. It's the existing Portal-mediated attach chokepoint.
  - **Resume/hydration is EAGER, at bootstrap** (step 6 Restore + step 7 `EagerSignalHydrate`) — *not* at attach. The connector is a pure tmux attach/switch with no resume logic. So a bare `tmux attach` would **not** skip resume-hooks (they already fired at bootstrap) — the earlier "parity" worry was misframed. The reason to use `portal attach` is **consistency/single-chokepoint**, not resume correctness.
  - **The behavioural model (user, confirmed against code):** *trigger window* attaches to one selected session via the existing in-picker connector (`switch-client` — picker process replaced, exactly as a single attach today); *the other N-1* are new host windows each running **`portal attach <session>`** from a fresh shell (outside tmux → `AttachConnector`). Not `portal open` (no re-running the picker — the selection's already made), not bare tmux. This also answers **review-002 F2** (picker-surface fate): the trigger window *becomes* one of the attached sessions.
  - **Net window count = N, not N+1 (user, emphatic anti-requirement).** Selecting 3 yields exactly **3** windows: the picker's host window is **reused** as one session (via `switch-client`, which replaces the picker process) + N-1 new windows. A **leftover empty picker window is explicitly forbidden** — the user must never have to close a stray empty window after a multi-attach. The reuse falls out of the existing `switch-client` behaviour for free.

## Cross-Terminal Strategy (emerging)

**Goal:** "just works" for current popular terminals — but **ship Ghostty only to begin with** (the user's Mac terminal). Others added over time.

**Platform stance (user):** macOS-first. AppleScript being Mac-only is fine. **No Windows.** Linux is "loosely supported, never tested" — explicitly *not* a goal; a Linux user who wants this can self-configure their terminal's command. So the design must degrade to "bring your own command" gracefully, but we don't write/test Linux adapters.

**Dual configurability (the core requirement):**
- **User-level config** — a user can add/override their terminal's spawn command without touching Portal's code (covers the long tail + Linux + customisation).
- **Binary-level (built-in) adapters** — known terminals work out of the box, zero config. New ones land via **open-source PR** (contribute the command/adapter so future users don't self-configure). This is an explicit contribution model.
- **Why configurable even for supported terminals:** users may want to *extend* the spawn (e.g. open + resize window + set title), which they'd do by editing the command.

**The contract (user's intuition — "that's almost a contract, isn't it?"):** every terminal, however implemented, answers one question: **given a session name, open a host window attached to it.** That single operation is the adapter contract. Built-in Go adapters and user-config entries are just two implementations of it.

**Representation of complex commands (open research question the user raised):** how does an AppleScript (multi-line, quote-heavy) live in config? Candidate shapes:
- **(a) Command/argv template** with a `{session}` placeholder — clean for CLI terminals (kitty `kitten @ launch`, wezterm `wezterm cli spawn`) and simple `osascript -e` one-liners. Avoids shell-quoting hell if expressed as an argv list, not a single string.
- **(b) External script file referenced by config** — for genuinely complex/multi-line logic (AppleScript + resize + title); config points to `~/.config/portal/terminals/<name>` and Portal runs it with the session passed as arg/env. Most flexible; keeps config clean; this is the "scriptable/pluggable" escape hatch.
- **(c) Built-in Go adapter** — for *known* terminals the AppleScript/CLI lives in compiled code (cleanly escaped, or written to a temp script), never in user config. User only touches config to override or add a terminal.
- *Leaning:* layered — (c) for known terminals (Ghostty), (a) for simple custom terminals, (b) as the power escape hatch. To be decided in discussion.
- *Script-vs-file disambiguation (user asked):* config value is either an inline command or a file path. Context-detection ("does it resolve to an existing file?") is viable and has precedent; safest is to treat an existing-path-on-disk as a script file, else as an inline command (or support an explicit form later). Low-risk either way. Decided in discussion.

**Decision — build the full user-config layer in v1** (user: "build all of it now"). Not just for other-terminal users — the user may want to override the native Ghostty command (e.g. add resize) and *will test the path*. So v1 ships: built-in Ghostty adapter **+** the user-config override/escape hatch.

**Precedence (user-proposed, sound + standard):** user **config override** (highest) → **baked-in native adapter** → **unsupported** (lowest). Config wins so an override is always possible; absence falls back to native; absence of both = feature unavailable in that terminal. This is the conventional config-over-default layering.

### The keying spanner → resolved by detect-self (deep-dive F6)

The user hit a real snag: if Portal natively supports only Ghostty, how does a Warp user's config get *found*? Is config keyed by terminal name, or is it just "a spawn command" Portal runs blindly (in which case Portal doesn't know which terminal you're in — and **users use multiple terminals**, breaking a single blind command)?

**Resolution (F6):** Portal **detects the host terminal it is running in** from environment variables, and *that* is the lookup key. The flow when you hit `M`: detect current terminal → look up (config override for that terminal? → native adapter for it? → unsupported). This resolves both halves of the spanner:
- **"How does Portal know which terminal?"** — env-var detection (`TERM_PROGRAM` + app-specific vars).
- **"Multiple terminals?"** — it keys off whichever terminal you're *currently working in* when you trigger the reopen, which is exactly the terminal the new windows should spawn into. The multi-terminal case is a feature, not a bug.

**Gotcha (F6, Portal-specific, confirmed live):** **tmux clobbers `TERM_PROGRAM`** — inside tmux it reads `tmux`, not `ghostty`. So detection must lean on **app-specific env vars that survive the tmux rewrite** (`GHOSTTY_*`, `KITTY_*`, `WEZTERM_*`, `ALACRITTY_*`), falling back to `TERM_PROGRAM`/`TERM`. Edge: tmux only preserves vars present when the *server* started; `update-environment`/`show-environment` could recover the originating client's env if needed. This is the one non-trivial wrinkle in the otherwise-clean detect-self story.

### Multi-select as a general mechanism (architectural note)

The user asked whether multi-select could later serve other actions (e.g. **bulk tag-adding**). Takeaway for v1: implement multi-select as a **general selection mode with spawn as its first action**, not a spawn-only modal — so future bulk operations can hang off the same selection. *Bulk-tagging itself is out of scope* (and would live on the **Projects** page = a separate feature; this feature's multi-select is **Sessions**-only). Noted, not built.

### Unsupported-terminal UX (decided — banner, not modal)

**Decision:** multi-select does **not** vanish in an unsupported/unconfigured terminal (it may serve future non-spawn actions, so hiding it wholesale is wrong). Instead, on trigger, show an **info banner** (Portal already has the component) — *"We don't support your terminal and you haven't configured one — check the docs."* No modal (a modal hides everything). The banner should name the **detected terminal identity** so the user knows exactly which config key to add (see identity resolution below). This resolves review-F8.

### The terminal-identity problem (the real crux — user pushback, now reframed)

The user correctly broke the naive "detect via env vars" story (review-F13 independently flagged the same): env vars alone (a) don't generalise to *unknown* terminals, (b) shouldn't be user-set, and (c) — the killer — **don't tell the user what string to key their config against**. For config lookup to work, the user's key must match Portal's detected identity, but the user has no way to know that string a priori. Chicken-and-egg.

**Reframed resolution (to be verified by deep-dive 002):** identity comes from the **host terminal's actual process**, not env vars:
- `tmux list-clients` → the **client PID** (the host-side `tmux attach` process, living *outside* tmux's env-clobber).
- Walk that PID **up the process tree** → the terminal-emulator process (`ghostty`, `kitty`, `wezterm-gui`, `Warp`, `iTerm2`). Deterministic, works for **any** terminal (you always get a process name), works inside tmux.

**This breaks the chicken-and-egg:** Portal owns the canonical identity and **surfaces it to the user** (in the unsupported banner, or a detect command). The matching key flows *Portal → user*, never user-guesses. Native adapters match the detected process against a built-in list; config entries are keyed by the same detected string.

**Consequences:** multi-terminal Just Works (detect per-invocation what you're *currently* in → look up that). The "one terminal at a time" simplification the user floated is **not needed**.

**Open edges to verify (deep-dive 002):**
- **Multi-client ambiguity** — when several clients are attached to one session, which client is "the one viewing me"? Does tmux expose a deterministic signal, or does a plain `tmux` subprocess just get the most-recently-used client?
- **Detached-session / no-client** case (less relevant — the user is *in* a terminal when triggering).
- **Most stable identity key on macOS** — executable basename vs `.app` bundle id (e.g. `com.mitchellh.ghostty`).
- **Post-reboot scenario** — a fresh terminal window attaching to an already-running server: does the client-PID→process-tree walk still resolve correctly (this is where the env-var approach was fragile, F13)?
- Layering: process-tree as the reliable backbone, env vars as an optional fast-path/confirmation.

**VALIDATED LIVE (2026-06-30, read-only on the running server) — detection works, with one refinement:**

Deep-dive 002 verified the mechanism, then a live re-run nailed it during a real device-hop. This session was **born in Blink/mosh (iPhone)**; the user then moved to **Ghostty on the Mac**, same tmux session. Detection re-run:
- **Process-tree walk from the chosen client PID → `/Applications/Ghostty.app/Contents/MacOS/ghostty` → bundle id `com.mitchellh.ghostty`.** Correct. Confirms the key property: identity is **where the session is *currently* running, not where it was started** — exactly the device-hopping behaviour the user needs.
- **Recommended identity key = macOS bundle id** (`com.mitchellh.ghostty`), shown to the user as the config key. Executable basename is unsafe (Warp's is literally `stable`).
- **Remote clients = honest no-op:** the two lingering mosh clients walked to `mosh-server` at `ppid=1`, **NULL bundle id** → "no host-local terminal" → unsupported → banner/no-op. So **Blink is a no-op by design** (not configured out of the gate; could become config/core later) — aligns with user intent. This also answers the original host-local-vs-other-client feasibility worry: the NULL-bundle signal *is* the host-local discriminator.

**RESOLVED — bundle id is the right *internal* key, matched as a family, with a friendly alias on top (deep-dive 003):**

- **Not a code smell — it's the system-blessed identity.** `CFBundleIdentifier` is what Launch Services, `open -b`, the TCC permission DB, keychain, default-app associations, and `osascript -e 'id of app "X"'` all key off. Keying on basename/display-name *would* be the smell; bundle id is the cure.
- **"What if they change it?" — they effectively can't, per product line.** Changing a bundle id resets TCC permissions, breaks keychain access, destroys the App Store record, and breaks code-sign/Sparkle updates — so vendors treat it as immutable for a product's life. Empirically near-zero churn per channel. There is **no "app GUID"** on macOS; bundle id (± Team ID) *is* the persistent identity.
- **The real catch — match a *family/set*, not one string.** Channels/forks carry *different* ids: Warp `dev.warp.Warp-Stable` vs `-Preview`; VS Code `com.microsoft.VSCode` vs `…VSCodeInsiders`. (iTerm2 *shares* one id across stable+beta — vendor-dependent, no universal rule.) So each built-in adapter declares an **id family** — a known-id set and/or a prefix pattern (`dev.warp.Warp-*`). Pure single-string match is the one design to avoid.
- **Internal key ≠ user-facing key (resolves the "iffy" worry).** User-facing primary key = a **friendly alias** (`ghostty`, `warp`) backed by an alias table mapping to the id family; raw bundle id / `*`-glob is the escape hatch for custom/unknown terminals. Portal **always shows the detected bundle id** (so a custom-config user copy-pastes, never guesses). Proven pattern in the wild: Karabiner (bundle-id regex families), Raycast (name|id|path), VS Code (`.app`-name user-facing key).
- **Unknown-terminal keying — NOT a chicken-and-egg (user follow-up).** The Portal-managed friendly alias only covers *known* terminals; an unknown terminal has no pre-baked alias. But the user never *guesses* the identity — the walk recovers both the **bundle id** *and* the **`.app` name** (`Warp`), and Portal **displays** them (unsupported banner / detect command), so the config key is copy-paste. **The irreducible floor:** for an unknown terminal, the *only* genuinely user-authored input is the **spawn command** (how *that* terminal opens a window) — Portal can't know that for an app it's never seen. Identity is always detected-and-shown; only the spawn recipe is authored.
- **Two keys, two jobs (clarified — don't collapse them).**
  - **Internal matching key = bundle id (family).** Robust + channel-aware: `dev.warp.Warp-*` groups Stable/Preview cleanly. This is what Portal's *shipped adapters* match on; the user never types it.
  - **User-facing config key = `.app` name** (`Warp`) preferred — friendlier, VS Code precedent (`terminal.external.osxExec`). Safe because a user registering a *custom* terminal names their *one* terminal, not a channel family.
  - **Why not `.app` name internally too:** channel siblings *diverge* by `.app` name (`Warp.app` vs `Warp Preview.app`) — worse at grouping than the bundle-id prefix. So `.app` name is friendlier but weaker for family matching; use bundle id where precision matters, `.app` name where ergonomics matter. Both recovered by the same walk; both shown.
  - **DISCUSSION-PHASE UX call (not feasibility):** what Portal *defaults to displaying*, and whether custom config accepts `.app` name *and* bundle id (and `*`-glob). Options + tradeoffs surfaced; the pick is a discussion decision.
- **Optional hardening (deferred):** Team ID + bundle id (from code-signing) is the most tamper-resistant/anti-spoof key, but heavier to read and overkill for a local convenience feature — defer unless impersonation enters the threat model.
- **Degrade:** unknown local terminal → show detected id + offer "register a custom terminal"; NULL bundle id (remote/mosh) → no host-local terminal, skip. **Cross-platform:** the alias + canonical-key + adapter-family model transfers; only the leaf key is per-OS (Linux: `.desktop` id / `WM_CLASS` / `app_id`).

**Refinement (live finding — corrects deep-dive 002's F2/F7):** the session had **3 clients** attached (2 stale mosh + 1 live Ghostty). The disconnected mosh client **still carried the `focused` flag** (stale). Tie-breaking on `focused` picked the wrong (mosh) client; tie-breaking on **highest `client_activity`** (tmux's own `cmd_find_best_client` rule) correctly picked Ghostty. **Decision: resolve the client by highest `client_activity`, treat `focused` as an unreliable hint** — load-bearing precisely because the user hops devices and mosh clients linger after disconnect. Residual: multi-client is still best-effort (most-recently-active ≠ provably "the window in front of the human"), but for this feature, triggering the reopen bumps the active client's activity, so the current terminal wins.

## Forward-Looking (out of scope — "keep half an eye")

The user flagged a **future** feature (explicitly *not* this one): on reboot, **remember what was open** and offer *"restore your workspace?"* — re-opening windows **and placing them on their original macOS Spaces**. Different mechanism from this feature's manual multi-select (remember-and-restore vs select-and-open). Spaces placement is **already parked in the inbox**.

Architectural impact on *this* feature: "remember what was open" implies **introspection returns as a requirement later** (to record the workspace), and Spaces placement adds a **window-placement** capability. So the adapter contract should be **capability-based** (spawn is the v1 method; leave room for an optional `introspect` and `place-on-space` later) rather than a single rigid function — so v1 doesn't paint the architecture into a corner. Design v1 minimal (spawn only) but extensible. *Noted, not designed here.*

## Two Feasibility Risks (original framing — BOTH now resolved/dropped)

*These were the two "I have no idea if it's possible" risks that opened the research. Both are now closed — recorded here as the through-line from question to answer.*

1. **Spawn — RESOLVED.** Can Portal programmatically open a new window running a command? **Yes** (deep-dive 001): Ghostty 1.3 AppleScript `new window with configuration … command`, and spawn works across all 5 target terminals. The central risk the feature rested on is cleared.
2. **Detect mode — DROPPED (not resolved — removed from scope).** "Window vs tab" detection is no longer needed: the **windows-only MVP** dropped window-vs-tab fidelity, which removed the entire introspection requirement. (The *separate* "which terminal am I in" detection — not mode — was the real detection problem, and it's resolved via the process-tree walk in deep-dive 002.)

## Mechanism Notes (from KB + tmux knowledge)

- `tmux list-clients -F '#{client_tty} #{client_session} #{client_pid} ...'` exposes the live client→session map plus the client's tty and pid (verified tmux 3.6a in the zellij-to-tmux-migration discussion). `client_pid` → ppid chain is the likely path to "is this client a local Ghostty surface."
- Portal already runs a **1s tick daemon** (`portal state daemon` inside `_portal-saver`) that captures session structure to `sessions.json`. The user's "keep a tick / log of how it's consumed" maps directly onto this existing seam — consumption-mode could ride the same capture loop.
- The **"host-local vs other client" distinction** (original feasibility worry) softens under manual multi-select: the daemon runs on *this* host and the user reopens from *this* host, so a future mobile/relay client (per `agent-first-portal`) attaching to the same session wouldn't masquerade as a local window to reopen. The user has final say via the selection anyway.

## Operational & Edge Surfaces (from review-001)

The research is strong on terminal-automation feasibility but thin on operational/product surfaces. Captured here for discussion; some already resolved above.

- **Burst failure modes (review-F1)** — the motivating scenario is a *large* burst (rebuild ~14 windows post-crash), yet the research reasons about the clean 3-window path. Partial failure (spawn/attach of window K fails — session killed since picker load), AppleScript throughput/rate-limit under rapid-fire, and the mid-burst TCC prompt all unexplored. Need a partial-failure contract: all-or-nothing vs best-effort-with-report.
- **Trigger-context matrix (review-F2)** — behaviour when: user is *outside* tmux at trigger; a selected session is *already attached* elsewhere on this host; the picker is itself running in one of the windows being reopened. Map in/out-of-tmux × attached/detached × includes-self.
- **Duplicate-surface guard (review-F3)** — **DECIDED: no guard, allow it.** Opening a session that's already attached is a fine no-op — *"it's all through tmux, so both opens synchronise perfectly"* (user). No blocking, no skip, no warn; if the user multi-selects already-open sessions, Portal opens them. This also means windows-only v1 needs **zero** client-state read for dedup (it still reads `list-clients` for *detection*, but not to filter selections).
- **First-run TCC Automation permission (review-F4)** — first AppleScript call triggers the one-time macOS permission modal (the deep-dive author's own probe timed out on it, AppleEvent -1712). First-run blocker, not a caveat. Design the request→granted→spawn / denied→guidance flow; surface -1712/timeout rather than silently doing nothing.
- **Testing strategy (review-F5)** — feature drives a real GUI terminal (hard in CI); project has deep test discipline. Identify the DI seam (an `Adapter` interface with a fake spawn), what's unit-testable (command/argv construction, detect-self resolution, precedence) vs integration/manual-gated.
- **Where spawn executes architecturally (review-F6)** — picker action shelling out from the TUI process vs a new `portal` subcommand the picker invokes vs both. Determines which process's env feeds detect-self, how the `tmux attach` line is assembled, and whether a headless/scriptable reopen is possible. **Coupled to identity detection (deep-dive 002)** — resolve together.
- **Keymap coexistence (review-F7)** — `M` selection mode vs the tight §12.2 keymap: `Enter` (single attach) and `Space` (preview) collide with selection-mode semantics; interaction with non-selectable HeaderItem rows, the `/` filter (letters become literal), and pagination all unwalked.
- **Config schema (review-F9)** — v1 *ships* the user-config layer, so its concrete shape is more than a discussion detail: where it lives, format, how a terminal key maps to a command, `{session}` interpolation. Surface at least one worked example (a Warp user overriding spawn).
- **Daemon/state footprint (review-F10)** — "near-zero state change" asserted as a corollary, not traced. Confirm which packages (state, daemon, prefs, a new config package) are/aren't touched by windows-only v1.
- **Attach contention (review-F12)** — *open.* N near-simultaneous `tmux attach -t` against a server that may still be hydrating post-reboot (`@portal-restoring`, 1s capture tick, self-supervising daemon): genuinely independent of the bootstrap/restore/daemon machinery, or racing it?

### From review-002 (final review)

- **Success framing — partial win accepted (review-002 F6, DECIDED).** The MVP is a *steady-state* multi-select that collapses the N attaches into one action per batch; it does **not** remember which sessions grouped together, nor place Spaces. Against the post-crash motivating story that's a **partial** win (still manual re-selection per zone, still manual Spaces). **User accepts this explicitly** — *"okay with a partial win; iteratively moving towards perfect."* Remember-the-grouping + Spaces are the deferred follow-ons. Stated here so discussion has the yardstick: MVP = "collapse the attaching," not "restore the workspace."
- **Spawned window cwd/env (review-002 F3) — mostly dissolves; one impl flag.** Because each new window runs `portal attach <session>` (attaches to an *existing*, already-restored session), the window's pre-attach **cwd is moot** — tmux pane cwds are session state and take over on attach. The only real concern is **env/PATH**: the spawn must run `portal attach` in a context where `portal`/`tmux` are on PATH (Ghostty's `surface configuration.command` may not be a login shell) — an implementation detail for spec, not a design decision.
- **Detection-primitive stability (review-002 F4) — validation-before-build flag.** The identity backbone (`ps -o comm=` full-path behaviour, `lsappinfo` bundle-id read, GUI app at `ppid==1` under launchd) is verified on *one* Mac at *one* moment. `lsappinfo` is undocumented. Before build: confirm the `ps`/`lsappinfo` behaviours on ≥1 other macOS version and decide a fallback when `lsappinfo` is absent/unexpected (it's the single point of failure for the canonical key). Not a feasibility blocker; a hardening item.
- **Activity-bump tie-break timing (review-002 F5) — validation-before-build flag, higher priority.** The load-bearing mitigation for multi-client detection is "pressing `M` bumps the triggering client's `client_activity` so the local client wins." Asserted, not verified — and the user's device-hopping with lingering mosh clients is exactly where it could break (a phone-touched-seconds-ago client could outrank the local one at read time). Before build: stage a two-client session (one stale-recent, one local), trigger from local, confirm `client_activity` ordering. If it doesn't hold, detection needs a stronger signal than activity.

## Open Questions

*The early feasibility open-questions are all now resolved or dropped (kept here as dispositions). The **live** open items that carry into discussion are the design/validation flags in "Operational & Edge Surfaces" above — not these.*

- **Ghostty spawn** — RESOLVED (deep-dive 001: AppleScript `new window … command`).
- **Mode detection (window-vs-tab)** — DROPPED (windows-only MVP).
- **Other terminals** — RESOLVED into the **Cross-Terminal Strategy** (built-in adapters keyed by bundle-id families + user-config escape hatch; Ghostty-first).
- **Trigger surface / `M` keymap coexistence** — still open → tracked as **review-F7** (a discussion-phase design item).
- **Where does spawn run from?** — partially answered (the N-1 new windows run `portal attach <session>`; the trigger window reuses the picker via `switch-client`) but the *architectural placement* (picker action vs subcommand) is still open → tracked as **review-F6**, to resolve with detection.

**Carried into discussion (live):** see "Operational & Edge Surfaces" — burst/partial-failure contract (F1), trigger-context matrix (F2), TCC first-run flow (F4), testing seam (F5), spawn-execution architecture (F6), `M` keymap coexistence (F7), config schema (F9), daemon/state footprint (F10), attach contention (F12); plus review-002's validation-before-build flags (lsappinfo/ps stability, activity-bump timing) and UX picks (default identity display, config key forms).

## Triage

(none)
