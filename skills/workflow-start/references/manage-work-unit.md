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
@foreach(unit in features.work_units)
  {N}. {unit.name:(titlecase)}
@endforeach
@endif

@if(bugfix_count > 0)
Bugfixes:
@foreach(unit in bugfixes.work_units)
  {N}. {unit.name:(titlecase)}
@endforeach
@endif

@if(quickfix_count > 0)
Quick Fixes:
@foreach(unit in quick_fixes.work_units)
  {N}. {unit.name:(titlecase)}
@endforeach
@endif

@if(cross_cutting_count > 0)
Cross-Cutting:
@foreach(unit in cross_cutting.work_units)
  {N}. {unit.name:(titlecase)}
@endforeach
@endif

@if(epic_count > 0)
Epics:
@foreach(unit in epics.work_units)
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
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {selected.name}.planning
```

#### If `selected.work_type` is `feature`

Default `has_spec` = false, `has_discussion` = false, `has_in_progress_epics` = false.

Check whether the specification phase exists and store the result as `has_spec`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {selected.name}.specification
```

Check whether the discussion phase exists and store the result as `has_discussion`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {selected.name}.discussion
```

List in-progress epics:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs list --status in-progress --work-type epic
```

If the result is a non-empty JSON array, set `has_in_progress_epics` = true and store the array as `available_epics`.

→ Proceed to **C. Implementation Check**.

#### Otherwise

→ Proceed to **C. Implementation Check**.

## C. Implementation Check

Check whether the implementation phase exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {selected.name}.implementation
```

#### If the implementation phase does not exist

→ Proceed to **E. Action Menu**.

#### If the implementation phase exists

→ Proceed to **D. Completion Check**.

## D. Completion Check

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get '{selected.name}.implementation.*' status
```

This returns all topic statuses in the implementation phase.

#### If any result has `"value": "completed"`

Set `implementation_completed` = true.

→ Proceed to **E. Action Menu**.

#### Otherwise

→ Proceed to **E. Action Menu**.

## E. Action Menu

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

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {selected.name} status completed
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {selected.name} completed_at $(date +%Y-%m-%d)
```

Commit: `workflow({selected.name}): mark as completed`

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" marked as completed.
```

→ Return to caller.

#### If user chose `p`/`pivot`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {selected.name} work_type epic
```

Re-index all completed artifacts so their chunks carry the new `work_type: epic`:

Load **[reindex-work-unit.md](../../workflow-knowledge/references/reindex-work-unit.md)** with work_unit = `{selected.name}`.

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

Invoke the `/continue-epic` skill. This is terminal — do not return to the caller.

**If user chose `b`/`back`:**

→ Return to caller.

#### If user chose `a`/`absorb`

→ Load **[absorb-into-epic.md](absorb-into-epic.md)** and follow its instructions as written.

→ Return to caller.

#### If user chose `v`/`view-plan`

→ Load **[view-plan.md](view-plan.md)** and follow its instructions as written.

→ Return to **E. Action Menu**.

#### If user chose `c`/`cancel`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {selected.name} status cancelled
```

Remove the cancelled work unit's chunks from the knowledge base:

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {selected.name}
```

If the remove command fails, display the error but do not block — the cancellation itself is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge removal warning
  {error details}
  The work unit is cancelled. You can run knowledge remove manually later.
```

Commit: `workflow({selected.name}): mark as cancelled`

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" marked as cancelled.
```

→ Return to caller.

#### If user chose `b`/`back`

→ Return to caller.

#### If user asked a question

Answer the question.

→ Return to **E. Action Menu**.
