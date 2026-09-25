# Investigation: State Notify Cascade On Binary Upgrade

## Symptoms

### Problem Description

**Expected behavior:**
`portal state notify` should fire only on a genuine state-change event (e.g. when a marker like `save.requested` needs writing). An idle tmux server with no real churn should produce few-to-zero `state notify` invocations.

**Actual behavior:**
On 2026-06-02, between 20:35:29 and 20:42:24 BST (a ~7-minute observation window), `portal state notify` was invoked **2315 times**. Each invocation is a full short-lived process (~500µs): boot → three lifecycle markers (`process: start`, `process: log-level resolved`, `process: exit`) → exit. Rate profile:
- Initial ~53s burst at ~23/sec (first 1224 invocations)
- Then ~2–14/sec sustained for ~6 more minutes
- Ceased completely at **20:42:24.218**

Total window impact: ~6945 log lines, ~933 KB written to `portal.log.2026-06-02`. Average ~5.5/sec, peak ~23/sec.

### Manifestation

- Log spam: ~6945 lifecycle-marker lines from short-lived `state notify` processes.
- Write amplification on `portal.log` (~933 KB in 7 min).
- fork+exec overhead at multi-Hz; each invocation presumably touches tmux state → tmux server load.
- Suspected write amplification on whatever marker `state notify` writes (`save.requested`?), pressuring the daemon capture loop.

### The diagnostic key: the cascade STOPS at saver-recycle

At 20:42:21 the user ran `portal open` for the first time since the brew upgrade 0.5.12 → 0.6.0. The new 0.6.0 binary's bootstrap step 5 detected the saver-pane daemon still running 0.5.12 (PID 36689), executed Component A's kill-barrier, and Component F respawned the daemon as PID 36776 on 0.6.0.

- Final `state notify` invocation: **20:42:24.218** — 8ms *before* `daemon: lock acquired tmux_pane=%144 pid=36776`.
- From that instant on: **zero** `state notify` invocations, despite the new daemon running normal capture ticks every ~32s (`sessions=21 panes=23 natural_churn=0`).

**Interpretation:** the cascade is NOT tied to the upgrade moment or the recycle itself — the recycle is what *stops* it. The cascade was driven by something the OLD 0.5.12 daemon was doing, or by stacked tmux hooks the new bootstrap reset. It went silent the instant the 0.5.12 daemon died.

### Reproduction Steps

Not yet reproduced. Two candidate mechanisms imply two different repro strategies (see Initial Hypotheses). The old daemon's actual lifetime is unestablished — brew upgrade preceded `portal open` by ~5–10 min, so all that's claimed is the cascade was visible for ~7 min in the window. Pre-0.6.0 binaries had no `process:` markers, so earlier `state notify` spawns left no per-invocation trace; "running invisibly for hours" is plausible but not evidenced.

**Reproducibility:** Unknown / not yet reproduced.

### Environment

- **Affected environments:** local (developer machine), real tmux.
- **Binary versions:** cascade observed under 0.5.12 daemon; 0.6.0 daemon appears cascade-free in the ~3 min post-recycle idle window.
- **Platform:** macOS (darwin).

### Impact

- **Severity:** High. Sustained multi-Hz fork+exec + tmux load + log/marker write amplification. May correlate with the recurring `hooks-and-saver-vanish-after-recent-fixes` defect — if a high-rate notify cascade drives `save.requested` writes, the capture loop is under sustained pressure during the windows when wipes were observed.
- **Scope:** Any install where an old-binary daemon survives a long time before a recycle.
- **Whether it runs continuously while a 0.5.12 daemon is alive, or only in certain windows, cannot be determined from one 7-min observation.**

### References

- `portal.log.2026-06-02` — pins both the 2315-invocation window and post-recycle silence.

---

## Analysis

### Initial Hypotheses (from inbox)

1. **Daemon internal loop/feedback (version-specific):** the 0.5.12 daemon itself generated the notify invocations; the 0.6.0 daemon does not.
2. **Stacked tmux global hooks:** tmux global hooks were stacked such that a single tmux event fired many `state notify` invocations; bootstrap's `RegisterPortalHooks` reset the stack.

**Verdict after analysis: Hypothesis 1 is WRONG. Hypothesis 2 is RIGHT in spirit, with a precise and ongoing mechanism (below).**

### What the evidence actually shows (corrects the inbox)

Read directly from `~/.config/portal/state/portal.log.2026-06-02` (still on disk, 2.6 MB):

- **All cascade `state notify` processes are `version=0.6.0`, not 0.5.12.** The brew symlink to 0.6.0 was created at 20:35 — the cascade began 20:35:29, immediately after the upgrade. So the *new* binary drove it; the old daemon is exonerated. → kills Hypothesis 1.
- **The cascade did NOT stop at the 20:42:24 saver-recycle.** It went silent 20:42:24 → 20:48, then *resumed* and ran in bursts through 20:57. 6463 total notify invocations across 20:35→20:57. The inbox was written *during the 20:42–20:48 idle gap* and mistook a coincidental lull for a fix. → kills the inbox's central "recycle stops it" claim.
- **Inter-arrival within a burst is a near-perfect ~16.5 ms (≈60 Hz), dead regular.** Not human input, not organic tmux events — this is tmux dispatching a queue of identical jobs back-to-back.

### Code trace

`portal state notify` is **not** spawned by the daemon or any loop. It is the body of a **tmux global hook** registered on six "save-trigger" events (`internal/tmux/hooks_register.go`):

```
notifyCommand = run-shell "command -v portal >/dev/null 2>&1 && portal state notify"
saveTriggerEvents = session-created, session-closed, session-renamed,
                    window-linked, window-unlinked, window-layout-changed, pane-focus-out
```

(`session-closed` is migrated to `commit-now`, leaving 6 events carrying `notify`.)

`state notify` itself only touches the `save.requested` marker file and does **zero** tmux calls (`cmd/state_notify.go`), and `state` is in `skipTmuxCheck` (`cmd/root.go`) so notify does **not** run bootstrap — the cascade is therefore **not self-amplifying** through notify.

Registration is meant to be idempotent via `RegisterHookIfAbsent` (`internal/tmux/hooks_register.go:149`): it calls `ShowGlobalHooks()` → `tmux show-hooks -g` (`internal/tmux/tmux.go:769`), parses it with `ParseShowHooks`, and skips the append if any existing entry on that event already contains `portal state notify`.

### Live hook state — the smoking gun

`tmux show-hooks -g <event>` on the live server:

| event | live entry count |
|-------|------------------|
| session-created | 1 |
| session-renamed | 1 |
| window-linked | 1 |
| window-unlinked | 1 |
| **pane-focus-out** | **139** |
| **window-layout-changed** | **139** |

Exactly the two highest-frequency events have **139 stacked identical `portal state notify` hooks** each. So a *single* `pane-focus-out` (the user switching tmux sessions — each session has one window/one pane, so session-switch = focus-out) makes tmux run all 139 stacked hooks back-to-back → a burst of 139 fork+exec `state notify` processes at ~16 ms spacing. That is the "60 Hz cascade." One human action → 139 processes.

### Root Cause

**tmux 3.6b's `show-hooks -g` (no event argument) does not enumerate `pane-focus-out` or `window-layout-changed` global hooks, even though they are set and fire normally. Portal's `RegisterHookIfAbsent` dedup relies *solely* on that global enumeration, so for these two events it never sees the existing entry, concludes "absent", and appends another copy on every bootstrap — unbounded.**

Proven in an isolated throwaway tmux server (`tmux -L <sock>`):

- `show-hooks -g pane-focus-out` → shows the entry; `show-hooks -g` (no arg) → omits it (`grep -c` = 0).
- `show-hooks -g session-created` → shown by both forms.
- Running Portal's exact append-if-absent logic 5×: `pane-focus-out` grew 1 → **6** (stacked every iteration); `session-created` stayed **1** (dedup worked).

So the stacking is monotonic: every `portal open` / `x` / attach (each runs bootstrap → step 2 RegisterPortalHooks) adds **+1** to each of the two blind events. 139 entries ≈ 139 bootstrap-running invocations over the binary's life. It is still growing and will keep growing until fixed.

### Why It Wasn't Caught

- **The flaw was baked in at design time.** The `built-in-session-resurrection` spec's *"Content-Based Idempotency (per-event, per-command)"* section mandates the dedup oracle as: "1. Run `tmux show-hooks -g` and capture stdout … 5. If none match → `set-hook -ga` append." It assumed the global `show-hooks -g` returns *all* Portal entries — true for the session/window-linked events it was reasoned about, false for pane/window-scoped events. The same spec deliberately chose `-ga` (append) over `-g` (replace) "to coexist with user `.tmux.conf` hooks" — which is exactly why the self-healing fix must scope eviction to Portal-authored bodies, not blanket-replace.
- **Idempotency was verified only against the events `show-hooks -g` *does* enumerate.** Unit tests use a fake/parsed-string commander or a tmux fixture where `show-hooks -g` returns all events; the real tmux 3.6b global-enumeration blind spot for pane/window-scoped hooks was never modelled. (`feedback_inbox_not_facts` — the inbox's own hypotheses had to be validated, not trusted.)
- **No upper-bound assertion on hook-array length** anywhere — stacking is silent.
- **`state notify` cost is individually invisible** (~500 µs, exits 0); only the aggregate rate is pathological, and pre-0.6.0 builds had no per-process `process:` markers, so the cascade left no trace before observability landed.

**KB corroboration (contextual query):** the `scrollback-not-restored-with-non-zero-base-index` spec already prescribes a **real-tmux socket fixture** (`internal/tmuxtest`) for the `RegisterPortalHooks` migration test, precisely because "the eviction logic depends on the precise format of `show-hooks` output and `set-hook -gu` index semantics, both of which a mock would have to re-implement to be faithful." That guidance is exactly what this bug demands — it confirms the testing recommendation below.

### Blast Radius

**Directly affected:**
- Every install on tmux ≥ (whatever version exhibits the `show-hooks -g` blind spot — at least 3.6b). Hook count on `pane-focus-out` / `window-layout-changed` grows by 2 per `portal open` forever.
- Each session-switch / layout change → N× `state notify` fork+exec + N× `save.requested` touch + N× tmux job dispatch + ~3N log lines.

**The existing teardown path is broken by the SAME blind spot (validated):**
- `UnregisterPortalHooks` (`internal/tmux/hooks_unregister.go:64-89`) also reads via `c.ShowGlobalHooks()` (no-arg `show-hooks -g`) and iterates `ParseShowHooks(raw)[event]`. For the two blind events that slice is empty, so it sees **zero** Portal entries on the 139-deep arrays and removes nothing. `portal hooks reset` / any `UnregisterPortalHooks` consumer **cannot currently undo this bug.** Independently reproduced (3 stacked → global enumeration shows 0 → per-index `set-hook -gu 'pane-focus-out[N]'` does clear them).
- **Consequence for the fix:** the mandatory cleanup migration must NOT reuse the global-enumeration path — it would inherit the blind spot and silently no-op. Per-event enumeration (`show-hooks -g <event>`) is the safe primitive for **both** dedup and cleanup. Reverse-index unset (already the pattern in `hooks_unregister.go`) is needed to reap at depth 139.

**Potentially affected:**
- `hooks-and-saver-vanish-after-recent-fixes` (open inbox bug) — a high-rate `save.requested` write storm puts the daemon capture loop under sustained pressure exactly when the wipes were observed. Plausible common cause; worth cross-checking. (Cross-link is a *lead*, not a confirmed finding — no code traced for the capture-loop-pressure chain.)
- Any other Portal hook registered on a pane/window-scoped event via the same `RegisterHookIfAbsent` path would stack the same way (currently only these two qualify).

### Resolved: the blind-spot event class (was an open question)

Probed on an isolated tmux 3.6b server — events that `set` successfully but are **omitted** from global `show-hooks -g`: all `pane-*` (`pane-focus-in/out`, `pane-died`, `pane-exited`, `pane-set-clipboard`, `pane-mode-changed`) and the geometry/rename `window-*` (`window-layout-changed`, `window-pane-changed`, `window-renamed`, `window-resized`). **Enumerated (safe):** all `session-*`, `window-linked`, `window-unlinked`, all `client-*`, all `alert-*`. So Portal's `saveTriggerEvents` contains exactly two blind events; the hydration events (`client-attached`, `client-session-changed`) and `session-closed` are all enumerated → genuinely at 1. The regression test should model this exact tmux 3.6b shape.

---

## Fix Direction

_High-level only — implementation belongs to the spec._

### Chosen Approach: per-event, declarative "ensure exactly one" registration

Make Portal stop depending on tmux's global hook view entirely. Read hooks **per-event** (`show-hooks -g <event>`), uniformly for *every* Portal-managed event — and **delete the global `show-hooks -g` read** (`ShowGlobalHooks`). Registration becomes declarative: for each event, read that event's entries, find the Portal-authored ones for its category, and converge to exactly one of the current desired body (unset all matching in reverse index order, then append one). The 139-deep stacks collapse to 1 as an intrinsic side effect of normal registration — no dedicated run-once cleanup code.

**Deciding factor:** doing the feature correctly (declarative, version-robust, single code path) fixes the bug AND the existing mess in one shape, with nothing that ever has to be removed. The cleanup is a *bonus*, not the goal.

Concrete shape (confirmed against the code):
- **New seam:** `ShowGlobalHooksForEvent(event)` → `show-hooks -g <event>`. Output format is identical to the global form, so **`ParseShowHooks` needs zero changes** (verified live: `pane-focus-out[0] run-shell "…"`).
- **Reuses existing, tested primitives:** `portalEntriesFor` + `containsAny` (`portalCommandSubstrings`) for Portal-only matching; reverse-index `UnsetGlobalHookAt`; `AppendGlobalHook`. The eviction half already exists in `UnregisterPortalHooks`.
- **`UnregisterPortalHooks` moves to the same per-event seam** so `portal hooks reset` stops being blind too (it shares the identical defect today).
- **Likely net code removal:** a general per-event ensure-exactly-one may subsume the bespoke `migrateHydrationHooks` and `migrateSessionClosedHook` — they exist only because append-if-absent couldn't self-heal. To confirm in spec.

### Options Explored

- **(a) Dedup fix only + rely on tmux-server restart for cleanup.** Ship the per-event dedup, ship no cleanup; existing stacks clear when the server next restarts (cheap because Portal resurrects sessions). *Not chosen as the framing* — but its spirit is honoured: we don't ship dedicated cleanup code. The self-healing approach gives the cleanup for free, so we get (a)'s "no removable cruft" property AND immediate convergence.
- **(b) Self-healing per-event registration.** **Chosen.** Cleanup is intrinsic, not bolted on.
- **Per-event reads only for the two known-blind events (keep global for the rest).** *Rejected.* The blind set is tmux-version-specific (observed in 3.6b); a maintained "these events are blind" list re-introduces the exact hidden-coupling assumption that caused this bug, and would silently regress if a future tmux hides a different event. Uniform per-event removes the assumption entirely at negligible cost.
- **Dedicated run-once cleanup migration.** *Rejected.* Classic accretion trap — code you add, can never safely remove (a user upgrading from a very old build still needs it), and that runs once then sits forever. Self-healing registration makes it unnecessary.

### Discussion

User priorities, in order: (1) implement the feature *correctly* at the code level; (2) avoid permanent run-once cruft; (3) cleanup is a welcome bonus, not a driver. Key journey points:
- The inbox's framing (0.5.12 daemon loop; recycle fixes it) was overturned by the log: every cascade process is `version=0.6.0`, the cascade resumed after the recycle, and the inbox was written during a coincidental idle gap.
- The diagnosis was confirmed **live with a pre-registered prediction**: one `portal open` took `pane-focus-out`/`window-layout-changed` from 139→140 while the `session-created` control stayed at 1. Clean negative control, no ambiguity.
- User raised the run-once-code accretion concern and noted resurrection makes a server restart cheap (with the honest caveat that resurrection restores layout/scrollback/resume-hooks, not live in-pane process state). This steered us away from a dedicated migration and toward self-healing.
- On "every event or just the blind ones": settled on uniform per-event because special-casing the blind set is the same brittle-assumption smell that caused the bug.

### Testing Recommendations

- Real-tmux integration test (`tmuxtest` socket fixtures): the bug is a tmux-output-*shape* issue invisible to string-fixture commanders. Assert that across N bootstraps every Portal hook array stays at exactly 1 — specifically on `pane-focus-out` / `window-layout-changed`, the events a global read can't see.
- Regression guard modelling the tmux 3.6b reality: `show-hooks -g` (global) omits pane-scoped + geometry/rename window-scoped events while `show-hooks -g <event>` includes them.
- Self-heal assertion: seed an event with K stacked Portal entries, run one registration, assert it collapses to 1 and leaves a co-resident user-authored hook on the same event untouched.
- `portal hooks reset` (UnregisterPortalHooks) test: with stacked entries on the blind events, assert removal actually reaps them (today it no-ops).

### Risk Assessment

- **Fix complexity:** Low. One new one-line seam; registration/unregistration reuse primitives that already exist; the parser is unchanged.
- **Regression risk:** Low–Medium. The eviction predicate must match only Portal-authored bodies (existing `portalCommandSubstrings` discipline) so user hooks on `pane-focus-out` / `window-layout-changed` survive. If the migration helpers are folded in, verify the `--` signal-hydrate and `session-closed`→commit-now transitions still converge.
- **Recommended approach:** Regular release. No dedicated data migration; existing stacks self-collapse on the next bootstrap after upgrade.

---

## Notes

- The 0.6.0 daemon (post-recycle) looked "cascade-free" in the inbox only because the observation window happened to contain no session-switches; the stacked hooks were untouched by the recycle.
- The open question ("is the blind spot just these two events or a whole class?") is **resolved** — see "Resolved: the blind-spot event class" under Analysis.

### Mechanical distinction: switching *fires*, `portal open` *adds*

A load-bearing clarification surfaced during the live session:
- **Switching tmux sessions** fires `pane-focus-out` → runs the N stacked hooks → **does not change N.** This is what generates the cascade (the notify count explodes).
- **`portal open` / `x` / attach** runs bootstrap → step 2 registration → **adds +1 to each blind event** (N grows). Session-switching alone never grows the stack.

This is why the live depth held at 139 while the notify count climbed from ~6,500 to ~11,000 during the discussion (lots of switching, no new `open`).

### Live measurements (investigation session, 2026-06-02)

Read from the live tmux server and `portal.log.2026-06-02` while diagnosing:
- Live stacked depth: `pane-focus-out` = 139, `window-layout-changed` = 139, all four control events = 1.
- **Pre-registered live confirmation:** one `portal open` → both blind events 139 → **140**, `session-created` control stayed **1**, `portal open` log count 2 → 3. Diagnosis proven with a clean negative control.
- Cascade is **actively ongoing**: 11,190 `state notify` invocations logged on 2026-06-02 (latest 21:41:03, essentially live), log ~34,000 lines. ~11,190 ÷ 139 ≈ **~80 session-switches** today, each detonating 139 processes.
- This supersedes the inbox's "2315 in ~7 min / ceased at 20:42:24" — the cascade never ceased; the inbox observed a coincidental idle gap.

### Suspected real-world symptom (lead, not confirmed)

User reports tmux occasionally pegging a core at ~98% CPU. Mechanically consistent: each focus/layout event funnels 139 `run-shell` fork+exec+reap jobs through the single-threaded tmux **server** process. Rapid switching could plausibly saturate it; deeper stacks make every switch worse. Not traced to proof — recorded as a strong lead.
