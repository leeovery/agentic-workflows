# Research: Session Scrollback Preview

Quick Look-style preview of a session's scrollback from the portal open panel, so users can disambiguate similarly-named sessions (especially Claude/team-up sessions in the same project, where session names are `{directory}-{nanoid}` and the only distinguishing context lives in the running content) without paying the attach/detach cost.

---

## Stated Feature Shape (user-confirmed — not for re-litigation)

These are constraints from the user, locked during research and shaping every feasibility check below:

- **Trigger model.** Space on a highlighted session opens preview; Enter attaches as today; Esc returns to the list.
- **Interaction shape.** Sub-page peer of the existing `pageFileBrowser` — full-screen preview with its own keymap and progressive Esc semantics. Not a modal, not a side pane.
- **In-preview stepping.** Preview supports stepping between candidate sessions without exiting back to the list (Claude Code resume-style). Failure mode being solved is *scanning through several lookalikes*, not inspecting one in isolation.
- **Content centrepiece.** Preview renders the *visual terminal state* of the session's panes — the same bytes a fully attached client would see. Not metadata labels (current process, registered hook command), not auto-renamed labels.
- **Multi-pane / multi-window in scope.** Preview must represent panes and windows of the session, not only the active pane. Specific rendering shape (literal layout vs sequential vs per-window) is design phase territory; feasibility is established below.
- **Side-effect-free preview.** Pressing Space and then Esc must leave session state byte-identical to before. No hydration triggered, no on-resume hook fired, no markers mutated, no FIFO consumed. Hooks fire only on actual attach (Enter), via the existing `client-attached` → `signal-hydrate` chain.

## Out of Scope

- AI-based auto-renaming of sessions to make them more distinguishable.
- Showing registered hook command (`claude --resume <uid>`) as a metadata *label*. Earlier exploration drifted into this; corrected — preview shows the running session visually, the hook is just the mechanism that put Claude in the pane.

---

## Existing Codebase Surface Area

The primitives the feature composes are already in the codebase. Whether new tmux command wrappers are needed depends on the *live-capture vs always-disk* choice (Open Design Question 2): the always-disk shape uses zero `CapturePane` calls and needs nothing new; the marker-branched shape needs a bounded-capture variant (e.g. `CapturePaneTail(target, lines)`) — `tmux.Client.CapturePane`'s `-S -` is hardcoded and shared with `internal/state/scrollback.go::CaptureAndHashPane` which depends on full-buffer semantics, so in-place parameterisation isn't viable. Either way, feasibility risk is concentrated in TUI rendering and routing, not in tmux IPC.

| Primitive | Location | Notes |
|---|---|---|
| `tmux.Client.CapturePane(target string) (string, error)` | `internal/tmux/tmux.go:535` | Runs `capture-pane -e -p -S - -t <target>`. `-e` preserves ANSI escapes; verbatim raw output. |
| `tmux.Client.ListPanesInSession(session) ([]PaneCoord, error)` | `internal/tmux/tmux.go:385` | Enumerates live `(window, pane)` coords. Use the live indices, never predict. |
| `tmux.Client.SelectLayout(session, window, layout)` | `internal/tmux/tmux.go:616` | Replays opaque `window_layout` strings. Portal stores layout as opaque pass-through; *no structural parser exists today*. |
| `state.ListSkeletonMarkers(client) (map[string]struct{}, error)` | `internal/state/markers.go:61` | Returns set of paneKeys whose `@portal-skeleton-<paneKey>` is currently set. One call gives the hydrated/un-hydrated map. |
| `state.ScrollbackFile(stateDir, paneKey) string` | `internal/state/paths.go:92` | Resolves the per-pane `<paneKey>.bin` path. Files are atomically written by the daemon (`AtomicWrite0600`). |
| TUI page state machine | `internal/tui/model.go:22-31` | Four pages today (`PageLoading | PageSessions | PageProjects | pageFileBrowser`). `Update` routes by `activePage`. |
| Modal overlay rendering | `internal/tui/modal.go` | `renderListWithModal` composites styled content over the list view, ANSI-aware via `charmbracelet/x/ansi`. Not used for the chosen sub-page shape but sets precedent. |
| `charmbracelet/x/ansi` | already imported | `ansi.StringWidth`, `ansi.Truncate`, `ansi.TruncateLeft`, `ansi.Cut`. |
| `charmbracelet/bubbles/viewport` | transitively in `bubbles v1.0.0` | Sub-package of an existing dep. No `go.mod` change needed. |

---

## Empirical Findings

### F1. `tmux capture-pane` latency

Methodology: 3 runs each per session against the user's live tmux, history sizes 706–50,330 lines, `/usr/bin/time -p`.

| Session | History | `-S -` (full) | `-S -200` (last 200 lines) |
|---|---|---|---|
| infra-terraform | 706 | <10ms / 44 KB | <10ms / 13 KB |
| portal | 15,454 | 50–170ms / 1 MB | <10ms / 21 KB |
| agentic-workflows | 28,388 | 110ms / 2.4 MB | <10ms / 18 KB |
| codeintel | 50,330 | 160ms / 3.7 MB | <10ms / 20 KB |
| pigeon | 49,812 | 160–290ms / 3.8 MB | <10ms / 18 KB |

**Interpretation.** Full-buffer capture scales with history; 6 sequential captures across busy sessions = ~1s of cumulative lag. **Bounded capture (`-S -<n>`) is essentially free regardless of total history** — comfortable for stepping UX even across 6+ sessions. Bounded N tied to viewport height (with overshoot for scroll headroom) is the design implication.

### F2. Daemon save interval

`cmd/state_daemon.go:258`: `TickerPeriod: 1 * time.Second`. So scrollback `.bin` files for live (non-skeleton) panes are stale by at most *one tick interval plus the tick's capture+hash+write duration* during normal operation. Per F1, full-buffer capture against a busy 50k-line pane is ~160–290ms; if the daemon iterates many such panes serially in a single tick, a tick can exceed 1s. The "indistinguishable from live for user perception" claim holds for typical workspaces (1–5 panes) but is best-effort, not a guarantee. Verifying the daemon's per-tick worst-case under realistic load is an implementation-time concern; for design purposes the staleness ceiling is "small but not strictly bounded by 1s".

### F3. Lazy hydration model — and the side-effect-free preview path

This is the load-bearing architectural finding for the feature. Confirmed by reading `cmd/state_hydrate.go`, `cmd/state_signal_hydrate.go`, `internal/restore/session.go`, `internal/state/scrollback.go`.

**Bootstrap step 5 (Restore)** recreates each saved session: sessions/windows/panes via `new-session`/`split-window`/`new-window` with cwd, geometry via `select-layout`/`select-pane`/`resize-pane -Z`, then on each pane `respawn-pane -k` swaps the default shell for `portal state hydrate --hook-key=... --fifo=... --file=...`. The helper opens its FIFO `O_RDONLY` and **blocks**. The skeleton marker `@portal-skeleton-<liveKey>` is set on the pane.

**At this point the picker shows the sessions** but each pane is empty: no shell prompt, no scrollback, no hook fired, helper still blocked.

**On attach** (Enter), the `client-attached` tmux hook fires `portal state signal-hydrate -- <session>`. That writes one byte to each pane's FIFO. Each blocked helper unblocks → emits reset preamble → `io.Copy` of the saved `.bin` to stdout (the PTY) → 100ms settle sleep → unsets the skeleton marker → `execShellOrHookAndExit` looks up the on-resume hook and either exec's `/bin/sh -c '<HOOK>; exec $SHELL'` (firing the user's `claude --resume <uid>`) or bare `$SHELL`.

**The side-effect-free preview path:**

For each pane in the previewed session, branch on the skeleton marker:

```
if @portal-skeleton-<paneKey> is set (un-hydrated):
    read state.ScrollbackFile(stateDir, paneKey) from disk
else (hydrated, live):
    tmux.Client.CapturePane(<session>:<window>.<pane>)
```

Both branches yield the same byte format (`-e`-decorated ANSI from `capture-pane -e -p -S -`) — `internal/state/scrollback.go::CaptureAndHashPane` saves bytes via the same call, so disk-bytes are byte-identical to live-bytes at last save tick. Rendering pipeline does not fork.

**Equivalent simpler shape — always read from disk:**

Because the daemon updates `.bin` every ~1s for every live pane (F2), preview can also be implemented as a single disk-read path for *both* hydrated and un-hydrated panes, accepting a ~1s staleness ceiling on live previews. Single code path, no marker check, no per-preview tmux IPC. The freshness/simplicity tradeoff is a design-phase choice — feasibility-wise both shapes work.

**Knock-on effects (verified):**

- **Hook integrity** ✓ — hook lookup happens inside `execShellOrHookAndExit`, only invoked when the helper exec's. Reading `.bin` does not go near it.
- **Marker integrity** ✓ — marker-unset is the helper's responsibility, post-replay. Disk read doesn't touch markers.
- **Atomic write** ✓ — `fileutil.AtomicWrite0600` (temp file + rename) means a concurrent reader sees old-or-new full content, never torn.
- **Concurrent attach via another tmux client** — if hydrate fires externally during preview, marker becomes unset and next read source-selects naturally. There is a brief race window during the helper's exec sequence (emit preamble → `io.Copy` from `.bin` → 100ms settle → marker unset → exec hook/shell): a preview read landing inside this window could see partial replay or empty pane mid-transition. Outcome is benign (stale-but-recognisable bytes, refreshed on next read), not corrupting — but worth treating as "best-effort consistency under concurrent attach", not unconditional.
- **Brand-new session never captured by daemon** — `.bin` may not exist (created within the past second, save tick missed it). Edge case for v1 — preview shows a "no saved content" placeholder.
- **Permissions** ✓ — files written with mode 0600; TUI runs as the same user.

The user's worry "if I press Esc to go back, do we discard something?" — answer: nothing. Disk-read preview is a pure read.

### F4. Skeleton-marker query API exists with O(1) per-pane check

`state.ListSkeletonMarkers(client)` returns `map[string]struct{}` of all skeleton paneKeys in a single tmux call (`show-options -sv` over server-scope `@portal-skeleton-*`). Preview opens it once at preview-open, then per-pane membership check is O(1). No per-pane tmux call needed for the hydrated/un-hydrated decision.

### F5. Per-pane capture must use *live* indices

Empirical test against a server with `pane-base-index=1`: panes returned as `:1.1, :1.2, :1.3`, not `:0.0, :0.1, :0.2`. Calls to `capture-pane -t multi:0.0` failed with `can't find window: 0`. Same lesson the recent `scrollback-not-restored-with-non-zero-base-index` fix codified — never predict, always re-query via `ListPanesInSession`. Existing wrapper returns live `[]PaneCoord{Window, Pane}` correctly.

### F6. `window_layout` grammar is parseable; opaque to portal today

Empirical sample from a 3-pane test session:

```
4725,120x30,0,0{60x30,0,0,2,59x30,61,0[59x15,61,0,3,59x14,61,16,4]}
```

Grammar:

- Root: `<checksum>,<W>x<H>,<x>,<y>{...}` for the top window.
- `{ ... }` — *horizontal split* (children left-to-right). Comma-separated.
- `[ ... ]` — *vertical split* (children top-to-bottom). Comma-separated.
- Leaf: `<W>x<H>,<x>,<y>,<pane_id>`.

Recursive — splits nest arbitrarily. Single-pass bracket-matched recursive descent ~50–100 LOC. **Portal does not parse this today** — it stores the raw string and replays it verbatim via `tmux.Client.SelectLayout`. So a *literal-layout* multi-pane preview shape would need a custom parser. Sequential and per-window shapes do not.

Real-world distribution sampled from the user's own running tmux server (one user, one moment): 14 of 16 sessions are 1-pane; 2 are 2-pane vertical splits; 0 are nested. **N=1 user — does not generalise** to portal's user base, which likely includes power-tmux users with 4+ pane workspaces (test-runner + editor + REPL + logs is a common shape). Cited as a *floor* for what design must handle gracefully, not as a representative distribution. The cost-benefit framing of multi-pane rendering shape (Open Design Question 1) should not lean on this single-user sample as authoritative.

### F7. `capture-pane` target resolution under "active pane" assumption

`tmux capture-pane -t <session>` (no window/pane suffix) resolves to the session's *current* (active) window's *active* pane. Empirically verified. Lets v1 capture the active pane without enumerating, when scope is "single-pane" only. For multi-pane, enumerate via `ListPanesInSession` and capture each `<session>:<window>.<pane>` target.

### F8. Alt-screen capture semantics

Documented behaviour (tmux man page; my empirical send-keys-based test was inconclusive — alt-screen entry via send-keys did not reliably register, so a real alt-screen program would be needed for definitive verification — but the documented contract is well-established):

- Pane in alt-screen mode (vim, htop, possibly Claude Code TUI):
  - `capture-pane` (no `-a`) returns the active screen — the alt-screen contents (the live UI frame).
  - `capture-pane -a` returns the *other* (main) screen — main-screen content hidden behind alt-screen.
- Pane not in alt-screen mode: `-a` is functionally a no-op.

**Implication.** Default `capture-pane` (and therefore the saved `.bin`) is the right primitive for "what attaching now would show". For Claude Code: if Claude's TUI uses alt-screen, capture returns the live UI frame; if in-line, capture returns the in-line conversation. Either matches what the user would see on attach. The user has not asked for the underlying main-screen scrollback, so `-a` is not needed. The existing `CapturePane` wrapper (no `-a`) is the right shape.

### F9. `bubbles/viewport` does not auto-wrap; ANSI rendering is clean

Read `bubbles/viewport/viewport.go`:

- `SetContent(s)`: splits on `\n`, stores `[]string` of lines as-is. Does not wrap or re-flow.
- `visibleLines()`: slices by Y offset/height; for any horizontal scrolling or content-wider-than-viewport uses `ansi.Cut(line, xOffset, xOffset+w)` — ANSI-aware, charmbracelet/x/ansi.

So the wrap-boundary ANSI corruption gotcha I was worried about (community-reported) **does not apply** to this implementation — viewport never wraps long lines, only truncates per-line ANSI-aware. Since `tmux capture-pane` outputs lines hard-wrapped to the source pane's display width, line widths are bounded; if preview viewport ≥ source pane width, no truncation; if preview is narrower, clean ANSI-aware horizontal cut. No corruption risk in either case.

Implication: the rendering pipeline can be `viewport.SetContent(rawAnsiBytes)` + `viewport.View()` — no preprocessing, no ANSI-aware re-wrap, no sanitisation needed.

### F10. Page-state-machine integration cost

`internal/tui/model.go::Update` (line 785) routes by `activePage` via a switch. Adding a fifth `pagePreview` is one `case` arm + one method (`updatePreviewPage`). Each page handler has the same shape: top-of-handler modal-routing check (`if m.modal != modalNone { return m.updateModal(msg) }`), `tea.KeyCtrlC` quit, page-specific keymap. Esc-progressive-back is per-page (no central stack), so preview owns its own Esc handling: dismiss → return to Sessions page. Filter-typing protection (`SettingFilter()`) ensures Space doesn't open preview while filter is being typed.

**Cost rating:** small. The page-state machine is built for this — no architectural pressure.

### F11. Capture cost for multi-pane preview

Per-pane bounded capture (`-S -<n>`) is sub-10ms per F1. With observed wild-data pane counts of 1–3 per session, total capture cost per preview is sub-30ms — comfortably within stepping budget. The disk-read path is even cheaper (file I/O for ~20KB × N). Not a blocker for any rendering shape.

### F12. Inside-tmux invariant eliminates recursive-capture edge case for free

When portal runs inside tmux (the common case), the existing tui-session-picker spec excludes the current session from the picker list — `internal/tui/model.go` filters it out before calling `SetItems`. Preview is therefore *never* asked to capture the session whose pane is currently rendering portal's own UI. Eliminates the awkward case where `capture-pane` against the active session would show portal's TUI rendered into its own preview viewport (recursive Bubble Tea redraw, garbled output). The invariant is inherited — preview does not need to add any guard for this case.

### F13. Stale-capture handling under rapid stepping (marker-branched path only)

If the live-capture vs always-disk choice (Open Design Question 2) lands on marker-branched, the tmux IPC for hydrated panes runs as a `tea.Cmd` (off the event loop). With sub-second stepping through several sessions, a slow capture for session N can return *after* the user has moved to session N+1, overwriting the newer view with stale bytes. Standard mitigation in Bubble Tea: tag each capture request with a generation/sequence token, ignore replies whose token doesn't match the current selection. Implementation-level concern, not a feasibility blocker. The always-disk path largely sidesteps this — file I/O is fast enough (microseconds per ~20KB read) that the race window is negligible — but the same mitigation is cheap to add either way.

---

## Open Design Questions for Discussion Phase

These are all *what to build*, not *can we build it* — feasibility is established for each.

1. **Multi-pane rendering shape.** Sequential/tabbed (one pane at a time, key to step) vs per-window (one window at a time, panes within shown sequentially) vs literal-layout (parse `window_layout`, divide viewport, render each pane in its slot). Cost gradient from cheap (sequential) to most fidelity (literal-layout, +parser). Real-world data: most sessions are 1-pane; literal-layout matters most for the few 2+ pane cases.
2. **Live-capture vs always-disk.** Marker-branched (live `capture-pane` for hydrated panes, disk for skeletons) vs always-disk (single code path, ~1s staleness ceiling). Tradeoff: code simplicity vs liveness for active sessions.
3. **History depth.** Bounded snapshot (e.g. last viewport-height × N lines) vs scrollable into deeper history. F1 establishes that *bounded* is necessary for fast stepping; whether deeper history is reachable on demand (e.g. `r` to load full buffer, page-down extends) is design-phase.
4. **Stepping key inside preview.** Arrow up/down (Claude Code default) vs Tab/Shift-Tab vs j/k (vim-style) vs all of the above. No conflict because preview owns its keymap.
5. **List cursor sync vs no sync.** When stepping inside preview, does the underlying sessions-list cursor follow along (so Esc returns to last-previewed session) or stay where it started?
6. **Filter behaviour during preview.** Two distinct sub-questions: (a) once preview is open, in-preview stepping iterates filtered items only (recommended for `bubbles/list` consistency) or all items; (b) **load-bearing UX path** — the primary use case is "type filter to narrow to lookalikes → arrow to one → press Space". With `bubbles/list`'s default `SettingFilter()` true while filter is being typed, Space inserts a literal space into the filter text rather than opening preview. The user must commit the filter (Enter) or escape it (Esc) before Space works. Options: keep that behaviour (commit-then-preview), or wire Space-while-filtering to commit-and-open-preview in one step, or use a different key to open preview. Discussion-phase choice — not a feasibility unknown — but the primary use case lives directly on this fork.
7. **Refresh semantics.** Snapshot at preview-open and frozen vs manual `r` refresh vs live tail (poll `capture-pane` every Ns). Live tail adds tmux IPC churn and a polling timer.
8. **Brand-new-session edge case.** When `.bin` does not yet exist for a saved pane, what does preview render? Likely a "(no saved content)" placeholder; design-phase to define wording and whether to fall back to live capture (works only if the pane is hydrated).
9. **Privacy / threat model.** Scrollback can contain typed secrets (sudo prompts, pasted API keys, `.env` contents echoed by debug scripts, ssh keys). Preview is **the first portal surface that renders arbitrary captured pane bytes** in a UI — every other UI surface (sessions list, projects list, file browser) renders only metadata (names, paths). This is a qualitative shift in exposure surface, not just a UX shortcut over attach: today, surfacing a secret requires a *deliberate* attach + scroll; preview makes it 1-keypress-glanceable from the picker, which matters during screen-share, demos, pairing, OBS-recording. Worth design-phase consideration of: (a) opt-in/opt-out toggle, (b) a redaction layer for known secret patterns (API key prefixes, "password:" lines), (c) pure documentation. Not a feasibility blocker — but the consolidated stance "same threat surface as attaching" is asserted, not analysed; the right framing is *broader* threat surface than today, narrower than freely browsing files in the home directory.

---

## Verifiable Items Deferred to Implementation-Phase Spike

Items that should be checked during initial implementation but don't change the architectural picture:

- **Real alt-screen program capture.** Run `capture-pane -e -p -S -200` against a live Claude TUI session and inspect the bytes — confirms F8's behaviour on the actual primary use case. Trivial once a Claude session is available.
- **`viewport.SetContent` + real ANSI bytes.** End-to-end confirmation of F9 by feeding a real `.bin` file through a viewport in a Bubble Tea harness. Source-code analysis suggests no risks, but a 30-line spike removes residual uncertainty.

---

## Closed / Superseded Notes

- **Modal-overlay vs side-pane interaction shapes** — explored, both viable, user chose sub-page (locked in *Stated Feature Shape*).
- **Hook command as a metadata label** — explored as a way to "show registered hooks somehow"; user clarified the intent was that preview should show the *running session* (post-hook visual state via the captured bytes), not surface the hook command as a label. Dropped from scope.
- **Inbox idea — multi-pane explicitly deferred** — research initially treated multi-pane as deferred, then user elevated it during discussion. Now in scope per *Stated Feature Shape*.

---

## Source-Material Cross-References

- CLAUDE.md `## Architecture` § *Server bootstrap* — bootstrap step ordering (load-bearing).
- CLAUDE.md `## Architecture` § *Resume hooks* — hooks fire on hydrate (reboot recovery), not on every attach.
- `.workflows/scrollback-not-restored-with-non-zero-base-index/specification/...` — recent fix codifying "live indices, never predict" — same principle applies to per-pane capture targeting.
- `.workflows/tui-session-picker/specification/tui-session-picker/specification.md` — modal overlay infrastructure, page state machine, `bubbles/list` patterns. Preview reuses the page-state-machine extensibility, not the modal pattern.
