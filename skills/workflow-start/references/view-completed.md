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

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {selected.name} status in-progress
```

**If `selected.status` was `cancelled`:**

Re-index completed artifacts that were removed during cancellation. For each indexed phase (research, discussion, investigation, specification), check the manifest for completed items:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get '{selected.name}.{phase}.*' status
```

For each item with status `completed`, resolve the artifact path by phase:
- research: `.workflows/{selected.name}/research/{topic}.md`
- discussion: `.workflows/{selected.name}/discussion/{topic}.md`
- investigation: `.workflows/{selected.name}/investigation/{topic}.md`
- specification: `.workflows/{selected.name}/specification/{topic}/specification.md`

```bash
node .claude/skills/workflow-knowledge/scripts/knowledge.cjs index {artifact_path}
```

If any index command fails, display the error but do not block — the reactivation is already recorded:

> *Output the next fenced block as a code block:*

```
⚑ Knowledge indexing warning
  {error details}
  The work unit is reactivated. Indexing can be retried later.
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
