# Specification: Enter Attaches From Preview

## Overview

Add an `Enter` binding to the scrollback preview page that attaches to the previewed session, honouring any `(window, pane)` focus the user navigated to inside preview. Today preview's `Update` handler has no `tea.KeyEnter` case — `Enter` falls through to the embedded viewport as a no-op, forcing the user to press `Esc` to dismiss and then `Enter` on the Sessions list. This feature adds the single-keystroke commit path the user's mental model expects.

This is an **intentional behaviour extension**, not a bug fix. The prior `session-scrollback-preview` specification explicitly scoped preview's owned keymap to `]`, `[`, `Tab`, `Esc`; this feature lifts `Enter` out of "everything else is unbound/no-op" as the single new exception. Preview remains a verification surface — the new Enter binding does not open the door to inheriting other Sessions-page action keys (see *Keymap expansion policy*).

### Spec scope

This specification is **additive**. The prior `session-scrollback-preview/specification.md` is referenced for unchanged surfaces (open trigger, layout, viewport, esc level tree, scrollback read pipeline) but is not edited. Specs from completed work are frozen historical records.

This specification covers:

- The new preview-page `Enter` binding and what it commits.
- The pre-select + attach sequence (`has-session` → `select-window` → `select-pane` → connector) and best-effort failure semantics.
- The session-killed-externally refresh-and-bail path with a feature-local minimal inline flash on the Sessions list.
- The discoverability update to the preview chrome line.
- The keymap expansion policy in its general form, so future binding proposals have a clear test to argue against.

---

## Enter binding behaviour

Preview's `Update` handler gains a `tea.KeyEnter` case. When the user presses `Enter` while preview is the active page, preview commits an attach to the previewed session, applying any `(window, pane)` focus the user navigated to inside preview before handing off to the existing connector path.

`Enter` is **intercepted** by preview's `Update` handler and is NOT forwarded to the embedded viewport. The handler returns after dispatching the attach sequence; the key event does not propagate further. Today's `bubbles/viewport` treats `Enter` as a no-op for scrolling, so the observable difference is zero — but future `bubbles/viewport` behaviour for `Enter` cannot leak through to preview.

### What Enter commits to

Preview's `]`, `[`, and `Tab` keys already build up a real `(window, pane)` focus — they are not viewport chrome, they are navigation state. Enter treats that state as **intent**, not a viewport-rendering concept:

- **Session**: the session the preview was opened on (captured by name at preview open, not by list-row position).
- **Window**: the window index the user navigated to via `]`/`[`, defaulting to the captured window if the user did not navigate.
- **Pane**: the pane index the user navigated to via `Tab`, defaulting to the captured pane if the user did not navigate.

The user paid keystrokes to focus a specific coordinate; Enter honours those keystrokes. The "walked-away peek" scenario (user previously had pane 2 active in the session, walked away, came back, previewed, Tab'd to pane 0 to peek, then Enter) is the accepted cost: Enter lands on the last-focused preview pane rather than tmux's prior current pane. The user's most recent `]`/`[`/`Tab` press is their stated intent — if they only wanted to peek, they would have used `Esc`.

### Transition mechanics

The pre-select and attach sequence is issued **as one logical unit from preview's `Update`**. No intermediate render. No round-trip to the Sessions page. Preview does not dismiss to Sessions and then re-fire Enter — the Sessions-page `Enter` handler does not know about preview's `(window, pane)` focus, so the sequence must be authored as a single unit in preview's update.

Implementation shape (e.g. `tea.Sequence` vs a single combined connector wrapper) is a build-phase detail. The spec-level constraint is: the four-call sequence (`has-session` → `select-window` → `select-pane` → connector) must complete in order, with selects completing before the connector hands off the terminal.

---

## Pre-select + attach sequence

On `tea.KeyEnter` in preview, the following four-call sequence runs in order. Each step has defined semantics for both success and failure paths.

### 1. `tmux has-session -t <session>`

A proactive existence check, run **before** the pre-select calls.

- **Zero exit (session exists)**: proceed to step 2.
- **Non-zero exit (session gone)**: bail. The session has been killed externally (by `tmux kill-session`, `portal clean`, the daemon, or another tmux client) between preview open and Enter. Dispatch the refresh-and-bail path — see *Session-killed-externally bail path* below. Steps 2–4 do not run.
- **OS-layer error (missing binary, exec failure)** — distinct from a non-zero exit: treat as "session present" and proceed to step 2. An OS-layer error is not a tmux-state signal; the connector will fail in the same shape it would have without the check, and `EnsureServer` already validates tmux is invocable in bootstrap.
  - **Discriminator contract**: build phase MUST distinguish `*exec.ExitError` (non-zero exit — bail) from non-`ExitError` errors (OS-layer failure — proceed). The discriminator mechanism is a build decision (e.g. extend `Commander` return shape, type-assert at call site); the spec-level contract is that the two cases are not collapsed into a single "any error" branch.

This is one extra tmux round-trip per Enter. Negligible — sub-millisecond locally, well within UI responsiveness.

#### Exact-match target syntax

`has-session` and all subsequent `-t <session>` calls (`select-window`, `select-pane`, `attach-session`, `switch-client`) MUST use tmux's exact-match prefix `=` — i.e. `-t '=<session>'` rather than `-t <session>`. Without this, tmux's default target resolution matches by prefix: a killed session "foo" coexisting with a live "foo-2" would have `has-session -t foo` return zero (matching "foo-2"), causing the bail path to be missed and the connector to attach to or auto-create the wrong session.

The exact-match prefix must be applied uniformly across the four-call sequence; any single call that drops it can re-introduce the prefix-collision hazard.

### 2. `tmux select-window -t <session>:<window_index>`

Best-effort. Uses the window index preview captured at open and walked with `]`/`[`.

- **Zero exit**: proceed.
- **Non-zero exit (window no longer exists)**: log and swallow. Do not block, do not warn the user, do not abort. Proceed to step 3 (which will also fail), then step 4.
- **Log shape**: swallowed failures log at WARN through the existing structured logger (`internal/state`), consistent with how bootstrap logs similar best-effort failures. Build phase picks the exact component string (e.g. `ComponentPreview` or `ComponentTUI`); the spec-level contract is WARN-level + structured-logger + greppable component, not silent.
- **No re-enumeration**: do NOT call `list-panes -F` or any structural enumeration on Enter. Re-enumeration would cost a round-trip on every Enter for an edge case that is bounded and self-correcting.

### 3. `tmux select-pane -t <session>:<window_index>.<pane_index>`

Best-effort. Uses the pane index preview captured at open and walked with `Tab`.

- **Zero exit**: proceed.
- **Non-zero exit (pane no longer exists)**: log and swallow. Same shape as step 2 (WARN through the structured logger; same component string).

### 4. Connector handoff

The existing connector path runs, unchanged:

- **Outside tmux**: `AttachConnector` issues `syscall.Exec` to hand off the process to `tmux attach-session -t '=<session>'`.
- **Inside tmux**: `SwitchConnector` issues `tmux switch-client -t '=<session>'` (two-step: create detached session if needed, then switch).

The connector target is intentionally **session-only** (no `:window.pane` suffix). The pre-select calls in steps 2 and 3 are what position tmux on the focused `(window, pane)`; the connector resolves the session's current window/pane at connect time and inherits whatever the pre-selects established. Both `attach-session` and `switch-client` use the `=` exact-match prefix uniformly with the pre-select calls (see *Exact-match target syntax* above).

If the pre-select calls all succeeded, the connector lands the user on the focused `(window, pane)`. If the pre-selects failed (steps 2 and/or 3), tmux's last-current pane in the session wins as a natural fallback — equivalent to the pre-existing Sessions-page Enter behaviour. No regression.

### Captured coordinate freshness

Preview captures structural enumeration at preview-open and walks `]`/`[`/`Tab` purely locally — no mid-preview re-enumeration. Pre-select acts against those captured-then-walked coordinates. This model is inherited from the prior preview spec and is restated here for completeness.

### Captured coordinate values — raw tmux indices, not slice positions

The captured `(window, pane)` values passed to `select-window -t <session>:<window_index>` and `select-pane -t <session>:<window_index>.<pane_index>` MUST be raw tmux `window_index` and `pane_index` values (the values returned by `list-windows -F '#{window_index}'` / `list-panes -F '#{pane_index}'`), **not** 0-based slice positions in the captured enumeration.

Tmux's `window_index` and `pane_index` are 1-based by default and can be non-contiguous (e.g. after window or pane kills). Storing slice position would silently misaddress on any session with non-contiguous indices.

The existing `WindowGroup` enumeration shape from `ListWindowsAndPanesInSession` already preserves raw `WindowIndex` and `PaneIndices[]int`. Preview's existing `currentRawIndices()` helper (`internal/tui/pagepreview.go`) already distinguishes raw indices from slice cursors; the pre-select sequence must use the raw values from that helper (or equivalent).

### Hook firing

The pre-select sequence does not trigger any tmux hook events — `select-window` and `select-pane` are plain tmux commands. The connector handoff WILL trigger tmux's `client-attached` hook (which Portal registers to run `portal state signal-hydrate`), but post-bootstrap there are no armed `@portal-skeleton-*` panes, so `signal-hydrate` is a no-op and no on-resume hooks fire. On-resume hooks fire only inside the hydrate helper's exec chain during restore (bootstrap step 5), per `cmd/state_hydrate.go`'s `execShellOrHookAndExit`. This feature does not change hook semantics.

---

## Session-killed-externally bail path

When `has-session` returns non-zero (step 1 of the pre-select sequence), the session has been killed between preview open and Enter. Preview bails instead of proceeding through the rest of the sequence.

### Behaviour

On non-zero `has-session` exit, preview dispatches a refresh-and-bail message that:

1. **Transitions `pagePreview → pageSessions`** — the same page-state transition that `Esc` performs today.
2. **Triggers the existing sessions-list refresh** on that transition. Per the prior preview spec, the dismiss handler already dispatches a sessions-list refresh on the `pagePreview → pageSessions` transition so externally-killed sessions disappear from the post-dismiss list. The bail path reuses this contract.
3. **Emits an inline flash message** — one ephemeral line pinned above the Sessions list. Exact wording is fixed by this spec:

   ```
   session "<name>" no longer exists
   ```

   The `<name>` placeholder is the captured session name. Double quotes surround the name. No trailing punctuation. Build phase must not paraphrase the message.

The user lands back on the Sessions page with the killed session already absent from the list and a single-line message explaining why their Enter "didn't work".

### Render-frame ordering

The transition, refresh dispatch, and flash emission are issued from the same `Update` return — they share a single Bubble Tea cycle on the dispatch side. The refresh itself may be asynchronous (returning a later `sessionsLoadedMsg`); in that case a brief render frame may show the freshly-transitioned Sessions page with the **prior** list state plus the flash, followed by a second render once the refresh resolves. This transient stale-row frame is **acceptable** — the flash text always reflects the bail, and the killed-session row is removed by the next render.

The build phase MUST NOT gate the flash render on refresh completion (which would delay the visible response to Enter). The principle is: visible response first, list consistency converges within a render or two.

### Inline flash — feature-local infrastructure

The flash mechanism is **bespoke to the Sessions page** and scoped to this edge case. This feature does NOT introduce a general-purpose toast/notification layer.

Shape:

- **State**: a small piece of model state on the Sessions page model — at minimum an active flash text string and an associated timestamp or tick handle.
- **Render**: a single chrome line rendered between the filter input and the Sessions list. The flash sits adjacent to the list it is describing — the filter input remains in its existing position above the flash, and no existing chrome row is replaced or overlaid. The flash row is rendered **only when a flash is active**; when no flash is active, no row is reserved (the list sits directly under the filter input as today). First bail visually pushes the list down by one row; tick expiry or the next clearing keystroke pops it back up.
- **Clear conditions**:
  - The next `tea.KeyMsg` (actionable keystroke) — see *Flash interaction with filter input* below.
  - A tick `tea.Cmd` after a short duration. Default principle: "long enough to read, short enough not to linger". Exact tick duration is a build-phase decision; the discussion noted `~3s` as a reasonable default.
  - Modifier-only events (e.g. holding shift alone), resize events, and focus events do NOT count as clearing events.

### Replacement on rapid successive bails

A new bail while a prior flash is still visible **replaces** the prior flash's text and **resets** the tick — the visible message always reflects the most recent bail. Any pending tick from the prior flash is cancelled or otherwise prevented from firing against the new flash. Build-phase shape (e.g. monotonic flash ID, single-shot tick handle, generation counter) is a build decision; the spec-level constraint is "latest bail wins, prior pending tick must not clear the new flash early".

Future general-purpose flash/toast infrastructure may replace or absorb this bespoke chrome line. That work is out of scope (logged as inbox idea `.workflows/.inbox/ideas/2026-05-14--general-tui-flash-infrastructure.md`).

### Flash interaction with filter input

The first keystroke post-bail clears the flash AND applies to the filter input as normal — **one key, one intent**. The flash does not swallow the keystroke on the user's behalf. If the user starts typing into the filter immediately after the bail, those characters land in the filter input as they would on any other Sessions-page render; the flash simply clears.

### Accepted residual — TOCTOU between has-session and connector

A vanishingly small race window remains between `has-session` returning zero and the connector firing: the session can be killed in the microseconds between the two calls. This residual is **accepted as rare and intentionally not designed for**:

- **Outside tmux**: `tmux attach-session -t <name>` returns a non-zero exit because the named session is gone. The connector handoff fails and portal exits with the tmux error printed to stderr. The bail-flash path inside the pre-select pipeline (has-session probe) catches this case before the connector runs in normal flow; this paragraph documents only the residual TOCTOU window where the session is killed between has-session probe and exec handoff.
- **Inside tmux**: `tmux switch-client -t <name>` errors; the TUI has already torn down, so the message location is unclear.

Documented here so build phase does not attempt a defensive guard against a window with no observable victim distinct from "session killed during the connector call itself".

---

## Other edge cases

This section pins behaviour for edge cases that the discussion explicitly enumerated. All collapse to the previously decided shape — no additional behaviour is required — but they are documented here so build phase and review do not re-litigate them.

### Mid-load / placeholder preview content

The viewport's `state.TailScrollback` read is synchronous (per the prior preview spec). There are three observable viewport content shapes:

1. **Real bytes** — viewport renders content.
2. **`(nil, nil)`** — viewport renders the "(no saved content)" placeholder (brand-new session, no `.bin` yet, or daemon hasn't captured).
3. **OS-level read error** — viewport renders an error string (EACCES, EIO).

**Enter attaches unconditionally regardless of viewport content state.** No confirmation prompt, no guard.

Rationale:

- Whether scrollback was *saved* is independent of whether the session is *attachable*. The live tmux session exists either way — preview wouldn't have opened on a non-existent session.
- A "no saved content" placeholder most commonly means the daemon hasn't captured yet, or the session is fresh. Neither is a reason to block attach.
- An OS read error is a *file-system* problem, not a session problem. Blocking attach on it would make file trouble unnecessarily block session use.

The user's keystroke is their commitment.

### Stale row in the Sessions list

If the Sessions list has reordered (whether from external mutation or filter dynamics) between preview open and Enter, Enter is unaffected: **Enter attaches by captured session name, not by list-row position**. The list-row position the user opened preview on is not used by the attach path.

### Filter committed, previewed session no longer matches

Same answer — Enter does not traverse the filtered list. Attach is by name; after attach the TUI exits or `switch-client`s, and Sessions-page filter state is irrelevant.

### Filter committed, zero matches

Structurally impossible to reach from preview. To open preview the user highlighted a row, which means the filter had ≥1 match at preview-open. If matches subsequently went to zero (the previewed session was killed), that collapses into the **session-killed-externally** bail path above and is handled by `has-session` + flash.

### In-flight filter input

Cannot coexist with preview being open — preview owns the keymap once entered, so `tea.KeyEnter` is dispatched to preview's `Update`, never to the filter input. Non-issue by construction.

### Principle — silent vs loud feedback

This feature applies a deliberate asymmetry between the pre-select failure path (silent) and the session-killed-externally path (loud, via flash):

- **Silent feedback** when the intent succeeded (user is in the session) but with cosmetic degradation (landed on tmux's last-current pane instead of the preview-focused pane). The fallback is the pre-existing Enter semantics, not a regression.
- **Loud feedback** when the intent failed (user is not in the session) — the user expected to attach but the session is gone. They need to know.

Future signal/no-signal decisions in this area should land consistently with this principle.

---

## Discoverability

The preview chrome line (`internal/tui/pagepreview.go:163-173`) gains an `enter attach` token alongside the existing keymap tokens.

### Current chrome line

```
Window {w} of {wN} · Pane {p} of {pN} · win: {name}    ] next win · [ prev win · tab next pane · esc back
```

### New chrome line

```
Window {w} of {wN} · Pane {p} of {pN} · win: {name}    ] next win · [ prev win · tab next pane · enter attach · esc back
```

The `enter attach` token sits between `tab next pane` and `esc back`. Exact token placement and wording is fixed by this spec.

### Token wording is unconditional

The `enter attach` token reads identically regardless of viewport content state (real bytes, "(no saved content)" placeholder, or OS read error). Enter's semantics are identical in all three cases — it attaches to the session, not to the scrollback — so the chrome wording does not branch on viewport state.

### Sessions-page help bar

The Sessions-page help bar is **unaffected**. It already advertises `Enter` for Sessions-page attach; the preview chrome's new `enter attach` token does not propagate to or duplicate that bar.

---

## Keymap expansion policy

Lifting `Enter` out of preview's "everything else is unbound/no-op" rule creates a slippery-slope question for other Sessions-page keys with obvious analogues (`r` rename, `k` kill, etc.). This section pins the policy once so the rule is visible to anyone reading the spec.

### Policy

**Preview is a verification surface, not a command surface. Strict view-only with `Enter` as the single exception.**

The rule, stated for future referrers:

> Preview owns viewport-navigation keys and exactly one commit key (`Enter`). Every other action is "dismiss-then-act" via `Esc` + the Sessions-page binding. Proposals for new preview keys must argue the key is a *verification primitive*, not a *convenience shortcut*.

### Owned preview keys — full list after this feature

- `]` — next window
- `[` — previous window
- `Tab` — next pane
- viewport-native scroll keys (passed through to `bubbles/viewport`)
- `Esc` — dismiss back to Sessions list
- `Enter` (new) — commit attach with captured `(window, pane)` focus

Everything else is unbound or no-op. **`r`, `k`, and any future Sessions-page action keys are NOT inherited.** The user dismisses preview with `Esc` and acts from the Sessions page.

### Rationale

Two grounds for the strict policy over a per-key passthrough policy:

1. **Destructive symmetry.** Under a passthrough policy, `k` (kill) would become "see content → kill" in one keystroke from a viewer. The two-step `Esc` + `k` preserves a deliberate pause where the user's intent can survive. The deletion friction is a small but real safety net.
2. **Principle scales without re-litigation.** The verification-primitive rule is a clean test for any future key proposal. A passthrough rule ("identity-bounded to the session") is fuzzier and invites the same per-key debate it tries to prevent.

The reduced surface area of preview is the **design intent**, not a constraint. The ergonomic cost of `Esc` + key vs one keystroke is mitigated by the explicit cognitive transition from "viewing" to "acting" that `Esc` marks.

### Future expansion

The policy does not forbid expansion — it requires that proposals argue the verification-primitive test. A new preview key may be added if it can be argued as a verification primitive (i.e. something the user does *while viewing*, not *as a shortcut to act*). The current set (`]`, `[`, `Tab`, viewport scroll, `Esc`, `Enter`) is the baseline.

---

## Out of scope

### Deferred to build phase (implementation details)

- **Exact `tea.Cmd` sequencing shape** — whether to use `tea.Sequence` or a single combined connector wrapper that performs all four calls. The spec-level constraint is the ordering (`has-session` → `select-window` → `select-pane` → connector); the cmd composition is a build decision.
- **Inside-tmux uniformity** — whether to use `switch-client -t session:win.pane` as a one-shot or explicit pre-select also inside tmux. Default: uniform pre-select unless build phase finds a reason to diverge.
- **Short-circuit when no preview navigation occurred** — micro-optimisation to skip pre-select calls if the user hasn't pressed `]`/`[`/`Tab`. Default: always-issue; the cost is two cheap tmux calls.
- **Captured coordinate provenance** — which struct field on `previewModel` backs the captured `(window, pane)`. The data already exists for `]`/`[`/`Tab` navigation; the spec does not pin the field name or shape.
- **Exact flash tick duration** — the discussion noted `~3s` as reasonable; build phase picks the exact value. The spec-level constraint is the principle: "long enough to read, short enough not to linger".

### Out of scope for this feature entirely

- **General-purpose flash/toast infrastructure.** Logged as inbox idea `.workflows/.inbox/ideas/2026-05-14--general-tui-flash-infrastructure.md`. The feature-local flash in this work unit is intentionally bespoke and may later be subsumed.
- **Hook behaviour on attach.** This feature does not change hook semantics. See *Pre-select + attach sequence > Hook firing* for the no-impact analysis.
- **`@portal-restoring` interaction.** Preview is unreachable from the Loading page; by the time the user is on the Sessions page, restoration is complete. No interaction surface.

---

## References to prior preview spec

The following surfaces are inherited unchanged from `.workflows/session-scrollback-preview/specification.md` and are not re-stated here:

- **Preview open trigger** — `Space` on the Sessions page.
- **Preview layout** — chrome line + viewport region.
- **Viewport behaviour** — scroll keys passed through to `bubbles/viewport`.
- **Esc-level tree** — `Esc` dismisses preview back to Sessions, with the existing dismiss-on-transition sessions-list refresh.
- **Scrollback read pipeline** — `state.TailScrollback` synchronous tail-N read with the three observable shapes (real bytes / `(nil, nil)` / OS error).
- **Window/pane structural enumeration capture** — captured at preview-open via `ListWindowsAndPanesInSession`, walked locally by `]`/`[`/`Tab`.

This feature **does not edit** the prior spec. The prior spec is a frozen historical record of what was built at the time. Anything that needed to change about the prior preview is captured additively in this specification.

---

## Working Notes

## Corrigenda

> **Corrigendum (2026-05-19)**: This specification originally directed
> `tmux attach-session -A -t '=<session>'` as the outside-tmux connector
> argv. The `-A` flag is not valid on `attach-session` (it belongs to
> `new-session`); the correct argv is `tmux attach-session -t '=<session>'`.
> Corrected by work unit `drop-invalid-A-flag-from-attach-session-argv`.
