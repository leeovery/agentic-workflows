<h1 align="center">Ledger</h1>

<p align="center">
  <strong>Agentic workflows for Claude Code. Talk the product through, approve the spec, then let it build.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/github/v/tag/leeovery/agentic-workflows?label=release" alt="release">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="license">
</p>

<p align="center">
  <a href="#what-it-looks-like">What it looks like</a> •
  <a href="docs/README.md">Documentation</a> •
  <a href="#license">License</a>
</p>

---

> Claude Code is a capable engineer with no memory and no process. Ledger adds both, and learns when to ask you.

```bash
npx agntc add leeovery/agentic-workflows
```

Then in Claude Code:

```
/ledger
```

That's the whole interface — or skip it and ask Claude for a change in your own words. Describe what you want to build and the right shape of work picks you up: a conversation that pushes back and finds the questions nobody has answered yet, a spec you approve, then a build that runs on its own, task by task, each proven by running the product. Kill the session whenever; the next one resumes from disk.

**A record, not a scratchpad.** Every question, finding and decision lands on the project's ledger as it is made: who made it, why, what it rules out, what it relies on, and what the other side would have said. Nothing on it is edited — a change of mind replaces the old answer and flags everything that relied on it. "What have you decided without me?" is always one question away.

**Claude decides as you would.** Whether a call reaches you is arithmetic over your own answers, never Claude's confidence. Every question of taste asks at first; a kind of question goes quiet only once your answers show Claude's on it would rarely have cost the product, and asks again when one does while its record is still short. Danger, and anything you said you care about, always asks.

**Proven by running it.** Builders prove each task by driving the running product the way a user would, and a script, never Claude's account, writes the verdict. A scenario nothing could drive is reported not proven.

**Spec-driven by enforcement, not convention.** A deterministic engine owns every state transition, every screen and every commit. Each record has one door, required steps are checklists the engine holds, and hooks refuse the ways round them.

Work comes in four shapes, each with a pipeline suited to its size, from months of multi-topic work down to a one-line fix:

| Type | Pipeline |
|---|---|
| Epic | Discovery → Discussion → Specification → Implementation → Review |
| Feature | Discovery → Discussion → Specification → Implementation → Review |
| Bugfix | Discovery → Investigation → Specification → Implementation → Review |
| Quick-fix | Discovery → Implementation → Review (on request) |

An epic is many topics, each its own discussion, decided before one spec is written across them; a feature is one. A discussion can spawn an experiment when a number is about to bear a decision: a controlled measurement, designed before it runs, whose verdict comes back to be discussed.

## What it looks like

```
Inbox: 2 ideas · 1 bug · 1 quick-fix

◆ What would you like to do?

1         → Continue feature: Saved Filters — build, phase 1 of 3
2         → Continue bugfix: Export Timeout — investigation
3         → Continue epic: Payments Overhaul — discussion, 1 of 3
            topics decided
p/product → Talk about the product
s/start   → Start something new — describe it, and we'll find what
            kind of work it is
t/triage  → Triage the inbox
r/roadmap → Open the product roadmap
v/view    → View completed & cancelled work units
m/manage  → Manage work units, the project's setup and drivers, and
            the matrix
h/help    → How Ledger works
```

Every screen is drawn by the engine from the state on disk and shown exactly as drawn. Claude cannot editorialise your status. With Ledger's Claude Code mod, every menu is a row of buttons above the prompt, and a board beside the conversation shows the build's tasks, a topic's map and the questions waiting.

## The build runs on its own

The spec is cut into phases at ready to build, where you pick the build's position: auto, where it runs on its own and only what needs you stops it, or step, where it also stops after each task for you to try it. Each phase's tasks are written as it starts. Builders work them side by side, each in a worktree of its own, building each task with the tests that prove it; a pair of reviewers who didn't write the code checks each task, and each phase's whole change, against the spec. On GitHub every task lands as its own pull request, each phase a stack of them. A question for you parks only the tasks that depend on it; the rest carry on. Front-load your attention on the conversation and the spec; the build handles the rest.

## The ledger and the record

Each topic's current decisions are drawn from the ledger into its record, which is what the spec is assembled from — every statement citing the entries it comes from — and what later work searches. Beside each record, the conversation's log keeps the journey: the options weighed, the false paths, why minds changed. When you change one of Claude's calls, you're asked at the next sign-off what its answer would have cost: nothing, a fix later, or a real loss. Those verdicts are what it learns from, and the matrix shows where every kind of question stands.

## Memory across the work

Every record is indexed locally and searched by meaning. Later work asks "what did we decide about X?" and gets the decision itself, with where it came from. A replaced decision drops out of search the moment it changes, and material fades as the project moves past it, not as the calendar does.

## Starting in an existing codebase

A project that grew up on Ledger accumulates its record as it goes. A project you install it into has none, so your first session offers to have a researcher read the code first: what the code shows lands on the ledger as findings, and what it leaves open becomes the product conversation's first questions.

## Your tracker and your code host

Tasks live in your tracker through a driver, and land in your repository through another. The tracker that ships is **Tick**, a lightweight task tool built for coding agents. Code lands through **GitHub**, as stacked pull requests, where your remote is there, and as local branches where it isn't. A driver for another code host comes by pull request against the drivers' conformance suite.

## The roadmap and the inbox

Mention an idea or a bug mid-conversation and keep working: it lands in the inbox, for you to triage later. Above the pieces of work sits the roadmap: horizons you name in your own release language, holding what you've decided on but not started. Say "that's a v2 thing" anywhere and it's on the roadmap in one line. Pick items off it and they go into discovery together as the seeds of one piece of work.

## When work changes shape

A feature that outgrows its scope pivots into an epic. A feature that belongs inside one is absorbed as a topic. A topic wanted later rather than never is postponed onto the roadmap whole. Cancelled work comes back; finished work stays finished, and a later change to it is new work.

---

## More features

- **State on its own branch.** Ledger keeps its records on a branch of their own, `ledger-state`, checked out beside your code, pushed after every commit, and on GitHub offered a rule against its deletion, set only on your yes. Pull requests never carry it, and a second machine catches up on its own.
- **Full audit trail.** Every decision, every review finding and every verification run lands in git through engine-owned commits.
- **Durable by construction.** State changes are transactions: checked first, refused cleanly, committed whole. A crash mid-anything leaves nothing half-written.
- **Nothing falls on the floor.** A point raised in the wrong topic is sent as mail to the topic it belongs to, and waits there until read.
- **Many sessions, one checkout.** Talk through as many topics in parallel as you like; a commit takes what its own action wrote and the conversation logs written since, never another session's half-made change. A build, the review phase and a quick-fix take turns in the checkout.
- **Recovers from anything.** After a compaction, a crash or a new session, the work re-reads its record and carries on where it was, with no recap.
- **Session labels.** Opt in per project and your terminal session's label shows where you're working — `myproject · payments · discussion · auth-flow` — the original put back on exit, in the terminal multiplexers [configuration](docs/configuration.md#session-labels) lists.
- **Zero-maintenance upgrades.** Updates migrate existing projects in place on the next run, including a project from before Ledger.

## Documentation

The [full documentation](docs/README.md) covers every phase in detail, trust and verification, the state branch, the engine, the knowledge base, the agents, and the history of the project. Start with these:

| Page | Contents |
|---|---|
| [Introduction](docs/introduction.md) | What Ledger is and your part in it |
| [Work types](docs/work-types.md) | Epic to quick-fix, each pipeline in full |
| [The build](docs/the-build.md) | Phases, tasks, the reviews, pull requests and the drivers |
| [Trust](docs/trust.md) | The ledger, the ask rule, verdicts and the matrix |
| [Verification](docs/verification.md) | Proving the work by running the product |
| [State and git](docs/state-and-git.md) | The state branch, pushing, a second machine |
| [Configuration](docs/configuration.md) | Install, effort, the drivers, the environment setup |
| [History](docs/history.md) | Where this came from and how it evolved |

**Setup:** Node 18+, git 2.40.0+, and Claude Code 2.1.287+ in its terminal app or the Desktop app's Code tab, which Ledger is built for — on the web or in the VS Code extension the menus stay text and support is soft, fixes welcome. Run your session at medium effort or above. There is no setup procedure: your first session sets everything up in chat. The build's tracker needs Tick, and landing on GitHub needs GitHub's CLI with its stack extension. Optional: an OpenAI(-compatible) key for search by meaning, entered in your terminal, never the chat.

**Managing the install:** commit the installed files to share Ledger with your team. `npx agntc update` pulls the latest; `npx agntc remove leeovery/agentic-workflows` uninstalls.

## Contributing

Contributions are welcome — bug fixes, improvements, or new ideas. Please open an issue first to discuss anything significant.

See [docs/contributing.md](docs/contributing.md) for getting set up, the test gates, and the setup gotchas worth knowing before they cost you an afternoon.

## Related Packages

- [**agntc**](https://github.com/leeovery/agntc) — The CLI that powers skill, agent, and hook installation
- [**claude-laravel**](https://github.com/leeovery/claude-laravel) — Laravel development skills for Claude Code
- [**claude-nuxt**](https://github.com/leeovery/claude-nuxt) — Nuxt.js development skills for Claude Code
- [**tick**](https://github.com/leeovery/tick) — Lightweight task management CLI designed for AI coding agents; deterministic, with zero-friction git integration

## License

MIT
