# Start Menu

*Reference for **[leeway](../SKILL.md)** — loaded by its Step 1, and by the back of the roadmap, help and the epic menu, of the laboratory's record picker on a single-topic unit, and of the code-session gate outside an epic.*

---

## The Menu

Fetch the start menu and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render start-menu
```

The answer goes to `gate`; follow its `next`. A move into work goes through **[handing-off.md](../../leeway-shared/references/handing-off.md)**, with route = the handoff's `/{skill} {args}`, or `unit {work_unit}` for a unit's Continue, `handoff unit {work_unit}`. Any other screen it draws, help or the verdicts, is emitted the same way, verbatim per its markers, and its answer goes to `gate` in turn.

## Triage, the View and Manage

Each of these rows carries on here, through its own reference. On return, run **The Menu** again.

- **t/triage**: Load **[start-from-inbox.md](start-from-inbox.md)** and follow its instructions as written.
- **v/view**: Load **[view-completed.md](view-completed.md)** and follow its instructions as written.
- **m/manage**: Load **[manage-work-unit.md](manage-work-unit.md)** and follow its instructions as written.
