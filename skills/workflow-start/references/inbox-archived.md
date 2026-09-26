# Inbox Archived

*Reference for **[workflow-start](../SKILL.md)***

---

View and manage items archived out of the inbox. Pick one item, then restore it, view it, or permanently delete it. Single-select only — one item at a time.

## A. Select

Render the archived snapshot — re-run on every entry so prior actions are reflected:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs archived
```

The output is one snapshot in demarcated sections:

- **DATA** — reasoning surface: `archived_count` and the `ITEMS` table — one line per item, `n  type  date  slug  → path  — title`. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim per its marker.
- **MENU** — the archived items as a numbered pick list. Emit verbatim per its marker. Absent when nothing is archived.
- **DISPLAY** — only when nothing is archived: the empty-store line. Emit verbatim per its marker.

Emit the TITLE section verbatim per its marker.

#### If `archived_count` is 0

Emit the DISPLAY section verbatim per its marker.

→ Return to caller.

#### Otherwise

Emit the MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If user chose `b/back`:**

→ Return to caller.

**If user chose a number:**

Store the selected item's `ITEMS` row — its type, slug, date, path, and title.

→ Proceed to **B. Action Menu**.

## B. Action Menu

Fetch the menu over the selected item and emit its `MENU: archived actions` section verbatim per its marker:

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

> *Output the next fenced block as a text code block (```text fence):*

```text
Restored "{item.title}" to the inbox.
```

→ Return to **A. Select**.

#### If user chose `d/delete`

Confirm before deleting — fetch the gate and emit its `MENU: archived delete gate` section verbatim per its marker:

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

> *Output the next fenced block as a text code block (```text fence):*

```text
Deleted "{item.title}".
```

→ Return to **A. Select**.

#### If user chose `b/back`

→ Return to **A. Select**.
