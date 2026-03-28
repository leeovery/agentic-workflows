# ~~Parallel Agent Perspectives in Discussion~~ — Done

> Implemented in PR #224. Perspective agents + synthesis agent dispatched during discussion sessions. Agent definitions at `agents/workflow-discussion-perspective.md` and `agents/workflow-discussion-synthesis.md`, lifecycle at `skills/workflow-discussion-process/references/perspective-agents.md`.

## The Idea

During discussion, optionally spawn parallel agents that argue different architectural positions — then let the user hear all perspectives before deciding.

## Why This Matters

Currently, discussion is a dialogue between Claude and the user. Claude presents options and its recommendation, but it's one voice. In real engineering teams, the best decisions come from genuine disagreement — one person argues for event sourcing, another for CRUD, a third for CQRS. Each has context the others don't.

## What It Would Look Like

When a contentious architectural decision arises, the user (or Claude) can trigger a "perspectives round":

```
This seems like a decision that benefits from multiple viewpoints.
Spawning perspective agents...

  Agent A (Pragmatist): CRUD with a simple event log
    "Event sourcing adds complexity you don't need yet.
     Start simple, add events when you have a real use case."

  Agent B (Architect): Full event sourcing
    "Your audit requirements make this inevitable.
     Building CRUD now means rewriting in 6 months."

  Agent C (Hybrid): CQRS with selective event sourcing
    "Event-source the payment domain (audit-critical),
     CRUD everything else. Best of both worlds."
```

The user hears distinct, genuinely argued positions — not a single AI presenting a balanced summary. Each agent has a perspective and argues for it.

## Design Tension

This could slow down discussion significantly. Should be opt-in and used sparingly — only for genuinely contentious decisions where the user wants to hear multiple angles. Not every discussion needs a debate panel.
