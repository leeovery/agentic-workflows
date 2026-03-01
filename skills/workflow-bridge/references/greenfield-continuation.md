# Greenfield Continuation

*Reference for **[workflow-bridge](../SKILL.md)***

---

Present greenfield state, let the user choose what to do next, then enter plan mode with that specific choice.

Greenfield is phase-centric — all artifacts in a phase complete before moving to the next. Unlike feature/bugfix pipelines, greenfield doesn't route to a single next phase. Instead, present what's actionable across all phases and let the user choose.

## A. Display State

Using the discovery output, build the phase-centric view.

> *Output the next fenced block as a code block:*

```
Greenfield — {completed_phase:(titlecase)} Complete

"{topic:(titlecase)}" {completed_phase} has concluded.

Research:
@if(research.count > 0)
  @foreach(file in research.files)
  └─ {file}
  @endforeach
@else
  (none)
@endif

Discussions:
@if(discussions.count > 0)
  @foreach(disc in discussions.files)
  └─ {disc.name:(titlecase)} ({disc.status})
  @endforeach
@else
  (none)
@endif

Specifications:
@if(specifications.count > 0)
  @foreach(spec in specifications.files)
  └─ {spec.name:(titlecase)}
     └─ Spec: {spec.status} ({spec.type})
     └─ Plan: @if(spec.has_plan) exists @else (no plan) @endif
  @endforeach
@else
  (none)
@endif

Plans:
@if(plans.count > 0)
  @foreach(plan in plans.files)
  └─ {plan.name:(titlecase)}
     └─ Plan: {plan.status}
     └─ Implementation: @if(plan.has_implementation) exists @else (not started) @endif
  @endforeach
@else
  (none)
@endif

Implementation:
@if(implementation.count > 0)
  @foreach(impl in implementation.files)
  └─ {impl.topic:(titlecase)}
     └─ Implementation: {impl.status}
     └─ Review: @if(impl.has_review) exists @else (no review) @endif
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

**Specification phase is different in greenfield**: Don't offer "Start specification from {topic}". Instead, when concluded discussions exist, offer "Start specification" which invokes `/start-specification greenfield`. Don't pass a topic. Always route through discovery mode so analysis can detect changed discussions.

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

Recreate with actual topics and states from discovery. Only include options that apply based on current state.

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

| Selection | Skill | Work Type | Topic |
|-----------|-------|-----------|-------|
| Continue discussion | `/start-discussion` | greenfield | {topic} |
| Continue specification | `/start-specification` | greenfield | — |
| Continue plan | `/start-planning` | greenfield | {topic} |
| Continue implementation | `/start-implementation` | greenfield | {topic} |
| Continue research | `/start-research` | greenfield | — |
| Start specification | `/start-specification` | greenfield | — |
| Start planning for {topic} | `/start-planning` | greenfield | {topic} |
| Start implementation of {topic} | `/start-implementation` | greenfield | {topic} |
| Start review for {topic} | `/start-review` | greenfield | {topic} |
| Start new research | `/start-research` | greenfield | — |
| Start new discussion | `/start-discussion` | greenfield | — |

Skills receive positional arguments: `$0` = work_type, `$1` = topic.

**With arguments** (bridge mode): `/start-discussion greenfield {topic}` — skill skips discovery, validates topic, proceeds to processing.

**Without arguments** (discovery mode): `/start-discussion greenfield` — skill runs discovery with work_type context.

→ Proceed to **D. Enter Plan Mode**.

---

## D. Enter Plan Mode

#### If topic is present

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Greenfield: {selected_phase:(titlecase)}

Continue {selected_phase} for "{selected_topic}".

## Next Step

Invoke `/start-{selected_phase} greenfield {selected_topic}`

Arguments: work_type = greenfield, topic = {selected_topic}
The skill will skip discovery and proceed directly to validation.

## How to proceed

Clear context and continue.
```

#### If topic is absent

Call the `EnterPlanMode` tool to enter plan mode. Then write the following content to the plan file:

```
# Continue Greenfield: {selected_phase:(titlecase)}

Start {selected_phase} phase.

## Next Step

Invoke `/start-{selected_phase} greenfield`

Arguments: work_type = greenfield
The skill will run discovery with greenfield context.

## How to proceed

Clear context and continue.
```

Call the `ExitPlanMode` tool to present the plan to the user for approval. The user will then clear context and continue.
