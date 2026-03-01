# Route Based on Scenario

*Reference for **[start-implementation](../SKILL.md)***

---

Discovery mode — use the discovery output from Step 1.

Use `state.scenario` from the discovery output to determine the path:

#### If scenario is `no_plans`

No plans exist yet.

> *Output the next fenced block as a code block:*

```
Implementation Overview

No plans found in .workflows/planning/

The implementation phase requires a plan.
Run /start-planning first to create a plan from a specification.
```

**STOP.** Do not proceed — terminal condition.

#### If scenario is `single_plan` or `multiple_plans`

Plans exist.

→ Return to **[the skill](../SKILL.md)**.
