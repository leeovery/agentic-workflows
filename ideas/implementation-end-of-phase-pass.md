# Implementation: End-of-Phase Consolidation Pass

## The Idea

At the end of each implementation phase, run a pass that is **not in the plan** — the implementer's own sweep over what the phase just built, looking for consolidation, duplication, complexity and comment accuracy across the phase's whole surface.

The plan cannot author this task, because the opportunities only exist once the phase's tasks have landed. So the implementer owns creating it, at the phase boundary, as a matter of course.

## Why This Matters

The per-task reviewer already spots "this could be dried up" — but **nobody owns acting on it**. The finding is raised against one task, the fix belongs to several, and the task loop has no slot for work the plan didn't name. So it gets noted and dropped.

The evidence that this is a real gap is the `theming-system` feature (Portal, 2026-08). Its plan carried **38 de-duplication tasks out of 176** — more than a fifth of the feature — spread across seven `Analysis (Cycle N)` phases. That machinery exists precisely because nothing handles duplication as it accrues.

And it did not converge. Findings per analysis cycle:

```
c1 22 → c2 16 → c3 18 → c4 18 → c5 13 → c6 14 → c7 19
```

Flat. Cycle 7 out-yielded cycle 2. Cycle 4's own report notes the three analysis agents "landed on disjoint surfaces" — each cycle finds new ground rather than closing old. Seven cycles consumed ~90 of 176 tasks, and the review that followed still found 232 more findings of the same class.

A phase-boundary pass attacks the same problem with a much tighter loop: it acts while the phase is fresh and its context is still loaded, instead of accumulating debt for a global sweep that never catches up.

Independent corroboration from the same feature's review triage, written while deciding what to do with 191 duplication findings:

> "If the duplication is ever worth addressing it is worth **one deliberate consolidation pass**, not 191 separate edits."

That is this idea, arrived at from the other end.

## Shape (undesigned)

- Fires at the phase boundary, after the phase's last task completes and before the next phase begins.
- Scoped to what the phase touched — not the whole codebase.
- Owned by the implementer, not the plan. It is not authored as a task up front.
- Likely concerns: duplication introduced across sibling tasks, helpers that should be shared, complexity that only shows at phase scale, comment accuracy against the phase's final state, dead code left by superseded tasks.
- Output is work done in-phase, not findings routed elsewhere.

## Open Questions

- **Does it replace the analysis cycles, or feed them?** If a per-phase pass works, the seven-cycle global machinery may be unnecessary — or may shrink to a single final pass. Both cost a fifth of a plan today.
- **Gate or automatic?** A phase boundary is a natural break; whether the user confirms or it just runs is undecided.
- **Termination.** The analysis cycles' failure mode was "run until nothing is found", which is unreachable against agents that always find something. A phase pass needs a bounded remit rather than a convergence target.
- **Scope creep.** This could grow beyond refactoring — polish, comment accuracy, dead-code removal, guard tightening. Worth deciding whether it stays narrow.

## Relationship to Other Work

Distinct from the review-phase redesign in `design/review-phase-findings-pipeline.md`, which handles findings *after* all implementation is done. This idea is about preventing that pile from forming. The two are complementary: if the phase pass works, the review phase should have materially less duplication to triage.
