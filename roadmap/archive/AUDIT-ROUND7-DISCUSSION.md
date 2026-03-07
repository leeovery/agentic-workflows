# Audit Round 7 — Discussion Log

This document captures the findings, discussions, and decisions from the Round 7 audit of `feat/work-type-architecture-v2`. Round 7 used **Opus-only agents** with semantic, adversarial, cross-file, and completeness strategies — a significant upgrade from the Haiku pattern-matching agents used in Rounds 1–6.

**Rule**: No changes are made until findings are discussed and agreed upon one at a time.

---

## Why Round 7 Was Different

Rounds 1–6 used Haiku agents for convention checking. They found formatting issues (navigation verbs, heading levels, rendering instructions) but missed every logic bug. Round 7 switched to Opus with five agent strategies:

1. **Semantic audit** — Read files as if executing them. Flag ambiguity, dead instructions, logic gaps, cross-file mismatches.
2. **Adversarial audit** — Try to break things. Edge cases in manifest CLI, discovery scripts with empty/missing data, migration data corruption.
3. **Cross-file handoff audit** — Trace data flow between files that reference each other. Verify handoffs match.
4. **Coherence audit** — Check CLAUDE.md documentation against actual implementation. Trace complete workflows through all phase transitions.
5. **Completeness audit** — Verify every change in the PR is complete. Search for remnants of old patterns, check test coverage.

---

## Round 7 Agent Summary

10 Opus agents dispatched:

| # | Strategy | Focus | Result |
|---|----------|-------|--------|
| 1 | Semantic | technical-discussion, investigation, specification | 5 findings (cross-cutting pipeline, auto-reloop, sources, bugfix in discussion, recovery text) |
| 2 | Semantic | technical-planning, implementation, review | 9 findings (STOP-before-menu ×2, contradictory routing, review dead ends ×2, nested H4, cycle management) |
| 3 | Cross-file | Entry→processing handoffs, discovery→display→route, session state | Mostly clean — cosmetic session state naming note |
| 4 | Adversarial | Manifest CLI edges, all discovery scripts, agents, migrations | 7 findings (epic blindness ×5, init-phase topicless, TOCTOU race) |
| 5 | Coherence | CLAUDE.md vs reality, workflow routing, epic paths | 8 findings (epic routing ×3, start-research drops args, CLAUDE.md gaps ×3) |
| 6 | Completeness: paths | All files searched for old path patterns | CLEAN — zero old paths remain |
| 7 | Completeness: manifest | All files searched for old CLI patterns | CLEAN — all migrations complete |
| 8 | Completeness: conventions | All skill .md files for heading/navigation/rendering | 13 `→ If` violations, 9 output format files without headers |
| 9 | Completeness: work types | All files for work type correctness | 4 findings (epic discovery scripts, confirmed R7-4/5) |
| 10 | Completeness: tests+migration | All test files + migration scripts | Mostly clean — minor test coverage gaps, migration reporting bug |

---

## Findings — Fixed

### 1. STOP Gates Before Menus (HIGH)

**Source**: R7-2
**Files**: `define-phases.md:70`, `define-tasks.md:80`

`**STOP.**` appeared before the menu blocks. The user would get a blank stop with no options to choose from. Moved STOP after the menu in both files.

### 2. Contradictory Stop Routing (HIGH)

**Source**: R7-2
**File**: `task-loop.md:73` (B. Execute Task → Executor Blocked → `#### If stop`)

Routed to Step 7 (analysis), but `SKILL.md:308` expected Step 8 (completion). If the user stops because the executor is blocked, running analysis on incomplete work is pointless. Fixed task-loop.md to route to Step 8.

### 3. Cross-Cutting Specs Trigger Pipeline Continuation (HIGH)

**Source**: R7-1
**File**: `spec-completion.md` Section F

No gate on specification `type`. Cross-cutting specs (`type: cross-cutting`) with `work_type` set would trigger workflow-bridge to planning, despite `specification-format.md` explicitly stating they don't get standalone plans. Added type check: only `feature` type specs trigger continuation.

### 4. Auto-Reloop Dead Logic (HIGH)

**Source**: R7-1
**File**: `spec-review.md` Section A

Section A's unconditional STOP gate at `review_cycle > 3` prevented Section D's auto-reloop from functioning past cycle 3. The `>= 5` escalation in Section D was unreachable. Added `finding_gate_mode` awareness: auto mode passes through (Section D's cycle 5 cap handles escalation), gated mode presents proceed/skip choice.

### 5. Review Dead Ends (MEDIUM)

**Source**: R7-2
**File**: `review-actions-loop.md`

Two paths where review status was never set to `completed`:
- "Request Changes" verdict + user declines synthesis → invoked bridge but manifest still showed `in-progress`
- "Comments Only" verdict + user declines synthesis → terminal STOP with no status update

Both paths now set `status completed` via manifest CLI and check for pipeline continuation.

### 6. Bugfix in Discussion Work Type (MEDIUM)

**Source**: R7-1
**File**: `conclude-discussion.md:36`

Parenthetical said `(feature, bugfix, or epic)`. Bugfix pipelines use investigation, not discussion. Changed to `(feature or epic)`.

### 7. Missing Discussion Discovery Query (MEDIUM)

**Source**: R7-1
**File**: `conclude-discussion.md:48`

"If work_type is not set and other in-progress discussions exist" — no instruction on HOW to discover them. Added manifest CLI query to check discussion phase state.

### 8. Epic Discovery Blindness (HIGH — systemic)

**Source**: R7-4, R7-5, R7-9 (three independent agents)

All phase discovery scripts from specification onwards assumed `topic == work_unit`. Epic work units were silently invisible. Fixed 5 discovery scripts + `computeNextPhase`:

- `start-specification/scripts/discovery.js` — spec section now iterates `phaseItems` for epic
- `start-planning/scripts/discovery.js` — iterates spec/plan/impl items for epic
- `start-implementation/scripts/discovery.js` — iterates planning/implementation items for epic
- `start-review/scripts/discovery.js` — iterates planning/implementation/review items for epic
- `status/scripts/discovery.js` — aggregates item statuses per phase for epic, adds `item_count`
- `discovery-utils.js` `computeNextPhase` — epic-aware `ps()` that checks item-level statuses

11 new epic tests across 6 test files. Total discovery tests: 172 (up from 161).

### 9. `→ If` Convention Violations (CONVENTION)

**Source**: R7-8
**Files**: `SKILL.md` (4), `analysis-loop.md` (6), `spec-review.md` (1), `review-actions-loop.md` (2)

13 instances of `→ If {condition}` — not a valid navigation verb. 11 converted to H4 headings (top-level routing). 1 converted to bold (nested under existing H4). Also fixed paired plain-text `If` conditionals in analysis-loop.md.

### 10. CLAUDE.md Documentation Gaps (DOCS)

**Source**: R7-5

- Structure tree: added `init-phase` and `push` to manifest CLI command list
- Grammar section: added `push` command example
- Session state: removed "optional pipeline context" claim (field doesn't exist)

### 11. Source Path Resolution (HIGH — pre-existing)

**Source**: R7-1
**File**: `spec-review.md` Section B

The input review agent needs file paths, but the manifest `sources` field stores names and statuses. Previously the LLM had to infer the mapping. Added explicit instruction: read source names from manifest, construct discussion file paths at `.workflows/{work_unit}/discussion/{source-name}.md`.

### 12. Recovery Instructions (LOW — pre-existing)

**Source**: R7-1
**Files**: `technical-discussion/SKILL.md`, `technical-research/SKILL.md`, `technical-review/SKILL.md`

Copy-pasted recovery text referenced "plan index files, review tracking files, implementation tracking files" — files these skills don't create. Tailored each to reference their actual working files.

### 13. Topic vs Work Unit in Display (LOW)

**Source**: R7-1
**File**: `technical-discussion/SKILL.md:44`

"You mentioned {work_unit}" → "You mentioned {topic}" in the broad/ambiguous prompt. The user mentioned a topic, not a work unit.

---

## Not Fixing

| Finding | Reason |
|---------|--------|
| Hardcoded "bugfix" in conclude-investigation.md | Investigation is exclusively bugfix — hardcoding is correct |
| 9 output format files without attribution headers | Intentionally exempt — adapter files, not standard references |
| ~20 reference-to-reference Load directives without `→` | Pre-existing, functionally correct, sub-backbone pattern |
| Session state passes work_unit as "topic" for epic | Cosmetic display only — recovery uses artifact path which is correct |
| Manifest CLI TOCTOU race (cmdSet/cmdPush) | Low severity — work_type never changes after init |
| Migration 017 report_update never called | Cosmetic reporting — migration works correctly |

---

## Key Lessons

1. **Haiku agents are insufficient** for a codebase of this complexity. They pattern-match and report CLEAN without reasoning about logic, flow, or cross-file consistency. Every Round 7 finding was missed by 6 rounds of Haiku agents.

2. **Agent strategy matters more than agent count**. 10 Haiku agents doing the same convention scan find nothing. 5 Opus agents with different strategies (semantic, adversarial, cross-file, coherence, completeness) find real bugs.

3. **Epic support was the biggest gap**. The manifest CLI handled epic correctly internally, but nothing above it (discovery scripts, computeNextPhase, workflow-start overview) actually worked for epic. This was because the Node.js discovery scripts were rewritten from bash without epic test coverage — wherever epic tests existed, the code worked; wherever they didn't, it was broken.

4. **Pre-existing issues surfaced too**. Source path resolution, recovery instructions, and the `→ If` pattern were all present on main. The deep audit found them because it checked logic, not just PR changes.
