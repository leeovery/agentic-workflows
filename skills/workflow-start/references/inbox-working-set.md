# Inbox Working Set

*Reference for **[workflow-start](../SKILL.md)***

---

Build and act on a set of inbox items. The caller holds the **working set** — one or more items, of any mix of types, each with its type and inbox path. Every action applies to the whole set; `d/drop` is the only way to narrow it. `w/work` carries the set into discovery as combined seed material; `o/roadmap` puts it on the roadmap under one horizon, each note moving with its item.

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

- **DATA** — reasoning surface: `set_type`, `addable_count`, and the `SET` and `ADDABLE` tables — one line per item, `n  type  date  slug  → path  — title`. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim per its marker, directly above the display.
- **DISPLAY** — the set tree, summaries rendered beneath each item. Emit verbatim per its marker. Never redraw, reflow, or trim it.
- **MENU** — the set menu. Emit verbatim per its marker.

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

The user types a shorthand (`w`/`o`/`a`/`d`/`r`/`v`/`b`) **or** describes the action in their own words. Map the response to one branch below; a message that only asks about the set, naming no action, is `Ask`. When the phrasing also names items (*"add 2 and 4"*, *"drop the bug"*), carry that selection into the action so **B**/**C** apply it without re-prompting; when it names a horizon (*"put these under Later"*), carry that into **G**.

#### If user chose `w/work`

→ Proceed to **F. Work the Set**.

#### If user chose `o/roadmap`

→ Proceed to **G. Choose the Horizon**.

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

Answer from the set items' content. Keep it short, and do not act on the set. The question sets the gate aside; once the exchange looks settled, ask in conversation whether they are ready to move on, and on yes put it back:

→ Return to **A. Render the Working Set**.

## B. Add Items

The `ADDABLE` table in the working-set DATA lists the inbox items not already in the set.

#### If `addable_count` is 0

> *Output the next fenced block as a text code block (```text fence):*

```text
  Every inbox item is already in the set.
```

→ Return to **A. Render the Working Set**.

#### If the triggering message already named the item(s) to add

Match each named item against the `ADDABLE` table — by title, or by the number if the user referenced one. If any reference is ambiguous or unmatched, treat the request as unmatched and follow **Otherwise** below. Otherwise append the matched items' paths to the working set.

→ Return to **A. Render the Working Set**.

#### Otherwise

Fetch the add gate over the current set and emit its `MENU: add gate` section verbatim per its marker:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs working-set-add-gate {path} [{path} …]
```

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

Fetch the drop gate over the current set and emit its `MENU: drop gate` section verbatim per its marker:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs working-set-drop-gate {path} [{path} …]
```

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

> *Output the next fenced block as a text code block (```text fence):*

```text
Archived {count} item{s} from the inbox.
```

The working set is now empty.

→ Return to caller.

## E. View Full Content

Read each item in the set and render its full content as markdown (not a code block), so the items' own headings and formatting render properly.

> *Output the next fenced block as markdown (not a code block):*

```
@foreach(item in working_set)
*[{item.type}] — {item.date}*

{item.full_content}

@endforeach
```

- Emit each item's file content as-is — its own `#` heading is the item's visible title. Skip a frontmatter block when one exists.
- The italic type line above each item's content is its divider — nothing else separates items.

→ Return to **A. Render the Working Set**.

## F. Work the Set

The DATA `set_type` is the work-type pre-seed, taken from the largest kind in the set: quick-fixes only → `quick-fix`; any bug and no idea → `bugfix`; any idea → `none`, where discovery decides the shape from the ideas and the bugs and quick-fixes ride along as seeds that never set or enlarge it.

Build `inbox_seeds` — the set items' inbox paths, comma-joined.

→ Load **[route-to-discovery.md](route-to-discovery.md)** with work_type = `{set_type}`, inbox_seeds = `{inbox_seeds}`.

## G. Choose the Horizon

The whole set goes under one horizon.

#### If the reply named a horizon

That label is `{horizon}`.

→ Proceed to **H. Confirm the Roadmap Items**.

#### Otherwise

→ Load **[choosing-a-horizon.md](../../workflow-shared/references/choosing-a-horizon.md)** and follow its instructions as written.

→ On return, proceed to **H. Confirm the Roadmap Items**.

## H. Confirm the Roadmap Items

Compose one item per note in the set, from the note read at **A**:

- `name` — the note's slug: its filename without the `YYYY-MM-DD--` date prefix and the `.md` extension, kebab-case.
- `kind` — from its inbox folder: `ideas` → `idea`, `bugs` → `bug`, `quickfixes` → `quick-fix`.
- `summary` — one line in the product's terms: an idea at capability grain (one capability the user would move around a roadmap as one thing), a bug or a quick-fix as the one fix it is.

Write the payload to `.workflows/.cache/inbox-roadmap.json` with the Write tool, the items in set order:

```json
{ "horizon": "{horizon}", "items": [{ "name": "{name}", "kind": "{kind}", "summary": "{summary}" }] }
```

Render the confirm — it states every item and the horizon, flagged new when the map does not hold it and naming the roadmap's own birth when there is none. A refusal names an item already on the roadmap: derive another name for it from its note — more specific, never a numeric suffix — and render again.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render inbox-roadmap-gate --file .workflows/.cache/inbox-roadmap.json
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

**If `yes`:**

→ Proceed to **I. Land the Items**.

**If `no`:**

Nothing is recorded; the set stands.

→ Return to **A. Render the Working Set**.

**If comment:**

The comment names what to change — an item's name or summary, or the horizon. Take it as the instruction and compose the payload again; what it does not name stands.

→ Return to **H. Confirm the Roadmap Items**.

## I. Land the Items

Write the entries to `.workflows/.cache/inbox-roadmap-items.json` with the Write tool — one per item, in set order, `note` the item's inbox path:

```json
[{ "name": "{name}", "horizon": "{horizon}", "summary": "{summary}", "note": "{path}" }]
```

Land them — the verb moves each note to the roadmap's notes, derives each item's kind, origin and source from its note, and self-commits, so no commit call follows:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap add-batch --file .workflows/.cache/inbox-roadmap-items.json
```

#### If the response is `ok: false` refusing a name already on the roadmap

Nothing moved. Derive another name for that item as **H** does.

→ Return to **H. Confirm the Roadmap Items**.

#### Otherwise

Tell the user in one line what went where — the items and their horizon. The working set is now empty.

→ Return to caller.
