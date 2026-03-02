# Route Based on Scenario

*Reference for **[start-planning](../SKILL.md)***

---

Discovery mode — use the discovery output from Step 1.

Use `state.scenario` from the discovery output to determine the path:

#### If scenario is `no_specs`

No specifications exist yet.

> *Output the next fenced block as a code block:*

```
Planning Overview

No specifications found in any active work unit.

The planning phase requires a concluded specification.
Run /start-specification first.
```

**STOP.** Do not proceed — terminal condition.

#### If scenario is `nothing_actionable`

Specifications exist but none are actionable — all are still in-progress and no plans exist to continue.

→ Return to **[the skill](../SKILL.md)**.

#### If scenario is `has_options`

At least one specification is ready for planning, or an existing plan can be continued or reviewed.

→ Return to **[the skill](../SKILL.md)**.
