# Start Menu

*Reference for **[leeway](../SKILL.md)** — loaded by its Step 1, and by the back of the roadmap, help and the epic menu, of the laboratory's record picker on a single-topic unit, and of the code-session gate outside an epic.*

---

## The Menu

Fetch the start menu and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render start-menu
```

The answer goes to `gate`; follow its `next`. Any other screen it draws, help or the verdicts, is emitted the same way, verbatim per its markers, and its answer goes to `gate` in turn. A `next` that moves into work — a handoff, or a unit's Continue, `handoff unit {work_unit}` — goes through the handoff:

Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `/{skill} {args}` for a handoff, or `unit {work_unit}` for a Continue.

## Rows That Carry On Here

Each of these rows carries on here, through its own reference. On return, run **The Menu** again.

- **t/triage**: Load **[start-from-inbox.md](start-from-inbox.md)** and follow its instructions as written.
- **v/view**: Load **[view-completed.md](view-completed.md)** and follow its instructions as written.
- **m/manage**: Load **[manage-work-unit.md](manage-work-unit.md)** and follow its instructions as written.
- **w/walk**, on the start menu's help: Load **[walk.md](../../leeway-help/references/walk.md)** with origin = `help`.
