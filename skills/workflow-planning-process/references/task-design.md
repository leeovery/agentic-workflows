# Task Design

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This reference defines generic principles for breaking phases into tasks and writing task detail.

A work-type context file (epic, feature, or bugfix) is always loaded alongside this file. The context file provides task ordering, slicing examples, and work-type-specific guidance. These generic principles apply across all work types.

## What a Task Carries

The plan carries what the specification decided — product and how alike — and adds only the work's own structure. It states no mechanism the specification did not decide: a seam, the state a component keeps, a byte, a cap, an ordering inside a task, a helper's shape. A how the record left open stays open for the implementer, who reads the task, the specification sections it cites, and the code.

Write as a product owner who knows the shape of the codebase — product altitude for what a task delivers and how you would see that it does; engineering judgment for how the work is cut: which task, what order, what depends on what, where a slice lives.

**Self-contained** means everything the record decided about this slice is in the task, and the task names where the rest lives. The executor and the reviewer both receive the specification path, so a task that cites its sections is complete, not deferred.

---

## One Task = One TDD Cycle

Write test → implement → pass → commit. Each task produces a single, verifiable increment. The executor writes the tests from the task's acceptance criteria — the plan names the behaviour, never the test.

---

## Cross-Cutting References

Cross-cutting specifications (e.g., caching strategy, error handling conventions, rate limiting policy) are not things to build — they are architectural decisions that influence how features are built. They inform technical choices within the plan without adding scope.

If cross-cutting specifications were provided alongside the specification:

1. **Apply their decisions** when designing tasks (e.g., if caching strategy says "cache API responses for 5 minutes", reflect that in relevant task detail)
2. **Note where patterns apply** — when a task implements a cross-cutting pattern, reference it
3. **Include a "Cross-Cutting References" section** in the plan linking to these specifications

Cross-cutting references are context, not scope. They shape how tasks are written, not what tasks exist.

---

## Cross-Phase Deferrals

A deferral is a phase-level fact. When a task defers work to another phase, the deferral belongs in the receiving phase's acceptance criteria — never held only in the deferring task. Later phases' task designers and the plan review read phase definitions, not sibling phases' task tables, so a deferral recorded only in a task goes unseen and the receiving phase allocates nothing for it.

---

## Historical Artifacts Are Not Task Content

No task edits another work unit's artifact under `.workflows/` — the executor writes code and tests alone. A completed unit's specification the planned work shows wrong is noted in the task's Context, never folded into the task: the session corrects it through **[correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** — in-place edit, corrigenda entry, knowledge re-index, scoped commit, behind its gate. Non-spec artifacts of another work unit are superseded by current work, never corrected.

---

## Comments Are Not Task Content

A **Do** entry directs code, never commentary. Rationale, sequencing notes, and spec citations belong in the task's Problem/Context fields and the plan itself — never directed into source comments ("state in-source that…", "record why in a comment…"). A comment dictated by a task becomes an acceptance criterion the reviewer must police, and its claims go stale as later tasks land.

A task may require a comment only where the code cannot express a constraint — a warning against a tempting wrong simplification, a non-obvious invariant — directed in one line ("comment that the discard must come last") with the wording left to the executor. Never direct comments that reference other tasks, phases, spec sections, or what tests cover.

Acceptance criteria bind the same way as **Do** entries. No criterion asks for reasoning, a rejected alternative, or a design argument to be recorded anywhere — a comment, a docstring, the specification, any document. The reasoning already lives in the specification and the plan; a criterion that asks for it again only relocates it into source, where the one-line comment allowance cannot hold it.

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

- Its acceptance criteria run past a handful of scenarios
- You can't state what it delivers in one sentence
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

**Acceptance Criteria**:
- [ ] With no saved session, opening the panel shows the empty state and no error
- [ ] Choosing "Restore" on a saved session reopens it at the pane it was left in
- [ ] A key the screen does not offer never acts

**Do**: (when the record decided it)
- What the specification decided about the how — a pattern it names, a file or command it cites
- Where the work lives

**Context**: (when relevant)
> Relevant details from specification: code examples, architectural decisions,
> data models, or constraints that inform implementation.

**Spec Reference**: `.workflows/{work_unit}/specification/{topic}/specification.md` — §{the sections this task traces to} (if specification was provided)
```

### Acceptance Criteria

A criterion is a **scenario**: a starting state, an action, and an observable outcome — what appears on screen, what a command does, what a call returns. It is checkable without opening the code, and it traces to a specification section. Rule form — a constraint that holds everywhere, a limit — only where a scenario would be contrived.

An edge the specification decided is a criterion. An edge it did not decide is not the plan's to name.

The criteria are the test's specification: the executor names and writes the tests from them.

### Do

Optional, and record-sourced. It carries what the specification decided about the how — a pattern the discussion chose, a file or command the specification cites — and where the work lives. Never a mechanism you chose: a how the specification leaves open is left open, not filled.

### Field Requirements

| Field | Required | Notes |
|-------|----------|-------|
| Problem | Yes | One sentence minimum — why this task exists |
| Solution | Yes | One sentence minimum — what we're building |
| Outcome | Yes | One sentence minimum — what success looks like |
| Acceptance Criteria | Yes | At least one scenario, each tracing to a specification section |
| Do | When the record decided it | What the specification decided about the how, and where the work lives |
| Context | When relevant | Only include when spec has details worth pulling forward |
| Spec Reference | When provided | Path to the specification and the sections this task traces to — where the rest lives. Include when a specification file was provided as input. Omit if planning from inline context or other non-file sources. |

### The Template as Quality Gate

If you struggle to articulate a clear Problem for a task, this signals the task may be:

- **Too granular**: Merge with a related task
- **Mechanical housekeeping**: Include as a step within another task
- **Poorly understood**: Revisit the specification

Every standalone task should have a reason to exist that can be stated simply. The template enforces this — difficulty completing it is diagnostic information, not a problem to work around.
