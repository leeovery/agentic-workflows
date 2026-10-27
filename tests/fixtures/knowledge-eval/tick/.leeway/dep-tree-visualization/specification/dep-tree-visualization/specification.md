# Specification: Dep Tree Visualization

## Specification

## Overview

Dependency tree visualization for the Tick CLI. Purely a presentation feature — no data model changes required, read-only operation via `Store.Query()`. Extends the existing `tick dep add/remove` subcommand pattern with a `tree` subcommand.

## Command Structure

**Command:** `tick dep tree [id]`

**Flags:** No command-specific flags. Only global flags (format, quiet, verbose) apply.

**Two modes:**

1. **Full graph** (`tick dep tree`) — Shows all tasks that participate in dependency relationships. A "root task" is a task that blocks other tasks but is not itself blocked by anything (empty `BlockedBy`). Each root is listed at the top level with the tasks it blocks indented beneath, recursively. Tasks with zero dependencies (neither blocking nor blocked) are omitted. Includes a summary line at the bottom: `{N} chains, longest: {M}, {B} blocked` where chain = connected component of the dependency graph, longest = longest path measured in edges, blocked = tasks with at least one `BlockedBy` entry.

2. **Focused view** (`tick dep tree <id>`) — Walks both directions from the target task:
   - **Blocked by** — walks upstream (what blocks this task, and what blocks those, transitively)
   - **Blocks** — walks downstream (what this task unblocks, and what those unblock, transitively)
   - Full transitive depth — no artificial cap

## Rendering

**Tree characters:** Box-drawing characters (`├──`, `└──`, `│`) for the pretty format.

**Inline metadata per task:** ID + title (truncated to fit terminal width) + status. Priority is excluded — it's orthogonal to dependency ordering and doesn't help understand what's blocking what.

**Diamond dependencies** (task reachable via multiple paths): Duplicate the task wherever it appears in the graph. No deduplication, no back-references, no special markers.

**Depth:** Full transitive — walk the entire chain with no artificial cap.

**Title truncation:** Truncate titles to fit available width after accounting for indentation + ID + status.

**Focused view section headers:** The focused view renders with distinct labeled sections — a "Blocked by:" header followed by the upstream tree, then a "Blocks:" header followed by the downstream tree. Clear visual separation between the two directions.

## Formatter Integration

New method `FormatDepTree` on the `Formatter` interface. All three format implementations required:

- **Pretty:** Box-drawing tree with ID + title (truncated) + status per line. Full graph mode shows root tasks with what they block. Focused mode walks both directions with labeled "Blocked by:" and "Blocks:" sections. Summary line at bottom.

- **Toon:** Flat edge list in standard toon format. Full graph: `dep_tree[N]{from,to}:` with one edge per line. Focused mode: separate `blocked_by[N]{from,to}:` and `blocks[N]{from,to}:` sections for upstream/downstream edges respectively. Machine-parseable for agent consumption.

- **JSON:** Structured graph — nodes array + edges array, or nested object mirroring the tree structure. Exact shape determined during implementation.

Consistency with existing architecture: every command output goes through the formatter, this one included.

## Scope

**Dependencies only.** No parent/child relationships, no parent annotations.

Parent/child (decomposition) and dependencies (ordering) have different semantics. Mixing them in one tree creates ambiguity — is B under A because A blocks B, or because B is a child of A? The command is `tick dep tree` — it shows dependencies. Parent/child hierarchy visualization is a separate feature if ever needed.

## Edge Cases

- **Task with no dependencies** (focused mode): Show the task itself with "No dependencies."
- **No dependencies in project** (full graph mode): "No dependencies found."
- **Asymmetric focused view** — if a task has upstream blockers but blocks nothing, show the "Blocked by:" tree and omit the "Blocks:" section (and vice versa). Only show sections that have content.
- **Very wide graphs** (task blocked by many): Vertical list with indentation — terminal handles naturally.
- **Very deep graphs** (long chains): Indentation at 2–3 chars per level stays manageable. Tick projects won't realistically hit problematic depths.
- **Terminal width:** Truncate titles to fit available width after indentation + ID + status.

---

## Working Notes

[Optional - capture in-progress discussion if needed]
