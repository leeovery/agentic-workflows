# Triage

*Reference for **[start-menu.md](start-menu.md)***

---

Triage works through the inbox: the person picks items, and what's picked is worked now as one piece of work, put on the roadmap or archived. Its answers, and those of the screens its rows draw, go to `gate`; follow each `next`. What follows a row that carries on in the conversation, or a `next` that runs an inbox verb, is below.

## Picking

At **Pick** the person names items by number, and triage's DATA gives each number's path. Read what they picked and the rest of the inbox, and name the items that fit with it by your read: the same capability or fault, or a fix that belongs beside it — none where nothing does. Write the pick, each item by its path, to `.leeway/.cache/triage.json`:

```json
{ "picked": ["{path}"], "fits": ["{path}"] }
```

Draw it, and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render triage --file .leeway/.cache/triage.json
```

`c/change` asks which items to add to what's picked or take out of it, then writes the pick again, the fits named afresh, and draws it the same way.

## Working On It

`w/work` hands what's picked to discovery as its seeds, which finds what kind of work it is: load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `/{skill} start none "{seeds}"`, the `next`'s skill and its seeds.

## Putting It on the Roadmap

`r/roadmap` puts what's picked on one horizon, the person's: the one they named with it, else load **[choosing-a-horizon.md](../../leeway-shared/references/choosing-a-horizon.md)** and follow its instructions as written.

Read each picked item, and write one entry for each to `.leeway/.cache/triage-roadmap.json`: `name`, its file's name without its date and `.md`; `summary`, one line in the product's terms; the horizon; and `note`, its path.

```json
[{ "name": "{name}", "horizon": "{horizon}", "summary": "{summary}", "note": "{path}" }]
```

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs roadmap add-batch --file .leeway/.cache/triage-roadmap.json
```

A name already on the roadmap refuses the whole batch: ask the person for another name for that item, rewrite its entry, and land the batch again. Once it lands, say `On the roadmap: "{title}" → {horizon}.` for one item, or `On the roadmap: {count} items → {horizon}.` for several, then draw triage again (Drawn Again).

## Archiving

Once `a/archive`'s `inbox archive` has run, say `Archived "{title}".` for one item, or `Archived {count} items.` for several, then draw triage again (Drawn Again).

## Drawn Again

Draw triage with nothing picked, emit its sections verbatim per their markers, and carry on there:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render triage
```

## The Archived Items

`v/view` draws the archived items, and a number picked draws that item. Once `u/unarchive`'s `inbox restore` has run, fetch its receipt (Bringing an Item Back). Once the delete's yes has run `inbox delete`, fetch its receipt over the item's path, and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render inbox-delete-receipt --path {path}
```

After either receipt, draw the archived items again — with `--file .leeway/.cache/triage.json` where items were picked when the person chose `v/view` — emit its sections verbatim per their markers, and carry on there:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render archived [--file .leeway/.cache/triage.json]
```

## Bringing an Item Back

Asked in words to bring an archived item back, find its file under `.leeway/.inbox/.archived/{ideas|bugs|quickfixes}/` by its name, and restore it → `inbox restore {path}`.

Once a restore has run, fetch its receipt over the path its response's `restored` names, `--unclaimed` naming the unit its response's `unclaimed` names, where it names one, and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render inbox-restore-receipt --path {path} [--unclaimed {work_unit}]
```
