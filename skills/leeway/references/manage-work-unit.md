# Managing a Unit

*Reference for **[start-menu.md](start-menu.md)***

---

A unit picked in manage is drawn with what can be done to it as it stands. What follows a pick that carries on in the conversation, or a `next` that runs a lifecycle verb, is below. Once it is done — and on the cancel confirm's no — draw manage again, emit its sections verbatim per their markers, and carry on there as the start menu's screens do:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render manage
```

## Pivot

`p/pivot` carries on here: load **[pivot-to-epic.md](../../leeway-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`.

## Absorb

`o/absorb` draws the pick of an epic; its answer goes to `gate`. A number picked names the epic in the pick's DATA, `{epic}`: load **[absorb-into-epic.md](absorb-into-epic.md)** with work_unit = `{work_unit}` and epic = `{epic}`. Its `b/back` draws the unit again.

## Cancel and Reactivate

`c/cancel` draws the cancel's confirm, whose yes runs `workunit cancel {work_unit}`; `r/reactivate` runs `workunit reactivate {work_unit}`. Once either has run, fetch its receipt and emit its sections verbatim per their markers — `--warn` where the response's `warnings` is non-empty, and for a cancel `--inbox {n}` where its `inbox` lists the waiting messages it moved:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb {verb:[cancel|reactivate]} [--warn] [--inbox {n}]
```

A cancel puts each roadmap item the unit took in back on the horizon it came from; one whose horizon was removed meanwhile comes back on none, and the response's `roadmap_horizon_gone` names it with that horizon. The horizon is the person's: for each, one at a time, fetch `render horizon-pick --park {name}`, emit its MENU verbatim per its marker, and take the horizon picked, or the one the person names; a pick that refuses has none to offer, so ask in the conversation. Then put the item there:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs roadmap move {name} --horizon "{horizon}"
```
