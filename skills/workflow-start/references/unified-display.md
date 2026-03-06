# Unified Display

*Reference for **[workflow-start](../SKILL.md)***

---

Single-step unified router. Show all state, present menu, route to start/continue skills.

## Display

#### If `state.has_any_work` is false

> *Output the next fenced block as a code block:*

```
Workflow Overview

No active work found.
```

→ Proceed to **A. Empty State Menu**.

#### If `state.has_any_work` is true

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

@if(epic_count > 0)
Epics:
@foreach(unit in epics.work_units)
  {N}. {unit.name:(titlecase)}
     └─ {unit.active_phases:(titlecase, comma-separated)}

@endforeach
@endif
```

Build from discovery output. Only show sections that have work units. Numbering is continuous across sections. Feature/bugfix shows `phase_label` (titlecased). Epic shows comma-separated `active_phases` (titlecased). Blank line between each numbered item.

→ Proceed to **B. Active Work Menu**.

---

## A. Empty State Menu

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

Route based on selection:

| Selection | Invoke |
|-----------|--------|
| Feature | `/start-feature` |
| Epic | `/start-epic` |
| Bugfix | `/start-bugfix` |

Invoke the selected skill. This is terminal.

---

## B. Active Work Menu

Build a numbered menu with continue items first, then start-new options separated by a blank line.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

1. Continue "{feature.name:(titlecase)}" — feature, {feature.phase_label}
2. Continue "{bugfix.name:(titlecase)}" — bugfix, {bugfix.phase_label}
3. Continue "{epic.name:(titlecase)}" — epic

4. Start new feature
5. Start new epic
6. Start new bugfix

Select an option (enter number):
· · · · · · · · · · · ·
```

**Continue items:** Feature/bugfix shows type + phase label. Epic just shows "epic" (detail is in continue-epic). No auto-select — always show the full menu. No "(recommended)" labels.

**Start-new items:** Always show all three start options.

Recreate with actual work units from discovery.

**STOP.** Wait for user response.

## Route Selection

| Selection | Invoke |
|-----------|--------|
| Continue feature | `/continue-feature {work_unit}` |
| Continue bugfix | `/continue-bugfix {work_unit}` |
| Continue epic | `/continue-epic {work_unit}` |
| Start new feature | `/start-feature` |
| Start new epic | `/start-epic` |
| Start new bugfix | `/start-bugfix` |

Invoke the selected skill. This is terminal.
