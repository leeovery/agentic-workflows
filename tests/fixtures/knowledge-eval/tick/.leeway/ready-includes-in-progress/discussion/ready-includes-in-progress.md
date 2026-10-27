# Discussion: Ready Includes In-Progress

## Context

`tick ready` surfaces the next actionable tasks to answer "what should I be doing right now?". Today it returns only tasks with `status = 'open'` that are unblocked — it skips tasks already in `in_progress`. The result: you start a task, get interrupted, and when you run `tick ready` to resume it points you at *new* open work instead of the started-but-dangling task. The interrupted task becomes invisible to the very command meant to orient you.

The intuition from the seed: "ready" should mean "work available and unblocked to act on right now," and a task you've already started is arguably the *most* ready thing there is. Including in-progress items would close the loop so resuming interrupted work is the natural default.

Two things must be settled before spec/code:
- **Semantics** — should `ready` include `in_progress` at all, and how does that reconcile with `ready` also serving the "what new work can I pull?" question?
- **Presentation** — should in-progress items appear inline, be sorted to the top, or be visually distinguished as resumptions vs fresh starts?

A hard constraint: `blocked` is currently defined as the De Morgan inverse of `ready`'s `NOT EXISTS` conditions (`query_helpers.go`), so any change to "ready" must keep "blocked" consistent.

### Current State (code)

- `ReadyConditions()` = `t.status = 'open'` AND no unclosed blockers AND no open/in-progress children AND no dependency-blocked ancestor.
- `BlockedConditions()` = `t.status = 'open'` AND (has unclosed blocker OR has open/in-progress child OR has blocked ancestor) — the inverse `EXISTS` set, sharing the `status = 'open'` gate.
- **Key wrinkle:** both `ready` and `blocked` require `status = 'open'`. An `in_progress` task is therefore currently *neither* ready nor blocked.
- Sort order: `ORDER BY t.priority ASC, t.created ASC` (shared by all list-family queries).
- `ReadyWhereClause()` also feeds the `stats` ready count.

### References

- [Seed: tick ready should include in-progress work](../seeds/2026-06-02-ready-includes-in-progress.md)
- [Discovery session 001](../discovery/session-001.md)
- `internal/cli/query_helpers.go` — `ReadyConditions()` / `BlockedConditions()`
- `internal/cli/list.go:262` — `buildListQuery` (sort, filters)
- `internal/cli/stats.go:79` — ready count consumer

## Discussion Map

### States

- **pending** (`○`) — identified but not yet explored
- **exploring** (`◐`) — actively being discussed
- **converging** (`→`) — narrowing toward a decision
- **decided** (`✓`) — decision reached with rationale documented

### Map

  Discussion Map — Ready Includes In-Progress (6 subtopics — 6 decided)

  ┌─ ✓ Ready semantics: does in-progress belong? [decided]
  ├─ ✓ Blocked consistency under the new definition [decided]
  ├─ ✓ Hierarchy & the leaf gate under in-progress [decided]
  ├─ ✓ Sort ordering (resume-first vs priority) [decided]
  ├─ ✓ Presentation of in-progress in ready output [decided]
  └─ ✓ Edge cases & scope (filters, stats, --count) [decided]

---

*Subtopics are documented below as they reach `decided` or accumulate enough exploration to capture.*

---

## Ready Semantics: Does In-Progress Belong?

### Context

`tick ready` answers "what should I act on right now?". Today both `ready` and `blocked` gate on `status = 'open'`, so an `in_progress` task is in *neither* view — invisible to the very command you'd use to resume interrupted work. That invisibility is the gap. The question is whether `in_progress` belongs in `ready` at all, and the answer turns out to hinge on tick's actor model.

### Options Considered

**Option A — Single-actor / resumption model.** `in_progress` = "the task *I* started and got pulled off." Surfacing it in `ready` means "resume this." `ready` becomes "everything actionable right now" = unblocked `open` **+** `in_progress`.
- Pros: closes the resumption gap directly; matches the everyday use of `ready` ("where was I / what's next").
- Cons: dilutes the secondary "what *new* work can I pull?" reading of `ready` (started work mixes with fresh-start candidates).

**Option B — Multi-actor / claim model.** `in_progress` = "someone already took it, hands off." Then it's *not* ready for me, and showing it risks two actors colliding on one task. `in_progress` would be *excluded* from `ready` (a soft lock) — stronger than today.
- Pros: prevents collision in a concurrent team setting.
- Cons: tick has **no assignee field** — `in_progress` cannot distinguish *my* interrupted work from *someone else's* claimed work. So exclusion also kills my own resumptions; it's a crude proxy for ownership.

### Journey

Initial lean was Option A (the seed's framing). The user raised the sharp counter: if a task is "taken by another developer," it's being handled — not ready — so it shouldn't appear. That's a genuinely different worldview, and it gives the *opposite* answer.

The resolver: tick has no ownership concept. Task carries Title/Status/Priority/Parent/Deps/Type/Tags/Refs/Notes/Transitions — nothing about *who*. The whole design reads single-actor: cascades assume one will (starting one task drives the whole ancestor chain to `in_progress`), and there's no claim/lease/lock-by-owner machinery. The multi-actor collision problem is real, but its correct fix is an **assignee + claim** mechanism, not "exclude all `in_progress`." Excluding `in_progress` to dodge collisions can't tell *my* work from *theirs*, so it breaks the single-actor case to half-serve a model tick doesn't yet implement.

The "aha": the multi-actor concern doesn't argue *against* this feature — it points at a *future* feature. Once an assignee field exists, the right rule is **"`ready` excludes tasks assigned to others"** — precise, collision-safe, and it preserves resumption of your own work. That reframing satisfied the user's concern without compromising the decision here.

### Decision

**Include `in_progress` in `ready`.** Decide for the tool tick is today: single-actor, no ownership → `ready` = "everything actionable now" = unblocked `open` + `in_progress`.

- **Deciding factor:** no assignee field exists, so the multi-actor exclusion argument can't be implemented correctly anyway; the single-actor resumption case is the real, present need.
- **Trade-off accepted:** the "pull only new work" reading of `ready` is diluted; anyone wanting strictly unstarted work can use `tick ready --status open` (see Edge Cases → decision 3; this supersedes the `tick list --status open` phrasing first floated here, which wouldn't apply the ready blocker/leaf/ancestor filtering).
- **Future path (noted, out of scope):** if/when multi-actor claiming is pursued, add an assignee field and make `ready` exclude tasks assigned to *others* — revisit then, but do **not** solve it now by excluding all `in_progress`.
- **Confidence:** high.

---

## Blocked Consistency Under The New Definition

### Context

`blocked` is the De Morgan inverse of `ready` in the code: `BlockedConditions()` negates each `ReadyNo*()` helper and ORs them, sharing the *same* `t.status = 'open'` literal as the gate. Today that means `ready` and `blocked` partition the `open` set, and `in_progress`/`done`/`cancelled` are in neither. Now that `ready` admits `in_progress`, we must decide what `blocked`'s status gate does — and whether the partition survives. (This is the discussion's stated hard constraint, and the load-bearing gap flagged by the first review's F1/F7.)

### Options Considered

**Option A — Symmetric.** `blocked` gates on `(open OR in_progress)`, identical to `ready`. The two stay strict De Morgan complements, now over the *live* (non-terminal) set instead of just `open`.
- Pros: closes the invisibility hole completely (a started-but-stuck task lands in `blocked` instead of vanishing); preserves the clean inverse; minimal code change (flip one shared literal).
- Cons: an `in_progress` task can be labeled "blocked" — semantically loose for a started task, but defensible (it genuinely can't proceed).

**Option B — Asymmetric.** `ready` admits `in_progress`; `blocked` stays `open`-only.
- Cons: breaks the complement (no longer a partition; code needs special-casing) and **reopens the exact hole** — an `in_progress` task with an open child or an unclosed blocker would be in *neither* view. Common case (start a parent, then add subtasks) goes invisible.

**Option C — "blocked = can't even start."** Once started, a task is past "blocked," so `in_progress` is never blocked. Same invisibility problem as B for started-but-stuck work.

### Journey

The user chose A immediately and articulated the governing semantic crisply: a task that's blocked *stays* blocked even if you force-start it. You can always look a task up and start it directly (starting isn't gated by blockers) — but ignoring the fact that `ready` never offered it doesn't change its nature. It was blocked; now it's blocked-and-in-progress; it still reports as blocked.

The user's verification question — "a blocked-in-progress task won't *also* show as ready, will it?" — is the crux of why A is clean. Answer: **no, never.** Because A keeps `ready` and `blocked` sharing one identical status gate, `blocked` is the exact logical negation of `ready`'s three `NOT EXISTS` conditions. Over the live set, every task is *exactly one* of ready/blocked — mutual exclusivity and exhaustiveness both hold. The blocked-in-progress task fails the ready test and surfaces only in `tick blocked`.

### Decision

**Option A — keep `ready` and `blocked` as strict complements.** Both gate on `status IN ('open','in_progress')`; `blocked` remains the De Morgan inverse.

- **Invariant:** `ready ⊎ blocked = all live tasks` (open + in_progress). Never both, never neither, for any live task. `done`/`cancelled` are in neither.
- **Force-started blocked task:** shows in `tick blocked` only, never `tick ready`. Starting a task does not clear its block.
- **Implementation shape (captured, not a plan):** the shared `t.status = 'open'` literal in *both* `ReadyConditions()` and `BlockedConditions()` becomes `t.status IN ('open','in_progress')`. The `negateNotExists` / inverse machinery is untouched — the symmetry is exactly why this is a one-line-per-side change. The fact that the gate is a single shared string is evidence A is the option the code "wants."
- **Verified (state machine):** the `start` transition (`state_machine.go:21`) constrains only `from: StatusOpen` — there is no blocker check anywhere in the state machine. So an open task with unclosed blockers can be force-started into `in_progress` (becoming blocked-and-in-progress). Blockers are purely a query-time concept, not a transition guard. (Resolves the deferred confirmation; the "force-start a blocked task" scenario this subtopic relies on is real.)
- **Confidence:** high.

This resolves review F1 (De Morgan reconciliation) and F7 (in-progress + unclosed blocker → blocked).

---

## Hierarchy & The Leaf Gate Under In-Progress

### Context

Raised by review F2/F6. Does admitting `in_progress` into `ready` disturb how the parent/child hierarchy surfaces — in particular, does an `in_progress` parent (created by the start-cascade) show alongside its `in_progress` leaf?

### Journey

The user initially framed it as "if a child is ready, the parent's ready," then doubted it ("my feeling is it wouldn't show"). The doubt was correct — it's the *inverse*. The leaf-only rule (`ReadyNoOpenChildren`) excludes any task with a child in `('open','in_progress')`:

- A parent with a *ready* (open, unblocked) child does **not** appear in `ready`; the ready child is precisely why the parent is held back. The parent instead appears in `blocked` (it "has an open child" → a blocked condition).
- Parent and child therefore **never co-occur in `ready`**. Only the leaf is ready; the parent surfaces later, once all children go terminal.
- `--count 1` can only return a leaf, because the parent is never a `ready` *candidate* to begin with — it can't win the slot.

Admitting `in_progress` extends this symmetrically: the `in_progress` leaf surfaces (the live work); its cascaded `in_progress` parent is gated out by the same rule and shows in `blocked`. Nothing about the existing child/ancestor `NOT EXISTS` conditions needs to change — they already express "exclude non-leaf candidates" regardless of whether the candidate row is `open` or `in_progress`.

### Decision

**Keep the leaf-only rule unchanged.** `in_progress` is a symmetric extension; `ReadyNoOpenChildren` and the ancestor condition are untouched. An `in_progress` parent that exists only because of an `in_progress` child does *not* surface in `ready` — only the leaf does. Resolves F2/F6.

- **Confidence:** high (confirms existing, tested behaviour). Provisional only in that it assumes the user does *not* want `in_progress` parents surfaced — they leaned that way; reopen if that changes.

---

## Sort Ordering (Resume-First Vs Priority)

### Context

`buildListQuery` applies one shared `ORDER BY priority ASC, created ASC` to `list`, `ready`, and `blocked`. Once `in_progress` joins the `ready` pool, where should it rank? The feature's premise — "a started task is the *most* ready thing" — argues started work should lead.

### Options Considered

1. **No special treatment** — `in_progress` sorts by priority alongside `open`. Simplest, but half-defeats the feature: a fresh P1 outranks your started P3, and `--count 1` could hand you new work while something sits half-done.
2. **Resume-first** — `in_progress` floats to the top as a band, then `priority ASC, created ASC` within. `--count 1` returns *unblocked* in-flight work first if any exists. Risk: a trivial started task outranks an urgent fresh P1.
3. **Priority-first, started as tiebreaker** — priority stays master key; within a priority band, started shows first. Urgent new work never buried, but a low-priority resumption won't surface as a prompt.

### Journey

The user chose **2** and articulated why it loses nothing: "what's *next* to start" is simply the `open` tasks beneath the started band, still priority-ordered — so resume-first adds the resumption signal without sacrificing the priority view. `--count 1` returning the in-flight task is the desired behaviour, not a side effect.

**Important qualifier (set-002 review F5):** "resume-first" applies only to *actionable* (unblocked) in-flight work. An `in_progress` task that is itself blocked — by a direct blocker or, more subtly, by a blocked *ancestor* (`ReadyNoBlockedAncestor` fails) — is **not** in `ready` at all; by the partition invariant it lives in `tick blocked`. This is correct, not a gap: blocked is blocked regardless of status (that was the explicit blocked-consistency decision). So the precise promise is "`--count 1` returns the top **unblocked** in-flight task," and blocked-but-started work surfaces in `tick blocked`. Force-starting a blocked task does not float it into `ready`.

A scope fork surfaced from the code: the `ORDER BY` is shared across the whole list family, so resume-first forces a choice between **`ready`-only** and **all of `list`/`ready`/`blocked`**. The user chose `ready`-only decisively: `tick list` is a neutral browse view where silently floating started work would be surprising, and `tick blocked` gains nothing from it. The ordering is a property of `ready`'s "what now?" intent, not a global sort change.

### Decision

**Option 2, `ready`-only.** In the `ready` query, `in_progress` floats to the top as a band; within the band (and within the `open` tasks beneath it) the existing `priority ASC, created ASC` holds. `list` and `blocked` keep the current ordering unchanged.

- **Implementation shape (captured, not a plan):** the `ORDER BY` in `buildListQuery` (`list.go`) becomes conditional — when `f.Ready`, prepend a status-priority term (e.g. `ORDER BY (t.status = 'in_progress') DESC, t.priority ASC, t.created ASC`); otherwise the current clause. `--count` then naturally yields in-flight work first.
- **Scope = the ready *filter* (`f.Ready`), not a literal command.** Verified: `tick ready` is a literal alias — it dispatches as `parseListFlags(append([]string{"--ready"}, subArgs...))` → the same `RunList` (`app.go:217`). So `f.Ready` is set identically by `tick ready` and `tick list --ready`, and the float applies to both — correct, since they're the *same* ready view. Plain `tick list` and `tick list --blocked` never set `f.Ready`, so they keep neutral ordering. "Ready-only" therefore means *ready-view-only*, keyed on `f.Ready`. Resolves review F1 (set 002).
- **Within-band tiebreak:** `priority ASC, created ASC` — simple and consistent. A "most-recently-started first" variant via transition history is possible but is gold-plating; not adopted.
- **Accepted consequence:** users with several `in_progress` tasks see a resumption-heavy `ready`. Treated as desirable (nudges finishing WIP), not a defect.
- **Confidence:** high.

Resolves the sort-ordering portion of review F3.

---

## Presentation Of In-Progress In Ready Output

### Context

The seed flagged presentation as a thing to settle: should `in_progress` items appear inline, sorted to the top, or be *visually distinguished* as resumptions vs fresh starts? The sort decision already settled "sorted to the top"; this subtopic is the remaining "visually distinguished?" question.

### Options Considered

- **A — Nothing extra.** Rely on the existing **Status column** (`ready` output is ID, Status, Priority, Type, Title) plus the top-sort. Distinction exists for free in toon, pretty, and JSON.
- **B — Pretty-only cue.** A marker/styling on `in_progress` rows in the human `pretty` format; toon/JSON untouched.
- **C — Sectioning** ("In progress" / "Ready to start" headers). Argued *against*: harmful for the machine formats — toon is the agent default, JSON is consumed programmatically, both keyed off the `status` field. Headers are noise/parsing-hazard there.

### Decision

**Option A — no presentation change.** The two signals that answer "which are resumptions?" — the `status` value and the top-of-list position — are already present in every format. For the primary consumer (an agent reading toon/JSON) it's fully machine-distinguishable with zero change; for a human on `pretty`, the Status column already reads `in_progress`. Anything more is polish in search of a problem for this feature. C is explicitly rejected (breaks machine formats).

- **Confidence:** high. (B remains a trivial future polish if a human-ergonomics need ever appears; out of scope now.)

---

## Edge Cases & Scope (Filters, Stats, --count)

### Context

Verifying the consequences of the ready/blocked definition change beyond the two query helpers themselves. Raised partly by review F4 (stats count) and F5 (status-filter interaction); `--count` folded in.

### Decisions

**1 — `stats` blocked count derivation (required fix).** `stats.go:85` computes `Blocked = Open − Ready`. This is only correct while `ready ⊆ open`. Once `ready` counts `in_progress`, `Ready` can exceed `Open` and the blocked count goes wrong (e.g. 5 open/3 ready + 4 in_progress/3 ready → `Ready = 6`, `Open = 5`, `Blocked = −1`). The derivation must move to the live set, following the partition invariant: **`Blocked = (Open + InProgress) − Ready`**. The **arithmetic route is canonical** — it reuses counts `stats` already gathers and is exactly how blocked is derived today (`Open − Ready`); the partition invariant guarantees its correctness. (A direct count via a *new* `BlockedWhereClause` is possible but is net-new query-helper surface — `query_helpers.go` exposes `ReadyWhereClause()` but no blocked counterpart, only `BlockedConditions()` — and is more robust only if the shared-gate invariant were ever broken. Not adopted; arithmetic preferred. Resolves review F3, set 002.) Not optional — a correctness consequence of the feature.

**2 — `stats` ready count tracks the new semantics (intended).** It uses `ReadyWhereClause`, so it includes `in_progress` automatically — which is correct: the stats "ready" number must mean the same as `tick ready`. An `in_progress` task counted in both `InProgress` and `Ready` is fine — two lenses (status breakdown vs actionability), exactly as an open-ready task is already counted in both `Open` and `Ready`. The stale comment at `stats.go:78` should be refreshed.

**3 — `--status` composes cleanly (no work, and a better escape hatch).** `--status` is a valid `ready` flag (inherited from `list`). `tick ready --status open` → `status IN (open,in_progress) AND status = open` → **unstarted ready work**; `tick ready --status in_progress` → **resumptions only**. This is the canonical "I only want new work" query and *supersedes* the earlier `tick list --status open` suggestion (which wouldn't apply the blocker/leaf/ancestor filtering). Resolves F5.
  - *Terminal statuses compose to empty (accepted).* `tick ready --status done` and `--status cancelled` become `status IN (open,in_progress) AND status = <terminal>` — always false, so they return a silent empty list. Accepted as-is: consistent with filter semantics everywhere (an empty intersection returns empty; tick doesn't reject contradictory filter combinations). No special validation. Resolves review F2 (set 002).

**4 — `--count`.** No special handling — `LIMIT` applies after the resume-first `ORDER BY`, so `--count 1` returns the top *unblocked* in-flight task (blocked-but-started work is in `tick blocked`, not `ready` — see set-002 F5 qualifier). Resolves the `--count` portion.

- **Confidence:** high. Resolves set-001 review F4 (stats) and F5 (status filter).

### Test Impact (set-002 review F4)

The SQL diff is small; the **test-update surface is the larger part of the work** and must be sized in the spec, not discovered at implementation. Concrete inventory (verified against the test files):

**Tests that assert the OLD semantics and MUST change:**

- `query_helpers_test.go` — `"ReadyConditions returns status open plus all four conditions"` and `"BlockedConditions contains no SQL literals beyond status check"` both assert `conditions[0] == "t.status = 'open'"`. The gate becomes `t.status IN ('open','in_progress')`; both assertions update.
- `ready_test.go` — `"it excludes in_progress tasks"` (line ~204) **inverts**: an unblocked `in_progress` leaf must now *appear* in `ready`. Rewrite, don't delete.
- `blocked_test.go` — `"it excludes in_progress tasks from output"` (line ~126, rationale "only open") is now misleading: a lone *unblocked* `in_progress` task is still absent from `blocked`, but because it's *ready*, not because `in_progress` is excluded. Update rationale; the assertion as written may still pass for the wrong reason.
- `stats_test.go` — `"it counts ready and blocked tasks correctly"` (line ~74) explicitly encodes `in_progress => neither ready nor blocked (not open)` and fixes Ready=2/Blocked=2. Under the new semantics the unblocked `in_progress` task becomes ready, so the expected counts change, and this test is where the `Blocked = (Open + InProgress) − Ready` derivation gets exercised.

**Tests that stay valid (KEEP, no change):**

- `ready_test.go` — `"excludes task with in_progress blocker"`, `"excludes parent with in_progress children"` (leaf/blocker rules unchanged).
- `blocked_test.go` — blocked-by-open/in_progress dep, parent with open/in_progress children, blocked-ancestor cases.
- `list_filter_test.go` — `--status open/in_progress/done/cancelled` filter tests; `commandFlags` drift test (no new flags added).
- `stats_test.go` formatting tests (run with `InProgress=0`, so semantics don't bite).

**New tests to ADD:**

- resume-first ordering on `ready` with mixed `in_progress`/`open` (float above open regardless of priority; within band `priority, created`).
- an unblocked `in_progress` leaf appears in `ready`; a *blocked* `in_progress` task appears in `blocked`.
- `stats` counts with `in_progress` ready/blocked tasks present (exercises the new derivation).
- `tick ready --status open` (unstarted ready) and `--status in_progress` (resumptions only) composition.
- `tick list --ready` floats `in_progress` identically to `tick ready` (locks the `f.Ready` scope decision / set-002 F1).

Also non-test: refresh the stale `stats.go:78` comment.

---

## Summary

### Key Insights

1. **The real gap was double invisibility.** Because both `ready` and `blocked` gated on `status = 'open'`, an `in_progress` task was in *neither* view. The feature isn't "add in-progress to ready" so much as "stop dropping in-progress work on the floor."
2. **Ready and blocked are one partition, not two queries.** They must share an identical status gate; `blocked` is the literal De Morgan inverse of `ready`. The governing invariant — `ready ⊎ blocked = all live (non-terminal) tasks` — is what makes the change small (flip one shared literal) and guarantees no task is ever in both or neither.
3. **"Resume-first" is a property of `ready`'s intent, not a global sort.** Only `ready` answers "what now?", so only `ready` floats `in_progress`; `list`/`blocked` keep priority order.
4. **Multi-actor is a different feature.** The "someone else took it" concern is real but needs an *assignee* field; the right future rule is "`ready` excludes tasks assigned to others," never "exclude all `in_progress`."
5. **Derived counts are the hidden hazard.** `stats.Blocked = Open − Ready` silently breaks once `ready` spans two statuses — the kind of consequence that hides one layer below the headline change.

### Open Threads

- **Multi-actor / assignee model** (future, out of scope): add an assignee field; make `ready` exclude tasks assigned to others.
- **Pretty-only visual cue** for `in_progress` rows (presentation Option B): trivial future polish if a human-ergonomics need appears.
- **"Most-recently-started first"** within the `in_progress` band via transition history: possible refinement, deliberately not adopted (gold-plating).

### Current State
- **Decided:** `ready` includes `in_progress` (single-actor model; multi-actor handled later via an assignee field + "ready excludes tasks assigned to others").
- **Decided:** `blocked` stays the strict De Morgan complement — both gate on `(open OR in_progress)`; `ready ⊎ blocked = all live tasks`; a task is never in both.
- **Decided:** leaf-only rule unchanged — `in_progress` parents stay gated out of `ready`; only leaves surface; parent/child never co-occur in `ready`.
- **Decided:** sort = resume-first, `ready`-only — `in_progress` floats to the top of `ready`, then `priority ASC, created ASC`; `list`/`blocked` ordering unchanged.
- **Decided:** no presentation change — Status column + top-sort already distinguish `in_progress`; sectioning rejected (breaks machine formats).
- **Decided:** edge cases — `stats` blocked count moves to `(Open + InProgress) − Ready` (required); `stats` ready count tracks new semantics; `--status` composes for free (`tick ready --status open` = unstarted ready work); `--count` needs nothing.

**All six subtopics decided. Discussion converged.** Net behaviour: `ready` and `blocked` both gate on `(open OR in_progress)`; `ready` floats `in_progress` to the top (ready-only sort); `stats` blocked derivation fixed; no presentation or flag changes required.
