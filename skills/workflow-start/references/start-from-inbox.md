# Start from Inbox

*Reference for **[workflow-start](../SKILL.md)***

---

Select inbox items to work on, or manage what's been archived. Selecting one or more items builds a working set that carries into discovery; the folder pre-seeds a work-type hint (bugs → bugfix, quickfixes → quick-fix, ideas → none) and discovery confirms the shape.

## A. Display and Menu

Render the inbox pickup snapshot — re-run on every entry so archive and unarchive changes are reflected:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs inbox
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: `inbox_count`, `has_archived`, and the `ITEMS` table — one line per item, `n  type  date  slug  → path`. Reason from it; never display or restate it.
- **DISPLAY** — the numbered inbox list. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the pickup menu. Emit verbatim as markdown (not a code block). The `a`/`archived` option renders only when the archived store has items.

Emit the DISPLAY section, then the MENU section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

#### If `inbox_count` is 0

→ Return to caller.

#### Otherwise

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

## B. Handle Selection

#### If user chose `b`/`back`

→ Return to caller.

#### If user chose `a`/`archived`

→ Load **[inbox-archived.md](inbox-archived.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.

#### If user chose one or more numbers

Build the **working set** from the chosen numbers — resolve each number to its `ITEMS` row and hold the row's type and path.

→ Load **[inbox-working-set.md](inbox-working-set.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.
