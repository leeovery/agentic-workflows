# Introduction

Claude Code is a strong engineer with no memory and no process. This system adds both. It wraps your work in a phased pipeline that thinks before it builds — a conversation that pushes back, a specification you approve, a plan broken into tasks, then implementation running task by task while you step away — and it remembers what it learns, so the next piece of work starts warmer than the last.

You reach all of it through one command. You type `/workflow-start`, describe what you want, and answer the questions that follow. From there the system shows you where you are, asks for decisions at the moments that matter, and produces documents you read and approve. You never run the machinery underneath — there are no state commands to remember, no files to hand-edit, no bookkeeping to keep straight. Your job is to decide; the system's job is to keep the record straight and do the work.

## Why it is built this way

Three commitments shape everything the system does. Understanding them upfront makes the rest of this documentation read as consequences rather than rules.

**Documents drive the work.** Every phase produces a durable document in your repository — a discussion, a specification, a plan, a review. These are not notes the system keeps for itself; they are the working material of the next phase and the record you approve along the way. Thinking is front-loaded into writing, so that building becomes the execution of decisions already made. This is why a specification exists before a plan, and a plan before code: each phase hands the next a document solid enough to work from without re-litigating what came before.

**A deterministic core owns the state.** The assistant reasons, proposes, and talks with you — but it never decides on its own what the true state of your work is. Anything that can be computed from what is already on disk is computed the same way every time by a rule-bound core, then handed to the assistant to act on. Status displays are derived from your files rather than remembered; phase transitions are committed by the core, not narrated into being. The effect is that the system does not drift. You will not get one answer today and a subtly different one tomorrow because the assistant recalled the state loosely. There is one authority on what is true, and everything reads from it.

**Work is validated against what was agreed.** "Done" is not a feeling. The final phase holds the delivered work up against the record that produced it — the discussion that shaped it, the specification that defined it, the plan that scheduled it — and confirms they match. Decisions are captured, the capture is authoritative, and the outcome is checked back against the capture. The loop closes.

## The shape of a session

Work moves through phases, and your involvement narrows as certainty grows. Early on — settling what the work is, exploring it, arguing decisions to a conclusion — the system is conversational and stops often, because these are the moments where a wrong turn is cheap to correct now and expensive to discover later. By the time work reaches implementation, the decisions are already written down, so the loop runs hands-off: agents write code test-first, check it against the plan, and surface to you only when something needs a human call. This graduated hand-off — heavy collaboration up front, agent-led delivery at the end — is a deliberate design, described in [the collaboration model](collaboration.md).

A single piece of work travels from a rough idea to landed, reviewed code without you ever leaving the pipeline. You describe it; [discovery](discovery.md) settles what kind of work it is and shapes it; the middle phases explore, decide, specify, and plan; [implementation](implementation.md) builds it and [review](review.md) verifies it. Everything produced lands in git as you go, so you can kill a session at any point and the next one resumes from disk. Nothing important ever lives only in a chat window.

## Getting started

```bash
npx agntc add leeovery/agentic-workflows
```

Then, in Claude Code:

```
/workflow-start
```

That is the whole interface. The first run configures itself in conversation — there is no setup procedure to follow. If you want search-by-meaning over your past work, you will be offered a one-time setup for it; everything works without it too. From here, [the five work types](work-types.md) explains the pipeline shapes and how the right one gets chosen, and it is the natural next page.
