# Epic State Display and Menu

*Shared reference — consumed by continue-epic and workflow-bridge.*

---

Display the full phase-by-phase breakdown for the selected epic, then present an interactive menu of actionable items. The caller is responsible for providing:
- Discovery output from `continue-epic/scripts/discovery.js` (the `detail` object for the selected epic)
- `work_unit` — the epic's work unit name

This reference collects the user's selection and returns control to the caller. The caller decides what to do with the selection (invoke a skill directly, enter plan mode, etc.).

---

## A. State Display

#### If no phases have items (brand-new epic)

> *Output the next fenced block as a code block:*

```
{work_unit:(titlecase)}

No work started yet.
```

→ Proceed to **B. Menu**.

#### If phases have items

> *Output the next fenced block as a code block:*

```
{work_unit:(titlecase)}

@foreach(phase in phases where phase has items)
  {phase:(titlecase)}
@foreach(item in phase.items)
    └─ {item.name:(titlecase)} ({item.status})@if(phase is planning and item.format) [{item.format}]@endif@if(phase is planning and item.deps_blocking) (blocked)@endif
@if(phase is specification and item.sources)
       └─ {source.topic:(titlecase)} ({source.status})
@endif
@if(phase is implementation and item.completed_tasks)
       └─ {item.completed_tasks.length} task(s) completed@if(item.current_phase), phase: {item.current_phase}@endif
@endif
@endforeach

@endforeach
@if(recommendation)
{recommendation text}
@endif
```

**Display rules:**

- Phase headers as section labels (titlecased)
- Items under each phase use `└─` branches with titlecased names and parenthetical status
- Planning items show format in brackets and `(blocked)` if dependencies are blocking
- Specification items show their source discussions as a sub-tree beneath, one `└─` per source
- Source status: `(incorporated)` or `(pending)` from manifest
- Implementation items show task completion count and current phase if in-progress
- Phases with no items don't appear
- Blank line between phase sections

### Recommendations

Check the following conditions in order. Show the first that applies as a line within the code block, separated by a blank line from the last phase section. If none apply, no recommendation.

| Condition | Recommendation |
|-----------|---------------|
| In-progress items across multiple phases | No recommendation |
| Some discussions in-progress, some concluded | "Consider concluding remaining discussions before starting specification. The grouping analysis works best with all discussions available." |
| All discussions concluded, specs not started | "All discussions are concluded. Specification will analyze and group them." |
| Some specs concluded, some in-progress | "Concluding all specifications before planning helps identify cross-cutting dependencies." |
| Some plans concluded, some in-progress | "Completing all plans before implementation helps surface task dependencies across plans." |
| Reopened discussion that's a source in a spec | "{Spec} specification sources the reopened {Discussion} discussion. Once that discussion concludes, the specification will need revisiting to extract new content." |

→ Proceed to **B. Menu**.

---

## B. Menu

Build a numbered menu with three sections:

**Section 1 — In-progress items** (always first):
- Any item with status `in-progress` in any phase
- Format: `Continue "{topic:(titlecase)}" — {phase} (in-progress)`

**Section 2 — Next-phase-ready items:**
- From `next_phase_ready` in discovery output
- Concluded spec with no plan: `Start planning for "{topic:(titlecase)}" — spec concluded`
- Concluded plan with no implementation:
  - If `blocked`: `Start implementation of "{topic:(titlecase)}" — plan concluded (blocked by {dep_topics})`
  - Otherwise: `Start implementation of "{topic:(titlecase)}" — plan concluded`
- Completed implementation with no review: `Start review for "{topic:(titlecase)}" — implementation completed`
- Unaccounted discussions (from `unaccounted_discussions`): `Start specification — {N} discussion(s) not yet in a spec`
  - Only show if `gating.can_start_specification` is true (at least one concluded discussion)

**Section 3 — Standing options:**
- `Start new discussion topic` (always present)
- `Start new research` (always present)
- `Resume a concluded topic` (only shown when `concluded` items exist)
- `Stop here — resume later with /workflow-start` (always present)

**Phase-forward gating:**
- No "Start planning" unless `gating.can_start_planning` is true
- No "Start implementation" unless `gating.can_start_implementation` is true
- No "Start review" unless `gating.can_start_review` is true
- No "Start specification" unless `gating.can_start_specification` is true

**Recommendation marking:** Mark one item as `(recommended)` based on phase completion state:
- All discussions concluded, no specifications exist → "Start specification (recommended)"
- All feature-type specifications concluded, some without plans → first plannable spec "(recommended)"
- All plans concluded (and deps satisfied), some without implementations → first implementable plan "(recommended)"
- All implementations completed, some without reviews → first reviewable implementation "(recommended)"
- Otherwise → no recommendation (complete in-progress work first)

**Blocked items:** Items marked `blocked` in `next_phase_ready` are shown in the menu with their blocking reason but are **not selectable**. If the user picks a blocked item, explain why it's blocked and re-present the menu.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

1. Continue "Auth Flow" — discussion (in-progress)
2. Continue "Data Model" — specification (in-progress)
3. Start planning for "User Profiles" — spec concluded
4. Continue "Caching" — planning (in-progress)
5. Start implementation of "Notifications" — plan concluded (recommended)
6. Start specification — 3 discussion(s) not yet in a spec
7. Start new discussion topic
8. Start new research
9. Resume a concluded topic
10. Stop here — resume later with /workflow-start

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual items from discovery. Blank line between sections.

**STOP.** Wait for user response.

---

## C. Handle Selection

#### If user chose `Stop here`

> *Output the next fenced block as a code block:*

```
Session Paused

To resume later, run /workflow-start — it will discover your
current state and present all available options.
```

**STOP.** Do not proceed — terminal condition.

#### If user chose `Resume a concluded topic`

Store selection: `action = resume_concluded`.

→ Return to the caller.

#### Otherwise

Store the selected action, phase, and topic (if applicable). Map to a routing entry:

| Selection | Phase | Topic |
|-----------|-------|-------|
| Continue {topic} — discussion | discussion | {topic} |
| Continue {topic} — research | research | {topic} |
| Continue {topic} — specification | specification | {topic} |
| Continue {topic} — planning | planning | {topic} |
| Continue {topic} — implementation | implementation | {topic} |
| Start planning for {topic} | planning | {topic} |
| Start implementation of {topic} | implementation | {topic} |
| Start review for {topic} | review | {topic} |
| Start specification | specification | — |
| Start new discussion topic | discussion | — |
| Start new research | research | — |

→ Return to the caller with the selected phase and topic.
