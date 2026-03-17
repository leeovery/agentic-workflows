# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Claude Code skills package for structured technical discussion and planning workflows. Installed via `npx agntc add leeovery/claude-technical-workflows`.

## Workflow Phases

1. **Research** (`workflow-research-process` skill): EXPLORE - feasibility, market, viability, early ideas
2. **Discussion** (`workflow-discussion-process` skill): Capture WHAT and WHY - decisions, architecture, edge cases, debates
3. **Investigation** (`workflow-investigation-process` skill): Bugfix-specific - symptom gathering + code analysis → root cause
4. **Specification** (`workflow-specification-process` skill): Validate and refine into standalone spec
5. **Planning** (`workflow-planning-process` skill): Define HOW - phases, tasks, acceptance criteria
6. **Implementation** (`workflow-implementation-process` skill): Execute plan via strict TDD
7. **Review** (`workflow-review-process` skill): Validate work against discussion, specification, and plan

## Skill Architecture

Skills are organised in two tiers:

**Entry-point skills** (`/start-*`, `/continue-*`, `/workflow-migrate`, etc.) are user-invocable. They gather context from files, prompts, or inline input, then invoke a processing skill. Utility entry-points (`/workflow-start`) have `disable-model-invocation: true`. `/workflow-migrate` has `user-invocable: false` — it is model-invoked only (Step 0 of every user-invocable entry-point skill).

**Phase entry skills** (`workflow-*-entry`) are internal (`user-invocable: false`). They are invoked by start/continue/bridge skills with work_type and work_unit always provided. They handle phase-specific validation, bootstrap questions for new entries, and processing skill invocation.

**Processing skills** (`workflow-*-process`) are model-invocable. They assume pipeline context — work_type is set, prior phases are complete, artifacts are in expected locations. Phase entry skills provide all required inputs before invoking them.

### Phase Entry Skill Routing

Phase entry skills (`workflow-*-entry`) receive positional arguments: `$0` = work_type, `$1` = work_unit, `$2` = topic (optional). Topic resolution: `topic = $2 || (wt !== 'epic' ? $1 : null)`.

**With topic** (feature/bugfix always; epic when caller provides it):
- Check manifest phase status → new entry (bootstrap questions) / resume / reopen
- No discovery needed — topic is already determined

**Without topic** (epic only — scoped path):
- Run discovery scoped to work_unit → analysis/selection flow → determine topic
- Only used by discussion and specification (research also, but simpler — just asks seed questions)
- Planning, implementation, review always receive a topic

## Key Conventions

**Work types and work units**: A *work type* is one of three pipeline shapes: epic, feature, or bugfix. A *work unit* is a named instance of a work type (e.g., "auth-flow" is a feature work unit, "payments-overhaul" is an epic work unit). Each work unit gets its own directory under `.workflows/` and its own `manifest.json`.

- **Epic**: Multi-topic, multi-session, phase-centric (Research → Discussion → Specification → Planning → Implementation → Review)
- **Feature**: Single-topic, single-session, linear (Discussion → Specification → Planning → Implementation → Review)
- **Bugfix**: Single-topic, investigation-centric (Investigation → Specification → Planning → Implementation → Review)

**Topics**: A *topic* is the item within a phase. For feature/bugfix, the topic name equals the work unit name (single topic moving through the pipeline). For epic, topics are distinct from the work unit name (multiple topics per phase). All work types use per-topic items in the manifest (unified structure). The discussion phase analyses all research files collectively to derive discussion topics.

Work-unit-first directory structure with uniform `{topic}` in all paths. For feature/bugfix, `{topic}` equals `{work_unit}`. For epic, `{topic}` is the item within a phase.

- Manifest: `.workflows/{work_unit}/manifest.json`
- Research: `.workflows/{work_unit}/research/`
- Discussion: `.workflows/{work_unit}/discussion/{topic}.md` (flat file)
- Investigation: `.workflows/{work_unit}/investigation/{topic}.md` (flat file)
- Specification: `.workflows/{work_unit}/specification/{topic}/specification.md`
- Planning: `.workflows/{work_unit}/planning/{topic}/planning.md` + `tasks/`
- Implementation: `.workflows/{work_unit}/implementation/{topic}/implementation.md`
- Review: `.workflows/{work_unit}/review/{topic}/report.md`
- State: `.workflows/{work_unit}/.state/` (per-work-unit analysis files)
- Global state: `.workflows/.state/` (migrations, environment-setup.md)
- Cache: `.workflows/.cache/` (planning scratch)

**Work unit lifecycle**: Each work unit has a `status` field in its manifest tracking its lifecycle state:
- `in-progress` — actively being worked on (default on creation)
- `completed` — pipeline finished (set automatically when the pipeline completes, or manually via the manage menu)
- `cancelled` — abandoned (set manually via the manage menu)

Discovery scripts filter by status — `workflow-start` and `continue-*` show active work by default, with menu options to view completed/cancelled items or manage lifecycle state. Completed/cancelled work units can be reactivated.

**Feature-to-epic pivot**: Features can be converted to epics via the manage menu (`p`/`pivot`). After pivot, the user can continue immediately as an epic or return to the previous view.

**Epic soft gates**: When navigating forward between phases in an epic (via `continue-epic`), advisory gates warn if prerequisite phase items are still in-progress. These are informational, not blocking — the user can proceed anyway. The system recovers gracefully via re-analysis if the user proceeds early.

Commit docs frequently (natural breaks, before context refresh). Skills capture context, don't implement.

## Adding New Output Formats

Use the `/create-output-format` skill to scaffold a new format adapter. Each format is a directory of 5 files:

```
skills/workflow-planning-process/references/output-formats/{format}/
├── about.md        # Benefits, setup, output location
├── authoring.md    # Task storage, flagging, cleanup
├── reading.md      # Extracting tasks, next available task
├── updating.md     # Marking complete/skipped
└── graph.md        # Task graph — priority + dependencies
```

The contract and scaffolding templates live in `.claude/skills/create-output-format/references/`.

## Output Format References (IMPORTANT)

**NEVER list output format names (linear, local-markdown, etc.) anywhere except:**
- `skills/workflow-planning-process/references/output-formats.md` - the authoritative list
- `skills/workflow-planning-process/references/output-formats/{format}/` - individual format directories
- `README.md` - user-facing documentation where format options are presented

**How other phases reference formats:**
- Plans include a `format` field in their manifest
- Consumers load only the per-concern file they need (e.g., `{format}/reading.md` for implementation)

## Migrations

The `/workflow-migrate` skill keeps workflow files in sync with the current system design. It runs via Step 0 at the start of every entry-point skill.

**How it works:**
- `skills/workflow-migrate/scripts/migrate.sh` runs all migration scripts in `skills/workflow-migrate/scripts/migrations/` in numeric order
- Each migration is idempotent - safe to run multiple times
- Progress is tracked in `.workflows/.state/migrations`
- Delete the log file to force re-running all migrations

**Adding new migrations:**
1. Create `skills/workflow-migrate/scripts/migrations/NNN-description.sh` (e.g., `002-spec-frontmatter.sh`)
2. The script will be run automatically in numeric order
3. The orchestrator handles tracking — once a migration ID appears in the log, the script never runs again
4. Use helper functions: `report_update`, `report_skip` (for display only)

**Critical: Migration scripts must not use the manifest CLI**

Migration scripts are point-in-time snapshots. The manifest CLI validates values against the current schema, which changes over time (e.g., valid statuses). A migration that uses the CLI today may break silently when validation rules change in a later release. Always read and write `manifest.json` directly using `node` (or `jq`) — never via the manifest CLI. This ensures migrations remain stable regardless of future schema changes.

## Manifest CLI

The manifest CLI at `skills/workflow-manifest/scripts/manifest.js` is the single source of truth for all workflow state. Uses dot-path syntax: `command <work-unit>[.<phase>[.<topic>]] [field] [value]`. Segment count determines access level (1 = work unit, 2 = phase, 3 = topic). See `skills/workflow-manifest/SKILL.md` for the full API.

## Display & Output Conventions (MANDATORY)

These are hard rules, not suggestions. All entry-point skills that present discovery state, menus, or interactive choices MUST follow these conventions exactly. When writing or editing skill files, read existing skills and references as working examples — they are the authoritative demonstration of these rules in practice.

### Rendering Instructions

Every **user-facing output** fenced block in skill files must be preceded by a rendering instruction. Fenced blocks that are model instructions (bash commands to execute, file paths to load) are exempt — they are not displayed to the user.

```
> *Output the next fenced block as a code block:*
```

or:

```
> *Output the next fenced block as markdown (not a code block):*
```

Code blocks are used for informational displays (overviews, status, keys) — they preserve indentation for tree structures and aligned lists. Markdown is used for interactive elements (menus, prompts) where bold formatting is needed. When content benefits from rendered formatting (headings, checkboxes, bold) and indentation control isn't needed, prefer markdown rendering even for informational displays.

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

Example: `@if(has_discussion) {topic}.md ({status:[in-progress|completed]}) @else (no discussion) @endif`

**Loop directives** for iterating over collections:

```
@foreach(item in collection)
  • {item.name} ({item.status})
@endforeach
```

Example with filter: `@foreach(inv in investigations.files where status is in-progress)`

**When to use placeholders vs concrete examples:** Placeholders work well for structural templates (tree displays, status blocks) where each field has a clear source. Selection menus should use concrete examples instead — they encode conditional logic (which verb maps to which state) that placeholders obscure.

### List Display

Two styles, chosen by whether items have sub-detail.

**Bullets (`•`)** — flat list under a shared heading. Each item is self-contained on one line with no child data.

```
Discussions not ready for specification:
These discussions are still in progress and must be completed
before they can be included in a specification.

  • auth-flow
  • data-model
```

**Tree (`└─`)** — items with child data: descriptions, statuses, sources, blocking reasons, or any detail that belongs to the parent item. Use `├─` for non-final children, `└─` for the last child. Depth is recursive — child items can have their own branches. **Blank line between each top-level item.** For numbered lists, show one full entry then `2. ...` to indicate repetition.

```
1. {topic:(titlecase)}
   └─ Plan: @if(has_plan) {plan_status:[in-progress|completed]} @else (no plan) @endif
   └─ Spec: {spec_status:[in-progress|completed]}

2. ...
```

Richer hierarchies nest naturally:

```
1. {topic:(titlecase)}
   └─ Spec: {spec_status:[in-progress|completed]} ({extraction_summary})
   └─ Discussions:
      ├─ {discussion} ({status:[extracted|pending]})
      └─ ...
```

Unnumbered trees follow the same structure:

```
Plans not ready for implementation:
These plans have unresolved dependencies that must be
addressed first.

  Core Features
  └─ Blocked by data-model:data-model-1-2

  Advanced Features
  ├─ Blocked by core-features:core-2-3
  └─ Blocked by auth
```

### Status Terms

Always parenthetical `(term)`. Never brackets or dash-separated.

Core vocabulary: `in-progress`, `completed`, `ready`, `extracted`, `pending`, `reopened`. Phase-specific terms are fine but format is always `(term)`.

### Cross-Plan References

Use colon notation to reference a task within a plan: `{plan}:{internal_id}`.

```
  · advanced-features (blocked by core-features:core-2-3)
```

Reads as: "advanced-features is blocked by task core-2-3 in the core-features plan."

### Key / Legend

Separate code block. Categorized. Em dash (`—`) separators. **No `---` separator before the Key block.** Only show statuses that appear in the current display. **Blank line between categories.**

```
Key:

  Plan status:
    in-progress — planning work is ongoing
    completed   — plan is done

  Spec type:
    cross-cutting — architectural policy, not directly plannable
    feature       — plannable feature specification
```

### Menus / Interactive Prompts

Rendered as markdown (not code blocks). Framed with `· · · · · · · · · · · ·` dot separators at top and bottom — no blank lines between the dots and the content they frame. A question or contextual label appears first inside the dots, followed by a blank line, then the options. Verb-based labels for selection menus. No single-character icons.

**Option types** — menus contain two kinds of option:

- **Command option** (explicit): A discrete input the user types verbatim. Formatted with backtick-wrapped shorthand: **`y`/`yes`**, **`s`/`single`**, **`a`/`auto`**. The shorthand is the first letter of the word; if two options in the same menu share a first letter, use the second letter for the conflicting option (e.g., **`a`/`approve`** and **`b`/`abort`**). The conditional branch uses the command value (e.g., `#### If \`yes\``).
- **Prompt option** (implicit): The user responds naturally rather than issuing a command. Formatted with plain bold text (no backticks): **Keep going**, **Comment**, **Ask**. The conditional branch uses the label in lowercase (e.g., `#### If keep going`). Limit to one prompt option per menu to avoid ambiguity — since routing is intent-based, multiple prompt options would be hard to distinguish.

Both types use `— description` to explain what the option does (unless self-evident, as with yes/no).

**Mixed prompt** — command and prompt options together:

```
· · · · · · · · · · · ·
Investigation complete. Ready to conclude?

- **`y`/`yes`** — Conclude investigation
- **Keep going** — Continue discussing to explore further
· · · · · · · · · · · ·
```

**Selection menu** — use concrete examples showing verb-to-state mapping:

```
· · · · · · · · · · · ·
1. Create "Auth Flow" — completed spec, no plan
2. Continue "Data Model" — plan in-progress
3. Review "Billing" — plan completed

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

The planning phase requires a completed specification.
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

## Structural Conventions (MANDATORY)

These are hard rules, not suggestions. All skill files (entry-point and processing) MUST follow these conventions exactly. When writing or editing skill files, read existing skills and references as working examples — they are the authoritative demonstration of these rules in practice.

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

- **Step 0** runs migrations via the `/workflow-migrate` skill (mandatory in all entry-point skills)
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
- Lowercase after "If" (e.g., `#### If completed_count == 1`)
- Use `#### Otherwise` for else branches
- Use backticks around specific values, variables, and statuses in H4 headings (e.g., `` #### If `STATUS` is `clean` ``, `` #### If work type is `feature` ``). Natural language conditions stay plain text (e.g., `#### If no plan provided`)
- Use "and" between conditions, not commas
- Drop implied conditions (e.g., if Step 2 already gates on `completed_count >= 1`, Step 3 doesn't need to repeat it on every branch)
- H4 for top-level conditionals, bold text for nested — never use H5/H6 for conditional nesting
- If double-nesting would occur, flatten by combining the parent and child conditions into a single bold conditional
- Every conditional branch must include its own routing instruction (`→ Proceed to` or `→ Return to`). Never place routing outside a conditional expecting it to apply to all branches — each branch is self-contained. Even if multiple branches route to the same destination, each states it explicitly.

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

## Skill File Structure (MANDATORY)

These are hard rules, not suggestions. All skills (entry-point and processing) use a backbone + reference file pattern. The backbone (SKILL.md) is always loaded and reads like a table of contents. Reference files contain step detail, loaded on demand via Load directives. When writing or editing skill files, read existing skills and references as working examples — they are the authoritative demonstration of these rules in practice.

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

Skill files form a call stack. The backbone (SKILL.md) loads reference files via Load directives. Reference files may load other reference files. Two verbs control all movement through this stack:

- `→ Proceed to` — forward movement (next step, next section)
- `→ Return to` — backward/upward movement (back to caller, back to earlier section, up to backbone)

No other verbs — never `→ Go to`, `→ Jump to`, `→ Skip to`, `→ Continue to`, `→ Enter`. No adverbs — `→ Proceed to`, never `→ Proceed directly to`.

#### Forward (within a file)

| Instruction | Context |
|---|---|
| `→ Proceed to **Step N**.` | Next step in the backbone |
| `→ Proceed to **B. Section Name**.` | Next lettered section in a reference file |

When skipping steps, add a parenthetical: `→ Proceed to **Step 5** (skipping Steps 1–3).`

#### Backward (within a file)

| Instruction | Context |
|---|---|
| `→ Return to **A. Section Name**.` | Earlier lettered section in the same reference file |

Internal routing (both forward and backward) uses bold text, never links.

#### Exiting a reference file

This is the critical decision. Use this flowchart:

```
How should this reference file exit?
│
├─ Is the final action invoking a processing skill?
│  └─ YES → Terminal. No routing instruction needed.
│
├─ Are you going back to whoever loaded this file?
│  │
│  ├─ Just returning (caller's next line takes over)?
│  │  └─ → Return to caller.
│  │
│  └─ Returning to a specific section in the caller?
│     └─ → Return to caller for **B. Section Name**.
│
└─ Are you routing to the backbone (not your caller)?
   │
   ├─ To the backbone generally?
   │  └─ → Return to **[the skill](../SKILL.md)**.
   │
   └─ To a specific backbone step?
      └─ → Return to **[the skill](../SKILL.md)** for **Step N**.
```

**`→ Return to caller.`** is the default exit. It works identically whether the caller is the backbone or another reference file — you never need to check who loaded you. The caller's next routing instruction handles onward sequencing.

**Backbone escape** (`→ Return to **[the skill](../SKILL.md)**`) is for two scenarios:
1. **Short-circuiting the call stack** — a reference file loaded by another reference file needs to skip past its caller and land on the backbone directly. Like an exception bubbling up past intermediate frames.
2. **Directing to a specific backbone step** — different conditional paths within a file need to route to different backbone steps (e.g., one path → Step 4, another → Step 5). The caller's single `→ Proceed to` line can only go one place, so the file overrides it. This applies regardless of whether the caller is the backbone or another reference file.

#### Exit pattern summary

| File type | Exit pattern |
|---|---|
| Single-exit reference file | `→ Return to caller.` |
| Multi-exit, all paths resume at caller | Each path ends with `→ Return to caller.` |
| Multi-exit, paths need different backbone steps | Each path ends with `→ Return to **[the skill](../SKILL.md)** for **Step N**.` |
| Terminal (invokes processing skill) | No routing instruction |

#### Formatting rules

- Bold the target: `**Step N**`, `**B. Section Name**`, `**[the skill](../SKILL.md)**`
- Links only for backbone escapes (`**[the skill](../SKILL.md)**`). All other routing is linkless — `→ Return to caller.` has no link, internal routing has no link.
- Every conditional branch must include its own routing instruction. Never place routing outside a conditional expecting it to apply to all branches — each branch is self-contained. Even if multiple branches route to the same destination, each states it explicitly.

### Internal Reference File Sections

Complex reference files use lettered headings to organise sequential sections, avoiding collision with backbone step numbers:

```markdown
## A. First Section

...
→ Proceed to **B. Second Section**.

## B. Second Section

...
→ Proceed to **C. Third Section**.
```

Simple reference files use named sections (`## Seed Idea`, `## Current Knowledge`) without letters.

### Reference File Naming

| Name | Purpose |
|------|---------|
| `gather-context.md` | User interview / context gathering questions |
| `invoke-skill.md` | Handoff to processing skill |
| `route-scenario.md` | Scenario routing (for skills with branching) |
| `validate-{thing}.md` | Pre-flight validation (plan exists, spec completed, etc.) |
| `display-{variant}.md` | Display outputs (for skills with multiple displays) |
| `analysis-flow.md` | Multi-step analysis logic |
| `confirm-and-handoff.md` | Confirmation prompt + skill invocation combined |

Not every skill needs all of these.
