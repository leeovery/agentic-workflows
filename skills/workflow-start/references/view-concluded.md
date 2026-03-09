# View Concluded & Cancelled

*Reference for **[workflow-start](../SKILL.md)***

---

Display concluded and cancelled work units. Self-contained — receives context from caller (concluded/cancelled arrays, optional work_type filter).

## A. Display List

#### If no concluded or cancelled work units exist

> *Output the next fenced block as a code block:*

```
No concluded or cancelled work units found.
```

→ Return to caller.

#### Otherwise

> *Output the next fenced block as a code block:*

```
Concluded & Cancelled @if(work_type_filter) {work_type_filter:(titlecase)}s @else Work Units @endif

@if(concluded.length > 0)
Concluded:
@foreach(item in concluded)
  {N}. {item.name:(titlecase)}
     └─ Concluded after: {item.last_phase}

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

Build from the concluded and cancelled arrays passed by the caller. Numbering is continuous across both sections. Blank line between each numbered item.

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

Store the selected item. → Proceed to **C. Action Menu**.

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
node .claude/skills/workflow-manifest/scripts/manifest.js set {selected.name} status in-progress
```

> *Output the next fenced block as a code block:*

```
"{selected.name:(titlecase)}" reactivated.
```

→ Return to caller to redisplay main view (re-run discovery, re-render from top).

#### If user chose `b`/`back`

→ Return to **A. Display List** (re-render with current data).

#### If user asked a question

Answer the question, then redisplay the action menu (section C).
