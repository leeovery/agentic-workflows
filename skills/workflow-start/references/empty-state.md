# Empty State

*Reference for **[workflow-start](../SKILL.md)***

---

No active work found. Offer to start something new, with option to view completed/cancelled work if any exist.

> *Output the next fenced block as a code block:*

```
Workflow Overview

No active work found.

@if(completed_count > 0 || cancelled_count > 0)
{completed_count} completed, {cancelled_count} cancelled.
@endif
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to start?

1. **Feature** — add functionality to an existing product
2. **Epic** — large initiative, multi-topic, multi-session
3. **Bugfix** — fix broken behavior

@if(has_inbox)
4. **Start from inbox** ({inbox_count} items)
@endif

@if(completed_count > 0 || cancelled_count > 0)
5. **View completed & cancelled work units**
@endif

Select an option (enter number):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose "Start from inbox"

→ Load **[start-from-inbox.md](start-from-inbox.md)** and follow its instructions as written.

→ Return to caller.

#### If user chose a start-new option

Invoke the selected skill:

| Selection | Invoke |
|-----------|--------|
| Feature | `/start-feature` |
| Epic | `/start-epic` |
| Bugfix | `/start-bugfix` |

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

#### If user chose "View completed & cancelled"

→ Load **[view-completed.md](view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to caller.
