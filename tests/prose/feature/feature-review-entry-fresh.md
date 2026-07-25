## case: feature-review-entry-fresh
- world: feature-implemented
- origin: feature mainline — review entry passes both prerequisites, fresh review
- files:
  - skills/workflow-review-entry/SKILL.md
  - skills/workflow-review-entry/references/validate-phase.md

### walk

Execute skills/workflow-review-entry/SKILL.md with arguments
$0=feature, $1=pay. Follow it up to the point where the handoff to the
processing skill is constructed — record the handoff arguments block —
and stop there. Do not execute the processing skill's instructions, and
never dispatch any agent.

### expect

- routing: the prerequisite entry gate passes (empty render) — plan and implementation are both complete
- routing: with no review item in the manifest, the fresh path is taken — no reopen, no resume
- routing: the handoff invokes workflow-review-process for pay
- state: manifest absent pay.review.pay status
