## case: feature-discussion-entry-seeds
- world: feature-created
- origin: feature mainline — discussion entry seeds from the durable carrier
- files:
  - skills/workflow-discussion-entry/SKILL.md
  - skills/workflow-shared/references/ensure-discovery-item.md

### walk

Execute skills/workflow-discussion-entry/SKILL.md with arguments
$0=feature, $1=pay. Follow it up to the point where the handoff to the
processing skill is constructed — record the handoff arguments block —
and stop there. Do not execute the processing skill's instructions.

### expect

- routing: with no discussion item in the manifest, the new-entry arm is taken — no phase-status validation menu appears
- routing: ensure-discovery-item returns without creating anything — the discovery map is epic-only, and this is a feature
- routing: context is seeded from the manifest description and the session log's Exploration section — the gather-context questioning path is not taken
- routing: the handoff invokes workflow-discussion-process for pay
- state: manifest absent pay.discussion.pay status
