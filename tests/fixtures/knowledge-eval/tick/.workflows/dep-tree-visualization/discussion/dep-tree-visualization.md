# Discussion: Dep Tree Visualization

## Context

Tick tracks task dependencies via `BlockedBy` (stored on task) plus `Parent` for hierarchical relationships. There is no explicit `Blocks` field — the reverse relationship is computed via query. All the data exists but there's no way to visualize the dependency graph.

This is purely a presentation concern — no data model changes needed. The formatter infrastructure (`Formatter` interface with toon/pretty/JSON implementations) is already in place. The existing `tick dependency add/remove` subcommand pattern means `tick dependency tree` fits naturally.

### References

- Inbox idea: `.workflows/.inbox/.archived/ideas/2026-03-21--dep-tree-visualization.md`

## Questions

- [x] What should the command structure and UX look like?
      - Subcommand name and arguments
      - Direction control: upstream vs downstream vs both
      - Default behavior when no direction specified
- [x] How should the tree be rendered?
      - ASCII art style and characters
      - How to show task status, priority, and other metadata inline
      - Handling of circular or complex graph structures
- [x] How should this integrate with the existing formatter system?
      - New method on `Formatter` interface vs standalone renderer
      - What each format (toon/pretty/JSON) should output
- [x] What about the parent/child hierarchy?
      - Should dep tree include parent/child relationships alongside dependency edges?
      - Combined view vs separate views
      - Risk of noise in deeply nested projects
- [x] How should edge cases be handled?
      - Tasks with no dependencies
      - Very wide or very deep graphs
      - Terminal width constraints

---

*Each question above gets its own section below. Check off as completed.*

---

## What should the command structure and UX look like?

### Context
Need a command to visualize dependency relationships. `tick dependency` already exists with `add`/`remove` subcommands, so `tree` slots in naturally as a third subcommand.

### Options Considered

**Option A: `tick tree <id>` — new top-level command**
- Pros: Short, simple
- Cons: New command namespace, doesn't group with existing dep commands

**Option B: `tick deps <id>`**
- Pros: Explicit about content
- Cons: Abbreviation inconsistent with existing `dependency` command name

**Option C: `tick dependency tree [id]`**
- Pros: Groups with existing `dependency add/remove`, established subcommand pattern
- Cons: Longer to type

### Journey
Initially considered all three. The existing `tick dependency add/remove` pattern made Option C the natural fit — it's not introducing a new convention, it's extending an existing one. Options A and B would create parallel ways to interact with dependency data.

Key realisation: the command should work with and without an ID argument. No ID = full project dependency graph. With ID = focused view centred on that task.

### Decision
**`tick dependency tree [id]`** — extends the existing dependency subcommand pattern. Optional ID argument controls scope.

**Two modes:**
1. **Full graph** (`tick dependency tree`) — shows all tasks that participate in dependency relationships. Each task lists what it blocks. Includes a summary line (chains, longest chain, blocked count).
2. **Focused view** (`tick dependency tree <id>`) — walks both directions from the target task. "Blocked by" section walks upstream (what blocks me, what blocks those). "Blocks" section walks downstream (what I unblock, what those unblock). Full transitive depth — no artificial cap.

**Open question:** Whether tasks with zero dependencies should appear in the full graph. Leaning towards omitting them (they're not interesting in a dependency view) but feels slightly incomplete. Parking this — will revisit after seeing it in practice.

---

## How should the tree be rendered?

### Context
Need to decide on visual style, what info to show per task, and how to handle DAG structures (diamond dependencies where a task is blocked by multiple paths).

### Options Considered

**Inline metadata — what to show per task:**
- Full: ID + title + status + priority + type — too noisy
- Moderate: ID + title + status + priority — priority irrelevant in dependency context
- Minimal: ID + title + status — the actionable info

**Diamond dependencies (task blocked by multiple paths):**
- Deduplicate with back-references like `(→ see above)` — adds complexity
- Show once, flatten — loses graph structure
- Just duplicate — show the task wherever it appears in the graph

### Decision
**Rendering style:** Box-drawing characters (`├──`, `└──`, `│`) for pretty format.

**Inline metadata:** ID + title (truncated) + status. Priority is orthogonal to dependencies — it doesn't help you understand what's blocking what.

**Diamond dependencies:** Just duplicate. If a task appears in multiple places in the graph, show it in all of them. No special markers or back-references. It's a visualization, not a normalized data store.

**Depth:** Full transitive — walk the entire chain, no artificial cap.

---

## How should this integrate with the existing formatter system?

### Context
The `Formatter` interface has 8 methods, with three implementations (toon, pretty, JSON). Every command output goes through this system. Question is whether the dep tree should too.

### Options Considered

**Option A: New method on `Formatter` interface**
- Pros: Consistent with every other command, all three formats get representations, maintains the contract
- Cons: Three implementations to write

**Option B: Standalone renderer, bypass `Formatter`**
- Pros: Simpler if only pretty output is needed
- Cons: Breaks the formatter contract, inconsistent with the rest of the CLI

### Journey
Initially considered whether toon and JSON were even needed for a tree visualization. The pretty format is the obvious human-facing output. But toon is the format agents consume — a flat edge list (`dep_tree[3]{from,to}:`) is trivial to parse and actually useful for agents reasoning about dependency chains. JSON similarly — a structured graph representation is arguably more useful than pretty for tooling/scripting. The toon and JSON implementations are also simpler than pretty (no box-drawing logic — just dump edges or nested structure).

### Decision
**Option A: New method on `Formatter` interface.** All three formats implemented:

- **Pretty:** Box-drawing tree with ID + title + status per line. Full graph mode shows root tasks with what they block. Focused mode walks both directions. Summary line at bottom.
- **Toon:** Flat edge list in standard toon format — `dep_tree[N]{from,to}:` with one edge per line. Machine-parseable.
- **JSON:** Structured graph — nodes array + edges array, or nested object mirroring the tree structure. TBD on exact shape during implementation.

Consistency wins. Every command goes through the formatter, this one should too.

---

## What about the parent/child hierarchy?

### Context
Tasks have two relationship types: parent/child (decomposition) and dependencies (ordering). Should the dep tree mix them?

### Decision
**Dependencies only. No parent/child relationships, no parent annotations.**

Parent/child and dependencies have different semantics — decomposition vs ordering. Mixing them in one tree creates ambiguity (is B under A because A blocks B, or because B is a child of A?). Considered annotating parent info inline (e.g., `(child of tick-a1b2)`) but parent hierarchies can be multiple levels deep, making annotations messy and noisy.

The command is `tick dependency tree` — it shows dependencies. Parent/child hierarchy visualization is a separate feature if ever needed.

---

## How should edge cases be handled?

### Decision
All edge cases handled naturally by the rendering approach — no special design needed:

- **Task with no dependencies** (focused mode): Show the task itself with "No dependencies."
- **No dependencies in project** (full graph mode): "No dependencies found."
- **Very wide graphs** (task blocked by many): Vertical list with indentation, terminal handles fine.
- **Very deep graphs** (long chains): Indentation at 2-3 chars per level stays manageable. Tick projects won't realistically hit problematic depths.
- **Terminal width**: Truncate titles to fit available width after indentation + ID + status.

---

## Summary

### Key Insights
1. The dependency tree is purely a presentation feature — no data model changes
2. `tick dependency tree` extends an existing subcommand pattern, not a new convention
3. Dependencies and parent/child are different relationship types and should not be mixed
4. All three formatter implementations needed — toon edge-list format is useful for agent consumption

### Current State
- All questions resolved
- Command shape, rendering, formatter integration, hierarchy scope, and edge cases decided

### Next Steps
- [ ] Specification
- [ ] Implementation

---
