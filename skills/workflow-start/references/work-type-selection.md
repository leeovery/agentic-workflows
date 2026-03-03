# Work Type Selection

*Reference for **[workflow-start](../SKILL.md)***

---

Present the current state and ask the user which work type they want to work on.

## Display State Overview

Using the discovery output, render the appropriate state display.

#### If `state.has_any_work` is false

> *Output the next fenced block as a code block:*

```
Workflow Overview

No existing work found. Ready to start fresh.
```

#### If `state.has_any_work` is true

Build the summary from `state` counts and work unit arrays. Only show sections with work.

> *Output the next fenced block as a code block:*

```
Workflow Overview

@if(epic_count > 0)
Epics:
@foreach(unit in epics.items)
  {N}. {unit.name:(titlecase)}
     └─ {unit.phase_label:(titlecase)}
@endforeach
@endif

@if(feature_count > 0)
Features:
@foreach(topic in features.items)
  {N}. {topic.name:(titlecase)}
     └─ {topic.phase_label:(titlecase)}
@endforeach
@endif

@if(bugfix_count > 0)
Bugfixes:
@foreach(topic in bugfixes.items)
  {N}. {topic.name:(titlecase)}
     └─ {topic.phase_label:(titlecase)}
@endforeach
@endif
```

Use values from `epics.items`, `features.items`, `bugfixes.items`.

## Ask Work Type

Collect actionable in-progress items: features/bugfixes where `next_phase` is not `done` or `unknown`. These become continue options in the menu.

#### If actionable in-progress items exist

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to work on?

1. **Continue "{work_unit:(titlecase)}"** — {work_type}, {phase_label}

2. **Large initiative** — MVP, new build, or multi-spec work
3. **Start a feature** — New feature work
4. **Fix a bug** — Start a new bugfix
· · · · · · · · · · · ·
```

Recreate with actual work units and `phase_label` values from discovery. Continue items show: `Continue "{work_unit:(titlecase)}" — {work_type}, {phase_label}`. Blank line separates continue options from start-new options.

#### If no actionable in-progress items

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to work on?

1. **Large initiative** — MVP, new build, or multi-spec work
2. **Start a feature** — New feature work
3. **Fix a bug** — Start a new bugfix
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

## Process Selection

#### If user selected a continue option

Route directly to the appropriate skill based on the work unit's `next_phase` and work type:

| next_phase | work_type | Skill |
|------------|-----------|-------|
| discussion | feature | `/start-discussion feature {work_unit}` |
| investigation | bugfix | `/start-investigation bugfix {work_unit}` |
| specification | feature/bugfix | `/start-specification {work_type} {work_unit}` |
| planning | feature/bugfix | `/start-planning {work_type} {work_unit}` |
| implementation | feature/bugfix | `/start-implementation {work_type} {work_unit}` |
| review | feature/bugfix | `/start-review {work_type} {work_unit}` |

Invoke the skill with positional arguments. This is terminal — do not return to the backbone.

#### If user selected a start-new option

Map the user's response to a work type:

- "Large initiative", "large", "initiative", "build", "epic", "mvp" → work type is **epic**
- "Start a feature", "feature" → work type is **feature**
- "Fix a bug", "bug", "fix", "bugfix" → work type is **bugfix**

If the response doesn't map clearly, ask for clarification.

→ Return to **[the skill](../SKILL.md)** with the selected work type.
