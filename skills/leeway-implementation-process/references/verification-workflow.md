# Verification Workflow

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

## The Cycle

BASELINE → CHANGE → VERIFY → LINT

Repeat for each task. **Never skip steps. Never reorder.**

### Mechanical Change Discipline

This is NOT TDD. Quick-fixes are mechanical changes where the change is well-defined and existing tests serve as the safety net. The mandatory discipline is **baseline-first**:
- You MUST capture a passing test baseline before any changes
- You MUST make changes systematically (not ad hoc)
- You MUST verify tests still pass after changes
- You MUST NOT change test assertions to accommodate your changes (if a test fails, the change broke something — fix the change)

## BASELINE: Capture Current State

1. Run the full test suite (or relevant subset for the change's scope)
2. Record which tests pass — this is your baseline
3. If tests are already failing, note them separately — these are pre-existing failures, not caused by your change

**Do not proceed if the baseline cannot be established.** Report back if the test suite doesn't run.

## CHANGE: Apply Mechanical Transformation

1. Read the task's implementation steps
2. Apply the change systematically across all target files
3. Use search/replace patterns where possible for consistency
4. Check for completeness: verify no occurrences of the old pattern remain in the target scope
5. If the change affects test files (e.g., tests reference the old API/syntax), update them to use the new form

## VERIFY: Confirm No Regressions

1. Run the same test suite from BASELINE
2. Compare results — all previously passing tests must still pass
3. If new failures appear:
   - Inspect the failure — is it caused by your change?
   - If yes: fix the change (not the test) and re-verify
   - If no: note as pre-existing and continue
4. Confirm completeness — search for remaining occurrences of the old pattern in scope

## LINT: After Verification

If linter commands are configured (passed by the orchestrator):
1. Run each linter command
2. If issues found: fix them
3. Re-run linter to confirm clean
4. Re-run tests to confirm no regressions
5. If a linter fix breaks tests: revert the fix and note it in your report

If no linters configured, skip this step.

## COMMIT: Orchestrator Responsibility

The executor agent does NOT commit. Your responsibility ends at VERIFY — all tests passing and change complete. The orchestrator commits after review approval.

## When Tests CAN Change

- Tests reference the old syntax/API being changed — update them to use the new form
- Pre-existing test failures unrelated to your change
- Genuine bug in test logic discovered during the change

## When Tests CANNOT Change

- To make broken code pass → **fix the code**
- To accommodate unintended behavioral changes → **this is not a quick-fix**
- To skip difficult verification → **do the verification**
