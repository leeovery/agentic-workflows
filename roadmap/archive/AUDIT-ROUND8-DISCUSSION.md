# Audit Round 8 — Discussion Log

This document captures the findings, discussions, and decisions from the Round 8 audit of `feat/work-type-architecture-v2`. Round 8 used **Opus-only agents** — 5 regression agents verifying Round 7 fixes and 5 deep-audit agents with semantic, adversarial, cross-file, and completeness strategies.

**Rule**: No changes are made until findings are discussed and agreed upon one at a time.

---

## Round 8 Agent Summary

10 Opus agents dispatched in two categories:

### Regression Agents (verify Round 7 fixes)

| # | Focus | Result |
|---|-------|--------|
| 1 | Epic Discovery Scripts (§23) | CLEAN — all 6 scripts verified correct |
| 2 | Logic Fix Verification (§24, §25) | CLEAN — all 5 fixes verified correct |
| 3 | Review + Discussion Fixes (§24–§28) | 3 new findings (review dead ends, research prompt) |
| 4 | Convention Fix Verification (§26) | CLEAN — all 13 conversions correct, zero remaining violations |
| 5 | CLAUDE.md + Docs | CLAUDE.md clean; README 5 stale sections; audit docs 2 minor |

### Deep-Audit Agents (fresh analysis)

| # | Strategy | Focus | Result |
|---|----------|-------|--------|
| 6 | Semantic | All entry-point skills | 18 findings (4 HIGH, 10 MEDIUM, 3 LOW) |
| 7 | Semantic | Workflow + manifest | 3 findings (1 HIGH epic discovery, 1 MEDIUM routing, 1 LOW) |
| 8 | Adversarial | All processing skills | 13 findings (overlaps with Agent 3; new: convergence, source paths) |
| 9 | Cross-file | Agents + hooks + tests | 1 finding (plan_id vs ext_id mismatch) |
| 10 | Completeness | Full codebase search | 5 findings (confirms Agent 7; planning recovery; stale docs) |

---

## Findings — Fixed

### 1. Review Dead Ends: `STATUS: clean` and All Tasks Skipped (MEDIUM)

**Source**: Agents 3 and 8
**File**: `review-actions-loop.md`

Same bug class as Round 7 Finding #5. Two paths where review status was never set to `completed`:
- Section B: synthesizer returns `STATUS: clean` → terminal STOP with no status update
- Section C: all tasks skipped → terminal STOP with no status update

Both now set `status completed` and check pipeline continuation.

### 2. Source Path Resolution Breaks Bugfix Pipeline (MEDIUM)

**Source**: Agent 8
**File**: `spec-review.md` Section B

Round 7's source path fix hardcoded all sources to discussion paths. For bugfix, the source is an investigation document. Added work_type-aware path construction with H4 conditional routing.

### 3. Research Convergence: Premature Status + Redundant Prompt (MEDIUM)

**Source**: Agent 8, user discussion
**Files**: `convergence-awareness.md`, `gather-context.md`

Three issues in convergence-awareness:
- Status set to `concluded` before user confirmed (chose between continue/discuss)
- Redundant second prompt after user already agreed to conclude
- Legacy `> **Discussion-ready**:` marker no longer needed (manifest tracks status)

Consolidated to single "conclude" prompt. Removed marker from both convergence-awareness and gather-context. Migration 016 still uses marker for legacy data detection.

### 4. `plan_id` → `ext_id` Field Name Mismatch (MEDIUM)

**Source**: Agent 9
**Files**: 3 discovery scripts, 3 tests, 2 SKILL.md docs, invoke-skill.md

Discovery scripts read `plan.plan_id` but the planning skill writes `ext_id`. `plan_id` was the original name (migration 003), `ext_id` replaced it later. No real project has `plan_id` in its manifest. Verified against tick project — only `ext_id` exists.

Converged everything to `ext_id`.

### 5. Planning Recovery Instructions Reference Wrong Files (LOW)

**Source**: Agent 10
**File**: `technical-planning/SKILL.md`

Same copy-paste bug from Round 7 (fixed in discussion/research/review but missed in planning). Referenced "implementation tracking files" which belong to another skill. Now references actual planning files.

### 6. Epic Per-Item State Missing from workflow-start Discovery (HIGH)

**Source**: Agents 7 and 10
**File**: `workflow-start/scripts/discovery.js`

workflow-start used `phaseStatus()` for all phases, which reads flat phase-level status. For epic, statuses are per-item — all non-research phases showed as `'none'`. The discovery data is used for both display AND routing menu construction.

Fixed: epic non-research phases now include per-item detail (name + status). Epic research includes file listing from filesystem (research files are freeform, not manifest-tracked). Feature/bugfix unchanged.

### 7. Feature/Bugfix Routing Tables Missing Research Row (MEDIUM)

**Source**: Agent 7
**Files**: `feature-routing.md`, `work-type-selection.md`

`computeNextPhase` can return `research` for features, but routing tables had no research row. Added to both tables.

### 8. Epic Research File Listing in Discovery (HIGH — part of #6)

workflow-start discovery for epic now scans `.workflows/{work_unit}/research/*.md` and includes file names. This enables epic-routing to display individual research files and offer continue options.

**Design note**: A broader research refactor for epic (multi-topic research with named files, per-file convergence) is captured in `research-refactor/DESIGN-BRIEF.md` for follow-up.

### 9. start-feature/bugfix Resume Doesn't Handle Concluded Phase (LOW)

**Source**: Agent 6
**Files**: `start-bugfix/references/topic-name-check.md`, `start-feature/references/topic-name-check.md`

Resume path only checked for `in-progress`. If the first phase was `concluded`, no instruction. Added: direct to `/workflow-start` when the work unit is past the initial phase. Pre-existing on main — not a regression.

### 10. start-epic Resume Only Checks Research/Discussion (MEDIUM)

**Source**: Agent 6
**File**: `start-epic/references/name-check.md`

Resume path only checked research and discussion. Later phases fell through to "Route to First Phase" which would re-ask about unknowns. Added: direct to `/workflow-start` for epics past initial phases.

### 11. Dead `completed` Field Removal in Review Reopen (LOW)

**Source**: Agent 8
**File**: `review-actions-loop.md` Section E

Section E (Re-open Implementation) tried to remove a `completed` field that no skill ever writes. The implementation phase uses `status` for this. Removed the dead line.

### 12. README.md Stale Sections (MEDIUM — 5 sub-findings)

**Source**: Agent 5

- Processing Skills table missing `technical-investigation`
- Workflow Skills table missing `/start-investigation` and `/start-epic`
- Quick Standalone table: wrong `/start-feature` description, missing `/start-bugfix`
- Package tree missing `workflow-shared/`
- Agents table missing 7 agents (spec-review + implementation-analysis)
- Removed model compatibility block per user preference

### 13. Audit Docs Stale (LOW)

**Source**: Agents 5 and 10

- AUDIT-CHECKLIST §2: `add-item` → `init-phase`, added `push` command example
- SESSION-BRIDGE: sections 1–22 → 1–28

---

## Not Fixing

| Finding | Reason |
|---------|--------|
| start-specification missing epic branch in validate-source.md and invoke-skill-bridge.md | Epic always uses discovery mode (Steps 6-7), never bridge mode (Steps 3-5). No epic code reaches these files. |
| Research `{work_unit}` in "You mentioned..." prompt | Correct — research is topicless, the user mentioned the work unit |
| conclude-discussion "other discussions" check unreachable | Reachable in standalone mode — user can create multiple discussions without pipeline |
| Review gate_mode stored in staging file | Scoped to synthesis cycle, not persistent. Different pattern from other gates but acceptable. |
| Epic multi-file research design | Logged in `research-refactor/DESIGN-BRIEF.md` for follow-up — too large for audit |
| Agent 6 F10/F11: research-analysis cache ambiguous multi-work-unit | Edge case with multiple research work units — deferred |
| Agent 6 F22: dependency loadManifest uses topic as work_unit | Edge case for epic cross-dependencies — deferred |
| Agent 6 F23/F24: invoke-skill missing Work type line | Processing skills read work_type from manifest — not strictly needed in handoff |
| Agent 8 F5: non-numeric review_cycle | Manifest CLI validates values — edge case |
| Agent 8 F6: spec type hardcoded to feature | Confirmed in Step 7 before any pipeline action |
| Agent 8 F8: planning defaults work_type to epic | Documented default — questionable but functional |
| Agent 8 F9: analysis cycle gate doesn't distinguish auto-mode | More conservative than spec/plan review — always gates at cycle 3+ |
| Agent 8 F11: task authoring revision loop no cycle cap | User-controlled loop — requires active participation |

---

## New Documentation

- `research-refactor/DESIGN-BRIEF.md` — multi-topic research design for epic work types
- PR5 notes (phase skills internal) added to `WORK-TYPE-ARCHITECTURE-DISCUSSION.md`
- PR6 notes (processing skills pipeline-aware) added to `WORK-TYPE-ARCHITECTURE-DISCUSSION.md`
- PR4 notes (start/continue split) expanded with Round 8 audit observations

---

## Key Decisions

- **Epic specification always uses discovery mode** — validate-source.md and invoke-skill-bridge.md don't need epic branches
- **Research `{work_unit}` is correct** — research is topicless, differs from discussion's `{topic}`
- **Start skills are for starting** — when a work unit exists past the initial phase, direct to `/workflow-start` rather than trying to handle continuation inline. PR4 will properly split start/continue.
- **`ext_id` is the canonical name** — `plan_id` was the original migration 003 name, never used in practice. All manifest and plan-index-schema references use `ext_id`.
- **Research convergence uses single prompt** — "conclude" replaces the old park/continue/discuss two-step flow

---

## Test Results

After all fixes:
- 175/175 discovery tests (up from 172 — 3 new epic tests)
- 88/88 manifest CLI tests
- 118/118 migration 016 tests
- 13/13 migration 017 tests
