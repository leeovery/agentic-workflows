# The agents

Ledger sends out twenty agents of its own beside the conversation, and the reason comes down to one idea about context. The session you are talking to was in the conversation: it remembers what was said, what was meant, what was waved off. That is an asset when the job is to catch what was discussed but never recorded. It is a liability when the job is to judge what was recorded, because a participant reads it already knowing what it was meant to say. An agent has no such memory. It works from the record, cold, and that is what makes its work worth having — and what tests that the record holds everything.

## The common shape

The conversation itself stays in your session, at your effort. The spec, the phase cut, the tasks, the reviews and the deep dives are each written by a named agent whose one job is that artifact, with its rules boxed inside it. Each agent's model and effort are fixed in its own definition and hold whatever your session runs at: Opus at medium, save the root-cause validator, which runs at extra-high.

Every agent is briefed by the engine, from a template Ledger owns, filled from the records and handed over unchanged; a hook refuses a Ledger agent dispatched with anything else. Nothing of the conversation reaches an agent but what the records hold, so anything an agent should know goes into the record first. An agent's findings and decisions come back to the conversation and take the [ask rule](trust.md#the-ask-rule)'s route like any other call: the agents surface, propose and argue, and the decisions stay with the conversation and with you.

## Before the work

- **The product researcher** reads a codebase that predates Ledger for the product's first conversation: it lands what the code shows as findings on the ledger, and brings back what it leaves open as questions for you.

## While you talk

Behind a live [discussion](discussion.md), agents work in the background while the conversation carries on:

- **The deep dive** answers one open question in real depth — from sources, from the code — and reports what it found for the conversation to take up.
- **The discussion reviewer** reads the topic's record and log with a clean slate and hunts for what the conversation missed: ground left untouched and the concerns beside it, such as security, error handling and migration; a decision with no why, no alternative weighed or a trade-off unsaid; every decided mechanism at its edges; an assumption nobody checked. Each finding comes back with where it belongs. It holds none back to spare you: which ones reach you is the ask rule's to decide.
- **The perspective agents** argue a hard decision from two deliberately opposed lenses, and **the synthesis agent** reconciles them into the landscape of trade-offs and what would tip it.
- **The closing-pass reader** reads the topic fresh at its close, against the other records and the product record, and carries the gap review where none has run since the topic's last decision.

## Between the topics and the spec

- **The sweep** runs once every topic of an epic is decided: it reads across all the records, and the project's in the areas they touch, for work no topic owns and for answers that conflict.
- **The spec writer** assembles the work unit's one spec, by area, from the records, every statement citing the entries it comes from.
- **The spec reviewer** reads the spec against the records and the code, re-running each recorded measurement, and reports its gaps.
- **The phase cutter** cuts the spec into build phases, in build order, from what each part relies on.

In a bugfix, **the root-cause validator** re-traces the cause from the record and the code, independently of the investigation, and **the fix validator** checks the proposed fix against it: whether it resolves the cause, and what it would break.

## While the code is written

- **The task writer** writes each build phase's tasks as the phase starts, against the code the phases before it left.
- **The builder** builds one task, with the tests that prove it, to its task, the spec's sections it cites and the decided calls, proves it by running the product, commits it through the engine's door, writes its account, and takes its review's fix rounds.
- **The reviewer** is an independent reviewer who did not write the code, at three reviews: each task's change, read by the reviewers Claude chooses for it, usually one; and as a pair, each build phase's whole change and the whole change against one area of the spec in the review phase. Each runs the tests and reports each finding with its call and the user scenario that meets it.
- **The consolidation agent**, at a build phase's end, reads its notes for later against the phase's finished code, drops what the code settled, and makes the rest tasks of the phase.
- **The test-surface agent**, in the review phase, reads every test of the whole change against every scenario the spec asks them to guard, runs them, and breaks what they guard to see that they notice.

[The build](the-build.md) and [review](review.md) describe where each fits.

## Searching in depth

- **The plain-search helper** searches the project's files in depth where a [knowledge base](knowledge-base.md) query did not answer, and returns only what it found, so the cost of the search stays out of your conversation.

## Moving a project across

- **The migration's topic agent** carries the judgment work of moving a project from before Ledger, one topic or one phase of a work unit's plan at a time, and **the migration verifier** checks what it composed against its sources, hunting for detail it dropped. [State and git](state-and-git.md#moving-a-project-across) describes the move.
