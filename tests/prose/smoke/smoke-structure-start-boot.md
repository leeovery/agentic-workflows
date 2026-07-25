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
