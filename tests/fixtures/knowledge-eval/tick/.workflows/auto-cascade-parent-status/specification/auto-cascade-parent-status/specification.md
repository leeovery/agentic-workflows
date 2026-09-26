---
topic: auto-cascade-parent-status
status: concluded
type: feature
work_type: feature
date: 2026-03-05
review_cycle: 4
finding_gate_mode: gated
sources:
  - name: auto-cascade-parent-status
    status: incorporated
---

# Specification: Auto-Cascade Parent Status

## Specification

### Core Concept

Tick's parent-child model treats parents as **containers** — organizational groupings whose status reflects aggregate child state. This is already baked into Tick's ready/blocked rules (`ReadyNoOpenChildren` prevents parents from being ready while children are open).

Auto-cascade extends this model: task status changes propagate automatically through the ancestor/descendant chain. Behavior is **unconditional** — no configuration system, no opt-in/opt-out. Two driving principles:

1. **Cancelled is a hard stop** — cannot add children, dependencies, or reopen children under a cancelled task. Requires explicit reopen first.
2. **Done is soft and revisitable** — adding a child to a done parent triggers automatic reopen.

Dependencies remain **advisory** — they affect queries (ready/blocked) not transitions. Cascades follow the same principle: dependency status does not gate state changes.

### Cascade Rules

Eleven rules govern all transition, validation, and cascade behavior. Rules 1, 10, and 11 are existing logic to be migrated; the rest are new.

#### Upward Cascades

**Rule 1: Transition validation** (existing)
Standard transition table — `open → in_progress`, `open → done`, `open → cancelled`, `in_progress → done`, `in_progress → cancelled`, `done/cancelled → open` (reopen). Invalid transitions return an error.

**Rule 2: Upward start cascade**
When a child transitions to `in_progress`, walk the ancestor chain and set any `open` ancestors to `in_progress`. Recursive — applies to grandparents and beyond.

**Rule 3: Upward completion cascade**
When all children of a parent reach a terminal state (`done` or `cancelled`), the parent automatically transitions:
- If at least one child is `done` → parent goes to `done`
- If all children are `cancelled` → parent goes to `cancelled`

Trigger: when a task reaches a terminal state, evaluate only its direct parent. If the parent transitions, evaluate the parent's parent, and so on up the chain.

#### Downward Cascades

**Rule 4: Downward done/cancel cascade**
When a parent is marked `done` or `cancelled`, non-terminal children (`open`, `in_progress`) copy the parent's terminal status. Children already `done` or `cancelled` are left untouched. Recursive — applies to grandchildren and beyond.

Dependency state on target children does not gate cascade transitions — a child with unresolved dependencies is still cascaded. Consistent with the advisory dependency principle.

#### Reopen Behavior

**Rule 5: Auto-done undo**
When a child is reopened under a `done` parent, the parent reopens to `open`. The parent's `done` status was derived from all children being terminal — that premise is now broken.

Rule 5 applies recursively up the ancestor chain via the cascade queue. If a parent reopens under a done grandparent, the grandparent also reopens. This is consistent: each ancestor's `done` status was derived from all children being terminal — that premise is broken at every level.

**Rule 6: New child added to done parent**
Adding a non-terminal child to a `done` parent triggers parent reopen to `open`. Same principle as Rule 5. Applies to both task creation with a done parent and reparenting an existing task to a done parent.

`ValidateAddChild()` handles only validation — it blocks adding a child to a cancelled parent (Rule 7) and returns nil otherwise. The Rule 6 reopen (done parent → open) is the caller's responsibility: after validation passes, the caller checks if the parent is `done` and calls `Transition()` to reopen it before adding the child. This keeps `ValidateAddChild` as pure validation.

**Rule 9: Block reopen under cancelled parent**
Cannot reopen a child under a `cancelled` parent. Error: "cannot reopen task under cancelled parent, reopen parent first."

**Rule 5 note:** No reverse cascade on reopen otherwise — reopening a child does not revert a started parent; reopening a parent does not reopen cancelled children.

**Reparenting note:** When a child is reparented away (moved to a different parent or made parentless), no cascade reversal occurs on the original parent. The parent's state is its own. However, reparenting away *does* trigger Rule 3 re-evaluation on the original parent — if all remaining children are now terminal, the parent auto-completes per Rule 3. This is not a reversal; it's a forward evaluation of the changed child set.

#### Validation Rules

**Rule 7: Block adding child to cancelled parent**
Cannot add a child to a `cancelled` parent. Error: "cannot add child to cancelled task, reopen it first."

**Rule 8: Block adding dependency on cancelled task**
Cannot add a dependency on a `cancelled` task. Error: "cannot add dependency on cancelled task, reopen it first."

**Rule 10: Cycle detection** (existing)
No circular dependencies allowed. Migrated into StateMachine.

**Rule 11: Child-blocked-by-parent rejection** (existing)
A child cannot have its own parent as a dependency. Deadlock prevention. Migrated into StateMachine.

### Transition History

Each task gains a `transitions` array field, following the same pattern as `notes`. Each entry records:

- `from` — previous status
- `to` — new status
- `at` — timestamp
- `auto` — boolean, `true` if the transition was triggered by a cascade (not a direct user action)

Stored in JSONL as part of the Task struct. The SQLite cache gains a `task_transitions` junction table (same pattern as `task_notes`). Cache schema version must be incremented.

Growth is bounded — tasks don't transition many times, and JSONL already does full rewrites on every mutation.

The `task_transitions` table schema:

```sql
CREATE TABLE task_transitions (
    task_id TEXT NOT NULL,
    from_status TEXT NOT NULL,
    to_status TEXT NOT NULL,
    at TEXT NOT NULL,
    auto INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);
CREATE INDEX idx_task_transitions_task_id ON task_transitions(task_id);
```

### CLI Display

Both formats show the same information — the primary transition plus all cascaded changes and unchanged terminal children. Only presentation differs.

#### Pretty Format

Uses tree formatting with box-drawing characters.

**Downward cascade (cancel):**
```
tick-parent1: in_progress → cancelled

Cascaded:
├─ tick-child1 "Login": in_progress → cancelled
├─ tick-child2 "Signup": open → cancelled
│  ├─ tick-grand1 "Form": open → cancelled
│  └─ tick-grand2 "Validation": open → cancelled
└─ tick-child3 "Logout": done (unchanged)
```

**Upward cascade (start):**
```
tick-child1: open → in_progress

Cascaded:
├─ tick-parent1 "Auth phase": open → in_progress
└─ tick-grand1 "Sprint 3": open → in_progress
```

#### Toon Format

One `changed` table carrying every task whose status the command moved.

**Downward cascade (cancel):**
```
changed[5]{id,title,from,to,auto}:
  tick-parent1,Auth phase,in_progress,cancelled,false
  tick-child1,Login,in_progress,cancelled,true
  tick-child2,Signup,open,cancelled,true
  tick-grand1,Token refresh,open,cancelled,true
  tick-grand2,Session store,open,cancelled,true
```

A task that ends where it started carries no row — the table lists what changed. The `auto` column distinguishes what the user asked for from what the cascade moved.

Both formats show unchanged terminal children so the user can see what was *not* affected by the cascade.

#### Formatter Interface

A new `FormatCascadeTransition` method is added to the Formatter interface. It receives the primary transition result plus all cascade changes and unchanged terminal children, and renders the full cascade output. It is the only transition-rendering method on the interface: a single-task transition is the same table with one row.

#### JSON Format

Outputs the primary transition and all cascade changes as a structured object:

```json
{
  "transition": {"id": "tick-parent1", "from": "in_progress", "to": "cancelled"},
  "cascaded": [
    {"id": "tick-child1", "title": "Login", "from": "in_progress", "to": "cancelled"},
    {"id": "tick-child2", "title": "Signup", "from": "open", "to": "cancelled"}
  ],
  "unchanged": [
    {"id": "tick-child3", "title": "Logout", "status": "done"}
  ]
}
```

### Architecture: StateMachine

A `StateMachine` struct in `internal/task/` consolidates all 11 rules — transition validation, cascade logic, and mutation validation — into a single architectural unit.

#### Design Properties

- **Stateless struct** — no fields, no constructor needed. Method grouping only (standard Go idiom).
- **No external libraries** — stdlib-only, consistent with Tick's dependency philosophy.
- **Pure cascade computation** — `Cascades()` computes what should change without mutating. Returns a list. Separation enables easy testing: assert on returned list without inspecting task mutations.
- **Queue-based cascade processing** — instead of recursive calls, uses a work queue:
  1. Apply primary transition
  2. Compute cascades → add to queue
  3. Pop next cascade from queue, apply it
  4. Check if that cascade triggers more → add to queue
  5. Track processed tasks in a `seen` map to deduplicate
  6. Loop until queue is empty
- **Termination guarantee** — cascades only move tasks toward terminal states or reopen under specific conditions. Parent-child is a DAG (acyclic). Queue always drains.
- **Mutation model** — `Transition()` mutates the target task in-place (Status, Updated, Closed fields), consistent with the existing implementation. `Cascades()` is pure — it reads task state but does not mutate; it returns `[]CascadeChange` describing what should change. `ApplyWithCascades()` orchestrates both: it calls `Transition()` on the target (mutating it), then runs the cascade queue, calling `Transition()` on each cascaded task (mutating them). The caller receives back all changes and persists them atomically.

#### API Surface

```go
type StateMachine struct{}

type CascadeChange struct {
    Task      *Task
    Action    string
    OldStatus Status
    NewStatus Status
}

// Core transition — absorbs existing transition.go
func (sm *StateMachine) Transition(t *Task, action string) (TransitionResult, error)

// Validation — absorbs dependency.go + new rules
func (sm *StateMachine) ValidateAddChild(parent *Task) error
func (sm *StateMachine) ValidateAddDep(tasks []Task, taskID, blockerID string) error

// Cascade computation — pure, does NOT mutate
func (sm *StateMachine) Cascades(tasks []Task, changed *Task, action string) []CascadeChange

// Combined apply + cascade loop — main entry point for callers
func (sm *StateMachine) ApplyWithCascades(tasks []Task, target *Task, action string) (TransitionResult, []CascadeChange, error)
```

The `action` parameter uses the same string values as the existing transition table commands: `"start"`, `"done"`, `"cancel"`, `"reopen"`. For cascades, the action reflects the logical transition being applied (e.g., a downward cancel cascade uses action `"cancel"` on each child). The term "action" is used instead of "command" to distinguish programmatic cascade transitions from direct user commands.

#### Migration

Existing logic from `transition.go` and `dependency.go` migrates into the StateMachine. `task.Transition()` becomes `sm.Transition()`, `task.ValidateDependency()` becomes `sm.ValidateAddDep()`. Old functions become thin wrappers or get deleted. Callers update accordingly.

#### Store Integration

All cascade changes are persisted atomically within a single `Store.Mutate` call. The caller invokes `ApplyWithCascades()`, receives the primary transition result plus all cascade changes, then writes the full updated task set to JSONL in one atomic operation (temp file + fsync + rename). This ensures no partial cascades on crash — either all changes persist or none do.

### Dependencies

Prerequisites that must exist before implementation can begin:

**None.** This feature builds on existing infrastructure — the Task struct, JSONL storage, SQLite cache, transition table, dependency validation, and CLI formatters all exist. The StateMachine consolidates and extends existing code; it does not depend on any unbuilt systems.

The existing `transition.go` and `dependency.go` logic is migrated into the new StateMachine — these are refactoring targets, not external dependencies.

---

## Working Notes

[In-progress discussion captured here]

## Corrigenda

> **Corrigendum 2026-09-20** (from `free-text-round-trip`): "Flat lines with `(auto)` and `(unchanged)` markers for machine parsing", with the arrow-and-marker lines as the worked example (Toon Format), and "The existing `FormatTransition` method remains for non-cascade (single-task) transitions" (Formatter Interface) — corrected on both points. The arrow lines were never machine-parseable: they are hand-assembled text no TOON reader accepts, and an agent had to learn the arrow, the `(auto)` suffix and the `(unchanged)` suffix from outside the output. `free-text-round-trip` §7.2 replaces them with one `changed` table — `changed[N]{id,title,from,to,auto}:` — carrying every task the command moved. The unchanged terminal children this document requires are still shown, as rows whose `from` equals their `to`, so the requirement stands and only its rendering changes; the pretty rendering above it is untouched. `FormatTransition` was removed from the Formatter interface rather than kept for the single-task case: pretty's zero-cascade branch already produced the identical line, so a single transition is the same table with one row. The JSON shape below, `{"transition":…,"cascaded":…,"unchanged":…}`, is likewise superseded by §7's `changed` list; it is left to supersession rather than corrected here.

> **Corrigendum 2026-09-20** (from `free-text-round-trip`, correcting the amendment made to this document earlier the same day): that amendment wrote "One `changed` table carrying every task the command moved, plus the unchanged terminal children, as rows of the same shape", gave a `changed[6]` example whose last row was `tick-child3,Logout,done,done,true`, added "An unchanged child is the row whose `from` equals its `to`", and claimed in its corrigendum entry that the unchanged-children requirement "stands and only its rendering changes" — corrected: the table carries no such row and cannot. `statusChangeSet.rows()` (`internal/cli/transition.go:138`) drops every row where `From` equals `To`, and `free-text-round-trip` §7.2 fixes that "a task that ends where it started carries no row: the table lists what changed". The toon section now shows `changed[5]` with the five tasks the cascade actually moves. The requirement in the sentence beneath it — that both formats show unchanged terminal children — is restored to what it was before that amendment: a standing requirement of this document that nothing in `internal/` implements, which `free-text-round-trip` §7.6 explicitly declines to reinstate or decide and §12.2 bounded the amendment not to touch. Folding it into the table decided it, the wrong way, in the one route whose purpose is to stop a superseded claim being served as validated context. The earlier corrigendum's other correction — that the arrow-and-`(auto)` lines are replaced by the `changed` table, and that `FormatTransition` was removed rather than kept — stands unaffected.
