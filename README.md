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

## What is this?

A development workflow for Claude Code that turns conversations into working software. You have a conversation; the system does the heavy lifting — asking hard questions, pushing back on assumptions, and applying modern development practices at every phase.

**What you get:**

- **An expert in the room.** The system acts as an expert architect — challenging your thinking, probing edge cases before they become bugs, and capturing not just decisions but *why* you made them. Every phase adds real analytical value, not just formatting.
- **Decisions that stick.** Discussions flow organically — follow threads, challenge assumptions, circle back when new context shifts the thinking. A live map tracks the state of every subtopic, and background agents catch gaps as you go. Come back in a week and the context is still there.
- **Memory that compounds across work units.** Every completed research, discussion, investigation, and specification (plus each epic's discovery session logs) is indexed into a searchable knowledge base. The next discussion checks whether you've already decided this, planning sees how comparable specs were structured, and review catches drift from prior decisions in other work units. A spec from three months ago or a discussion that rejected an approach stays one query away — surfaced automatically, not hunted for.
- **Specifications that catch mistakes early.** The system analyses your discussions, filters hallucinations, fills gaps, and produces a validated spec before any code is written.
- **Plans with real structure.** Specifications become phased implementation plans with tasks, acceptance criteria, and dependency ordering. Choose where tasks live — [Tick CLI, Linear issues, or local markdown files](#output-formats).
- **Implementation via strict TDD.** Tests first, then code, commit after each task. Per-task approval gates keep you in control, or switch to auto-mode when you trust the flow.
- **Validation at every stage.** Independent agents check every phase — research and discussions reviewed for gaps, root causes validated, specs checked against their sources, implementation held to your architecture and standards. Findings become remediation tasks automatically.
- **Context that survives.** Each phase clears the context window and starts fresh, so you're never fighting token limits on large work. All progress lives on disk — pick up exactly where you left off, even after context compaction or a new session.

## Getting Started

Two steps and you're running. (Node.js 18+ required.)

### 1. Install into your project

Run this from **the project you want to work on** (skills install into that project's `.claude/`, not globally):

```bash
npx agntc add leeovery/agentic-workflows
```

Commit them to share with your team or to use them in Claude Code for Web. Later, `npx agntc update` pulls the latest, and `npx agntc remove leeovery/agentic-workflows` uninstalls.

### 2. Open Claude Code and run `/workflow-start`

```
/workflow-start
```

That's the whole interface. On a fresh project it walks you through a one-time knowledge-base setup: a single guided command where you pick a search provider (or skip it for keyword-only). After that, `/workflow-start` is where you start new work, pick up where you left off, and get guided through every phase automatically. No config files to write, no phases to memorise; it drives everything.

Want to jot something down without starting a pipeline? Log it and pick it up later from `/workflow-start`:

| Command | Use when... |
|---------|-------------|
| `/workflow-log-idea` | You want to capture an idea for later |
| `/workflow-log-bug` | You want to log a bug for later |
| `/workflow-log-quickfix` | You want to log a quick-fix for later |

<details>
<summary><strong>Knowledge-base setup, requirements & self-hosting</strong></summary>

**Requirements:** Node.js 18+, plus (optionally) an OpenAI API key for semantic search across your workflow history. Keyword-only stub mode works without one.

Workflows require an initialised knowledge base. New installs are prompted to run setup once before any workflow command can execute:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup
```

The interactive wizard walks through:
- **Embedding provider**: `openai` (cloud), `openai-compatible` (local/self-hosted), or `skip` (keyword-only).
- **OpenAI API key** (if `openai`): from `$OPENAI_API_KEY` or `~/.config/workflows/credentials.json` (mode 0600), validated with a test embed before saving.
- **Base URL + model + dimensions** (if `openai-compatible`): the endpoint, model, and vector size. The API key is optional — press Enter to skip it for servers that don't need one.
- **Project init**: creates `.workflows/.knowledge/` and runs the initial indexing pass over any existing artifacts.

If you skip the provider, search falls back to BM25 keyword matching. Re-run setup later to switch.

**Local / self-hosted embeddings (`openai-compatible`).** Any server exposing an OpenAI-compatible `/v1/embeddings` endpoint works: LM Studio, Ollama (OpenAI-compat shim), vLLM, LiteLLM, etc. Pick `openai-compatible` in setup, or write `~/.config/workflows/config.json` directly:

```json
{
  "knowledge": {
    "provider": "openai-compatible",
    "base_url": "http://localhost:1234/v1",
    "model": "nomic-embed-text-v1.5",
    "dimensions": 768
  }
}
```

Examples: LM Studio (`http://localhost:1234/v1`), Ollama (`http://localhost:11434/v1`), vLLM (`http://localhost:8000/v1`). `dimensions` **must match the local model's native output** — the wizard's test embed checks this and fails loudly on a mismatch.

</details>

## The Workflow

Five work types, each with its own pipeline:

```
Epic:          Discovery → Research → Discussion → Specification → Planning → Implementation → Review
Feature:       Discovery → (Research) → Discussion → Specification → Planning → Implementation → Review
Bugfix:        Discovery → Investigation → Specification → Planning → Implementation → Review
Quick-fix:     Discovery → Scoping → Implementation → Review
Cross-cutting: Discovery → (Research) → Discussion → Specification (terminal)
```

Every type begins with **discovery**, which shapes the work, confirms its type, and routes it onward; the pipelines diverge from there. And these aren't just different shapes: every phase adapts its behaviour to the work type, from how research is analysed to how plans are structured to how review findings are prioritised.

**Epics** are large, multi-session initiatives. They get the richest discovery — a challenging design conversation that maps out the topics and hands each one a brief to carry into research or discussion. From there topics move independently: ten discussions might yield five specs, each planned and built on its own. Background analyses keep surfacing new topics as the work matures, and a spec that turns out cross-cutting is promoted to its own work unit.

**Features** add functionality: single topic, linear pipeline. Planning follows your codebase's existing patterns rather than inventing new ones, and research is optional. Features aren't locked in — outgrow the scope and you can pivot to an epic, or fold one into an existing epic as a new topic.

**Bugfixes** swap discussion for investigation — structured symptom-gathering plus code analysis to find the root cause before fixing it. Planning favours minimal, surgical changes, with regression prevention built in.

**Quick-fixes** are trivial mechanical changes — renames, syntax updates, find-and-replace. A single scoping pass produces the tasks, and implementation verifies rather than test-drives. If it turns out to be more than trivial, it's promoted to a feature or bugfix.

**Cross-cutting** concerns are patterns or policies that shape how features get built — caching strategy, error handling, API versioning. They stop at specification (there's nothing to build) and resurface as context whenever you plan other work.

### Three Stages — the three D's

The phases group into three stages that describe the arc of any work:

- **Discovery** — explore the problem and decide what to build. Covers Discovery, Research, Discussion, and (for bugfixes) Investigation.
- **Definition** — pin down what to build and how. Covers Specification and Planning, and (for quick-fixes) Scoping.
- **Delivery** — build it and verify it holds. Covers Implementation and Review.

The epic dashboard groups its phase breakdown under these three headings, so the stage a piece of work has reached is clear at a glance.

### The Phases

| Phase | Purpose | Applies to |
|-------|---------|------------|
| **Discovery** | The universal first phase — shapes the work, confirms its type, routes it onward. For epics, a multi-session design conversation that maps the topics and hands each one a brief to carry forward. | All |
| **Research** | Explore ideas, market fit, and feasibility. Background agents flag gaps; deep-dive agents chase threads in parallel. | Epic, Feature (opt.), Cross-cutting (opt.) |
| **Discussion** | Organic conversation guided by a live map (pending → exploring → converging → decided). Review agents catch gaps; perspective agents argue the ambiguous calls. | Epic, Feature, Cross-cutting |
| **Investigation** | Symptom gathering and code analysis to find the root cause. The bugfix alternative to discussion. | Bugfix |
| **Scoping** | Context, spec, and plan in one pass. Produces 1–2 tasks; promotes to feature/bugfix if it turns complex. | Quick-fix |
| **Specification** | Turns the discussion into one validated, standalone spec — the golden document planning builds from. | Epic, Feature, Bugfix, Cross-cutting |
| **Planning** | Converts specs into phased plans with tasks, acceptance criteria, and dependencies. | Epic, Feature, Bugfix |
| **Implementation** | Builds it via TDD (verification for quick-fix), committing per task, then checks architecture and standards. | Epic, Feature, Bugfix, Quick-fix |
| **Review** | Verifies each task against spec and plan. Blocking findings become fix tasks; the rest can go to the inbox. | Epic, Feature, Bugfix, Quick-fix |

### Lifecycle

Work units are **in-progress**, **completed**, or **cancelled**. Completion happens automatically when the pipeline finishes, or manually via the manage menu in `/workflow-start`. Completed and cancelled work can be reactivated. Feature, bugfix, and quick-fix pipelines offer early completion after implementation (skip review).

## Key Features

### 23 Specialized Agents

Complex phases fan out to parallel subagents, each with one job — gap analysis, deep-dive investigation, competing perspectives, dependency graphing, post-implementation review, and more. Twenty-three in all, spread across the phases that benefit from a second set of eyes.

### Knowledge Base

Every completed research, discussion, investigation, and spec — plus each epic's discovery logs — is indexed into a local semantic-search store. Phases query it as you work, in plain language: *"why we ruled out email as a primary identity field"* returns the original discussion with full provenance, so past decisions surface automatically instead of getting re-litigated. Works with an embedding provider or in keyword-only mode. Older context fades in ranking as the project moves on, but specs never decay.

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

When a reviewer finds issues, the executor retries with the feedback automatically — capped at three attempts before it escalates with a diagnostic of what's resolved and what's still stuck. The same loop guards analysis, planning, and spec review.

### Change Detection & Cached Analysis

Phase outputs are checksummed, so the system notices when something actually changes. Edit a research file and it suggests re-analysing for new topics; edit a spec after planning and it asks whether to replan. Analysis results are cached in between, so revisiting an earlier phase doesn't redo work that's still current.

### Environment Awareness

Implementation auto-discovers linters (ESLint, Prettier, PHP CS Fixer, etc.) and project-specific skills (Laravel, Nuxt conventions) on your machine. Both are integrated into TDD cycles and enforced during review — your project's standards are applied automatically.

### Structured Review Findings

Reviewers flag problems, they don't fix them — each finding comes with a recommended fix, an optional alternative, and a confidence level. Duplicates from parallel reviewers are merged, and non-blocking items are sorted into quick-fixes, ideas, or bugs you can send to the inbox for later.

### Navigate Freely

Revisit any completed phase before moving forward (refine a discussion, update a spec) without losing forward progress. During planning, jump to any point (leading edge, beginning, specific task) without advancing the progress tracker.

### Inbox Capture

Log ideas, bugs, and quick-fixes as they occur to you — say "log that as an idea" mid-conversation, or use the capture commands directly. They wait in the inbox until you're ready; then `/workflow-start` lets you promote one or more into a pipeline, pre-filled with their content, or archive the ones you've dropped. Whatever you promote travels with the work as its seed, so nothing you captured gets lost.

### Workflow Dashboard

`/workflow-start` is the hub — see all active work, manage its lifecycle, pivot or absorb features, curate the inbox, and jump into the right phase.

## Skills Reference

<details>
<summary><strong>Processing Skills</strong> — do the work for each phase</summary>

| Skill | Description |
|-------|-------------|
| [workflow-discovery](skills/workflow-discovery/) | The universal first phase for every work type — shapes the work, confirms its type, and routes it onward; for epics, curates the discovery map (names topics, classifies research vs discussion, supports refinement re-entry) |
| [workflow-research-process](skills/workflow-research-process/) | Free-form exploration across technical, business, and market domains |
| [workflow-discussion-process](skills/workflow-discussion-process/) | Captures context, decisions, edge cases, competing solutions, and rationale |
| [workflow-investigation-process](skills/workflow-investigation-process/) | Symptom gathering and code analysis for root cause identification |
| [workflow-scoping-process](skills/workflow-scoping-process/) | Context, spec, and plan in one pass for quick-fixes |
| [workflow-specification-process](skills/workflow-specification-process/) | Collaborative refinement into validated, standalone specifications |
| [workflow-planning-process](skills/workflow-planning-process/) | Phased plans with tasks, acceptance criteria, and multiple output formats |
| [workflow-implementation-process](skills/workflow-implementation-process/) | Strict TDD — tests first, implements to pass, commits frequently |
| [workflow-review-process](skills/workflow-review-process/) | Parallel subagent verification against spec and plan |

</details>

<details>
<summary><strong>Entry-Point Skills</strong> — user-facing commands</summary>

**Entry:** [`/workflow-start`](skills/workflow-start/) — the single entry point for starting new work (via discovery) and continuing existing work. It routes to the discovery and per-type continue skills internally; those are model-only.

**Capture:** [`/workflow-log-idea`](skills/workflow-log-idea/) | [`/workflow-log-bug`](skills/workflow-log-bug/) | [`/workflow-log-quickfix`](skills/workflow-log-quickfix/)

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

- [**agntc**](https://github.com/leeovery/agntc) — The CLI that powers skill, agent, and hook installation
- [**@leeovery/claude-laravel**](https://github.com/leeovery/claude-laravel) — Laravel development skills for Claude Code
- [**@leeovery/claude-nuxt**](https://github.com/leeovery/claude-nuxt) — Nuxt.js development skills for Claude Code

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with care by <a href="https://github.com/leeovery">Lee Overy</a></sub>
</p>
