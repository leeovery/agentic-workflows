# Task Design

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This reference defines generic principles for breaking phases into tasks and writing task detail.

A work-type context file (epic, feature, or bugfix) is always loaded alongside this file. The context file provides task ordering, slicing examples, and work-type-specific guidance. These generic principles apply across all work types.

## One Task = One TDD Cycle

Write test → implement → pass → commit. Each task produces a single, verifiable increment.

---

## Cross-Cutting References

Cross-cutting specifications (e.g., caching strategy, error handling conventions, rate limiting policy) are not things to build — they are architectural decisions that influence how features are built. They inform technical choices within the plan without adding scope.

If cross-cutting specifications were provided alongside the specification:

1. **Apply their decisions** when designing tasks (e.g., if caching strategy says "cache API responses for 5 minutes", reflect that in relevant task detail)
2. **Note where patterns apply** — when a task implements a cross-cutting pattern, reference it
3. **Include a "Cross-Cutting References" section** in the plan linking to these specifications

Cross-cutting references are context, not scope. They shape how tasks are written, not what tasks exist.

---

## Tasks That Edit Historical Artifacts

A task whose edits land on another work unit's specification under `.workflows/` corrects a historical artifact. Fold the completed-unit protocol from **[correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** into the task itself — in-place edit, corrigenda entry, knowledge re-index, scoped commit — as **Do** steps and **Acceptance Criteria**. The re-index is part of the task, never an afterthought. No task edits any other phase artifact of another work unit — non-spec artifacts are superseded by current work, never corrected.

---

## Comments Are Not Task Content

**Do** steps direct code and tests, never commentary. Rationale, sequencing notes, and spec citations belong in the task's Problem/Context fields and the plan itself — never directed into source comments ("state in-source that…", "record why in a comment…"). A comment dictated by a task becomes an acceptance criterion the reviewer must police, and its claims go stale as later tasks land.

A task may require a comment only where the code cannot express a constraint — a warning against a tempting wrong simplification, a non-obvious invariant — directed in one line ("comment that the discard must come last") with the wording left to the executor. Never direct comments that reference other tasks, phases, spec sections, or what tests cover.

---

## Vertical Slicing

Prefer **vertical slices** that deliver complete, testable functionality over horizontal slices that separate by technical layer.

The test: *can this task be verified independently?* If yes, it's a good vertical slice. If it only works once other tasks are complete, it's probably a horizontal slice.

TDD naturally encourages vertical slicing — when you think "what test can I write?", you frame work as complete, verifiable behaviour rather than technical layers.

The context file provides examples of vertical slicing appropriate to the work type.

---

## Scope Signals

### Too big

A task is probably too big if:

- The "Do" section exceeds 5 concrete steps
- You can't describe the test in one sentence
- It touches more than one architectural boundary (e.g., both API endpoint and queue worker)
- Completion requires multiple distinct behaviours to be implemented

Split it. Two focused tasks are better than one sprawling task.

### Too small

A task is probably too small if:

- It's a single line change with no meaningful test
- It's mechanical housekeeping (renaming, moving files) that doesn't warrant its own TDD cycle
- It only makes sense as a step within another task

Merge it into the task that needs it.

### The independence test

Ask: "Can I write a test for this task that passes without any other task being complete (within this phase)?" If yes, it's well-scoped. If no, it might need to be merged with its dependency or reordered.

---

## Task Template

This is the canonical task format. The planning skill owns task content — output format adapters only define where/how this content is stored.

Every task should follow this structure:

```markdown
### Task N: [Clear action statement]

**Problem**: Why this task exists — what issue or gap it addresses.

**Solution**: What we're building — the high-level approach.

**Outcome**: What success looks like — the verifiable end state.

**Do**:
- Specific implementation steps
- File locations and method names where helpful
- Concrete guidance, not vague directions

**Acceptance Criteria**:
- [ ] First verifiable criterion
- [ ] Second verifiable criterion
- [ ] Edge case handling criterion

**Tests**:
- `"it does the primary expected behaviour"`
- `"it handles edge case correctly"`
- `"it fails appropriately for invalid input"`

**Edge Cases**: (when relevant)
- Boundary condition details
- Unusual inputs or race conditions

**Context**: (when relevant)
> Relevant details from specification: code examples, architectural decisions,
> data models, or constraints that inform implementation.

**Spec Reference**: `.workflows/{work_unit}/specification/{topic}/specification.md` (if specification was provided)
```

### Field Requirements

| Field | Required | Notes |
|-------|----------|-------|
| Problem | Yes | One sentence minimum — why this task exists |
| Solution | Yes | One sentence minimum — what we're building |
| Outcome | Yes | One sentence minimum — what success looks like |
| Do | Yes | At least one concrete action |
| Acceptance Criteria | Yes | At least one pass/fail criterion |
| Tests | Yes | At least one test name; include edge cases, not just happy path |
| Edge Cases | When relevant | Boundary conditions, unusual inputs |
| Context | When relevant | Only include when spec has details worth pulling forward |
| Spec Reference | When provided | Path to specification for ambiguity resolution. Include when a specification file was provided as input. Omit if planning from inline context or other non-file sources. |

### The Template as Quality Gate

If you struggle to articulate a clear Problem for a task, this signals the task may be:

- **Too granular**: Merge with a related task
- **Mechanical housekeeping**: Include as a step within another task
- **Poorly understood**: Revisit the specification

Every standalone task should have a reason to exist that can be stated simply. The template enforces this — difficulty completing it is diagnostic information, not a problem to work around.
