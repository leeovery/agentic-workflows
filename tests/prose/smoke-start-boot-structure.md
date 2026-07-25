## case: smoke-start-boot-structure
- origin: framework smoke — a structure-only walk, no world
- files:
  - skills/workflow-start/SKILL.md#Boot

### given

world_after is unchanged because this case executes nothing.

### when

Structure-only: read the initialisation portion of
skills/workflow-start/SKILL.md — everything the skill does before any
work is shown or routed. Establish what initialisation consists of and
in what order its parts run. Stop there; do not trace the rest of the
skill.

### then

world_after: unchanged

trace:
1. casing conventions are loaded before the boot pipeline runs
2. the boot pipeline is declared mandatory — it must complete before the
   skill proceeds
3. the knowledge gate is reached only after boot, and branches on what
   boot reported rather than on its own checks
