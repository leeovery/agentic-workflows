# First-Phase Routing

*Reference for **[workflow-discovery](../SKILL.md)***

---

The endpoint for single-phase work — feature, cross-cutting, bugfix, quick-fix. Determine the first phase, then conclude through the bridge. The work is already shaped and persisted; the manifest `description` and the session log carry the intent. Feature and cross-cutting have a research-vs-discussion choice; bugfix and quick-fix go to a fixed first phase.

## A. Determine the First Phase

#### If work type is `feature` or `cross-cutting`

Propose research-vs-discussion from the shaping cues, then let the user confirm or flip:

- **research** — open feasibility / "how does X work" / "what's possible" unknowns the work hasn't resolved.
- **discussion** — the shape is clear and the open questions are trade-offs and decisions, not unknowns. For cross-cutting this is the usual spine (research is optional).

Lead with your read and one reason, then render the choice:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{One-line read + reason, e.g. "The shape's clear and the open
questions are trade-offs — I'd start with discussion."}

- **`r`/`research`** — Explore feasibility and options first, no decisions yet
- **`d`/`discussion`** — Ready to discuss and make decisions
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Set `next_phase` to the choice (`research` or `discussion`).

→ Proceed to **B. Finalise**.

#### If work type is `bugfix`

Set `next_phase` = `investigation`.

→ Proceed to **B. Finalise**.

#### If work type is `quick-fix`

Set `next_phase` = `scoping`.

→ Proceed to **B. Finalise**.

## B. Finalise

Finalise the session log carrier: replace its `(none)` **Conclusion** with a one-line note — `Routed to {next_phase}.` Single-phase work sets no active-session marker (it has no resumable loop), so there is nothing to clear here.

Leave the commit to the conclude step — `next_phase` is held in context for it to use.

→ Return to caller.
