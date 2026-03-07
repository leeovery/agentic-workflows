# Audit Round 9 — Discussion Log

This document captures the findings, discussions, and decisions from the Round 9 audit of `feat/work-type-architecture-v2`. Round 9 used **Opus-only agents** — 5 regression agents verifying Round 8 fixes and 5 deep-audit agents with semantic, adversarial, cross-file, and completeness strategies.

**Rule**: No changes are made until findings are discussed and agreed upon one at a time.

---

## Round 9 Agent Summary

10 Opus agents dispatched in two categories:

### Regression Agents (verify Round 8 fixes)

| # | Focus | Result |
|---|-------|--------|
| 1 | Review Dead Ends + Source Path (§29, §30) | CLEAN — all fixes verified correct |
| 2 | Discovery + Routing (§31, §33, §34) | CLEAN — ext_id, epic detail, research routing all correct |
| 3 | Research Convergence (§32) | CLEAN — single prompt, no Discussion-ready marker |
| 4 | Resume Paths (§35) | CLEAN — all states handled, /workflow-start picks up correctly |
| 5 | Documentation | 2 LOW findings (README tree, SESSION-BRIDGE ref) |

### Deep-Audit Agents (fresh analysis)

| # | Strategy | Focus | Result |
|---|----------|-------|--------|
| 6 | Semantic | All entry-point skills | 6 MEDIUM, 7 LOW — agent docs, session state, handoffs |
| 7 | Semantic | Workflow + manifest | 2 MEDIUM, 7 LOW — init-phase topicless, bridge research display |
| 8 | Adversarial | All processing skills | 1 HIGH (false), 4 MEDIUM, 11 LOW — review status, plan-review gate, conventions |
| 9 | Cross-file | Agents + hooks + tests | 4 MEDIUM, 2 LOW — agent work_unit inputs, recovery text, test coverage |
| 10 | Completeness | Full codebase search | 1 LOW — conclude-discussion {work_unit} display |

---

## Findings — Fixed

### 1. Agent Input Documentation Missing Work Unit (MEDIUM — 7 files)

**Source**: Agent 9
**Files**: 5 implementation-analysis agents, review-findings-synthesizer, review-task-verifier

Agents listed "Topic name" as input but used `{work_unit}` in output paths. For epic where work_unit != topic, the documented inputs were incomplete. Added Work unit as explicit input to all 7 agent files.

### 2. conclude-discussion Uses `{work_unit}` in Display (LOW)

**Source**: Agent 10
**File**: `conclude-discussion.md` lines 61, 75

User-facing display showed `Discussion concluded: {work_unit}`. For epic, this shows the epic name rather than the topic name. Changed to `{topic}`.

### 3. Implementation and Review Handoffs Missing Work Type (LOW)

**Source**: Agent 6
**Files**: `start-implementation/references/invoke-skill.md`, `start-review/references/invoke-skill.md`

All other phase handoffs include `Work type: {work_type}` but implementation and review didn't. Added for consistency.

### 4. Spec Discovery Anchored Name Check Wrong Path for Epic (LOW)

**Source**: Agent 6
**File**: `start-specification/scripts/discovery.js` lines 159-162

Anchored name check treated topic names as work unit directories, looking in `.workflows/{topic}/specification/` instead of `.workflows/{work_unit}/specification/{topic}/`. Fixed to use `m.name` (work unit) as the directory root.

### 5. spec-completion Hardcoded `feature` in Type Command (LOW)

**Source**: Agent 8
**File**: `spec-completion.md` line 101

Bash command template hardcoded `type feature` with a comment saying "or cross-cutting". Replaced with `{type}` placeholder referencing Section A confirmation.

### 6. plan-construction Nested H4 Conditionals (LOW — convention)

**Source**: Agent 8
**File**: `plan-construction.md` lines 68-99

H4 headings for gate mode and user response were logically nested under a parent H4. Converted to bold text per CLAUDE.md convention.

### 7. research-guidelines Says "push" Instead of "commit" (LOW)

**Source**: Agent 8
**File**: `research-guidelines.md` lines 60-63

"Commit and push immediately" and "pushed" changed to "Commit immediately" and "committed" to match other skills and respect user push preferences.

### 8. Bugfix Discovery Test Coverage (LOW — 4 test files)

**Source**: Agent 9
**Files**: test-discovery-for-specification/planning/implementation/review.js

Added bugfix-specific test cases to all 4 phase discovery test files. Total discovery tests: 179 (up from 175).

---

## Findings — Deferred

### Session State System

**Source**: Agent 6 (epic session state `{topic}` undefined)

The session state / compaction recovery hook system doesn't work reliably. Rather than fixing individual issues, the entire system will be removed. Captured in `session-state-removal/DESIGN-BRIEF.md`.

---

## Not Fixing

| Finding | Reason |
|---------|--------|
| Review Section E doesn't set status completed | Correct by design — review is still in-progress, delegating remediation to implementation before returning for verification. `computeNextPhase` routes back to review after implementation completes. |
| `init-phase` requires --topic for topicless research | No runtime impact — research uses `set`, never `init-phase`. Inconsistency only. |
| Epic continuation bridge research display always empty | Moot — by the time bridge fires, you've moved past research. |
| `computeNextPhase` returns first item's status | Validation prevents mixed statuses per phase. Correct in practice. |
| `conclude-discussion` "other discussions" query scope | Standalone-only edge case. |
| `technical-planning` Step 0 unconditional re-open | Entry-point skill gates this correctly. |
| `plan-review.md` missing cycle-level gate | User can escape via Section D re-loop. Not a dead end. |
| Multi-work-unit unify ambiguity | Pre-existing edge case in standalone unification. |
| `spec-review.md` source paths for standalone | Pipeline guarantees discussion sources. Standalone is being removed. |
| `technical-discussion` no manifest status check on resume | Standalone-only issue. |
| `compact-recovery.sh` stale wording | Will be removed with session state system. |
| README package tree missing 7 agents | README deferred. |
| `analysis-loop` auto-mode at cycle 3+ | Known from Round 8, more conservative by design. |

---

## Key Decisions

- **Review Section E status is correct by design** — review stays `in-progress` when delegating remediation. The pipeline loop handles re-routing.
- **Session state system to be removed** — too buggy to fix incrementally. Design brief created.
- **Standalone-only issues are deferred** — standalone mode will be removed.
- **Agents need explicit Work unit input** — documentation must match what agents need for path construction.

---

## Test Results

After all fixes:
- 179/179 discovery tests (up from 175 — 4 new bugfix tests)
- 88/88 manifest CLI tests
- 118/118 migration 016 tests
- 13/13 migration 017 tests
