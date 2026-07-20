# Manage Work Unit

*Reference for **[workflow-start](../SKILL.md)***

---

Manage an in-progress work unit's lifecycle.

## A. Select

Render the manage selection snapshot:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs manage
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: the `UNITS` table — one line per work unit, `n  work_type  work_unit`, numbering matching the overview. Reason from it; never display or restate it.
- **DISPLAY** — the numbered work-unit list by type. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the selection prompt. Emit verbatim as markdown (not a code block).

Emit the DISPLAY section, then the MENU section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

**STOP.** Wait for user response.

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose a number

Store the selected work unit's `UNITS` row — its name and work type.

→ Proceed to **B. Action Menu**.

## B. Action Menu

Render the selected work unit's manage snapshot:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs manage {selected.name}
```

The response carries demarcated sections:

- **DATA** — reasoning surface: lifecycle flags (`implementation_completed`, `has_plan`, `absorb_available`, …), `available_epics`, `planning_topics`, and the `ACTIONS` key table. Reason from it; never display or restate it.
- **MENU** — the action menu, offering exactly the actions this work unit's state allows. Emit verbatim as markdown (not a code block) at this section's gate below.
- **Labelled sections** (`MENU: absorb target`, `MENU: plan topics`) — deferred: each is emitted only at the gate its marker names (inside **[absorb-into-epic.md](absorb-into-epic.md)** / **[view-plan.md](view-plan.md)**), never here.

> *Output the next fenced block as markdown (not a code block):*

```
> Lifecycle actions for this work unit. Done marks it finished,
> cancel abandons it, pivot converts a feature to an epic when the
> scope grows beyond a single topic, absorb merges a feature's
> discussion into an existing epic.
```

Emit the MENU section.

**STOP.** Wait for user response.

A branch below can only be chosen when the menu offered its option.

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

→ Return to **B. Action Menu**.

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

→ Return to **B. Action Menu**.
