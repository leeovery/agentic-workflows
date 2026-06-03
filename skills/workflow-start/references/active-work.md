# Active Work

*Reference for **[workflow-start](../SKILL.md)***

---

Display all active work and present a unified menu for continuing or starting work.

## A. Display and Menu

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Workflow Overview
●───────────────────────────────────────────────●

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

@if(quickfix_count > 0)
Quick Fixes:
@foreach(unit in quick_fixes.work_units)
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

Inbox: {inbox_hint}
@endif

@if(completed_count > 0 || cancelled_count > 0)
{completed_count} completed, {cancelled_count} cancelled.
@endif
```

Build from discovery output. Only show sections that have work units. Numbering is continuous across sections. Feature/bugfix shows `phase_label` (titlecased). Epic shows comma-separated `active_phases` (titlecased). Blank line between each numbered item.

`{inbox_hint}` is a one-line count, not the items themselves — comma-separated non-zero categories from `inbox.idea_count` / `inbox.bug_count` / `inbox.quickfix_count`, pluralised (e.g. `10 ideas, 4 bugs, 3 quick-fixes`; `1 idea`). The `i`/`inbox` option opens the full list to pick from — keeping a project with many inbox items from flooding this menu.

## Menu

Build the menu with numbered continue items first, then command options for start-new and lifecycle actions, separated by blank lines.

> *Output the next fenced block as markdown (not a code block):*

```
> Numbered items continue existing work. Letter commands below
> start something new or manage lifecycle.

· · · · · · · · · · · ·
What would you like to do?

- **`1`** — Continue "{feature.name:(titlecase)}" — feature, {feature.phase_label}
- **`2`** — Continue "{bugfix.name:(titlecase)}" — bugfix, {bugfix.phase_label}
- **`3`** — Continue "{quickfix.name:(titlecase)}" — quick-fix, {quickfix.phase_label}
- **`4`** — Continue "{cross_cutting.name:(titlecase)}" — cross-cutting, {cross_cutting.phase_label}
- **`5`** — Continue "{epic.name:(titlecase)}" — epic

- **`s`/`start`** — Start something new (not sure what kind yet)
- **`f`/`feature`** — Start new feature
- **`e`/`epic`** — Start new epic
- **`b`/`bugfix`** — Start new bugfix
- **`q`/`quick-fix`** — Start new quick-fix
- **`c`/`cross-cutting`** — Start new cross-cutting concern
@if(has_inbox)
- **`i`/`inbox`** — View the inbox and start from an item
@endif
@if(completed_count > 0 || cancelled_count > 0)
- **`v`/`view`** — View completed & cancelled work units
@endif
- **`m`/`manage`** — Manage a work unit's lifecycle

Select an option:
· · · · · · · · · · · ·
```

**Continue items:** Same visual style as command options — `- **`N`** — description`. Feature/bugfix/cross-cutting shows type + phase label. Epic just shows "epic" (detail is in workflow-continue-epic). No auto-select — always show the full menu. No "(recommended)" labels.

**Command options:** Start-new, inbox, view, and manage are always command options (not numbered). Always show all six start options (`s` plus the five typed picks).

Recreate with actual work units from discovery.

**STOP.** Wait for user response.

#### If user chose a continue option

Invoke the matching skill:

| Selection | Invoke |
|-----------|--------|
| Continue feature | `/workflow-continue-feature {work_unit}` |
| Continue bugfix | `/workflow-continue-bugfix {work_unit}` |
| Continue quick-fix | `/workflow-continue-quickfix {work_unit}` |
| Continue cross-cutting | `/workflow-continue-cross-cutting {work_unit}` |
| Continue epic | `/workflow-continue-epic {work_unit}` |

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

#### If user chose a start-new option (`s`, `f`, `e`, `b`, `q`, or `c`)

Set the work-type pre-seed from the pick — `s` → `none`, otherwise the matching type (feature / epic / bugfix / quick-fix / cross-cutting).

→ Load **[route-to-discovery.md](route-to-discovery.md)** with work_type = `{work_type}`, inbox_seeds = `none`.

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
