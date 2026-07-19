# Planning

Planning turns the approved [specification](specification.md) into something executable: phases with goals and acceptance criteria, tasks with full detail, a dependency graph, and every piece traceable back to spec content. Claude acts as technical architect, product owner, and plan documenter at once; the phase's discipline is that nothing enters the plan that the spec doesn't back.

A plan is four things, deliberately separated:

| Piece | Where | What |
|---|---|---|
| Planning file | `planning/{topic}/planning.md` | The human-readable plan: phases, goals, acceptance criteria, task tables with internal IDs. Content only, no state. |
| Manifest state | `phases.planning.items.{topic}` | Format, status, position (`phase`, `task`), gate modes, `task_map`, `spec_commit`. The single source of truth for planning state. |
| Task detail files | `planning/{topic}/phase-{N}-tasks.md` | Full per-task specifications, a permanent record independent of the backend. |
| Authored tasks | wherever the [output format](output-formats.md) stores them | The tasks in your chosen backend, created through the format adapter. |

The `task_map` deserves a note: it maps the plan's internal task IDs to the backend's external IDs, so the plan can talk about `p2-t3` while the backend tracks issue keys. [Implementation](implementation.md) resolves in both directions, and the manifest's `key-of` reverse lookup makes the mapping queryable.

## Construction

Phase structure comes first, then each phase runs through the same cycle: a task list is designed and approved, then a single **task-author agent** writes full detail for every task in the phase to the task detail file. The orchestrator validates the result mechanically, task count in the detail file must match the approved task table, with a bounded retry (two agent invocations, then the user chooses retry or manual correction). Approved tasks are written to the output format through the adapter's authoring reference. One agent per phase, never concurrent authors, never batching beyond a phase.

The approval gates carry the same `a`/auto option as [spec construction](specification.md#construction-nothing-written-without-approval), persisted per gate in the manifest (`task_list_gate_mode`, `author_gate_mode`). And navigation is free at every gate: the user can jump to any phase or task, or "the leading edge", the first incomplete piece of work, tracked by the manifest position. Navigation moves the user's view; the leading edge only advances when work completes.

## The dependency graph

Once all tasks are authored, a **dependency-grapher agent** analyzes the whole plan: it clears existing graph data, establishes inter-task dependencies, assigns priorities, and detects cycles, writing through the format's `graph.md` so the same analysis lands correctly in any backend. Implementation later consumes this as "next available task": what is unblocked, in priority order.

Epic plans add a second layer: **external dependencies** on other topics' plans. A task here can wait on a task in a sibling plan; those cross-plan edges live in the manifest and surface on the [epic dashboard](how-it-fits-together.md#the-epic-dashboard) as `(blocked: dep-topic:task — reason)` markers, with an unblock flow for dependencies satisfied outside the workflow.

## Review

Plan review mirrors spec review: two agents per cycle, strictly sequential, findings triaged through tracking files.

1. **Traceability review**: does every task trace to spec content, and does every spec requirement land in some task?
2. **Integrity review**: is the plan internally sound: scoping, sequencing, acceptance criteria, dependency sanity?

Traceability's approved fixes are applied before integrity runs, so integrity evaluates the corrected plan. The loop repeats until a cycle surfaces no findings, with the same guard rails as spec review: a user gate past cycle 3, a hard stop-and-ask at cycle 5 even in auto mode, and convergence analysis to show whether the cycles are converging. The re-loop prompt explains why re-review matters: fixes shift dependencies and can introduce their own gaps; two or three cycles typically surface anything cascading.

## Spec drift detection

The plan records `spec_commit`, the spec's git commit at planning time. On any resume, spec-change detection diffs the spec against that baseline and reports what changed before the user chooses how to proceed: continue (reconciling changed spec content into affected phases and tasks) or restart. The baseline re-stamps only at conclusion, so a half-reconciled plan keeps reporting the drift until it is actually resolved. Restart is a full cleanup: authored tasks removed through the format adapter's cleanup instructions, planning files deleted, manifest entry cleared.

Conclusion marks the planning item complete and hands off through the [bridge](how-it-fits-together.md#the-bridge). Plans are never indexed into the [knowledge base](knowledge-base.md); the spec is the durable knowledge, the plan is its execution shadow.

---

*Next: the plan gets executed, task by task, in [implementation](implementation.md). Or read how task backends plug in: [output formats](output-formats.md).*
