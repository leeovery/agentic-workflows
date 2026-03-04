# Audit Checklist

Living document. Each round of audit agents checks everything below. When findings are fixed, new checks are appended. Agents re-run against the full list each round.

**Scope exclusion**: Ignore `workflow-explorer.html` — it will be updated separately once all other fixes are stable.

---

## Round 1 Checks

Source: ARCHITECTURE-FIX-PLAN.md, DISCOVERY-CLEANUP-PLAN.md, RESEARCH-STATUS-PLAN.md, CLAUDE.md conventions.

### 1. Path & Structure Consistency

Verify the uniform path pattern from ARCHITECTURE-FIX-PLAN is applied everywhere (skills, agents, entry-points, references, tests, hooks, docs).

**Flat file phases** (file IS the topic, no subdirectory):
- `.workflows/{work_unit}/discussion/{topic}.md`
- `.workflows/{work_unit}/investigation/{topic}.md`
- `.workflows/{work_unit}/research/*.md` (exempt — freeform, no topic)

**Topic subdir phases** (metafiles alongside primary artifact):
- `.workflows/{work_unit}/specification/{topic}/specification.md`
- `.workflows/{work_unit}/planning/{topic}/planning.md` (+ `tasks/`)
- `.workflows/{work_unit}/implementation/{topic}/implementation.md`
- `.workflows/{work_unit}/review/{topic}/r{N}/review.md`

**State & cache**:
- Per-work-unit state: `.workflows/{work_unit}/.state/` (research-analysis.md, discussion-consolidation-analysis.md)
- Global state: `.workflows/.state/` (migrations, environment-setup.md only)
- Cache: `.workflows/.cache/sessions/`, `.workflows/.cache/planning/{work_unit}/{topic}/`

**What to flag**:
- Old phase-first paths (`.workflows/discussion/{topic}/...` without work_unit prefix)
- Dropped `{topic}` (`.workflows/{work_unit}/implementation/` missing `{topic}/`)
- State files at global `.workflows/.state/` that should be per-work-unit
- Any path that doesn't match the patterns above

### 2. Manifest CLI & Domain-Aware Usage

All manifest interactions must use the domain-aware flag syntax.

**Phase-level operations** (reading/writing per-topic state):
```
$MANIFEST get {work_unit} --phase discussion --topic {topic} status
$MANIFEST set {work_unit} --phase discussion --topic {topic} status concluded
$MANIFEST add-item {work_unit} --phase discussion --topic {topic}
```

**Work-unit-level operations** (no `--phase`/`--topic` flags, dot-path positional args):
```
$MANIFEST get {work_unit} work_type
$MANIFEST set {work_unit} phases.research.analysis_cache '{"checksum":"..."}'
```

**What to flag**:
- Old dot-path syntax: `{name}.phases.discussion.status` (the dot-delimited name prefix)
- `--raw` flag anywhere
- Phase-level metadata (like `analysis_cache`) accessed via `--phase --topic` instead of work-unit-level dot-path
- Missing `--topic` on phase operations that should have it (note: `--phase` without `--topic` is valid for topicless phases like research)

### 3. Work Type Architecture Correctness

Three work types: Epic, Feature, Bugfix. A work unit is an instance of a work type.

**Epic**: Multiple topics per phase. Manifest uses `phases.{phase}.items.{topic}` internally. Topics are distinct from work_unit name.

**Feature/Bugfix**: Single topic per phase. Topic name equals work_unit name. Manifest uses `phases.{phase}` flat structure internally.

**Key**: Skills never know the internal structure — the CLI abstracts it via `--phase --topic` flags.

**workflow-start naming**: `epics: { work_units: [...] }`, `features: { work_units: [...] }`, `bugfixes: { work_units: [...] }` — all plural, all use `work_units`.

**What to flag**:
- `items` or `topics` keys in workflow-start (replaced by `work_units`)
- `epic` singular key (should be `epics`)
- `greenfield` work type (replaced by `epic`)
- Skills that hardcode manifest internal structure (flat vs items) instead of using CLI flags
- Incorrect assumptions about topic=work_unit for epic

### 4. Old System Remnants

Things that should no longer exist anywhere in the codebase.

**Bash discovery scripts**: All discovery scripts should be Node.js (`.js`). No `.sh` discovery scripts should remain in `skills/start-*/scripts/` or `skills/workflow-*/scripts/`.

**Frontmatter in discovery**: No `readFrontmatterField` function or imports. No frontmatter parsing in discovery scripts. Cache files are pure markdown — metadata lives in the manifest.

**Dead code from DISCOVERY-CLEANUP-PLAN**:
- `--raw` flag (removed from manifest CLI)
- `dependency_resolution` top-level array (flattened into plan entries as `deps_satisfied`/`deps_blocking`)
- Dead state counts: `plans_concluded_count`, `plans_with_unresolved_deps`, `plans_ready_count`, `plans_in_progress_count`, `plans_completed_count`
- `cache.status` / `cache.reason` at top level (normalized to always `cache: { entries: [...] }`)
- `items` / `topics` keys in workflow-start (replaced by `work_units`)

**Research status**: No "never concludes" language. Research supports `in-progress` / `concluded` status via manifest. Migration 016 detects concluded research via `> **Discussion-ready**:` marker.

### 5. CLAUDE.md Convention Adherence

Check all skill files (SKILL.md, references/*.md) against CLAUDE.md conventions.

**Display conventions**:
- Every fenced block preceded by a rendering instruction (`> *Output the next fenced block as a code block:*` or `> *Output the next fenced block as markdown (not a code block):*`)
- Titles use `{Phase} Overview` pattern
- Tree structures use `└─` branches with blank lines between numbered items
- Status terms always parenthetical: `(in-progress)`, `(concluded)`
- Menus framed with `· · · · · · · · · · · ·` dot separators
- Bullet character is `•` for all bulleted lists

**Structural conventions**:
- `**STOP.**` (bold, period) — only pattern for interaction boundaries
- H1 for file title only, H2 for steps, H3 for subsections, H4 for conditional routing only
- H4 conditionals: `#### If {condition}` / `#### Otherwise` — no else-if chains
- Nested conditionals use bold text, not H4 (never double-nest H4)
- Navigation: only `→ Proceed to` (forward) and `→ Return to` (backward) — no `→ Go to`, `→ Skip to`, etc.
- Load directives: no `→` before Load line, bold the markdown link
- Reference file headers: `# Title` + `*Reference for **[parent-skill](../SKILL.md)***` + `---`
- Zero Output Rule blockquote present in entry-point skills that invoke processing skills

---

## Round 2 Checks

Source: Round 1 fixes — verifying correctness of changes made.

### 6. Workflow-Start Discovery Shape

Round 1 renamed `items` to `work_units` in workflow-start discovery output.

**Correct shape**: `epics: { work_units: [...] }`, `features: { work_units: [...] }`, `bugfixes: { work_units: [...] }` — all plural group names, all use `work_units`.

**What to flag**:
- Any remaining `.items` references in workflow-start skill files, references, or tests
- `topics` key anywhere in workflow-start (old naming)
- Note: `work_units` in `skills/status/scripts/discovery.js` is correct — different context (flat list of all units)

### 7. Topicless Phase Operations

Round 1 updated the manifest CLI to allow `--phase` without `--topic` for phases that don't have topics (currently only research).

**Valid calls**:
```
$MANIFEST set {work_unit} --phase research status in-progress
$MANIFEST set {work_unit} --phase research status concluded
$MANIFEST get {work_unit} --phase research status
```

**What to flag**:
- `--phase research --topic` with any topic value — research has no topics
- Any remaining code that works around the old limitation (e.g., using work-unit-level dot-path `phases.research.status` to avoid the --topic requirement when `--phase` would be more appropriate)

### 8. Discovery Script Abstractions

Round 1 enforced use of `phaseData()` and `phaseItems()` from discovery-utils.

**What to flag**:
- Direct access to `(m.phases || {}).{phase}` — should use `phaseData(m, '{phase}')`
- Direct access to `.items` on phase objects — should use `phaseItems(m, '{phase}')`
- Discovery scripts that import `phaseData` or `phaseItems` but don't use them (or vice versa — use the pattern but don't import)

### 9. Round 1 Convention Fixes Verification

Verify the specific convention fixes from Round 1 are correct:

- `**⚠️ ZERO OUTPUT RULE**:` (with emoji) present in: start-bugfix, start-investigation, start-research, and all other entry-point skills that invoke processing skills
- Step 0 (migrations) present in ALL entry-point skills including view-plan and link-dependencies
- No duplicate H4 headings anywhere
- No nested H4 conditionals (sub-conditions should use bold text)
- No `→ Proceed to` used for backward/upward navigation
- Rendering instructions match block content (no markdown formatting inside code blocks)

---

## How to Use This Document

1. Dispatch audit agents — each agent gets this full checklist plus the relevant source plans
2. Agents report findings per section number (e.g., "Section 2: found old dot-path in agents/foo.md line 42")
3. Fix findings
4. Append new checks below as a new "Round N" section
5. Re-dispatch agents against the full expanded checklist
6. Repeat until clean
