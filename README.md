<h1 align="center">Claude Technical Workflows</h1>

<p align="center">
  <strong>From Idea to Implementation: Agentic Engineering Workflows for Claude Code</strong>
</p>

<p align="center">
  <a href="#what-is-this">What is this?</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#the-workflow">The Workflow</a> •
  <a href="#key-features">Key Features</a> •
  <a href="#skills-reference">Skills Reference</a>
</p>

---

<p align="center">
  <a href="https://leeovery.github.io/claude-technical-workflows/"><strong>Open the Interactive Workflow Explorer</strong></a>
</p>

> **Workflow Explorer** — A visual, interactive guide to every phase and skill in this toolkit. Trace decision logic through flowcharts and understand the full pipeline at a glance.

---

## What is this?

A structured development workflow for Claude Code that turns conversations into working software. Instead of jumping straight to code, you discuss the *what* and *why* first — then the system builds specifications, plans implementation, writes code via strict TDD, and validates the result.

**What you get:**

- **Decisions that stick.** Architecture choices, edge cases, and trade-offs are captured in discussion documents — not lost to chat history. When you come back in a week, the context is there.
- **Specifications that catch mistakes early.** The system analyses your discussions, filters hallucinations, fills gaps, and produces a validated spec before any code is written.
- **Plans with real structure.** Specifications become phased implementation plans with tasks, acceptance criteria, and dependency ordering. Choose where tasks live — [local markdown files, Linear issues, or Tick CLI](#output-formats).
- **Implementation via strict TDD.** Tests first, then code, commit after each task. Per-task approval gates keep you in control, or switch to auto-mode when you trust the flow.
- **Built-in quality checks.** Post-implementation analysis checks architecture conformance, duplication, and coding standards. Review validates against spec and plan. Findings become remediation tasks automatically.
- **Context that survives.** Each phase clears the context window and starts fresh, so you're never fighting token limits on large work. State lives in a manifest, not in conversation history.

> [!NOTE]
> **Work in progress.** The workflow is being refined through real-world usage. Expect updates as patterns evolve.

## Getting Started

### Install

```bash
npx agntc add leeovery/claude-technical-workflows
```

Skills are copied to `.claude/` in your project. Commit them to make them available everywhere, including Claude Code for Web.

<details>
<summary>Removal</summary>

```bash
npx agntc remove leeovery/claude-technical-workflows
```
</details>

### Requirements

- Node.js 18+

### Your First Workflow

Run `/workflow-start` — it shows all active work, lets you continue where you left off, or start something new. When in doubt, this is your entry point.

Or jump straight in:

| Command | Use when... |
|---------|-------------|
| `/start-feature` | You're adding functionality to an existing product |
| `/start-epic` | The work spans multiple topics and sessions |
| `/start-bugfix` | Something is broken and needs fixing |

Each command gathers context through a brief interview, then pipelines you through every phase automatically. Phase transitions clear context and start fresh — you approve each one.

## The Workflow

Three work types, each with its own pipeline:

```
Epic:    Research → Discussion → Specification → Planning → Implementation → Review
Feature:           Discussion → Specification → Planning → Implementation → Review
Bugfix:          Investigation → Specification → Planning → Implementation → Review
```

**Epics** are for large initiatives spanning multiple sessions. Topics move independently — 10 discussions might yield 5 specifications, each planned and implemented separately. Advisory soft gates warn when moving between phases if prerequisite items are still in progress.

**Features** are for adding functionality. Single topic, linear pipeline. Research is optional — skip it if you know what you're building. If a feature grows beyond scope, pivot it to an epic without losing progress.

**Bugfixes** replace discussion with investigation — structured symptom gathering combined with code analysis to find the root cause before specifying the fix.

### The Phases

| Phase | Purpose | Applies to |
|-------|---------|------------|
| **Research** | Explore ideas, market fit, technical feasibility. Output is analysed to derive discussion topics automatically. | Epic, Feature (optional) |
| **Discussion** | Deep dives into architecture, edge cases, and rationale. Captures not just decisions, but *why* you made them. | Epic, Feature |
| **Investigation** | Symptom gathering + code analysis to identify root cause. The bugfix alternative to discussion. | Bugfix |
| **Specification** | Analyses all discussions/investigation, filters hallucinations, enriches gaps, validates decisions. The spec becomes the golden document — planning references only this. | All |
| **Planning** | Converts specs into phased plans with tasks, acceptance criteria, and dependencies. Per-item approval gates with auto-mode. | All |
| **Implementation** | Strict TDD — tests first, then code, commit per task. Post-implementation analysis agents check architecture, duplication, and standards. | All |
| **Review** | Parallel subagents verify each task against spec and plan. Findings become remediation tasks that feed back into implementation. | All |

### Lifecycle

Work units are **in-progress**, **completed**, or **cancelled**. Completion happens automatically when the pipeline finishes, or manually via the manage menu in `/workflow-start`. Completed and cancelled work can be reactivated. Feature and bugfix pipelines offer early completion after implementation (skip review).

## Key Features

### 17 Specialized Agents

Complex phases spawn parallel subagents for isolated concerns — planning uses 6 agents for phase design, task authoring, dependency graphing, and quality review. Implementation uses 7 for TDD execution, post-task review, and cross-cutting analysis. Specification and review each use 2 for input validation and gap analysis.

### Output Formats

Planning supports multiple output formats through an adapter pattern. Each format implements the same contract, so the workflow works identically regardless of where tasks are stored.

| Format | Best for | Setup |
|--------|----------|-------|
| **Tick** (recommended) | AI-driven workflows, native dependency graphs, token-efficient | `brew install leeovery/tools/tick` |
| **Local Markdown** | Simple features, offline, quick iterations | None |
| **Linear** | Team collaboration, visual tracking | Linear account + MCP server |

### Auto-Mode Gates

Every approval gate (task authoring, implementation, review findings) can be switched to auto-mode. Choose `a`/`auto` at any gate to approve all remaining items automatically. Gates reset on fresh sessions for safety.

### Cross-Topic Dependencies

For epics with multiple plans, `/link-dependencies` scans for unresolved cross-topic references and wires them up.

### Workflow Dashboard

`/workflow-start` is a unified dashboard — view all active work, manage lifecycle (complete, cancel, reactivate), pivot features to epics, and route to the right skill.

## Skills Reference

<details>
<summary><strong>Processing Skills</strong> — do the work for each phase</summary>

| Skill | Description |
|-------|-------------|
| [workflow-research-process](skills/workflow-research-process/) | Free-form exploration across technical, business, and market domains |
| [workflow-discussion-process](skills/workflow-discussion-process/) | Captures context, decisions, edge cases, competing solutions, and rationale |
| [workflow-investigation-process](skills/workflow-investigation-process/) | Symptom gathering and code analysis for root cause identification |
| [workflow-specification-process](skills/workflow-specification-process/) | Collaborative refinement into validated, standalone specifications |
| [workflow-planning-process](skills/workflow-planning-process/) | Phased plans with tasks, acceptance criteria, and multiple output formats |
| [workflow-implementation-process](skills/workflow-implementation-process/) | Strict TDD — tests first, implements to pass, commits frequently |
| [workflow-review-process](skills/workflow-review-process/) | Parallel subagent verification against spec and plan |

</details>

<details>
<summary><strong>Entry-Point Skills</strong> — user-facing commands</summary>

**Start:** [`/start-feature`](skills/start-feature/) | [`/start-epic`](skills/start-epic/) | [`/start-bugfix`](skills/start-bugfix/)

**Continue:** [`/workflow-start`](skills/workflow-start/) | [`/continue-feature`](skills/continue-feature/) | [`/continue-epic`](skills/continue-epic/) | [`/continue-bugfix`](skills/continue-bugfix/)

**Utilities:** [`/status`](skills/status/) | [`/view-plan`](skills/view-plan/) | [`/link-dependencies`](skills/link-dependencies/) | [`/migrate`](skills/migrate/)

</details>

<details>
<summary><strong>Agents</strong> — 17 subagents for parallel task execution</summary>

**Planning:** [phase-designer](agents/planning-phase-designer.md) | [task-designer](agents/planning-task-designer.md) | [task-author](agents/planning-task-author.md) | [dependency-grapher](agents/planning-dependency-grapher.md) | [review-traceability](agents/planning-review-traceability.md) | [review-integrity](agents/planning-review-integrity.md)

**Specification:** [review-input](agents/specification-review-input.md) | [review-gap-analysis](agents/specification-review-gap-analysis.md)

**Implementation:** [task-executor](agents/implementation-task-executor.md) | [task-reviewer](agents/implementation-task-reviewer.md) | [analysis-architecture](agents/implementation-analysis-architecture.md) | [analysis-duplication](agents/implementation-analysis-duplication.md) | [analysis-standards](agents/implementation-analysis-standards.md) | [analysis-synthesizer](agents/implementation-analysis-synthesizer.md) | [analysis-task-writer](agents/implementation-analysis-task-writer.md)

**Review:** [task-verifier](agents/review-task-verifier.md) | [findings-synthesizer](agents/review-findings-synthesizer.md)

</details>

## Contributing

Contributions are welcome! Whether it's bug fixes, workflow improvements, or new ideas — please open an issue first to discuss significant changes.

## Related Packages

- [**Agntc**](https://github.com/leeovery/agntc) — The CLI that powers skill, agent, and hook installation
- [**@leeovery/claude-laravel**](https://github.com/leeovery/claude-laravel) — Laravel development skills for Claude Code
- [**@leeovery/claude-nuxt**](https://github.com/leeovery/claude-nuxt) — Nuxt.js development skills for Claude Code

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with care by <a href="https://github.com/leeovery">Lee Overy</a></sub>
</p>
