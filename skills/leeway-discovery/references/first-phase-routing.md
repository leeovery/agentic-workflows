# First-Phase Routing

*Reference for **[leeway-discovery](../SKILL.md)***

---

The endpoint for single-phase work — feature, cross-cutting, bugfix, quick-fix. Determine the first phase, then conclude through the bridge. The work is already shaped and persisted; the manifest `description` and the session log carry the intent. Each type goes to a fixed first phase.

## A. Determine the First Phase

#### If work type is `feature` or `cross-cutting`

Set `next_phase` = `discussion`.

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
