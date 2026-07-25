## case: feature-continue-offers-discussion
- world: feature-created
- origin: feature mainline — continue-feature shows state and routes forward
- files:
  - skills/workflow-continue-feature/SKILL.md
  - skills/workflow-continue-feature/references/select-feature.md
  - skills/workflow-continue-feature/references/feature-display-and-menu.md

### walk

Execute skills/workflow-continue-feature/SKILL.md with no arguments
(as routed from workflow-start with no pre-selected work unit). Follow
selection, then the feature state display and its menu. Record the
state display and menu verbatim, then stop — do not route into any
phase entry skill.

### user

1. Select the feature `pay` (its number in the selection menu)

### expect

- routing: the selection menu is shown even though only one feature exists — no auto-select
- routing: the feature state shows no phase started — the pipeline is fresh
- routing: the menu's forward action for the current state routes to discussion entry (workflow-discussion-entry with feature and pay)
- state: manifest absent pay.discussion.pay status
