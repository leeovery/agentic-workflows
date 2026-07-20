# Review

Review is the pipeline's fresh pair of eyes, structurally fresh: the reviewing session has not seen the code before, and its hard rules keep it that way. Review all tasks. Don't fix code. Don't re-implement. Be specific ("test doesn't cover X", never "tests need work"). Reference artifacts with file-and-line. Flag under-testing *and* over-testing. Question everything.

The phase verifies the built work against everything upstream: every plan task against its acceptance criteria, the implementation against the [specification's](specification.md) intent, the tests against both. Scope can be a single plan, several, or all of an epic's.

## Verification

One **task-verifier agent** per completed task, dispatched in batches of five in parallel. Each verifier receives the task with its acceptance criteria, the spec for context, the plan, project skills, a shared review checklist, and the files the task's commits touched as a starting set. It works through a fixed sequence: understand the task, load spec context, verify the implementation exists and is correct, verify the tests are adequate (neither under- nor over-tested), check code quality, and categorize non-blocking observations. Findings go to a per-task report file (`review/{topic}/report-{phase}-{task}.md`); a brief status returns to the orchestrator.

Quick-fix tasks are deliberately authored without acceptance criteria ([scoping's](work-types.md#quick-fix) rule), and the verifier knows it: they are verified by their own branch of the checklist, and the missing criteria are never reported as a finding.

The orchestrator aggregates everything into `review/{topic}/report.md` with one of three verdicts:

| Verdict | Meaning |
|---|---|
| **Approve** | All acceptance criteria met, no blocking issues. |
| **Request Changes** | Missing requirements, broken functionality, or inadequate tests. |
| **Comments Only** | Non-blocking suggestions and observations. |

Coverage is tracked in the manifest (`reviewed_tasks` against implementation's `completed_tasks`), so a review resumed later knows exactly which tasks are unreviewed and can review just those; restart wipes the reports and the tracking.

## The remediation loop

An approved review completes the phase and hands off through the [bridge](how-it-fits-together.md#the-bridge): the pipeline is done (or, for an epic, the topic is). Anything else enters the remediation loop:

1. **Synthesis.** A findings-synthesizer agent turns the review reports into proposed remediation tasks, deduplicated across per-task findings, each with problem, solution, acceptance criteria, and tests. Strongly recommended for Request Changes; optional for Comments Only. Declining synthesis is allowed, and completes the review with findings on record.
2. **Triage.** Each proposed task is presented for approval, with the usual `y`/`a`/`s`/comment options and auto opt-in. Skipping all of them completes the review.
3. **Write-back.** A task-writer agent adds the approved tasks to the plan as a new phase through the [format adapter](output-formats.md), extending `task_map` with the new IDs.
4. **Re-open.** The engine re-opens the implementation item (`engine topic reopen`, the dedicated completed-to-in-progress transition), and the session enters plan mode with a handoff naming the exact next invocation. The user clears context, and the fresh [implementation](implementation.md) session picks up the remediation tasks like any others: executor, reviewer, fix loop, analysis loop, and then review again.

The loop means "review found problems" is not a dead end that gets argued about in a tired context: it is new work, planned and executed with the same machinery as the original tasks, then re-verified.

Review reports are never indexed into the [knowledge base](knowledge-base.md). They judge a moment in the code's history; the spec and discussions remain the durable knowledge.

---

*Next: what the pipeline remembers and how it recalls it, the [knowledge base](knowledge-base.md).*
