# Managing a Unit

*Reference for **[start-menu.md](start-menu.md)***

---

A unit in manage is drawn with what can be done to it as it stands, opened from manage or from the closed units. Its answers, and those of the screens its rows draw, go to `gate`; follow each `next`. What follows a pick that carries on in the conversation, or a `next` that runs a lifecycle verb, is below. Once it is done — and on the cancel confirm's no — draw again the list the unit was opened from, `render closed` where it was drawn with `--from closed`, else `render manage`, emit its sections verbatim per their markers, and carry on there as the start menu's screens do:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render {list:[manage|closed]}
```

## Pivot

`p/pivot` carries on here: load **[pivot-to-epic.md](../../leeway-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`. Once it has pivoted, fetch the receipt and emit its sections verbatim per their markers, `--warn` where the pivot's `warnings` is non-empty:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb pivot [--warn]
```

## Absorb

`o/absorb` draws the pick of an epic. A number picked names the epic in the pick's DATA, `{epic}`: load **[absorb-into-epic.md](absorb-into-epic.md)** with work_unit = `{work_unit}` and epic = `{epic}`.

## Cancel and Reactivate

`c/cancel` draws the cancel's confirm, whose yes runs `workunit cancel {work_unit}`; `r/reactivate` runs `workunit reactivate {work_unit}`. Once either has run, fetch its receipt and emit its sections verbatim per their markers — `--warn` where the response's `warnings` is non-empty, for a cancel `--inbox {n}` where its `inbox` lists the waiting messages it moved, and for a reactivate `--stayed {items}` where its `roadmap_stayed` names any, comma-joined:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb {verb:[cancel|reactivate]} [--warn] [--inbox {n}] [--stayed {items}]
```

Then follow the cancel's `next`.
