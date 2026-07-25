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
