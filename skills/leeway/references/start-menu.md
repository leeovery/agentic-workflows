# Start Menu

*Reference for **[leeway](../SKILL.md)** — loaded by its Step 1, and by the back of the roadmap, help and the epic menu.*

---

## The Menu

Fetch the start menu and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render start-menu
```

The answer goes to `gate`; follow its `next`. Any other screen it draws — help, the verdicts, manage or the closed units — is emitted the same way, verbatim per its markers, and its answer goes to `gate` in turn. A `next` that moves into work — a handoff, or a unit's Continue, `handoff unit {work_unit}` — goes through the handoff:

Load **[handing-off.md](../../leeway-shared/references/handing-off.md)** with route = `/{skill} {args}` for a handoff, or `unit {work_unit}` for a Continue.

## Rows That Carry On Here

Each of these rows carries on here, through its own reference. On return, run **The Menu** again.

- **t/triage**: Load **[start-from-inbox.md](start-from-inbox.md)** and follow its instructions as written.
- **w/walk**, on the start menu's help: Load **[walk.md](../../leeway-help/references/walk.md)** with origin = `help`.

## Managing a Unit

A unit picked in manage, or among the closed units, is drawn with what can be done to it, `render manage-unit {work_unit}`. Once it is drawn: Load **[manage-work-unit.md](manage-work-unit.md)** with work_unit = `{work_unit}`.
