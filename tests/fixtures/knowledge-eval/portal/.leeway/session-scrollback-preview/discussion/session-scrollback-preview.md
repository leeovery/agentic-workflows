# Discussion: Session Scrollback Preview

## Context

Quick Look-style preview of a session's scrollback from the portal `open` panel,
so users can disambiguate similarly-named sessions — especially Claude / team-up
sessions in the same project, where session names are `{directory}-{nanoid}` and
the only distinguishing context lives in the running content — without paying
the attach/detach cost.

Research established feasibility for every shape under consideration: the
primitives (`tmux capture-pane`, `state.ListSkeletonMarkers`, per-pane `.bin`
files, the `pageFileBrowser` precedent, `bubbles/viewport`) are all in place,
and the side-effect-free preview path is sound (skeleton-marker branch or
always-disk both leave session state byte-identical). What remains is *what to
build*, not *can we build it*.

### Locked Feature Shape (from research, not for re-litigation)

- **Trigger.** Space on a highlighted session opens preview; Enter attaches as
  today; Esc returns to the list.
- **Interaction shape.** Sub-page peer of `pageFileBrowser` — full-screen, own
  keymap, progressive Esc.
- **In-preview stepping.** Step between candidate sessions without exiting back
  to the list (Claude Code resume-style).
  *(Overridden during discussion in favour of an Esc → arrow → Space loop.
  See the Stepping Key Inside Preview subtopic for the rationale.)*
- **Centrepiece.** Visual terminal state of the session's panes — same bytes a
  fully attached client would see. Not metadata labels.
- **Multi-pane / multi-window in scope.** Specific rendering shape is design
  phase territory.
- **Side-effect-free.** Space + Esc leaves session state byte-identical. No
  hydration, no hook fire, no marker mutation, no FIFO consumed.

### References

- `.workflows/session-scrollback-preview/research/session-scrollback-preview.md`
- CLAUDE.md § *Server bootstrap*, § *Resume hooks*
- `.workflows/tui-session-picker/specification/...` — page state machine,
  `bubbles/list` precedent

## Discussion Map

### States

- **pending** — identified but not yet explored
- **exploring** — actively being discussed
- **converging** — narrowing toward a decision
- **decided** — decision reached with rationale documented

### Map

  Source of preview bytes [decided] — always-disk

  Multi-pane rendering shape [decided] — sequential, window-grouped
  ├─ `]` / `[` cycle windows; `Tab` cycles panes (forward + wraparound)
  ├─ Chrome floor: window M of N + pane X of Y + window name + keystrokes
  └─ Degenerate 1×1 case: keys silently no-op

  History depth [decided]
  ├─ Bounded snapshot, scrollable within bounds
  ├─ Generous N (e.g. ~500-1000 lines), pin in spec
  └─ Tail-N read at disk layer (decouples cost from file size)

  Refresh semantics [decided] — re-read on every step
  ├─ File is source of truth; no content cached in model
  └─ Dwell refresh: step away + back (no `r` key needed)

  Stepping key inside preview [decided] — no between-session stepping;
  Esc → arrow → Space loop replaces it

  List cursor sync vs no sync on Esc [decided] — N/A (preview can't move
  the cursor; Esc returns to original position)

  Filter behaviour during preview [decided]
  └─ Default `bubbles/list` semantics — commit filter (Enter), then Space

  Brand-new-session edge case (no `.bin` yet) [decided]
  └─ Placeholder per-pane; chrome still works (tmux structural counts)

  Privacy / threat model [decided] — explicitly no design response
  └─ User-responsibility framing; not Portal's concern

---

*Subtopics are documented below as they reach `decided` or accumulate enough
exploration to capture.*

---

## Source of Preview Bytes

### Context

Preview must show the visual terminal state of each pane in the previewed
session. Two architectural shapes were viable per research:

- **Always-disk.** Read each pane's `.bin` file written by the save daemon.
- **Marker-branched.** Branch on `@portal-skeleton-<paneKey>`: live
  `tmux capture-pane -e -p -S -<n>` for hydrated panes, disk for skeletons.

Both are feasible and side-effect-free (research F3). This is a what-to-build
choice — staleness vs liveness vs code-path complexity — not a feasibility
question.

### Options Considered

**Option A — Always-disk**

- Pros:
  - Single read path. No marker check. No fork in the rendering pipeline.
  - No new tmux wrapper. The existing `CapturePane` hardcodes `-S -` and is
    shared with save-daemon semantics; a bounded variant
    (`CapturePaneTail(target, n)`) would be net-new.
  - No per-preview tmux IPC. File reads are microseconds, so stepping is
    essentially instant.
  - F13 rapid-stepping race largely vanishes — the window where a slow
    capture overwrites a newer view is too small to matter when the read is
    file I/O.
  - Skeleton panes already require this path. Extending it to hydrated panes
    adds zero new code.
- Cons:
  - Up to ~1s stale, longer if the daemon's per-tick worst case exceeds 1s
    under heavy load (research F2: "small but not strictly bounded by 1s").
  - Brand-new sessions created within the last save tick may have no `.bin`
    yet — placeholder needed (separate subtopic).
  - Surface labelled "what attaching now would show" is actually a snapshot
    of the previous tick.

**Option B — Marker-branched (live for hydrated, disk for skeletons)**

- Pros:
  - Zero staleness for hydrated panes.
  - Sets up infrastructure if a future live-tail mode is wanted.
- Cons:
  - Two code paths; rendering forks on marker.
  - Requires a new `CapturePaneTail` wrapper.
  - F13: rapid stepping → in-flight captures for session N landing after
    user has stepped to N+1; needs generation/sequence tokens to ignore
    stale replies.
  - Per-preview tmux IPC adds latency (sub-30ms typical, real cost on busy
    multi-pane workspaces).

### Journey

Opened the decision against the actual use case rather than the abstract
property: disambiguation is a **recognition** task, not a **live monitoring**
task. The user is glancing to identify "which `pigeon-AbCdEf` is which",
not watching a session change in real time.

User probed the worst-case staleness directly:

> If a log is tailing 100 lines/sec and the daemon is busy, we could be
> hundreds of lines out of date — still doesn't matter. I'm not looking at
> line content; I'm recognising "this is my tailing log session". It catches
> up once I attach.

Two ends of the bandwidth spectrum both hold:
- Slow output (Claude TUI): 1-2s stale is invisible because Claude moves
  slowly in the first place.
- Fast output (busy logs): the user isn't reading individual lines, they're
  identifying the session by overall shape.

User also independently confirmed: not a single-user-on-multiple-machines
environment. No concurrent attach contention worth designing for — they
won't be working on the previewed session from elsewhere while previewing it.

Live preview was explicitly rejected as a separate concern: previews are
**snapshots at the moment they're taken**, not real-time feeds. This pre-empts
part of the Refresh Semantics subtopic — though "do we re-read on each step?"
and "is `r` worth offering?" remain open there.

### Decision

**Always-disk.** Single read path: `state.ScrollbackFile(stateDir, paneKey)`
for every pane in the previewed session, regardless of skeleton-marker state.

Deciding factors:

- Disambiguation use case is recognition, not live monitoring — staleness is
  invisible at the user-perception level for both ends of the bandwidth
  spectrum.
- Single-user-per-machine environment means no concurrent-attach contention
  worth designing complexity around.
- Architectural simplicity: no marker check, no rendering fork, no F13
  mitigation, no new tmux wrapper.
- Reversibility is high — if liveness ever matters later, marker-branched
  can be added as a per-pane source override without changing the rendering
  pipeline.

Trade-offs accepted:

- Staleness ceiling is "small but not strictly bounded by 1s". Accepted
  because it doesn't bite the use case.
- Brand-new session edge case (no `.bin` yet) is owned by its own subtopic.
- The "live state" surface label is a small honesty cost — preview is a
  snapshot, full stop.

Confidence: high. Grounded in actual workflow, with genuine reversibility.

---

## Multi-pane Rendering Shape

### Context

Sessions can contain multiple windows, each with multiple panes. Preview must
represent that structure (Stated Feature Shape: "Multi-pane / multi-window in
scope"), but *how* the structure is rendered has a real cost gradient. The
question is whether we render the literal `window_layout` (best fidelity,
custom parser ~50–100 LOC) or use a sequential / window-grouped flat
presentation that doesn't honour the actual layout shape.

Real-world distribution sample is N=1 — 14 of 16 sessions on the user's
machine are 1-pane (research F6) — so the dominant case collapses regardless
of the choice. Decision matters only for the 2+ pane minority.

### Options Considered

**Option A — Sequential / tabbed (flat cycle)**

One pane shown at a time. Single key cycles through every pane in the
session, flat ordering: w1.p1 → w1.p2 → … → w2.p1 → wraps. Header shows
position.

- Pros: cheapest. Reuses single-pane rendering verbatim. Header line tells
  the whole story.
- Cons: collapses the window/pane hierarchy. For sessions with multiple
  windows of distinct purpose, the flat list is harder to navigate
  intentionally.

**Option B — Sequential, window-grouped**

One pane shown at a time, but cycling is hierarchical: one key cycles panes
*within the current window*, another key jumps windows. Header shows both
window position and pane position.

- Pros: matches tmux's own mental model (windows contain panes; you switch
  between windows, you cycle panes within). Maps cleanly to the natural
  phrasing — "this session has two windows; window 1 has four panes,
  window 2 has one". Still cheap — same renderer.
- Cons: two keys instead of one. Marginal added concept.

**Option C — Literal `window_layout`**

Parse the opaque `window_layout` string, divide the preview viewport
proportionally, render each pane in its slot.

- Pros: best visual fidelity. Layout shape itself becomes a strong
  disambiguation signal — "the session with the four-pane grid" reads
  instantly without cycling.
- Cons: ~50–100 LOC parser nobody else in portal needs. Per-pane content
  fits a smaller box (typical 120×30 → ~30×12 per pane in a 4-pane grid).
  Header/footer chrome eats more vertical room. Higher implementation cost
  for a benefit that mostly accrues to a minority of sessions.

### Journey

Opened framing as a cost-fidelity gradient with three stops. User cut
straight through:

> If I open that up, as long as it says somewhere that this window has two
> windows, window one has four panes, and window two has one pane, I'm fine
> with that. As long as I can see that and tab between the panes and the
> windows. 95% of the time it's single window, single pane per session.

That argument lands twice:

1. **Distribution kills the case for fidelity.** The sessions where literal
   layout would shine are a minority of a minority. Most sessions are 1×1
   and all three options render identically.
2. **Recognition needs structure, not shape.** A header that says "window 1
   of 2, pane 2 of 4" *is* the structural disambiguation signal. The user
   doesn't need to *see* the layout to recognise the session; knowing the
   structural shape (counts and current position) is enough.

Picked the cycle semantics next: flat-vs-grouped. User went grouped — it
matches tmux's natural mental model and the way the user phrased the
overview in conversation ("window one has four panes, window two has one").

User added: keystroke hints visible in the chrome, matching portal's
existing UI convention elsewhere.

Literal-layout was explicitly deferred, not rejected:

> If later I decide I'd like to actually recreate the window layout
> structure, then we can add that in later. But for now, I just don't think
> we need it.

### Decision

**Sequential, window-grouped.** One pane shown at a time. Within-preview
navigation keys:

- **`]`** — next window. **`[`** — previous window. Bidirectional because
  windows are typically purposeful (editor / logs / repl) and overshoot is
  costly.
- **`Tab`** — next pane within current window, forward-only with
  wraparound. Pane counts are small enough that wraparound isn't painful;
  bidirectional bindings would be over-spec for the dominant case.

Degenerate cases (the dominant 95%+ single-window single-pane case): all
three keys silently no-op. No flicker, no error feedback, just nothing.

Header (or footer) chrome shows structural overview and current position
explicitly — sufficient detail that the user can identify "which window am
I in" and "how many siblings does this pane have" at a glance — plus
visible keystroke hints in portal's existing UI convention.

Within-session keys are pinned here. The **Stepping key inside preview**
subtopic now owns only *between-session* stepping (cycling through
candidate sessions in the picker without exiting preview), and must avoid
colliding with `]` / `[` / `Tab`.

**Position on session re-entry: reset.** Stepping out to session B and back
to session A re-opens A at window 1 / pane 1, not at the last viewed
position within A. Reasoning: the use case is disambiguation, fresh-view
matches "step ↔ recognise" better than memory; per-session position state
adds complexity for an interaction shape that doesn't need it.

Deciding factors:

- Real-world distribution makes literal-layout a low-leverage investment.
- Header chrome carries the structural disambiguation signal that fidelity
  would otherwise carry.
- Window-grouped matches tmux's mental model — natural for users who already
  think in tmux terms.
- Reversibility is high — literal-layout can be added later without
  invalidating the sequential renderer (additive flag/mode, not a rewrite).

Trade-offs accepted:

- Multi-pane sessions don't preview *as themselves* shape-wise. Mitigated by
  the chrome.
- Two cycle keys instead of one. Marginal.

Confidence: high. Decision is explicitly staged for upgrade if v1 feels
weak in practice.

### Chrome Floor

Because the rationale leans on chrome to discharge the promise the
literal-layout option would otherwise carry, the minimum chrome content is
a discussion-level commitment, not a spec detail:

**Floor (must show, v1):**

- **Window M of N** — without this, users have no signal that the session
  has multiple windows.
- **Pane X of Y** — same logic within a window.
- **Window name** — tmux's `#W` / window name. Adds disambiguation signal
  for users who name their windows.
- **Keystroke hints** — Portal's existing UI convention. Without them users
  don't know the cycle keys exist.

**Above the floor (rejected for v1):**

- Per-pane current-command (e.g. `nvim`, `claude`). Costs a `list-panes -F`
  call per preview; nice-to-have not load-bearing.
- Pane position hint (e.g. `(top-right)`). Faint layout nod without parsing
  layout — declined; the cycle nav covers the same gap.

Exact wording / placement (header vs footer, single-line vs two-line) is
still UI work for spec or build — but the *content* is now pinned.

---

## History Depth

### Context

Each pane's `.bin` file on disk holds the full saved scrollback — for busy
sessions this can be 50k+ lines, ~3.7MB (research F1). The viewport renders
maybe 30 lines at a time. Question: how much of the file do we feed into the
viewport per preview, and is deeper history reachable from inside preview?

### Options Considered

**Option A — Bounded snapshot, fixed depth, no scroll**

Read last N lines (e.g. 200 = ~10× viewport). Viewport shows what fits. No
scroll. No way to reach deeper history.

- Pros: minimal memory footprint, simplest mental model.
- Cons: even within the bounded slice, the user can't peek above the visible
  viewport. Wastes the cheap part of `bubbles/viewport`.

**Option B — Bounded snapshot, scrollable within bounds**

Read last N lines. Viewport renders the tail by default. User scrolls up
within the viewport to see content within those N lines. Scroll boundary at
the top is the bounded read. Deeper history (beyond N) is not reachable in
v1.

- Pros: scroll within preview is free with `bubbles/viewport`.
- Cons: scroll boundary is invisible to the user — pressing up at the top
  silently no-ops. Mitigated by chrome or by simply choosing N large enough
  that nobody notices.

**Option C — Bounded with lazy extend**

As B, but pressing `r` (or scrolling past top edge) extends the read to the
full file. Deferred load.

- Pros: deeper history reachable without paying for it on every preview.
- Cons: meaningful additional state per pane, second code path, edge
  cases on the trigger UI. Adds scope without clearly serving a current
  use case.

**Option D — Always full file**

Read everything every time. Simplest read pipeline.

- Pros: zero ceiling on visible history.
- Cons: feeds 50k-line content into `viewport.SetContent` for every step
  through every busy pane. Memory churn during fast stepping is real even
  if the disk read itself is cheap.

### Journey

The use case argument from earlier subtopics carries: disambiguation is
recognition, not forensics. "What command did I run earlier" is genuinely a
different feature — answered by full attach, not preview.

User's instinct landed on A first, then refined to B once it was clear that
scroll-within-bounds is essentially free in `bubbles/viewport`:

> Bounded snapshot, fixed depth, but just make it big enough that it shows
> enough information and can scroll up to and including whatever's
> captured. If later I want more, we can add it.

The "scroll within bounds is free" detail mattered: it removes the false
trade-off between "no scroll at all" and "full deferred extend".
Reversibility was confirmed in three concrete shapes (bigger N, lazy
extend, live tail) — none of which invalidate B as the v1 choice.

### Decision

**Option B — Bounded snapshot, scrollable within bounds.** Read last N
lines directly from disk via a tail-N idiom (open file, seek to end, read
backwards until N newlines collected), feed N to `viewport.SetContent`.
User can scroll up within those N lines via the viewport's native scroll
keymap.

The tail-from-disk implementation is load-bearing: it decouples cost from
total `.bin` file size. A ~3.7MB / 50k-line busy-session file becomes
sub-millisecond to read at the same cost as a tiny one — no full-file read,
no `strings.Split` allocating 50k strings per cycle keypress. ~30 LOC,
standard idiom.

The exact value of N is a spec detail. We can be generous — ~500-1000
lines gives comfortable scroll headroom. Pin in spec.

Deciding factors:

- The disambiguation use case doesn't need deep history; the recent screen
  is the load-bearing content.
- Scroll within bounds is free with `bubbles/viewport` — no architectural
  cost.
- Reversibility into "more history" is easy in three independent shapes:
  bump N, add lazy extend, add live tail. None of these require revisiting
  this decision.

Trade-offs accepted:

- Hard top-edge boundary at N is invisible to the user. Acceptable if N is
  generous enough that the boundary rarely surfaces.
- Memory: holds N lines per previewed pane during preview. Negligible at
  N≤1000.

Confidence: high. Reversibility is genuine and the use case is well
constrained.

---

## Refresh Semantics

### Context

Live-tail was foreclosed by the Source of Preview Bytes decision (snapshots,
not streams). The remaining question: between preview-open and dismiss,
when (if ever) is the disk re-read?

### Options Considered

**Option A — Snapshot at preview-open, frozen for whole preview**

Read each pane once when first seen. Never re-read until preview closes.

- Pros: cheapest, most predictable.
- Cons: dwelling on one session for 30s shows a 30-second-stale view. Esc
  + Space again to refresh (heavy-handed for a tiny problem).

**Option B — Re-read on every step**

Every focus event (between-session step, `]`, `[`, `Tab`) triggers a fresh
read of the focused pane's `.bin`. No timer, no polling — only reads when
the user acts.

- Pros: file is the source of truth, no content held in model state.
  Stepping cost is one disk read (microseconds for ~20KB tail-clipped from
  the typical `.bin`). Naturally handles dwell — step away + back is
  refresh.
- Cons: same content re-read on every visit (negligible cost).

**Option C — Manual `r` to refresh**

Snapshot frozen until user presses `r`.

- Pros: explicit user control over staleness.
- Cons: adds a key for a case already covered by stepping.

### Journey

User cut through quickly with the architectural framing:

> Re-reading on each step avoids having to store the content too — file is
> source of truth.

That observation is load-bearing for more than just refresh: it implies
the model doesn't cache pane content at all. Per-pane state stays at
"position cursor" and "currently focused pane key" — content is computed
on demand from disk every render-changing event. Memory footprint stays
bounded regardless of how long preview is open or how many panes have
been visited.

Dwell case (open preview, sit for 30s) is handled implicitly: any focus
change re-reads, and re-acquiring focus after stepping out and back is the
natural refresh idiom.

### Decision

**Option B — Re-read on every step.** No content cache, no `r` key, no
timer. Disk is the source of truth; preview is essentially stateless with
respect to byte content.

Read trigger events:

- Initial preview-open (Space) — lazy per focus: reads only the
  currently-focused pane (window 1 / pane 1 by reset rule). Other panes
  are read on first focus via `]`/`[`/`Tab`. Chrome counts (window M of
  N, pane X of Y) come from tmux structural enumeration, not from `.bin`
  content, so chrome doesn't force eager reads.
- `]` / `[` window cycle — re-reads the newly-focused pane.
- `Tab` pane cycle — re-reads the newly-focused pane.

(Between-session step is *not* a trigger because in-preview between-session
stepping was removed — see Stepping Key. To preview a different session,
the user Esc's back to the list, moves the cursor, and presses Space —
which fires the initial-open trigger fresh.)

**Viewport-internal scroll does not re-read.** The active viewport holds
its current N lines while focused; scrolling up/down within those bounds
is a pure viewport operation. The "no content cache" framing applies
*across focus changes* (no per-pane cache held while focus moves
elsewhere) — the currently-focused viewport is the active rendering
buffer, not a cache.

**Scroll position resets on focus change.** If the user scrolls 50 lines
up in window 1 / pane 1, then `Tab` to pane 2, then `Tab` back to pane 1
— pane 1 re-renders at scroll-tail (default), not at scroll-offset 50.
Consistent with the position-reset rule already pinned for between-session
stepping. Scroll position is ephemeral per focus session.

**Read-failure handling.** Three failure modes, all benign:

- *Daemon mid-write while preview reads.* Closed by atomicity:
  `fileutil.AtomicWrite0600` is tempfile + rename, so the reader sees
  old-or-new full content, never torn.
- *`.bin` deleted between two consecutive focus events* (pane killed,
  daemon cleanup, etc.). Show a "(no saved content)" placeholder for
  that pane. Same placeholder shape used for the brand-new-session
  edge case.
- *OS-level read error* (permissions, disk full, etc.). Show an error
  string in the viewport rather than crash. No special handling beyond
  "render the error". Should never occur given mode 0600 / same-user
  guarantees from the save daemon, but cheap to handle defensively.

Deciding factors:

- File-as-source-of-truth eliminates content state from the preview model.
- Disk reads are microseconds — re-reading on every event is essentially
  free.
- Dwell refresh falls out naturally from stepping.
- One less key surface to design (`r`).

Trade-offs accepted:

- Sit-and-stare-at-one-pane case sees stale content. Low-friction recovery
  (step away + back). Acceptable.

Sync-vs-async is no longer a question: the History Depth decision pinned
tail-N read at the disk layer, which decouples cost from total file size.
Every focus event does a sub-millisecond bounded read regardless of `.bin`
size. Synchronous in `Update` is fine; `tea.Cmd` deferral and generation
tokens (research F13) are not needed.

Confidence: high. The architectural framing makes this almost a
consequence of the always-disk decision rather than a separate choice.

---

## Stepping Key Inside Preview (and List Cursor Sync — N/A)

### Context

Research's Stated Feature Shape called for "in-preview stepping" between
candidate sessions, Claude Code resume-style: Space to open preview on the
highlighted session, then arrows (or some key) move you to the next
candidate session without exiting preview. The motivation was scanning
through several lookalikes without the Esc-Space-Esc-Space cost.

In-preview stepping created a cluster of design surface: which keys move
between sessions, whether the underlying list cursor follows along (List
Cursor Sync), whether stepping iterates the filter-narrowed set or all
sessions, and how those keys avoid colliding with within-session
navigation (`]`/`[`/`Tab`).

### Options Considered

**Option A — In-preview between-session stepping**

Arrow up/down (or similar) inside preview moves to next/previous candidate
session without leaving preview. Cursor in the underlying picker list
follows along (or doesn't — separate sub-decision).

- Pros: matches Claude Code's `--resume` picker mental model. One
  keypress per session-step when scanning lookalikes.
- Cons: surface area — keymap, cursor sync, filter set boundary, key
  collision with within-session keys. Nontrivial to implement and reason
  about. Two pending subtopics ride on it (List Cursor Sync, part of
  Filter Behaviour).

**Option B — Esc → arrow → Space loop**

Preview is bound to one session at a time. To preview another, Esc back
to the list, move the cursor, Space again.

- Pros: dramatic simplification. List Cursor Sync becomes N/A (preview
  can't move the cursor; Esc returns to where you were). Filter
  Behaviour loses its "stepping iterates filtered or all" sub-question.
  Refresh Semantics' trigger list narrows. No between-session keymap to
  design.
- Cons: ~2 extra keypresses per session-step when scanning lookalikes
  (Esc + Space added on top of arrow). For a 5-way scan that's ~10
  extra keystrokes versus Option A.

### Journey

User overrode the research-locked "in-preview stepping" constraint
directly:

> I don't think we should do this — Esc to go back, then arrow up and
> down is fine.

That trades the keystroke savings for a much smaller, simpler surface.
The tradeoff is genuine — Option A is faster for the multi-candidate
scan use case — but Option B's simplification is real and the keystroke
cost is bounded (2 extra keypresses per step is small absolutely).

The research's framing of in-preview stepping as solving "scanning
through several lookalikes" was acknowledged but not load-bearing
enough to justify the design surface.

### Esc Level Structure

Progressive Esc was part of the locked feature shape. Pinning the level
tree explicitly because the spec needs it:

- **In preview** → Esc → back to Sessions list. Filter stays committed
  if it was; cursor stays on the previewed session.
- **In Sessions list with committed filter** → Esc → clear filter. Back
  to unfiltered list; cursor preserved. Standard `bubbles/list`.
- **In Sessions list with no filter** → Esc → quit Portal (or back to
  caller). Existing Portal behaviour.
- **In Sessions list mid-typing-filter** → Esc → cancel filter input,
  return to unfiltered list. Existing `bubbles/list` behaviour.

A typical "filter, then preview, then quit" path is preview → Esc →
committed-filter list → Esc → unfiltered list → Esc → quit. Three Escs
to fully exit from inside preview with a filter active. Each Esc
discharges exactly one level of state — the user model is "Esc backs
out of one thing at a time".

### Decision

**Option B — No in-preview between-session stepping. Esc → arrow → Space
loop replaces it.**

Cascade:

- **Stepping Key inside preview**: no between-session keys to bind.
  Within-session keys (`]`/`[`/`Tab`) remain pinned by Multi-pane
  decision.
- **List Cursor Sync vs no sync on Esc**: N/A. Preview can't move the
  cursor, so the cursor stays where it was when Space was pressed; Esc
  returns to that same cursor position. No sync question.
- **Refresh Semantics**: the "between-session step" trigger no longer
  applies. Trigger list narrows to initial-open, `]`, `[`, `Tab`. (See
  the updated trigger list in the Refresh Semantics section.)
- **Filter Behaviour**: the "in-preview stepping iterates filtered set
  or all items" sub-question is moot. Space-while-filtering fork
  remains relevant.

Deciding factors:

- Simplification of three pending subtopics (Stepping Key + List Cursor
  Sync + part of Filter Behaviour) into one decision point.
- Esc-Arrow-Space is a familiar idiom across CLI tools; users already
  know it.
- Reversibility is easy — adding in-preview stepping later is additive
  (new keymap entry + cursor-sync-or-not), not a rewrite.

Trade-offs accepted:

- ~2 extra keypresses per session-step when scanning multiple lookalikes.
  Bounded cost, real but small.
- Overrides a research-locked Stated Feature Shape constraint.
  Documented here so the override is traceable.

Confidence: high. The simplicity payoff is concrete (subtopics collapse,
keymap design surface shrinks); the cost is bounded and behavioural, not
architectural.

---

## Filter Behaviour During Preview

### Context

`bubbles/list`'s filter mode has two phases:

1. *Filtering* (`SettingFilter()` true) — every keypress is text input.
   Space inserts a literal space.
2. *Filter committed* (after Enter) — list shows the filtered set, arrows
   move the cursor, Space is free to do something else.

The primary-use-case path the research called out is "type filter to narrow
lookalikes → arrow → Space". That collides with phase 1: while typing, Space
goes to the filter input, not to preview. Three reconciliation shapes were
on the table.

### Options Considered

**Option A — Default semantics (commit-then-preview)**

Type filter → Enter to commit → arrows + Space work as expected.

- Pros: zero new code, zero edge cases. Consistent with how filter works
  in every other portal command. Mode-switching is what users expect from
  any text-input + list-nav combo.
- Cons: one extra Enter at the start of each filter session. First-time
  users may wonder why Space "doesn't do anything" while typing.

**Option B — Magic Space (commit-and-preview in one step)**

Intercept Space while filtering: commits the filter, then opens preview
on the highlighted match.

- Pros: saves the Enter. Slightly faster for the primary use case.
- Cons: literal space in filter input becomes impossible during typing
  (workaround: commit filter first then re-edit, awkward). Inconsistent
  with the rest of Portal's filter behaviour. Magic — surprising for
  users who know `bubbles/list`.

**Option C — Different key for preview while filtering**

Space stays as literal-space-in-filter. Some other key (e.g. `?`,
`Ctrl+P`) opens preview, working regardless of filter state.

- Pros: no magic, no edge cases on filter input.
- Cons: invents a second binding for "open preview", competing with the
  spec's `Space`. Loses the muscle-memory simplicity.

### Journey

User cut through with the cleanest framing:

> Filtering is filtering. It's expected for the space bar to change
> behaviour when typing into a text field vs scrolling a list.

That's the principle that justifies A: text input and list navigation are
two distinct modes, and Space behaves differently in each is not a bug,
it's how every text-input UI in existence works. The "consistent with
Portal" framing was a corollary of the deeper "consistent with how text
input always works".

### Decision

**Option A — Default `bubbles/list` semantics. Commit filter (Enter)
before Space opens preview.**

User flow:

1. Type filter (e.g. `pigeon`).
2. Press Enter to commit filter (list narrows to matches).
3. Arrow to candidate.
4. Space to preview.
5. Esc back to list (filter still committed; cursor stays in narrowed
   set).
6. Arrow + Space to preview next candidate.
7. Esc to clear filter or quit.

Deciding factors:

- Filter typing and list navigation are distinct interaction modes;
  Space changing role between them is the universal text-input
  convention.
- Zero new code, zero magic, zero edge cases.
- Consistent with how every other Portal command's filter works.

Trade-offs accepted:

- One extra Enter at the start of each filter session. Bounded cost,
  trainable in seconds.

Confidence: high. The principle ("filtering is filtering") generalises
beyond this feature.

---

## Brand-new-session Edge Case

### Context

Two related "no `.bin` content" scenarios:

1. **Whole-session.** A session created within the last save tick — daemon
   hasn't captured any of its panes yet.
2. **Per-pane** (F9 from review-001). A multi-pane session where one pane
   was just split-windowed in and the daemon hasn't ticked it yet. Other
   panes have `.bin`; the new one doesn't.

### Decision

**Per-pane "(no saved content)" placeholder.** Same shape used for the
read-failure / deleted-bin case in Refresh Semantics — preview renders a
visible placeholder in the viewport for any pane whose `.bin` is missing
or unreadable. Other panes in the same session render normally.

Chrome (window M of N, pane X of Y, window name) is unaffected: those
counts come from tmux structural enumeration, not from `.bin` content.
The user sees the correct structure with placeholders where content is
missing.

The exact placeholder wording is a spec/UX detail, not a discussion-phase
decision. "(no saved content)" is the working label.

Deciding factors:

- Reuses the read-failure placeholder already pinned in Refresh Semantics.
  Single rendering primitive across all "no content" cases.
- No fallback to live capture — would contradict always-disk and only
  work for hydrated panes anyway.
- Per-pane granularity matches the per-pane disk read; treating the whole
  session as "incomplete" would lose information unnecessarily.

Confidence: high. Largely a consequence of read-failure handling already
landed.

---

## Privacy / Threat Model

### Context

Research flagged this as a *qualitative* shift in Portal's exposure surface,
not just a UX shortcut over attach. Today, surfacing scrollback secrets
(sudo prompts, pasted API keys, `.env` echoes, ssh keys) requires a
deliberate `tmux attach` + scroll. With preview, it becomes 1-keypress
glanceable from the picker — relevant during screen-shares, demos, OBS
recording, pairing.

The research's honest framing: *broader* threat surface than today,
*narrower* than freely browsing files in the home directory. Three design
responses were on the table.

### Options Considered

**Option A — Pure documentation.** README / CLAUDE.md note. Zero code,
sets expectation, but nobody reads docs.

**Option B — Opt-out toggle.** Config flag (`portal config set
preview-disabled true`). Default enabled. Lets paranoid users / team-
managed environments turn it off. Future-additive cost.

**Option C — Redaction layer.** Pattern-match known secret shapes and
redact. Actively protective, but false negatives + false positives +
maintenance burden + a *false sense of security* that is arguably worse
than no protection.

**Option D — No design response.** Explicit decision to do nothing.

### Journey

User cut through with the cleanest possible framing:

> Not our concern at all. It's up to the user to protect their own
> secrets etc. No need to document. Ignore.

This is a deliberate user-responsibility stance, applied consistently
across Portal as a single-user developer tool: the user is presumed
competent, the tool exposes its capabilities sharply, mitigation is the
user's responsibility.

The framing was understood — the qualitative-shift argument was laid
out, the screen-share scenario was concrete — and rejected on principle
rather than dismissed accidentally. Worth capturing for traceability:
the decision is *not* "we forgot to discuss it" or "we punted to later",
it is "this is not Portal's problem".

### Decision

**Option D — No design response.** No opt-out toggle, no redaction
layer, no end-user documentation about preview's exposure surface.
Preview ships as a sharp tool; users mitigate during sharing contexts
by simply not pressing Space.

Deciding factors:

- Portal is a single-user developer tool. The user is the operator and
  the audience.
- Redaction (C) creates false sense of security — actively harmful for
  a feature that should be obviously a "what attaching now would show"
  surface.
- Opt-out toggle (B) is reasonable but not load-bearing for v1; if any
  user reports concern, future-additive. Cheap to add later — a config
  flag check at preview-open.
- The behaviour is also self-documenting in use: the first time a user
  opens preview on a session with sensitive content, they see what
  preview shows. No mystery.

Trade-offs accepted:

- A less-careful user could absentmindedly preview a session with
  pasted credentials during a Zoom share. Accepted as user
  responsibility.
- Reversibility is intact: B (opt-out toggle) can be added later
  without rework if real users report concern.

Confidence: high. The principle (user responsibility for their own
threat model) is consistent with how Portal frames the rest of its
surface area.

---

## Cross-cutting Seams

Items that surfaced during final review and don't sit cleanly inside one
subtopic but matter for spec.

### Preview Entry Point — Sessions Page Only

Space-to-preview is a Sessions-page binding only. The TUI's other pages
(Projects, FileBrowser) don't list sessions, so there's nothing to
preview from those pages. No need for placeholder treatment of non-
session list items. Spec should bind Space in `updateSessionsPage`
exclusively.

### Bootstrap Restore-Window Interaction

The 9-step bootstrap sets `@portal-restoring` across step 5 (Restore),
recreates skeleton panes with saved `.bin` files on disk, and clears the
marker in step 6. Loading page is showing during this; Sessions page
transitions in afterward.

No special handling needed:

- During Loading page, there's no sessions list to highlight, so Space
  has no target. Non-issue at the page-state level.
- In Sessions page, even if `@portal-restoring` lingers briefly, the
  always-disk path works regardless of marker state. Skeleton panes have
  `.bin` files on disk *because* they're being restored from saved
  bytes — those are exactly what hydrate will replay. Reading them is
  harmless and informative.
- The inside-tmux invariant (research F12) already excludes the current
  session. Brand-new sessions during restore hit the placeholder pinned
  in Brand-new-session.

The architecture composes naturally; no new constraints.

### Externally-Killed Session During Preview

If session A is killed externally (another tmux client, `tmux kill-
session`, `portal clean`) while the user holds preview open on it:

- The `.bin` files persist briefly, then get cleaned by the daemon. Read-
  failure / deleted-`.bin` is already covered by the placeholder in
  Refresh Semantics — `]`/`[`/`Tab` will increasingly land on
  placeholders.
- Structural enumeration (window/pane counts in chrome) was captured at
  preview-open. Cycle keys cycle the captured shape; no live re-
  enumeration needed mid-preview.
- Esc back to the Sessions list re-fetches the live session list — the
  killed session simply isn't there anymore. Cursor lands on a
  neighbouring session via `bubbles/list`'s default behaviour. Nothing
  graceful to add.

No new decision; the pieces already pinned handle this.

### `_portal-saver` Self-Reference

The `_portal-saver` detached session that hosts `portal state daemon`
should not appear in the picker list at all (existing list-population
logic). If it does, previewing the daemon's own pane would be a self-
referential edge case, but the existing inside-tmux invariant + list
filtering should already exclude it. Confirm during spec/build by
reading the existing list code; no new preview-layer suppression
required.

### ANSI Passthrough vs Viewport Width

Research F9 already established that `bubbles/viewport` does not auto-
wrap (only ANSI-aware horizontal cut via `ansi.Cut` when content is
wider than viewport), and tmux `capture-pane -e` outputs lines hard-
wrapped to the source pane's display width. So:

- If preview viewport ≥ source pane width: no truncation, full lines
  rendered.
- If preview viewport < source pane width: clean ANSI-aware horizontal
  cut. No corruption.

The pipeline is straight passthrough — `viewport.SetContent(rawAnsiBytes)`
with no preprocessing, no sanitisation, no re-wrap. Re-stating it here
because it's load-bearing for the implementation but was previously only
in research. No new decision.

---

## Summary

### Key Insights

1. **Disambiguation is a recognition task, not live monitoring.** Across
   four subtopics (source of bytes, history depth, refresh semantics,
   chrome floor), the framing that mattered was "the user is glancing to
   identify, not watching to track". This collapsed staleness, deep
   history, live tail, and visual fidelity into non-features.
2. **File-as-source-of-truth.** The user's framing during refresh
   semantics — "re-reading on each step avoids having to store the
   content too" — is load-bearing across the whole feature. Preview
   holds no byte cache; the disk is canonical. This eliminated content
   state from the preview model and made every focus event computable
   on demand.
3. **Tail-N read at the disk layer.** The choice to read N lines via
   tail-from-disk rather than full-file-then-clip-in-memory was the
   single highest-leverage implementation decision. It decoupled cost
   from `.bin` size, closed the F13 rapid-stepping race, and
   eliminated the sync-vs-async question.
4. **"Filtering is filtering."** The user's framing during filter
   behaviour generalised beyond this feature: text input and list
   navigation are distinct interaction modes; Space changing role
   between them is the universal text-input convention, not a portal
   inconsistency.
5. **Sharp-tool / user-responsibility for threat model.** Portal is
   framed as a single-user developer tool where the user is presumed
   competent; mitigation of secret-exposure during sharing contexts is
   the user's responsibility, not the tool's. Consistent with how the
   rest of Portal handles capabilities-without-guardrails.
6. **Reversibility as a discipline.** Every major decision was
   explicitly staged for upgrade: literal-layout multi-pane, deeper
   history, live-capture, opt-out toggle, in-preview stepping. The
   v1 surface is intentionally minimal but every removed feature has
   a documented additive return path.

### Open Threads

No discussion items deferred to future discussion. Spec-phase pinning
items (handed off to specification, not deferred discussion):

- **N value for history depth.** Working figure ~500-1000 lines.
- **Chrome wording / placement.** Header vs footer, single-line vs
  two-line.
- **Placeholder wording.** Working label "(no saved content)".
- **`_portal-saver` exclusion confirmation.** Verify existing list
  filtering already excludes the saver session.

### Current State

All 9 subtopics decided. Architecturally, the feature decomposes into:

- **Read pipeline.** `state.ScrollbackFile(stateDir, paneKey)` →
  tail-N idiom → `viewport.SetContent(rawAnsiBytes)` straight
  passthrough.
- **Page state machine.** New `pagePreview` arm in `internal/tui/
  model.go::Update`. Bound to Sessions page only. Owns its own
  keymap.
- **Within-preview keys.** `]` / `[` window cycle, `Tab` pane cycle,
  Esc back to list.
- **Chrome.** Window M of N + pane X of Y + window name + keystroke
  hints; computed from tmux structural enumeration, not from `.bin`.
- **No new tmux wrappers, no new daemon work, no marker mutations,
  no hook firing.** Side-effect-free per Stated Feature Shape.

The override of the research-locked "in-preview stepping" constraint
in favour of the Esc → arrow → Space loop is the only material
deviation from the Stated Feature Shape; it is documented in two
places (Locked Feature Shape note, Stepping Key Inside Preview).
