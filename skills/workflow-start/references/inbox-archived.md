# Inbox Archived

*Reference for **[workflow-start](../SKILL.md)***

---

View and manage items archived out of the inbox. Pick one item, then restore it, view it, or permanently delete it. Single-select only — one item at a time.

## A. Select

Run discovery for the current archived state — re-run on every entry so prior actions are reflected:

```bash
node .claude/skills/workflow-start/scripts/discovery.cjs
```

Read the `=== ARCHIVED ===` section.

#### If no archived items remain

> *Output the next fenced block as a code block:*

```
  No archived items.
```

→ Return to caller.

#### Otherwise

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Archived
●───────────────────────────────────────────────●

@foreach(item in archived_items sorted by date)
  {N}. {item.title} ({item.type}, {item.date})
@endforeach
```

Build a numbered list combining all archived ideas, bugs, and quick-fixes, sorted by date. Hold the number → item mapping (type, slug, date).

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Select an item (enter number, or **`b`/`back`** to return):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `b`/`back`:**

→ Return to caller.

**If user chose a number:**

Store the selected item and resolve its path `.workflows/.inbox/.archived/{type}/{date}--{slug}.md`.

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

Move the file back into its inbox folder and commit:

```bash
mkdir -p .workflows/.inbox/{type}/
mv .workflows/.inbox/.archived/{type}/{date}--{slug}.md .workflows/.inbox/{type}/
git add -- .workflows/.inbox/
git commit -m "workflow(inbox): restore {slug}"
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
git rm .workflows/.inbox/.archived/{type}/{date}--{slug}.md
git commit -m "workflow(inbox): delete {slug}"
```

> *Output the next fenced block as a code block:*

```
Deleted "{item.title}".
```

→ Return to **A. Select**.

#### If user chose `b`/`back`

→ Return to **A. Select**.
