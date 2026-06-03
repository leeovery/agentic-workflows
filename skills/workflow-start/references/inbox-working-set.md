# Inbox Working Set

*Reference for **[workflow-start](../SKILL.md)***

---

Build and act on a set of inbox items. The caller holds the **working set** — one or more items, each with a type and inbox path. Every action applies to the whole set; `d`/`drop` is the only way to narrow it. `w`/`work` carries the set into discovery as combined seed material.

## A. Render the Working Set

For each item in the set, read its file and synthesise a short summary of what it describes (do not quote it verbatim). Hold each item's title (the file's `#` heading, falling back to its slug). The set is **type-uniform** when every item shares one folder, **mixed** otherwise — this gates the `w`/`work` option below.

> *Output the next fenced block as a code block:*

```
  Working Set ({count} item{s}) — actions apply to all of them
@if(set is mixed)

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

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
What would you like to do? Type a shortcut, or just tell me in
your own words — e.g. "add 2 and 4", "drop the bug", "archive these".

@if(set is type-uniform)
- **`w`/`work`** — Proceed to discovery with this set
@endif
- **`a`/`add`** — Add another inbox item to the set
- **`d`/`drop`** — Drop item(s) from the set (keeps them in the inbox)
- **`r`/`archive`** — Archive the whole set out of the inbox
- **`v`/`view`** — View full content of the set
- **`b`/`back`** — Return to the inbox list
- **Ask** — Ask about the set
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

The user types a shorthand (`w`/`a`/`d`/`r`/`v`/`b`) **or** describes the action in their own words. Map the response to one branch below; a message that only asks about the set, naming no action, is `Ask`. When the phrasing also names items (*"add 2 and 4"*, *"drop the bug"*), carry that selection into the action so **B**/**C** apply it without re-prompting.

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

Run discovery for the current inbox state:

```bash
node .claude/skills/workflow-start/scripts/discovery.cjs
```

Build a numbered list of inbox items **not already in the working set**, sorted by date.

#### If no items remain to add

> *Output the next fenced block as a code block:*

```
  Every inbox item is already in the set.
```

→ Return to **A. Render the Working Set**.

#### If the triggering message already named the item(s) to add

Match each named item against the list — by title, or by the number if the user referenced one. If any reference is ambiguous or unmatched, → Proceed to **Otherwise**. Otherwise append the matched items to the working set.

→ Return to **A. Render the Working Set**.

#### Otherwise

> *Output the next fenced block as a code block:*

```
@foreach(item in available_items sorted by date)
  {N}. {item.title} ({item.type}, {item.date})
@endforeach
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Add which? (enter number(s), comma-separated, or **`b`/`back`**)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `b`/`back`:**

→ Return to **A. Render the Working Set**.

**If user chose one or more numbers:**

Resolve each chosen item's inbox path and append it to the working set.

→ Return to **A. Render the Working Set**.

## C. Drop Items

#### If the triggering message already named the item(s) to drop

Resolve each named item against the working set by title or description. If any reference is ambiguous or unmatched, → Proceed to **Otherwise**. Otherwise remove the resolved items (they stay in the inbox):

**If the set is now empty:**

→ Return to caller.

**If items remain:**

→ Return to **A. Render the Working Set**.

#### Otherwise

> *Output the next fenced block as a code block:*

```
@foreach(item in working_set)
  {N}. {item.title} ({item.type})
@endforeach
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Drop which? (enter number(s), comma-separated, or **`b`/`back`**)
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If user chose `b`/`back`:**

→ Return to **A. Render the Working Set**.

**If user chose one or more numbers:**

Remove the chosen items from the working set; they stay in the inbox. If the set is now empty, → Return to caller; otherwise → Return to **A. Render the Working Set**.

## D. Archive the Set

Archive every item in the working set out of the inbox. For each item, move its file into the matching `.archived/{folder}` folder — `{folder}` is the item's inbox folder (`ideas` / `bugs` / `quickfixes`):

```bash
mkdir -p .workflows/.inbox/.archived/{folder}/
mv {path} .workflows/.inbox/.archived/{folder}/
```

Once every item has moved, commit the whole set in one commit — `archive {slug}` for a single item, `archive {N} items` for several:

```bash
git add -- .workflows/.inbox/
git commit -m "workflow(inbox): archive {slug | N items}"
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

Reached only for a type-uniform set — `w`/`work` is offered solely when every item shares one folder (**A**). Map the work-type pre-seed from that shared folder:

| Set composition | work_type |
|---|---|
| All bugs | `bugfix` |
| All quick-fixes | `quick-fix` |
| All ideas | `none` |

Build `inbox_seeds` — the chosen items' inbox paths, comma-joined.

→ Load **[route-to-discovery.md](route-to-discovery.md)** with work_type = `{work_type}`, inbox_seeds = `{inbox_seeds}`.
