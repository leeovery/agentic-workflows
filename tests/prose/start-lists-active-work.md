## case: start-lists-active-work
- origin: feature mainline — the entry skill surfaces work without touching it
- files:
  - skills/workflow-start/SKILL.md

### given

world_before: feature-created

### when

Execute skills/workflow-start/SKILL.md from the top. Continue until the
work dashboard and its menu have been shown. Record both verbatim, then
stop — select nothing.

### then

world_after: unchanged

trace:
1. loads the shared casing conventions before any state is read
2. runs the boot pipeline, and since no migrations applied and the
   knowledge base is ready, raises neither the migrations confirmation
   nor the knowledge gate
3. gets the workflow state from the discovery gateway script rather than
   listing directories or reading files itself
4. shows `pay` as the only active work, with a menu whose continue action
   leads into the per-type navigation for a feature

notes:
- showing work is a read: nothing is created, recorded, or committed
