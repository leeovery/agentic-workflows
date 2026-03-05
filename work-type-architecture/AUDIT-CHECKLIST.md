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
$MANIFEST init-phase {work_unit} --phase discussion --topic {topic}
$MANIFEST push {work_unit} --phase implementation --topic {topic} completed_tasks "task-1"
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

## Round 3 Checks

Source: Round 2 fixes — verifying correctness and new conventions.

### 10. Step 0 Consolidation

Round 2 consolidated Step 0 migration handling. The `/migrate` skill owns the conditional branching and STOP gate. Entry-point skills delegate entirely.

**Correct Step 0 pattern** (all entry-point skills):
```
## Step 0: Run Migrations

**This step is mandatory. You must complete it before proceeding.**

Invoke the `/migrate` skill and assess its output.
```

**What to flag**:
- Any entry-point skill Step 0 that still contains `#### If files were updated` / `#### If no updates needed` conditionals
- Missing Step 0 in any entry-point skill

### 11. Rendering Instruction Scope

Round 2 clarified: rendering instructions are required only for **user-facing output blocks** — fenced blocks that will be displayed to the user.

**Exempt from rendering instructions**:
- Bash command blocks (model instructions to execute)
- File path references (model instructions to load/read)
- Any fenced block that is an instruction to the model, not output to the user

**What to flag**:
- User-facing output blocks missing rendering instructions
- Do NOT flag bash command blocks or file path references that lack rendering instructions

### 12. Migrate Skill Convention Compliance

Round 2 fixed the `/migrate` skill to use H4 for conditionals and rendering instructions for output blocks.

**What to flag**:
- H3 or other heading levels used for conditional routing (should be H4)
- User-facing fenced blocks in `/migrate` missing rendering instructions

---

## Round 4 Checks

Source: Round 3 fixes — verifying correctness of heading and rendering instruction changes.

### 13. Conditional Routing Heading Levels

Round 3 fixed H2/H3 headings used for conditional routing to H4. Bold conditionals are valid only when nested under an H4.

**What to flag**:
- H2 or H3 headings that follow `If {condition}` / `Otherwise` pattern (should be H4)
- Bold conditionals (`**If ...:**`) that are top-level within a step (should be H4)
- Note: bold conditionals nested under an H4 are correct and should NOT be flagged

### 14. Dynamic Output Templates

Round 3 added rendering instructions for dynamic output. Even when content varies, a placeholder template should follow the rendering instruction.

**What to flag**:
- Instructions to "use a code block" or present output without a rendering instruction + fenced block template
- User-facing inline text (not in a fenced block) that should be wrapped in a rendering instruction + code block

---

## Round 5 Checks

Source: Round 4 audit findings and fixes (AUDIT-ROUND4-DISCUSSION.md).

### 15. No `add-item` References Remain

Round 4 renamed the manifest CLI command `add-item` → `init-phase`. Verify no references to `add-item` remain anywhere in the codebase (excluding audit docs and git history).

**What to flag**:
- Any `add-item` in skill files, scripts, tests, or CLAUDE.md
- Any `cmdAddItem` function references

### 16. `external_dependencies` Format Consistency

Round 4 converted `external_dependencies` from array-of-objects to object-keyed-by-topic. Verify all references use the object format.

**What to flag**:
- Array syntax for `external_dependencies` in discovery scripts, tests, or skill references
- `Array.isArray(external_dependencies)` checks (should use object iteration)
- Array-based YAML/JSON illustrations in documentation

### 17. Positional Argument Documentation

Round 4 redesigned positional arguments: `$0`=work_type, `$1`=work_unit, `$2`=topic (optional).

**What to flag**:
- References to `$0`=work_type, `$1`=topic (old two-arg pattern)
- Routing tables missing Topic column (for epic routing)
- Skill invocations missing work_unit between work_type and topic

### 18. `push` Command Usage in Task Loop

Round 4 added the `push` command and wired it into the task loop for `completed_tasks` and `completed_phases`.

**What to flag**:
- Task loop missing `push` calls for completed_tasks/completed_phases
- `push` command not documented in manifest SKILL.md
- `push` not in the usage line of manifest.js

### 19. `computeNextPhase` Research Handling

Round 4 fixed research handling for all non-bugfix work types. Research is optional — fresh work units default to "ready for discussion".

**What to flag**:
- `computeNextPhase` returning "ready for research" for fresh epic/feature
- Epic-only research checks (should be all non-bugfix)
- Feature phase lists missing conditional research inclusion

### 20. Heading Conventions — H4 for Conditionals

Round 4 fixed remaining instances of bold text and H2 used for top-level conditionals.

**What to flag**:
- H2 headings following `If {condition}` pattern in reference files (should be H4)
- Bold conditionals that are top-level within a step (not nested under H4)
- `---` separators used for em dashes in prose

---

## Round 6 Checks

Source: Round 5 audit findings and fixes (AUDIT-ROUND5-DISCUSSION.md).

### 21. Phase Skill Mode Detection — Three-Arg Pattern

Round 5 found that all 6 start-{phase} skills were missing the `$2` (topic) argument in their mode detection logic. All now document three args and use the resolution formula.

**What to flag**:
- Any start-{phase} skill Step 2 missing `topic = $2 (optional)` in the args line
- Missing resolution line: `topic = $2, or if not provided and work_type is not epic, topic = $1`
- Conditional branches still referencing `work_unit` instead of `topic` for bridge mode detection
- `start-discussion` using `topic = $1` (old naming, should be `work_unit = $1`)

### 22. Bold Conditionals — Routing vs Instructional

Round 5 converted 13 bold routing conditionals to H4. One finding was rejected because it was instructional guidance, not routing.

**What to flag**:
- Bold conditionals (`**If ...:**`) that are top-level routing (mutually exclusive execution paths) — should be H4
- Do NOT flag bold "if" text that is instructional guidance, suggestions, or recovery instructions (e.g., "If you catch yourself violating TDD...")
- The distinction: routing conditionals choose between different execution paths; instructional "if" provides guidance within a single path

---

## Round 7 Checks

Source: Round 7 Opus audit — semantic, adversarial, cross-file, coherence, and completeness strategies (AUDIT-ROUND7-DISCUSSION.md).

### 23. Epic Discovery Script Support

Round 7 found all phase discovery scripts (specification, planning, implementation, review, status) were blind to epic work units. Fixed to iterate `phaseItems()` for epic.

**What to flag**:
- Discovery scripts that use `phaseData(m, '{phase}').status` without epic handling — for epic, status is per-item, not at the phase level
- File paths constructed with `m.name` as topic — for epic, topic differs from work unit name
- Missing `phaseItems` import in discovery scripts that need epic support
- `computeNextPhase` not checking item-level statuses for epic

### 24. Processing Skill Logic Flow

Round 7 found STOP gates before menus, contradictory routing between reference files and SKILL.md, and unreachable code paths.

**What to flag**:
- `**STOP.**` appearing before the menu/prompt it guards (user gets blank stop with no options)
- Reference file routing that contradicts the parent SKILL.md's post-loop routing
- Auto-mode gates that are blocked by unconditional STOP gates in earlier sections
- Review/completion status never set before terminal conditions or pipeline continuation

### 25. Pipeline Continuation Correctness

Round 7 found cross-cutting specs triggering planning and review dead ends.

**What to flag**:
- Pipeline continuation (`/workflow-bridge` invocation) without gating on specification type — cross-cutting specs should NOT proceed to planning
- Terminal conditions that leave phase status as `in-progress` when the phase is actually complete
- Hardcoded work_type values where the manifest should be read (exception: `conclude-investigation.md` correctly hardcodes `bugfix` since investigation is exclusively bugfix)

### 26. Navigation Verb `→ If` Pattern

Round 7 found 13 instances of `→ If {condition}` used as conditional routing. CLAUDE.md only allows `→ Proceed to`, `→ Return to`, and `→ Load`.

**What to flag**:
- `→ If` or `→ Otherwise` — should be H4 headings (top-level) or bold (nested under H4)
- Plain-text `If {condition}:` used for top-level routing without H4 heading

### 27. Source Path Resolution

Round 7 found spec-review.md passing manifest metadata (source names) where the agent expects file paths.

**What to flag**:
- Instructions that pass manifest field values directly to agents when the agent expects file paths
- Missing path construction from manifest names to filesystem paths

### 28. Recovery Instructions Accuracy

Round 7 found copy-pasted recovery text referencing files the skill doesn't create.

**What to flag**:
- "Resuming After Context Refresh" sections that reference files from other skills
- Generic file lists instead of skill-specific file paths

---

## How to Use This Document

1. Dispatch audit agents — each agent gets this full checklist plus the relevant source plans
2. Agents report findings per section number (e.g., "Section 2: found old dot-path in agents/foo.md line 42")
3. Fix findings
4. Append new checks below as a new "Round N" section
5. Re-dispatch agents against the full expanded checklist
6. Repeat until clean
