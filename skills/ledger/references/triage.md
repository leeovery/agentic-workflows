# Triage

*Reference for **[start-menu.md](start-menu.md)***

---

Triage works through the inbox: the person picks items, and what's picked is worked now as one piece of work, put on the roadmap or archived. What follows a row that carries on in the conversation, or a `next` that runs an inbox verb, is below.

## Picking

At **Pick** the person names items by number, and triage's DATA gives each number's path. Read what they picked and the rest of the inbox, and name the items that fit with it by your read: the same capability or fault, or a fix that belongs beside it — none where nothing does. Write the pick, each item by its path, to `.ledger/.cache/triage.json`:

```json
{ "picked": ["{path}"], "fits": ["{path}"] }
```

Draw it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render triage --file .ledger/.cache/triage.json
```

`c/change` asks which items to add to what's picked or take out of it, then writes the pick again, the fits named afresh, and draws it the same way.

## Working On It

`w/work` hands what's picked to discovery as its seeds, which finds what kind of work it is: load **[handing-off.md](../../ledger-shared/references/handing-off.md)** with route = `/{skill} start none "{seeds}"`, the `next`'s skill and its seeds.

## Putting It on the Roadmap

`r/roadmap` puts what's picked on one horizon, the person's. Each picked item's `{name}` is its file's name without its date and `.md`. The horizon is the one they named with it, else load **[choosing-a-horizon.md](../../ledger-shared/references/choosing-a-horizon.md)** with names = the picked items' names, comma-joined.

Read each picked item, and write one entry for each to `.ledger/.cache/triage-roadmap.json`: its `name`; `summary`, one line in the product's terms; the horizon; and `note`, its path.

```json
[{ "name": "{name}", "horizon": "{horizon}", "summary": "{summary}", "note": "{path}" }]
```

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs roadmap add-batch --file .ledger/.cache/triage-roadmap.json
```

A name already on the roadmap refuses the whole batch: ask the person for another name for that item, rewrite its entry, and land the batch again. Once it lands, say the line each item of its response's `added` holds in `said`, then draw triage again (Drawn Again).

## Archiving

`a/archive`'s `inbox archive` answers its receipt; then draw triage again (Drawn Again).

## Drawn Again

Draw triage with nothing picked, and carry on there:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render triage
```

## The Archived Items

`v/view` draws the archived items, and a number picked draws that item. `u/unarchive`'s `inbox restore` and the delete's yes, `inbox delete`, each answer a receipt. Then draw the archived items again — with `--file .ledger/.cache/triage.json` where items were picked when the person chose `v/view` — and carry on there:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render archived [--file .ledger/.cache/triage.json]
```

## Bringing an Item Back

Asked in words to bring an archived item back, find its file under `.ledger/.inbox/.archived/{ideas|bugs|quickfixes}/` by its name, and restore it → `inbox restore {path}`.
