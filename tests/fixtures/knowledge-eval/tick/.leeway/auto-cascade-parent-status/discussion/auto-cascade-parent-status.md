---
topic: auto-cascade-parent-status
status: concluded
work_type: feature
date: 2026-03-03
---

# Discussion: Auto-Cascade Parent Status

## Context

When a child task transitions to `in_progress`, its parent (and ancestors) remain `open` until manually started. This feels wrong — if you're working on a subtask, the parent is implicitly in progress. The question is whether Tick should automatically cascade status changes upward through the ancestor chain, and what the implications are.

The primary pain point: parent containers sit as "open" and never get closed out, especially when AI agents (Claude) are working through subtasks via the workflow system. Parents get neglected.

### References

- [Hierarchy & Dependency Model](hierarchy-dependency-model.md)
- [Data Schema Design](data-schema-design.md)

## Questions

- [x] Should starting a child auto-start its ancestors?
- [x] Should cascade behavior be unconditional or configurable?
- [x] Should completing/cancelling a parent cascade downward to children?
- [x] What happens on undo/reopen after a cascade?
- [x] Edge cases with multiple children and partial completion
- [x] How should cascaded transitions be tracked and displayed?
- [x] Should we validate parent/dependency state on mutations?
- [x] How should cascade and validation rules be architecturally organized?
- [x] Go state machine pattern research
- [x] Final hole check: reopen under cancelled parent, cascades vs dependencies

---

*Each question above gets its own section below. Check off as concluded.*

---

## Should starting a child auto-start its ancestors?

### Context

The fundamental question: when a child transitions to `in_progress`, should the parent automatically follow? This touches on what "in progress" means for a parent task.

### Options Considered

**Option A: Parent as independent work item** — parent status is independently meaningful. "In progress" means *you* are working on it directly. No auto-cascade.

**Option B: Parent as container** — parent is an organizational grouping. Its status reflects aggregate child state. Auto-cascade makes sense because working on a subtask means working on the parent.

### Journey

Started by questioning whether parents are containers or work items. The user's mental model is clear: parents with children are containers/phases. The parent is a phase title. If work was independent, it should be a sibling with dependencies, not a child.

Explored what Linear does for comparison. Linear does NOT auto-start parents when children start — it's a gap users have built Zapier workarounds for. Linear only auto-closes parents when all children complete (opt-in, added Sept 2024). Their philosophy: automate low-judgment bookkeeping, keep high-judgment transitions manual.

However, Tick's existing design already treats parents as containers — `ReadyNoOpenChildren` prevents parents from being ready while children are open, and parent-child is explicitly grouping, not dependency. Auto-cascading is consistent with this existing philosophy.

Key insight: the real pain isn't "I can't see that a parent is in progress" — it's that parent containers sit around forever not getting closed. The upward start cascade is about visibility/correctness; the real fix is auto-closing parents when all children finish.

### Decision

**Yes, auto-cascade upward.** When a child transitions to `in_progress`, walk the ancestor chain and set any `open` ancestors to `in_progress`. This is consistent with Tick's existing parent-as-container model. Recursive — applies to grandparents etc.

---

## Should cascade behavior be unconditional or configurable?

### Context

Whether to add a configuration system to make cascade behavior opt-in/opt-out.

### Options Considered

**Option A: Configurable (Linear-style)** — per-team/per-project settings. Requires config file infrastructure.

**Option B: Unconditional** — always on, opinionated default.

### Journey

Considered the config route. Tick currently has zero configuration — no config file, no dotfile settings. Adding one is significant architectural cost: file format, loading, validation, defaults, documentation. It's permanent API surface.

Linear needed config because they serve thousands of teams. Tick is a personal CLI with one user currently. Opinionated defaults are a feature. The parent-as-container model is already baked into Tick's ready/blocked rules.

Decided to ship unconditional. If real user feedback demands config later, we'll have concrete requirements instead of guessing.

### Decision

**Unconditional.** No configuration. Two behaviors ship as default:
1. First child started → parent moves to `in_progress` (if parent is `open`)
2. All children reach terminal state → parent moves to `done`

If users complain, add config then with real feedback.

---

## Should completing/cancelling a parent cascade downward to children?

### Context

The inverse of upward cascade: when a parent is explicitly completed or cancelled, what happens to its children?

### Options Considered

**Option A: No downward cascade** — children are independent, user manages them.

**Option B: Cascade to all children** — parent done/cancelled means all children follow.

**Option C: Cascade only to non-terminal children** — done/cancelled children are left alone, only open/in_progress children are affected.

### Journey

Completing a parent means the phase is done — leaving orphaned open children under a done parent is messy, inconsistent state. Same logic applies even more strongly to cancellation: cancelling a phase means the work within it is cancelled.

Discussed whether done children should be affected. Walked through the scenario: parent in_progress, some children done, some open → cancel parent. The done children completed legitimately — that work happened. No reason to retroactively cancel it.

Also noted that Tick's transition table blocks done → cancelled directly. You'd have to reopen first, then cancel. So the "done parent gets cancelled, what about done children" scenario requires two steps, which gives the user a natural decision point.

### Decision

**Yes, cascade downward, but only to non-terminal children.** When a parent is marked done or cancelled:
- `open` and `in_progress` children copy the parent's terminal status
- `done` and `cancelled` children are left untouched
- Recursive — applies to grandchildren etc.

---

## What happens on undo/reopen after a cascade?

### Context

After a cascade has propagated, what happens when someone reopens a task that was part of that cascade? Three scenarios to consider.

### Options Considered

**Scenario 1: Upward cascade undo** — child started, parent auto-started. Child reopened. Should parent revert?

**Scenario 2: Downward cascade undo** — parent cancelled, children cascaded to cancelled. Parent reopened. Should children reopen?

**Scenario 3: Auto-done undo** — all children done, parent auto-closed. One child reopened. Should parent reopen?

### Journey

**Scenario 1:** No reverse cascade. Parent might have other in_progress children. The parent's state is its own now — reopening one child doesn't mean the parent isn't in progress.

**Scenario 2:** No reverse cascade. Reopening is deliberate and surgical — "I want to reconsider this specific task." Automatically resurrecting cancelled children could bring back work the user actually wanted gone.

**Scenario 3:** This one required more thought. The parent's done status was derived — conditional on all children being done. That premise is now broken. A done parent with an open child is inconsistent.

Considered auto-cascading parent to `in_progress` on child reopen, but that would require special-case logic ("reopen to in_progress if done siblings exist"). Instead, simpler to just reopen the parent to `open` using the existing reopen transition. Then normal rules apply: when the user starts the child, upward cascade kicks in and parent goes to `in_progress`. When the child finishes, parent auto-closes. The system self-corrects through existing rules.

The momentary "open parent with done children" state is transient and no different from manually creating a parent and adding done children to it. Not broken, just a brief intermediate state.

### Decision

Five clean rules covering all cascade behavior:
1. **Child starts → open ancestors go to in_progress** (upward start)
2. **All children terminal → parent goes to done** (upward completion)
3. **Parent done/cancelled → non-terminal children copy parent's status** (downward cascade)
4. **Child reopened under done parent → parent reopens** (undo auto-done)
5. **No reverse cascade on reopen otherwise** (reopening a child doesn't revert a started parent; reopening a parent doesn't reopen cancelled children)

---

## Edge cases with multiple children and partial completion

### Context

How cascade rules interact with multiple children in different states.

### Options Considered

**Mixed terminal states (some done, some cancelled):** Should parent become `done` or `cancelled`?

**All children cancelled:** Different from mixed case?

**New child added to auto-closed parent:** Should parent reopen?

**Child reparented away from in_progress parent:** Should parent revert?

### Journey

**Mixed terminal states:** If some children are done and some cancelled, all are terminal. Rule 2 fires. Parent should be `done` — the majority completed, and `done` is the positive terminal state. The parent's work was accomplished even if one subtask was abandoned.

**All cancelled:** If every child is cancelled, no work in the phase actually completed. Parent should be `cancelled` — different from the mixed case.

**New child added to done parent:** Adding a non-terminal child to a done parent breaks the "all children terminal" condition. Parent should reopen, same principle as the auto-done undo scenario (rule 4). The parent's done status was conditional.

**Child reparented away:** If a child is moved to a different parent (or made parentless), do not reverse the original parent's cascade. Same principle as rule 5 — keep rules simple, the parent's state is its own now.

### Decision

- **Mixed terminal → parent `done`** (at least one child completed)
- **All cancelled → parent `cancelled`** (no work completed)
- **New child added to done parent → parent reopens** (consistent with rule 4)
- **Child reparented away → no cascade** (consistent with rule 5)

Refined rule 2: **All children terminal → parent goes to `done`, unless all children are `cancelled`, in which case parent goes to `cancelled`.**

---

## How should cascaded transitions be tracked and displayed?

### Context

Cascades silently change multiple tasks. The user gets no feedback that something else changed, and there's no persistent record. This is especially important for downward cascades where `tick cancel <parent>` might silently cancel many children. Also relevant for debugging mistakes — without history, it's hard to trace what happened.

### Options Considered

**Persistent tracking:**

**Option A: No persistence** — just show cascade results in CLI output, no history.

**Option B: Transition history field** — add a `transitions` array to each task in JSONL, like notes. Each entry: `{from, to, at, auto}`.

**Option C: Separate log file** — dedicated audit log outside JSONL/SQLite.

**Display:**

**Option D: Flat output** — list all changed tasks, one line each.

**Option E: Tree output** — show cascade hierarchy visually.

### Journey

**Persistent tracking:** Option C (separate log) adds significant complexity — new file, new format, separate from the JSONL source of truth. Option A is too little — if a cascade makes a mistake, there's no way to trace what happened and bring tasks back to the right state.

Option B (transitions field) fits naturally. JSONL already handles arrays (tags, refs, notes). Each task carries its own history. The cache schema would need a `task_transitions` junction table like `task_notes`, but that's mechanical. Growth concern is minimal — tasks don't transition many times, and JSONL already does full rewrites on every mutation.

**Display:** Reviewed existing output. Today both toon and pretty use the same `baseFormatter.FormatTransition()` which outputs: `tick-abc123: open → in_progress`. One line, no cascade awareness.

For cascades, the key principle is: **both formats show the same information, just formatted differently.** Toon and pretty should never show different content — only different presentation.

**Upward cascade** is always a linear chain (each task has one parent), so display is straightforward — list each ancestor that changed.

**Downward cascade** is a tree (one parent, multiple children, each with their own children). Tree display makes sense for pretty. For toon, flat lines with an `(auto)` marker.

Both formats should show unchanged terminal children too, so the user can see what was *not* affected.

**Pretty format example (downward cancel):**
```
tick-parent1: in_progress → cancelled

Cascaded:
├─ tick-child1 "Login": in_progress → cancelled
├─ tick-child2 "Signup": open → cancelled
│  ├─ tick-grand1 "Form": open → cancelled
│  └─ tick-grand2 "Validation": open → cancelled
└─ tick-child3 "Logout": done (unchanged)
```

**Pretty format example (upward start):**
```
tick-child1: open → in_progress

Cascaded:
├─ tick-parent1 "Auth phase": open → in_progress
└─ tick-grand1 "Sprint 3": open → in_progress
```

**Toon format example (downward cancel):**
```
tick-parent1: in_progress → cancelled
tick-child1: in_progress → cancelled (auto)
tick-child2: open → cancelled (auto)
tick-grand1: open → cancelled (auto)
tick-grand2: open → cancelled (auto)
tick-child3: done (unchanged)
```

### Decision

**Persistent tracking:** Add a `transitions` array field to the Task struct. Each entry records `{from, to, at, auto}`. Follows the same pattern as notes. Cache gets a `task_transitions` junction table.

**CLI display:** Both formats show the same information — the primary transition plus all cascaded changes and unchanged terminal children. Pretty uses tree formatting with box-drawing characters. Toon uses flat lines with `(auto)` and `(unchanged)` markers for machine parsing.

---

## Should we validate parent/dependency state on mutations?

### Context

The cascade rules assume parents are in sensible states, but currently nothing prevents adding a child to a cancelled parent or a dependency on a cancelled task. The Socratic exploration of "what about tasks with no children that gain their first child?" revealed this gap.

### Journey

**Adding a child to a cancelled parent:** Almost certainly a mistake. The user probably meant to add it somewhere else, or forgot the parent was cancelled. Cancelled means "abandoned" — adding new work to abandoned work is contradictory.

**Adding a child to a done parent:** Already decided — parent reopens (rule 4 / new child edge case). Done means "completed but could be revisited." Adding a child is a form of revisiting.

**Adding a dependency on a cancelled task:** A cancelled blocker is already treated as resolved by ready/blocked queries (cancelled counts as closed). So it's harmless but pointless — you're saying "I'm blocked by something that's already been abandoned." Block it for cleanliness and consistency.

Discussed whether to block or warn. Blocking is cleaner — one extra step (reopen first) if you really mean it. This makes the explicit reopen a deliberate choice, not an accidental state.

This led to a broader observation: the rules are accumulating across transition validation, cascade logic, dependency validation, and now parent state validation. Currently scattered across `transition.go`, `dependency.go`, and CLI handlers. Enough rules to justify consolidating.

### Decision

**Block mutations against cancelled tasks:**
- Cannot add a child to a cancelled parent → error: "cannot add child to cancelled task, reopen it first"
- Cannot add a dependency on a cancelled task → error: "cannot add dependency on cancelled task, reopen it first"

**Adding a child to a done parent** remains allowed — triggers parent reopen (existing rule).

Consistent principle: `cancelled` is a hard stop; `done` is soft and revisitable.

---

## How should cascade and validation rules be architecturally organized?

### Context

With cascade rules, parent state validation, dependency state validation, and existing transition validation, the rule count is growing. Currently scattered across `task/transition.go` (transition table), `task/dependency.go` (cycle detection, child-blocked-by-parent), and CLI handlers (various checks). Consolidating into a single architectural unit would prevent further scattering and make the rules discoverable.

### Options Considered

**Option A: Single `cascade.go` file** — co-locate all cascade and validation logic in one file in `internal/task/`. Functions like `ApplyCascade(tasks []Task, changedID string, action string) []Change`. Not a framework, just co-location.

**Option B: Rule-based engine** — define rules as data structures with conditions and actions. More extensible but heavier.

**Option C: `StateMachine` struct** — a type that encapsulates all transition logic, validation, and cascade rules. Methods like `Transition()`, `ValidateAddChild()`, `ValidateAddDep()`, `Cascades()`.

### Journey

Counted the distinct rules that would be consolidated:

1. Transition validation (open → in_progress, etc.) — currently in `transition.go`
2. Upward start cascade (new)
3. Upward completion cascade with done-vs-cancelled logic (new)
4. Downward done/cancel cascade (new)
5. Auto-done undo — child reopened under done parent (new)
6. New child added to done parent → reopen (new)
7. Block adding child to cancelled parent (new)
8. Block adding dependency to cancelled task (new)
9. Cycle detection — currently in `dependency.go`
10. Child-blocked-by-parent rejection — currently in `dependency.go`

10 rules total. 2 existing (transition validation, cycle detection + child-blocked-by-parent), 8 new. Enough to justify a proper home.

Option B (rule engine) feels like over-engineering for 10 rules — building a framework where methods would do.

Option A (single file) is pragmatic but doesn't give a clean API surface. Callers still need to know which functions to call and in what order.

Option C (`StateMachine` struct) gives a clean API — callers interact with one type. Sketched a rough shape:

```go
type StateMachine struct{}

// Core transition
func (sm *StateMachine) Transition(t *Task, action string) (TransitionResult, error)

// Validation (before mutations)
func (sm *StateMachine) ValidateAddChild(parent *Task) error
func (sm *StateMachine) ValidateAddDep(blocker *Task) error

// Cascades (after a transition, returns additional changes)
func (sm *StateMachine) Cascades(tasks []Task, changed *Task, action string) []CascadeResult
```

`Cascades()` returns a list of additional tasks that need changing. The caller (inside `Mutate()`) applies them in a loop — each application could trigger more cascades (recursive bubbling for upward completion). Loop until no more cascades. This keeps cascade logic in one place while the storage layer handles atomicity.

Discussed migration strategy. Since only 2 rules currently exist and we're adding 8, it makes sense to migrate the existing rules into the `StateMachine` at the same time rather than having them live in two places. The migration is mechanical — `task.Transition()` becomes `sm.Transition()`, callers update accordingly.

User noted unfamiliarity with Go patterns for this kind of thing and suggested researching whether state machines in Go are a solved problem before committing to an approach.

### Decision

**`StateMachine` struct in `internal/task/`** that consolidates all transition, validation, and cascade rules. Migrate existing `transition.go` and `dependency.go` logic into it. Research Go state machine patterns before finalizing the internal design — the external API shape (Transition, Validate*, Cascades) is settled, but the internal implementation may benefit from established patterns.

---

## Go state machine pattern research

### Context

Before committing to the `StateMachine` internal design, researched how Go projects typically implement state machines with cascading side effects. Needed to understand whether this is a solved problem, whether libraries are worth using, and what the idiomatic Go patterns are.

### Research Findings

#### Libraries considered and rejected

**qmuntal/stateless** (port of C# dotnet-state-machine/stateless): Most feature-rich Go option. Supports guard clauses, OnEntry/OnExit callbacks, hierarchical substates, and a "FiringQueued" mode for run-to-completion semantics. However, it models *single-entity* state machines — it has no concept of "when task X transitions, find its ancestors and transition them too." We'd still hand-roll the cascade layer on top.

**looplab/fsm**: Simpler, event-centric. 667 importers. String-typed states and events with callbacks. Same limitation — single-entity only.

**Both rejected** because:
1. Tick is stdlib-only (no testify, minimal deps). Adding a library for ~10 rules breaks that principle.
2. Libraries model single-entity state machines. Cascade logic operates on a *graph* of tasks. No library handles the multi-entity cascade problem.
3. The transition table is 4 entries. Library overhead vastly exceeds what we need.
4. Libraries use `interface{}`/`any` for states. We already have type-safe `Status` constants.

#### Three common Go patterns

**Pattern A: Table-driven map** — what Tick already has in `transition.go`. States as `iota` constants, transitions as map lookups, comma-ok for validation. Most idiomatic Go for simple transitions. Not enough structure once you add cascades and validation.

**Pattern B: Struct with methods** — wrap the transition table and related logic in a struct. This is what our discussion converged on. The Go community recommends this when you have multiple related operations (transition + validate + cascade), shared context between rules, and a need for a clean API boundary. The struct can be stateless (zero fields, no constructor) — it's essentially a namespace with method dispatch. Common Go idiom.

**Pattern C: Interface-based State pattern (GoF)** — each state is a type implementing a `State` interface. Transitions return the next state object. Overkill for task management — best suited when states have radically different behavior (e.g., TCP connection states). Our states all behave the same; only valid transitions differ.

**Verdict: Pattern B confirmed as the right fit.**

#### Key pattern borrowed: Queue-based cascade processing

The most valuable finding from the research. `stateless` implements this as "FiringQueued" mode. Instead of recursive cascade calls (which risk stack overflow and are harder to reason about):

1. Apply primary transition
2. Compute cascades → add to queue
3. Pop next cascade from queue, apply it
4. Check if *that* cascade triggers more → add to queue
5. Track processed tasks in a `seen` map to deduplicate
6. Loop until queue is empty

**Why this matters for Tick:**
- No recursion, no stack overflow risk even on deep hierarchies
- Natural place to deduplicate (skip tasks already processed)
- Natural termination guarantee: cascades only move tasks toward terminal states or reopen under specific conditions. Parent-child is a DAG (acyclic). Queue always drains.
- Easy to add a depth/iteration safety limit if paranoid
- Matches the mental model: "apply change, collect side effects, repeat"

**Compared to alternatives:**
- Recursive approach: risk of infinite recursion if rules conflict, harder to debug, stack overflow on deep trees
- Event bus / observer pattern: unnecessary indirection for 10 rules in a CLI tool

#### Recommended API shape (confirmed by research)

```go
// internal/task/statemachine.go

type StateMachine struct{}  // stateless, grouping only

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

// Combined apply + cascade loop — the main entry point for callers
func (sm *StateMachine) ApplyWithCascades(tasks []Task, target *Task, action string) (TransitionResult, []CascadeChange, error)
```

Key design properties:
- **Stateless struct** — no fields, no constructor needed. Just method grouping. Standard Go idiom.
- **`Cascades()` is pure** — computes what *should* change without mutating. Returns a list. `ApplyWithCascades()` does the actual mutation. Separation makes testing easy: assert on returned list without inspecting task mutations.
- **`ApplyWithCascades()` uses queue loop** — processes cascade queue with `seen` map deduplication. The caller (`Store.Mutate()`) calls this once and gets back all changes atomically.
- **Migration path is mechanical** — `task.Transition()` becomes `sm.Transition()`, `task.ValidateDependency()` becomes `sm.ValidateAddDep()`. Old functions become thin wrappers or get deleted. Callers update accordingly.

### Decision

**Confirmed: `StateMachine` struct with queue-based cascade processing.** No external libraries. Table-driven transitions (existing pattern) plus queue-based cascade loop (borrowed from `stateless` concept). Pure `Cascades()` function for testability. Migrate existing `transition.go` and `dependency.go` logic into the struct. The API shape above is the contract for specification.

---

## Final hole check: reopen under cancelled parent, cascades vs dependencies

### Context

After all major decisions were made, did a systematic check for gaps. Three potential holes identified and examined.

### Journey

**Hole 1: Reopening a child under a cancelled parent.** Rule 4 covers "child reopened under done parent → parent reopens." But what about a cancelled parent? If a downward cascade cancelled the children, and the user reopens one child, the parent is still cancelled — active child under cancelled parent is inconsistent state. But cancelled is our "hard stop."

Decision: **block it.** Cannot reopen a child under a cancelled parent — error: "cannot reopen task under cancelled parent, reopen parent first." Consistent with the cancelled-as-hard-stop principle: can't add children to cancelled parents, can't add deps to cancelled tasks, can't reopen children under them either. This becomes rule 11 in the consolidated list.

**Hole 2: `tick done` on a parent with open children — surprise factor.** Concern was that silently closing 5 children might surprise the user. But we already decided that all transitions show cascade output (tree for pretty, flat tagged for toon). The CLI output *is* the confirmation — the user sees exactly what happened. No separate confirmation needed. No change.

**Hole 3: Interaction between cascades and dependencies.** If task A is blocked-by task B, and a downward cascade tries to mark A as done — should that work? The current model: dependencies affect *queries* (ready/blocked), not *transitions*. You can `tick done` a blocked task today. Dependencies are advisory ("this should be done first") not enforcing ("this cannot be done until").

With cascades, a downward `done` closes children regardless of dependency state. This is correct: if a parent is done, the children's work is done too. The blocking relationship was relevant when children were active work — they're not anymore. A blocker might be poorly graphed, or the blocked task found another way, or the blocker is also done and just hasn't been updated. Dependencies don't gate transitions today, and cascades shouldn't introduce that constraint.

### Decision

- **Block reopening a child under a cancelled parent** — "cannot reopen task under cancelled parent, reopen parent first" (new rule 11)
- **No change for cascade output** — already covers the surprise factor via existing display decisions
- **Dependencies remain advisory** — cascades follow the same principle as manual transitions: dependency status doesn't gate state changes

Updated rule list (11 total):
1. Transition validation (existing)
2. Upward start cascade
3. Upward completion cascade (done-vs-cancelled)
4. Downward done/cancel cascade
5. Auto-done undo (child reopened under done parent → parent reopens)
6. New child added to done parent → parent reopens
7. Block adding child to cancelled parent
8. Block adding dependency to cancelled task
9. Block reopening child under cancelled parent
10. Cycle detection (existing)
11. Child-blocked-by-parent rejection (existing)

---

## Summary

### Key Insights

1. Tick's existing parent-child model already treats parents as containers (ReadyNoOpenChildren, no dependency semantics). Auto-cascading is consistent with this philosophy, not a departure from it.
2. Linear's approach (opt-in auto-close only, no upward start cascade) solves a narrower problem. Tick can be more opinionated as a personal CLI with a single user.
3. Cascade rules plus edge case refinements cover the full state space without special-case logic. The rules compose cleanly — each addresses a specific scenario without conflicting with others.
4. Reopen behavior is deliberately conservative (no reverse cascade) except when a derived state's premise is broken (auto-done undo, new child added).
5. Transition history on each task (like notes) provides audit trail without new infrastructure. Same pattern as existing array fields.
6. CLI output shows same content in both formats — pretty uses tree display, toon uses flat tagged lines.
7. Cancelled tasks are a hard stop — cannot add children, dependencies, or reopen children under them. Done tasks are soft — adding a child triggers reopen. Consistent principle across all mutations.
8. Dependencies remain advisory — they affect queries (ready/blocked) not transitions. Cascades follow this same principle.
9. A `StateMachine` struct consolidates 11 rules (3 existing + 8 new) into a single architectural unit. Clean API surface, discoverable rules, prevents further scattering.
10. Queue-based cascade processing (borrowed from `stateless` library concept) avoids recursion, naturally terminates on DAGs, and provides deduplication. Pure `Cascades()` function enables easy testing.
11. No external libraries needed — stdlib-only approach with table-driven transitions and queue-based cascades is idiomatic Go and sufficient for the rule count.

### Current State

All questions resolved:
- Upward start cascade: unconditional, recursive
- Upward completion cascade: unconditional, recursive, with done-vs-cancelled distinction
- Downward cascade: non-terminal children only, recursive
- Reopen behavior: conservative, auto-done undo only, blocked under cancelled parents
- No configuration system
- Edge cases handled consistently
- Transition history: array field on Task, like notes
- CLI display: tree (pretty), flat tagged (toon), same content both formats
- Cancelled-task mutation blocking: children, dependencies, and child reopening
- Dependencies: advisory only, don't gate transitions or cascades
- Architecture: `StateMachine` struct, queue-based cascades, pure `Cascades()` for testability
- Go patterns confirmed: struct-with-methods (Pattern B), no libraries

### Consolidated Rule List

1. **Transition validation** — open → in_progress, etc. (existing, migrate into StateMachine)
2. **Upward start cascade** — child starts → open ancestors go to in_progress
3. **Upward completion cascade** — all children terminal → parent done (or cancelled if all cancelled)
4. **Downward cascade** — parent done/cancelled → non-terminal children copy status
5. **Auto-done undo** — child reopened under done parent → parent reopens
6. **New child to done parent** — parent reopens
7. **Block child to cancelled parent** — error, reopen first
8. **Block dep to cancelled task** — error, reopen first
9. **Block reopen under cancelled parent** — error, reopen parent first
10. **Cycle detection** — no circular dependencies (existing, migrate into StateMachine)
11. **Child-blocked-by-parent rejection** — deadlock prevention (existing, migrate into StateMachine)

### Next Steps

- [ ] Specification: formalize all 11 rules, transition tracking, display, and StateMachine architecture
- [ ] Implementation: build StateMachine, migrate existing rules, add cascade rules
