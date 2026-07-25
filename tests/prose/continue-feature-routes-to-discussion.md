## case: continue-feature-routes-to-discussion
- origin: feature mainline — navigation shows state and routes to the next phase
- files:
  - skills/workflow-continue-feature/SKILL.md
  - skills/workflow-continue-feature/references/select-feature.md
  - skills/workflow-continue-feature/references/feature-display-and-menu.md

### when

Execute skills/workflow-continue-feature/SKILL.md with no arguments, as
it is invoked when the caller has no work unit pre-selected. Follow it
through selection and the feature's state display. Stop once the state
and its menu have been shown — do not invoke the route.

answers:
1. the number listed against `pay`

### given

world_before: feature-created

### then

world_after: unchanged

trace:
1. initialisation is casing only — no boot and no migrations, which the
   entry skill has already guaranteed
2. shows the selection display and menu even though `pay` is the only
   feature — never auto-selects
3. validates the selection, then shows the feature's pipeline state
4. the state shows no phase started, and the menu's continue action
   routes to discussion entry for work type feature, work unit pay

notes:
- navigation only reads: no phase is started by looking at it
