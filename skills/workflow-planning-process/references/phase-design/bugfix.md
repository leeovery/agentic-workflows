# Bugfix Phase Design

*Context guidance for **[phase-design.md](../phase-design.md)** — bug fixes*

---

## Phase 1 Strategy

Reproduce the bug and implement the fix. Start with a failing test that demonstrates the bug, then fix it.

Phase 1 should:

- Include a test that reliably reproduces the bug (the test fails before the fix, passes after)
- Fix the root cause, not symptoms
- Verify that existing tests still pass (no regressions)
- Be as minimal as possible — change only what's necessary

---

## Single vs Multi-Phase Bugs

Most bugs are **single-phase**: reproduce → fix → regression tests. One phase is sufficient when the bug has a single root cause and the fix is contained.

Multiple phases are warranted when:

- **Multiple root causes** — the bug manifests in one place but originates in different subsystems that need independent fixes
- **Incremental refactoring required** — the fix requires restructuring code that can't be safely changed in one step
- **Large impact area** — the fix touches enough code that dedicated regression verification in a separate phase reduces risk

**Example** (Single-phase — N+1 query):

```
Phase 1: Add eager loading to order query, verify performance, regression tests
```

**Example** (Multi-phase — Race condition in payment processing):

```
Phase 1: Add locking mechanism, fix the core race condition, verify with concurrent test
Phase 2: Add idempotency keys, handle edge cases (duplicate submissions, timeout recovery)
```

---

## Minimal Change Principle

Fix the root cause, don't redesign. The goal is surgical correction:

- Change the minimum code needed to resolve the issue
- Don't expand scope beyond what the specification defines
- Resist the temptation to "improve" surrounding code
- The fix should be easy to review — a reviewer should immediately see what changed and why

---

## Regression Prevention

Regression tests are first-class deliverables, not afterthoughts:

- Every fix includes tests that would have caught the original bug
- Tests verify the fix doesn't break existing behaviour
- Edge cases related to the bug get their own test cases
- If the bug was in a poorly-tested area, the fix improves coverage for that specific area (not a general testing campaign)

---

## Codebase Awareness

Before designing bugfix phases, understand the affected area:

- **Trace the bug's scope** — what code is involved? What calls into it, what does it call? Understanding the boundaries helps design a fix that doesn't cause side effects.
- **Check existing tests** — what coverage exists? This informs whether the fix needs new test infrastructure or can extend existing tests.
- **Understand before fixing** — a minimal fix requires knowing exactly what's broken and why. Don't design phases until the root cause is understood.

This is targeted analysis, not a general codebase review — focus on the code paths involved in the bug.
