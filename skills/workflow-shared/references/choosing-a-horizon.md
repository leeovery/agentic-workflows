# Choosing a Horizon

*Shared reference. Loaded by [backlogging.md](backlogging.md) and [postponing-the-topic.md](postponing-the-topic.md).*

---

The caller needs a horizon for what it is about to land. Set `{horizon}` and return.

## The Horizon

The horizon is the user's, never yours to pick. They have not named one, so the map decides how to ask for it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap state
```

#### If `horizons` is non-empty

Render the pick over them (its numbering follows the `horizons` order):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render horizon-pick
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If the answer is a number:**

Resolve the number against `horizons` — that is the horizon.

→ Return to caller.

**If the answer is `n/new`:**

The user names one instead: ask in prose which horizon it belongs to — a name is content, not a choice — and **STOP.** Wait for user response.

→ Return to caller.

**Otherwise:**

The user named a horizon in words rather than picking a row — a label already on the map, or a new one. That is `{horizon}`.

→ Return to caller.

#### Otherwise

There is no roadmap yet, or it holds no horizons, so there is nothing to pick from. Ask in prose which horizon it belongs to, in the user's own staging words — launch, v1, someday.

**STOP.** Wait for user response.

→ Return to caller.
