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

Use it as a **six-phase workflow** or pick individual capabilities as needed:

```
Research → Discussion → Specification → Planning → Implementation → Review
```

**Why this matters:** Complex features benefit from thorough discussion before implementation. This toolkit documents the *what* and *why* before diving into the *how*, preserving architectural decisions, edge cases, and the reasoning behind choices that would otherwise be lost.

**Flexible entry points:** Need the full workflow? Start at Research or Discussion and progress through each phase. Already know what you're building? Jump straight to Specification with `/start-feature`. Entry-point skills gather context and feed it to processing skills.

**Engineered like software.** This isn't a collection of prompts — it's built with the same discipline you'd apply to code. Processing skills follow the single responsibility principle. Entry-point skills compose with them, keeping input gathering DRY. Output formats implement a [5-file adapter contract](#output-formats), so planning works identically regardless of where tasks end up. Agents handle isolated concerns. The result is a natural language workflow that's modular, extensible, and maintainable — software engineering principles applied to agentic workflows.

> [!NOTE]
> **Work in progress.** The workflow is being refined through real-world usage. Expect updates as patterns evolve.

### Quick Install

```bash
npx agntc add leeovery/claude-technical-workflows
```

See [Installation](#installation) for details.

## How do I use it?

### Where to Start

Pick your entry point based on where you are:

- **Seeds of an idea?** → Start with `/start-feature` or `/start-epic` and choose research *(recommended)*
  You have a rough idea but haven't explored feasibility, alternatives, or scope yet. Research lets you think freely before committing to anything.

- **Know what you're building?** → Use `/start-feature` or `/start-epic` and choose discussion
  You've moved past exploration and want to capture architecture decisions, edge cases, and rationale for specific topics.

- **Clear feature, ready to build?** → Use `/start-feature`
  You know what you're building. Start-feature gathers context, creates a discussion, then pipelines through specification → planning → implementation automatically via plan mode bridges.

**Why research is the recommended default:** When you move from research to discussion, the discussion skill analyses your research document and automatically breaks it into focused discussion topics. Skip research and you manage topic structure yourself.

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

### Standalone Skills

Not every task needs the full workflow. These skills gather inputs flexibly and invoke processing skills directly:

| Skill | What it does |
|-------|-------------|
| `/start-feature` | Start a feature through the full pipeline: discussion → spec → plan → impl → review |
| `/start-bugfix` | Start a bugfix through the pipeline: investigation → spec → plan → impl → review |
| `/link-dependencies` | Wire cross-topic dependencies across plans |

### Feature Pipeline

`/start-feature` chains the full workflow into an automated pipeline:

```
/start-feature
    │
    ▼
Discussion ──▶ Specification ──▶ Planning ──▶ Implementation ──▶ Review
```

**How it works:** After each phase completes, a plan mode bridge clears context and advances to the next phase automatically. You approve each transition with "clear context and continue" — this keeps each phase in a clean context window.

If a session is interrupted, run `/workflow-start` to pick up where you left off. It discovers artifact state and routes to the next phase.

### Under the Hood

Skills are organised in two tiers. **Entry-point skills** (`/start-*`, `/continue-*`, `/status`, etc.) gather context from files, prompts, or inline input. **Processing skills** (`technical-*`) receive those inputs and do the work — they don't know or care where inputs came from. **Phase entry skills** (`workflow-*-entry`) are the internal glue — invoked by entry-point skills to handle phase-specific validation and processing skill invocation. You can create custom entry-point skills that feed processing skills in new ways.

### Compaction Recovery

Long-running skills can hit context compaction, where Claude's conversation is summarized and procedural detail is lost. The hook system provides automatic recovery:

- **Project-level hooks** installed in `.claude/settings.json` persist through compaction events
- On compaction, the recovery hook reads session state from disk and injects authoritative context — the skill to re-read, the artifact to resume, and pipeline instructions
- On first run, a bootstrap hook detects missing configuration and installs it automatically (requires one Claude restart)

Session state is ephemeral (gitignored, cleaned up on session end) and per-session — multiple concurrent sessions don't interfere.

### Workflow Navigation

| Action | Skill |
|--------|-------|
| Start a new feature | `/start-feature` |
| Start a new epic | `/start-epic` |
| Start a new bugfix | `/start-bugfix` |
| Resume work | `/workflow-start` or `/continue-feature` / `/continue-epic` / `/continue-bugfix` |

Phase entry skills (`workflow-*-entry`) are internal — they're invoked automatically by the start, continue, and bridge skills. You don't need to call them directly.

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

Documents are stored in your project using a **work-unit-first** organisation. Each work unit (epic, feature, or bugfix) gets its own directory with phase subdirectories. A `manifest.json` in each work unit is the single source of truth for all workflow state.

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
        r1/
          review.md                      #   Review summary and verdict
          qa-task-1.md                   #   Per-task QA verification
  .state/                                # Global state (migrations, env setup)
  .cache/                                # Ephemeral (sessions, planning scratch)
```

For feature/bugfix, `{topic}` equals `{work_unit}`. For epic, `{topic}` is the item within a phase (e.g., `payment-processing` within the `payments-overhaul` epic).

Each work unit starts with just a manifest. Phase directories are created as you enter each phase. Planning task storage varies by [output format](#output-formats) -- the tree above shows local-markdown; Tick and Linear store tasks externally.

### Package Structure

```
skills/
├── # Processing skills (model-invocable)
├── technical-research/              # Explore and validate ideas
├── technical-discussion/            # Document discussions
├── technical-investigation/         # Investigate bugs (bugfix pipeline)
├── technical-specification/         # Build validated specifications
├── technical-planning/              # Create implementation plans
├── technical-implementation/        # Execute via TDD
├── technical-review/                # Validate against artefacts
│
├── # Unified entry points
├── workflow-start/                  # Discovers state, routes by work type
├── workflow-bridge/                 # Pipeline continuation — next phase routing
├── workflow-shared/                 # Shared discovery utilities
├── workflow-manifest/               # Manifest CLI — single source of truth for state
│
├── # Entry-point skills (user-invocable)
├── migrate/                         # Keep workflow files in sync with system design
├── start-epic/                      # Pipeline: multi-topic, multi-session workflow
├── start-feature/                   # Pipeline: discussion → spec → plan → impl → review
├── start-bugfix/                    # Pipeline: investigation → spec → plan → impl → review
├── link-dependencies/               # Standalone: wire cross-topic deps
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

Processing skills are **input-agnostic**: they receive inputs and process them without knowing where the inputs came from. This makes them reusable across different entry points and workflows.

| Skill                                                            | Description                                                                                                                                                                                                  |
|------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| [**technical-research**](skills/technical-research/)             | Explore ideas from their earliest seed. Investigate market fit, technical feasibility, business viability. Free-flowing exploration across technical, business, and market domains.                          |
| [**technical-discussion**](skills/technical-discussion/)         | Document technical discussions as expert architect and meeting assistant. Captures context, decisions, edge cases, competing solutions, debates, and rationale.                                              |
| [**technical-investigation**](skills/technical-investigation/)   | Investigate bugs through symptom gathering and code analysis. Combines context collection with root cause identification for the bugfix pipeline.                                                            |
| [**technical-specification**](skills/technical-specification/)   | Build validated specifications from source material through collaborative refinement. Filters hallucinations, enriches gaps, produces standalone spec.                                                       |
| [**technical-planning**](skills/technical-planning/)             | Transform specifications into actionable implementation plans with phases, tasks, and acceptance criteria. Supports multiple output formats.                                                                 |
| [**technical-implementation**](skills/technical-implementation/) | Execute implementation plans using strict TDD workflow. Writes tests first, implements to pass, commits frequently, and gates phases on user approval.                                                       |
| [**technical-review**](skills/technical-review/)                 | Review completed implementation against specification requirements and plan acceptance criteria. Uses parallel subagents for efficient chain verification. Produces structured feedback without fixing code. |

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

#### Standalone Skills

Independent skills that gather inputs flexibly (inline context, files, or prompts) and invoke processing skills directly. Use these when you want capabilities without the full workflow structure.

| Skill                                                   | Description                                                                                                                                 |
|---------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| [**/start-epic**](skills/start-epic/)                    | Start an epic — multi-topic, multi-session workflow. Gathers context, routes to research or discussion, then progresses phase by phase. |
| [**/start-feature**](skills/start-feature/)              | Start a new feature through the full pipeline. Gathers context, creates a discussion, then bridges through specification → planning → implementation → review. |
| [**/start-bugfix**](skills/start-bugfix/)                | Start a bugfix through the pipeline. Gathers bug context, creates an investigation, then bridges through specification → planning → implementation → review. |
| [**/link-dependencies**](skills/link-dependencies/)      | Link external dependencies across topics. Scans plans and wires up unresolved cross-topic dependencies.                                    |

### Creating Custom Skills

Since processing skills are input-agnostic, you can create your own entry-point skills that feed them in new ways. An entry-point skill just needs to:

1. Gather the inputs the processing skill expects
2. Invoke the processing skill with those inputs

See `/start-feature` as an example: it provides inline context to the specification skill instead of a discussion document.

## Agents

Subagents that skills can spawn for parallel task execution.

| Agent | Used By | Description |
|-------|---------|-------------|
| [**review-task-verifier**](agents/review-task-verifier.md) | technical-review | Verifies a single plan task was implemented correctly. Checks implementation, tests, and code quality. Multiple run in parallel. |
| [**implementation-task-executor**](agents/implementation-task-executor.md) | technical-implementation | Implements a single plan task via strict TDD. |
| [**implementation-task-reviewer**](agents/implementation-task-reviewer.md) | technical-implementation | Reviews a completed task for spec conformance, acceptance criteria, and architectural quality. |
| [**planning-phase-designer**](agents/planning-phase-designer.md) | technical-planning | Designs implementation phases from a specification. |
| [**planning-task-designer**](agents/planning-task-designer.md) | technical-planning | Breaks a single phase into a task list with edge cases. |
| [**planning-task-author**](agents/planning-task-author.md) | technical-planning | Writes full detail for a single plan task. |
| [**planning-dependency-grapher**](agents/planning-dependency-grapher.md) | technical-planning | Analyzes authored tasks to establish internal dependencies and priorities. |
| [**planning-review-traceability**](agents/planning-review-traceability.md) | technical-planning | Spec-to-plan traceability analysis. |
| [**planning-review-integrity**](agents/planning-review-integrity.md) | technical-planning | Plan structural quality review. |
| [**specification-review-input**](agents/specification-review-input.md) | technical-specification | Reviews specification against source material for completeness and accuracy. |
| [**specification-review-gap-analysis**](agents/specification-review-gap-analysis.md) | technical-specification | Analyses specification as a standalone document for gaps, ambiguity, and missing detail. |
| [**implementation-analysis-architecture**](agents/implementation-analysis-architecture.md) | technical-implementation | Architecture conformance analysis of completed implementation. |
| [**implementation-analysis-duplication**](agents/implementation-analysis-duplication.md) | technical-implementation | Duplication and DRY analysis of completed implementation. |
| [**implementation-analysis-standards**](agents/implementation-analysis-standards.md) | technical-implementation | Coding standards analysis of completed implementation. |
| [**implementation-analysis-synthesizer**](agents/implementation-analysis-synthesizer.md) | technical-implementation | Synthesizes analysis findings from architecture, duplication, and standards agents. |
| [**implementation-analysis-task-writer**](agents/implementation-analysis-task-writer.md) | technical-implementation | Writes remediation tasks from synthesized analysis findings into the plan. |
| [**review-findings-synthesizer**](agents/review-findings-synthesizer.md) | technical-review | Synthesizes review findings into normalized remediation tasks for plan integration. |

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
