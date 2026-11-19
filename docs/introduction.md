# Introduction

Claude Code is a capable engineer with two gaps. It forgets everything between sessions, and it has no process for how a piece of work should unfold, so every session starts cold and improvises from there. Ledger fills both. Every piece of work goes through phases, each building on what the last one recorded, and every question, finding and decision lands on a record that outlives the session, so nothing decided is decided twice.

You reach it through one command, `/ledger`, or without the command at all: ask Claude for a change in the middle of a conversation and it takes your words into Ledger itself. From there Ledger shows you where everything stands, asks for the decisions that are yours, and builds from what you decided. You never run the machinery underneath. There are no state commands to remember, no files to hand-edit and no phase to keep track of. Your part is to decide; Ledger's part is to keep the record straight and do the work.

## Why it is built this way

Three commitments shape everything Ledger does. Knowing them first makes the rest of this book read as consequences rather than rules.

**The record drives the work.** Every question, finding and decision lands on the ledger as it is made: who made it, why, what it rules out, and what it relies on. Nothing on the ledger is edited. A changed mind is a new entry replacing the old one, with its reason, and everything that relied on the old answer is flagged until someone confirms it still holds. Each topic's record, the specification, the build's tasks and the knowledge base are all drawn from it. That is why Ledger can pick up cold: nothing downstream depends on anyone remembering a session, only on the record.

**A deterministic core owns the state.** Claude reasons, proposes and talks with you, but it never decides on its own what the true state of your work is. Anything that can be worked out from what is on disk is worked out the same way every time by [the engine](engine.md), then handed to Claude to act on. The menus are drawn from your files rather than remembered, a phase moves on when the engine records it rather than when a conversation says so, and whether a question reaches you is the engine's arithmetic, not Claude's confidence. You will not get one answer today and a subtly different one tomorrow.

**The work is held to what was agreed.** "Done" is not a feeling. The specification traces every statement to the decision it comes from, the build's tasks are written from the specification, each task is reviewed against its acceptance scenarios by reviewers who never wrote it, and the review phase holds the whole change up against the specification with the product running. Proven means a scenario was performed on the running product, never that Claude says it worked.

## How much of you it needs

The amount of you each phase needs falls as the work goes on, by design. At the start nearly every turn is yours: [discovery](discovery.md) and [discussion](discussion.md) are conversations, because a wrong turn caught there costs a sentence and the same wrong turn caught in review costs a rebuild. By the [specification](specification.md) the decisions are on record, so your part shifts to approving. [The build](the-build.md) and the [review phase](review.md) run largely on their own.

A few gates always stop for you: starting the work, approving an epic's map, a topic's decision, ready to build and finish. Everything smaller is a call, and Claude makes most of them the way you would, learning from your own answers: it asks where its calls of a kind have been missing more often than you allow, sooner where a change would be hard to undo, and always where data could be lost or security weakened. When you change one of its calls, you are later asked what its answer would have cost, so it learns. [Trust](trust.md) covers the rule in full.

## Getting started

```bash
npx agntc add leeovery/agentic-workflows
```

Then, in Claude Code:

```
/ledger
```

That is the whole interface. The first time it runs in a project, Ledger sets itself up in conversation rather than through a procedure. It offers a short walkthrough of how it works, eight screens, declined in one keystroke and always there afterwards from `h/help` on the start menu. It asks once, in each copy of the project, how the [knowledge base](knowledge-base.md) should search: by meaning, which needs an embedding provider, or by keyword, which needs nothing. On a codebase that was built before Ledger arrived, it offers to have the existing code read first, so the product's first conversation opens on what the code shows. Where the [Claude Code mod](configuration.md) can run, menus become buttons above the prompt and each move between phases starts a fresh conversation; Ledger works without it, with typed menus. Each offer is made once and its answer kept. [Configuration](configuration.md) covers the rest of the setup, and what fills itself in.

From there, [how it fits together](how-it-fits-together.md) shows the pieces, and [the kinds of work](work-types.md) is the natural next page.

## Coming from before Ledger

A project with records from before Ledger is moved across the first time `/ledger` runs in it. The move carries each piece of work into Ledger's layout: its decisions onto the ledger, its files into their new places, and a build already under way into Ledger's build, where it picks up from the phase it had reached. Parts of the move need judgement rather than code, such as reading an old plan against the code already built, and those run as steps Claude carries out before anything else, telling you as each starts. At the end you see what was moved and what was corrected along the way, and nothing is committed until you say yes.

Files the move found no place for are never thrown away. They are kept with their piece of work, or with the product, as legacy files, and the start menu shows a row for sorting them, as [lifecycle operations](lifecycle-operations.md#the-legacy-files) describes. The old cache's reports, and the files the old agents and trackers wrote beside the work — its plans, its tracking, its analysis and review reports — are kept in Ledger's own ignored cache, beside the work they belonged to, for as long as that work runs.
