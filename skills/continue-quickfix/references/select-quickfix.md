# Select Quick-Fix

*Reference for **[continue-quickfix](../SKILL.md)***

---

## A. Display and Select

Display active quick-fixes and let the user select one.

> *Output the next fenced block as a code block:*

```
{count} quick-fix(es) in progress:

@foreach(quickfix in quick_fixes)
  {N}. {quickfix.name:(titlecase)}
     └─ {quickfix.phase_label:(titlecase)}

@endforeach

@if(completed_count > 0 || cancelled_count > 0)
{completed_count} completed, {cancelled_count} cancelled.
@endif
```

Build from the discovery output's `quick_fixes` array. Each quick-fix shows `name` (titlecased) and `phase_label` (titlecased). Blank line between each numbered item.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which quick-fix would you like to continue?

- **`1`** — Continue "{quickfix.name:(titlecase)}" — {quickfix.phase_label}
- **`2`** — ...

@if(completed_count > 0 || cancelled_count > 0)
- **`{N+1}`** — View completed & cancelled quick-fixes
@endif
- **`m`/`manage`** — Manage a quick-fix's lifecycle

Select an option:
· · · · · · · · · · · ·
```

Recreate with actual quick-fixes and `phase_label` values from discovery. No auto-select, even with one item.

**STOP.** Wait for user response.

#### If user chose a quick-fix number

Store the selected quick-fix's name as `work_unit`.

→ Return to caller.

#### If user chose "View completed & cancelled"

Set work_type filter = `quick-fix`.

→ Load **[../../workflow-start/references/view-completed.md](../../workflow-start/references/view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.

#### If user chose `m`/`manage`

→ Load **[../../workflow-start/references/manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.
