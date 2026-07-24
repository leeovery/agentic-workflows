# Smoke cases — the framework proving itself

Not corpus: these two cases exercise every moving part of the machinery
(parser, anchor checks, world builder, engine-in-world, state assertions,
walker protocol) against prose stable enough to survive. If a smoke case
fails, suspect the framework before the prose.

## case: smoke-structure-start-boot
- origin: framework smoke — structure-only walk, no world
- files:
  - skills/workflow-start/SKILL.md#Step 0.2: Boot

### walk

Structure-only: read skills/workflow-start/SKILL.md's Step 0 and its
sub-steps. Establish the order of Step 0's parts and what Step 0.2
declares about the boot pipeline. Stop after Step 0 — do not trace the
rest of the skill.

### expect

- routing: Step 0.1 (casing conventions) is prescribed before Step 0.2 (boot)
- routing: Step 0.2 declares the boot pipeline mandatory — it must complete before proceeding

## case: smoke-world-boot
- world: base
- origin: framework smoke — world build, engine-in-world, state assertions
- files:
  - skills/workflow-start/SKILL.md#Step 0.2: Boot

### walk

In the project, run the boot command exactly as Step 0.2 of
skills/workflow-start/SKILL.md prescribes (sandbox concerns do not apply
in this world — run it directly). Capture the JSON response. Stop
immediately after recording it — do not continue into Step 0's
confirmation prompt or any later step.

### expect

- routing: the boot response reports the knowledge base ready (keyword-only mode)
- routing: the boot response reports no migrations applied on this run (the world is already migrated)
- state: file exists .workflows/.state/migrations
