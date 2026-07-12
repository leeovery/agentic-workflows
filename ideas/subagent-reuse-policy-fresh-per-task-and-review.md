# Sub-agent Reuse Policy: Fresh Reviewers, Fresh Per-Task Executors, Reuse Only for Fix Rounds

## The Idea

Codify agent lifecycle in `workflow-implementation-process` (its `invoke-executor.md`, `invoke-reviewer.md`, and the task loop). Three rules:

1. **Every task review dispatches a FRESH reviewer agent.** Never continue a prior task's reviewer. Independent verification is the whole point of the review; a reviewer that already approved this task's dependencies and carries all prior-review context is not an independent check.
2. **Every new task attempt (Stage A → B) dispatches a FRESH executor agent.** A new task starts clean.
3. **Agent reuse (continue-with-context via SendMessage) is permitted ONLY within a single task's fix loop** — the executor re-invoked on the code it just wrote (Stage F/G "comment" → B), and, at most, a reviewer re-checking that its own finding was addressed. New task = new agent; fix round = same agent.

The skill currently says nothing about agent lifecycle, so an orchestrator optimising for token/context efficiency will reuse agents — which quietly defeats review independence and blurs task boundaries.

## What Happened

During a long `workflow-implementation-process` session (Folio, the pdf-fields phase), the orchestrator spun up one reviewer agent early and then **reused it via SendMessage for every subsequent task review** across roughly eight tasks, and likewise reused executors across different tasks — all justified as "context efficiency / fewer cold starts."

The user caught it when a brand-new task's review was dispatched to the reused reviewer: *"why you dispatching a review using an existing sub agent? this is a new review."* He stated the intended policy: reusing an agent for a **fix round** is good; **all reviews must be fresh agents**; and **each new task attempt is a fresh agent too**.

Corroborating evidence: earlier in the same project the reused reviewer **missed a real defect** — a controller written with constructor injection against the codebase's established method-injection convention (Controller → Action → Service). A fresh, unbiased reviewer would have been more likely to flag it; the reused reviewer had already normalised the surrounding code and waved it through.

## Root Cause

`invoke-executor.md` and `invoke-reviewer.md` don't state whether each invocation should be a fresh agent or may continue an existing one. Continuing an agent is cheaper (warm context, no re-exploration), so an efficiency-minded orchestrator reuses — but:

- **Reviews lose independence.** The reviewer inherits its own prior approvals plus the accumulated framing of every earlier task, so it checks against its own established assumptions rather than reading the spec/conventions fresh. Bias compounds across a session.
- **New-task executors carry stale framing** from the previous task, eroding the clean task boundary the loop assumes.

The fix is a one-paragraph lifecycle rule in the skill: **fresh reviewer per review, fresh executor per new task, reuse only for a same-task fix round.** Cheap to state, and it removes the standing temptation to trade independence for warm context. Optionally note the rationale inline so future orchestrators don't "optimise" it back out.
