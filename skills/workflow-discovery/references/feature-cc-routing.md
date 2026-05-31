# Feature / Cross-Cutting Routing

*Reference for **[workflow-discovery](../SKILL.md)***

---

The endpoint for a feature or cross-cutting work unit: one routing decision, then hand off to the first phase. The work is already shaped and persisted — the manifest `description` and the session log carry the intent.

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

Hold the choice as `routing`.

→ Proceed to **B. Conclude**.

## B. Conclude

Finalise the session log carrier: replace the `(none)` **Conclusion** with a one-line note recording the routing (`Routed to {routing}.`). Clear the active-session marker and commit:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.discovery active_session
git add -- .workflows/{work_unit}/
git commit -m "discovery({work_unit}): conclude — route to {routing}"
```

If `git status` reports nothing to commit, skip the commit.

→ Proceed to **C. Route to First Phase**.

## C. Route to First Phase

Invoke the entry skill for the chosen routing:

| Routing | Invoke |
|---|---|
| research | `/workflow-research-entry {work_type} {work_unit}` |
| discussion | `/workflow-discussion-entry {work_type} {work_unit}` |

The entry skill reads the durable carrier (session log + manifest `description`) as its seed.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
