# Manage Work Unit

*Reference for **[workflow-start](../SKILL.md)***

---

Manage an in-progress work unit's lifecycle.

## A. Select

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Manage
●───────────────────────────────────────────────●

@if(feature_count > 0)
Features:
@foreach(unit in the FEATURES section)
  {N}. {unit.name:(titlecase)}
@endforeach
@endif

@if(bugfix_count > 0)
Bugfixes:
@foreach(unit in the BUGFIXES section)
  {N}. {unit.name:(titlecase)}
@endforeach
@endif

@if(quickfix_count > 0)
Quick Fixes:
@foreach(unit in the QUICK-FIXES section)
  {N}. {unit.name:(titlecase)}
@endforeach
@endif

@if(cross_cutting_count > 0)
Cross-Cutting:
@foreach(unit in the CROSS-CUTTING section)
  {N}. {unit.name:(titlecase)}
@endforeach
@endif

@if(epic_count > 0)
Epics:
@foreach(unit in the EPICS section)
  {N}. {unit.name:(titlecase)}
@endforeach
@endif
```

Build from discovery output. Only show sections that have work units. Numbering is continuous across sections — same numbers as the overview.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Select a work unit (enter number, or **`b`/`back`** to return):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose a number

Store the selected work unit.

→ Proceed to **B. Pre-Checks**.

## B. Pre-Checks

Default `implementation_completed` = false, `has_plan` = false.

Check whether the planning phase exists and store the result as `has_plan`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {selected.name}.planning
```

#### If `selected.work_type` is `feature`

Default `has_spec` = false, `has_discussion` = false, `has_in_progress_epics` = false.

Check whether the specification phase exists and store the result as `has_spec`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {selected.name}.specification
```

Check whether the discussion phase exists and store the result as `has_discussion`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {selected.name}.discussion
```

List in-progress epics:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest list --status in-progress --work-type epic
```

If the result is a non-empty JSON array, set `has_in_progress_epics` = true and store the array as `available_epics`.

→ Proceed to **C. Implementation Check**.

#### Otherwise

→ Proceed to **C. Implementation Check**.

## C. Implementation Check

Read all topic statuses in the implementation phase:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get '{selected.name}.implementation.*' status
```

#### If output is empty (no implementation phase)

→ Proceed to **D. Action Menu**.

#### If any result has `"value": "completed"`

Set `implementation_completed` = true.

→ Proceed to **D. Action Menu**.

#### Otherwise

→ Proceed to **D. Action Menu**.

## D. Action Menu

> *Output the next fenced block as markdown (not a code block):*

```
> Lifecycle actions for this work unit. Done marks it finished,
> cancel abandons it, pivot converts a feature to an epic when the
> scope grows beyond a single topic, absorb merges a feature's
> discussion into an existing epic.

· · · · · · · · · · · ·
**{selected.name:(titlecase)}** ({selected.work_type})

@if(implementation_completed)
- **`d`/`done`** — Mark as completed
@endif
@if(selected.work_type == 'feature')
- **`p`/`pivot`** — Convert to epic (enables multiple topics)
@endif
@if(selected.work_type == 'feature' and !has_spec and has_discussion and has_in_progress_epics)
- **`a`/`absorb`** — Merge into an existing epic
@endif
@if(has_plan)
- **`v`/`view-plan`** — View the implementation plan
@endif
- **`c`/`cancel`** — Mark as cancelled
- **`b`/`back`** — Return
- **Ask** — Ask a question about this work unit
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `d`/`done`

Run the complete transaction — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {selected.name} -m "workflow({selected.name}): mark as completed"
```

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" marked as completed.
```

→ Return to caller.

#### If user chose `p`/`pivot`

Load **[pivot-to-epic.md](../../workflow-shared/references/pivot-to-epic.md)** with work_unit = `{selected.name}`.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{selected.name:(titlecase)}** converted from feature to epic.

- **`c`/`continue`** — Continue {selected.name:(titlecase)} as epic
- **`b`/`back`** — Return to previous view
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `c`/`continue`:**

Invoke the `/workflow-continue-epic` skill.

**STOP.** Do not proceed — terminal condition.

**If user chose `b`/`back`:**

→ Return to caller.

#### If user chose `a`/`absorb`

→ Load **[absorb-into-epic.md](absorb-into-epic.md)** and follow its instructions as written.

→ Return to caller.

#### If user chose `v`/`view-plan`

→ Load **[view-plan.md](view-plan.md)** and follow its instructions as written.

→ Return to **D. Action Menu**.

#### If user chose `c`/`cancel`

Run the cancel transaction — one command sets `status: cancelled`, removes the work unit's chunks from the knowledge base, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit cancel {selected.name}
```

The JSON response reports `status`, `committed`, and `warnings`. If `warnings` is non-empty, display them — the cancellation is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge removal warning
  {warning}
  The work unit is cancelled. The removal has been queued and will retry automatically on the next `knowledge remove` or `knowledge compact` call.
```

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" marked as cancelled.
```

→ Return to caller.

#### If user chose `b`/`back`

→ Return to caller.

#### If user asked a question

Answer the question.

→ Return to **D. Action Menu**.
