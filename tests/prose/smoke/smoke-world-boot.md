## case: smoke-world-boot
- world: base
- origin: framework smoke — world build, engine-in-world, state assertions
- files:
  - skills/workflow-start/SKILL.md#Boot

### walk

In the project, run the boot command exactly as the initialisation prose
of skills/workflow-start/SKILL.md prescribes (sandbox concerns do not
apply in this world — run it directly). Capture the JSON response. Stop
immediately after recording it — do not continue into any confirmation
prompt or later step.

### expect

- routing: the boot response reports the knowledge base ready (keyword-only mode)
- routing: the boot response reports no migrations applied on this run (the world is already migrated)
- state: file exists .workflows/.state/migrations
