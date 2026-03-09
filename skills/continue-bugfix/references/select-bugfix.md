# Select Bugfix

*Reference for **[continue-bugfix](../SKILL.md)***

---

Display active bugfixes and let the user select one.

> *Output the next fenced block as a code block:*

```
Continue Bugfix

{count} bugfix(es) in progress:

@foreach(bugfix in bugfixes)
  {N}. {bugfix.name:(titlecase)}
     └─ {bugfix.phase_label:(titlecase)}

@endforeach

@if(concluded_count > 0 || cancelled_count > 0)
{concluded_count} concluded, {cancelled_count} cancelled.
@endif
```

Build from the discovery output's `bugfixes` array. Each bugfix shows `name` (titlecased) and `phase_label` (titlecased). Blank line between each numbered item.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which bugfix would you like to continue?

1. Continue "{bugfix.name:(titlecase)}" — {bugfix.phase_label}
2. ...

@if(concluded_count > 0 || cancelled_count > 0)
{N+1}. View concluded & cancelled bugfixes
@endif
- **`m`/`manage`** — Manage a bugfix's lifecycle

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual bugfixes and `phase_label` values from discovery. No auto-select, even with one item.

**STOP.** Wait for user response.

#### If user chose a bugfix number

Store the selected bugfix's name as `work_unit`.

→ Return to **[the skill](../SKILL.md)**.

#### If user chose "View concluded & cancelled"

→ Load **[../../workflow-start/references/view-concluded.md](../../workflow-start/references/view-concluded.md)** with work_type filter = `bugfix`. On return, re-run discovery and redisplay from the top of this reference.

#### If user chose `m`/`manage`

→ Load **[../../workflow-start/references/manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)**. On return, re-run discovery and redisplay from the top of this reference.
