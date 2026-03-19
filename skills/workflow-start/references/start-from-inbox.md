# Start from Inbox

*Reference for **[workflow-start](../SKILL.md)***

---

Select an inbox item and route to the appropriate start skill.

## A. Display Inbox Items

> *Output the next fenced block as a code block:*

```
Inbox

@foreach(item in inbox_items sorted by date)
{N}. {item.title} ({item.type}, {item.date})
@endforeach
```

Build a numbered list combining all ideas and bugs, sorted by date (oldest first). Each shows title, type (idea/bug), and date.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Select an item (enter number):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Proceed to **B. Load and Route**.

## B. Load and Route

Read the full content of the selected inbox file.

#### If selected item is a bug

Invoke `/start-bugfix` with the inbox file path as positional argument:

`/start-bugfix .workflows/inbox/bugs/{file}`

This skill ends. The invoked skill handles archival. Terminal.

#### If selected item is an idea

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What type of work unit?

- **`f`/`feature`** — Single-topic feature
- **`e`/`epic`** — Multi-topic initiative
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `f`/`feature`:**

Invoke `/start-feature .workflows/inbox/ideas/{file}`.

This skill ends. The invoked skill handles archival. Terminal.

**If `e`/`epic`:**

Invoke `/start-epic .workflows/inbox/ideas/{file}`.

This skill ends. The invoked skill handles archival. Terminal.
