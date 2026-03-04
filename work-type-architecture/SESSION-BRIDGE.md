# Session Bridge — Audit Round 4 (Discussion Complete)

## What We're Doing

This PR (`feat/work-type-architecture-v2`) implements work-type architecture for the workflow system. We've been through multiple rounds of implementation and auditing. The audit process uses a living checklist at `work-type-architecture/AUDIT-CHECKLIST.md` and dispatches parallel agents to verify different aspects of the codebase.

## Current State

Rounds 1–3 complete. All fixes committed. Tests pass:
- 159/159 discovery tests
- 80/80 manifest CLI tests
- 118/118 migration tests

Round 4 dispatched 10 agents (5 logic/integrity + 5 convention). All agents complete. **All findings discussed and dispositioned.** Full discussion log at `work-type-architecture/AUDIT-ROUND4-DISCUSSION.md`.

## What Needs to Happen Next

Implement the 12 agreed fixes from Round 4. Then re-run tests. Then update audit checklist and re-dispatch agents for Round 5.

The fixes fall into three categories:
1. **Large architectural changes** (Findings 1, 2, 3, 6) — manifest CLI, discovery scripts, routing tables, positional arguments
2. **Small targeted fixes** (Findings 7, 8, 9, 10, 11, 13) — one-liner or few-line changes
3. **Convention fixes** (Findings 16, 17) — heading level changes

See the "Summary: Agreed Fixes" table at the bottom of `AUDIT-ROUND4-DISCUSSION.md` for the full list.

### Key Decisions Made in Round 4

- **Rename `add-item` → `init-phase`**: The current `add-item` command initiates a phase entry, it doesn't add to a collection. `init-phase` parallels `init` (which creates work units).
- **Add `push` command**: New manifest CLI command to append values to arrays. Needed for `completed_tasks` and `completed_phases` in the task loop.
- **Convert `external_dependencies` to object-keyed-by-topic**: Eliminates need for a `set-where`/`patch-item` command. Individual deps updated via dot-path `set`. Simplifies discovery scripts.
- **No `set-where`/`patch-item` needed**: With `external_dependencies` as an object, `push` is the only new command required.
- **Research is optional for both epic and feature**: `computeNextPhase` should check research for both work types, defaulting to "ready for discussion" (not "ready for research"). Research only appears if already started.
- **Three positional arguments**: `$0` = work_type, `$1` = work_unit, `$2` = topic (optional). Feature/bugfix always two args (topic inferred). Epic with known topic uses three args. Epic without topic uses two args (scoped discovery).
- **Topic and work_unit are different concepts**: Even when they share the same string value for feature/bugfix, they represent different things. Never assume interchangeable.
- **"Unified" is a topic, not a work unit**: In spec handoff files, "unified" is the grouping name when all discussions combine into one spec. The work_unit position in paths should be `{work_unit}`, not "unified".
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
- **Positional args**: `$0`=work_type, `$1`=work_unit, `$2`=topic (optional). Skills resolve: `topic = $2 || (wt !== 'epic' ? $1 : null)`

## Files to Read

- `work-type-architecture/AUDIT-ROUND4-DISCUSSION.md` — **READ FIRST** — full discussion log with all decisions, fix list, and disposition of every finding
- `work-type-architecture/AUDIT-CHECKLIST.md` — the living audit checklist (sections 1–14)
- `work-type-architecture/AUDIT-ROUND1-FIXES.md` — fix tracker from Round 1 (all completed)
- `work-type-architecture/ARCHITECTURE-FIX-PLAN.md` — the original 8-fix architecture plan
- `work-type-architecture/DISCOVERY-CLEANUP-PLAN.md` — the 7-fix discovery cleanup plan
- `work-type-architecture/RESEARCH-STATUS-PLAN.md` — research status support plan
- `CLAUDE.md` — project conventions (the authority for all convention checks)
