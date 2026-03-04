# Session Bridge — Audit Round 4 (In Progress)

## What We're Doing

This PR (`feat/work-type-architecture-v2`) implements work-type architecture for the workflow system. We've been through multiple rounds of implementation and auditing. The audit process uses a living checklist at `work-type-architecture/AUDIT-CHECKLIST.md` and dispatches parallel agents to verify different aspects of the codebase.

## Current State

Rounds 1, 2, and 3 complete. All fixes committed. Tests pass:
- 159/159 discovery tests
- 80/80 manifest CLI tests
- 118/118 migration tests

Round 4 dispatched 10 agents (5 logic/integrity + 5 convention). All agents complete. We are **mid-discussion of findings** — presenting one at a time, no changes made yet.

### Round 4 Progress

Findings 1–3 discussed. Finding 3 discussion paused for documentation. Remaining findings not yet presented. Full discussion log at `work-type-architecture/AUDIT-ROUND4-DISCUSSION.md`.

| Finding | Status | Summary |
|---------|--------|---------|
| 1. `completed_tasks`/`completed_phases` never written | **Discussed — decisions made** | Add `push` command, rename `add-item` → `init-phase`, convert `external_dependencies` to object |
| 2. `computeNextPhase` ignores research for features | **Discussed — decision made** | Share research checks between epic/feature, default to "ready for discussion" |
| 3. Epic routing passes work_unit where topic needed | **In progress** | Naming inconsistency, possibly deeper architectural issue. Needs further investigation |
| 4–23. Remaining findings | **Not yet presented** | See AUDIT-ROUND4-DISCUSSION.md for full list |

### Key Decisions Made in Round 4

- **Rename `add-item` → `init-phase`**: The current `add-item` command initiates a phase entry, it doesn't add to a collection. `init-phase` parallels `init` (which creates work units).
- **Add `push` command**: New manifest CLI command to append values to arrays. Needed for `completed_tasks` and `completed_phases` in the task loop.
- **Convert `external_dependencies` to object-keyed-by-topic**: Eliminates need for a `set-where`/`patch-item` command. Individual deps updated via dot-path `set`. Simplifies discovery scripts.
- **No `set-where`/`patch-item` needed**: With `external_dependencies` as an object, `push` is the only new command required.
- **Research is optional for both epic and feature**: `computeNextPhase` should check research for both work types, defaulting to "ready for discussion" (not "ready for research"). Research only appears if already started.
- **Future direction**: `continue-{type}` skills will be introduced to simplify continuation. `start-{phase}` skills will become non-user-invokable. Current fixes are stepping stones.

### Key Decisions from Rounds 1–3

- **Rendering instruction scope**: Only user-facing output blocks need rendering instructions. Bash command blocks and file path references are exempt.
- **Step 0 consolidation**: `/migrate` skill owns the STOP gate and conditional branching. Entry-point skills just say "Invoke the `/migrate` skill and assess its output."
- **Dynamic output**: Even for variable content, provide a rendering instruction + fenced block with placeholder template.
- **Bold vs H4 conditionals**: Bold is valid only when nested under an H4. Top-level conditionals within a step must use H4.
- **Split display blocks**: Intentional pattern for header + iteration + per-item template (not a violation).

## Process Rules

- **Present findings one at a time** — no batch changes
- **No changes without user approval** — report and discuss only until agreed
- **Verify before presenting** — read actual files to confirm agent findings before presenting to user

## Key Context

- **work_units not items**: workflow-start discovery uses `epics.work_units`, `features.work_units`, `bugfixes.work_units`
- **Topicless phases**: manifest CLI allows `--phase` without `--topic` ONLY for research
- **phaseData/phaseItems**: discovery scripts must use these abstractions from `discovery-utils.js`
- **Status discovery `work_units`**: the `work_units` key in `skills/status/scripts/discovery.js` is correct — different semantic context
- **Rendering instructions**: Only for user-facing output blocks, not model instruction blocks
- **Step 0**: `/migrate` owns the branching; callers just invoke and assess
- **$1 naming confusion**: CLAUDE.md says $1=topic, epic routing tables say $1=work_unit. Under investigation (Finding 3).

## Files to Read

- `work-type-architecture/AUDIT-ROUND4-DISCUSSION.md` — **READ FIRST** — full discussion log with decisions and remaining findings
- `work-type-architecture/AUDIT-CHECKLIST.md` — the living audit checklist (sections 1–14)
- `work-type-architecture/AUDIT-ROUND1-FIXES.md` — fix tracker from Round 1 (all completed)
- `work-type-architecture/ARCHITECTURE-FIX-PLAN.md` — the original 8-fix architecture plan
- `work-type-architecture/DISCOVERY-CLEANUP-PLAN.md` — the 7-fix discovery cleanup plan
- `work-type-architecture/RESEARCH-STATUS-PLAN.md` — research status support plan
- `CLAUDE.md` — project conventions (the authority for all convention checks)
