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
All three stages process external dependencies for all work types. External deps are only meaningful for epics — feature and bugfix have a single topic with no cross-topic dependencies:
- Specification (`Step 6: Document Dependencies`) — authors a Dependencies section that's never consumed
- Planning (`resolve-dependencies.md`) — processes deps that can't exist
- Implementation (`check-dependencies.md`) — checks deps that can't exist

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

### Skip External Deps for Feature/Bugfix

All three stages add a work-type guard at the top:

- **Specification** (`Step 6`) — skip the Dependencies section entirely. Add a conditional: if work type is not `epic`, proceed to Step 7.
- **Planning** (`resolve-dependencies.md`) — early return. Set `external_dependencies: {}` in manifest and proceed.
- **Implementation** (`check-dependencies.md`) — early return with "External dependencies satisfied."
- **Planning review** (`review-integrity.md`) — skip the external dependency checks ("All external dependencies from the specification are documented in the plan" / "No external dependencies were missed or invented") for non-epic work types.

### Enhanced Resolve Dependencies Flow

`resolve-dependencies.md` is rewritten to implement this flow. It replaces the current implementation which loads output format adapters — all resolution now reads the plan index file (`planning.md`) directly, which has a standard task table regardless of output format.

After a plan is created and all tasks are authored (epic work type only):

**Part A — Build/rebuild deps from spec (automatic)**
Read the spec's Dependencies section and rebuild `external_dependencies` in the manifest:
1. Read existing `external_dependencies` from manifest (may be empty on first run, or populated on continue/rebuild).
2. For each dep in the spec: if an existing entry with `state: satisfied_externally` matches, preserve it (user override). Otherwise, set to `state: unresolved`.
3. Remove any manifest deps that no longer appear in the spec (spec may have changed).

This clean-slate approach ensures deps always reflect the current spec. On first creation it builds from scratch. On continue or rebuild, it resets everything to `unresolved` (except user overrides) so Parts B and C can re-validate from a known state. If nothing changed, B will find the same matches. If the spec changed, stale deps are removed and new ones are picked up.

**Part B — Resolve current plan's deps (automatic)**
For each `unresolved` dep: does a plan exist for that topic?
- Yes: read the target plan's index file (`planning.md`), find matching task by name/description, set `state: resolved, internal_id: {id}`. If ambiguous, ask user.
- No: leave `unresolved`.

**Part C — Reverse check and stale reference validation (automatic)**
For each other plan's topic in the same work unit: scan their manifest `external_dependencies`.
- **Unresolved deps matching the current topic**: find the satisfying task in the current plan, resolve it.
- **Resolved deps pointing at tasks in the current plan**: re-validate that the task at the stored `internal_id` still matches the dependency's `description`. If the task name no longer matches (e.g. the plan was rebuilt and that positional ID now refers to a different task), re-resolve by finding the correct task and updating the `internal_id`. If ambiguous, ask the user.
- `satisfied_externally`: skip.

This handles stale references without any conditional logic. Internal IDs are positional (`topic-1-2` = phase 1, task 2) — a rebuilt plan will almost certainly still have the same IDs, but they may refer to entirely different tasks. Checking existence alone is insufficient; the semantic match between the task and the dependency description must be validated.

On first plan creation, there are no resolved deps pointing at this topic, so the validation is a no-op. On plan rebuilds (e.g. after a spec update), it catches any references that no longer match. No harm in always running it.

Parts B and C together are comprehensive by induction. No "full sweep" needed — every plan creation resolves forward deps (B), resolves reverse deps, and validates existing references (C). Anything left unresolved has no plan yet; when that plan is created, C catches it.

**Approval gate**
After Parts A/B/C, present a summary of all dependency state: what was recorded, resolved, left unresolved, and any reverse resolutions or stale reference fixes made to other plans. The existing approval gate stays — user confirms before committing. This covers both the current plan's deps and any modifications Part C made to other plans' manifests.

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
- Remove from `dependencies.md` lifecycle/resolution sections (rewrite to reflect Parts A/B/C flow)
- Update `plan-index-schema.md` — rename `task_id` references to `internal_id` in external_dependencies documentation

### Migration

Rename `task_id` → `internal_id` in existing manifest `external_dependencies` entries. Requires a numbered migration script in `skills/workflow-migrate/scripts/migrations/` with a corresponding test.
