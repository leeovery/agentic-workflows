# Feature mainline — happy-path corpus

The canonical feature `pay` walked through its pipeline: navigation,
each phase entry, and the implementation pickup. Worlds are the
`feature-*` fixtures (stop points along `_shared/feature-mainline.cjs`).
Every claim here was verified against the prose at authoring time —
a failure means the behaviour moved, not the numbering.

## case: feature-start-lists-fresh
- world: feature-created
- origin: feature mainline — workflow-start surfaces active work
- files:
  - skills/workflow-start/SKILL.md

### walk

Execute skills/workflow-start/SKILL.md from the top. Initialisation
will find the system already migrated and the knowledge base ready, so
no migration summary or setup conversation applies. Continue until the
work dashboard and its menu are shown. Record both verbatim and stop —
select nothing.

### expect

- routing: initialisation runs the boot pipeline before any work is shown, and with `migrations.changed` false no confirmation gate is raised
- routing: the dashboard lists `pay` as active work
- routing: the menu offers continuing existing work (the path that routes feature work to workflow-continue-feature)
- state: manifest absent pay.discussion.pay status

## case: feature-continue-offers-discussion
- world: feature-created
- origin: feature mainline — continue-feature shows state and routes forward
- files:
  - skills/workflow-continue-feature/SKILL.md
  - skills/workflow-continue-feature/references/select-feature.md
  - skills/workflow-continue-feature/references/feature-display-and-menu.md

### walk

Execute skills/workflow-continue-feature/SKILL.md with no arguments
(as routed from workflow-start with no pre-selected work unit). Follow
selection, then the feature state display and its menu. Record the
state display and menu verbatim, then stop — do not route into any
phase entry skill.

### user

1. Select the feature `pay` (its number in the selection menu)

### expect

- routing: the selection menu is shown even though only one feature exists — no auto-select
- routing: the feature state shows no phase started — the pipeline is fresh
- routing: the menu's forward action for the current state routes to discussion entry (workflow-discussion-entry with feature and pay)
- state: manifest absent pay.discussion.pay status

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

## case: feature-spec-entry-handoff
- world: feature-discussed
- origin: feature mainline — specification entry validates and hands off the discussion
- files:
  - skills/workflow-specification-entry/SKILL.md
  - skills/workflow-specification-entry/references/validate-source.md
  - skills/workflow-specification-entry/references/validate-phase.md
  - skills/workflow-specification-entry/references/invoke-skill.md

### walk

Execute skills/workflow-specification-entry/SKILL.md with arguments
$0=feature, $1=pay. Follow it up to the point where the handoff to the
processing skill is constructed — record the handoff arguments block —
and stop there. Do not execute the processing skill's instructions.

### expect

- routing: the source-material entry gate passes (empty render) — the discussion is complete
- routing: with no specification item in the manifest, the verb is Creating — no resume note, no reopen
- routing: the handoff names the discussion file .workflows/pay/discussion/pay.md as source material
- state: manifest absent pay.specification.pay status

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

## case: feature-implementation-first-task
- world: feature-planned
- origin: feature mainline — implementation entry through to the first task pickup
- files:
  - skills/workflow-implementation-entry/SKILL.md
  - skills/workflow-implementation-entry/references/validate-phase.md
  - skills/workflow-implementation-entry/references/environment-check.md
  - skills/workflow-implementation-process/SKILL.md
  - skills/workflow-implementation-process/references/task-loop.md
  - skills/workflow-planning-process/references/output-formats/local-markdown/reading.md

### walk

Execute skills/workflow-implementation-entry/SKILL.md with arguments
$0=feature, $1=pay, then continue into the processing skill it invokes.
Follow the task loop far enough to determine and start the next
available task. Stop the moment the prose directs you to begin actually
implementing that task (writing code or tests) — implement nothing.

### user

1. none — no special environment setup is needed

### expect

- routing: the plan entry gate passes (empty render) and the implementation is a new entry
- routing: with no environment-setup file recorded, the entry asks the environment question (answered none)
- routing: the next available task per the plan format's reading procedure is pay-1-1 — phase 1, first task, nothing completed yet
- state: manifest equals pay.implementation.pay status in-progress
- state: manifest equals pay.implementation.pay current_task pay-1-1

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
