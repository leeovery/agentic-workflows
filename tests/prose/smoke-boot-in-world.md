## case: smoke-boot-in-world
- origin: framework smoke — world build, engine-in-world, world comparison
- files:
  - skills/workflow-start/SKILL.md#Boot

### given

world_before: base

### when

In the project, run the boot command exactly as the initialisation prose
of skills/workflow-start/SKILL.md prescribes — sandbox concerns do not
apply in this world, so run it directly. Capture the JSON response, then
stop; do not continue into any confirmation or later step.

### then

world_after: unchanged

trace:
1. runs the boot command and reports the knowledge base ready, in
   keyword-only mode
2. reports no migrations applied — this world is already migrated — so
   the migrations summary and its confirmation are not raised

notes:
- booting an already-migrated project changes nothing on disk
