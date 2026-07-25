## case: continue-bugfix-routes-to-investigation
- origin: bugfix mainline — a fresh bug routes to investigation, not discussion
- files:
  - skills/workflow-continue-bugfix/SKILL.md
  - skills/workflow-continue-bugfix/references/select-bugfix.md
  - skills/workflow-continue-bugfix/references/bugfix-display-and-menu.md

### given

world_before: bugfix-created

### when

Execute skills/workflow-continue-bugfix/SKILL.md with no arguments, as
it is invoked when the caller has no work unit pre-selected. Follow it
through selection and the bugfix's state display. Stop once the state
and its menu have been shown — do not invoke the route.

answers:
1. the number listed against `crash-fix`

### then

world_after: unchanged

trace:
1. initialisation is casing only — boot and migrations belong to the
   entry skill
2. shows the selection display and menu rather than auto-selecting the
   only bugfix
3. validates the selection, then shows the bugfix's pipeline state
4. the state shows no phase started, and the continue action routes to
   investigation entry — a bugfix's first phase is investigation, never
   discussion or specification
