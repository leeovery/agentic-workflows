# Implementation

Implementation is where the plan becomes code, and where your role changes. Through the earlier phases you led — describing, exploring, deciding, approving. Here the agents lead. An executor writes the code, a reviewer checks it, and you move to the reviewer's chair: approving completed work at gates, weighing in when something is flagged, and unblocking when the system needs a human call. This inversion is the whole point of front-loading the thinking. Because the decisions are already written into the spec and the plan, the build can run largely on its own, executing choices that were made deliberately rather than improvised mid-loop.

Implementation refuses to start without a completed plan. Before any code is written it settles the ground: it confirms that dependencies from other plans are satisfied, and it handles environment setup. The first time through, it asks whether there are any setup steps it should run first — copying an env file, running migrations, installing an extension — saves your answer so it never asks again ("no special setup" is a valid saved answer), and runs those steps exactly as given before touching a task. It also quietly discovers the project's linters and any project-specific skills, so they apply throughout. If a previous session was interrupted, resuming is automatic — the system re-derives where it was from the files and git history rather than its own memory.

## The loop you watch

The plan is executed one task at a time, in dependency order. For each task the same cycle runs.

An **executor agent** implements the task under strict test-driven development: it writes a failing test first, confirms it fails for the right reason, writes a complete implementation to pass it, refactors only while the tests stay green, and runs the linters. "Complete" is meant pragmatically — no hardcoded fakes that only satisfy the test, but no gold-plating beyond what the test asks for either. One rule is absolute: it must never edit a test to make broken code pass. Doing so would be admitting the implementation is wrong and hiding it, and hiding a failure is worse than showing one. The executor writes code and tests but never commits.

Then an independent **reviewer agent**, which did not write the code, checks the finished task on five fronts: does it conform to the spec, does it meet the task's acceptance criteria, is it tested well — flagging both under-testing *and* over-testing — does it follow the project's conventions, and does it fit the architecture. It returns either an approval or a list of needed changes, each pinned to a specific file and line.

## Where you come in

You see the outcome of each task and hold the decision.

When the reviewer asks for changes, you see each issue told as what is wrong or at risk in the work — with the proposed fix, any alternative, and the reviewer's confidence — and choose: apply the fix and re-run the executor, turn on auto so future fixes apply without asking, skip the fixes and accept the task as it stands, ask for the code-perspective retelling, question the review, or add guidance for the re-run. If a single task goes three rounds without resolving, the system forces this decision even if you had switched to auto, and shows you a convergence diagnostic — is the task actually converging, treading water, or diverging, with fixes spawning fresh problems? The cap exists so an unattended fix loop cannot thrash forever, and the diagnostic exists so that when it stops to ask, you can tell whether continuing is likely to help or whether something deeper is wrong.

When the reviewer approves, the finished task is retold in the product's terms — what it now does that it did not before, the decisions worth knowing, and how it was verified — rather than as a dump of implementation notes, with the code-perspective telling available on request. You decide whether to accept it, accept it and auto-accept the rest, question it, or comment. Only on your acceptance does the system commit — one commit per approved task, covering the code, the tests, and the progress tracking together — and mark the task complete. One task, one commit, so the git history reads as a clean sequence of finished work and any single task can be found or reverted on its own.

Two situations always come back to you rather than being resolved automatically. If the executor is blocked, or finds the code needs to deviate from what the spec says, the system stops and presents it — retry, skip, or stop — because a spec deviation is a decision, and decisions are yours. And if tasks remain but none are available to start, because something they depend on was skipped or blocked, the system shows you the blockage and lets you proceed, skip, or stop rather than stalling silently.

## After the tasks

Building every task is not quite the end. Once the task list is drained, an analysis loop runs. The system takes a checkpoint — flagging any unexpected files first — then dispatches agents to review what was actually built against the plan and the spec, and a synthesiser proposes any remediation tasks the review turned up. You approve those tasks the same way you approved the originals; approved ones are written into the plan, and the build loop runs again over them. Build, analyse, perhaps build again — this repeats until the analysis finds nothing more, capped at three cycles per session. At the cap the system shows the convergence diagnostic and asks whether to continue or stop; it never silently gives up, and never silently loops.

## The quick-fix variant

A [quick-fix](investigation-and-scoping.md) builds through implementation too, but under a different discipline suited to mechanical change. Instead of writing a new failing test first, the executor captures a passing test baseline, applies the change completely across every target file, then verifies the baseline still passes — fixing the change, never the tests, if something breaks. The reviewer switches to completeness criteria: were all the target files updated, do any occurrences of the old pattern remain, do the existing tests still hold. It does not demand new tests, because a mechanical change is verified by the tests that already exist. The gates and the one-commit-per-task rhythm are unchanged.

When the loop finds nothing left to do, implementation asks whether to mark itself complete and hands off to [review](review.md) for independent verification.
