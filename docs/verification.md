# Verification

Trust in Claude's calls and trust in Claude's work are separate ladders. [Trust](trust.md) is the first: whether a call reaches you. This page is the second: how the work proves itself, so you can stop reading it line by line. The rule underneath is simple. Ledger runs the product. A builder proves a task by driving the product the way a user would, a script checks what happened, and the engine records the verdict. Claude's account of what happened never counts as proof.

## Proven and not proven

A scenario is **proven** when it was performed on the running product, through the path a user takes — or, for a product with no interface, a caller — and a script checked the result: a captured screen compared, a response asserted, a recording. Everything else is said plainly:

- **not proven**: the scenario could not be driven, failed, or has no tests at all;
- **named, not run**: its tests exist but were all skipped.

Evidence is computed, never narrated. The drive's script writes the verdict; Claude never types one, and never types a count. A scenario that ran green and later failed reads not proven again: the latest run at the code being judged decides. That is what reaches you in the task's account, in the phase review, and in the review phase's report.

## The verify setup

Each project has a **verify setup**: how its product is run to prove the work. It has five parts — launch, a health check that answers only once the product is up, drive, evidence and cleanup — and a **feature map** beside them, saying how a user reaches each feature, how an agent drives it, and what proves it works.

Nothing is asked of you to build it. The first phase of every build gets the product running and drivable, so its tasks build the verify setup, and the first phase cannot close until the setup is recorded. How the product is driven is the builder's to work out from the product itself.

The setup counts only once it has run end to end: a trial runs all five parts for one scenario, from a checkout holding nothing uncommitted, and must leave nothing behind. It lives in the product's code, in a folder of its own below the code root, so it rides the same pull requests and reviews as the code it drives, and its verdict comes only from reviewed code: the drive is the path of a script in that folder, never a shell line. A later task that changes the setup records it again the same way. Manage's setup shows it beside the [environment setup](configuration.md#the-environment-setup); only the task that builds it changes it.

## A run

A run of a scenario launches the product, waits for its health check, drives the scenario, gathers the evidence and cleans up, whatever happened before. It proves committed code: a run refuses a checkout holding an uncommitted change, and refuses again where the run itself left a file behind, naming each.

The engine records every run on the [state branch](state-and-git.md), in the work unit's `build/runs/`: the verdict as the script wrote it, the commit each repository was at, the task it ran for, and the text evidence whole — a captured screen, a response. Recordings and images stay in the ignored cache, recorded by their hash, since the state branch is pushed with every commit. Where the Claude Code mod runs, the board shows the evidence beside the conversation.

## A bug, proven first

A bugfix proves its bug before it fixes it. Its first task writes the test that reproduces the bug and nothing else. The engine then runs that test on the unfixed code, at that task's tip, up to five times, stopping at the first pass: five failures prove the bug, and a single pass proves nothing, so the test is reworked. Until the bug is proven, the commit door refuses the fix. After the fix, the same test must pass, and the commit door requires it. The review phase runs the test on the unfixed code once more, where it must still fail. No verify setup is needed for any of this: the test's own command is the proof.

## Are the tests any good?

Every acceptance criterion has a test, and the tests are checked by machine rather than by eye. At each phase review, where the verify setup names a mutation tool, the engine runs it over the lines the phase changed, and a mutant that survives in code a criterion covers is a finding for the reviewers. Where the setup names none, each reviewer breaks the riskiest line of a criterion's code in a scratch worktree, and a break the tests don't catch is a finding. Either way the cost is bounded by the phase's change.

## Hard checks over soft rules

A rule held only in prose holds only for whoever read it. So a spec invariant names the check that enforces it where one can — an architecture test, a lint, an import-graph rule — and the task that adds the check goes in the phase that introduces the invariant. The project's checks run through the commit door before every code commit: its tests, then each of its linters, as the [environment setup](configuration.md#the-environment-setup) records them.

Your own coding rules stay where you keep them, in the project's skills and your `CLAUDE.md`, and reach the builders and reviewers without being configured: they are subagents, they find and invoke the project's skills themselves, and Claude Code loads `CLAUDE.md` into every one. Ledger writes your `CLAUDE.md` only with a line you agreed to, on your yes.

## Bugs found after review

Where the project has a verify setup, a bugfix's investigation records which area of the feature map the bug sits in, and which piece of work built the code it fixes. Ledger's measures count the bugs found after review by area, for Claude to read when you ask how the work is holding up. No flag is raised on any screen because of it.

## Verification never quiets the questions

A proven build never lowers how often Claude asks you. The [ask rule](trust.md#the-ask-rule) matches your judgement, and your verdicts already count what a mistake cost; a mistake verification catches early already earns a "fix later" verdict. The two ladders stay apart.
