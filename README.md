<h1 align="center">Claude Technical Workflows</h1>

<p align="center">
  <strong>From Idea to Implementation: Agentic Engineering Workflows for Claude Code</strong>
</p>

<p align="center">
  <a href="#what-is-this">What is this?</a> •
  <a href="#how-do-i-use-it">How to Use</a> •
  <a href="#installation">Installation</a> •
  <a href="#skills">Skills</a> •
  <a href="#contributing">Contributing</a>
</p>

---

<p align="center">
  <a href="https://leeovery.github.io/claude-technical-workflows/"><strong>Open the Interactive Workflow Explorer</strong></a>
</p>

> **Workflow Explorer** — A visual, interactive guide to every phase and skill in this toolkit. Trace decision logic through flowcharts and understand the full pipeline at a glance. No install required — runs in your browser.

---

## What is this?

A complete development workflow for Claude Code: explore ideas, capture decisions, build actionable plans, implement via strict TDD, and validate the result.

A **six-phase workflow** where each phase feeds the next:

```
Research → Discussion → Specification → Planning → Implementation → Review
```

**Why this matters:** Complex features benefit from thorough discussion before implementation. This toolkit documents the *what* and *why* before diving into the *how*, preserving architectural decisions, edge cases, and the reasoning behind choices that would otherwise be lost.

**Flexible entry points:** Start at Research for early exploration, or jump to Discussion when you know what you're building. `/start-feature` gathers context and pipelines through every phase automatically. Entry-point skills gather context and feed it to processing skills.

**Engineered like software.** This isn't a collection of prompts — it's built with the same discipline you'd apply to code. Entry-point skills gather context, phase entry skills validate and route, processing skills do the work. Output formats implement a [5-file adapter contract](#output-formats), so planning works identically regardless of where tasks end up. Agents handle isolated concerns. The result is a natural language workflow that's modular, extensible, and maintainable — software engineering principles applied to agentic workflows.

> [!NOTE]
> **Work in progress.** The workflow is being refined through real-world usage. Expect updates as patterns evolve.

### Quick Install

```bash
npx agntc add leeovery/claude-technical-workflows
```

See [Installation](#installation) for details.

## How do I use it?

### Where to Start

Run `/workflow-start`. It shows all active work, lets you continue where you left off, or start something new. When in doubt, this is your entry point — it routes you to the right place.

If you prefer to jump straight in:

- `/start-feature` — single feature through the full pipeline
- `/start-epic` — multi-topic work spanning multiple sessions
- `/start-bugfix` — fix broken behavior with investigation-first pipeline

### The Workflow

```
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Research    │──▶│  Discussion   │──▶│ Specification │
│   (Phase 1)   │   │   (Phase 2)   │   │   (Phase 3)   │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ EXPLORING     │   │ WHAT & WHY    │   │ REFINING      │
│               │   │               │   │               │
│ • Ideas       │   │ • Architecture│   │ • Validate    │
│ • Market      │   │ • Decisions   │   │ • Filter      │
│ • Viability   │   │ • Edge cases  │   │ • Enrich      │
│               │   │ • Rationale   │   │ • Standalone  │
└───────────────┘   └───────────────┘   └───────────────┘
                                                │
                                                ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Review     │◀──│Implementation │◀──│   Planning    │
│   (Phase 6)   │   │   (Phase 5)   │   │   (Phase 4)   │
├───────────────┤   ├───────────────┤   ├───────────────┤
│ VALIDATING    │   │ DOING         │   │ HOW           │
│               │   │               │   │               │
│ • Plan check  │   │ • Tests first │   │ • Phases      │
│ • Specs check │   │ • Then code   │   │ • Tasks       │
│ • Test quality│   │ • Commit often│   │ • Criteria    │
│ • Code quality│   │ • Task gates  │   │ • Outputs     │
└───────────────┘   └───────────────┘   └───────────────┘
```

Each phase produces documents that feed the next. Here's the journey:

**Research** — Free-form exploration. Investigate ideas, market fit, technical feasibility, business viability. The output is a research document capturing everything you've explored. The key benefit: when you move to discussion, the skill analyses this document and breaks it into focused topics automatically.

**Discussion** — Per-topic deep dives into architecture, edge cases, competing approaches, and rationale. Each topic gets its own document. This captures not just decisions, but *why* you made them — the alternatives considered, the trade-offs weighed, the journey to the decision. Conclude each topic when its decisions are made.

**Specification** — This is where the magic happens. The skill analyses *all* your discussions and creates intelligent groupings — 10 discussions might become 3–5 specifications, or you can unify everything into one. It filters hallucinations, enriches gaps, and validates decisions against each other. The spec becomes the golden document: planning only references this, not earlier phases.

**Planning** — Converts each specification into phased implementation plans with tasks, acceptance criteria, and dependency ordering. Supports [multiple output formats](#output-formats) — from local markdown files to CLI tools with native dependency graphs. Task authoring has per-item approval gates (with auto-mode for faster flow).

**Implementation** — Executes plans via strict TDD. Tests first, then code, commit after each task. Per-task approval gates keep you in control, with auto-mode available when you trust the flow.

**Review** — Validates the implementation against spec and plan. Catches drift, missing requirements, and quality issues. Findings can be synthesized into remediation tasks that feed back into implementation, closing the review-implementation loop.

### How It Fits Together

```
                         ┌─────────────────────────────┐
  User                   │       /workflow-start        │
  Entry ────────────────▶│  Dashboard — shows all work  │
                         └──────────┬──────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌──────────────┐ ┌────────────┐ ┌─────────────┐
            │/start-feature│ │/start-epic │ │/start-bugfix│
            │/cont-feature │ │/cont-epic  │ │/cont-bugfix │
            └──────┬───────┘ └─────┬──────┘ └──────┬──────┘
                   │               │               │
                   ▼               ▼               ▼
            ┌─────────────────────────────────────────────┐
            │         Phase Entry Skills (internal)       │
            │  workflow-*-entry — validate + bootstrap     │
            └──────────────────┬──────────────────────────┘
                               │
                               ▼
            ┌─────────────────────────────────────────────┐
            │          Processing Skills (do work)        │
            │                                             │
            │  research → discussion → specification      │
            │          → planning → implementation        │
            │                    → review                 │
            └──────────────────┬──────────────────────────┘
                               │
                               ▼
            ┌─────────────────────────────────────────────┐
            │         workflow-bridge (automatic)          │
            │  Clears context, advances to next phase     │
            └─────────────────────────────────────────────┘
```

**`/workflow-start`** is the main entry point. It discovers all active work, shows a dashboard, and routes to the right skill — whether that's starting something new or continuing where you left off. When in doubt, start here.

**Start skills** (`/start-feature`, `/start-epic`, `/start-bugfix`) create new work units and gather initial context. **Continue skills** (`/continue-feature`, `/continue-epic`, `/continue-bugfix`) resume in-progress work with phase routing and backwards navigation.

**Phase entry skills** (`workflow-*-entry`) are internal — invoked automatically to validate pipeline state and bootstrap each phase. You never call them directly.

**Processing skills** (`workflow-*-process`) do the actual work for each phase. They assume pipeline context — prior phases are complete, artifacts are in expected locations.

**Workflow bridge** connects phases automatically. After each phase completes, it clears context and advances to the next phase. You approve each transition with "clear context and continue" — this keeps each phase in a clean context window.

### Work Unit Lifecycle

Work units move through a simple lifecycle: **in-progress** → **completed** or **cancelled**.

- **Completed** is set automatically when the pipeline finishes (review phase ends), or manually via the manage menu in `/workflow-start`
- **Cancelled** is set manually for abandoned work
- Completed and cancelled work units can be **reactivated** back to in-progress

Feature and bugfix pipelines offer an early completion option after implementation (skip review). Epic work units are completed when all topics have finished review.

**Feature-to-epic pivot:** If a feature grows beyond its original scope, convert it to an epic via the manage menu. All existing progress is preserved. After pivoting, continue immediately as an epic to add new topics.

### Output Formats

Planning supports multiple output formats through an adapter pattern. Each format implements a 5-file contract — about, authoring, reading, updating, and graph — so the planning workflow works identically regardless of where tasks are stored.

| Format | Best for | Setup | |
|--------|----------|-------|-|
| **Tick** | AI-driven workflows, native dependencies, token-efficient | `brew install leeovery/tools/tick` | Recommended |
| **Local Markdown** | Simple features, offline, quick iterations | None | |
| **Linear** | Team collaboration, visual tracking | Linear account + MCP server | |

Choose a format when planning begins. New formats can be scaffolded with `/create-output-format`.

## Installation

```bash
npx agntc add leeovery/claude-technical-workflows
```

Skills are copied to `.claude/` in your project and can be committed, giving you ownership and making them available everywhere including Claude Code for Web.

<details>
<summary>Removal</summary>

```bash
npx agntc remove leeovery/claude-technical-workflows
```
</details>

## Project Structure

### Output Files

Documents are stored in your project using a **work-unit-first** organisation. Each work unit (epic, feature, or bugfix) gets its own directory with phase subdirectories. A `manifest.json` in each work unit is the single source of truth for all workflow state — including the work unit's lifecycle status (`in-progress`, `completed`, `cancelled`) and per-phase progress.

```
.workflows/
  {work_unit}/                           # One directory per work unit
    manifest.json                        #   Single source of truth for state
    .state/                              #   Per-work-unit analysis files
      research-analysis.md
    research/                            #   Flat, semantically named files
      exploration.md
    discussion/                          #   {topic}.md flat files
      {topic}.md
    investigation/                       #   {topic}.md flat files (bugfix)
      {topic}.md
    specification/
      {topic}/
        specification.md                 #   Spec + review tracking files
    planning/
      {topic}/
        planning.md                      #   Plan index (phases, metadata)
        tasks/                           #   Task files (local-markdown format)
          {topic}-1-1.md
    implementation/
      {topic}/
        implementation.md                #   Progress, gates, current task
    review/
      {topic}/
        report.md                        #   Review summary and verdict
        report-{phase_id}-{task_id}.md   #   Per-task verification report
  .state/                                # Global state (migrations, env setup)
  .cache/                                # Ephemeral (planning scratch)
```

For feature/bugfix, `{topic}` equals `{work_unit}`. For epic, `{topic}` is the item within a phase (e.g., `payment-processing` within the `payments-overhaul` epic).

Each work unit starts with just a manifest. Phase directories are created as you enter each phase. Planning task storage varies by [output format](#output-formats) -- the tree above shows local-markdown; Tick and Linear store tasks externally.

### Package Structure

```
skills/
├── # Processing skills (model-invocable)
├── workflow-research-process/              # Explore and validate ideas
├── workflow-discussion-process/            # Document discussions
├── workflow-investigation-process/         # Investigate bugs (bugfix pipeline)
├── workflow-specification-process/         # Build validated specifications
├── workflow-planning-process/              # Create implementation plans
├── workflow-implementation-process/        # Execute via TDD
├── workflow-review-process/                # Validate against artefacts
│
├── # Unified entry points
├── workflow-start/                  # Discovers state, routes by work type + lifecycle management
├── workflow-bridge/                 # Pipeline continuation — next phase routing
├── workflow-shared/                 # Shared discovery utilities
├── workflow-manifest/               # Manifest CLI — single source of truth for state
│
├── # Entry-point skills (user-invocable)
├── migrate/                         # Keep workflow files in sync with system design
├── start-epic/                      # Pipeline: multi-topic, multi-session workflow
├── start-feature/                   # Pipeline: discussion → spec → plan → impl → review
├── start-bugfix/                    # Pipeline: investigation → spec → plan → impl → review
├── link-dependencies/               # Wire cross-topic dependencies
├── status/                          # Show workflow status
├── view-plan/                       # View plan tasks
│
├── # Phase entry skills (internal — invoked by start/continue/bridge)
├── workflow-research-entry/         # Research phase bootstrap + invoke
├── workflow-discussion-entry/       # Discussion phase — scoped epic path or bridge
├── workflow-investigation-entry/    # Investigation phase bootstrap + invoke
├── workflow-specification-entry/    # Specification phase — scoped epic path or bridge
├── workflow-planning-entry/         # Planning phase — validate spec + invoke
├── workflow-implementation-entry/   # Implementation phase — validate plan + invoke
└── workflow-review-entry/           # Review phase — validate impl + invoke

agents/
├── review-task-verifier.md           # Verifies single task implementation for review
├── review-findings-synthesizer.md   # Synthesizes review findings into remediation tasks
├── implementation-task-executor.md  # TDD executor for single plan tasks
├── implementation-task-reviewer.md  # Post-task review for spec conformance
├── planning-phase-designer.md       # Design phases from specification
├── planning-task-designer.md        # Break phases into task lists
├── planning-task-author.md          # Write full task detail
├── planning-dependency-grapher.md   # Analyze task dependencies and priorities
├── planning-review-traceability.md  # Spec-to-plan traceability analysis
└── planning-review-integrity.md     # Plan structural quality review

tests/
└── scripts/                         # Tests for discovery scripts and migrations
```

## Skills

### Processing Skills

Processing skills assume pipeline context — work_type is set, prior phases are complete, artifacts are in expected locations. Phase entry skills validate and provide all required inputs before invoking them.

| Skill                                                            | Description                                                                                                                                                                                                  |
|------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [**workflow-research-process**](skills/workflow-research-process/)             | Explore ideas from their earliest seed. Investigate market fit, technical feasibility, business viability. Free-flowing exploration across technical, business, and market domains.                          |
| [**workflow-discussion-process**](skills/workflow-discussion-process/)         | Document technical discussions as expert architect and meeting assistant. Captures context, decisions, edge cases, competing solutions, debates, and rationale.                                              |
| [**workflow-investigation-process**](skills/workflow-investigation-process/)   | Investigate bugs through symptom gathering and code analysis. Combines context collection with root cause identification for the bugfix pipeline.                                                            |
| [**workflow-specification-process**](skills/workflow-specification-process/)   | Build validated specifications from source material through collaborative refinement. Filters hallucinations, enriches gaps, produces standalone spec.                                                       |
| [**workflow-planning-process**](skills/workflow-planning-process/)             | Transform specifications into actionable implementation plans with phases, tasks, and acceptance criteria. Supports multiple output formats.                                                                 |
| [**workflow-implementation-process**](skills/workflow-implementation-process/) | Execute implementation plans using strict TDD workflow. Writes tests first, implements to pass, commits frequently, and gates phases on user approval.                                                       |
| [**workflow-review-process**](skills/workflow-review-process/)                 | Review completed implementation against specification requirements and plan acceptance criteria. Uses parallel subagents for efficient chain verification. Produces structured feedback without fixing code. |

### Entry-Point Skills

Entry-point skills are the input layer: they gather context and pass it to processing skills.

#### Phase Entry Skills (Internal)

Phase entry skills are invoked automatically by start/continue/bridge skills. They handle phase-specific validation, bootstrap questions, and processing skill invocation.

| Skill | Description |
|-------|-------------|
| **workflow-research-entry** | Research phase bootstrap — seed questions + invoke processing skill |
| **workflow-discussion-entry** | Discussion phase — scoped epic analysis or bridge mode context gathering |
| **workflow-investigation-entry** | Investigation phase — bug context gathering + invoke processing skill |
| **workflow-specification-entry** | Specification phase — scoped epic analysis flow or bridge mode validation |
| **workflow-planning-entry** | Planning phase — validate spec, cross-cutting context + invoke |
| **workflow-implementation-entry** | Implementation phase — validate plan, check deps/env + invoke |
| **workflow-review-entry** | Review phase — validate impl, determine version + invoke |

#### Utility Skills

Helpers for navigating and maintaining the workflow.

| Skill                                                                        | Description                                                                                                                                 |
|------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| [**/migrate**](skills/migrate/)                                              | Keep workflow files in sync with the current system design. Runs automatically at the start of every workflow skill.                        |
| [**/status**](skills/status/)                                                | Show workflow status with relationship-aware display — specification sources, unlinked discussions, plan dependencies, and suggested next steps. |
| [**/view-plan**](skills/view-plan/)                                          | View a plan's tasks and progress, regardless of output format.                                                                              |

#### Start Skills

Create new work units and pipeline through every phase automatically.

| Skill                                                   | Description                                                                                                                                 |
|---------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| [**/start-feature**](skills/start-feature/)              | Start a new feature through the full pipeline. Gathers context, creates a discussion, then bridges through specification → planning → implementation → review. |
| [**/start-epic**](skills/start-epic/)                    | Start an epic — multi-topic, multi-session workflow. Gathers context, routes to research or discussion, then progresses phase by phase. |
| [**/start-bugfix**](skills/start-bugfix/)                | Start a bugfix through the pipeline. Gathers bug context, creates an investigation, then bridges through specification → planning → implementation → review. |

#### Continue Skills

Resume in-progress work with phase routing, backwards navigation, and lifecycle management.

| Skill                                                   | Description                                                                                                                                 |
|---------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| [**/workflow-start**](skills/workflow-start/)             | Unified dashboard — shows all active work, routes to start or continue skills, manages lifecycle (view completed/cancelled, mark done). |
| [**/continue-feature**](skills/continue-feature/)        | Resume an in-progress feature. Shows current phase state, routes to the next phase, and offers backwards navigation to revisit earlier phases. |
| [**/continue-epic**](skills/continue-epic/)              | Resume an in-progress epic. Full state display across all phases, interactive menu, and advisory soft gates for phase-forward navigation. |
| [**/continue-bugfix**](skills/continue-bugfix/)          | Resume an in-progress bugfix. Shows current phase state, routes to the next phase, and offers backwards navigation. |
| [**/link-dependencies**](skills/link-dependencies/)      | Link external dependencies across topics. Scans plans and wires up unresolved cross-topic dependencies.                                    |

## Agents

Subagents that skills can spawn for parallel task execution.

| Agent | Used By | Description |
|-------|---------|-------------|
| [**review-task-verifier**](agents/review-task-verifier.md) | workflow-review-process | Verifies a single plan task was implemented correctly. Checks implementation, tests, and code quality. Multiple run in parallel. |
| [**implementation-task-executor**](agents/implementation-task-executor.md) | workflow-implementation-process | Implements a single plan task via strict TDD. |
| [**implementation-task-reviewer**](agents/implementation-task-reviewer.md) | workflow-implementation-process | Reviews a completed task for spec conformance, acceptance criteria, and architectural quality. |
| [**planning-phase-designer**](agents/planning-phase-designer.md) | workflow-planning-process | Designs implementation phases from a specification. |
| [**planning-task-designer**](agents/planning-task-designer.md) | workflow-planning-process | Breaks a single phase into a task list with edge cases. |
| [**planning-task-author**](agents/planning-task-author.md) | workflow-planning-process | Writes full detail for a single plan task. |
| [**planning-dependency-grapher**](agents/planning-dependency-grapher.md) | workflow-planning-process | Analyzes authored tasks to establish internal dependencies and priorities. |
| [**planning-review-traceability**](agents/planning-review-traceability.md) | workflow-planning-process | Spec-to-plan traceability analysis. |
| [**planning-review-integrity**](agents/planning-review-integrity.md) | workflow-planning-process | Plan structural quality review. |
| [**specification-review-input**](agents/specification-review-input.md) | workflow-specification-process | Reviews specification against source material for completeness and accuracy. |
| [**specification-review-gap-analysis**](agents/specification-review-gap-analysis.md) | workflow-specification-process | Analyses specification as a standalone document for gaps, ambiguity, and missing detail. |
| [**implementation-analysis-architecture**](agents/implementation-analysis-architecture.md) | workflow-implementation-process | Architecture conformance analysis of completed implementation. |
| [**implementation-analysis-duplication**](agents/implementation-analysis-duplication.md) | workflow-implementation-process | Duplication and DRY analysis of completed implementation. |
| [**implementation-analysis-standards**](agents/implementation-analysis-standards.md) | workflow-implementation-process | Coding standards analysis of completed implementation. |
| [**implementation-analysis-synthesizer**](agents/implementation-analysis-synthesizer.md) | workflow-implementation-process | Synthesizes analysis findings from architecture, duplication, and standards agents. |
| [**implementation-analysis-task-writer**](agents/implementation-analysis-task-writer.md) | workflow-implementation-process | Writes remediation tasks from synthesized analysis findings into the plan. |
| [**review-findings-synthesizer**](agents/review-findings-synthesizer.md) | workflow-review-process | Synthesizes review findings into normalized remediation tasks for plan integration. |

## Requirements

- Node.js 18+

## Contributing

Contributions are welcome! Whether it's:

- **Bug fixes** in the documentation or skill definitions
- **Improvements** to the workflow or templates
- **Discussion** about approaches and trade-offs
- **New skills** that complement the discuss-specify-plan-implement workflow

Please open an issue first to discuss significant changes.

## Related Packages

- [**Agntc**](https://github.com/leeovery/agntc) - The CLI that powers skill, agent, and hook installation
- [**@leeovery/claude-laravel**](https://github.com/leeovery/claude-laravel) - Laravel development skills for Claude Code
- [**@leeovery/claude-nuxt**](https://github.com/leeovery/claude-nuxt) - Nuxt.js development skills for Claude Code

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with care by <a href="https://github.com/leeovery">Lee Overy</a></sub>
</p>
