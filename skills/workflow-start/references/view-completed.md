# View Completed & Cancelled

*Reference for **[workflow-start](../SKILL.md)***

---

Display completed and cancelled work units from discovery output.

## A. Display List

#### If no completed or cancelled work units exist

> *Output the next fenced block as a code block:*

```
No completed or cancelled work units found.
```

→ Return to caller.

#### Otherwise

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Completed & Cancelled
●───────────────────────────────────────────────●

@if(work_type_filter) Showing: {work_type_filter:(titlecase)}s @endif

@if(completed.length > 0)
Completed:
@foreach(item in completed)
  {N}. {item.name:(titlecase)}
     └─ Completed after: {item.last_phase}

@endforeach
@endif

@if(cancelled.length > 0)
Cancelled:
@foreach(item in cancelled)
  {N}. {item.name:(titlecase)}
     └─ Cancelled during: {item.last_phase}

@endforeach
@endif
```

Build from the completed and cancelled sections in the discovery output. Numbering is continuous across both sections. Blank line between each numbered item.

→ Proceed to **B. Select**.

## B. Select

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Select a work unit for details, or **`b`/`back`** to return.

Select an option (enter number):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose a number

Store the selected item.

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
