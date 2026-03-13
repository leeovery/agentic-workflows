# Bugfix Task Design

*Context guidance for **[task-design.md](../task-design.md)** — bug fixes*

---

## Root-Cause-First Ordering

In bugfix work, the first task always reproduces the bug with a failing test, then fixes it. Foundation = the reproduction test and the minimal fix.

**Example** ordering within a phase:

```
Task 1: Failing test for the N+1 query + add eager loading (reproduce + fix)
Task 2: Verify performance with large dataset (validation)
Task 3: Regression tests for related query paths (prevention)
```

The first task proves the bug exists and fixes it. Subsequent tasks harden the fix.

---

## Bugfix Vertical Slicing

Each task changes the minimum code needed. A bugfix task is well-scoped when you can describe both the before (broken) and after (fixed) states in one sentence.

**Example** (Single root cause):

```
Task 1: Add failing test demonstrating the race condition + add lock (fix)
Task 2: Handle lock timeout and retry (error handling)
Task 3: Concurrent access regression tests (prevention)
```

**Example** (Multiple related issues):

```
Task 1: Fix primary null pointer with guard clause + test (core fix)
Task 2: Fix secondary data truncation at boundary + test (related fix)
Task 3: Add integration test covering the full workflow (regression)
```

---

## Minimal Change Focus

Each task changes the minimum code needed:

- Don't refactor adjacent code
- Don't add features while fixing bugs
- Keep the diff small and reviewable
- If a task starts growing beyond the fix, it's probably two tasks

---

## Codebase Analysis During Task Design

Tasks must be designed with knowledge of the affected code:

- **Understand the bug's context** — what code is involved? What tests exist? What are the inputs, outputs, and side effects of the affected code?
- **Design tasks around existing structure** — bug fixes should work within the existing architecture. Don't design tasks that require restructuring unless the specification explicitly calls for it.
- **Keep scope surgical** — bugfix tasks should touch as few files as possible. If a task needs to touch many files, question whether the fix is truly minimal.
- **Leverage existing tests** — if relevant tests exist, tasks can extend them. If not, the reproduction test becomes the foundation.

This analysis happens during task design — it informs what needs to change without being documented separately.
