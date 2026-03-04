# Session Bridge — Audit Round 2

## What We're Doing

This PR (`feat/work-type-architecture-v2`) implements work-type architecture for the workflow system. We've been through multiple rounds of implementation and auditing. The audit process uses a living checklist at `plans/AUDIT-CHECKLIST.md` and dispatches 5 parallel agents to verify different aspects of the codebase.

## Current State

All Round 1 fixes are committed and pushed. The branch is clean. Tests pass:
- 159/159 discovery tests
- 80/80 manifest CLI tests
- 118/118 migration tests

## What Needs to Happen Next

**Dispatch 5 audit agents** against the full checklist (`plans/AUDIT-CHECKLIST.md`), which now includes both Round 1 and Round 2 checks (sections 1–9). Each agent covers one perspective:

1. **Paths & Structure** (Sections 1, 6) — verify all `.workflows/` paths match the uniform pattern
2. **Manifest CLI Usage** (Sections 2, 7) — verify domain-aware flag syntax, topicless phase support
3. **Work Type Architecture** (Sections 3, 6, 8) — verify work_units naming, phaseData/phaseItems abstractions
4. **Old System Remnants** (Section 4) — verify dead code is gone
5. **CLAUDE.md Conventions** (Sections 5, 9) — verify display/structural conventions

**Scope exclusion**: ALL agents must ignore `workflow-explorer.html`.

Each agent should:
- Read `plans/AUDIT-CHECKLIST.md` for the full checklist
- Read the relevant source plans (`plans/ARCHITECTURE-FIX-PLAN.md`, `plans/DISCOVERY-CLEANUP-PLAN.md`, `plans/RESEARCH-STATUS-PLAN.md`)
- Report findings by section number, file path, and line number
- NOT suggest fixes — just report findings

## After Agents Report

1. Present consolidated findings to the user
2. Discuss any ambiguous items one at a time (not as a wall of text)
3. Fix agreed items
4. Update `plans/AUDIT-ROUND1-FIXES.md` status fields (or create Round 2 equivalent)
5. Append new checks to `plans/AUDIT-CHECKLIST.md` if fixes introduce new patterns
6. Re-dispatch agents if needed

## Key Context

- **work_units not items**: workflow-start discovery uses `epics.work_units`, `features.work_units`, `bugfixes.work_units` (renamed from `items` in Round 1)
- **Topicless phases**: manifest CLI allows `--phase` without `--topic` ONLY for research (enforced by `TOPICLESS_PHASES` constant). All other phases require `--topic` on `set`.
- **phaseData/phaseItems**: discovery scripts must use these abstractions from `discovery-utils.js`, not access `m.phases` directly
- **Status discovery `work_units`**: the `work_units` key in `skills/status/scripts/discovery.js` is correct — different semantic context from workflow-start
- **1Password signing**: git commits may fail with "failed to fill whole buffer" — this is a 1Password agent timeout, retry usually works

## Files to Read

- `plans/AUDIT-CHECKLIST.md` — the living audit checklist (Round 1 + Round 2 checks)
- `plans/AUDIT-ROUND1-FIXES.md` — fix tracker from Round 1 (all completed)
- `plans/ARCHITECTURE-FIX-PLAN.md` — the original 8-fix architecture plan
- `plans/DISCOVERY-CLEANUP-PLAN.md` — the 7-fix discovery cleanup plan
- `plans/RESEARCH-STATUS-PLAN.md` — research status support plan
- `CLAUDE.md` — project conventions (the authority for all convention checks)
