# Epic Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Present epic state, let the user choose what to do next, then enter plan mode with that specific choice.

Epic is phase-centric — all artifacts in a phase complete before moving to the next. Unlike feature/bugfix pipelines, epic doesn't route to a single next phase. Instead, present what's actionable across all phases and let the user choose.

## A. Display State

Using the discovery output, build the phase-centric view. The `epic_detail` section contains per-phase items.

> *Output the next fenced block as a code block:*

```
Epic — {completed_phase:(titlecase)} Complete

"{work_unit:(titlecase)}" {completed_phase} has concluded.

Research:
@if(epic_detail.research)
  @foreach(item in epic_detail.research.items)
  └─ {item.name:(titlecase)} ({item.status})
  @endforeach
@else
  (none)
@endif

Discussions:
@if(epic_detail.discussion.items.length > 0)
  @foreach(item in epic_detail.discussion.items)
  └─ {item.name:(titlecase)} ({item.status})
  @endforeach
@else
  (none)
@endif

Specifications:
@if(epic_detail.specification.items.length > 0)
  @foreach(item in epic_detail.specification.items)
  └─ {item.name:(titlecase)} ({item.status})
  @endforeach
@else
  (none)
@endif

Plans:
@if(epic_detail.planning.items.length > 0)
  @foreach(item in epic_detail.planning.items)
  └─ {item.name:(titlecase)} ({item.status})
  @endforeach
@else
  (none)
@endif

Implementation:
@if(epic_detail.implementation.items.length > 0)
  @foreach(item in epic_detail.implementation.items)
  └─ {item.name:(titlecase)} ({item.status})
  @endforeach
@else
  (none)
@endif
```

→ Proceed to **B. Present Choices**.

---

## B. Present Choices

Build a numbered menu of actionable items. The verb depends on the state:

| State | Verb |
|-------|------|
| In-progress discussion | Continue |
| In-progress specification | Continue |
| Concluded spec (feature type), no plan | Start planning for |
| In-progress plan | Continue |
| Concluded plan, no implementation | Start implementation of |
| In-progress implementation | Continue |
| Completed implementation, no review | Start review for |
| Research exists | Continue research |

**Specification phase is different in epic**: Don't offer "Start specification from {item}". Instead, when concluded discussions exist, offer "Start specification" which invokes `/start-specification epic`. Don't pass an item name. Always route through discovery mode so analysis can detect changed discussions.

**Specification readiness:**
- All discussions concluded → "Start specification" (recommended)
- Some discussions still in-progress → "Start specification" with note: "(some discussions still in-progress)"

**Recommendation logic**: Mark one item as "(recommended)" based on phase completion state:
- All discussions concluded, no specifications exist → "Start specification (recommended)"
- All specifications (feature type) concluded, some without plans → first plannable spec "(recommended)"
- All plans concluded, some without implementations → first implementable plan "(recommended)"
- All implementations completed, some without reviews → first reviewable implementation "(recommended)"
- Otherwise → no recommendation (complete in-progress work first)

Always include "Start new research", "Start new discussion", and "Stop here" as final options.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do next?

1. Continue "Auth Flow" discussion — in-progress
2. Continue "Data Model" specification — in-progress
3. Start planning for "User Profiles" — spec concluded
4. Continue "Caching" plan — in-progress
5. Start implementation of "Notifications" — plan concluded
6. Start specification — 3 discussions concluded (recommended)
7. Continue research
8. Start new research
9. Start new discussion
10. Stop here — resume later with /workflow-start

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual items and states from discovery. Only include options that apply based on current state.

**STOP.** Wait for user response.

→ Proceed to **C. Route Selection**.

---

## C. Route Selection

#### If user chose `Stop here`

> *Output the next fenced block as a code block:*

```
Session Paused

To resume later, run /workflow-start — it will discover your
current state and present all available options.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

Map the selection to a skill invocation:

| Selection | Skill | Work Type | Item |
|-----------|-------|-----------|------|
| Continue discussion | `/start-discussion` | epic | {item} |
| Continue specification | `/start-specification` | epic | — |
| Continue plan | `/start-planning` | epic | {item} |
| Continue implementation | `/start-implementation` | epic | {item} |
| Continue research | `/start-research` | epic | — |
| Start specification | `/start-specification` | epic | — |
| Start planning for {item} | `/start-planning` | epic | {item} |
| Start implementation of {item} | `/start-implementation` | epic | {item} |
| Start review for {item} | `/start-review` | epic | {item} |
| Start new research | `/start-research` | epic | — |
| Start new discussion | `/start-discussion` | epic | — |

Skills receive positional arguments: `$0` = work_type, `$1` = work_unit.

**With arguments** (bridge mode): `/start-discussion epic {work_unit}` — skill skips discovery, validates work unit, proceeds to processing.

**Without arguments** (discovery mode): `/start-discussion epic` — skill runs discovery with work_type context.

→ Proceed to **D. Enter Plan Mode**.

---

## D. Enter Plan Mode

#### If item name is present

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Epic: {selected_phase:(titlecase)}

Continue {selected_phase} for "{work_unit}".

## Next Step

Invoke `/start-{selected_phase} epic {work_unit}`

Arguments: work_type = epic, work_unit = {work_unit}
The skill will skip discovery and proceed directly to validation.

## How to proceed

Clear context and continue.
```

#### If item name is absent

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Epic: {selected_phase:(titlecase)}

Start {selected_phase} phase.

## Next Step

Invoke `/start-{selected_phase} epic`

Arguments: work_type = epic
The skill will run discovery with epic context.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval. The user will then clear context and continue.
