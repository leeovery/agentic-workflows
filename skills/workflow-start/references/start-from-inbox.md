# Start from Inbox

*Reference for **[workflow-start](../SKILL.md)***

---

Select an inbox item and route it into discovery. The folder pre-seeds the work type (bugs → bugfix, quickfixes → quick-fix, ideas → none); discovery confirms the shape and classifies ideas. The inbox file path is the seed — discovery reads it at its opener and the filename-slug becomes the suggested name.

## A. Display Inbox Items

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Inbox
●───────────────────────────────────────────────●

@foreach(item in inbox_items sorted by date)
{N}. {item.title} ({item.type}, {item.date})
@endforeach
```

Build a numbered list combining all ideas, bugs, and quick-fixes, sorted by date (oldest first). Each shows title, type (idea/bug/quick-fix), and date.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Select an item (enter number, or **`b`/`back`** to return):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose a number

→ Proceed to **B. Route to Discovery**.

## B. Route to Discovery

Set the pre-seed and seed path from the selected item's folder:

| Selected item | work_type | inbox_seed |
|---|---|---|
| bug | `bugfix` | `.workflows/.inbox/bugs/{file}` |
| quick-fix | `quick-fix` | `.workflows/.inbox/quickfixes/{file}` |
| idea | `(none)` | `.workflows/.inbox/ideas/{file}` |

→ Load **[route-to-discovery.md](route-to-discovery.md)** with work_type = `{work_type}`, inbox_seed = `{inbox_seed}`.
