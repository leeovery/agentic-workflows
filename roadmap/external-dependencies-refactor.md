# External Dependencies Refactor

Status: planned
Date: 2026-03-15

## Problem

The external dependency system has several bugs, a standalone skill (`/link-dependencies`) that duplicates logic already present in the planning process, and unnecessary complexity in the implementation gate.

### Bugs Found

**1. Reverse check scans wrong scope**
`resolve-dependencies.md` line 30 says "Scan other work units' manifest `external_dependencies`" — should say "topics within the same work unit." External deps are cross-topic within an epic, not cross-work-unit.

**2. `check-dependencies.md` checks plan status instead of task completion**
Line 28-29 queries the dep topic's plan-level `status` field. A plan could be `in-progress` with the specific dependency task already completed, or `completed` with the task skipped. Should check the actual task via `completed_tasks` in the implementation manifest entry.

**3. Phantom `satisfied` state**
`check-dependencies.md` line 31 references `state: satisfied` which doesn't exist in the schema. Only `unresolved`, `resolved`, and `satisfied_externally` are defined. Whether a resolved dep is done should be derived (resolved + task in `completed_tasks` = satisfied), not a stored state.

**4. `task_id` field naming mismatch**
External dependencies store the target task reference as `task_id` but it holds an internal ID (e.g. `auth-1-3`). Should be renamed to `internal_id` to match the naming convention used everywhere else. The `dependencies.md` states table already acknowledges this: `task_id: {internal_id}`.

**5. External deps run unnecessarily for feature/bugfix**
Both `resolve-dependencies.md` (planning) and `check-dependencies.md` (implementation) process external dependencies for all work types. External deps are only meaningful for epics — feature and bugfix have a single topic with no cross-topic dependencies. Both should early-return for non-epic work types.

### Design Issues

**`/link-dependencies` is redundant**
The standalone skill duplicates what `resolve-dependencies.md` already does during planning. Its original purpose was "come back later and wire up deps that couldn't be resolved because target plans didn't exist yet." But the reverse check (Part C of planning) already handles this — when Plan B is created, it checks if any existing plan has unresolved deps that B can satisfy.

By induction, every plan creation resolves all resolvable deps. The only remaining unresolved deps are ones where the target plan genuinely doesn't exist yet. When that plan is eventually created, the reverse check catches it.

**Implementation gate's `l`/`link` option is unnecessary**
`check-dependencies.md` offers `l`/`link` to invoke `/link-dependencies` at implementation time. If planning resolves deps correctly, this is never needed. The remaining implementation gate options (`i`/`implement` the blocker first, `s`/`satisfied externally`) cover all real cases.

**Output format adapters aren't needed for resolution**
The current `resolve-dependencies.md` and `/link-dependencies` load output format `reading.md` adapters to find matching tasks. This is unnecessary — the plan index file (`planning.md`) has a standard task table (Internal ID, Name, Edge Cases, Status, External ID) regardless of output format. Semantic matching between the dep description and task names is sufficient. Ambiguous matches are already handled via user selection.

## Decisions

### Dependency States (pinned down)

Three states, no changes needed to the set — just fix how they're checked:

| State | Stored In Manifest | Meaning | Blocking at Implementation? |
|-------|-------------------|---------|---------------------------|
| `unresolved` | `state: unresolved` | Recorded from spec, no target task identified | Yes |
| `resolved` | `state: resolved` + `internal_id: {id}` | Linked to specific internal ID in another plan | Derived — check if `internal_id` is in that topic's `completed_tasks` |
| `satisfied_externally` | `state: satisfied_externally` | Handled outside the workflow | No |

No `satisfied` state. Whether a resolved dep's task is done is derived at implementation entry by querying `completed_tasks`. The dep stays `resolved` permanently.

### Enhanced Resolve Dependencies Flow

After a plan is created and all tasks are authored (epic work type only):

**Part A — Record current plan's deps (automatic)**
Read spec's Dependencies section. Write each as `state: unresolved` in manifest's `external_dependencies` field.

**Part B — Resolve current plan's deps (automatic)**
For each unresolved dep: does a plan exist for that topic?
- Yes: read the target plan's index file (`planning.md`), find matching task by name/description, set `state: resolved, internal_id: {id}`. If ambiguous, ask user.
- No: leave `unresolved`.

**Part C — Reverse check (automatic)**
For each other plan's topic in the same work unit: scan their manifest `external_dependencies`.
- If any have an unresolved dep matching the current topic: find the satisfying task in the current plan, resolve it.
- If already `resolved` or `satisfied_externally`: skip.

Parts B and C together are comprehensive by induction. No "full sweep" (Part D) needed — every plan creation resolves forward deps (B) and reverse deps (C). Anything left unresolved has no plan yet; when that plan is created, C catches it.

### Implementation Gate (check-dependencies.md)

For each external dependency:
- `unresolved` → blocking
- `resolved` → query `node manifest.js get {work_unit}.implementation.{dep_topic} completed_tasks`, check if `internal_id` appears in the list. If yes, pass. If no (or implementation entry doesn't exist), blocking.
- `satisfied_externally` → pass

Menu options when blocking:
- `i`/`implement` — implement the blocking dependency first
- `s`/`satisfied` — mark as satisfied externally

No `l`/`link` option (removed).

### Retire /link-dependencies

Remove the standalone skill and all references:
- Delete `skills/link-dependencies/` directory
- Remove from `CLAUDE.md` (line 23 — utility entry-points list)
- Remove from `README.md` (lines 131, 183)
- Remove from `workflow-explorer.html` (the `link-deps` phase mapping)
- Remove from `update-workflow-explorer` SKILL.md (file mapping table)
- Remove from `resolve-dependencies.md` line 26
- Remove from `dependencies.md` lifecycle/resolution sections

### Migration

Rename `task_id` → `internal_id` in existing manifest `external_dependencies` entries. Requires a numbered migration script in `skills/workflow-migrate/scripts/migrations/` with a corresponding test.

## Out of Scope

- Spec-level dependency section for feature/bugfix — may not be needed at all since external deps only apply to epics. To be reviewed separately.
- Stale `internal_id` detection — if a target task is renumbered/split/removed after resolution, the dep silently points at nothing. Worth addressing but separate concern.
- Read-only dependency graph overview — could be useful as a diagnostic tool but not required for this refactor.
