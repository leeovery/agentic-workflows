# Display Epic State

*Reference for **[continue-epic](../SKILL.md)***

---

Display the full phase-by-phase breakdown for the selected epic, with contextual recommendations.

## State Display

#### If no phases have items (brand-new epic)

> *Output the next fenced block as a code block:*

```
{work_unit:(titlecase)}

No work started yet.
```

→ Return to **[the skill](../SKILL.md)**.

#### If phases have items

> *Output the next fenced block as a code block:*

```
{work_unit:(titlecase)}

@foreach(phase in phases where phase has items)
  {phase:(titlecase)}
@foreach(item in phase.items)
    └─ {item.name:(titlecase)} ({item.status})
@if(item.sources)
       ├─ {source.topic:(titlecase)} ({source.status})
       └─ {last_source.topic:(titlecase)} ({last_source.status})
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
- Specification items show their source discussions as a sub-tree beneath:
  - `├─` for non-last sources, `└─` for last
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

→ Return to **[the skill](../SKILL.md)**.
