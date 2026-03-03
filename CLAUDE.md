# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code skills package for structured technical discussion and planning workflows. Installed via `npx agntc add leeovery/claude-technical-workflows`.

## Work Types

The workflow system supports three work types, each with its own pipeline:

**Epic**: Multi-topic work spanning multiple sessions (new products, large initiatives)
- Phase-centric, multi-session, long-running (days/weeks/months)
- Topics move independently within phases
- Research → Discussion → Specification → Planning → Implementation → Review

**Feature**: Adding functionality to an existing product
- Topic-centric, single-session, linear pipeline
- Optional research step if uncertainties exist
- Discussion → Specification → Planning → Implementation → Review

**Bugfix**: Fixing broken behavior
- Investigation-centric, single-session
- Investigation replaces discussion (combines symptom gathering + code analysis)
- Investigation → Specification → Planning → Implementation → Review

## Workflow Phases

1. **Research** (`technical-research` skill): EXPLORE - feasibility, market, viability, early ideas
2. **Discussion** (`technical-discussion` skill): Capture WHAT and WHY - decisions, architecture, edge cases, debates
3. **Investigation** (`technical-investigation` skill): Bugfix-specific - symptom gathering + code analysis → root cause
4. **Specification** (`technical-specification` skill): Validate and refine into standalone spec
5. **Planning** (`technical-planning` skill): Define HOW - phases, tasks, acceptance criteria
6. **Implementation** (`technical-implementation` skill): Execute plan via strict TDD
7. **Review** (`technical-review` skill): Validate work against discussion, specification, and plan

## Structure

```
skills/
  # Processing skills (model-invocable — do the work)
  technical-research/        # Explore and validate ideas
  technical-discussion/      # Document discussions (feature/epic)
  technical-investigation/   # Investigate bugs (bugfix pipeline)
  technical-specification/   # Build validated specifications
  technical-planning/        # Create implementation plans
  technical-implementation/  # Execute via TDD
  technical-review/          # Validate against artifacts

  # Unified entry points
  workflow-start/              # Unified entry point - discovers state, routes by work type
    scripts/discovery.js       #   Comprehensive cross-phase discovery
    references/                #   Work type selection, routing references
  workflow-bridge/             # Pipeline continuation - discovers next phase, enters plan mode
    scripts/discovery.js       #   Topic-specific or phase-centric discovery
    references/                #   Work-type-specific continuation logic
  workflow-shared/             # Shared utilities used by other workflow skills
    scripts/discovery-utils.js #   Discovery helpers (manifest loading, phase state, checksums)
  workflow-manifest/           # Manifest CLI — single source of truth for workflow state
    scripts/manifest.js        #   Node.js CLI (get/set/list/init/archive)

  # Entry-point skills (user-invocable — gather context, invoke processing skills)
  migrate/                   # Keep workflow files in sync with system design
    scripts/migrate.sh       #   Migration orchestrator
    scripts/migrations/      #   Individual migration scripts (numbered)
  start-epic/                # Start epic pipeline (multi-topic, multi-session)
    references/              #   Interview questions, handoffs, phase bridge
  start-feature/             # Start feature pipeline (power user entry)
    references/              #   Interview questions, handoffs, phase bridge
  start-bugfix/              # Start bugfix pipeline (power user entry)
    references/              #   Bug context gathering, phase bridge
  link-dependencies/         # Link dependencies across topics

  # Phase entry skills (two-mode: discovery OR bridge)
  start-research/            # Begin research exploration
    references/              #   Context gathering, handoffs
  start-discussion/          # Discussion - discovery mode or bridge mode (topic+work_type)
    scripts/discovery.js     #   Discovery script
    references/              #   Discovery flow, context gathering
  start-investigation/       # Investigation - discovery mode or bridge mode
    scripts/discovery.js     #   Discovery script
    references/              #   Discovery flow
  start-specification/       # Specification - discovery mode or bridge mode
    scripts/discovery.js     #   Discovery script
    references/              #   Discovery flow, grouping analysis
  start-planning/            # Planning - discovery mode or bridge mode
    scripts/discovery.js     #   Discovery script
    references/              #   Discovery flow, cross-cutting context
  start-implementation/      # Implementation - discovery mode or bridge mode
    scripts/discovery.js     #   Discovery script
    references/              #   Discovery flow, dependency checking
  start-review/              # Review - discovery mode or bridge mode
    scripts/discovery.js     #   Discovery script
    references/              #   Discovery flow, plan display
  status/                    # Show workflow status and next steps
    scripts/discovery.js     #   Discovery script
  view-plan/                 # View plan tasks and progress

.claude/skills/
  create-output-format/      # Dev-time skill: scaffold new output format adapters
  update-workflow-explorer/  # Dev-time skill: sync workflow-explorer.html with source

agents/
  review-task-verifier.md                # Verifies single task implementation for review
  review-findings-synthesizer.md         # Synthesizes QA findings into remediation tasks
  implementation-task-executor.md        # TDD executor for single plan tasks
  implementation-task-reviewer.md        # Post-task review for spec conformance
  implementation-analysis-architecture.md # Architecture conformance analysis
  implementation-analysis-duplication.md  # Duplication and DRY analysis
  implementation-analysis-standards.md    # Coding standards analysis
  implementation-analysis-synthesizer.md  # Synthesize analysis findings
  implementation-analysis-task-writer.md  # Write tasks from analysis findings
  planning-phase-designer.md             # Design phases from specification
  planning-task-designer.md              # Break phases into task lists
  planning-task-author.md                # Write full task detail
  planning-dependency-grapher.md         # Analyze task dependencies and priorities
  planning-review-traceability.md        # Spec-to-plan traceability analysis
  planning-review-integrity.md           # Plan structural quality review
  specification-review-gap-analysis.md   # Specification gap analysis
  specification-review-input.md          # Specification input review

tests/
  scripts/                   # Tests for discovery scripts and migrations

hooks/
  workflows/
    system-check.sh      # Bootstrap: install project-level hooks
    session-env.sh       # Export CLAUDE_SESSION_ID on session start
    compact-recovery.sh  # Read session state, inject recovery context
    session-cleanup.sh   # Delete session state on session end
    write-session-state.sh # Helper: write session state YAML
```

## Skill Architecture

Skills are organised in two tiers:

**Entry-point skills** (`/start-*`, `/status`, `/migrate`, etc.) are user-invocable. They gather context from files, prompts, or inline input, then invoke a processing skill. Utility entry-points (`/status`, `/view-plan`, `/link-dependencies`, `/workflow-start`) have `disable-model-invocation: true`. Phase entry-points (`/start-*`) do not, since they are invoked by `workflow-start` routing and `workflow-bridge` continuations. `/migrate` has `user-invocable: false` — it is model-invoked only (Step 0 of every entry-point skill).

**Processing skills** (`technical-*`) are model-invocable. They receive inputs and process them without knowing where the inputs came from. Entry-point skills are responsible for gathering inputs.

**Standalone entry points** (e.g., `/start-feature`) can invoke processing skills directly without requiring previous phase files.

### Two-Mode Pattern for Phase Skills

Phase entry skills (`start-discussion`, `start-specification`, etc.) support three invocation patterns. Arguments are positional: `$0` = work_type, `$1` = topic.

**Bridge Mode** (work_type + topic):
- Invoked with both arguments: `/start-discussion feature {topic}`
- Or invoked by `workflow-bridge` with work_type + topic in context
- Skips discovery, validates topic exists, proceeds to pre-flight and processing
- Enables deterministic pipeline continuation

**Discovery Mode with pipeline context** (work_type only):
- Invoked with work_type but no topic: `/start-specification epic`
- Stores work_type for the handoff, then runs full discovery
- Enables epic routing where topic isn't known until analysis

**Standalone Discovery Mode** (no arguments):
- User invokes `/start-discussion` directly
- Full discovery, topic selection, context gathering
- No pipeline context — artifacts created without work_type won't trigger bridge at conclusion

The two-mode pattern consolidates what was previously split between `start-*` (discovery) and `begin-*` (bridge) skills into a single skill with early mode detection.

### Keeping Processing Skills Workflow-Agnostic (IMPORTANT)

Processing skills should **never hardcode references** to specific workflow phases (e.g., "the research phase", "after discussion"). This allows them to be invoked from different entry points — whether via workflow skills or standalone skills like `/start-feature`.

**In processing skills, avoid:**
- "The research, discussion, and specification phases..."
- "After completing discussion, you should..."
- "Proceed to the planning phase..."

**In processing skills, prefer:**
- "The specification contains validated decisions..."
- "Planning is complete when..."
- Reference inputs generically (specification, plan) not how they were created

**Entry-point skills set context; processing skills process inputs.** If workflow-specific language is needed, it belongs in the entry-point skill, not in the processing skill.

## Key Conventions

Work-unit-first directory structure with uniform `{topic}` in all paths. For feature/bugfix, `{topic}` equals `{work_unit}`. For epic, `{topic}` is the item within a phase.

- Manifest: `.workflows/{work_unit}/manifest.json`
- Research: `.workflows/{work_unit}/research/` (freeform, no topic)
- Discussion: `.workflows/{work_unit}/discussion/{topic}.md` (flat file)
- Investigation: `.workflows/{work_unit}/investigation/{topic}.md` (flat file)
- Specification: `.workflows/{work_unit}/specification/{topic}/specification.md`
- Planning: `.workflows/{work_unit}/planning/{topic}/planning.md` + `tasks/`
- Implementation: `.workflows/{work_unit}/implementation/{topic}/implementation.md`
- Review: `.workflows/{work_unit}/review/{topic}/r{N}/review.md`
- State: `.workflows/{work_unit}/.state/` (per-work-unit analysis files)
- Global state: `.workflows/.state/` (migrations, environment-setup.md)
- Cache: `.workflows/.cache/` (sessions, planning scratch)

**work_type field**: Each work unit's `work_type` (epic, feature, or bugfix) is stored in its `manifest.json` — the single source of truth for all workflow state. This enables:
- Unified discovery across all phases
- Correct pipeline routing via workflow-bridge
- Work-type-specific behavior in processing skills

Commit docs frequently (natural breaks, before context refresh). Skills capture context, don't implement.

## Adding New Output Formats

Use the `/create-output-format` skill to scaffold a new format adapter. Each format is a directory of 5 files:

```
skills/technical-planning/references/output-formats/{format}/
├── about.md        # Benefits, setup, output location
├── authoring.md    # Task storage, flagging, cleanup
├── reading.md      # Extracting tasks, next available task
├── updating.md     # Marking complete/skipped
└── graph.md        # Task graph — priority + dependencies
```

The contract and scaffolding templates live in `.claude/skills/create-output-format/references/`.

## Output Format References (IMPORTANT)

**NEVER list output format names (linear, local-markdown, etc.) anywhere except:**
- `skills/technical-planning/references/output-formats.md` - the authoritative list
- `skills/technical-planning/references/output-formats/{format}/` - individual format directories
- `README.md` - user-facing documentation where format options are presented

**Why this matters:** Listing formats elsewhere creates maintenance dependencies. If a format is added or removed, we should only need to update the planning references - not hunt through other skills or documentation.

**How other phases reference formats:**
- Plans include a `format` field in their manifest
- Consumers load only the per-concern file they need (e.g., `{format}/reading.md` for implementation)

This keeps format knowledge centralized in the planning phase where it belongs.

## Migrations

The `/migrate` skill keeps workflow files in sync with the current system design. It runs via Step 0 at the start of every entry-point skill.

**How it works:**
- `skills/migrate/scripts/migrate.sh` runs all migration scripts in `skills/migrate/scripts/migrations/` in numeric order
- Each migration is idempotent - safe to run multiple times
- Progress is tracked in `.workflows/.state/migrations`
- Delete the log file to force re-running all migrations

**Adding new migrations:**
1. Create `skills/migrate/scripts/migrations/NNN-description.sh` (e.g., `002-spec-frontmatter.sh`)
2. The script will be run automatically in numeric order
3. The orchestrator handles tracking — once a migration ID appears in the log, the script never runs again
4. Use helper functions: `report_update`, `report_skip` (for display only)

**Migration 016 — Work-unit restructure:**
Migration 016 converts phase-first directories to work-unit-first, creates `manifest.json` files from artifact frontmatter, renames `plan.md` to `planning.md` and `tracking.md` to `implementation.md`, and updates `work_type: greenfield` to `epic`. Frontmatter is preserved in migrated artifacts as a safety net — a follow-up migration will strip it once the manifest system is proven.

**Critical: Frontmatter extraction in bash scripts**

Workflow documents may contain `---` horizontal rules in body content. NEVER use `sed -n '/^---$/,/^---$/p'` to extract frontmatter — it matches ALL `---` pairs, not just the first frontmatter block, causing body content to leak into extraction results and potential content loss during file rewrites.

Always use this awk pattern for safe frontmatter extraction:
```bash
awk 'BEGIN{c=0} /^---$/{c++; if(c==2) exit; next} c==1{print}' "$file"
```

For content after frontmatter (preserving all body `---`):
```bash
awk '/^---$/ && c<2 {c++; next} c>=2 {print}' "$file"
```

Also avoid BSD sed incompatibilities: `sed '/range/{cmd1;cmd2}'` syntax fails on macOS. Use awk or separate `sed -e` expressions instead.

## Compaction Recovery

Processing skills run long and may hit context compaction. The hook system provides deterministic recovery.

**How it works:**
- Project-level hooks in `.claude/settings.json` are snapshotted at session startup and persist through compaction
- `SessionStart` (compact) hook reads session state from `.workflows/.cache/sessions/{session_id}.yaml` and injects recovery context as additionalContext
- Entry-point skills write session state (topic, skill, artifact) before invoking processing skills
- `SessionEnd` hook cleans up session state files

**Session state files:**
- Stored at `.workflows/.cache/sessions/{session_id}.yaml`
- Created by entry-point skills before invoking processing skills
- Contain: topic, skill path, artifact path, optional pipeline context
- Ephemeral — cleaned up on session end, gitignored

**First-run bootstrap:**
- Skill-level `PreToolUse` hook (`system-check.sh`) detects missing project hooks
- Installs hooks into `.claude/settings.json` (appends to existing settings, preserving user configuration) and stops with restart message
- Uses jq if available for merging, falls back to node, then to manual instructions
- One-time cost; self-healing if hooks are removed

## Manifest CLI

The manifest CLI at `skills/workflow-manifest/scripts/manifest.js` is the single source of truth for all workflow state. It replaces YAML frontmatter for state management — artifacts are pure markdown with no frontmatter.

Key properties:
- JSON format, zero dependencies (Node handles JSON natively)
- Domain-aware flag syntax: `--phase` and `--topic` flags route to correct internal path based on work_type
- Skills never know manifest internal structure (flat for feature/bugfix, items for epic)
- File locking for concurrent session safety
- Validation of structural values (work_type, phase names, statuses, gate modes)
- Manifest location: `.workflows/{work_unit}/manifest.json`

Domain-aware CLI grammar:
```bash
MANIFEST="node .claude/skills/workflow-manifest/scripts/manifest.js"
$MANIFEST get {work_unit} --phase discussion --topic {topic} status    # phase-level read
$MANIFEST set {work_unit} --phase discussion --topic {topic} status concluded  # phase-level write
$MANIFEST add-item {work_unit} --phase discussion --topic {topic}      # create phase entry
$MANIFEST get {work_unit} work_type                                    # work-unit-level read
$MANIFEST get {work_unit} --raw phases.discussion.status               # raw dot-path (discovery scripts only)
```

See `skills/workflow-manifest/SKILL.md` for the full API.

## Display & Output Conventions (IMPORTANT)

All entry-point skills that present discovery state, menus, or interactive choices MUST follow these conventions. This ensures a consistent, scannable experience across all phases.

### Rendering Instructions

Every fenced block in skill files must be preceded by a rendering instruction:

```
> *Output the next fenced block as a code block:*
```

or:

```
> *Output the next fenced block as markdown (not a code block):*
```

Code blocks are used for informational displays (overviews, status, keys). Markdown is used for interactive elements (menus, prompts) where bold formatting is needed.

### Title Pattern

Always `{Phase} Overview` as the first line of the opening code block, followed by a blank line and a summary sentence.

```
Planning Overview

4 specifications found. 2 plans exist.
```

### Template Placeholders

Skill files use placeholders in fenced block templates. The syntax is:

```
{name}                                    — raw value, output as-is
{name:[option1|option2|option3]}          — enumerated options (pick one)
{name:(casing)}                           — with casing hint
{name:[option1|option2]:(casing)}         — options and casing
```

Casing hints: `titlecase`, `lowercase`, `kebabcase`. No hint means output the raw value.

Each part is optional — use only what's needed for clarity.

**Conditional directives** for branches that render differently based on state:

```
@if(condition) truthy content @else falsy content @endif
```

Example: `@if(has_discussion) {topic}.md ({status:[in-progress|concluded]}) @else (no discussion) @endif`

**Loop directives** for iterating over collections:

```
@foreach(item in collection)
  • {item.name} ({item.status})
@endforeach
```

Example with filter: `@foreach(inv in investigations.files where status is in-progress)`

**When to use placeholders vs concrete examples:** Placeholders work well for structural templates (tree displays, status blocks) where each field has a clear source. Selection menus should use concrete examples instead — they encode conditional logic (which verb maps to which state) that placeholders obscure.

### Tree Structure

Every actionable item gets a numbered entry with `└─` branches showing its state. Depth varies by phase but structure is consistent. **Blank line between each numbered item.** Show one full entry, then `2. ...` to indicate repetition.

```
1. {topic:(titlecase)}
   └─ Plan: @if(has_plan) {plan_status:[in-progress|concluded]} @else (no plan) @endif
   └─ Spec: {spec_status:[in-progress|concluded]}

2. ...
```

For richer hierarchies (specification phase):

```
1. {topic:(titlecase)}
   └─ Spec: {spec_status:[in-progress|concluded]} ({extraction_summary})
   └─ Discussions:
      ├─ {discussion} ({status:[extracted|pending]})
      └─ ...
```

### Status Terms

Always parenthetical `(term)`. Never brackets or dash-separated.

Core vocabulary: `in-progress`, `concluded`, `ready`, `completed`, `extracted`, `pending`, `reopened`. Phase-specific terms are fine but format is always `(term)`.

### Cross-Plan References

Use colon notation to reference a task within a plan: `{plan}:{task-id}`.

```
  · advanced-features (blocked by core-features:core-2-3)
```

Reads as: "advanced-features is blocked by task core-2-3 in the core-features plan."

### "Not Ready" Blocks

Separate code block. Descriptive heading as `{Artifacts} not ready for {phase}:`, explanatory line, then `•` bullets with parenthetical status. **Blank line after the explanation, before the list.**

```
Specifications not ready for planning:
These specifications are either still in progress or cross-cutting
and cannot be planned directly.

  • caching-strategy (cross-cutting, concluded)
  • rate-limiting (cross-cutting, in-progress)
```

### Key / Legend

Separate code block. Categorized. Em dash (`—`) separators. **No `---` separator before the Key block.** Only show statuses that appear in the current display. **Blank line between categories.**

```
Key:

  Plan status:
    in-progress — planning work is ongoing
    concluded   — plan is complete

  Spec type:
    cross-cutting — architectural policy, not directly plannable
    feature       — plannable feature specification
```

### Menus / Interactive Prompts

Rendered as markdown (not code blocks). Framed with dot separators. Verb-based labels for selection menus. No single-character icons.

**Selection menu** — use concrete examples showing verb-to-state mapping:

```
· · · · · · · · · · · ·
1. Create "Auth Flow" — concluded spec, no plan
2. Continue "Data Model" — plan in-progress
3. Review "Billing" — plan concluded

Select an option (enter number):
· · · · · · · · · · · ·
```

**Yes/no prompt:**

```
· · · · · · · · · · · ·
Proceed?
- **`y`/`yes`**
- **`n`/`no`**
· · · · · · · · · · · ·
```

**Multi-choice prompt:**

```
· · · · · · · · · · · ·
What scope would you like to review?

- **`s`/`single`** — Review one plan's implementation
- **`m`/`multi`** — Review selected plans
- **`a`/`all`** — Review all implemented plans
· · · · · · · · · · · ·
```

**Meta options** in selection menus get backtick-wrapped descriptions:

```
3. Unify all into single specification
   `All discussions combined into one specification.`
   `Existing specifications are incorporated and superseded.`
```

### Auto-Select

When only one actionable item exists:

```
Automatically proceeding with "{topic:(titlecase)}".
```

### Block / Terminal Messages

When a phase can't proceed — use the phase title pattern, then explain:

```
Planning Overview

No specification found in .workflows/{work_unit}/specification/{topic}/

The planning phase requires a concluded specification.
Run /start-specification first.
```

### Bullet Characters

Use `•` for all bulleted lists (sources, files, not-ready items, etc.).

### Spacing Rules

Inside code blocks, maintain **one blank line** between:
- Title/summary and first content
- Each numbered tree item
- Section headings and their content
- Key categories

Between code blocks (overview → not-ready → key → menu), no `---` separators — just the natural block separation.

## Structural Conventions (IMPORTANT)

All skill files (entry-point and processing) MUST follow these structural conventions for consistency.

### Stop Gates

Use `**STOP.**` (bold, period). This is the only pattern for user interaction boundaries.

Two categories:

**Interaction stop** — waiting for real user input to continue:
```
**STOP.** Wait for user response.
**STOP.** Wait for user response before proceeding.
```

**Terminal stop** — skill is done, nothing to process:
```
**STOP.** Do not proceed — terminal condition.
```

Never use `Stop here.`, `Command ends.`, `Wait for user to acknowledge before ending.`, or other variations.

### Heading Hierarchy

- **H1** (`#`): File title only — one per file, at the top
- **H2** (`##`): Steps and major sections (`## Step N: {Name}`, `## Notes`, `## Instructions`)
- **H3** (`###`): Subsections within steps (`### 6a: Warn about in-progress specs`)
- **H4** (`####`): Conditional routing only (`#### If {condition}`, `#### Otherwise`)

### Step Numbering

Sequential: `## Step 0`, `## Step 1`, `## Step 2`, etc.

- **Step 0** runs migrations via the `/migrate` skill (mandatory in all entry-point skills)
- Steps are separated by `---` horizontal rules
- Each step completes fully before the next begins

### Conditional Routing

Use H4 headings for if/else branches within a step:

```
#### If scenario is "no_specs"
{content}

#### If scenario is "has_options"
{content}
```

**Nested conditionals** — use bold text for conditionals inside an H4 block:

```
#### If yes

1. Shared setup steps...

**If work_type is set** (feature, bugfix, or epic):

{branch content}

**If work_type is not set:**

{branch content}
```

**Avoid double-nesting** — if a bold conditional would contain further bold conditionals, flatten by combining conditions:

```
**If work_type is not set and other discussions exist:**
...
**If work_type is not set and no discussions remain:**
...
```

Rules:
- Never use else-if chains — each condition gets its own `#### If` heading
- Lowercase after "If" (e.g., `#### If concluded_count == 1`)
- Use `#### Otherwise` for else branches
- Use backticks around specific values, variables, and statuses in H4 headings (e.g., `` #### If `STATUS` is `clean` ``, `` #### If work type is `feature` ``). Natural language conditions stay plain text (e.g., `#### If no plan provided`)
- Use "and" between conditions, not commas
- Drop implied conditions (e.g., if Step 2 already gates on `concluded_count >= 1`, Step 3 doesn't need to repeat it on every branch)
- H4 for top-level conditionals, bold text for nested — never use H5/H6 for conditional nesting
- If double-nesting would occur, flatten by combining the parent and child conditions into a single bold conditional

### Navigation Arrows

Use `→` for flow control between steps or to external files:

```
→ Proceed to **Step 4**.
→ Proceed to **Step 7** to invoke the skill.
→ Load **[file.md](file.md)** and follow its instructions.
```

### Reference File Headers

Reference files loaded by skills use this header pattern:

```
# Title

*Reference for **[parent-skill](../SKILL.md)***

---
```

### Critical / Important Markers

Use bold labels with colons for emphasis levels:

```
**CRITICAL**: This guidance is mandatory.
**IMPORTANT**: Use ONLY this script for discovery.
**CHECKPOINT**: Summarize progress before continuing.
```

### Zero Output Rule

Entry-point skills that invoke processing skills use this exact blockquote to prevent narration:

```
> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.
```

### Auto-Mode Gates

Per-item approval gates can offer `a`/`auto` to let the user bypass repeated STOP gates. This pattern is used in implementation (task + fix gates), planning (task list approval + task authoring + review findings), and specification (review findings).

**Manifest tracking**: Gate modes are stored in the manifest via CLI (`gated` or `auto`). This ensures they survive context refresh.

**Behavior when `auto`**: Content is always rendered above the gate check (so both modes see identical output). Auto mode proceeds without a STOP gate. Use a rendering instruction + code block for the one-line announcement:

```
> *Output the next fenced block as a code block:*

\```
Task {M} of {total}: {Task Name} — authored. Logging to plan.
\```
```

**Lifecycle**:
- Default: `gated` (set in manifest on creation)
- Opt-in: user chooses `a`/`auto` at any per-item gate → manifest updated via CLI before next commit
- Reset: entry-point skills reset gates to `gated` on fresh invocation (not on `continue`)
- Context refresh: read gate modes from manifest and preserve

**Menu option format**: Add between the primary action and secondary options:
```
- **`a`/`auto`** — Approve this and all remaining {items} automatically
```

**Re-loop safety cap**: When auto-mode enables automatic re-analysis loops, cap at 5 cycles before escalating to the user. This prevents infinite cascading.

### Rendering Instructions for Ask Blocks

When a step asks the user a question, wrap it in a rendering instruction and code block — don't use bare `Ask:` labels:

```
> *Output the next fenced block as a code block:*

\```
What's on your mind?

- What idea or topic do you want to explore?
- What prompted this - a problem, opportunity, curiosity?
\```

**STOP.** Wait for user response before proceeding.
```

## Skill File Structure (Progressive Disclosure)

All skills (entry-point and processing) use a backbone + reference file pattern. The backbone (SKILL.md) is always loaded and reads like a table of contents. Reference files contain step detail, loaded on demand via Load directives.

### Backbone Structure

```
Frontmatter
One-liner purpose statement
Workflow context table
"Stay in your lane" instruction
---
Critical instructions (STOP/wait rules, mandatory guidance)
---
Step 0: Run Migrations (always inline)
---
Step 1: {Name}
Load directive → reference file
→ Proceed to Step 2.
---
Step 2: {Name}
Load directive → reference file
```

**Stays inline:** Migrations (Step 0), simple routing conditionals (a few lines), frontmatter and critical instructions.

**Gets extracted:** User interaction sequences, display/output formatting, handoff templates, discovery parsing, analysis logic, routing logic with significant conditional content.

### Load Directive Format

```markdown
## Step N: {Step Name}

Load **[name.md](references/name.md)** and follow its instructions as written.

→ Proceed to **Step N+1**.
```

Rules:
- No arrow (`→`) before the Load line — it's the step's content, not a routing instruction
- Bold the markdown link: `**[name.md](path)**`
- `→ Proceed to` appears after the Load directive, separated by a blank line
- The final step has no `→ Proceed to` (it's terminal)
- Within reference files routing to other reference files, use `→` before Load (it IS a routing instruction in that context)

### Reference File Structure

```markdown
# {Step Name}

*Reference for **[skill-name](../SKILL.md)***

---

{content}
```

- Header matches the step concept, not the filename
- Italic attribution line links back to the parent SKILL.md
- Horizontal rule separates header from content

### Navigation & Return Patterns

The same navigation conventions apply across all skill tiers (entry-point and processing).

**Forward navigation** — moving to the next step or phase:
```
→ Proceed to **Step N**.
→ Proceed to **B. Phase Name**.
```

**Return navigation** — returning to the parent skill or a previous phase:
```
→ Return to **[the skill](../SKILL.md)** for **Step N**.
→ Return to **[the skill](../SKILL.md)**.
→ Return to **[plan-review.md](plan-review.md)** for the next phase.
→ Return to **A. Phase Name**.
```

Rules:
- Only two routing verbs: `→ Proceed to` (forward) and `→ Return to` (backward/upward)
- No adverbs — `→ Proceed to`, never `→ Proceed directly to`
- No alternative verbs — never `→ Go to`, `→ Jump to`, `→ Skip to`, `→ Continue to`, `→ Enter`
- Use links when routing to another file (parent SKILL.md or calling reference file)
- No links for internal routing within the same file (lettered phases, named sections)
- When skipping steps, use a parenthetical: `→ Proceed to **Step 5** (skipping Steps 1–3).`
- Single-exit reference files end with `→ Return to **[the skill](../SKILL.md)**.` — the backbone's `→ Proceed to **Step N**.` handles onward sequencing
- Multi-exit reference files end each path with `→ Return to **[the skill](../SKILL.md)** for **Step N**.`
- Terminal reference files (invoke-skill.md, phase-bridge.md) invoke a processing skill as their final action — no return needed

### Internal Reference File Phases

Complex reference files with multiple sequential phases use lettered headings to avoid collision with backbone step numbers:

```markdown
## A. First Phase

...
→ Proceed to **B. Second Phase**.

## B. Second Phase

...
→ Proceed to **C. Third Phase**.
```

Simple reference files use named sections (`## Seed Idea`, `## Current Knowledge`) without letters.

### Reference File Naming

| Name | Purpose |
|------|---------|
| `gather-context.md` | User interview / context gathering questions |
| `invoke-skill.md` | Handoff to processing skill |
| `route-scenario.md` | Scenario routing (for skills with branching) |
| `validate-{thing}.md` | Pre-flight validation (plan exists, spec concluded, etc.) |
| `display-{variant}.md` | Display outputs (for skills with multiple displays) |
| `analysis-flow.md` | Multi-step analysis logic |
| `confirm-and-handoff.md` | Confirmation prompt + skill invocation combined |

Not every skill needs all of these.
