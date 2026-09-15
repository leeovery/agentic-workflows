# Inbox Archived

*Reference for **[workflow-start](../SKILL.md)***

---

View and manage items archived out of the inbox. Pick one item, then restore it, view it, or permanently delete it. Single-select only — one item at a time.

## A. Select

Render the archived snapshot — re-run on every entry so prior actions are reflected:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs archived
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: `archived_count` and the `ITEMS` table — one line per item, `n  type  date  slug  → path`. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim as markdown, directly above the display.
- **DISPLAY** — the numbered archived list. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the selection prompt. Emit verbatim as markdown (not a code block). Empty when nothing is archived.

Emit the TITLE section (markdown), then the DISPLAY section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

#### If `archived_count` is 0

→ Return to caller.

#### Otherwise

Emit the MENU section.

**STOP.** Wait for user response.

**If user chose `b/back`:**

→ Return to caller.

**If user chose a number:**

Store the selected item's `ITEMS` row — its type, slug, date, and path.

→ Proceed to **B. Action Menu**.

## B. Action Menu

Fetch the menu over the selected item and emit its `MENU: archived actions` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render archived-actions --path {item.path}
```

**STOP.** Wait for user response.

#### If user chose `v/view`

Read the file and render its full content — as markdown, not a code block, so the item's own headings and formatting render properly.

> *Output the next fenced block as markdown (not a code block):*

```
*[{item.type}] — {item.date}*

{item.full_content}
```

Emit the file content as-is — it is markdown and renders as such; its own `#` heading is the item's visible title. Skip a frontmatter block when one exists.

→ Return to **B. Action Menu**.

#### If user chose `u/unarchive`

Move the file back into its inbox folder and commit — one command:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs inbox restore {item.path}
```

> *Output the next fenced block as a code block:*

```
Restored "{item.title}" to the inbox.
```

→ Return to **A. Select**.

#### If user chose `d/delete`

Confirm before deleting — fetch the gate and emit its `MENU: archived delete gate` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render archived-delete-gate --path {item.path}
```

**STOP.** Wait for user response.

**If user chose `n/no`:**

→ Return to **B. Action Menu**.

**If user chose `y/yes`:**

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs inbox delete {item.path}
```

> *Output the next fenced block as a code block:*

```
Deleted "{item.title}".
```

→ Return to **A. Select**.

#### If user chose `b/back`

→ Return to **A. Select**.
