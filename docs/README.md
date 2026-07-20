# Documentation

This is the book of the system for the person about to live inside it: what will happen, in what order, what your role is at each moment, what the system produces, and why it is built to behave the way it does. You reach everything through one command — `/workflow-start` — and these pages explain what unfolds after you type it. The repository's top-level README is the short pitch and the install; this is the full account.

## Start here

- [Introduction](introduction.md) — what the system is, the three commitments behind it, and your role in it.
- [The five work types](work-types.md) — the pipeline shapes, from months-long epic to one-file quick-fix, and how the right one gets chosen.

## The life of a piece of work

The phases in order — the journey from a rough idea to landed, reviewed code. Each page covers what happens, what you are asked, what comes out, and why it works that way.

- [Discovery](discovery.md) — the universal first phase: settle what the work is, shape it, and route it into the pipeline.
- [Research and discussion](research-and-discussion.md) — explore the space, then argue it to a decision, with background agents challenging the work live.
- [Investigation and scoping](investigation-and-scoping.md) — the bugfix's route to root cause, and the quick-fix's one-pass shortcut.
- [Specification](specification.md) — decisions become a standalone contract that everything downstream is built from.
- [Planning](planning.md) — the spec becomes phases, tasks, and an order to build them in.
- [Implementation](implementation.md) — the plan becomes code, built and checked task by task in a gated TDD loop.
- [Review](review.md) — the built work is verified against what was agreed, and remediation loops until they match.

## How the system holds together

- [The knowledge base](knowledge-base.md) — the system's memory: what it remembers, what it deliberately forgets, how the past resurfaces, and why old material fades.
- [The collaboration model](collaboration.md) — why your involvement is widest at the start and narrows toward delivery, and how the approval gates work.
- [How it stays reliable](reliability.md) — why the system does not drift, in terms of the guarantees you feel rather than the machinery beneath them.

## Under the hood

How the system works beneath the conversation — described, not as anything you operate.

- [How it fits together](how-it-fits-together.md) — the layers, the skill tiers, and how a single action travels down through them.
- [The engine](engine.md) — the deterministic core: what it is, and why it was built for token economy, determinism, and safety.
- [The agents](agents.md) — the workforce of fresh, narrow sub-agents, and why work is delegated to them.
- [History](history.md) — where the system came from, and the problems that bent it into its current shape.

## Day to day

- [Capture and the inbox](capture-and-inbox.md) — logging ideas, bugs, and quick-fixes without stopping, then triaging them into real work.
- [Lifecycle operations](lifecycle-operations.md) — pivot, absorb, cancel, reactivate, and promote: reshaping work as your understanding of it changes.
- [Configuration](configuration.md) — installing and updating, the settings that fill themselves in, and where each one lives.
