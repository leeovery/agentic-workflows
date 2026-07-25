## case: bugfix-continue-offers-investigation
- world: bugfix-created
- origin: bugfix mainline — continue-bugfix routes a fresh bug to investigation
- files:
  - skills/workflow-continue-bugfix/SKILL.md
  - skills/workflow-continue-bugfix/references/select-bugfix.md
  - skills/workflow-continue-bugfix/references/bugfix-display-and-menu.md

### walk

Execute skills/workflow-continue-bugfix/SKILL.md with no arguments (as
routed from workflow-start with no pre-selected work unit). Follow
selection, then the bugfix state display and its menu. Record the state
display and menu verbatim, then stop — do not route into any phase
entry skill.

### user

1. Select the bugfix `crash-fix` (its number in the selection menu)

### expect

- routing: the state display shows no phase started — the pipeline is fresh
- routing: the menu's continue action routes to investigation entry (workflow-investigation-entry with bugfix and crash-fix), not to discussion or specification
- state: manifest absent crash-fix.investigation.crash-fix status
