# Display State and Menu

*Reference for **[continue-epic](../SKILL.md)***

---

Display the full phase-by-phase breakdown for the selected epic, then present the interactive menu.

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
    └─ {item.name:(titlecase)} ({item.status})
@if(item.sources)
       └─ {source.topic:(titlecase)} ({source.status})
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
- Specification items show their source discussions as a sub-tree beneath, one `└─` per source
- Source status: `(incorporated)` or `(pending)` from manifest
- Phases with no items don't appear
- Blank line between phase sections

## Recommendations

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
- Concluded plan with no implementation: `Start implementation of "{topic:(titlecase)}" — plan concluded`
- Completed implementation with no review: `Start review for "{topic:(titlecase)}" — implementation completed`
- Unaccounted discussions (from `unaccounted_discussions`): `Start specification — {N} discussion(s) not yet in a spec`
  - Only show if `gating.can_start_specification` is true (at least one concluded discussion)

**Section 3 — Standing options:**
- `Start new discussion topic` (always present)
- `Start new research` (always present)
- `Resume a concluded topic` (only shown when `concluded` items exist)

**Phase-forward gating:**
- No "Start planning" unless `gating.can_start_planning` is true
- No "Start implementation" unless `gating.can_start_implementation` is true
- No "Start review" unless `gating.can_start_review` is true
- No "Start specification" unless `gating.can_start_specification` is true

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

1. Continue "{topic}" — {phase} (in-progress)
2. Start planning for "{topic}" — spec concluded
3. Start new discussion topic
4. Start new research
5. Resume a concluded topic

Select an option (enter number):
· · · · · · · · · · · ·
```

Recreate with actual items from discovery. Blank line between sections.

**STOP.** Wait for user response.

Store the selected action and topic for routing.

→ Return to **[the skill](../SKILL.md)**.
