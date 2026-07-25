## case: root-cause-validation-clean-verdict
- origin: bugfix mainline — the validation agent's lifecycle on a clean verdict
- files:
  - skills/workflow-investigation-process/references/root-cause-validation.md

### given

world_before: bugfix-investigating

The investigation is open with its symptoms gathered and its root cause
documented. The processing skill has worked down to its root-cause
validation step; nothing has been validated yet and no agent has run.

### when

Walk root-cause-validation.md from the top, as the processing skill
would. Stop when the reference returns to its caller.

answers:
1. yes — run root cause validation

stubs:
  - root-cause-validated: when the engine records a dispatch of kind root-cause-validation

### then

world_after: bugfix-validation-incorporated

trace:
1. offers the independent validation, presents the run-or-skip choice,
   and waits
2. on yes, records the dispatch through the engine and creates no report
   file of its own — the response carries the id and the path to use
3. announces that validation is running, then dispatches exactly one
   agent, synchronously
4. once the report has landed, promotes the row with a scan and closes
   it with an incorporate — the verdict is consumed whole, never
   surfaced finding by finding
5. reads the report and, the verdict being validated, states the
   confidence and returns to its caller — the gap-handling choice is
   never reached

notes:
- the investigation file is untouched and nothing is committed: the
  validated path has no gaps to record
