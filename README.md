<h1 align="center">Agentic Engineering Workflows</h1>

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
  <a href="https://leeovery.github.io/agentic-workflows/"><strong>Open the Interactive Workflow Explorer</strong></a>
</p>

> **Workflow Explorer** — A visual, interactive guide to every phase and skill in this toolkit. Trace decision logic through flowcharts and understand the full pipeline at a glance.

---

## What is this?

A development workflow for Claude Code that turns conversations into working software. You have a conversation; the system does the heavy lifting — asking hard questions, pushing back on assumptions, and applying modern development practices at every phase.

**What you get:**

- **An expert in the room.** The system acts as an expert architect — challenging your thinking, probing edge cases before they become bugs, and capturing not just decisions but *why* you made them. Every phase adds real analytical value, not just formatting.
- **Decisions that stick.** Discussions flow organically — follow threads, challenge assumptions, circle back when new context changes the thinking. A live Discussion Map tracks every subtopic's state (pending → exploring → converging → decided), so you always see the shape of the conversation. A background review agent catches gaps as you go — with a mandatory final review before concluding to ensure nothing was missed. When a decision has genuine ambiguity, competing perspective agents argue each position before a synthesis agent maps the tradeoff landscape. When you come back in a week, the context is there.
- **Specifications that catch mistakes early.** The system analyses your discussions, filters hallucinations, fills gaps, and produces a validated spec before any code is written.
- **Plans with real structure.** Specifications become phased implementation plans with tasks, acceptance criteria, and dependency ordering. Choose where tasks live — [Tick CLI, Linear issues, or local markdown files](#output-formats).
- **Implementation via strict TDD.** Tests first, then code, commit after each task. Per-task approval gates keep you in control, or switch to auto-mode when you trust the flow.
- **Validation at every stage.** Research is reviewed by a background agent for coverage gaps, shallow areas, and unvalidated assumptions — with deep-dive agents dispatched for independent investigation of substantial threads and a mandatory final review before concluding. Discussions are reviewed by a background agent for gaps and shallow coverage — with a mandatory final review before concluding — plus competing perspective agents for ambiguous decisions. Investigation root causes are independently validated by a synthesis agent before proceeding. Specifications get bidirectional review — one agent checks against source material for accuracy, another analyses the spec as a standalone document for gaps. Plans are checked for spec traceability and structural integrity. Implementation is analysed for architecture conformance, duplication, and coding standards. Review verifies against spec and plan. Findings become remediation tasks automatically.
- **Context that survives.** Each phase clears the context window and starts fresh, so you're never fighting token limits on large work. All progress lives on disk — pick up exactly where you left off, even after context compaction or a new session.

## Getting Started

### Install

```bash
npx agntc add leeovery/agentic-workflows
```

Skills are copied to `.claude/` in your project. Commit them to make them available everywhere, including Claude Code for Web.

<details>
<summary>Removal</summary>

```bash
npx agntc remove leeovery/agentic-workflows
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
| `/start-quickfix` | A trivially scoped mechanical change (find-and-replace, syntax update) |
| `/start-cross-cutting` | You're defining patterns or policies that inform features |
| `/workflow-log-idea` | You want to capture an idea for later |
| `/workflow-log-bug` | You want to log a bug for later |
| `/workflow-log-quickfix` | You want to log a quick-fix for later |

Each command gathers context through a brief interview, then pipelines you through every phase automatically. Phase transitions clear context and start fresh — you approve each one.

## The Workflow

Five work types, each with its own pipeline:

```
Epic:          Research → Discussion → Specification → Planning → Implementation → Review
Feature:     (Research) → Discussion → Specification → Planning → Implementation → Review
Bugfix:                Investigation → Specification → Planning → Implementation → Review
Quick-fix:                   Scoping → Implementation → Review
Cross-cutting: (Research) → Discussion → Specification (terminal)
```

These aren't just different shapes — every phase adapts its behaviour to the work type. This runs deep, from how research is analysed to how plans are structured to how review findings are prioritised.

**Epics** are for large initiatives spanning multiple sessions. Topics move independently — 10 discussions might yield 5 specifications, each planned and implemented separately. Research analysis identifies potential discussion topics and tracks which ones haven't been started yet. As discussions mature, a discussion gap analysis reads all completed discussions holistically to surface cross-discussion themes, elevated-but-uncreated topics, emergent topics, and integration gaps — suggesting new discussions that research couldn't have anticipated. Both sources of pending topics are managed from the epic menu (discuss or skip). Planning uses walking skeletons and steel threads to prove architecture end-to-end before building features on top. Advisory soft gates warn when moving between phases if prerequisite items are still in progress. When a spec is assessed as cross-cutting, it's auto-promoted to its own cross-cutting work unit.

**Features** are for adding functionality. Single topic, linear pipeline. Planning analyses your codebase and follows existing patterns — it won't introduce new architectural conventions unless the spec calls for it. Research is optional — skip it if you know what you're building. If a feature grows beyond scope, pivot it to an epic without losing progress.

**Bugfixes** replace discussion with investigation — structured symptom gathering combined with code analysis to find the root cause before specifying the fix. An optional synthesis agent independently validates the root cause hypothesis by tracing code fresh, catching flawed reasoning before it propagates through the pipeline. Planning applies minimal-change surgical fixes with regression prevention as a first-class deliverable.

**Quick-fixes** are for trivially scoped mechanical changes — global find-and-replace, syntax updates, API renames. Scoping combines context gathering, specification, and planning into a single pass, producing 1-2 tasks directly without agents or review cycles. Implementation uses a verification workflow (baseline → change → verify) instead of TDD, since mechanical changes can't meaningfully be test-driven. If scoping reveals the change is more complex than expected, it promotes to a feature or bugfix automatically.

**Cross-cutting** concerns define patterns, policies, or architectural decisions that inform how features are built (caching strategies, error handling conventions, API versioning). They terminate after specification — there's nothing to build. During planning for any work type, completed cross-cutting specs are surfaced as context.

### The Phases

| Phase | Purpose | Applies to |
|-------|---------|------------|
| **Research** | Explore ideas, market fit, technical feasibility. Background review agent identifies coverage gaps and shallow areas; before concluding, a final review and a document reconciliation pass catch both topical gaps and substance discussed in-session but never captured in the research file. Deep-dive agents investigate independent threads (competitors, APIs, feasibility) in parallel. Output is analysed to derive discussion topics automatically. | Epic, Feature (opt.), Cross-cutting (opt.) |
| **Discussion** | Organic conversation guided by a live Discussion Map that tracks subtopics through pending → exploring → converging → decided. Background review agent catches topical gaps — with a mandatory final review and a document reconciliation pass that catches substance discussed in-session but never captured in the discussion file before concluding; competing perspective agents argue viable approaches on ambiguous decisions, then a synthesis agent maps the tradeoff landscape. For epics, sibling concerns discovered during discussion are elevated to their own topic automatically. Discussion gap analysis (epics) reads all completed discussions to surface cross-discussion themes, integration gaps, and emergent topics. | Epic, Feature, Cross-cutting |
| **Investigation** | Symptom gathering + code analysis to identify root cause. Optional synthesis agent validates the hypothesis independently. The bugfix alternative to discussion. | Bugfix |
| **Scoping** | Context gathering, specification, and planning in a single pass. Produces 1-2 tasks directly. Includes complexity check with promotion to feature/bugfix if needed. | Quick-fix |
| **Specification** | Analyses all discussions/investigation, filters hallucinations, enriches gaps, validates decisions. Reviewed against source material and analysed for gaps before finalising. The spec becomes the golden document — planning references only this. | Epic, Feature, Bugfix, Cross-cutting |
| **Planning** | Converts specs into phased plans with tasks, acceptance criteria, and dependencies. Validated for spec traceability and structural integrity. Per-item approval gates with auto-mode. | Epic, Feature, Bugfix |
| **Implementation** | TDD (or verification workflow for quick-fix) — commit per task. Post-implementation analysis agents check architecture, duplication, and standards. | Epic, Feature, Bugfix, Quick-fix |
| **Review** | Parallel subagents verify each task against spec and plan. Non-blocking recommendations are categorized as quick-fixes, ideas, or bugs — surface selected items to the inbox for future work. Blocking findings become remediation tasks that feed back into implementation. | Epic, Feature, Bugfix, Quick-fix |

### Lifecycle

Work units are **in-progress**, **completed**, or **cancelled**. Completion happens automatically when the pipeline finishes, or manually via the manage menu in `/workflow-start`. Completed and cancelled work can be reactivated. Feature, bugfix, and quick-fix pipelines offer early completion after implementation (skip review).

## Key Features

### 23 Specialized Agents

Complex phases spawn parallel subagents for isolated concerns — research uses 2 agents for periodic gap analysis and independent deep-dive investigation. Discussion uses 3 for independent review, competing perspectives, and synthesis of tradeoffs. Investigation uses 1 for independent root cause validation. Specification and review each use 2 for input validation and gap analysis. Planning uses 6 for phase design, task authoring, dependency graphing, and quality review. Implementation uses 7 for TDD execution, post-task review, and cross-cutting analysis.

### Output Formats

Planning supports multiple output formats through an adapter pattern. Each format implements the same contract, so the workflow works identically regardless of where tasks are stored.

| Format | Best for | Setup |
|--------|----------|-------|
| **Tick** (recommended) | AI-driven workflows, native dependency graphs, token-efficient | `brew install leeovery/tools/tick` |
| **Local Markdown** | Simple features, offline, quick iterations | None |
| **Linear** | Team collaboration, visual tracking | Linear account + MCP server |

### Auto-Mode Gates

Every approval gate (task authoring, implementation, review findings) can be switched to auto-mode. Choose `a`/`auto` at any gate to approve all remaining items automatically. Gates reset on fresh sessions for safety.

### Smart Fix Loops

When a task reviewer finds issues, the executor re-invokes with feedback automatically. Loops cap at 3 attempts before escalating with a convergence diagnostic — showing what's been resolved, what's still stuck, and a trend assessment (converging, stable, or diverging). The same diagnostic applies to analysis cycles, planning review, and specification review at their respective caps.

### Change Detection & Cached Analysis

The system tracks content changes across phase boundaries using checksums. If research documents change, the discussion phase recommends reanalysing to identify new topics — anchoring against existing discussions so nothing is lost. Surfaced topics from research are tracked in the manifest so the epic menu shows which topics are pending discussion, and a soft gate warns before starting specification if undiscussed topics remain. Discussion gap analysis works the same way — if any discussion file changes, the gap analysis re-runs to check for new cross-discussion themes and integration gaps. If discussions change, the specification phase recommends regrouping. If a spec changes after planning, the system asks whether to continue or replan.

Analysis results are cached — the system only reanalyses when content actually changed. This keeps behaviour deterministic across session replays and backwards navigation, avoiding redundant work when revisiting earlier phases.

### Environment Awareness

Implementation auto-discovers linters (ESLint, Prettier, PHP CS Fixer, etc.) and project-specific skills (Laravel, Nuxt conventions) on your machine. Both are integrated into TDD cycles and enforced during review — your project's standards are applied automatically.

### Structured Review Findings

Reviewers identify problems but don't fix them. Each finding includes a recommended fix, optional alternative approach, and confidence level. When multiple parallel reviewers flag the same issue, findings are deduplicated — and low-severity items are discarded unless they cluster into a pattern. Non-blocking recommendations are categorized as quick-fixes (mechanical, no logic changes), ideas (require discussion), or bugs (latent, non-blocking). Surface any of them to the inbox directly from the review verdict screen.

### Navigate Freely

Revisit any completed phase before moving forward — refine a discussion, update a spec — without losing forward progress. During planning, jump to any point (leading edge, beginning, specific task) without advancing the progress tracker.

### Inbox Capture

Log ideas, bugs, and quick-fixes as you go — mid-conversation or from scratch. Say "log that as an idea" during any conversation, or invoke `/workflow-log-idea`, `/workflow-log-bug`, or `/workflow-log-quickfix` directly. Review recommendations can also be surfaced to the inbox from the verdict screen. Captured items land in `.inbox` as plain markdown files. When you're ready, `/workflow-start` shows your inbox and lets you promote items into the pipeline — pre-filling context and skipping the gather-context interview.

### Workflow Dashboard

`/workflow-start` is a unified dashboard — view all active work, manage lifecycle (complete, cancel, reactivate), pivot features to epics, browse your inbox, and route to the right skill.

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

**Start:** [`/start-feature`](skills/start-feature/) | [`/start-epic`](skills/start-epic/) | [`/start-bugfix`](skills/start-bugfix/) | [`/start-quickfix`](skills/start-quickfix/) | [`/start-cross-cutting`](skills/start-cross-cutting/)

**Continue:** [`/workflow-start`](skills/workflow-start/) | [`/continue-feature`](skills/continue-feature/) | [`/continue-epic`](skills/continue-epic/) | [`/continue-bugfix`](skills/continue-bugfix/) | [`/continue-quickfix`](skills/continue-quickfix/) | [`/continue-cross-cutting`](skills/continue-cross-cutting/)

**Capture:** [`/workflow-log-idea`](skills/workflow-log-idea/) | [`/workflow-log-bug`](skills/workflow-log-bug/) | [`/workflow-log-quickfix`](skills/workflow-log-quickfix/)

**Utilities:** [`/workflow-migrate`](skills/workflow-migrate/)

</details>

<details>
<summary><strong>Agents</strong> — 23 subagents for parallel task execution</summary>

**Research:** [review](agents/workflow-research-review.md) | [deep-dive](agents/workflow-research-deep-dive.md)

**Discussion:** [review](agents/workflow-discussion-review.md) | [perspective](agents/workflow-discussion-perspective.md) | [synthesis](agents/workflow-discussion-synthesis.md)

**Investigation:** [synthesis](agents/workflow-investigation-synthesis.md)

**Specification:** [review-input](agents/workflow-specification-review-input.md) | [review-gap-analysis](agents/workflow-specification-review-gap-analysis.md)

**Planning:** [phase-designer](agents/workflow-planning-phase-designer.md) | [task-designer](agents/workflow-planning-task-designer.md) | [task-author](agents/workflow-planning-task-author.md) | [dependency-grapher](agents/workflow-planning-dependency-grapher.md) | [review-traceability](agents/workflow-planning-review-traceability.md) | [review-integrity](agents/workflow-planning-review-integrity.md)

**Implementation:** [task-executor](agents/workflow-implementation-task-executor.md) | [task-reviewer](agents/workflow-implementation-task-reviewer.md) | [analysis-architecture](agents/workflow-implementation-analysis-architecture.md) | [analysis-duplication](agents/workflow-implementation-analysis-duplication.md) | [analysis-standards](agents/workflow-implementation-analysis-standards.md) | [analysis-synthesizer](agents/workflow-implementation-analysis-synthesizer.md) | [analysis-task-writer](agents/workflow-implementation-analysis-task-writer.md)

**Review:** [task-verifier](agents/workflow-review-task-verifier.md) | [findings-synthesizer](agents/workflow-review-findings-synthesizer.md)

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
