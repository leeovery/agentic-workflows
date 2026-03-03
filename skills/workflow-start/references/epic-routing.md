# Epic Routing

*Reference for **[workflow-start](../SKILL.md)***

---

Epic development is phase-centric. All artifacts in a phase complete before moving to the next. This reference shows what's actionable in each phase and offers options to continue existing work or start new.

## Display Epic State

Using the discovery output, build the phase-centric view.

> *Output the next fenced block as a code block:*

```
Epic Overview

@foreach(unit in epics.work_units)
{N}. {unit.name:(titlecase)}
   └─ {unit.phase_label:(titlecase)}
@endforeach

@if(epics.count == 0)
No epics in progress.
@endif
```

## Build Menu Options

Build a numbered menu of actionable items. The verb depends on the state:

| State | Verb |
|-------|------|
| Research (in-progress) | Continue research for |
| Ready for discussion | Start discussion for |
| Discussion (in-progress) | Continue discussion for |
| Ready for specification | Start specification for |
| Specification (in-progress) | Continue specification for |
| Ready for planning | Start planning for |
| Planning (in-progress) | Continue planning for |
| Ready for implementation | Start implementation of |
| Implementation (in-progress) | Continue implementation of |
| Ready for review | Start review for |
| No epics yet | Start new epic |

**Specification phase is different in epic**: Don't offer "Start specification from {work_unit}". Instead, when concluded discussions exist, offer "Start specification" which invokes `/start-specification`. The specification skill will analyze ALL concluded discussions and suggest groupings — multiple discussions may become one spec, or split differently.

**Specification readiness:**
- All discussions concluded → "Start specification" (recommended)
- Some discussions still in-progress → "Start specification" with note: "(some discussions still in-progress)"

Always include "Start new epic" as a final option.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

1. Continue "Auth Flow" discussion — in-progress
2. Continue "Data Model" specification — in-progress
3. Start planning for "User Profiles" — spec concluded
4. Continue "Caching" plan — in-progress
5. Start implementation of "Notifications" — plan concluded
6. Start specification — 3 discussions concluded (recommended)
7. Continue research
8. Start new epic

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual work units and states from discovery. Only include options that apply based on current state.

**STOP.** Wait for user response.

## Route Based on Selection

Parse the user's selection, then follow the instructions below the table to invoke the appropriate skill.

| Selection | Skill | Work Type | Work Unit |
|-----------|-------|-----------|-----------|
| Continue discussion | `/start-discussion` | epic | {work_unit} |
| Continue specification | `/start-specification` | epic | — |
| Continue plan | `/start-planning` | epic | {work_unit} |
| Continue implementation | `/start-implementation` | epic | {work_unit} |
| Continue research | `/start-research` | epic | — |
| Start specification | `/start-specification` | epic | — |
| Start planning | `/start-planning` | epic | {work_unit} |
| Start implementation | `/start-implementation` | epic | {work_unit} |
| Start review | `/start-review` | epic | {work_unit} |
| Start research | `/start-research` | epic | — |
| Start new epic | `/start-epic` | — | — |

Skills receive positional arguments: `$0` = work_type, `$1` = work_unit.

**With arguments** (bridge mode): `/start-discussion epic {work_unit}` — skill skips discovery, validates work unit, proceeds to processing.

**Without arguments** (discovery mode): `/start-discussion epic` — skill runs discovery with work_type context.

**Note on specification**: Unlike feature/bugfix pipelines, epic specification is NOT topic-centric. Don't pass a work unit. Always route through discovery mode so analysis can detect changed discussions.

Invoke the skill from the table with the work unit and work type as positional arguments. If no work unit or work type is shown, invoke the skill bare.
