# Inbox Working Set

*Reference for **[workflow-start](../SKILL.md)***

---

Build and act on a set of inbox items. The caller holds the **working set** — one or more items, each with a type and inbox path. Every action applies to the whole set; `d`/`drop` is the only way to narrow it. `w`/`work` carries the set into discovery as combined seed material.

## A. Render the Working Set

Fetch the working-set snapshot — pass every held item's inbox path, in set order:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs working-set {path} [{path} …]
```

The response carries demarcated sections:

- **DATA** — reasoning surface: `set_uniform` / `set_type`, `addable_count`, and the `SET` and `ADDABLE` tables — one line per item, `n  type  date  slug  → path`. Reason from it; never display or restate it.
- **MENU** — the set menu. Emit verbatim as markdown (not a code block) at this section's gate below. The `w`/`work` option renders only for a type-uniform set.
- **Labelled sections** (`DISPLAY: add candidates`, `MENU: add gate`, `DISPLAY: drop candidates`, `MENU: drop gate`) — deferred: each is emitted only at the gate its marker names (**B** / **C**), never here.

For each item in the set, read its file and synthesise a short summary of what it describes (do not quote it verbatim). Hold each item's title (the file's `#` heading, falling back to its slug).

> *Output the next fenced block as a code block:*

```
  Working Set ({count} item{s}) — actions apply to all of them
@if(set_uniform is false)

  ⚑ Work is unavailable while the set mixes types — drop to a single
    type to enable it.
@endif

@foreach(item in working_set)
  {branch}• {item.title} ({item.type})
@foreach(line in wrap(item.summary, 65))
  {gutter}{line}
@endforeach
@endforeach
```

**Render rules:**

- **Item row**: `{branch}• {item.title} ({item.type})`. `{branch}` is `┌─ ` for the first item, `└─ ` for the last, `├─ ` for the rest (trailing space included). **With a single item, `{branch}` is empty** — render `• {item.title}` with no connector; a lone `└─` would join nothing. The `•` is a fixed marker, not a status icon.
- **Flag spacing**: the `⚑` block carries one blank line above and one below. The blank inside `@if` supplies the upper gap; the blank after `@endif` supplies the lower. When no flag renders, only the lower blank remains — the title-to-items gap stays a single line, never doubled.
- **Summary sub-lines**: hard-wrap at 65 characters, capped at **3 lines** — if it would run longer, truncate the third line with `…` (`v`/`view` shows the full text). Each line is indented **two columns past the title text** so the description reads as subordinate, not aligned directly under the title.
  - **`{gutter}`** (the template's 2-space lead precedes it): non-last item → `│` then 6 spaces; last item → 7 spaces (no `│`); single item → 4 spaces. The `│` sits under the branch character and runs continuously through every sub-line of non-last items so the tree never breaks.

Emit the MENU section.

**STOP.** Wait for user response.

The user types a shorthand (`w`/`a`/`d`/`r`/`v`/`b`) **or** describes the action in their own words. Map the response to one branch below; a message that only asks about the set, naming no action, is `Ask`. When the phrasing also names items (*"add 2 and 4"*, *"drop the bug"*), carry that selection into the action so **B**/**C** apply it without re-prompting. `w`/`work` can only be chosen when the menu offered it (`set_uniform` is `true`).

#### If user chose `w`/`work`

→ Proceed to **F. Work the Set**.

#### If user chose `a`/`add`

→ Proceed to **B. Add Items**.

#### If user chose `d`/`drop`

→ Proceed to **C. Drop Items**.

#### If user chose `r`/`archive`

→ Proceed to **D. Archive the Set**.

#### If user chose `v`/`view`

→ Proceed to **E. View Full Content**.

#### If user chose `b`/`back`

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

Match each named item against the `ADDABLE` table — by title, or by the number if the user referenced one. If any reference is ambiguous or unmatched, → Proceed to **Otherwise**. Otherwise append the matched items' paths to the working set.

→ Return to **A. Render the Working Set**.

#### Otherwise

Emit the `DISPLAY: add candidates` section verbatim as a code block, then the `MENU: add gate` section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

**If user chose `b`/`back`:**

→ Return to **A. Render the Working Set**.

**If user chose one or more numbers:**

Resolve each chosen number to its `ADDABLE` row and append the row's path to the working set.

→ Return to **A. Render the Working Set**.

## C. Drop Items

#### If the triggering message already named the item(s) to drop

Resolve each named item against the working set by title or description. If any reference is ambiguous or unmatched, → Proceed to **Otherwise**. Otherwise remove the resolved items (they stay in the inbox):

**If the set is now empty:**

→ Return to caller.

**If items remain:**

→ Return to **A. Render the Working Set**.

#### Otherwise

Emit the `DISPLAY: drop candidates` section verbatim as a code block, then the `MENU: drop gate` section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

**If user chose `b`/`back`:**

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

Read each item in the set and render its full content.

> *Output the next fenced block as a code block:*

```
@foreach(item in working_set)
  ── {item.title} ({item.type}) ──

  {item.full_content}

@endforeach
```

→ Return to **A. Render the Working Set**.

## F. Work the Set

Reached only for a type-uniform set — `w`/`work` is offered solely when `set_uniform` is `true`. The DATA `set_type` is the work-type pre-seed (all bugs → `bugfix`, all quick-fixes → `quick-fix`, all ideas → `none`).

Build `inbox_seeds` — the set items' inbox paths, comma-joined.

→ Load **[route-to-discovery.md](route-to-discovery.md)** with work_type = `{set_type}`, inbox_seeds = `{inbox_seeds}`.
