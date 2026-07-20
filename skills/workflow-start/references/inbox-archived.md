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
- **DISPLAY** — the numbered archived list. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the selection prompt. Emit verbatim as markdown (not a code block). Empty when nothing is archived.

Emit the DISPLAY section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

#### If `archived_count` is 0

→ Return to caller.

#### Otherwise

Emit the MENU section.

**STOP.** Wait for user response.

**If user chose `b`/`back`:**

→ Return to caller.

**If user chose a number:**

Store the selected item's `ITEMS` row — its type, slug, date, and path.

→ Proceed to **B. Action Menu**.

## B. Action Menu

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Selected: {item.title} ({item.type}, archived)

- **`v`/`view`** — View full content
- **`u`/`unarchive`** — Restore to the inbox
- **`d`/`delete`** — Permanently delete (removes the file from git)
- **`b`/`back`** — Return to the archived list
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chose `v`/`view`

Read the file and render its full content.

> *Output the next fenced block as a code block:*

```
  ── {item.title} ({item.type}) ──

  {item.full_content}
```

→ Return to **B. Action Menu**.

#### If user chose `u`/`unarchive`

Move the file back into its inbox folder and commit — one command:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs inbox restore {item.path}
```

> *Output the next fenced block as a code block:*

```
Restored "{item.title}" to the inbox.
```

→ Return to **A. Select**.

#### If user chose `d`/`delete`

Deleting removes the file from the repo and cannot be undone — confirm first:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Permanently delete "{item.title}"? This removes the file from the
repo and cannot be undone.

- **`y`/`yes`** — Delete permanently
- **`n`/`no`** — Return
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `n`/`no`:**

→ Return to **B. Action Menu**.

**If user chose `y`/`yes`:**

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs inbox delete {item.path}
```

> *Output the next fenced block as a code block:*

```
Deleted "{item.title}".
```

→ Return to **A. Select**.

#### If user chose `b`/`back`

→ Return to **A. Select**.
