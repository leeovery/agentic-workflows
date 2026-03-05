# Session Bridge — Audit Round 7 Complete

## What We're Doing

This PR (`feat/work-type-architecture-v2`) implements work-type architecture for the workflow system. We've been through multiple rounds of implementation and auditing. The audit process uses a living checklist at `work-type-architecture/AUDIT-CHECKLIST.md` and dispatches parallel agents to verify different aspects of the codebase.

## Current State

Rounds 1–7 complete. All fixes committed. Tests pass:
- 172/172 discovery tests (11 new epic tests in Round 7)
- 88/88 manifest CLI tests
- 540/540 migration tests

Round 7 was a breakthrough — switched from Haiku to **Opus-only agents** with five distinct audit strategies: semantic, adversarial, cross-file handoff, coherence, and completeness. Found 14 real issues that 6 rounds of Haiku agents completely missed, including logic bugs, epic blindness, and pipeline dead ends.

Full discussion log at `work-type-architecture/AUDIT-ROUND7-DISCUSSION.md`.

## What Needs to Happen Next

Dispatch Round 8 agents to verify Round 7 fixes and do a final comprehensive pass. Use the same Opus-only, multi-strategy approach from Round 7.

### Agent Strategy (CRITICAL — learned from Rounds 1–7)

**NEVER use Haiku** for this codebase. It pattern-matches without reasoning and reports false CLEANs. **Opus only.**

**Five agent strategies**, each finding different classes of issues:

1. **Semantic audit** — Read files as if executing them step by step. Ask: "Would I know exactly what to do? Are there ambiguities? Logic gaps? Dead instructions? Cross-file mismatches in variable names or paths?"

2. **Adversarial audit** — Try to break things. Edge cases: empty manifests, missing phases, epic with zero items, null access paths. What happens with bad input? What about concurrent access?

3. **Cross-file handoff audit** — Trace actual data flow between files. Entry-point → processing skill: do variable names match? Discovery → display → route → invoke: do field names match? Session state → compact recovery: consistent?

4. **Coherence audit** — Check CLAUDE.md claims against implementation. Trace complete workflows for all 3 work types through every phase transition. Does the documented behaviour match reality?

5. **Completeness audit** — Search EVERY file for remnants of old patterns. Check test coverage. Verify the PR diff is complete — no half-finished renames, no orphaned references.

**Every agent reads EVERY file in its assigned segment. No spot checks. No sampling.**

**Every agent must be told:**
- Read the audit checklist, all plan documents, and CLAUDE.md
- Use `git diff main` to understand what changed in this PR
- Report findings only — do not fix anything
- Be skeptical — assume there ARE problems

### Key Decisions Made in Round 7

- **Investigation is exclusively bugfix** — hardcoding `Work type: bugfix` in conclude-investigation.md is correct, not fragile.
- **Specification sources are discussions** — source names map to `.workflows/{work_unit}/discussion/{source-name}.md`. Research feeds discussions, not specs directly.
- **Output format files are intentionally exempt** from attribution headers — they're adapters, not standard references.
- **Reference-to-reference Load directives** without `→` in sub-backbone files are acceptable — pre-existing, functionally correct.
- **Don't assume anything** — verify against actual files and the tick project before making changes. If unsure, ask the user.

### Key Decisions Made in Round 6

- No new architectural decisions — Round 6 was purely verification.

### Key Decisions Made in Round 5

- **Routing vs instructional conditionals**: H4 (`#### If`) is only for routing — choosing between mutually exclusive execution paths. Bold "if" text that provides guidance or suggestions within a single path stays as bold.
- **Mode detection three-arg pattern**: All start-{phase} skills must document $0, $1, $2 and include the resolution formula.

### Key Decisions Made in Round 4

- **Rename `add-item` → `init-phase`**: The current `add-item` command initiates a phase entry, it doesn't add to a collection. `init-phase` parallels `init` (which creates work units).
- **Add `push` command**: New manifest CLI command to append values to arrays. Needed for `completed_tasks` and `completed_phases` in the task loop.
- **Convert `external_dependencies` to object-keyed-by-topic**: Eliminates need for a `set-where`/`patch-item` command.
- **Research is optional for both epic and feature**: `computeNextPhase` should check research for both work types, defaulting to "ready for discussion".
- **Three positional arguments**: `$0` = work_type, `$1` = work_unit, `$2` = topic (optional).
- **Topic and work_unit are different concepts**: Even when they share the same string value for feature/bugfix, they represent different things.
- **"Unified" is a topic, not a work unit**.

### Key Decisions from Rounds 1–3

- **Rendering instruction scope**: Only user-facing output blocks need rendering instructions.
- **Step 0 consolidation**: `/migrate` skill owns the STOP gate and conditional branching.
- **Dynamic output**: Even for variable content, provide a rendering instruction + fenced block with placeholder template.
- **Bold vs H4 conditionals**: Bold is valid only when nested under an H4. Top-level routing conditionals within a step must use H4.

## Process Rules

- **Present findings one at a time** — no batch changes
- **No changes without user approval** — report and discuss only until agreed
- **Verify before presenting** — read actual files to confirm agent findings before presenting to user
- **Don't assume** — if unsure about the system's design intent, ask. Don't guess.

## Key Context

- **work_units not items**: workflow-start discovery uses `epics.work_units`, `features.work_units`, `bugfixes.work_units`
- **Topicless phases**: manifest CLI allows `--phase` without `--topic` ONLY for research
- **phaseData/phaseItems**: discovery scripts must use these abstractions from `discovery-utils.js`
- **Epic discovery**: all phase discovery scripts now iterate `phaseItems()` for epic work types (fixed in Round 7)
- **computeNextPhase**: now epic-aware — aggregates item statuses (all concluded → phase done, any in-progress → in-progress)
- **Investigation is bugfix-only**: hardcoded bugfix work_type is correct
- **Spec sources are discussions**: `.workflows/{work_unit}/discussion/{source-name}.md`
- **Status discovery `work_units`**: the `work_units` key in `skills/status/scripts/discovery.js` is correct — different semantic context
- **Rendering instructions**: Only for user-facing output blocks, not model instruction blocks
- **Step 0**: `/migrate` owns the branching; callers just invoke and assess
- **Positional args**: `$0`=work_type, `$1`=work_unit, `$2`=topic (optional). Skills resolve: `topic = $2 || (wt !== 'epic' ? $1 : null)`

## Files to Read

- `work-type-architecture/AUDIT-ROUND7-DISCUSSION.md` — **READ FIRST** — Round 7 findings, strategies, and all fixes
- `work-type-architecture/AUDIT-ROUND6-DISCUSSION.md` — Round 6 findings
- `work-type-architecture/AUDIT-ROUND5-DISCUSSION.md` — Round 5 findings
- `work-type-architecture/AUDIT-ROUND4-DISCUSSION.md` — Round 4 discussion log with all architectural decisions
- `work-type-architecture/AUDIT-CHECKLIST.md` — the living audit checklist (sections 1–28)
- `work-type-architecture/AUDIT-ROUND1-FIXES.md` — fix tracker from Round 1 (all completed)
- `work-type-architecture/ARCHITECTURE-FIX-PLAN.md` — the original 8-fix architecture plan
- `work-type-architecture/DISCOVERY-CLEANUP-PLAN.md` — the 7-fix discovery cleanup plan
- `work-type-architecture/RESEARCH-STATUS-PLAN.md` — research status support plan
- `CLAUDE.md` — project conventions (the authority for all convention checks)
