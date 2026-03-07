# Audit Round 1 — Fix Tracker

Findings from 5 audit agents run against AUDIT-CHECKLIST.md. Each fix has a status and decision.

---

## Section 1: Paths & Structure

### 1.1–1.6: `{topic}` in `{work_unit}` position
**Status**: TODO
**Decision**: Fix. Replace `{topic}` with `{work_unit}` in the first path segment.
**Files**:
- `skills/start-feature/references/invoke-skill.md` lines 21, 32
- `skills/start-feature/references/invoke-research.md` line 19
- `skills/start-research/SKILL.md` line 91
- `skills/start-research/references/invoke-skill.md` line 17
- `skills/start-bugfix/references/invoke-investigation.md` lines 19, 35
- `skills/link-dependencies/SKILL.md` line 177

### 1.7–1.8: Missing `.workflows/` prefix
**Status**: TODO
**Decision**: Fix. Add missing prefix.
**Files**:
- `skills/start-specification/references/confirm-unify.md` lines 20-21
- `skills/start-specification/references/confirm-create.md` line 47

### 1.9: Comment says `{topic}` should say `{work_unit}`
**Status**: TODO
**Decision**: Fix.
**File**: `skills/migrate/scripts/migrations/016-work-unit-restructure.sh` line 6

---

## Section 2: Manifest CLI

### 2.1–2.2: `set --phase` without `--topic` fails at runtime
**Status**: TODO
**Decision**: Update CLI to allow `--phase` without `--topic`. Route to `phases.{phase}` directly when topic is missing. Research is currently the only topicless phase but the design should be general.
**Files**:
- `skills/workflow-manifest/scripts/manifest.js` — update `cmdSet` (and `cmdGet` for symmetry) to allow missing `--topic`
- Add test cases for `set/get --phase` without `--topic`
- `skills/technical-research/SKILL.md` line 92 — no change needed (will work after CLI fix)
- `skills/technical-research/references/convergence-awareness.md` line 34 — no change needed

### 2.3: Stale `--raw` in plan doc
**Status**: TODO
**Decision**: Fix. Update wording in work-type-architecture/RESEARCH-STATUS-PLAN.md line 54.

---

## Section 3: Work Type Architecture

### 3.1–3.2: `work_units` key in status discovery
**Decision**: KEEP. Semantically correct in status context.

### 3.NEW: Rename `items` to `work_units` in workflow-start discovery
**Status**: TODO
**Decision**: Fix. `items` is too generic — these ARE work units grouped by type. Aligns with status discovery.
**Files**:
- `skills/workflow-start/scripts/discovery.js` — rename `items` to `work_units` in return shape
- `skills/workflow-start/references/work-type-selection.md` — update `*.items` to `*.work_units`
- `skills/workflow-start/references/epic-routing.md` — update refs
- `skills/workflow-start/references/feature-routing.md` — update refs
- `skills/workflow-start/references/bugfix-routing.md` — update refs
- `skills/workflow-start/SKILL.md` — update discovery shape docs
- `tests/scripts/test-discovery-for-workflow-start.js` — update assertions

### 3.3: Hardcoded `.items` in start-specification discovery
**Status**: TODO
**Decision**: Fix. Replace `((m.phases || {}).discussion || {}).items || {}` with `phaseItems(m, 'discussion')` at line 88.
**File**: `skills/start-specification/scripts/discovery.js`

### 3.4: Bypass `phaseData()` abstraction
**Status**: TODO
**Decision**: Fix. Use the provided abstractions consistently.
**Files**:
- `skills/start-discussion/scripts/discovery.js` line 34 — use `phaseData(m, 'discussion')`
- `skills/start-specification/scripts/discovery.js` line 16 — use `phaseData(m, 'discussion')`
- `skills/workflow-bridge/scripts/discovery.js` line 54 — import and use `phaseData`

---

## Section 5: CLAUDE.md Conventions

### 5.1–5.2: ZERO OUTPUT RULE missing emoji
**Status**: TODO
**Decision**: Fix. Add `⚠️` emoji.
**Files**:
- `skills/start-bugfix/SKILL.md` line 14
- `skills/start-investigation/SKILL.md` line 14

### 5.3: ZERO OUTPUT RULE missing from start-research
**Status**: TODO
**Decision**: Fix. Add the full ZERO OUTPUT RULE blockquote. Oversight, not intentional.
**File**: `skills/start-research/SKILL.md`

### 5.4–5.5: Non-standard reference file headers
**Status**: TODO
**Decision**: Fix. Match the standard `*Reference for **[parent-skill](../SKILL.md)***` pattern.
**Files**:
- `skills/technical-planning/references/dependencies.md` line 3
- `skills/technical-planning/references/plan-index-schema.md` line 3

### 5.6: Duplicate H4 heading in validate-topic.md
**Status**: TODO
**Decision**: Fix. Remove duplicate heading at line 17.
**File**: `skills/start-discussion/references/validate-topic.md`

### 5.7: Nested H4 in validate-investigation.md
**Status**: TODO
**Decision**: Fix. Lines 17 and 29 should be bold text, not H4.
**File**: `skills/start-investigation/references/validate-investigation.md`

### 5.8: Nested H4 in select-plans.md
**Status**: TODO
**Decision**: Fix. Lines 13 and 34 (under `analysis` scope) should be bold text, not H4.
**File**: `skills/start-review/references/select-plans.md`

### 5.9: `Proceed to` used for backward navigation
**Status**: TODO
**Decision**: Fix. Change to `→ Return to **[the skill](../SKILL.md)** for **Step 5**.`
**File**: `skills/start-discussion/references/handle-selection.md` line 72

### 5.10–5.11: Missing Step 0 in view-plan and link-dependencies
**Status**: TODO
**Decision**: Fix. Migrations are required — these skills depend on manifests and state files being current.
**Files**:
- `skills/view-plan/SKILL.md` — add Step 0, renumber existing steps
- `skills/link-dependencies/SKILL.md` — add Step 0, renumber existing steps

### 5.12: Mixed info display + menu in single block
**Status**: TODO
**Decision**: Fix. Split into separate code block (info) and markdown block (menu) per convention.
**File**: `skills/start-planning/references/cross-cutting-context.md` lines 21-33

### 5.13: Markdown formatting inside code block in view-plan
**Status**: TODO
**Decision**: Fix. Change rendering instruction to markdown — the content benefits from rendered formatting.
**File**: `skills/view-plan/SKILL.md` lines 47-61
**Also**: Add a note to CLAUDE.md Display conventions that markdown rendering is preferred when content benefits from it and indentation control isn't needed.

### 5.14: Intro text missing `analysis` scope
**Status**: TODO
**Decision**: Fix. Add `analysis` to the scope list.
**File**: `skills/start-review/references/select-plans.md` line 7
