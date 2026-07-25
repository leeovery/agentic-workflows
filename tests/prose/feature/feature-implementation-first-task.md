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
- routing: the processing skill's resume detection reports mode created — the fresh path, with its start-implementation commit — never the resuming-from-previous-session note
- routing: the next available task per the plan format's reading procedure is pay-1-1 — phase 1, first task, nothing completed yet
- state: manifest equals pay.implementation.pay status in-progress
- state: manifest equals pay.implementation.pay current_task pay-1-1
