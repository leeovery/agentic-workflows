<h1 align="center">Agentic Engineering Workflows</h1>

<p align="center">
  <strong>A phased engineering process for Claude Code. Discuss, specify, plan; then let it build.</strong>
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#examples">Examples</a> •
  <a href="#how-it-works">How It Works</a> •
  <a href="#setup">Setup</a> •
  <a href="#documentation">Docs</a>
</p>

---

Claude Code is a capable engineer with no memory and no process. This adds both.

You install it into your project and Claude Code picks it up as a set of skills; from then on, you build your software through it. It is not an app you run; it is the process your agent follows. Work is shaped into one of five types (epic, feature, bugfix, quick-fix, cross-cutting), each with its own pipeline of phases, and every phase writes its record to disk. The thinking is front-loaded into discussion, specification, and planning; implementation then runs as a gated loop that executes the plan rather than improvising.

## Quick Start

Requires Node.js 18+. Install from the project you want to work on (the skills land in that project's `.claude/`, not globally):

```bash
npx agntc add leeovery/agentic-workflows
```

Open Claude Code and run:

```
/workflow-start
```

That is the whole interface. The first run configures itself in the chat; after that, `/workflow-start` shows everything in flight and routes you to the right phase:

```
●───────────────────────────────────────────────●
  Workflow Overview
●───────────────────────────────────────────────●

Features:
  1. Api Rate Limiting
     └─ Specification (In-Progress)

Bugfixes:
  2. Checkout Double Charge
     └─ Investigation (In-Progress)

Epics:
  3. Payments Overhaul
     └─ Discussion, Specification

Inbox: 2 ideas, 1 bug

2 completed, 0 cancelled.

· · · · · · · · · · · ·

What would you like to do?

- 1 — Continue "Api Rate Limiting" — feature, specification (in-progress)
- 2 — Continue "Checkout Double Charge" — bugfix, investigation (in-progress)
- 3 — Continue "Payments Overhaul" — epic

- s/start — Start something new (not sure what kind yet)
- f/feature — Start new feature
- e/epic — Start new epic
- b/bugfix — Start new bugfix
- q/quick-fix — Start new quick-fix
- c/cross-cutting — Start new cross-cutting concern
- i/inbox — View the inbox and start from an item
- v/view — View completed & cancelled work units
- m/manage — Manage a work unit's lifecycle

Select an option:

· · · · · · · · · · · ·
```

Numbered items resume existing work exactly where it stopped, in a fresh session, days later. Letters start something new. There are no phases to memorise and no state to manage by hand.

## How It Works

Five work types, each with a pipeline matched to its weight:

```
Epic:          Discovery → Research → Discussion → Specification → Planning → Implementation → Review
Feature:       Discovery → (Research) → Discussion → Specification → Planning → Implementation → Review
Bugfix:        Discovery → Investigation → Specification → Planning → Implementation → Review
Quick-fix:     Discovery → Scoping → Implementation → Review
Cross-cutting: Discovery → (Research) → Discussion → Specification (terminal)
```

Everything begins in discovery, which shapes the work with you and confirms its type. Epics are multi-session initiatives split into topics that move through the phases independently. Features are one topic through a linear pipeline. Bugfixes swap discussion for investigation: symptom gathering plus code analysis until the root cause is found. Quick-fixes collapse to a single scoping pass for mechanical changes. Cross-cutting concerns (a caching strategy, an error-handling policy) stop at specification and resurface as context when other work is planned.

Three things make this more than a checklist:

**The thinking happens up front.** Discussion is a working design conversation, not a form to fill: the system probes edge cases, pushes back on assumptions, and tracks every subtopic on a live map while review agents check the record for anything discussed but not written down. Specification distils the discussion into a validated, standalone spec. Planning turns the spec into phased tasks with acceptance criteria and dependency order. Twenty-three focused subagents back the pipeline: gap analysis, competing perspectives, deep-dive investigation, dependency graphing, and more.

**So the coding runs hands-off.** Implementation executes the plan task by task: an executor agent writes the tests first and implements to green, an independent reviewer verifies the result, and one commit lands per approved task. Fix rounds are capped at three attempts before the loop escalates with a diagnostic of what is resolved and what is stuck. Both gates in the loop, task approval and fix approval, accept `a`/`auto`: answer once and the remaining tasks run unattended. The loop holds up because it is not improvising; every decision it executes was already made and written down. When the last task lands, analysis agents review the whole build against plan and spec, and anything they find comes back as new tasks.

**Nothing depends on the context window.** Every phase commits its artifacts to `.workflows/` as it goes, and a deterministic engine (one Node CLI) owns the manifest, state transitions, and transactional commits, so the process is enforced rather than remembered. Sessions end, context compacts, weeks pass: `/workflow-start` resumes from disk. Completed research, discussions, investigations, and specs are indexed into a local knowledge base that later phases query in plain language, so a decision from three months ago surfaces on its own instead of being re-litigated.

## Examples

Everything below is chat output as Claude renders it.

An epic in flight. Pick it from the overview and the dashboard shows every topic, its phase, and what to do next:

```
●───────────────────────────────────────────────●
  Payments Overhaul
●───────────────────────────────────────────────●

── DISCOVERY ────────────────────────────────────

  · seeded from the inbox

  RESEARCH & DISCUSSION (4 topics · 1 decided · 1 in flight · 1
  ready · 1 fresh)
  ├─ ✓ Provider Abstraction [decided]
  │     One gateway interface over Stripe and Adyen.
  ├─ → Idempotency Keys [research complete · ready for discussion]
  │     Retry-safe writes across every payment endpoint.
  ├─ ◐ Webhook Retries [discussing]
  │     Delivery guarantees when a provider webhook fails.
  └─ ○ Refund Flows [fresh · routed to discussion]
        Partial refunds, disputes, and ledger entries.
        ↳ Gap-analysis

── DEFINITION ───────────────────────────────────

  SPECIFICATION (1 in-progress)
  └─ Provider Abstraction [in-progress]
     ├─ Provider Abstraction [incorporated]
     └─ Idempotency Keys [pending]
```

Inside a discussion, a live map tracks each subtopic as the conversation moves:

```
  Discussion Map — Webhook Retries (5 subtopics — 1 decided · 1
  converging · 1 exploring · 2 pending)
  ├─ ✓ Delivery Guarantees [decided]
  ├─ → Retry Backoff [converging]
  ├─ ◐ Dead Letter Handling [exploring]
  │  └─ ○ Poison Messages [pending]
  └─ ○ Observability [pending]
```

During implementation, each task arrives already reviewed. Approve it, or answer `a` once and the rest of the plan runs without you:

```
Task provider-abstraction-1-3: Add gateway interface — approved

Phase: 1 — Provider Interface
Extracted a PaymentGateway interface over the Stripe client and
added contract tests covering both implementations. 14 tests green.

· · · · · · · · · · · ·

Approve task provider-abstraction-1-3?

- y/yes — Commit and continue to next task
- a/auto — Approve this and all future tasks automatically
- Ask — Ask questions about the implementation (doesn't approve or reject)
- Comment — Request changes (triggers a fix round)

· · · · · · · · · · · ·
```

## The knowledge base

Every completed artifact is indexed: research, discussions, investigations, specifications, the discovery record, and the material a work unit was seeded from. Later phases query it in plain language and get answers with provenance, so "why did we rule out email as an identity field?" has a citable answer months later.

Dead ends count too. A rejected approach is indexed alongside the specs that shipped, and it stops the next work unit exploring the same ground again. Relevance decays with shipped work rather than wall-clock time, and specifications never decay.

## Features

- **Change detection.** Phase outputs are checksummed. Edit a research file and the system offers re-analysis; edit a spec after planning and it asks whether to replan. Unchanged analyses are served from cache.
- **Environment awareness.** Implementation discovers your linters and project-specific skills and applies them through the TDD cycle and review.
- **Structured review findings.** Reviewers flag problems rather than silently fixing them: each finding carries a recommended fix, an alternative, and a confidence level. Non-blocking findings can be sent to the inbox.
- **Work that bends.** Pivot a feature into an epic when it outgrows its scope, absorb a feature into an epic as a topic, cancel and reactivate topics or whole work units.
- **Capture without ceremony.** Mid-conversation, say "log that as an idea" (or a bug, or a quick fix). It lands in an inbox without derailing what you were doing, and can be promoted into a pipeline later as the seed of the work.
- **Your task tracker.** Plans write tasks to the format you choose, behind one adapter contract:

| Format | Best for | Setup |
|--------|----------|-------|
| **Tick** (recommended) | AI-driven workflows, native dependency graphs | `brew install leeovery/tools/tick` |
| **Local Markdown** | Simple features, small plans, quick iterations | None |
| **Linear** | Teams already on Linear, visual tracking | Linear account + MCP server |

## Setup

The first `/workflow-start` in a project walks through everything below in the chat. The details are here for reference.

<details>
<summary><strong>Knowledge base setup, requirements, and self-hosting</strong></summary>

**Requirements:** Node.js 18+, plus (optionally) an OpenAI API key for semantic search across your workflow history. Keyword-only mode works without one.

Workflows require an initialised knowledge base. On a fresh project, `/workflow-start` initialises it in the chat; there is no separate setup command to run first:

- **Reuse or choose.** If your machine already has a system-wide configuration (`~/.config/workflows/config.json`), one keypress reuses it for this project. Otherwise pick a mode in the chat: `openai` (recommended, full semantic search), `openai-compatible` (local or self-hosted), or keyword-only (no key needed; upgrade anytime).
- **API key** (for `openai`, or a keyed endpoint): the key never passes through the chat. Store it from your terminal: `node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup --key-only` prompts privately (input hidden) and saves to `~/.config/workflows/credentials.json` (mode 0600). Or set `$OPENAI_API_KEY` in your shell, then tell the chat you are done. Keys are validated with a test embed before saving.
- **Project init** creates `.workflows/.knowledge/` and runs the initial indexing pass over any existing artifacts.

If you pick keyword-only, search falls back to BM25 keyword matching. Re-run setup later to switch.

The interactive wizard remains for reconfiguring the system-wide defaults (provider, model, key) outside any project gate:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs setup
```

**Local / self-hosted embeddings (`openai-compatible`).** Any server exposing an OpenAI-compatible `/v1/embeddings` endpoint works: LM Studio, Ollama (OpenAI-compat shim), vLLM, LiteLLM, etc. Pick `openai-compatible` in the chat gate or the wizard, or write `~/.config/workflows/config.json` directly:

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

Examples: LM Studio (`http://localhost:1234/v1`), Ollama (`http://localhost:11434/v1`), vLLM (`http://localhost:8000/v1`). `dimensions` must match the local model's native output; setup's test embed checks this and fails loudly on a mismatch.

</details>

<details>
<summary><strong>Managing the install</strong></summary>

Commit the installed files to share the workflows with your team or use them in Claude Code for Web. `npx agntc update` pulls the latest; `npx agntc remove leeovery/agentic-workflows` uninstalls.

</details>

## Documentation

Full documentation: [docs/](docs/README.md). This README stays at the surface; the phases, work types, engine, and knowledge base are covered in depth there.

## Contributing

Contributions are welcome, from bug fixes to workflow improvements to new ideas. Please open an issue first to discuss significant changes.

## Related Packages

- [**agntc**](https://github.com/leeovery/agntc): the CLI that powers skill, agent, and hook installation
- [**@leeovery/claude-laravel**](https://github.com/leeovery/claude-laravel): Laravel development skills for Claude Code
- [**@leeovery/claude-nuxt**](https://github.com/leeovery/claude-nuxt): Nuxt.js development skills for Claude Code

## License

MIT License. See [LICENSE](LICENSE) for details.

---

<p align="center">
  <sub>Built with care by <a href="https://github.com/leeovery">Lee Overy</a></sub>
</p>
