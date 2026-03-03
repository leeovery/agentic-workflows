# Bugfix Routing

*Reference for **[workflow-start](../SKILL.md)***

---

Bugfix work is investigation-centric. A work unit flows through: Investigation → Specification → Planning → Implementation → Review. Investigation replaces discussion by combining symptom gathering + code analysis. This reference shows in-progress bugfixes and offers options to continue or start new.

## Display Bugfix State

Using the discovery output, check if there are any bugfixes in progress.

#### If no bugfixes exist

> *Output the next fenced block as a code block:*

```
Bugfix Overview

No bugfixes in progress.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to start a new bugfix.

- **`y`/`yes`** — Start a new bugfix
- **`n`/`no`** — Go back to work type selection
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

Invoke `start-bugfix`. It will set `work_type: bugfix` automatically.

**If `no`:**

→ Return to **[the skill](../SKILL.md)** for **Step 2** (work type selection).

#### If bugfixes exist

> *Output the next fenced block as a code block:*

```
Bugfix Overview

{bugfix_count} bugfix(es) in progress:

1. {work_unit:(titlecase)}
   └─ {phase_label:(titlecase)}

2. ...
```

Build tree from `bugfixes.items` array. Each topic shows `name` (titlecased) and `phase_label` (titlecased).

## Build Menu Options

Build a numbered menu with all in-progress bugfixes plus option to start new. Use `phase_label` from discovery for the description.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

1. Continue "Login Timeout" — investigation (in-progress)
2. Continue "Memory Leak" — ready for specification
3. Continue "Race Condition" — ready for planning
4. Start new bugfix

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual work units and `phase_label` values from discovery.

**STOP.** Wait for user response.

## Route Based on Selection

Parse the user's selection, then follow the instructions below.

#### If `start new bugfix`

Invoke `/start-bugfix`. It will set `work_type: bugfix` and begin the investigation phase.

#### If continuing existing bugfix

Map `next_phase` to the appropriate skill:

| next_phase | Skill | Work Type | Work Unit |
|------------|-------|-----------|-----------|
| investigation | `/start-investigation` | bugfix | {work_unit} |
| specification | `/start-specification` | bugfix | {work_unit} |
| planning | `/start-planning` | bugfix | {work_unit} |
| implementation | `/start-implementation` | bugfix | {work_unit} |
| review | `/start-review` | bugfix | {work_unit} |

Skills receive positional arguments: `$0` = work_type, `$1` = work_unit.

**Example**: `/start-specification bugfix {work_unit}` — skill skips discovery, validates work unit, proceeds to processing.

Invoke the skill from the table with the work type and work unit as positional arguments.
