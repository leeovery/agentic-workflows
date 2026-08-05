# stub: reviewer-task-flags-then-approves

A task reviewer that finds one blocking issue on its first look at a
task and approves on the next. Track firings per dispatched task: the
first firing for a given task returns the needs-changes block; any
later firing for the same task returns the approved block. Fill the
TASK line from the dispatched task both times. Write no file — the
verdict is the whole result.

---

First firing for a task:

```
TASK: {the dispatched task's title}
VERDICT: needs-changes
SPEC_CONFORMANCE: conformant
ACCEPTANCE_CRITERIA: all met
TEST_COVERAGE: gaps — the failure path is described, not driven
CONVENTIONS: followed
ARCHITECTURE: sound
ISSUES:
- The failure path is described in a test-file comment but never driven by a test ({the task's test file}:1)
  FIX: Add a test that drives the failure path and asserts the surfaced error
  CONFIDENCE: high
NOTES:
- none
```

Any later firing for the same task:

```
TASK: {the dispatched task's title}
VERDICT: approved
SPEC_CONFORMANCE: conformant
ACCEPTANCE_CRITERIA: all met
TEST_COVERAGE: adequate
CONVENTIONS: followed
ARCHITECTURE: sound
NOTES:
- none
```
