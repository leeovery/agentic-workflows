# Harvest

*Reference for **[session-loop](session-loop.md)** — loaded at the user's pull*

---

The sort ceremony. Analyse the session's exploration as a whole, propose the item set in horizons, confirm it with the user, persist. Coarse on purpose: horizons and items, provenance pointers, no briefs, no topic shaping — an item's substance stays in the session logs the pointers name, distilled only when a pull creates the topic to brief.

## A. Gather Source Material

If no session is open yet (a browse that grew content without an Exploration pause), conjure the log now — [session-template.md](session-template.md)'s lazy creation, **Exploration** backfilled from the conversation — so the sort's provenance pointers resolve and the close has a session to close.

Three sources of truth, cross-referenced:

1. **The Exploration section** of the active session log at `.workflows/.roadmap/sessions/session-{session_number}.md`. Read it now, every time, whatever is already in context.
2. **In-context memory of the conversation** — richer but volatile.
3. **The existing roadmap** from the home snapshot (re-run `gateway.cjs view` and read its DATA when it is not current in context).

→ Proceed to **B. Identify Items and Horizons**.

## B. Identify Items and Horizons

Read out the **capability-grain chunks** the exploration named — each one thing the user would move around a roadmap as one thing, with a clear name and a one-line summary worded product-first. A stage the user narrates end-to-end unpacks into its member capabilities — the horizon carries the togetherness, the items stay separately pullable; a summary that needs two "and"s is usually several items. Note but don't force material touched only in passing — it can land in a later session.

Sort the chunks into horizons using the conversation's own staging language, crystallised into named horizons — existing ones where they fit, new ones where the conversation named a stage the map lacks. "Someday" is the conventional tail for real-but-unscheduled. When no staging language emerged, offer **Now / Next / Later** as a suggested default set. Position carries the semantics — order the horizons as the user talks about them.

An item whose ground already sits on the map is not a new item: deepenings of a **waiting** item fold into its summary (an `Edits` entry); a thread that deepened a **pulled** item's ground flags the join instead (`engine roadmap flag {name}` — guidelines **C**).

#### If no new items emerged

The session surfaced nothing beyond what the map already holds — grooming, folds, and flags are already recorded under **Edits**. There is nothing to sort; tell the user in one line. Outcome: `confirmed`.

→ Return to caller.

#### Otherwise

→ Proceed to **C. Render Proposal**.

## C. Render Proposal

Write the proposed set to `.workflows/.cache/roadmap/proposed-items.json` — a JSON array, horizons in intended order, names kebab-case. `sources` names the session log paths whose exploration produced the item (this session's always included); the persist step consumes the same file:

```json
[
  {"name": "{item}", "horizon": "{horizon}", "summary": "{one-line summary}", "sources": [".roadmap/sessions/session-{NNN}.md"]}
]
```

Then render the proposal:

```bash
node .claude/skills/workflow-roadmap/scripts/gateway.cjs proposal --file .workflows/.cache/roadmap/proposed-items.json
```

Read `=== DATA` to reason from (never display it) — a per-name flag row for each proposed item:

- `exists_on_roadmap=true` — the name collides with an existing item. Fold the material into that item or pick a different name (revise the set, rewrite the file, re-run) before rendering the gate.
- `legal_name=false` — dots or slashes break manifest addressing. Rename and re-run.
- `legal_horizon=false` — the release word itself carries a dot or slash ("v1.5"). Respell it with the user's blessing at the gate ("v1-5", "v15") and re-run — the persist refuses it as written.
- `new_horizon=true` — informational: the horizon will be created at persist, in the file's order.

Emit the `=== DISPLAY` section verbatim **as a code block** — the proposed items over the existing roadmap, so the full picture is visible.

Then fetch the gate and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render roadmap-harvest-gate
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **D. Persist**.

#### If `explore`

No working set is produced. Outcome: `explore`.

→ Return to caller.

#### If adjust

Apply the named adjustments to the set — move between horizons, split, merge, rename, re-word summaries, drop. Rewrite `proposed-items.json`, re-render (back to the top of **C**), and ask again.

→ Return to **C. Render Proposal**.

## D. Persist

Land the whole set in one transaction (horizons are created JIT in entry order; the file's `sources` land on each item, `origin` defaults to `harvest`):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs roadmap add-batch --file .workflows/.cache/roadmap/proposed-items.json
```

Apply any horizon re-ordering the conversation's staging stated (`roadmap horizon reorder {name} {name} …` — the complete order; the user's words are the order, never the display's append order). Then write the log's **Items Sorted** section (one subsection per item: horizon + one-line why) and any **Edits** entries the harvest produced, and commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --roadmap -m "roadmap: harvest — session-{session_number}"
```

Outcome: `confirmed`.

→ Return to caller.
