# Select Cross-Cutting Concern

*Reference for **[continue-cross-cutting](../SKILL.md)***

---

## A. Display and Select

Display active cross-cutting concerns and let the user select one.

> *Output the next fenced block as a code block:*

```
Continue Cross-Cutting

{count} cross-cutting concern(s) in progress:

@foreach(cc in cross_cutting)
  {N}. {cross_cutting.name:(titlecase)}
     └─ {cross_cutting.phase_label:(titlecase)}

@endforeach

@if(completed_count > 0 || cancelled_count > 0)
{completed_count} completed, {cancelled_count} cancelled.
@endif
```

Build from the discovery output's `cross_cutting` array. Each shows `name` (titlecased) and `phase_label` (titlecased). Blank line between each numbered item.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which cross-cutting concern would you like to continue?

1. Continue "{cross_cutting.name:(titlecase)}" — {cross_cutting.phase_label}
2. ...

@if(completed_count > 0 || cancelled_count > 0)
{N+1}. View completed & cancelled cross-cutting concerns
@endif
- **`m`/`manage`** — Manage a cross-cutting concern's lifecycle

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual cross-cutting concerns and `phase_label` values from discovery. No auto-select, even with one item.

**STOP.** Wait for user response.

#### If user chose a number

Store the selected cross-cutting concern's name as `work_unit`.

→ Return to caller.

#### If user chose "View completed & cancelled"

Set work_type filter = `cross-cutting`.

→ Load **[../../workflow-start/references/view-completed.md](../../workflow-start/references/view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.

#### If user chose `m`/`manage`

→ Load **[../../workflow-start/references/manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.
