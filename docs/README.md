# Ledger

This is the book of Ledger for the person about to work inside it: what will happen, in what order, what your part is at each moment, what Ledger produces, and why it behaves the way it does. You reach everything through one command, `/ledger`, or by asking Claude for a change in your own words, and these pages explain what unfolds after that. The repository's top-level README is the short pitch and the install; this is the full account.

## Start here

- [Introduction](introduction.md) — what Ledger is, the ideas behind it, and your part in it.
- [How it fits together](how-it-fits-together.md) — the layers, and how a single action travels down through them.
- [Work types](work-types.md) — epic, feature, bugfix and quick-fix: the shape of each, and how the right one is found.

## The life of a piece of work

The phases in order, from a rough idea to landed, reviewed code. Each page covers what happens, what you are asked, what comes out, and why.

- [Discovery](discovery.md) — where all work starts: the product's conversation and an epic's map, where nothing is decided yet.
- [Discussion](discussion.md) — one conversation per topic, research one of its tools, every question and decision on the ledger.
- [Experiments](experiments.md) — the laboratory a discussion borrows when a number is about to bear a decision.
- [Investigation](investigation.md) — a bugfix's route from symptoms to a root cause.
- [Specification](specification.md) — the decided topics become one spec, cut into phases and approved at ready to build.
- [The build](the-build.md) — the spec becomes code, phase by phase and task by task: the reviews, the pull requests and the drivers.
- [Review](review.md) — the built change held against the spec, area by area, and finish.
- [Lifecycle](lifecycle-operations.md) — pivot, absorb, cancel, postpone and bring back: reshaping work as your understanding of it changes.

## How Ledger holds together

- [Trust](trust.md) — the ledger, the ask rule that decides whether a call reaches you, verdicts, and the matrix where you see and correct it.
- [Verification](verification.md) — how the work proves itself by running the product, and what proven means.
- [State and git](state-and-git.md) — the state branch, how it is pushed and protected, a second machine, and moving a project across.
- [Tracking](tracking.md) — the start menu, the inbox and triage, the roadmap and the product record.
- [The knowledge base](knowledge-base.md) — Ledger's memory across pieces of work: what it remembers, what it never keeps, and why old material fades.
- [How it stays reliable](reliability.md) — the guarantees that keep the work from drifting.

## Under the hood

- [The engine](engine.md) — the deterministic core: why it exists, and the doors it holds.
- [The agents](agents.md) — the twenty agents Ledger sends out, and why work is delegated to them.
- [History](history.md) — where Ledger came from, and the problems that bent it into its shape.

## Setting it up

- [Configuration](configuration.md) — installing and updating, effort, the drivers, the environment setup, and where every setting lives.

## Working on Ledger

- [Contributing](contributing.md) — for changing this repository rather than using it: the gates, migrations, the prose tests and the setup hiccups worth knowing first.
