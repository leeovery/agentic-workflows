## case: review-entry-fresh
- origin: feature mainline — review refuses to start until delivery is complete
- files:
  - skills/workflow-review-entry/SKILL.md
  - skills/workflow-review-entry/references/validate-phase.md

### given

world_before: feature-implemented

### when

Execute skills/workflow-review-entry/SKILL.md with arguments $0=feature,
$1=pay. Follow it to the point where the handoff to the processing skill
is constructed; record the handoff block and stop. Do not execute the
processing skill's instructions, and dispatch no agents.

### then

world_after: unchanged

trace:
1. resolves the topic to the work unit
2. the prerequisite gate renders empty — both the plan and the
   implementation are complete, so nothing blocks entry
3. no review item exists, so the fresh path is taken — nothing is
   reopened and no resume is announced
4. hands off to the review processing skill for pay

notes:
- no verifier agents are dispatched by the entry skill
