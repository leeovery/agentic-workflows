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

@if(completed_count > 0 || cancelled_count > 0)
{completed_count} completed, {cancelled_count} cancelled.
@endif
```

Build from the discovery output's `epics` array. Each epic shows `name` (titlecased) and a comma-separated list of `active_phases` (titlecased). Blank line between each numbered item.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which epic would you like to continue?

1. Continue "{epic.name:(titlecase)}"
2. ...

@if(completed_count > 0 || cancelled_count > 0)
{N+1}. View completed & cancelled epics
@endif
- **`m`/`manage`** — Manage an epic's lifecycle

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual epics from discovery. No auto-select, even with one item.

**STOP.** Wait for user response.

#### If user chose an epic number

Store the selected epic's name as `work_unit`.

→ Return to **[the skill](../SKILL.md)**.

#### If user chose "View completed & cancelled"

→ Load **[../../workflow-start/references/view-completed.md](../../workflow-start/references/view-completed.md)** with work_type filter = `epic`. On return, re-run discovery and redisplay from the top of this reference.

#### If user chose `m`/`manage`

→ Load **[../../workflow-start/references/manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)**. On return, re-run discovery and redisplay from the top of this reference.
