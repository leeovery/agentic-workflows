<h1 align="center">Agentic Engineering Workflows</h1>

<p align="center">
  <strong>A phased engineering process for Claude Code. Discuss, specify, plan; then let it build.</strong>
</p>

---

> Claude Code is a capable engineer with no memory and no process. This adds both.

```bash
npx agntc add leeovery/agentic-workflows
```

Then in Claude Code:

```
/workflow-start
```

That's the whole interface. Describe what you want to build and the right pipeline picks you up: a discussion that pushes back, a specification you approve, a plan broken into tasks, then implementation running hands-off in a gated TDD loop while you do something else. Every decision lands in a versioned document in your repo. Kill the session whenever; the next one resumes from disk.

**Why it works when other loops don't:** by the time code gets written, there's nothing left to improvise. The thinking happened in discussion and specification, with review agents challenging gaps in the background. The loop executes decisions that are already written down.

**And it remembers.** Everything the process produces is indexed locally. "Why did we rule out email as an identity field?" has a citable answer months later. Dead ends are indexed too, so the next piece of work doesn't re-explore them.

Work comes in five shapes: epic, feature, bugfix, quick-fix, cross-cutting. Each has a pipeline suited to its size, from months of multi-topic discovery down to a one-file fix. Mid-conversation capture too: say "log that as an idea" and keep working.

## What it looks like

```
●───────────────────────────────────────────────●
  Workflow Overview
●───────────────────────────────────────────────●

Features:
  1. Api Rate Limiting
     └─ Specification (In-Progress)

Epics:
  2. Payments Overhaul
     └─ Discussion, Specification

Inbox: 2 ideas, 1 bug

· · · · · · · · · · · ·

What would you like to do?

- 1 — Continue "Api Rate Limiting"
- 2 — Continue "Payments Overhaul"
- s/start — Start something new
- i/inbox — View the inbox
```

Every display is computed by the engine from state on disk and emitted byte-for-byte. Claude cannot editorialise your status.

## The hands-off loop

Implementation runs task by task: an executor writes the code test-first, a reviewer checks it against the plan's acceptance criteria, and failures loop back with findings, capped at three attempts before you're consulted. Each gate can be approved by hand or set to auto. Front-load your attention on the discussion and the spec; the loop handles the rest, and every task lands as its own commit.

## The knowledge base

Every completed artifact is indexed: research, discussions, investigations, specifications, the discovery record. Later phases query it in plain language and get answers with provenance. Dead ends count too; a rejected approach stops the next work unit exploring the same ground. Relevance decays with shipped work rather than wall-clock time, and specifications never decay.

## An expert in the room

Twenty-three specialised agents work alongside the pipeline: background reviewers that challenge gaps while you talk, document reviews that catch what the session forgot to write down, perspective panels that argue both sides of a decision, task verifiers that check the built thing against what was specified. Findings are surfaced, never silently applied.

## Your task tracker

Plans write tasks to the format you choose behind one adapter contract: **Tick** (native dependency graphs, built for this), **Local Markdown** (zero dependencies), or **Linear** (your team already lives there).

## When work changes shape

A feature that outgrows its scope pivots into an epic. A feature that belongs inside one gets absorbed as a topic. Completed work reopens cleanly, cancelled work reactivates, and a spec that turns out to be project-wide gets promoted to a standing document.

---

**[Full documentation →](docs/README.md)** — every phase, the engine, the knowledge base, the 23 review agents, task formats, and the history.

**Setup:** Node 18+. There is no setup procedure; the first run configures itself in chat. Optional: an OpenAI(-compatible) key for semantic search, entered in your terminal, never the chat.

**Managing the install:** commit the installed files to share the workflows with your team or use them in Claude Code for Web. `npx agntc update` pulls the latest; `npx agntc remove leeovery/agentic-workflows` uninstalls.

## License

MIT
