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
