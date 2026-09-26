# View Completed & Cancelled

*Reference for **[workflow-start](../SKILL.md)***

---

Display completed and cancelled work units.

## A. Display List

Render the completed & cancelled snapshot — append the work-type filter when the caller set one:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs completed [{work_type_filter}]
```

The output is one snapshot in demarcated sections:

- **DATA** — reasoning surface: the filter, counts, and the `UNITS` table — one line per work unit, `n  status  work_type  work_unit  last_phase`, numbering continuous across the completed and cancelled units. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim as markdown.
- **MENU** — the completed and cancelled units as a numbered pick list. Emit verbatim as markdown (not a code block). Absent when nothing matches.
- **DISPLAY** — only when nothing matches: the empty line. Emit verbatim as a code block.

Emit the TITLE section (markdown). A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

#### If `completed_count` and `cancelled_count` are both 0

Emit the DISPLAY section.

→ Return to caller.

#### Otherwise

→ Proceed to **B. Select**.

## B. Select

Emit the MENU section.

**STOP.** Wait for user response.

#### If user chose `b/back`

→ Return to caller.

#### If user chose a number

Store the selected work unit's name from its `UNITS` row.

→ Proceed to **C. Action Menu**.

## C. Action Menu

Fetch the action menu over the selected unit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render completed-actions {selected.name}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If user chose `r/reactivate`

Run the reactivate transaction — one command restores `status: in-progress`, clears a stale `completed_at`, re-indexes the work unit's knowledge-base chunks when it was cancelled (completed units retain theirs), and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit reactivate {selected.name}
```

Fetch and emit the receipt — the `DISPLAY: kb warning` advisory (when carried) then the `DISPLAY: confirmation` section — adding `--warn` when the response's `warnings` is non-empty:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render workunit-receipt {selected.name} --verb reactivate [--warn]
```

→ Return to caller.

#### If user chose `b/back`

→ Return to **A. Display List**.

#### If user asked a question

Answer the question.

→ Return to **C. Action Menu**.
