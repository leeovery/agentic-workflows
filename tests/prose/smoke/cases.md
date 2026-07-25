# Smoke cases — the framework proving itself

Not corpus: these two cases exercise every moving part of the machinery
(parser, anchor checks, world builder, engine-in-world, state assertions,
walker protocol) against prose stable enough to survive. If a smoke case
fails, suspect the framework before the prose.

## case: smoke-structure-start-boot
- origin: framework smoke — structure-only walk, no world
- files:
  - skills/workflow-start/SKILL.md#Boot

### walk

Structure-only: read the initialisation portion of
skills/workflow-start/SKILL.md — everything the skill does before any
work is shown or routed. Establish what the initialisation consists of
and in what order its parts run. Stop there — do not trace the rest of
the skill.

### expect

- routing: casing conventions are loaded before the boot pipeline runs
- routing: the boot pipeline is declared mandatory — the skill must complete it before proceeding

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
