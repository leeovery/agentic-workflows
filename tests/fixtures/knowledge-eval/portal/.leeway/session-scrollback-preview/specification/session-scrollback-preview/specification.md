# Specification: Session Scrollback Preview

## Specification

### Overview

A Quick Look-style preview of a session's scrollback, opened from the Sessions page of the TUI. Lets the user disambiguate similarly-named sessions (e.g. `pigeon-AbCdEf` vs `pigeon-XyZw12`) by glancing at terminal content, without paying the attach/detach cost.

**Use case framing.** Disambiguation is a recognition task — the user is glancing to identify which session is which, not watching content change in real time. Every downstream decision (staleness ceiling, history depth, refresh model, visual fidelity) is anchored to recognition, not live monitoring.

**Side-effect-free contract.** Opening and dismissing the preview leaves session state byte-identical: no hydration, no resume-hook firing, no tmux marker mutation, no FIFO consumed. Preview is read-only with respect to portal state and tmux.

### Trigger and Entry Point

- **Page binding.** Bound to the **Sessions page only** (`updateSessionsPage` in `internal/tui/model.go`). Projects, FileBrowser, and the Loading page have no preview entry point.
- **Open.** `Space` on the highlighted session in the Sessions list opens preview.
- **Attach.** `Enter` continues to attach as today (unchanged).
- **Dismiss.** `Esc` returns to the Sessions list at the same cursor position the user was on when `Space` was pressed.
- **Self-exclusion.** The current session (when running inside tmux) and the `_portal-saver` detached session are already excluded from the Sessions list by existing logic; preview inherits this exclusion — no new suppression layer required.
- **Empty list / no highlighted item.** If the Sessions list is empty (no sessions, or a committed filter has narrowed the list to zero matches), `Space` is a no-op — there is no item to preview. The user remains on the Sessions page; no error is shown.

### Interaction Shape

- **Sub-page peer of `pageFileBrowser`.** Preview is a full-screen page in the TUI's page state machine, with its own keymap. Implemented as a new `pagePreview` arm in `internal/tui/model.go::Update`.
- **Bound to one session per open.** Preview shows the session that was highlighted when `Space` was pressed. To preview a different session, the user `Esc`s back to the list, moves the cursor, and presses `Space` again. There is no in-preview between-session stepping.
- **Layout.** Preview occupies the full terminal — chrome on a single line (header **or** footer; final placement is a build-phase decision per *Open Items*) plus the embedded `bubbles/viewport` filling the remaining vertical space. Viewport width = terminal width; viewport height = terminal height minus chrome lines. `tea.WindowSizeMsg` is forwarded to the embedded viewport so the slice re-flows on resize; scroll offset is preserved by `bubbles/viewport`'s native resize handling.

### Source of Preview Bytes

Preview reads pane content **only from disk** — the `.bin` scrollback files written by the `portal state daemon`. There is no live `tmux capture-pane` path, no fork on `@portal-skeleton-<paneKey>` marker, and no new tmux wrapper.

**Read API.** `state.ScrollbackFile(stateDir, paneKey)` resolves the on-disk path for a given pane key. Preview reads from this path directly for every pane it renders, regardless of whether the pane is currently hydrated or still skeletal.

**Single read path consequences.**
- No marker check; no rendering fork.
- No per-preview tmux IPC.
- The same path that already serves skeleton panes during restore is reused for hydrated panes.
- No rapid-stepping race to mitigate. A live-capture path would require generation/sequence tokens to discard in-flight captures for session N landing after the user has stepped to N+1. Always-disk eliminates that mitigation cost entirely — file reads are microseconds and synchronous, and there are no in-flight async results to reconcile.
- No new tmux **capture** wrapper. The existing `tmux.Client.CapturePane` hardcodes `-S -` (full scrollback) and is shared with save-daemon semantics; a bounded variant (e.g. `CapturePaneTail(target, n)`) would have been net-new code. Always-disk avoids that addition entirely. (A separate, unrelated read-only **listing** method may still be added for chrome enumeration — see § *Multi-pane Rendering Shape > Concrete enumeration call*.)

**Snapshot semantics — not live.** Preview is a snapshot at the moment each pane is read. Worst-case staleness is bounded by the daemon's per-tick interval (small but not strictly bounded by 1s under heavy load). This is acceptable for the recognition use case at both ends of the bandwidth spectrum:
- Slow output (e.g. Claude TUI): staleness invisible because content moves slowly.
- Fast output (e.g. tailing logs): staleness invisible because the user identifies by overall shape, not individual lines.

**Concurrent attach.** Portal targets a single-user-per-machine environment; concurrent attach contention is not a design constraint.

**Surface label honesty.** Preview is a snapshot, not "what attaching now would show". Any user-facing labelling must not promise liveness.

### Multi-pane Rendering Shape

Sessions can contain multiple windows, each with multiple panes. Preview renders the structure as a **sequential, window-grouped** flat presentation: one pane shown at a time, with hierarchical cycling between panes within a window and between windows.

The literal `window_layout` is **not** rendered. No layout parser. Visual fidelity is discharged by chrome (counts, names, position) rather than by reproducing the spatial grid.

**Real-world distribution.** Empirically the dominant case is single-window single-pane: a sample on the original developer's machine showed 14 of 16 sessions were 1-pane, consistent with a ~95% single-window single-pane share across typical Portal usage. The minimalism choice (sequential window-grouped, no literal layout parser) is anchored to that distribution — the rendering shape only matters for the 2+ pane minority, and even there the chrome carries the structural disambiguation signal that fidelity would otherwise carry. If the distribution shifts (e.g. heavy multi-pane workflows become common), the literal-layout option remains additively reachable.

#### Within-preview Key Bindings

| Key | Action |
|-----|--------|
| `]` | Next window (wraps from last → first) |
| `[` | Previous window (wraps from first → last) |
| `Tab` | Next pane within current window (forward-only with wraparound) |
| `Esc` | Dismiss preview, return to Sessions list |
| Viewport scroll | All `bubbles/viewport` defaults pass through unchanged: `Up` / `Down` / `PgUp` / `PgDn` / `Home` / `End` / `ctrl-u` / `ctrl-d` / `j` / `k`. These scroll within the focused pane's loaded N-line slice. |

**Keymap policy.** Preview owns `]`, `[`, `Tab`, `Esc`. Everything else either passes through to the embedded `bubbles/viewport` (scroll keys above) or is unbound/no-op (arrow `Left` / `Right`, `n` / `p`, alphanumerics, etc.). There are no between-session keys to bind. Up/Down are explicitly **not** between-session navigation — they scroll the focused viewport.

**Pane focus on window cycle.** After `]` or `[`, the focused pane within the new window resets to **pane 0** (first pane in enumeration order). Per-window pane focus is **not** preserved across window cycles. `Tab` then cycles forward from pane 0. Rationale: in the dominant 1-pane case the rule is trivial; in the multi-pane case, resetting matches the position-on-session-re-entry rule (always start at the beginning) and avoids invisible per-window state the user has no signal of.

**Why bidirectional for windows but not panes.** Windows are typically purposeful (editor / logs / repl) and overshoot is costly, so `[` and `]` are both bound. Pane counts are small; forward-only `Tab` with wraparound is sufficient for the dominant case.

**Degenerate cases.** In single-window single-pane sessions (the dominant ~95% case), all three cycle keys silently no-op. No flicker, no error feedback, just nothing.

**Position on session re-entry.** Stepping out via `Esc` and re-opening preview on the same session re-opens at **window 0 / pane 0** in enumeration order (the first entry returned by structural enumeration), not at the last viewed position. Per-session position state is not retained — the use case is disambiguation, and fresh-view matches recognition better than memory.

**Indexing convention.** Preview maintains 0-based enumeration-order indices internally: windows are ordered as returned by structural enumeration (sorted by tmux `window_index` ascending), panes within a window similarly by `pane_index`. Internal references like "window 0 / pane 0" mean "first entry in enumeration order".

**Model lifecycle.** A new `previewModel` is constructed each time `Space` is pressed. There is no singleton or cached instance. Consequences:

- Structural enumeration runs fresh on every open.
- The tail-N read for window 1 / pane 1 runs fresh on every open of the same session.
- No state (focus indices, viewport scroll offset, content) survives across opens of the same session.

#### Chrome Floor (v1 must-show)

Chrome must show structural overview and current position so the user can identify "which window am I in" and "how many siblings does this pane have" at a glance. The minimum content is:

- **Window M of N** — without this, users have no signal that the session has multiple windows.
- **Pane X of Y** — same logic within a window.
- **Window name** — tmux's `#W` / window name; adds disambiguation signal for users who name their windows.
- **Keystroke hints** — visible cycle-key reminders (`] [ Tab Esc`), matching Portal's existing UI convention elsewhere.

**Chrome data source.** Window/pane counts and names come from **tmux structural enumeration** (`list-panes -t <session> -F`), not from `.bin` content. Chrome is computed once at preview-open and cycled in place; no live re-enumeration mid-preview.

**Counter semantics.** `M` and `X` in "Window M of N" / "Pane X of Y" are **1-based ordinal positions in enumeration order**, not the tmux `window_index` / `pane_index` values. Under base-index drift (e.g. `set -g base-index 1`) or after window-kill gaps (e.g. `window_index` values `0, 2, 5`), chrome shows `Window 1 of 3`, `Window 2 of 3`, `Window 3 of 3` as the user cycles — never `Window 5 of 3`. The window name (`#W`) carries identity; the counter carries position. The raw tmux `window_index` is **not** displayed in chrome.

**Concrete enumeration call.** No existing `tmux.Client` method returns window-grouped panes plus window names for a single session in one call. The build phase therefore composes the enumeration from one of:

- (a) Add a new `tmux.Client` method (e.g. `ListWindowsAndPanesInSession(session) ([]WindowGroup, error)`) that runs `tmux list-panes -t <session> -F "#{window_index}|#{window_name}|#{pane_index}"` and groups results by `window_index`. Preferred — keeps the call cohesive in `internal/tmux`.
- (b) Compose existing methods: `ListPanesInSession` for coords plus a separate `list-windows -t <session> -F "#{window_index}|#{window_name}"` invocation. Mechanically equivalent; chosen only if (a) is rejected during build.

The earlier claim "No new methods on `tmux.Client`" is qualified by this concrete enumeration shape: a single new read-only listing method is permissible. The "no new tmux wrapper" rationale in § *Source of Preview Bytes* applies specifically to **capture** wrappers (i.e. avoiding `CapturePaneTail`); a new listing method is a different category and does not contradict it.

**Enumeration failure handling.** If the enumeration call itself fails at preview-open (e.g. session disappeared between `Space` press and the call), preview returns to the Sessions list silently — no preview page is shown. The Sessions list re-fetches on return per § *Cross-cutting Seams > Externally-Killed Session During Preview*.

**Above the floor (rejected for v1, additive later if wanted):**
- Per-pane current-command (e.g. `nvim`, `claude`).
- Pane position hint (e.g. `(top-right)`).

**Open spec-pinning items handed to the build phase:**
- Exact chrome wording, header vs footer, single-line vs two-line.

### History Depth

Preview renders a **bounded snapshot, scrollable within bounds**, of each pane's saved scrollback. Per-pane `.bin` files on disk can be large (~3.7MB / 50k+ lines for busy sessions); preview never feeds the full file into the renderer.

**Slice size.** The last **N lines** of the pane's `.bin` file are read on each focus event, where **N = 1000**. This pins the working figure of "generous N (e.g. ~500–1000 lines)" at the upper end. The exact value is a constant in the read pipeline.

**Memory trade-off.** Holding N lines per previewed pane while focused is the dominant memory cost of preview. At N ≤ 1000, this footprint is negligible (typical line widths × 1000 ≪ a few MB) — the cap on N is set by this trade-off as much as by the recognition use case. If a future revision wants deeper history, raising N has a real, if still small, memory cost that should be re-justified rather than silently bumped.

**Scroll within bounds.** The viewport (`bubbles/viewport`) renders the tail by default; the user can scroll up within the loaded N lines using the viewport's native scroll keymap. The top boundary of the slice is a hard edge — pressing scroll-up at the top silently no-ops. Deeper history (beyond N) is not reachable in v1.

**No deeper-history extend.** No `r`-to-extend, no scroll-past-top trigger, no lazy load. Reaching content older than the last 1000 lines is a "full attach" affordance, not a preview affordance.

#### Read Pipeline

The read is implemented as a **tail-N idiom at the disk layer**: open the file, seek to end, read backwards in chunks until N newlines are collected, return only those bytes. Cost is decoupled from total `.bin` file size — a 3.7MB / 50k-line file reads at the same sub-millisecond cost as a small one. No full-file read, no `strings.Split` allocation of the whole file per cycle keypress.

**Implementation shape.** ~30 LOC in a new helper, packaged with `state.ScrollbackFile` resolution. Standard Go idiom — `os.File` + `Seek(0, io.SeekEnd)` + reverse chunked scan. No external dependency.

**Single-fd invariant.** The helper opens the file once via `os.Open`, performs all `Seek` and `Read` calls against that single file descriptor, and closes only after the tail bytes are assembled. The atomic-rename guarantee under § *Read-Failure Handling* only holds across the helper's full scan if the fd is held; a close-and-reopen between chunks would expose a torn-read window where the daemon's atomic rename could swap the inode mid-scan. Within a single scan, an unlinking delete is also benign — the reader keeps reading the unlinked inode until close.

**Definition of "line".** A line is a `\n`-terminated record in the `.bin` file as written by the daemon. The reverse scan counts newline bytes. There is no re-wrap, no logical-line reconstruction, and no consultation of the source pane's display width. Because the daemon captures via `tmux capture-pane -e`, each `\n` already corresponds to a display line at capture-time pane width — so "1000 lines" is "1000 display lines as captured", which is the unit the memory budget assumes.

**Trailing-newline edge case.** A file whose final bytes lack a trailing `\n` has those trailing bytes treated as a partial/in-progress record and **excluded** from the returned tail (the helper returns only fully-terminated records). A zero-byte file and a file containing only an unterminated partial line both render the placeholder under the zero-line outcome. In practice the daemon writes via `tmux capture-pane -e`, whose output always terminates lines, so this case is defensive.

**Output handoff.** The tail bytes are passed to `viewport.SetContent(rawAnsiBytes)` as a single string. ANSI escape sequences are preserved verbatim (see *ANSI Passthrough* below). No preprocessing, no sanitisation, no re-wrap.

**Read is synchronous.** Because the read is bounded and sub-millisecond regardless of file size, the read happens inline in `Update` for the focus-changing event. No `tea.Cmd` deferral, no generation tokens, no async I/O.

**Performance budget.** The synchronous-in-`Update` decision rests on the read staying fast. Pinned target: **tail-N read p99 < 5ms on a 4 MB `.bin` file** (representative of a busy-session worst case). The build phase ships a benchmark guarding this assertion. If a future change pushes p99 above the budget, the synchronous-read decision must be revisited (likely by deferring the read via `tea.Cmd`); the budget is the audit threshold, not a soft aspiration.

### Refresh Semantics

Preview is **stateless with respect to byte content** — the disk is the canonical source of truth, and no pane content is cached in the model between focus events. Every focus-changing event triggers a fresh disk read of the newly-focused pane.

**No timer, no polling.** Reads happen only when the user acts. There is no background refresh loop, no `r`-to-refresh key, no auto-tick.

#### Read Trigger Events

A fresh tail-N read is performed when:

- **Initial preview-open (Space)** — lazy per focus: reads only the currently-focused pane (window 1 / pane 1 by reset rule). Other panes are read on first focus via `]` / `[` / `Tab`.
- **`]` or `[`** — re-reads the newly-focused pane after a window cycle.
- **`Tab`** — re-reads the newly-focused pane after a within-window pane cycle.

**Initial-open ordering.** On `Space`:

1. Structural enumeration call runs first (synchronous; see § *Multi-pane Rendering Shape > Concrete enumeration call*).
2. If enumeration fails → return to Sessions list silently; no preview page is shown.
3. If enumeration succeeds but returns an **empty result** (zero windows, or a window with zero panes — e.g. session is being torn down between `Space` and the call) → treated identically to enumeration failure: return to Sessions list silently; no preview page is shown.
4. Otherwise the focus indices are set to window 0 / pane 0 (first window, first pane in enumeration order) and the tail-N read for that pane runs synchronously.
5. The first frame renders both chrome (from step 1) and viewport content (from step 4) atomically. Chrome is never shown without a corresponding viewport state.

If the tail-N read in step 4 fails (missing or unreadable `.bin`), the viewport renders the placeholder per § *Read-Failure Handling*; the preview page still opens.

Chrome counts (window M of N, pane X of Y, window name) come from tmux structural enumeration captured at preview-open and **do not** force eager `.bin` reads for unfocused panes.

**Between-session step is not a trigger** because in-preview between-session stepping is not part of the feature. To preview a different session, the user `Esc`s back to the list, moves the cursor, and presses `Space` again — which fires the initial-open trigger fresh on the new session.

**Resize is not a read trigger.** `tea.WindowSizeMsg` is forwarded to the embedded viewport for content re-flow per § *Interaction Shape > Layout*; it does **not** trigger a fresh disk read. The loaded N-line buffer is decoupled from viewport dimensions, so the viewport re-renders the existing buffer at the new size without re-reading from disk. This matters for the performance budget: a drag-resize fires many resize events, none of which incur tail-N read cost.

#### Viewport-internal Scroll Does Not Re-read

While focus is held on a pane, the viewport holds its current N lines as the active rendering buffer. Scrolling up/down within those bounds is a pure viewport operation — no disk read. The "no content cache" framing applies *across focus changes*; the currently-focused viewport is the active rendering buffer, not a cache.

#### Scroll Position Resets on Focus Change

If the user scrolls 50 lines up in window 1 / pane 1, then `Tab` to pane 2, then `Tab` back to pane 1 — pane 1 re-renders at scroll-tail (default), not at scroll-offset 50. Scroll position is **ephemeral per focus session**, consistent with the position-reset rule for re-opening preview on the same session.

#### Dwell Behaviour

Sitting on one pane for an extended period shows a snapshot that grows progressively staler. There is no in-place refresh. The natural recovery is to step away and back (`Tab` away then `Tab` back, or `]` / `[` and back) — any focus change triggers a re-read.

### Read-Failure Handling

Three failure modes, all handled benignly without aborting the preview:

- **Daemon mid-write while preview reads.** Closed by atomicity: the daemon writes via `state.WriteScrollbackIfChanged`, which calls `fileutil.AtomicWrite0600` (tempfile + rename). On Unix, rename of the same filesystem is atomic, so the reader observes either the previous full content or the new full content — never torn bytes. This is verified against the current daemon implementation (`internal/state/scrollback.go` :: `WriteScrollbackIfChanged`); if a future revision of the daemon ever switches to in-place append, the read-side claim must be revisited.
- **`.bin` deleted between two consecutive focus events** (pane killed, daemon cleanup, etc.). The viewport renders a placeholder for that pane (see *Placeholder* below). Other panes in the session continue to render normally.
- **OS-level read error** (permissions, disk full, etc.). The viewport renders a brief error string in place of content. Should never occur given mode 0600 / same-user guarantees from the save daemon, but handled defensively rather than crashing the TUI.

#### Placeholder

A single placeholder shape is used across all "no content available" cases — read failures, deleted `.bin`, zero-byte `.bin`, and the brand-new-session edge case (covered separately below). Working label: **"(no saved content)"**.

**Triggering conditions for the placeholder.**

- `.bin` file does not exist (ENOENT).
- `.bin` file exists but is zero bytes (no captures yet).

**OS-level read errors** (permissions, EIO, etc.) render the **error string** instead, not the placeholder — see *Error string* below.

**Non-triggering condition.** A `.bin` file with **fewer than N lines** (e.g. 5 lines from a brand-new pane that has had a few captures but not 1000 of them) does **not** trigger the placeholder. Preview simply renders whatever lines are present, with the viewport at scroll-tail. The tail-N read returns "all lines in file" when the file has fewer than N — a partial read is a successful read.

**Error string.** OS-level read errors render a single short error string in the viewport rather than the placeholder. The wording is build-phase TBD; the same string is used for every error type (no per-errno differentiation, no EACCES vs EIO branching). Future focus changes onto the same pane retry the read fresh — there is no per-pane error cache.

Chrome (window M of N, pane X of Y, window name) is unaffected by content placeholders or error strings: the structural counts come from tmux enumeration, so the user always sees the correct shape with placeholders only where content is missing.

**Open spec-pinning items handed to the build phase:**
- Exact placeholder wording.
- Exact error-string wording for OS-level read failures.

### Esc Level Tree

`Esc` is **progressive**: each press discharges exactly one level of state. The user model is "Esc backs out of one thing at a time".

| Context | `Esc` action |
|---------|--------------|
| In preview | Return to Sessions list. Filter (if any) stays committed; cursor stays on the previewed session. |
| Sessions list with **committed filter** | Clear filter. Return to unfiltered list; cursor preserved. (Standard `bubbles/list` behaviour.) |
| Sessions list, **mid-typing-filter** | Cancel filter input; return to unfiltered list. (Standard `bubbles/list` behaviour.) |
| Sessions list with **no filter** | Quit Portal (or return to caller). Existing Portal behaviour. |

A typical "filter, then preview, then quit" path therefore takes **three Escs**: preview → committed-filter list → unfiltered list → quit.

### No In-preview Between-Session Stepping

Preview is bound to **one session per open**. There are no key bindings inside preview that move between candidate sessions.

**Cascading consequences (anchored here so the spec is self-contained):**

- **No between-session keymap.** Arrow keys (`Up` / `Down`) and `j` / `k` pass through to the embedded `bubbles/viewport` for content scrolling per § *Within-preview Key Bindings > Keymap policy* — they are explicitly not between-session navigation. Other plausible candidates (`Left` / `Right`, `n` / `p`) are unbound and no-op.
- **List cursor sync is not a question.** Preview cannot move the underlying list cursor, so on `Esc` the cursor is exactly where it was when `Space` was pressed. There is no sync mode to design.
- **Filter set boundary is not a question.** "Stepping iterates filtered set vs all sessions" does not arise — preview never iterates.
- **Refresh trigger list does not include between-session step** (already reflected above).

**Reversibility.** Adding in-preview between-session stepping later is additive (a new keymap entry plus cursor-sync semantics), not a rewrite. It is intentionally out of scope for v1.

**Override traceability.** Earlier research had locked "in-preview between-session stepping" (Claude Code resume-style) as part of the feature shape. This spec deliberately overrides that constraint in favour of the simpler `Esc → arrow → Space` loop documented above. This is the only material deviation from the research-locked shape; recorded here so future readers (or future spec revisions) do not silently re-introduce the original assumption from the research source.

### Filter Behaviour with Preview

`bubbles/list`'s filter mode has two phases that interact differently with `Space`:

1. **Filtering** (`SettingFilter()` true) — every keypress is text input; `Space` inserts a literal space into the filter.
2. **Filter committed** (after `Enter`) — list shows the filtered set, arrows move the cursor, and `Space` is free to open preview.

**Decision: default `bubbles/list` semantics.** Preview does **not** intercept `Space` while filtering. There is no "magic Space" that commits and previews in one step. There is no second binding for "open preview" while filtering.

The user must commit the filter (`Enter`) before `Space` opens preview.

#### Canonical User Flow

1. Type filter (e.g. `pigeon`).
2. Press `Enter` to commit filter — list narrows to matches.
3. Arrow to candidate.
4. `Space` to preview.
5. `Esc` back to list — filter still committed; cursor stays in narrowed set.
6. Arrow + `Space` to preview next candidate.
7. `Esc` to clear filter, then `Esc` again to quit (per Esc level tree).

**Why this rather than magic Space.** Text input and list navigation are distinct interaction modes; `Space` changing role between them is the universal text-input convention, not an inconsistency. Magic Space would also make a literal space character impossible to type into the filter without awkward workarounds.

### Brand-new-session Edge Case

Two related "no `.bin` content yet" scenarios are handled by the same placeholder:

- **Whole-session.** A session created within the last save tick — the daemon hasn't captured any of its panes yet. Every pane reads as missing-content; preview shows the placeholder for each pane.
- **Per-pane.** A multi-pane session where one pane was just split-windowed in but the daemon hasn't ticked it yet. Other panes have `.bin` and render normally; the new one shows the placeholder.

**Behaviour.** Per-pane "(no saved content)" placeholder rendered in the viewport for any pane whose `.bin` is missing or unreadable (same shape as read-failure handling above). Other panes in the same session render normally.

**Chrome integrity.** Window M of N, pane X of Y, and window name come from tmux structural enumeration, so the user always sees the correct structure even when content is missing. Cycle keys (`]` / `[` / `Tab`) work normally and traverse all structural entries regardless of which have content.

**No live capture fallback.** Preview never falls back to `tmux capture-pane` for missing-`.bin` panes. That would contradict the always-disk decision and would only succeed for hydrated panes anyway.

### Privacy / Threat Model

**Decision: no design response.** Preview ships as a sharp tool. There is no opt-out toggle, no redaction layer, no end-user documentation about preview's exposure surface, and no automatic suppression of any session content based on heuristics.

**Rationale.** Portal is a single-user developer tool; the user is the operator and the audience. Mitigation of secret-exposure during sharing contexts (screen-shares, demos, OBS recording, pairing) is the user's responsibility — accomplished simply by not pressing `Space`. Redaction would create a false sense of security that is worse than no protection. The behaviour is also **self-documenting in use**: the first time a user opens preview on a session containing sensitive output, they see immediately what preview shows. There is no hidden mechanism to surprise them later, which is part of why no in-product documentation of the exposure surface is shipped.

**Reversibility.** A future opt-out toggle (e.g. `portal config set preview-disabled true`) is additive — a config flag check at preview-open. It is intentionally not built in v1; it can be added later without rework if real users report concern.

**Build-phase consequence.** The build phase must not introduce any "safety" fallback (e.g. blocking preview on sessions whose content matches certain patterns). The feature surface is intentionally uniform.

### Cross-cutting Seams

These are integration boundaries that the build phase must respect. None require new architectural work; they document how the feature composes with existing portal subsystems.

#### Bootstrap Restore-Window Interaction

The `cmd/bootstrap` 9-step orchestrator sets `@portal-restoring` across step 5 (Restore), recreates skeleton panes with their saved `.bin` files on disk, and clears the marker in step 6. The Loading page is shown during this window; the Sessions page transitions in afterward.

Preview composes naturally with this without new constraints:

- **Loading page has no preview entry point.** `Space` is unbound at the Loading page level, so there is nothing to gate.
- **Always-disk path is marker-agnostic.** Even if `@portal-restoring` lingers briefly when the Sessions page first appears, preview's always-disk read works regardless of marker state. Skeleton panes have `.bin` files on disk *because* they're being restored from saved bytes — those are exactly the bytes hydrate will replay. Reading them is harmless and informative.
- **Inside-tmux invariant excludes the current session.** Brand-new sessions during restore that lack `.bin` simply hit the per-pane placeholder.

No new bootstrap steps, no preview-aware bootstrap gating, no marker checks in the read pipeline.

#### Externally-Killed Session During Preview

If session A is killed externally (another tmux client, `tmux kill-session`, `portal clean`) while the user holds preview open on it:

- **Content reads.** The `.bin` files persist briefly, then get cleaned by the daemon. Read-failure / deleted-`.bin` is already covered by the placeholder behaviour. `]` / `[` / `Tab` will increasingly land on placeholders as files are cleaned.
- **Chrome.** Window/pane structural counts and names were captured at preview-open. Cycle keys cycle the captured shape; no live re-enumeration is performed mid-preview, so chrome stays stable.
- **Esc back to list.** The Sessions list re-fetches the live session list on return — the killed session simply isn't there anymore. Cursor lands on a neighbouring session via `bubbles/list`'s default behaviour.

**Re-fetch contract.** Preview owns the re-fetch on the `pagePreview → pageSessions` transition. The build phase confirms during implementation whether the existing Sessions page already re-fetches on entry from another page; if not, the transition handler dispatched by `Esc` from preview must trigger a Sessions-list refresh before rendering the Sessions page. Either path satisfies the contract — what matters is that the transition does not show a stale list containing a killed session.

No new graceful-degradation logic is required beyond the re-fetch contract; the other pieces already pinned (placeholder, chrome captured at open) handle the in-preview portion.

#### `_portal-saver` Self-Reference

The `_portal-saver` detached session that hosts `portal state daemon` must not appear in the Sessions list at all. Existing list-population logic and the inside-tmux invariant should already exclude it.

The build phase must **confirm** during implementation that `_portal-saver` is excluded from the list passed to the Sessions page; if any code path ever leaks it into the list, no preview-layer suppression is required as long as the list filter is fixed at its source. Preview itself does not introduce a name-based blacklist.

#### ANSI Passthrough vs Viewport Width

The read pipeline is straight passthrough — `viewport.SetContent(rawAnsiBytes)` with no preprocessing, no sanitisation, no re-wrap.

Behavioural consequences from `bubbles/viewport` and tmux output shapes:

- **`bubbles/viewport` does not auto-wrap.** Long lines are handled by ANSI-aware horizontal cut (`ansi.Cut`) when content is wider than the viewport.
- **tmux `capture-pane -e` output is hard-wrapped.** Output is wrapped to the source pane's display width at capture time.

Resulting render behaviour:

- If preview viewport ≥ source pane width: no truncation, full lines rendered.
- If preview viewport < source pane width: clean ANSI-aware horizontal cut; no corruption, no garbled escape sequences.

The build phase must not introduce wrapping, sanitisation, or escape-stripping in the read pipeline.

#### State Package API Reuse

Preview's read pipeline uses the existing `state` package surface:

- **`state.ScrollbackFile(stateDir, paneKey)`** — resolves the on-disk path. Reused unchanged.
- **`state.SanitizePaneKey(session, window, pane)`** — canonical pane-key helper that produces the same key the daemon uses when writing `.bin` files. Reused unchanged. The arguments must match the daemon's call site verbatim (the goal is byte-identical pane keys); the build phase wires the existing helper signature without type adaptation at the call site.
- **Resolution chain.** For each `(session, window_index, pane_index)` returned by structural enumeration, preview computes `paneKey = state.SanitizePaneKey(session, window_index, pane_index)`, then `path = state.ScrollbackFile(stateDir, paneKey)`, then performs the tail-N read on `path`. This chain is addressable from runtime tmux fields alone — preview never reads `@portal-skeleton-<paneKey>` markers, never inspects the daemon's hash map, and never depends on the daemon being live.
- **`stateDir` resolution.** Preview consumes `stateDir` via the `ScrollbackReader` seam, **not** directly. The production adapter for `ScrollbackReader.Tail(paneKey)` is constructed once at TUI startup with `stateDir` resolved from the existing `internal/state` paths helper (the same source the daemon and bootstrap orchestrator already use). The interface intentionally hides `stateDir` so tests can mock by `paneKey` alone, and so preview never has its own state-path resolution policy. `stateDir` is captured once and stable for the Portal process lifetime; it is **not** re-resolved per preview-open.
- **Tail-N read helper** — new addition (~30 LOC), packaged in `internal/state` alongside `ScrollbackFile`. Naming and exact placement TBD by build phase.

No new methods on `tmux.Client`. No new daemon work. No marker mutations. No hook firing. The feature is purely additive on top of existing surfaces.

### Architecture Summary

The feature decomposes into a small, well-bounded set of additions:

**Read pipeline** (in `internal/state`)
- Reuse: `state.ScrollbackFile(stateDir, paneKey)` for path resolution.
- New: tail-N read helper (~30 LOC) — `os.File` + `Seek(0, io.SeekEnd)` + reverse chunked scan to collect last 1000 lines.
- Output: raw ANSI bytes, straight passthrough to `viewport.SetContent`.

**Page state machine** (in `internal/tui`)
- New: `pagePreview` arm in the page state machine, peer of `pageFileBrowser`.
- New: preview model owning a `bubbles/viewport`, current focus indices (window index, pane index), structural enumeration captured at open, and minimal keymap.
- Modified: `updateSessionsPage` binds `Space` to open preview.

**Within-preview keymap**
- `]` next window, `[` previous window (both wrap).
- `Tab` next pane within window (forward-only with wrap).
- Viewport's native scroll keys (passed through to the embedded `bubbles/viewport`).
- `Esc` returns to Sessions list.

**Chrome rendering**
- Computed from tmux structural enumeration (`list-panes -F`-style call) at preview-open.
- Floor: window M of N + pane X of Y + window name + keystroke hints.

**No changes to:**
- `tmux.Client` capture path (no new capture wrappers; one new read-only listing method is permissible per § *Multi-pane Rendering Shape > Concrete enumeration call*).
- `state` daemon (no new save/replay logic).
- `restore` engine.
- `cmd/bootstrap` orchestrator.
- `hooks` store or hydrate helper.
- Save format or `.bin` file shape.

**Test seams.** Preview introduces small dependency interfaces in `internal/tui`:

- **TmuxEnumerator** — interface returning the window-grouped pane structure described in *Concrete enumeration call*. Backed in production by `*tmux.Client`; mocked in tests with a fixed in-memory shape.
- **ScrollbackReader** — interface with `Tail(paneKey) ([]byte, error)` returning the tail-N bytes for a given `paneKey`. The interface intentionally hides `stateDir` (closed over at construction). Backed in production by the new tail-N helper in `internal/state` (with `stateDir` resolved at TUI startup per § *Cross-cutting Seams > State Package API Reuse > stateDir resolution*); mocked in tests with a fixed bytes-or-error map keyed by `paneKey`.

  **Return contract.** Three observable outcomes via `(bytes, err)`:
  - **`(bytes != nil, nil)`** — normal content; caller renders bytes verbatim.
  - **`(nil, nil)`** — "no content available" — collapses ENOENT, zero-byte file, and zero-line result (file with only an unterminated partial line) into one shape. Caller renders the placeholder ("(no saved content)").
  - **`(nil, err != nil)`** — OS-level read failure (EACCES, EIO, etc.). Caller renders the error string.

  The helper unifies the three "no content" cases by design — the placeholder/error decision lives at the call site in `internal/tui`, not in the helper. The mock honours the same three shapes.

**Wiring shape.** Dependencies are passed through the `previewModel` constructor (constructor-injected), not via a package-level mutable `previewDeps` variable. This is idiomatic for Bubble Tea models. Tests construct `previewModel` directly with mock implementations of `TmuxEnumerator` and `ScrollbackReader`; no package-level state to restore, no `t.Cleanup()` plumbing required, and `t.Parallel()` is safe in `pagepreview_test.go`. The `cmd` package's package-level `*Deps` convention (`bootstrapDeps`, `openDeps`, etc.) is preserved at the cmd layer for compatibility with existing tests but is not extended into `internal/tui`.

The TUI page-state tests exercise `Update` directly with synthetic `tea.KeyMsg` values per the project's existing test convention. A new `pagepreview_test.go` (or equivalent) houses the new tests; it must not require a real tmux server (no `tmuxtest` import). Production-code adapters wire `*tmux.Client` and the tail-N helper to the seams at TUI construction.

### Out of Scope (v1)

Documented for traceability. Each is reversible — adding any of these later is additive, not a rewrite.

- **Live capture** (`tmux capture-pane` for hydrated panes). Marker-branched read path is not built; could be added as a per-pane source override later.
- **Literal `window_layout` rendering.** Sequential window-grouped is the only shape; layout parser is not built.
- **In-preview between-session stepping.** No keymap to advance to the next/previous candidate session without dismissing.
- **Deeper history beyond N=1000 lines.** No `r`-to-extend, no scroll-past-top trigger, no lazy load.
- **Auto-refresh / live tail / timer-driven reload.** Reads happen only on focus change.
- **Position memory across re-opens.** Re-opening preview on the same session resets to window 1 / pane 1.
- **Per-pane current-command in chrome** (e.g. `nvim`, `claude`).
- **Pane position hint in chrome** (e.g. `(top-right)`).
- **Privacy / threat-model design response.** No opt-out toggle, no redaction layer, no documentation gating.
- **Preview entry point on Projects or FileBrowser pages.**
- **Preview-layer `_portal-saver` suppression** (excluded at list-population layer instead).

### Acceptance Criteria

The feature is complete when all of the following are observable:

**Entry & dismiss**
- Pressing `Space` on a highlighted session in the Sessions page opens the preview page.
- Preview opens at the first window's first pane (window 0 / pane 0 in 0-based enumeration order; chrome shows "Window 1 of N" / "Pane 1 of M").
- Pressing `Esc` returns to the Sessions list with the cursor at the same position it was in when `Space` was pressed.
- Filter state (committed filter / no filter / mid-typing-filter) is preserved across preview open/dismiss per the Esc level tree.

**Within-preview navigation**
- `]` advances to the next window, wrapping from last to first.
- `[` advances to the previous window, wrapping from first to last.
- `Tab` advances to the next pane within the current window, wrapping from last to first.
- After `]` or `[` lands on a new window, the focused pane is **pane 0** of that window (first in enumeration order). Per-window pane focus is not preserved across window cycles.
- In single-window single-pane sessions, `]` / `[` / `Tab` are no-ops (no flicker, no error).
- The viewport's native scroll keys (`Up` / `Down` / `PgUp` / `PgDn` / `Home` / `End`, and any other `bubbles/viewport` defaults) scroll within the focused pane's loaded N-line slice.
- Under a session with non-contiguous tmux `window_index` values (e.g. `0, 2, 5`) or `pane-base-index 1`, the chrome counter `M of N` shows the **1-based ordinal position in enumeration order** (always `1..N`), not the raw `window_index` or `pane_index`.

**Read pipeline**
- Each focus-changing event (initial open, `]`, `[`, `Tab`) triggers a fresh tail-N read of the newly-focused pane.
- The tail-N helper reads at most the last 1000 `\n`-terminated lines, regardless of `.bin` file size.
- The read pipeline does **not** invoke `tmux capture-pane`, does **not** mutate any tmux marker, does **not** drain any FIFO, does **not** fire any resume hook.
- Re-opening preview on the same session re-reads window 0 / pane 0 fresh; no position or scroll state is carried over.
- Window resize during preview re-flows the viewport without triggering a re-read of the focused pane's `.bin`.

**Chrome**
- Chrome shows window M of N, pane X of Y, window name (`#W`), and visible cycle-key hints.
- Chrome reflects the structural enumeration captured at preview-open and does not re-enumerate mid-preview.

**Edge cases**
- A pane with a missing `.bin` renders the placeholder; chrome counts remain correct.
- A pane with a zero-byte `.bin` renders the placeholder.
- A pane with fewer than 1000 lines renders all available lines (no placeholder).
- An OS-level read error renders the error string; subsequent focus changes onto the same pane retry the read.
- A brand-new session whose panes have no `.bin` yet shows the placeholder for each pane; chrome remains correct.
- An externally-killed session whose preview is open continues to render with placeholders as `.bin` files are cleaned; `Esc` returns to the Sessions list, which re-fetches and the killed session is gone.
- A session that returns empty structural enumeration (zero windows / zero panes) is treated as enumeration failure: preview does not open and the user remains on the Sessions list.

**Filter integration**
- While typing a filter, `Space` inserts a literal space into the filter input (does not open preview).
- After committing the filter (`Enter`), `Space` opens preview on the highlighted match.

**Side-effect-free contract**

Within a single test that opens preview on session S, cycles through every pane in S, and dismisses (no live daemon, no real tmux server — the seams are mocked):

- The preview code path issues exactly one `TmuxEnumerator` call (the structural enumeration at open) and zero further tmux invocations. Verifiable via the `TmuxEnumerator` mock recording calls.
- The preview code path issues only `ScrollbackReader.Tail(paneKey)` calls — one per focus event — and never any other I/O on `.bin` paths. Verifiable via the `ScrollbackReader` mock recording calls (no write methods exist on the interface).
- The preview code path makes zero calls into the `hooks.Store`, no writes via `state` package writers (`SetSkeletonMarker`, `WriteScrollbackIfChanged`, etc.), and no FIFO creation or drain. Verifiable by snapshotting the relevant state before/after the preview interaction.

The intent is a hermetic, no-write code path — the assertions above are the operationalisation of "side-effect-free".

### Open Items Handed to the Build Phase

These are spec-pinning decisions intentionally deferred to implementation:

- **N value pinned at 1000** by this spec; build may surface as a named constant.
- **Chrome layout details** — exact wording, header vs footer placement, single-line vs two-line.
- **Placeholder wording** — working label is "(no saved content)".
- **Error string for OS-level read failures** — short, viewport-renderable.
- **Tail-N helper name and exact package location** within `internal/state`.
- **Confirm `_portal-saver` exclusion** is already applied at the Sessions-list source. If not, fix at the source — not in preview.
- **Within-preview keymap collisions** — confirm `]`, `[`, `Tab` do not collide with any inherited `bubbles/viewport` or page-level bindings; if they do, preview's binding wins inside the preview page.

---

## Working Notes
