## case: feature-planning-entry-context-gate
- world: feature-specified
- origin: feature mainline — planning entry validates the spec and asks for late context
- files:
  - skills/workflow-planning-entry/SKILL.md
  - skills/workflow-planning-entry/references/validate-spec.md
  - skills/workflow-planning-entry/references/validate-phase.md

### walk

Execute skills/workflow-planning-entry/SKILL.md with arguments
$0=feature, $1=pay. Follow it up to the point where the handoff to the
processing skill is constructed — record the handoff arguments block —
and stop there. Do not execute the processing skill's instructions.

### user

1. continue — no additional context since the specification

### expect

- routing: the specification entry gate passes (empty render) — clear to plan
- routing: with no plan in the manifest, the fresh-start arm asks whether any context has changed since the specification (answered continue)
- routing: the handoff invokes workflow-planning-process for pay
- state: manifest absent pay.planning.pay status
