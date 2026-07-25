# Bugfix mainline — happy-path corpus

The canonical bugfix `crash-fix` walked through what makes bugfix
distinct from the linear pipeline: investigation entry seeded from the
bug's carrier, the root-cause validation agent's full lifecycle, and a
specification sourced from an investigation rather than a discussion.
The delivery phases it shares with feature are covered by the feature
corpus and not repeated here.

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

## case: bugfix-investigation-entry-seeds
- world: bugfix-created
- origin: bugfix mainline — investigation entry seeds from the carrier, never re-asks
- files:
  - skills/workflow-investigation-entry/SKILL.md
  - skills/workflow-investigation-entry/references/invoke-skill.md

### walk

Execute skills/workflow-investigation-entry/SKILL.md with arguments
$0=bugfix, $1=crash-fix. Follow it up to the point where the handoff to
the processing skill is constructed — record the handoff arguments
block — and stop there. Do not execute the processing skill's
instructions.

### expect

- routing: with no investigation item in the manifest, source is new — the phase-validation path is not taken
- routing: because a discovery session log exists, the bug context is seeded from the manifest description and that log — the gather-context questioning path is not taken, and the walk asks the user nothing
- routing: a phase note is rendered by the engine for the investigation phase, with the verb Starting
- routing: the handoff invokes workflow-investigation-process for crash-fix
- state: manifest absent crash-fix.investigation.crash-fix status

## case: bugfix-root-cause-validation-lifecycle
- world: bugfix-investigating
- origin: bugfix mainline — the validation agent's dispatch → scan → incorporate lifecycle
- files:
  - skills/workflow-investigation-process/references/root-cause-validation.md

### walk

The investigation is open with its root cause documented, and the
process has reached its root-cause validation step. Execute
skills/workflow-investigation-process/references/root-cause-validation.md
from the top, as the processing skill would. Stop when the reference
returns to its caller.

### user

1. yes — run root cause validation

### stub

The prose directs a validation agent to be dispatched via the Task
tool. Do not dispatch one. Instead, after recording the dispatch, write
the report yourself to the exact `file` path the dispatch response
returned, containing:

    # Root Cause Validation

    The tax context is built before the payment intent and reads the
    shipping address unconditionally. Traced fresh: an address-less
    order fails at that read, matching the documented root cause.

    STATUS: validated
    CONFIDENCE: high
    GAPS_COUNT: 0
    SUMMARY: Root cause confirmed by an independent trace.

Then continue the prose as if the agent had returned that result.

### expect

- routing: the dispatch is recorded through the engine, and the report path used is the one the dispatch response returned — the prose does not invent or pre-create the file
- routing: after the report lands, the row is promoted by a scan and then closed by an incorporate — the verdict is consumed inline, never surfaced finding by finding
- routing: on a validated verdict the reference reports validation with its confidence and returns to the caller — the gaps-handling menu is not reached
- state: file exists .workflows/.cache/crash-fix/investigation/crash-fix/root-cause-validation-001.md
- state: json .workflows/.cache/crash-fix/investigation/crash-fix/state.json agents.root-cause-validation-001.status incorporated

## case: bugfix-spec-entry-sources-investigation
- world: bugfix-investigated
- origin: bugfix mainline — the spec's source is the investigation, not a discussion
- files:
  - skills/workflow-specification-entry/SKILL.md
  - skills/workflow-specification-entry/references/validate-source.md
  - skills/workflow-specification-entry/references/invoke-skill.md

### walk

Execute skills/workflow-specification-entry/SKILL.md with arguments
$0=bugfix, $1=crash-fix. Follow it up to the point where the handoff to
the processing skill is constructed — record the handoff arguments
block — and stop there. Do not execute the processing skill's
instructions.

### expect

- routing: the source-material entry gate passes (empty render) — the completed investigation satisfies it for a bugfix
- routing: with no specification item in the manifest, the verb is Creating
- routing: the handoff names the investigation file .workflows/crash-fix/investigation/crash-fix.md as source material — no discussion file is named
- state: manifest absent crash-fix.specification.crash-fix status
