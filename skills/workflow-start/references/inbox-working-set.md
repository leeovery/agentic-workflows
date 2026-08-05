# Inbox Working Set

*Reference for **[workflow-start](../SKILL.md)***

---

Build and act on a set of inbox items. The caller holds the **working set** — one or more items, each with a type and inbox path. Every action applies to the whole set; `d/drop` is the only way to narrow it. `w/work` carries the set into discovery as combined seed material.

## A. Render the Working Set

For each item in the set, read its file and synthesise a short summary — one or two sentences: what the item is and why it matters, in product terms (do not quote it verbatim). Write the summaries as one JSON object keyed by each item's inbox path to `.workflows/.cache/working-set-summaries.json`:

```json
{ "{path}": "{summary}", "{path}": "{summary}" }
```

Fetch the working-set snapshot — pass every held item's inbox path, in set order, plus the payload:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs working-set {path} [{path} …] --summaries .workflows/.cache/working-set-summaries.json
```

The response carries demarcated sections:

- **DATA** — reasoning surface: `set_uniform` / `set_type`, `addable_count`, and the `SET` and `ADDABLE` tables — one line per item, `n  type  date  slug  → path`. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim as markdown, directly above the display.
- **DISPLAY** — the set tree, summaries rendered beneath each item. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the set menu. Emit verbatim as markdown (not a code block). The `w/work` option renders only for a type-uniform set.
- **`DISPLAY: blocker`** — present only on a mixed-type set. Emit directly after the display, verbatim per its marker.
- **Labelled sections** (`DISPLAY: add candidates`, `MENU: add gate`, `DISPLAY: drop candidates`, `MENU: drop gate`) — deferred: each is emitted only at the gate its marker names (**B** / **C**), never here.

Emit the TITLE section (markdown), then the DISPLAY section, then the `DISPLAY: blocker` section when present, then the MENU section.

**STOP.** Wait for user response.

The user types a shorthand (`w`/`a`/`d`/`r`/`v`/`b`) **or** describes the action in their own words. Map the response to one branch below; a message that only asks about the set, naming no action, is `Ask`. When the phrasing also names items (*"add 2 and 4"*, *"drop the bug"*), carry that selection into the action so **B**/**C** apply it without re-prompting. `w/work` can only be chosen when the menu offered it (`set_uniform` is `true`).

#### If user chose `w/work`

→ Proceed to **F. Work the Set**.

#### If user chose `a/add`

→ Proceed to **B. Add Items**.

#### If user chose `d/drop`

→ Proceed to **C. Drop Items**.

#### If user chose `r/archive`

→ Proceed to **D. Archive the Set**.

#### If user chose `v/view`

→ Proceed to **E. View Full Content**.

#### If user chose `b/back`

→ Return to caller.

#### If user asked a question

Answer from the set items' content. Keep it short. Do not act on the set — the menu is always the next thing shown.

→ Return to **A. Render the Working Set**.

## B. Add Items

The `ADDABLE` table in the working-set DATA lists the inbox items not already in the set.

#### If `addable_count` is 0

> *Output the next fenced block as a code block:*

```
  Every inbox item is already in the set.
```

→ Return to **A. Render the Working Set**.

#### If the triggering message already named the item(s) to add

Match each named item against the `ADDABLE` table — by title, or by the number if the user referenced one. If any reference is ambiguous or unmatched, treat the request as unmatched and follow **Otherwise** below. Otherwise append the matched items' paths to the working set.

→ Return to **A. Render the Working Set**.

#### Otherwise

Emit the `DISPLAY: add candidates` section verbatim as a code block, then the `MENU: add gate` section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

**If user chose `b/back`:**

→ Return to **A. Render the Working Set**.

**If user chose one or more numbers:**

Resolve each chosen number to its `ADDABLE` row and append the row's path to the working set.

→ Return to **A. Render the Working Set**.

## C. Drop Items

#### If the triggering message already named the item(s) to drop

Resolve each named item against the working set by title or description. If any reference is ambiguous or unmatched, treat the request as unmatched and follow **Otherwise** below. Otherwise remove the resolved items (they stay in the inbox):

**If the set is now empty:**

→ Return to caller.

**If items remain:**

→ Return to **A. Render the Working Set**.

#### Otherwise

Emit the `DISPLAY: drop candidates` section verbatim as a code block, then the `MENU: drop gate` section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

**If user chose `b/back`:**

→ Return to **A. Render the Working Set**.

**If user chose one or more numbers:**

Resolve each chosen number to its `SET` row and remove that item from the working set; it stays in the inbox. If the set is now empty, → Return to caller; otherwise → Return to **A. Render the Working Set**.

## D. Archive the Set

Archive every item in the working set out of the inbox — one command moves each file into `.archived/` under its inbox folder and commits the whole set:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs inbox archive {path} [{path} …]
```

> *Output the next fenced block as a code block:*

```
Archived {count} item{s} from the inbox.
```

The working set is now empty.

→ Return to caller.

## E. View Full Content

Read each item in the set and render its full content — as markdown, not a code block, so the items' own headings and formatting render properly.

> *Output the next fenced block as markdown (not a code block):*

```
@foreach(item in working_set)
*[{item.type}] — {item.date}*

{item.full_content}

@endforeach
```

- Emit each item's file content as-is — it is markdown and renders as such; its own `#` heading is the item's visible title. Skip a frontmatter block when one exists.
- The italic type line above each item's content is its divider — nothing else separates items.

→ Return to **A. Render the Working Set**.

## F. Work the Set

Reached only for a type-uniform set — `w/work` is offered solely when `set_uniform` is `true`. The DATA `set_type` is the work-type pre-seed (all bugs → `bugfix`, all quick-fixes → `quick-fix`, all ideas → `none`).

Build `inbox_seeds` — the set items' inbox paths, comma-joined.

→ Load **[route-to-discovery.md](route-to-discovery.md)** with work_type = `{set_type}`, inbox_seeds = `{inbox_seeds}`.
