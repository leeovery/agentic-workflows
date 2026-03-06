# Select Epic

*Reference for **[continue-epic](../SKILL.md)***

---

Select which epic to continue. Handles terminal conditions, work_unit validation, and user selection.

## A. Check for Terminal Conditions

#### If `count` is 0

> *Output the next fenced block as a code block:*

```
Continue Epic

No epics in progress.

Run /start-epic to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### If `work_unit` was provided but not found in epics array

> *Output the next fenced block as a code block:*

```
Continue Epic

No active epic named "{work_unit}" found.

Run /continue-epic to see available epics, or /start-epic to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

→ Proceed to **B. Route by Context**.

## B. Route by Context

#### If `work_unit` was provided and matched an epic

Store the matched epic's data (name, active_phases, detail). Skip display.

→ Return to **[the skill](../SKILL.md)**.

#### If `work_unit` was not provided

→ Proceed to **C. Display and Menu**.

## C. Display and Menu

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

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which epic would you like to continue?

1. Continue "{epic.name:(titlecase)}"
2. ...

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual epics from discovery. No auto-select, even with one item.

**STOP.** Wait for user response.

## Process Selection

Store the selected epic's data (name, active_phases, detail) for use in subsequent steps.

→ Return to **[the skill](../SKILL.md)**.
