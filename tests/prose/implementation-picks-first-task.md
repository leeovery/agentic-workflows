## case: implementation-picks-first-task
- origin: feature mainline — entry through resume detection to the first task
- files:
  - skills/workflow-implementation-entry/SKILL.md
  - skills/workflow-implementation-entry/references/validate-phase.md
  - skills/workflow-implementation-entry/references/validate-dependencies.md
  - skills/workflow-implementation-entry/references/environment-check.md
  - skills/workflow-implementation-process/SKILL.md
  - skills/workflow-implementation-process/references/environment-setup.md
  - skills/workflow-implementation-process/references/task-loop.md
  - skills/workflow-planning-process/references/output-formats/local-markdown/reading.md

### given

world_before: feature-planned

### when

Execute skills/workflow-implementation-entry/SKILL.md with arguments
$0=feature, $1=pay, then continue into the processing skill it invokes.
Follow the flow until the prose directs you to begin building the first
task. Stop there — write no implementation code and no tests.

answers:
1. none — no special setup is needed

### then

world_after: feature-implementation-started

trace:
1. the plan gate renders empty, and no implementation item exists, so
   this is a new entry
2. dependency validation returns immediately — external dependencies are
   an epic concern
3. the environment check finds no setup document and asks the question,
   gathering the answer without acting on it
4. resume detection initialises tracking and reports the created mode —
   the fresh path, which commits the start of implementation, never the
   resuming-from-a-previous-session note
5. environment setup records the answer as a setup document and commits
   it, so the question is not asked again in a later session
6. reads the plan through the format's own reading procedure and finds
   pay-1-1 next: phase one, first task, nothing completed
7. starts pay-1-1 and stops where the prose hands over to building

notes:
- the second task is neither started nor touched
