# Menu Adoption Sweep — 17 prose menus in 13 files

## The Idea

Migrate the 17 remaining prose-authored menus in the files the concurrent-phases stack touched to the engine, in one PR, wording preserved.

## Why It Is Outstanding

CONVENTIONS' menu rule is "touching a file adopts its menus" — a change to a file that still carries a prose-authored menu migrates it in the same change, so the corpus converges file by file. The concurrent-phases stack touched these thirteen files, and its edits were mechanical: a flag added inside an existing fenced command, a pathspec narrowed, a commit form swapped. The review pass ruled that a mechanical edit inside a fence does not trip the adoption rule (the exemption is now written into CONVENTIONS), which is what keeps a commit-scope stack from turning into a menu-rendering stack. The adoption is still owed — just not by that stack.

## The Files

Found with `grep -c '· · · · · · ·'` over every skill markdown file the stack touched:

| Menus | File |
|---|---|
| 2 | `skills/workflow-continue-epic/references/summary-backfill.md` |
| 1 | `skills/workflow-discussion-process/references/conclude-discussion.md` |
| 1 | `skills/workflow-implementation-process/references/analysis-loop.md` |
| 1 | `skills/workflow-implementation-process/references/conclude-implementation.md` |
| 1 | `skills/workflow-implementation-process/references/task-loop.md` |
| 1 | `skills/workflow-investigation-process/references/conclude-investigation.md` |
| 2 | `skills/workflow-planning-process/references/analyze-task-graph.md` |
| 1 | `skills/workflow-planning-process/references/author-tasks.md` |
| 1 | `skills/workflow-planning-process/references/conclude-plan.md` |
| 1 | `skills/workflow-planning-process/references/initialize-plan.md` |
| 3 | `skills/workflow-planning-process/references/plan-review.md` |
| 1 | `skills/workflow-planning-process/references/resolve-dependencies.md` |
| 1 | `skills/workflow-shared/references/correcting-historical-artifacts.md` |

## Shape of the Work

One PR. Each menu becomes a render surface in `domain/projections/surfaces.cjs` served through `engine render`, with the prose carrying only the fetch and the verbatim emission — the pattern the shipped surfaces already demonstrate. Wording is preserved exactly; this is a rendering move, not a rewrite. Several of these are static option sets, which the rule covers explicitly: a static menu still renders from the engine so there is one alignment rule and one register, and so a conditional row can be added later without a prose rewrite.

Worth checking as the sweep runs: some of these menus are near-identical across files (the conclude gates in particular). A shared surface with a phase parameter may cover several at once.
