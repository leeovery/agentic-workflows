# Epic Dependency Map

*Reference for **[continue-epic](../SKILL.md)***

---

Display two complementary views of the epic's cross-phase progress: a compact summary matrix and a detailed phase-by-phase tree. The caller provides:
- Discovery output from `continue-epic/scripts/discovery.cjs` (the `detail` object for the selected epic)
- `work_unit` — the epic's work unit name

---

## A. Compute Pipelines

Before rendering, derive the pipeline data from the discovery `detail` object. This section is not displayed to the user.

**Pipeline definition:** Each specification topic defines a pipeline. The pipeline name is the spec topic name. Additional virtual rows exist for unassigned discussions and promoted items.

**Per-pipeline data:**

| Column | Source | Icon logic |
|--------|--------|------------|
| disc | Count of sources for this spec (from `phases.specification[topic].sources`). Each source has `topic` and `status` fields. | `{N}✓` if all source discussions are completed. `{N}◐` if any source discussion is in-progress. `N` is the source count. |
| spec | `phases.specification[topic].status` | `✓` completed, `◐` in-progress, `○` not started |
| plan | Match by topic name in `phases.planning` | Same icons. Blank if no matching plan exists. |
| impl | Match by topic name in `phases.implementation` | Same icons. Blank if no matching impl exists. |
| rev | Match by topic name in `phases.review` | Same icons. Blank if no matching review exists. |

**Research summary:** Shared across all pipelines — shown as a standalone line, not a column. `✓` if all research items completed, `◐` if any in-progress, `○` if none exist.

**Unassigned row:** From `unaccounted_discussions`. Count of unaccounted discussions. `{N}✓` if all completed, `{N}◐` if any in-progress. Only the `disc` column is populated.

**Promoted row:** Spec items with status `promoted`. Show `promoted` in the spec column. Only the `disc` column (source count) and `spec` column are populated.

**Pipeline ordering:** Completed pipelines first (all phases ✓), then in-progress (earliest active phase first), then not-started.

**Phase-level status icon** (for detail view headers): `✓` if all items in that phase are completed, `◐` if any are in-progress or some are completed but not all, `○` if no items are completed. When pending topics from research exist, include them in the discussion count.

→ Proceed to **B. Summary Matrix**.

---

## B. Summary Matrix

#### If no phases have items (brand-new epic)

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Epic Map — {work_unit:(titlecase)}
●───────────────────────────────────────────────●

  No work started yet.
```

→ Proceed to **E. Back to Menu**.

#### If phases have items

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Epic Map — {work_unit:(titlecase)}
●───────────────────────────────────────────────●

  Research: {status_icon} ({completed} of {total})

@if(has_pipelines)
                       disc  spec  plan  impl  rev
@foreach(pipeline in pipelines)
  {pipeline.name:(left-padded)}  {disc}  {spec}  {plan}  {impl}  {rev}
@endforeach
@if(has_promoted)
  {promoted.name:(left-padded)}  {disc}  promoted
@endif
@if(has_unassigned)
  unassigned{padding}  {disc}
@endif
@else
  No pipelines yet — specifications define pipeline
  structure.
@if(has_unassigned)

  Unassigned discussions: {count}
@endif
@endif
```

**Display rules:**

- Research summary line: `Research: ✓ (2 of 2)` or `Research: ◐ (1 of 2)` or `Research: — (none)` if no research phase exists
- Column headers right-aligned, 6 characters per column with 2 spaces between
- Pipeline names left-aligned, padded to the longest pipeline name + 2 spaces before the first column
- Status cells use icons: `✓`, `◐`, `○`. Discussion column prefixes with count: `3✓`, `2◐`
- Blank cells (phase doesn't exist for this pipeline) use empty space
- `promoted` spans from the spec column onward
- Blank line between the research summary and the column headers
- If no specification items exist, show the "No pipelines yet" message. Still show unassigned discussion count if applicable.

→ Proceed to **C. Detail View**.

---

## C. Detail View

> *Output the next fenced block as a code block:*

```
  Detail
  ──────

@foreach(phase in [research, discussion, specification, planning, implementation, review])
@if(phase has items or (phase == discussion and pending_from_research exists))
  {phase:(titlecase)} {phase_status_icon} ({completed_count} of {total_count})
  │
@foreach(item in phase.items)
  @if(not last_in_phase) ├─ @else └─ @endif {item_status_icon} {item.name}
@if(phase == specification and item.sources)
@foreach(source in item.sources)
  │  @if(not last_source) ├─ @else └─ @endif ← {source.topic}
@endforeach
@endif
@if(phase == specification and item.status == 'promoted')
  │  └─ → promoted to {item.promoted_to}
@endif
@if(phase == implementation and item.current_phase)
  │  └─ Phase {item.current_phase}, {item.completed_tasks.length} task(s) completed
@endif
@endforeach
@if(phase == discussion and pending_from_research exists)
@foreach(topic in pending_from_research)
  @if(last_pending_topic) └─ @else ├─ @endif ○ {topic.name} [pending from research]
@endforeach
@endif

@endif
@endforeach
@if(has_unassigned_discussions)
  ⚑ Unassigned discussions:
@foreach(disc in unaccounted_discussions)
    ✓ {disc}
@endforeach

@endif
```

**Display rules:**

- Phase header: titlecased name, phase-level status icon, count in parens `({completed} of {total})`
- Status icons before item names: `✓` completed, `◐` in-progress, `○` not started
- Tree grammar: `├─` non-final, `└─` final within each phase
- Specification items show source discussions as `← {source-topic}` sub-items using tree grammar
- Promoted items show `→ promoted to {work_unit}` as a sub-item
- Implementation items show progress as a sub-item when in-progress
- Pending discussion topics from research appear at the end of the Discussion section with `○` and `[pending from research]`
- Blank line between phase sections
- Only show phases that have items (exception: Discussion appears if pending topics from research exist)
- Unassigned discussions section: `⚑` callout with each discussion listed. Separated from the last phase by a blank line. These are completed discussions so use `✓` icon.
- Item names in kebabcase as stored — these are technical identifiers

→ Proceed to **D. Insights**.

---

## D. Insights

Check all conditions below. Show all that apply. If none apply, skip this section entirely.

> *Output the next fenced block as a code block:*

Only output this block if at least one insight applies.

```
  Insights
  ────────

@foreach(insight in applicable_insights)
  ⚑ {insight.text}
@endforeach
```

**Insight conditions (check all, show all that apply):**

| Condition | Text |
|-----------|------|
| `pending_from_research` has items | `{N} topic(s) from research not yet discussed.` |
| `unaccounted_discussions` has items | `{N} completed discussion(s) not assigned to any specification.` |
| Any plan has `deps_blocking` entries | `{topic:(titlecase)} plan blocked by {dep_topic}@if(dep.internal_id):{internal_id}@endif.` (one line per blocked plan) |
| Critical path: an in-progress item whose completion unblocks 2+ downstream items in the same pipeline | `Critical path: completing {item.name} ({phase}) unblocks {N} downstream phase(s).` |

**Critical path computation:**
- For each in-progress item, count how many later phases have a matching item for the same pipeline (spec topic name). For discussion items, look up which spec(s) source them and count the spec's downstream phases. For spec items, count matching plan + impl + review. For plan items, count matching impl + review. For impl items, count matching review.
- The item with the highest downstream count is the critical path.
- Ties: pick the earliest-phase item.
- Only show if downstream count is 2 or more.

→ Proceed to **E. Back to Menu**.

---

## E. Back to Menu

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`b`/`back`** — Return to menu
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Return to caller.
