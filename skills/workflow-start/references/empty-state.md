# Empty State

*Reference for **[workflow-start](../SKILL.md)***

---

No active work found. Offer to start something new.

> *Output the next fenced block as a code block:*

```
Workflow Overview

No active work found.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to start?

1. **Feature** — add functionality to an existing product
2. **Epic** — large initiative, multi-topic, multi-session
3. **Bugfix** — fix broken behavior

Select an option (enter number):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Invoke the selected skill:

| Selection | Invoke |
|-----------|--------|
| Feature | `/start-feature` |
| Epic | `/start-epic` |
| Bugfix | `/start-bugfix` |

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
