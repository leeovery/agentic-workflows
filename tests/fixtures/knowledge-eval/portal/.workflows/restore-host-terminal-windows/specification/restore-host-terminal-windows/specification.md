# Specification: Restore Host Terminal Windows

## Overview

### Problem

Portal restores the **tmux/server layer** after a reboot (sessions/windows/panes rebuild on attach) but not the **host-local terminal layer** — the terminal-emulator windows that fronted those sessions. After a crash with ~32 sessions, the server layer reattaches but the user still rebuilds every macOS terminal window by hand (~14 Spaces, one project zone per Space) — roughly an hour of manual work.

### What this feature does

Adds a **multi-select mode** to the Sessions page of the Portal picker. The user marks N sessions and presses `Enter`; each selected session springs open **attached in its own host terminal window**. Net result is **N windows for N selected sessions** — the trigger (picker) window is reused as one of the N; the other N−1 open as fresh host windows.

### Scope yardstick (what "done" means)

This feature collapses the *attaching* into one action per batch — a deliberate **partial win** the user explicitly accepts. It does **not** remember groupings or place windows on specific macOS Spaces; all N windows open on the current Space. Remember-the-grouping and Spaces placement are separate future features.

### Foundational shape (settled)

- **Multi-select mode** on the Sessions page (trigger `m`) → mark → `Enter` → each springs open attached in its own host window. Built as a *general selection mode* with spawn as its first action (future bulk ops can reuse it).
- **Windows only** — no window-vs-tab fidelity, which removes the entire host-window introspection requirement.
- **Net N windows, never N+1** (hard anti-requirement): the trigger window is reused as one session; only the N−1 others are externally spawned. No leftover empty picker window.
- **Ghostty-first**, cross-terminal via built-in Go adapters + a user-config escape hatch (`terminals.json`), both shipped in this feature.
- **Terminal identity** detected by walking from the triggering process/client to the host terminal's macOS bundle id; remote/mosh clients → NULL → honest no-op.
- **No duplicate-surface guard** — opening an already-attached session is a fine no-op (tmux synchronises both clients).

### Hard dependency (satisfied)

Each spawned window runs `portal attach`, which flows through the full bootstrap unless a warm-server fast-path exists. This feature depended on the **`warm-command-bootstrap-latch`** feature (the version-stamped `@portal-bootstrapped` server-option latch + abridged fast-path, `state.BootstrappedLatchSatisfied`). That feature is **done and merged to `main`** (verified 2026-07-11), so a warm burst is N cheap abridged attaches. Spawn spawns plain `portal attach` with no bootstrap special-casing.

### Out of scope / deferred

- Group-select (marking a whole project/tag group via its header).
- Remembering groupings; macOS Spaces placement; window arrangement/focus control.
- Host-window introspection / window-vs-tab fidelity.
- A truly headless `portal spawn` (no terminal context) and a `--terminal` override.
- A defensive `@portal-spawn-*` marker sweep (drop-in if ever needed).
- Additional adapter capabilities (`introspect` / `place-on-space`) beyond open-window.

### Naming (provisional)

Ships as `portal spawn <sessions…>`, internal package `internal/spawn`, `spawn` log component, `@portal-spawn-*` markers. A logged `cli-verb-surface-redesign` idea may later rename the CLI verb; the picker calls the spawn *package* in-process, so the verb is a secondary, cheap-to-rename surface.

---

## Spawn Architecture

### Model: one service, two callers

Spawn logic lives in a shared internal package (`internal/spawn`): terminal detection, adapter resolution, and window spawning. It is reached two ways:

- **In-process by the picker** — on `Enter`, the picker calls the spawn package directly to open the N−1 external windows, then self-attaches to the Nth. In-process (not a subprocess) so spawn errors surface back into the TUI where the user is looking, and so the picker can collect per-window acknowledgements to decide success/failure (see *Burst & Partial-Failure Contract*).
- **As `portal spawn <sessions…>`** — a thin CLI over the same package. This is the test seam, backs a `--detect` dry-run, and is the entry point the deferred workspace-restore/Spaces follow-ons reuse. It always runs from a terminal context, never truly headless.

Mental model: one service reached from both a CLI command and the TUI.

### `portal spawn` CLI behaviour

`portal spawn <sessions…>` mirrors the picker's commit exactly — same one-service package, same net-N invariant: it reuses its **calling terminal window** as one of the N (self-attach-last via `AttachConnector`/`SwitchConnector`, in or out of tmux) and spawns the **N−1** others, running the identical pre-flight → sequential spawn → per-window ack → self-attach-last flow. This keeps the CLI a faithful **test seam** for that exact flow. `portal spawn --detect` is a dry-run that only prints the detected terminal identity (friendly name + bundle id) and opens nothing. `portal spawn` with no session args and no `--detect` is a usage error.

**Reporting & exit codes** (the CLI has no TUI, so the picker's in-band banners map to stderr + exit status — this is what tests assert on):

- **Success** → the process **self-execs away** (replaced by the tmux attach); it never returns, so there is no success exit code.
- **Pre-flight abort** (a selected session gone), **partial spawn failure**, and **unsupported/NULL terminal with N≥2** → **exit `1`** with the same one-line message the picker would show, on **stderr**; nothing self-execs.
- **`permission-required`** (rare; native-adapter defensive path) → **exit `1`** with the permission guidance (target terminal + Automation-settings hint) on stderr.
- **Usage error** (no sessions, no `--detect`; unknown flag) → **exit `2`**.

### The N vs N−1 split (anti-leftover rule)

The **net-N-windows** anti-requirement forces the picker to own its own window reuse. The picker turns its *own* host window into one of the N selected sessions:

- **Outside tmux** → exec `tmux attach` (existing `AttachConnector`), which replaces the picker process so its window becomes a session.
- **Inside tmux** → `switch-client` (existing `SwitchConnector`).

So the picker **always self-attaches to exactly one** of the N; only the **N−1 others** are externally spawned. Each spawned window runs the **existing `portal attach <session>`** command — `portal spawn` is *not* what runs inside the spawned windows.

### Order is load-bearing

1. Detect the host terminal.
2. Spawn the N−1 windows (one adapter call per window — for failure isolation), collecting each window's ack.
3. **Only after all N−1 confirm**, exec self into the Nth session.

Step 3 is a point of no return (exec replaces the picker), so the N−1 spawns must complete first. This ordering is what makes cancellation and failure handling clean — the trigger only commits once the N−1 have confirmed (see *Burst & Partial-Failure Contract*).

### Command composition — spawn via the picker's own executable

The N−1 windows spawn running **`<os.Executable()> attach <session>`** — the picker's own absolute binary path, **not** a bare `portal` PATH lookup. Rationale: the warm-command latch is **version-gated** (satisfied only when stored version == running version, per `state.BootstrappedLatchSatisfied`). A PATH-resolved spawn of a *different* portal version would read the latch unsatisfied and full-bootstrap per window, resurrecting the burst storm. Using the picker's own binary guarantees version parity → latch satisfied → each attach takes the abridged fast-path.

Side effect: `portal` no longer needs to be *on* `PATH` (only `tmux` does, since portal shells out to it).

### Spawned-window environment (PATH injection)

The host terminal launches the spawned command in a **bare environment**. (Validated on Ghostty: its `command` execs an **argv, not a shell**, in a bare `PATH` — `/usr/bin:/bin:/usr/sbin:/sbin` plus Ghostty's bin — with no Homebrew/login `PATH`, so `tmux` and any subprocess `portal` shells to would not be found.)

Fix: the picker builds the spawned command as an **env-self-sufficient argv** — it prefixes a **minimal, explicit env** (`/usr/bin/env PATH=<picker's full PATH>`) ahead of `<os.Executable()> attach <session> --spawn-ack <batch>:<token>`, so `tmux` (and anything else `portal` shells to) resolves regardless of the bare environment the host terminal provides. **Inject the minimal set, not a snapshot of the picker's whole environment** — `PATH` is the only required var (any future addition is named explicitly, never a blanket copy). **Load-bearing invariant: `TMUX` (and `TMUX_PANE`) MUST NOT be propagated** into the spawned command — the spawned N−1 are fresh host windows that must run **out of tmux** (so their `portal attach` takes the fresh exec-attach path, not `switch-client`); a picker triggered from *inside* tmux therefore explicitly strips `TMUX`/`TMUX_PANE`. This is a **single uniform mechanism** for both the native adapter and config recipes: the composed command carries its own env, so **no adapter needs a per-terminal env property and no `terminals.json` recipe needs an env slot** — the adapter/recipe just runs the composed command (`{command}`) verbatim, a real **argv**, never shell syntax. (Supersedes the earlier per-adapter env-property framing — env delivery is uniform, in the composed command.)

---

## Multi-Select Mode (TUI Interaction)

### Trigger & marking

- **`m` enters an explicit multi-select mode** from the normal Sessions list. It is a real mode you can sit in with **zero selected** — not an implicit mark-on-entry. `M` (uppercase) stays retired (per §12.2's dropped uppercase bindings).
- **`m` again toggles the cursor (highlighted) row** in/out of the selection. The same key both enters the mode and toggles marks — no second key.
- **`Enter` = open the marked set** (runs the pre-flight → all-or-nothing spawn flow). Enter stays "commit" in both modes: normal mode attaches the cursor row, multi-select mode opens the marked set.
- **`Esc` = exit mode and clear selection.**
- Grouping `HeaderItem` rows are non-selectable and skipped by marking/navigation (existing `skipHeaderRow` invariant).

### N=0 / N=1 boundary

- **N=1** (one marked, Enter): zero windows to spawn — the picker self-attaches to that one session, i.e. it **degenerates to a plain single attach** in the current window. No special-casing.
- **N=0** (nothing marked, Enter): a **no-op that exits multi-select mode**, dropping back to the standard picker (Portal stays open) — same effect as `Esc`. Nothing opens.

### Key coexistence within the mode

- **Live in mode:** `Space` (preview — a firm requirement, still useful while selecting), `/` (filter), `s` (regroup). `/` and `s` stay live so you can filter/regroup to find things to mark.
- **Suppressed in mode:** `k` (kill), `x` (page-toggle), `r` (rename), and other row actions.
- While the `/` filter is focused, `s` and `m` are literal filter characters (the filter input owns typing).

### Sticky selection

Selection is **sticky** across filtering, paging, regrouping, **and the `Space`-preview round-trip**. On return from preview, `rebuildSessionList` re-renders **in-mode with the selection intact**, pruning only a selection whose session was **externally killed** during the preview (consistent with the pre-flight rule — a gone session can't be opened). A row filtered out stays selected and reappears when the filter clears.

### Filter as an inner sub-state

Filter is an **inner sub-state** of multi-select — the existing filter/browse layering, nested:

- **The focused filter input owns `Enter`/`Esc`.** While the filter is focused it keeps its normal meaning (`⏎`/`↓` commit-to-browse, `Esc` clear-filter); multi-select's `⏎` (open-marked) and `Esc` (exit-mode) apply **only when the filter is not focused**.
- **The single notice-band header slot time-shares by focus:** filter-focused → orange filter line + filter footer; otherwise → the multi-select banner + multi-select footer. One claimant at a time (single-slot arbiter).
- **Selections persist underneath** while filtering.

### Mode affordance (visual)

Multi-select must be **as unmistakably a distinct mode as filtering is**, modelled on filter mode:

- Its own **mode colour** + a **banner** in the existing notice-band slot (single-slot arbiter — the multi-select banner owns the slot while in mode), reading e.g. `N selected · m toggle · space preview · ⏎ open · esc cancel`.
- **Selected rows carry a glyph marker + the mode colour, never colour-only** (MV's NO_COLOR / colourless-render rule).
- Exact colour token, glyph, and banner/footer copy are fixed by the delivered Paper design (see *Design References*): **violet** reused as the selection accent, `●` marker on selected rows, footer `↑↓ navigate · m toggle · ␣ preview · ⏎ open · esc cancel`. No new colour tokens.
- **Notice-band precedence** (single slot, highest wins): filter line (filter focused) → in-burst `Opening n/N…` (burst pending) → transient error/guidance flash (pre-flight abort / spawn-failure / permission) → multi-select banner (in mode) → unsupported-terminal banner → no-tags signpost. On an unsupported terminal, entering multi-select shows the multi-select banner (the unsupported banner steps aside) and the unsupported warning re-asserts at the N≥2 Enter block.

### Granularity: per-session only

Group-select (marking a whole project/tag group via its header) is **deferred as separate future work** — it would require letting the cursor land on the currently non-selectable `HeaderItem` rows. This feature ships **per-session marking only**.

**Selection is keyed on session identity, not the list row.** By Tag mode renders a multi-tag session as multiple rows (one per tag heading — Pattern B). Marking is on the **underlying session**: `m`-toggling any one of its rows marks the *session*, so the `●` shows on **all** of that session's rows across headings, and the `N selected` banner counts **distinct sessions** (a multi-tag session counts once). The selection model is a set of session identities, so a mark survives regroup/filter/paging even though the session spans multiple list items.

---

## Burst & Partial-Failure Contract

### Framing

The motivating scenario is a *large* burst (rebuild ~14 windows post-crash), not the clean 3-window path. The "burst = N concurrent full bootstraps" concern is dissolved by the warm-command latch dependency (each attach takes the abridged fast-path). So this contract is about genuine **spawn/attach partial failure**, not bootstrap contention.

### Stance: pre-flight + all-or-nothing

All-or-nothing applies at the **pre-flight gate** — if any marked session is gone, nothing opens at all. Once past pre-flight, the batch opens; the only residual is a rare per-window spawn hiccup, handled by *leave-what-opened* (below) rather than a teardown.

**Pre-flight validate on Enter.** Before opening a single window, verify every selected session still exists (quick `has-session` checks). The dominant failure cause is a session killed between picker-load and Enter; pre-flight catches exactly that. If any selected session is gone:

- **Abort atomically** — nothing spawns, no window opens, no self-attach.
- Show a clean one-line error in the picker naming the gone session(s) (design copy: `⚠ '<session>' is gone — nothing opened`).
- **Prune the gone session(s) from the selection** (they can't be opened) and keep the surviving marks intact, so a second `Enter` proceeds with the survivors rather than re-aborting in a loop. You stay in multi-select mode. (This is the same prune-what's-gone rule as the sticky-selection preview round-trip.)
- Zero windows opened → nothing to undo, no flash.

**Spawn, then self-attach LAST — gated on ALL N−1 confirming.** After pre-flight passes, sequentially spawn the N−1 and collect their acks:

- **All confirm** → the trigger window self-attaches silently (no "14/14 ✓" nag).
- **Any fails** (a transient `osascript`/terminal hiccup *after* pre-flight passed — genuinely rare) → Portal does **not** try to close or undo the windows that already opened; it doesn't own those host windows and won't rely on untested teardown. It **leaves them in place** (they're working attached sessions), **skips the trigger window's self-attach** so you stay in the picker, and shows a clean one-line error naming the window that failed to come up. Portal **unmarks the sessions whose windows opened and keeps the failed/un-acked ones marked**, so a second `Enter` retries exactly the missing set.

This deletes the report / `r retry` / deferred-attach tangle entirely. Trade-off accepted: on a rare post-pre-flight failure you keep the windows that opened and a second `Enter` retries just the one that didn't (still marked), rather than a strict all-or-nothing teardown Portal can't cleanly perform.

### Confirmation mechanism: explicit token ack

`osascript` returning success is shallow — it only confirms "the terminal accepted the request," not that the window rendered, `portal` ran, the session existed, or attach happened.

- **Rejected — tmux client-watching** (snapshot `list-clients`, diff new clients). Fragile here: lingering/reconnecting mosh clients churn the client list during the exact burst window, risking false confirms or masked failures.
- **Chosen — explicit token ack.** The picker issues a **batch id + a per-window opaque token** (both option-name-safe ids, *not* the renameable session name), threads them into each spawned command (a `--spawn-ack <batch>:<token>` flag — see *Ack delivery & `portal attach` contract*); the spawned `portal attach` **writes its `@portal-spawn-<batch>-<token>` marker right before exec**; the picker watches for the marker set with a **timeout**. A missing marker at timeout = a failed spawn → that window is treated as failed (per the Stance above: skip the trigger self-attach, leave the other opened windows in place, report the failed window). A direct signal from our own spawned process, immune to how many other clients are attached — this is what makes spawning a session **already attached elsewhere** (e.g. the iPhone) confirm correctly.

**Ack channel.** A namespaced **`@portal-spawn-<batch>-<token>` tmux server option** — where `<batch>` and `<token>` are picker-generated **option-name-safe ids** (nanoid-style), deliberately **not** the renameable session name (a session name can contain characters invalid in a tmux option name, which would make `set-option` fail → no marker → a false ack-timeout). Behind a small ack seam (write-token / collect-tokens interface). Code-verified safe: the only all-server-options enumerator, `ListSkeletonMarkers`, skips any name not prefixed `@portal-skeleton-` (`internal/state/markers.go`), so a distinct `@portal-spawn-` prefix is invisible to it; namespacing isolates sweeps in both directions; server options die with the server. The server-option channel is also deliberately **daemon-readable**: the deferred remember-and-restore-workspace follow-on can teach the 1s-tick daemon to read the same `@portal-spawn-*` markers and record outcomes as an *additive* change — no rewrite of how the picker collects acks. (Forward-compat only; not built here.)

**Timeout is per-window, not global.** Under sequential spawn the Nth window's `osascript` fires seconds after Enter and then runs its own abridged attach before writing its token; a single global clock from Enter would over-report late windows as failed. Each window's ack timer starts when *its* spawn fires — the cumulative sequential delay never eats the budget.

**Timeout value.** A named `spawnAckTimeout` constant, **default ~8s per window** — generous headroom over the measured ~260ms `osascript` open plus the spawned window's own abridged `portal attach` (fast-path, no full bootstrap) before it writes its token. Each window's timer starts when *its* spawn fires; expiry classifies that window as a failed spawn (→ leave-what-opened). Tunable, and confirmed against real abridged-attach timing at build (same spirit as the documented self-supervision hysteresis constant).

**Honest boundary.** The ack fires at the last instant before exec (once `portal` execs into tmux it's replaced, so it can't ack *after* attaching). It confirms "window opened, `portal` ran, session found, attach handoff starting" — covering every real failure mode; the final tmux handoff is essentially guaranteed once there.

**Cleanup.** The picker self-cleans its batch markers before self-exec (and on a pre-flight abort or a reported spawn failure). Bounded, harmless leaks (a late-laggard ack, a crashed picker) self-expire with the server and never collide (unique batch ids). A defensive `@portal-spawn-*` sweep mirroring bootstrap's `CleanStaleMarkers` is a drop-in if ever needed — deferred.

### Ack delivery & `portal attach` contract

The ack requires a small addition to the **existing** `portal attach` command (outside `internal/spawn`):

- **Carrier: a flag** `--spawn-ack <batch>:<token>` on `portal attach`, part of the composed argv — so it flows through `{command}` and config recipes uniformly, needing no env slot (consistent with the env-self-sufficient command in *Spawn Architecture*). The `<batch>` and `<token>` are picker-generated option-name-safe ids; the flag puts `attach` in spawn-ack mode and tells it exactly which marker to write (no derivation from the session name).
- **Write point & ordering:** abridged bootstrap → confirm the session exists → **write `@portal-spawn-<batch>-<token>`** (value opaque; *presence* is the signal) → exec into tmux. The write is the last action before the exec handoff.
- **Best-effort:** `attach` still execs if the marker write fails — a failed write just means the picker times out and classifies that window failed (safe). A session that fails to resolve at attach time produces **no** marker → picker timeout → failed classification. This is exactly the "honest boundary" the ack depends on.

### In-picker execution model

- **Async, non-blocking.** The picker runs the burst as an async `tea.Cmd` (goroutine) that streams progress + per-window ack results back to the model as `tea.Msg`s — the same pattern as the cold-path concurrent bootstrap. It never blocks the `Update` loop, so the TUI stays responsive and the cancellation points stay live during the multi-second burst (up to ~`spawnAckTimeout` per window).
- **In-burst feedback.** While spawning and awaiting acks, the picker shows a pending affordance in the notice-band single-slot arbiter (e.g. `Opening n/N…`). *Design residual:* the delivered Paper set has no "spawning / awaiting acks" frame — capturing one (or accepting a minimal counter) is a design-phase deliverable for the visual gate.
- **Input-locked while pending.** During the in-flight burst the picker is **inert to row actions** — `m` (mark), navigation, `Space` preview, `/`, `s`, and a second `Enter` are all **ignored**; only **cancel** (`Ctrl-C`/`Esc`) is live. This prevents any race between concurrent user input and the completion handler's selection mutation (below), so the "retry re-opens only what's missing" guarantee rests on a well-defined selection state at completion.
- **Cancellation post-state.** `Ctrl-C`/`Esc` mid-burst **returns to the picker in multi-select mode** (it does not quit Portal), aborts the remaining spawns, leaves any already-opened windows in place, and self-cleans the batch markers. Selection follows the same rule as a partial failure: the sessions whose windows opened are unmarked, the rest stay marked, so a retry re-opens only what's missing.

### Sequential spawn

Spawn the N−1 **sequentially** (one adapter/`osascript` call completes before the next fires). The token ack already makes spawn *order* irrelevant to reporting, so the choice rests on: sidesteps the unverified rapid-fire AppleScript throughput risk, gives clean per-window cancellation points, and turns per-window focus-steal into an orderly cascade rather than thrash. (Validated: 4 sequential `osascript` opens ~1.05s / ~260ms each → a 14-window burst is ~3–4s, no pacing needed.) Reversible — flip to parallel only if a future validation shows it both safe and meaningfully faster.

### Cancellation

Self-exec being the *last* step keeps cancellation clean: `Ctrl-C`/`Esc` before it aborts the remaining spawns and leaves any already-opened windows in place (nothing is torn down); after it there is nothing to cancel (already attached).

### Deferred hardening (recorded, not built)

Because the picker always bootstraps first (its own `PersistentPreRunE`) and stamps the latch to its own version, then spawns that same binary, the latch is always satisfied at burst time and no spawned window full-bootstraps. The only residual is a mid-picker-session in-place binary swap (negligible; a full bootstrap is a safe no-op). A conditional "if the first spawn triggers a full bootstrap, wait for its ack before firing the rest" — which would cap it at exactly one bootstrap — is **deferred as YAGNI**; the ack is the natural wait-signal if ever wanted.

---

## Trigger-Context Matrix & Open Order

### Behaviour across trigger contexts

- **In vs out of tmux at trigger.** *Out* (bare-shell picker): the trigger window reuses via `AttachConnector` (exec `tmux attach`); detection walks the picker's own process tree. *In* tmux: the trigger window reuses via `SwitchConnector` (`switch-client`); detection takes the `list-clients` → client-PID hop. The **spawned N−1 are always fresh host windows running `portal attach` out of tmux**, independent of the picker's context; only the trigger-window reuse differs. One mental model, inside or out.
- **Selected session already attached elsewhere** (this host or a remote/iPhone client): allowed — no dup guard; the token ack confirms *our* new window regardless of other clients.
- **Includes-self** (selection includes the current context's session): the trigger window becomes one attached session, the rest spawn; the marked origin session ends up attached either way.
- **Selected session vanished** between picker-load and Enter: caught by the pre-flight check → atomic abort, nothing opens.

### Enter opens the marked set only

The cursor/highlight at Enter time is irrelevant — a highlighted-but-unmarked row is **not** opened (marking is `m`, not Enter). Enter always commits the `m`-marked set.

### Open order: list order (selection is a set)

Open in **list order** (top-to-bottom as shown), not pick order. The selection is a plain **set**, not an ordered list. Pick-order's only payoff would be window arrangement/focus, which is OS/terminal-controlled and can't be reliably honoured; list order is predictable and matches the visual. The future Spaces/workspace feature will record *explicit* placement rather than infer from tick-order, so capturing pick-order banks nothing.

- **Which marked session the trigger window becomes: unspecified (implementation-convenience).** Cosmetic — no Spaces placement, so all N windows open on the current Space regardless. Not pinned.
- **Window focus** is left to the OS.

---

## Terminal Identity & Detection

### Detection is a standalone operation

Detection (detect-self) is a **separately-callable operation**, not buried in the spawn path — because the unsupported banner must show identity *without* spawning anything. It backs: the unsupported/unconfigured banner, the `portal spawn --detect` dry-run, and the deferred workspace-introspection. It is **not** an adapter method (a resolver maps identity → adapter — see *Adapter Contract*).

### Detection model (refined by live validation)

Live-probed against the real server (~33 clients, many lingering mosh/Blink). The identity walk cleanly separates local Ghostty from remote mosh (→ NULL); `focused` and raw highest-`client_activity` proved **unreliable across clients**. The model anchors on the triggering process's own context, not a shared registry:

1. **Outside tmux (primary flow — fresh terminal → picker):** the picker **self-walks its own process tree** to the terminal (`picker → zsh → ghostty`), or uses the env fast-path (`GHOSTTY_*` / `__CFBundleIdentifier`, accurate outside tmux). Direct — no client list, no tiebreak.
2. **Inside tmux:** take the current session's clients, **NULL-filter to local host clients** (drop mosh/remote/other-machine). The local client's app = the terminal.
3. **`client_activity` demoted to a local-only tiebreak** — used *only* to choose among 2+ local clients on the same session. The trigger keypress makes your window freshest, and mosh noise is already filtered, so it is robust in that narrow role. Never the primary cross-client signal.
4. **Host-local principle (multi-machine).** Portal opens windows only on the machine it runs on, for local clients; other-machine access is a remote client → NULL → filtered. A purely-remote trigger (no local client) → the honest "no host-local terminal" no-op — run Portal on that machine to spawn there.

### Identity resolution: macOS bundle id, matched as a family

The system-blessed identity is the terminal's macOS **bundle id**. The walk resolves `client_pid → process-tree → .app bundle` via an Info.plist read (`defaults read` of the bundle's Info.plist — a clean `lsappinfo`-free route). Matching is by **bundle-id family** (e.g. `dev.warp.Warp-*`), channel-aware. Remote/mosh clients resolve to a **NULL bundle id** → unsupported → honest no-op.

Validated (this Mac): `ps -o comm=` returns full paths; the walk cleanly separates local Ghostty (`→ login → /Applications/Ghostty.app/…/ghostty` → bundle id) from remote mosh (`→ mosh-server` at ppid 1 → NULL). Read-only, no `osascript`/Apple-event needed. *(Build-time residual: confirm the walk on ≥1 other macOS version.)*

### User-facing display: both

The unsupported/unconfigured banner and the `--detect` command show **both**:

- the friendly `.app` name (for reading), and
- the exact **bundle id** (the copy-paste config key).

This solves the chicken-and-egg the research flagged: a custom-config user cannot guess the key a priori, so Portal *shows* it — copy-paste, never guess. (Design copy example, from the delivered banner frame: `⚠ unsupported terminal — Apple Terminal · com.apple.Terminal` with a `see docs` link.)

### Config keys accepted: layered

Custom config accepts, layered (see *Config Schema*):

- **Friendly alias** (`ghostty`, `warp`) — Portal-shipped, for *known* terminals; maps to the bundle-id family.
- **`.app` name** / **raw bundle id** / **`*`-glob** — the escape hatch for custom/unknown terminals.

Whatever Portal displayed, the user can paste it and it resolves. Internal **matching** stays on bundle-id families; user-facing keys are the friendlier forms.

### No headless story

`portal spawn` exists to open terminal windows, so it only ever runs from a terminal context (the picker is in one; a script is run in one; the future workspace feature triggers from a terminal). There is no sensible headless caller — chicken-and-egg. So: **no special headless handling and no `--terminal` override**. If detection ever returns empty, it folds into the **same NULL-bundle path** already decided for remote/mosh → unsupported → clean error/banner.

### Detection lifecycle

- **Detect once, cached.** The host-terminal identity is invariant for the picker's lifetime, so detection runs **once per picker session** on Sessions-page entry and is cached — reused by the on-entry banner and the N≥2 Enter gate. `rebuildSessionList` (hit on `s`-toggle, refresh, filter, projects-edit return) must **not** re-walk; it reads the cached identity. Re-derived on the next picker launch.
- **Off the first-paint path.** Detection runs asynchronously (the walk — `ps` / process-tree / Info.plist read — costs tens of ms); the banner appears when it resolves, so it never stalls the ~50ms appearance-gate first paint.
- **Error vs clean NULL.** A clean NULL (remote/mosh → unsupported) and a *transient detection error* (a `ps` / `defaults read` failure) both resolve to the unsupported/no-op path; a transient error additionally emits a `spawn`-component WARN breadcrumb.
- **In-flight at Enter.** Because detection is async, a fast N≥2 `Enter` can land before it resolves. The gate distinguishes **in-flight** (not yet set) from a **resolved NULL**: an in-flight identity is **awaited** (near-instant — detection began on page entry) and the burst proceeds once it resolves (supported → spawn; NULL/error → unsupported no-op). It is never treated as unsupported merely for being unresolved.

### Unsupported-terminal behaviour (banner + Enter)

- **Detection runs on Sessions-page entry**, so the unsupported/unconfigured banner (naming the detected identity) surfaces **proactively** over the normal list — you know the terminal is unsupported before marking anything.
- **Multi-select stays available** on an unsupported terminal — you can still enter mode and mark, because single-attach needs no adapter.
- **`Enter` with N=1** proceeds regardless of detection: it is a plain self-attach via `AttachConnector`/`SwitchConnector` (reuses the current window, opens no host window, needs no adapter).
- **`Enter` with N≥2** on an unsupported/NULL terminal is an **atomic no-op** — nothing opens (the N−1 external windows need an adapter that isn't available) — and the unsupported banner is (re)asserted naming the detected identity. Same "honest no-op" as remote/mosh. (The N=1-works vs N≥2-blocked asymmetry is intentional: only external-window spawning needs the adapter.)

---

## Adapter Contract & Extensibility

### Detection is separate from the adapter

Detect-self resolves *identity*; a **resolver** maps identity → adapter via the precedence chain; the adapter is per-terminal and only opens windows. Detection is **not** an adapter method.

### Resolution precedence

**config override → native adapter → unsupported.** Config can override a built-in too (e.g. Ghostty + a resize). A NULL/unmatched identity → unsupported.

### Generic contract: open a window running a command

The adapter's single job is **open a new host window running a given command** — `OpenWindow(command)` — **not** "attach to a session." The **spawn layer composes the command** (`<os.Executable()> attach <session>` + the ack token) and hands it to the adapter.

- Rejected: a session-aware `OpenAttached(session)` — it would bake `portal attach` into every adapter and scatter the attach+ack composition.
- Keeps adapters dumb and portable (one thing: open a window running a command); keeps the `portal attach` + ack composition in one place; and future-proofs the adapter — the same open-window primitive can be handed *different* commands later (the workspace feature, other actions) without touching adapters.
- Knock-on for config: the custom-terminal placeholder is **`{command}`** (the thing to run), not `{session}`.

### Two implementations, same contract

- **Built-in Go adapters** (Ghostty ships in this feature) — compiled in, not config.
- **User-config entries** (`terminals.json`) — the escape hatch (see *Config Schema*).

Each adapter owns its own terminal-specific concerns: how it opens a window running the given command, and quarantining all OS/terminal specifics behind a typed result (see *Permissions & Error Quarantine*). Env/`PATH` is **not** an adapter concern — the composed command is env-self-sufficient (Portal builds it as an `env`-prefixed argv), so adapters and config recipes run it verbatim (see *Spawn Architecture* → env self-sufficiency).

### Capability-based extensibility

Adapters implement exactly one capability in scope: **open-window-with-command**. Future `introspect` / `place-on-space` slot in as *additive* optional capabilities (Go interface segregation, checked by type assertion) without touching existing adapters. Only the open capability is in scope for this feature; the capability mechanics are an implementation concern.

---

## Config Schema (`terminals.json`)

### Location & format

`~/.config/portal/terminals.json` — Portal's JSON-store convention (like `projects.json` / `hooks.json`), XDG-resolved via the existing `configFilePath`. Read-only at spawn time; user-authored.

### Structure

Each **entry = identity-matcher → capability map**:

- **Key** = whatever identity form the user pastes: a friendly alias (to override a built-in), a `.app` name, a raw bundle id, or a `*`-glob.
- **Value** → `commands` → `open` (the only capability key in scope) → a **recipe**.
- Future `introspect` / `place` are **additive sub-keys**, not a breaking schema change — config and adapter extend in lockstep.

### Recipe: explicit fields, not magic

The recipe is **`argv`** (inline argv-array template) **or** **`script`** (path to a file Portal runs) — chosen over auto-detecting "is it a path on disk?" (clearer, no disk-probing surprise):

- **`argv`** is an **argv array** (not a string), to sidestep shell-quoting hell. The inline field is named `argv` (not `command`) to avoid colliding with the placeholder.
- **`script`** is a path to a file Portal executes.

### Placeholder `{command}`

Portal substitutes `{command}` with `<os.Executable()> attach <session>` + the ack token. Config expresses only "how my terminal opens a window running `{command}`"; Portal fills in the attach.

```json
// ~/.config/portal/terminals.json
{
  "dev.warp.Warp-*": {
    "commands": { "open": { "argv": ["osascript", "-e", "tell app \"Warp\" to create window with command \"{command}\""] } }
  },
  "com.example.MyTerm": {
    "commands": { "open": { "script": "~/.config/portal/terminals/myterm.sh" } }
  }
}
```

### Recipe execution contract

The config-driven path gets the *same* execution guarantees the native Ghostty adapter got, so a custom recipe never re-hits the PATH/exec fixes the native path already absorbed:

- **Portal makes `{command}` self-sufficient, uniformly.** The picker (which has your full PATH) builds `{command}` as an **env-prefixed argv** (`/usr/bin/env PATH=<picker PATH> … <abs>/portal attach <session> --spawn-ack <batch>`; see *Spawn Architecture* → env self-sufficiency) — so recipe authors only ever describe "open a window running this command," never PATH/env plumbing, and no recipe needs an env slot.
- **`{command}` substitutes as a single, already-resolved command string**, dropped literally into the recipe. Escaping it for an *embedding* context (e.g. inside an AppleScript string) is the recipe author's responsibility — they wrote that AppleScript. The `argv`-array form exists precisely so simple CLI terminals (kitty/wezterm) avoid quoting entirely.
- **`script` recipes receive `{command}` as `$1`** (first positional arg). Portal **expands a leading `~`** in the script path and **executes the file directly** (it must carry its exec bit + shebang — the standard for an executable escape-hatch script); a missing / non-executable script is an invalid entry (skipped + WARN, per *Validation & error handling*).
- **Recipe failure classification.** A config recipe is a generic argv/script, so Portal cannot read AppleEvent codes from it: a **non-zero exit** of the recipe process maps to `spawn-failed`; otherwise the window's fate is decided by the **ack** (timeout → failed). `permission-required` is **native-adapter-only** — config recipes never produce it, so they never trigger the burst-stopping permission path (they fold into `spawn-failed` / timeout → leave-what-opened + report).

### Validation & error handling

`terminals.json` is a shipped, user-authored escape hatch that drives command execution, so malformed input is expected and must degrade safely, never crash the picker. Consistent with Portal's other JSON stores (tolerant decode):

- **Malformed / unreadable file** → the whole file is ignored; resolution falls through to native adapters → unsupported. A WARN breadcrumb is emitted under the `spawn` component.
- **Per-entry recipe** must carry **exactly one** of `argv` / `script`. Neither or both → that entry is invalid and skipped (falls through to native → unsupported), with a WARN naming the entry key.
- **A recipe template omitting `{command}`** → invalid entry, skipped with a WARN (a window with no `{command}` would never run the attach).
- **Unknown capability sub-keys** (e.g. a future `introspect` / `place`) → ignored (forward-compat).

Every rejection emits a `spawn`-component breadcrumb so a config typo is diagnosable rather than silently degrading to "unsupported."

### Precedence

config override → native adapter → unsupported. Config can override a built-in (e.g. Ghostty + a resize).

**Within config, most-specific wins** (a single identity can match several entries — a raw bundle id, a `.app` name, a friendly alias, and a `*`-glob). Deterministic order, highest first: **exact raw bundle id** → **exact `.app` name / friendly alias** → **`*`-glob** (a longer/more-specific glob beats a broader one; a bare `*` catch-all is lowest). So a user's specific override always beats their glob fallback, never the reverse.

---

## Permissions & Error Quarantine (TCC)

### Architectural boundary (the core decision)

All terminal/OS-specific concerns — the AppleScript, `osascript`, the `-1712`/`-1743` AppleEvent codes, TCC, any macOS deep-link — live **inside the terminal driver and nowhere else**. The driver translates them into a **generic typed result** — a small taxonomy:

- `permission-required` (with guidance text)
- `unsupported`
- `spawn-failed`

Portal's general spawn/report/UI code switches on the category and **never sees an AppleScript string or AppleEvent number**. Every future terminal driver gets the same clean contract.

### TCC is self-exempt — no first-run gate (validated live)

Live-tested: reset `com.mitchellh.ghostty` AppleEvents grant → fresh spawn → **succeeded with no dialog and no TCC row recreated**. So **Ghostty-scripting-Ghostty via `osascript` is self-exempt**. Because detection always resolves to the terminal you are in and we spawn *that same* terminal, the AppleScript path is **always self→self → always exempt** — there is no design path to a genuine cross-app event.

**Therefore there is no TCC first-run prompt in the normal flow.** Portal is never the TCC subject; the responsible process is the host terminal.

### Defensive net (not a load-bearing gate)

The `-1743` (denied) / `-1712` (timeout) handling stays as a **defensive net**, not a first-run gate:

- The driver recognises its own `-1743`/`-1712`, returns `permission-required`.
- General code surfaces actionable guidance — names the target terminal and offers to open the Automation settings pane (the deep-link composed *in the driver*, handed up as opaque guidance).
- Grant persists; re-triggering works — the standard macOS permission model. Per-`(source, target)` pair: switching terminals re-prompts, handled identically.
- **Within a burst:** a `permission-required` result is accounted like a failed window (skip self-attach, leave opened windows in place, keep the affected session marked) **and stops the burst** — since spawns are sequential and the grant is per-`(source, target)`, every later window would hit the same wall. It surfaces the permission **guidance once for the batch** (naming the target terminal + the Automation-settings deep-link), not the generic one-line spawn error. The grant persists, so a retry after granting proceeds. (Rare: TCC is self-exempt in the normal flow.)

### Residual (build-time check)

iTerm2 / Terminal.app self-scripting is **assumed** same-exempt but **unverified** — a per-adapter check at build time.

---

## Observability & State Footprint

### State / daemon footprint (near-zero persistent state)

New *code* lands (the `internal/spawn` package, terminal drivers, a `terminals.json` config store), but near-zero persistent *state*:

- **Reads** `terminals.json` (user-authored, read-only at spawn time).
- **Writes** only transient `@portal-spawn-*` tmux server options (self-cleaned per the ack contract — not files, not captured; the daemon's capture is structural sessions/panes, not a server-option dump).
- **Does not touch** `sessions.json`, the daemon capture loop, `prefs.json`, or the restore machinery.

### Observability (`spawn` log component)

The spawn flow gets its **own `spawn` log component** — a deliberate amendment to Portal's closed logging taxonomy (a new spec-governed component, not a call-site invention). Closed event catalog, emitted from the spawn chokepoint:

- detection outcome (identity / unsupported / NULL-bundle)
- adapter resolution (config-override vs native)
- per-window spawn + ack outcome (confirmed / timeout / failed)
- `permission-required`
- batch summary

Emission shape matches bootstrap/restore/daemon instrumentation: **one INFO cycle-summary** (e.g. `spawn: opened 11/14`) + **DEBUG per-window**. The driver's OS-specific detail rides up as an opaque `detail` attr so the closed vocabulary stays intact (honours the driver-quarantine rule).

**Attr keys (closed set).** The `spawn` component introduces these spec-governed attr keys (not invented at call-site), consistent with how bootstrap/restore/daemon enumerate theirs: `batch` (batch id), `terminal` (friendly app name), `bundle_id` (matched bundle-id family), `resolution` (`config` | `native` | `unsupported`), `session`, `ack` (`confirmed` | `timeout` | `failed`), `opened` / `total` (batch-summary counts), and the opaque `detail` (driver OS-specific string). **Count semantics:** `total` = **N** (all sessions in the batch, including the trigger's self-attach target); `opened` = sessions **surfaced** — each acked spawn plus the trigger's self-attach when it occurs (full success = `opened N/N`; on the failure path the trigger self-attach is skipped and not counted).

---

## Concurrency & Post-Reboot Safety

N near-simultaneous `tmux attach` against a server that may still be hydrating post-reboot is **not** a contention risk, for reasons already built in:

1. **The skip-bootstrap latch removed the big race.** Burst attaches take the abridged path — no full bootstrap per window — so N concurrent sweeps/restores/cleans against one server is gone (see *Spawn Architecture* / dependency).
2. **The picker gates the burst to *after* hydration.** The cold+TUI path reaches the Sessions page (where multi-select lives) only on `BootstrapCompleteMsg` — after Restore + EagerSignalHydrate + `@portal-restoring` cleared. So the burst cannot be triggered until hydration is done. (A direct `portal spawn` CLI as the first post-reboot command runs its own bootstrap synchronously first — same guarantee.)
3. **Abridged attaches don't perturb capture.** A new client attaching adds a *client*, not session/window/pane structure — all the daemon captures — so the 1s capture tick and daemon self-supervision are untouched.

---

## Testing Strategy & DI Seams

Portal drives a real GUI terminal (`osascript` → Ghostty), hard to automate. The strategy is seam-based coverage with a live terminal only for the last inch.

### Primary seam: the `Adapter` interface

A **fake adapter** records "would open a window running command X" without touching a real terminal → the entire spawn pipeline is unit-testable:

- adapter resolution + precedence (config → native → unsupported)
- `{command}` substitution
- token-ack collection
- pre-flight abort + leave-what-opened failure handling

### Detection behind small seams

Detection reads behind small (1–3-method) interfaces (process-tree walk / `ps` / `lsappinfo`-or-Info.plist / `tmux list-clients`), Portal's existing DI pattern → detect-self *resolution* (local-client NULL-filter, walk-to-bundle-id, family match, NULL→unsupported, the local-only activity tiebreak) is unit-testable with fabricated data. The real walk is integration (real-tmux `tmuxtest` fixture) / manual.

### Driver split for testability

Each terminal driver splits into:

- **Pure command-construction** (building the `osascript`/argv) — unit-tested (assert the built command).
- **Error-mapping** (`-1712`/`-1743` → typed `permission-required`) — unit-tested (fabricated `osascript` outcome; assert the mapped typed result).
- **Thin exec boundary** (real `osascript` + TCC modal) — manual/integration-gated only.

### Mode/keymap state machine

The multi-select mode is unit-tested as a Bubble Tea model (existing `internal/tui` pattern): enter / toggle / exit, sticky selection, suppressed keys, filter-inside-multi-select, N=0/N=1 boundary.

### Irreducible manual/integration residue

The real window actually opening + the TCC modal need a live Mac — covered by manual verification + the Paper visual gates (see *Design References*), not automated CI.

---

## Design References

The feature's UI is designed in **Paper** (where Portal's Modern Vivid design system lives). Three frames were delivered and **approved**, cloned from *Sessions — Modern Vivid v2* so they inherit the exact tokens/type/layout. Committed PNG exports under the feature's `design/` directory are the implementation reference:

1. **Sessions — Multi-Select (active)** — `design/sessions-multi-select-active.png`. Violet `3 selected` banner (filter-line analogue); violet `●` markers on selected rows incl. the cursor row; `Space` still preview; footer `↑↓ navigate · m toggle · ␣ preview · ⏎ open · esc cancel`.
2. **Sessions — Multi-Select (pre-flight abort)** — `design/sessions-multi-select-preflight-abort.png`. Red `⚠ '<session>' is gone — nothing opened`; the gone session flagged with a red `⚠` + `session gone`, other selections intact, the multi-select mode + footer unchanged (nothing opened). Reflects the all-or-nothing contract.
3. **Sessions — Unsupported terminal (banner)** — `design/sessions-unsupported-terminal.png`. Amber `⚠ unsupported terminal — Apple Terminal · com.apple.Terminal` + blue `see docs`, over the normal Sessions list/footer (names the detected identity for copy-paste).

### Tokens

Accent: **violet** reused as the selection accent; amber/red pulled from the existing palette for warning/error — **no new tokens**. Dark-mode; light-mode variants deferred unless requested.

### Open toss-up (settled)

Whether unselected rows carry a dim `○` was left as a review toss-up; the delivered frames are built **clean (selected-only, no dim `○`)**.

### Visual-gate process

Follows the project's reference-first workflow: the committed `design/` frames are the implementation reference. Implementation may reference these directly, or re-capture fresh frames via the `capturetool` / `vhs` harness once the feature is built — moving them to `testdata/vhs/reference/` when wiring the visual gate.

---

## Dependencies, Deferred Scope & Build-Time Residuals

### Hard dependency (satisfied)

`warm-command-bootstrap-latch` — the version-stamped `@portal-bootstrapped` server-option latch + abridged fast-path (`state.BootstrappedLatchSatisfied`). **Done and merged to `main` (verified 2026-07-11).** Spawn spawns plain `portal attach` with no bootstrap special-casing; the picker's own binary (`os.Executable()`) keeps the latch version-satisfied so each burst attach is abridged.

### Deferred scope (not built by this feature)

- **Group-select** — marking a whole project/tag group via its header (requires cursor on non-selectable `HeaderItem` rows).
- **Remember-the-grouping + macOS Spaces placement** — the workspace-restore follow-on; Spaces already parked in inbox.
- **Window arrangement / focus control** — OS/terminal-controlled; not honoured.
- **Host-window introspection / window-vs-tab fidelity** — dropped from scope entirely.
- **Additional adapter capabilities** — `introspect` / `place-on-space` slot in additively later.
- **Truly headless `portal spawn` + `--terminal` override** — no sensible caller (YAGNI).
- **Defensive `@portal-spawn-*` marker sweep** — a drop-in mirroring bootstrap's `CleanStaleMarkers` if ever needed.
- **Parallel spawn** — sequential ships; flip only if a future validation proves it safe and meaningfully faster.
- **"Detect-and-wait" one-bootstrap-cap hardening** — YAGNI given the latch; the ack is the natural wait-signal if ever wanted.

### Build-time residuals (confirmations, not open questions)

- **iTerm2 / Terminal.app self-scripting** assumed same TCC self-exemption — per-adapter check.
- **`ps -o comm=` / identity walk** verified on this macOS only — confirm on ≥1 other version (the Info.plist `defaults read` route is a clean `lsappinfo`-free fallback).
- **Ghostty AppleScript API** is a preview API (may churn in 1.4) — pin/watch. Real shape (validated on 1.3.1): make a `surface configuration` record with a `command` property (and a `wait after command` property governing whether the window persists after its command exits — the normal-detach window lifecycle for a spawned session), then `new window` with it.

### Naming (provisional)

CLI verb `portal spawn <sessions…>`, `internal/spawn` package, `spawn` log component, `@portal-spawn-*` markers. The logged `cli-verb-surface-redesign` idea may later rename the CLI verb; because the picker calls the spawn *package* in-process, the verb is a secondary surface and cheap to rename. Internal names follow the command name.

---

## Working Notes

[Optional - capture in-progress discussion if needed]
