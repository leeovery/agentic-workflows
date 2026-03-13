# TDD Workflow

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

## The Cycle

RED → GREEN → REFACTOR → LINT

Repeat for each task. **Never skip steps. Never reorder.**

### Pragmatic TDD

This is pragmatic TDD, not purist. The mandatory discipline is **test-first sequencing**:
- You MUST write a failing test before implementation
- You MUST see it fail for the right reason
- You MUST NOT change tests to make broken code pass

But write **complete, functional implementations** - don't artificially minimize with hardcoded returns or fake values that you'll "fix later". "Minimal" means no gold-plating beyond what the test requires, not "return 42 and triangulate".

## TDD Violation Recovery

**If you catch yourself violating TDD, stop immediately and recover:**

| Violation | Recovery |
|-----------|----------|
| Wrote code before test | DELETE the code. Write the failing test. Then rewrite the code. |
| Multiple failing tests | Comment out all but one. Fix that one. Uncomment next. |
| Test passes immediately | Suspicious. Verify the test actually exercises your code. Check for false positives. |
| Changed test to make code pass | REVERT the test change. Fix the implementation instead. |
| "While I'm here" improvement | STOP. Is it in the plan? No? Don't do it. |

**These are not suggestions. Skipping recovery corrupts the entire TDD discipline.**

## RED: Write Failing Test

1. Read task's micro acceptance criteria
2. Write test asserting that behavior
3. Run test - **MUST fail**
4. Verify it fails for the **right reason** (not syntax error, not missing import)

**Derive tests from plan**: Task's micro acceptance becomes your first test. Edge cases become additional tests.

**Assert precisely**: For mutation operations (create, update, delete, state transitions), don't just assert the return value — verify observable side effects independently. A test that checks "operation succeeded" but ignores whether timestamps updated, related records changed, or output structure is correct will miss regressions that only affect side effects. Assert structured output by parsing and checking fields/values, not by string matching the serialized form.

**Write test names first**: List all test names before writing bodies. Confirm coverage matches acceptance criteria. Then consider: invalid input types, boundary values, zero/nil/empty inputs, single vs multiple items, and success alongside failure paths — add tests for any that are relevant and non-trivial.

**No implementation code exists yet.** If you're tempted to "just sketch out the class first" - don't. The test comes first. Always.

## GREEN: Implementation

Write complete, functional code that passes:
- No extra features beyond what the test requires
- No "while I'm here" improvements
- No edge cases not yet tested

If you think "I should also handle X" - STOP. Write a test for X first.

**One test at a time**: Write test → Run (fails) → Implement → Run (passes) → Commit → Next

## REFACTOR: Only When Green

**Do**: Remove duplication, improve naming, extract methods
**Don't**: Touch code outside current task, optimize prematurely

Run tests after. If they fail, undo the refactor.

## LINT: After Refactor

If linter commands are configured (passed by the orchestrator):
1. Run each linter command
2. If issues found: fix them
3. Re-run linter to confirm clean
4. Re-run tests to confirm no regressions
5. If a linter fix breaks tests: revert the fix and note it in your report

If no linters configured, skip this step.

## COMMIT: Orchestrator Responsibility

The executor agent does NOT commit. Your responsibility ends at GREEN — all tests passing. The orchestrator commits after review approval, one commit per approved task covering code, tests, tracking, and plan progress.

## When Tests CAN Change

- Genuine bug in test logic
- Test asserts implementation details, not behavior
- Missing setup/fixtures

## When Tests CANNOT Change

- To make broken code pass → **fix the code**
- To avoid difficult implementation → **the test IS the requirement**
- To skip temporarily → **fix it now or escalate**

Changing a test to pass is admitting the implementation is wrong and hiding it. Don't.
