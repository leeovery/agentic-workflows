# Review Not Re-Offered After Loopback from Review Remediation

## The Idea

When implementation re-opens after a review (because the review produced remediation tasks the user approved as a new phase), and that fresh round of implementation completes, the workflow bridge should route the user back to **review** — not declare the bugfix `done`. Today the bridge declares `done` because the manifest's `review` entry is still marked `completed` from the prior round, and `discovery.cjs` returns `next_phase: done` once every named phase has a non-`none` terminal status.

## What Happened

Concrete run, this session, on the `slow-open-empty-previews-and-zombie-sessions` bugfix:

1. Original pipeline: investigation → specification → planning → implementation → **review**. All completed normally. The review surfaced 4 remediation tasks; user approved them, which re-opened implementation as Phase 11.
2. Phase 11 ran. The analysis loop (cycle 6) raised a new task. User approved it as Phase 12 in the plan.
3. Phase 12 ran. Cycle 7 returned clean. Implementation marked completed.
4. `workflow-bridge` ran discovery — `next_phase: done` — and concluded the bugfix.

Step 4 is wrong. The user *just* added new code/spec changes (Phase 11 + Phase 12). The prior review cycle never saw them. The bridge should have offered review again so the new changes can be validated against the spec and plan.

Discovery output that produced the wrong routing:

```
=== slow-open-empty-previews-and-zombie-sessions (bugfix, in-progress) ===
next_phase: done

  research: none (no files)
  discussion: none (no files)
  investigation: completed
  scoping: none (no files)
  specification: completed
  planning: completed
  implementation: completed
  review: completed (no files)
```

The `review: completed (no files)` line is the clue: the review was completed *and then* the implementation loopback happened, which means anything after that review timestamp is unreviewed. Discovery doesn't compare timestamps so it treats `review: completed` as terminal.

## Root Cause

`discovery.cjs`'s next-phase algorithm is **status-only**, not **freshness-aware**. It walks the pipeline in order and returns the first phase whose status is not `completed`. Once every phase is `completed`, it returns `done`.

That algorithm is correct for the linear-path case. It breaks on the loopback case because:

- Loopback edges (review → implementation, analysis → planning) re-open downstream phases.
- The bridge offers an "early completion" choice at `next_phase: review` but has no mechanism to re-offer review after a re-opened implementation completes.
- The manifest tracks each phase's completion status but not "completed-and-fresh-relative-to-downstream-changes."

The result: every loopback collapses the next review opportunity, silently.

## Where The Behaviour Lives

| Component | What it does | Where it goes wrong |
|---|---|---|
| `workflow-bridge/scripts/discovery.cjs` | Returns `next_phase` based on per-phase status | Treats `review: completed` as terminal regardless of downstream changes |
| `workflow-bridge/references/bugfix-continuation.md` | Routes on `next_phase: done` to terminal | Trusts discovery's terminal verdict |
| `workflow-review-entry` reopen pattern (precedent) | Resets `review` status to `in-progress` when re-entered | Only triggers if the user manually invokes review; not auto-offered |
| Implementation loopback (Phase 11 remediation tasks) | Re-opens implementation, leaves review status as-is | The implication that review is now stale is never recorded |

## Proposed Solutions

### Option A — Mark review stale on loopback

When implementation re-opens after a review (Phase N+1 created from review remediation tasks, or via `workflow-implementation-entry` resuming a `completed` topic), reset `review.status` to `stale` (or back to `pending`). Discovery then sees `review: stale` after implementation completes and routes to it.

Smallest blast radius. The trigger point is the existing "Reopening implementation" branch in `workflow-implementation-entry/references/validate-phase.md` (which already resets `implementation.status` to `in-progress` — extend it to also reset `review.status`).

### Option B — Freshness-aware discovery

Track `completed_at` timestamps per phase. Discovery walks the pipeline and, for each `completed` phase, checks whether any downstream phase has a `completed_at` *later* than this one's. If so, treat this phase as stale.

More general (catches analysis-loop loopbacks too, and future loopback edges), but requires schema work and timestamp discipline across every phase skill.

### Option C — Explicit re-offer at implementation conclusion

`workflow-implementation-process/references/conclude-implementation.md` (or `workflow-bridge` for bugfix) checks: "did this implementation re-open after a completed review?" If yes, force-offer review even though discovery says `done`.

Localised but coupling-y; the bridge needs to know about the implementation's history.

### Recommendation

**Option A**. It matches the existing reopen pattern in `workflow-implementation-entry/references/validate-phase.md`, the manifest schema doesn't need a new field (just an additional status value or treat it as `in-progress`), and discovery's logic stays simple — `review: in-progress` is already a state it knows about.

Implementation sketch:

```
# workflow-implementation-entry/references/validate-phase.md
# B. Implementation Check — when status is `completed`:
#   ... existing reset ...
node …manifest.cjs set {work_unit}.implementation.{topic} status in-progress

# NEW: also reset downstream phase status to in-progress (stale)
if exists {work_unit}.review.{topic}:
  node …manifest.cjs set {work_unit}.review.{topic} status in-progress
```

A symmetric reset belongs in `workflow-planning-entry` too (planning can re-open if implementation analysis adds tasks that the user wants planned formally, though this is a less-trodden path).

## Scope

- `workflow-implementation-entry/references/validate-phase.md` — extend the reopen reset to downstream phases (review, and optionally any phase later than the one being re-opened)
- `workflow-bridge/scripts/discovery.cjs` — verify no change needed once the manifest state correctly reflects staleness
- Documentation note in `workflow-implementation-process` and `workflow-review-process` SKILL.md about the loopback semantics

## Severity

Medium — high. Silently skipping review after loopback defeats the point of the loopback. The user explicitly chose to remediate findings and add new work; that new work deserves the same validation gate the original work passed through. Users who don't notice the missing prompt may ship unreviewed code.

## Out of Scope

- Analysis-loop loopbacks (cycle 7 producing a Phase 13) — same family of bug but more complex to detect because analysis is internal to implementation. Tackle once the review case is fixed.
- Cross-cutting / epic pipelines — those have their own discovery; address separately if they hit the same pattern.
