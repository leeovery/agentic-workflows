# View Completed & Cancelled

*Reference for **[workflow-start](../SKILL.md)***

---

Display completed and cancelled work units.

## A. Display List

Render the completed & cancelled snapshot — append the work-type filter when the caller set one:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs completed [{work_type_filter}]
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: the filter, counts, and the `UNITS` table — one line per work unit, `n  status  work_type  work_unit  last_phase`, numbering continuous across the completed and cancelled lists. Reason from it; never display or restate it.
- **DISPLAY** — the completed & cancelled list. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the selection prompt. Emit verbatim as markdown (not a code block). Empty when nothing matches.

Emit the DISPLAY section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

#### If `completed_count` and `cancelled_count` are both 0

→ Return to caller.

#### Otherwise

→ Proceed to **B. Select**.

## B. Select

Emit the MENU section.

**STOP.** Wait for user response.

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose a number

Store the selected work unit's `UNITS` row — its name and status.

→ Proceed to **C. Action Menu**.

## C. Action Menu

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**{selected.name:(titlecase)}** ({selected.status})

- **`r`/`reactivate`** — Set status back to in-progress
- **`b`/`back`** — Return to the list
- **Ask** — Ask a question about this work unit
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `r`/`reactivate`

Run the reactivate transaction — one command restores `status: in-progress`, clears a stale `completed_at`, re-indexes the work unit's knowledge-base chunks when it was cancelled (completed units retain theirs), and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit reactivate {selected.name}
```

The JSON response reports `previous_status`, `committed`, and `warnings`. If `warnings` is non-empty, display them — the reactivation is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {warning}
  Indexing can be retried later.
```

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" reactivated.
```

→ Return to caller.

#### If user chose `b`/`back`

→ Return to **A. Display List**.

#### If user asked a question

Answer the question.

→ Return to **C. Action Menu**.
