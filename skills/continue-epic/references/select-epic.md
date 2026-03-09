# Select Epic

*Reference for **[continue-epic](../SKILL.md)***

---

Display active epics and let the user select one.

> *Output the next fenced block as a code block:*

```
Continue Epic

{count} epic(s) in progress:

@foreach(epic in epics)
  {N}. {epic.name:(titlecase)}
     └─ {epic.active_phases:(titlecase, comma-separated)}

@endforeach
```

Build from the discovery output's `epics` array. Each epic shows `name` (titlecased) and a comma-separated list of `active_phases` (titlecased). Blank line between each numbered item.

After the tree display, if `concluded_count > 0` or `cancelled_count > 0`, add a summary line:

> *Output the next fenced block as a code block:*

```
{concluded_count} concluded, {cancelled_count} cancelled.
```

Only show this block if either count is non-zero.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which epic would you like to continue?

1. Continue "{epic.name:(titlecase)}"
2. ...

{N+1}. View concluded & cancelled epics
- **`m`/`manage`** — Manage an epic's lifecycle

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual epics from discovery. Only show "View concluded & cancelled" if `concluded_count > 0` or `cancelled_count > 0`. No auto-select, even with one item.

**STOP.** Wait for user response.

**If user chose an epic number:**

Store the selected epic's name as `work_unit`.

→ Return to **[the skill](../SKILL.md)**.

**If user chose "View concluded & cancelled":**

→ Load **[../../workflow-start/references/view-concluded.md](../../workflow-start/references/view-concluded.md)** with work_type filter = `epic`. On return, re-run discovery and redisplay from the top of this reference.

**If user chose `m`/`manage`:**

→ Load **[../../workflow-start/references/manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)**. On return, re-run discovery and redisplay from the top of this reference.
