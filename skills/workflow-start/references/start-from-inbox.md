# Start from Inbox

*Reference for **[workflow-start](../SKILL.md)***

---

Select inbox items to work on, or manage what's been archived. Selecting one or more items builds a working set that carries into discovery; the folder pre-seeds a work-type hint (bugs → bugfix, quickfixes → quick-fix, ideas → none) and discovery confirms the shape.

## A. Display and Menu

Run discovery for the current inbox state — re-run on every entry so archive and unarchive changes are reflected:

```bash
node .claude/skills/workflow-start/scripts/discovery.cjs
```

Read the `=== INBOX ===` and `=== STATE ===` sections.

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Inbox
●───────────────────────────────────────────────●

@foreach(item in inbox_items sorted by date)
  {N}. {item.title} ({item.type}, {item.date})
@endforeach
```

Build a numbered list combining all ideas, bugs, and quick-fixes, sorted by date (oldest first). Hold the number → item mapping (each item's type, slug, and date) for the selection.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do?

- **`1`–`{N}`** — Select item(s) to work on (comma-separated for several)
@if(has_archived)
- **`a`/`archived`** — View archived items (restore or delete)
@endif
- **`b`/`back`** — Return
· · · · · · · · · · · ·
```

`{N}` is the inbox item count (`state.inbox_count`). Show the `a`/`archived` option only when `state.has_archived` is true.

**STOP.** Wait for user response.

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose `a`/`archived`

→ Load **[inbox-archived.md](inbox-archived.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.

#### If user chose one or more numbers

Build the **working set** from the chosen numbers. For each, resolve the inbox path `.workflows/.inbox/{folder}/{date}--{slug}.md` — `{folder}` is `ideas` / `bugs` / `quickfixes` by type — and hold its type and path.

→ Load **[inbox-working-set.md](inbox-working-set.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.
