# Planning

Planning turns the specification's *what* into a concrete *how*: phases, tasks, acceptance criteria, and the order they should be built in. It writes no code. Its output is a plan detailed enough that implementation can execute it task by task without re-opening a single decision — which is the point, because the decisions were already made and written into the spec.

The spec is planning's only input, and planning refuses to start without a completed one. It also refuses on the in-between states — a spec that is only proposed, or has been superseded or promoted — and tells you which it hit. This is deliberate: a plan built on an unfinished spec is a plan built on sand. If a plan already exists, you choose to continue it or restart, and on continue, if the spec has changed since the plan was last built, the phase detects that and folds the changes into the affected phases before concluding.

## Where the work will live

Early on, planning asks where the plan's tasks should be stored and tracked. This is a genuinely pluggable choice. The plan's *content* — its phases, tasks, and acceptance criteria — is authored the same way regardless, but *where the tasks live and how their progress is tracked* is swappable, from plain task files kept alongside the plan to an external tracker your team already works in. If the project has a default, planning offers to reuse it; otherwise it presents the available options and your pick becomes the default for next time. The rest of the pipeline reads and updates tasks through whatever you chose without caring which it is, so this decision never leaks into how implementation or review behave.

## Building the plan, incrementally

Planning is explicitly never one-shot — the phrase the phase works to is "go slow to go fast." A plan drafted in a single pass that misfiles requirements or structures its tasks badly wastes far more time downstream than it saves upfront. So the plan is built in layers, with specialist agents doing the analytical drafting while you stay in the approving seat.

First comes structure. An agent reads the whole spec and proposes a set of phases — each with a goal, a reason for its place in the order, and acceptance criteria — breaking the work into stages that can be tested independently. There are no task lists yet; you are approving the shape of the work before its detail. You can reorder, split, merge, add, edit, or remove phases until the structure is right.

Then, phase by phase, comes the detail. For each phase an agent proposes a task list — each task a one-line summary with its edge cases — which you approve or adjust. Once the list is agreed, another agent writes the full detail for every task: the steps, the acceptance criteria, the edge cases, the tests. The phase checks that the number of tasks written matches the list you approved, so nothing is silently added or dropped.

Throughout, everything must trace back to the spec. Where the spec is ambiguous or silent, planning is forbidden to invent a reasonable-sounding answer — it flags the gap and asks you rather than guessing. A plan that quietly fills spec gaps with invention would smuggle undecided decisions into the build, which is exactly what the spec exists to prevent.

## Why it gates task by task

Planning's defining interaction is that it stops for your approval at each level before writing anything: once for the phase structure, once for each phase's task list, and then for each individual task's full detail. Nothing is written to the plan until you approve it, and presenting content to you is never itself approval.

This granularity is not ceremony. The plan is the last document you review before agents start writing code largely on their own, and each task is a specific commitment about how a piece of the work will be built. Reviewing the structure before the details, and the details before they are committed, is where you catch a mis-scoped task or a wrong ordering while it is still a sentence rather than a pull request. The system asks even when a stored preference could answer for it, because a stored value is a suggestion, not your consent for this plan.

When you have seen enough and trust the drafting, you opt into auto — at either the task level or the task-list level — and planning writes the rest without stopping. That is the graduated hand-off in miniature: you stay close while the shape is forming, then hand over once the pattern is clear. Auto is always your explicit choice, never something the system assumes on your behalf.

Late in the phase, an automated review runs in two parts: a traceability check — does every task trace to the spec, and is anything in the spec missing from the plan? — and an integrity check — are the tasks well-scoped and the dependencies sound? Fixes from the first are applied before the second runs. Planning also analyses the dependency graph across the tasks to set their priority and execution order, and for an epic it resolves dependencies that cross between plans.

## What you are left with

The finished plan is a human-readable document — phases with their goals and acceptance criteria, and tables of tasks — backed by per-phase detail files kept as a permanent record, with the tasks themselves materialised into the storage you chose. On conclusion the plan is re-baselined against the current spec and marked complete, and the phase reports the totals: so many phases, so many tasks, reviewed for traceability and integrity. From here the work goes to [implementation](implementation.md), which will build it one task at a time.
