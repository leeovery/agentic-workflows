# Managing a Unit

*Reference for **[start-menu.md](start-menu.md)***

---

A unit in manage is drawn with what can be done to it as it stands, opened from manage, the closed units or the start's pick. What follows a pick that carries on in the conversation, or a `next` that runs a lifecycle verb, is below. Once it is done — and on the cancel confirm's no — draw again the screen the unit was opened from, and carry on there as the start menu's screens do. Drawn with `--from pick --matches {matches}`, that is the pick:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render work-pick --matches {matches}
```

Otherwise it is the list, `closed` where it was drawn with `--from closed`, else `manage`:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render {list:[manage|closed]}
```

## Pivot

`p/pivot` carries on here: load **[pivot-to-epic.md](../../ledger-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`.

## Absorb

`o/absorb` draws the pick of an epic. A number picked names the epic in the pick's DATA, `{epic}`: load **[absorb-into-epic.md](absorb-into-epic.md)** with work_unit = `{work_unit}` and epic = `{epic}`.

## Cancel and Reactivate

`workunit cancel` and `workunit reactivate` each answer a receipt; then follow the verb's `next`.
