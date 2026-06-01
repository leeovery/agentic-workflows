# Feature / Cross-Cutting Routing

*Reference for **[workflow-discovery](../SKILL.md)***

---

The endpoint for a feature or cross-cutting work unit: one routing decision, then conclude through the bridge. The work is already shaped and persisted — the manifest `description` and the session log carry the intent.

## A. Decide Routing

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

Hold the choice as `next_phase` (`research` or `discussion`).

→ Proceed to **B. Finalise**.

## B. Finalise

Finalise the session log carrier: replace its `(none)` **Conclusion** with a one-line note — `Routed to {next_phase}.` Clear the active-session marker:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery active_session
```

Leave the commit to the conclude step (it sweeps these changes).

→ Load **[conclude-discovery.md](conclude-discovery.md)** and follow its instructions as written. It commits and hands off to `/workflow-{next_phase}-entry {work_type} {work_unit}` through the bridge.
