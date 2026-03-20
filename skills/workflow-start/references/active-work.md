# Active Work

*Reference for **[workflow-start](../SKILL.md)***

---

Display all active work and present a unified menu for continuing or starting work.

## A. Display and Menu

> *Output the next fenced block as a code block:*

```
Workflow Overview

@if(feature_count > 0)
Features:
@foreach(unit in features.work_units)
  {N}. {unit.name:(titlecase)}
     └─ {unit.phase_label:(titlecase)}

@endforeach
@endif

@if(bugfix_count > 0)
Bugfixes:
@foreach(unit in bugfixes.work_units)
  {N}. {unit.name:(titlecase)}
     └─ {unit.phase_label:(titlecase)}

@endforeach
@endif

@if(cross_cutting_count > 0)
Cross-Cutting:
@foreach(unit in cross_cutting.work_units)
  {N}. {unit.name:(titlecase)}
     └─ {unit.phase_label:(titlecase)}

@endforeach
@endif

@if(epic_count > 0)
Epics:
@foreach(unit in epics.work_units)
  {N}. {unit.name:(titlecase)}
     └─ {unit.active_phases:(titlecase, comma-separated)}

@endforeach
@endif

@if(has_inbox)

Inbox:
@if(idea_count > 0)
  Ideas:
@foreach(idea in inbox.ideas)
    • {idea.title} — {idea.date}
@endforeach
@endif
@if(bug_count > 0)
  Bugs:
@foreach(bug in inbox.bugs)
    • {bug.title} — {bug.date}
@endforeach
@endif
@endif

@if(completed_count > 0 || cancelled_count > 0)
{completed_count} completed, {cancelled_count} cancelled.
@endif
```

Build from discovery output. Only show sections that have work units. Numbering is continuous across sections. Feature/bugfix shows `phase_label` (titlecased). Epic shows comma-separated `active_phases` (titlecased). Blank line between each numbered item.

## Menu

Build the menu with numbered continue items first, then command options for start-new and lifecycle actions, separated by blank lines.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

1. Continue "{feature.name:(titlecase)}" — feature, {feature.phase_label}
2. Continue "{bugfix.name:(titlecase)}" — bugfix, {bugfix.phase_label}
3. Continue "{cross_cutting.name:(titlecase)}" — cross-cutting, {cross_cutting.phase_label}
4. Continue "{epic.name:(titlecase)}" — epic

- **`f`/`feature`** — Start new feature
- **`e`/`epic`** — Start new epic
- **`b`/`bugfix`** — Start new bugfix
- **`c`/`cross-cutting`** — Start new cross-cutting concern
@if(has_inbox)
- **`i`/`inbox`** — Start from an inbox item
@endif
@if(completed_count > 0 || cancelled_count > 0)
- **`v`/`view`** — View completed & cancelled work units
@endif
- **`m`/`manage`** — Manage a work unit's lifecycle

Select an option (enter number or command):
· · · · · · · · · · · ·
```

**Continue items:** Feature/bugfix/cross-cutting shows type + phase label. Epic just shows "epic" (detail is in continue-epic). No auto-select — always show the full menu. No "(recommended)" labels.

**Command options:** Start-new, inbox, view, and manage are always command options (not numbered). Always show all three start options.

Recreate with actual work units from discovery.

**STOP.** Wait for user response.

#### If user chose a continue or start-new option

Invoke the selected skill:

| Selection | Invoke |
|-----------|--------|
| Continue feature | `/continue-feature {work_unit}` |
| Continue bugfix | `/continue-bugfix {work_unit}` |
| Continue cross-cutting | `/continue-cross-cutting {work_unit}` |
| Continue epic | `/continue-epic {work_unit}` |
| Start new feature | `/start-feature` |
| Start new epic | `/start-epic` |
| Start new bugfix | `/start-bugfix` |
| Start new cross-cutting | `/start-cross-cutting` |

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

#### If user chose `v`/`view`

→ Load **[view-completed.md](view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Menu**.

#### If user chose `i`/`inbox`

→ Load **[start-from-inbox.md](start-from-inbox.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.

#### If user chose `m`/`manage`

→ Load **[manage-work-unit.md](manage-work-unit.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Menu**.
