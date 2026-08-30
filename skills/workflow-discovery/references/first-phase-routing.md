# First-Phase Routing

*Reference for **[workflow-discovery](../SKILL.md)***

---

The endpoint for single-phase work — feature, cross-cutting, bugfix, quick-fix. Determine the first phase, then conclude through the bridge. The work is already shaped and persisted; the manifest `description` and the session log carry the intent. Feature and cross-cutting choose their first phase — do we answer this by reading, by talking, or by measuring? — while bugfix and quick-fix go to a fixed first phase.

## A. Determine the First Phase

#### If work type is `feature` or `cross-cutting`

Propose the first phase from the shaping cues, then let the user confirm or flip:

- **research** — open feasibility / "how does X work" / "what's possible" unknowns the work hasn't resolved.
- **experiment** — the open question is empirical and decision-bearing: a claim or hunch that needs measuring against a real system before anything can be decided on it.
- **discussion** — the shape is clear and the open questions are trade-offs and decisions, not unknowns. For cross-cutting this is the usual spine (research and experiments are optional).

Derive the one-line read + reason (e.g. "The shape's clear and the open questions are trade-offs — I'd start with discussion."), write it to `.workflows/.cache/{work_unit}/discovery/first-phase.json` with the Write tool (`{"read": "…"}`), then render the choice and emit its MENU section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render first-phase-gate {work_unit} --file .workflows/.cache/{work_unit}/discovery/first-phase.json
```

**STOP.** Wait for user response.

Set `next_phase` to the choice (`research`, `experiment`, or `discussion`).

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
