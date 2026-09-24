# Start from Inbox

*Reference for **[workflow-start](../SKILL.md)***

---

Select inbox items to work on, or manage what's been archived. Selecting one or more items builds a working set that carries into discovery; the folder pre-seeds a work-type hint (bugs → bugfix, quickfixes → quick-fix, ideas → none) and discovery confirms the shape.

## A. Display and Menu

Render the inbox pickup snapshot — re-run on every entry so archive and unarchive changes are reflected:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs inbox
```

The output is one snapshot in demarcated sections:

- **DATA** — reasoning surface: `inbox_count`, `has_archived`, and the `ITEMS` table — one line per item, `n  type  date  slug  → path`. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim per its marker, directly above the display.
- **DISPLAY** — the numbered inbox list, or the empty line when the inbox holds nothing. Emit verbatim per its marker. Never redraw, reflow, or trim it.
- **MENU** — the pickup menu, present only when the inbox holds items. Emit verbatim per its marker. The `a/archived` option renders only when the archived store has items.

Emit the TITLE section, then the DISPLAY section, each verbatim per its marker.

#### If `inbox_count` is 0

→ Return to caller.

#### Otherwise

Emit the MENU section verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

## B. Handle Selection

#### If user chose `b/back`

→ Return to caller.

#### If user chose `a/archived`

→ Load **[inbox-archived.md](inbox-archived.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.

#### If user chose one or more numbers

Build the **working set** from the chosen numbers — resolve each number to its `ITEMS` row and hold the row's type and path.

→ Load **[inbox-working-set.md](inbox-working-set.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.
