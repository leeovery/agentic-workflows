# Planning Principles

*Reference for **[workflow-planning-process](../SKILL.md)***

---

These are the principles, rules, and quality standards that govern the planning process.

## Your Role

You are the **planner** — you coordinate the planning process and control a set of agents that do the analytical work alongside you. You invoke agents (for phase design, task design, and task authoring), present their output to the user, handle approval gates, and manage the planning file.

Analysis principles (`phase-design.md`, `task-design.md`) are loaded by the agents, not by you. You hold the planning artifacts (approved phases, task tables) — not the reasoning that produced them.

## Planning is a Gated Process

Planning translates the specification into actionable structure. This translation requires judgment, and the process is designed to ensure that judgment is exercised carefully and collaboratively — not rushed.

### Process Expectations

**This is a step-by-step process with mandatory stop points.** You must work through each step sequentially. Steps end with **STOP** — you must present your work, wait for explicit user approval, and only then proceed to the next step.

**Never one-shot the plan.** Do not write the entire plan in a single operation. The plan is built incrementally — one phase at a time, with the user confirming the structure at each stage. A one-shot plan that misses requirements, hallucinates content, or structures tasks poorly wastes more time than a careful, step-by-step process. Go slow to go fast.

### Explicit Approval Required

At every stop point — phases, task lists, individual tasks, dependencies — the user must explicitly approve before you proceed or log content.

**What counts as approval:** `y/yes` or equivalent explicit confirmation: "Approved", "That's good", "Looks right".

**What does NOT count as approval:**
- Silence
- You presenting choices (that's you asking, not them approving)
- The user asking a follow-up question
- The user saying "What's next?" or "Continue"
- The user making a comment or observation without explicit approval
- ANY response that isn't explicit confirmation

When uncertain whether the user approved, ask: "Ready to proceed, or do you want to change something?"

### Self-Check Before Logging

Before logging any task to the plan, ask yourself:

1. **Did I present this specific content to the user?** If no, present it first.
2. **Did the user explicitly approve it?** If no, wait for approval.
3. **Am I writing exactly what was approved?** If adding or changing anything, present the changes first.

### Collaboration and Judgment

**Stop and ask when the gap is the product's.** Planning is collaborative — not in the sense that every line needs approval, but in the sense that the user owns what the product does and resolves the ambiguities about it. You must stop and ask when:

- The specification is silent or ambiguous about what the product does or how it behaves
- An edge case in behaviour is not addressed in the specification
- A decision the specification doesn't cover changes what the user gets
- Something doesn't add up or feels like a gap in the record

**A fork in how the plan builds it is the planner's.** Phase ownership, task grouping, what a consumer keys on, a bound, internal naming — where the specification, the plan's own conventions, and a measurement all leave it open, settle it on what leans, and on your honest call where nothing does, stating the call and what it weighed in the plan. A how-fork is never a stop and never a `[needs-info]`.

**Never invent product intent.** Where the specification doesn't address what the product does, flag it with `[needs-info]` and ask the user. The specification is the golden document — everything the plan requires of the product must trace back to it. Assuming or guessing product intent — even when it seems reasonable — is not acceptable. Surface the problem immediately rather than continuing and hoping to address it later.

## Rules

**Capture immediately**: After each user response, update the planning document BEFORE your next question. Never let more than 2-3 exchanges pass without writing.

**Commit frequently**: Commit at natural breaks, after significant exchanges, and before any context refresh. Context refresh = lost work.

**Create plans, not code**: Your job is phases, tasks, and acceptance criteria — not implementation.

## Plan as Source of Truth

The plan IS the source of truth. Every phase, every task must contain all information needed to execute it.

- **Self-contained**: Each task executable without external context
- **No assumptions**: Spell out the context, don't assume implementer knows it

→ Return to caller.

