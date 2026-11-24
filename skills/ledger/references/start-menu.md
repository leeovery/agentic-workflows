# Start Menu

*Reference for **[ledger](../SKILL.md)** — loaded where boot answers the menu, by the back of the roadmap, help and the epic menu, and from the start's pick at a closed unit.*

---

## The Menu

Fetch the start menu:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render start-menu
```

A `next` that moves into work — a handoff, or a unit's Continue, `handoff unit {work_unit}` — goes through the handoff:

Load **[handing-off.md](../../ledger-shared/references/handing-off.md)** with route = `/{skill} {args}` for a handoff, or `unit {work_unit}` for a Continue.

## The Walk

**w/walk**, on the start menu's help, carries on here: Load **[walk.md](walk.md)** with origin = `help`. On return, draw the start menu's help again, and carry on there:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render help start-menu
```

## The Reference Cards

A question asked at a reference card is answered per **[answering-how-it-works.md](../../ledger-shared/references/answering-how-it-works.md)**.

## Triage

Once triage is drawn: Load **[triage.md](triage.md)** and follow its instructions as written.

## The Environment Setup

Manage's `s/setup` draws the project's environment setup. A Comment on it says what's different:

Load **[environment-setup.md](../../ledger-shared/references/environment-setup.md)** and follow its instructions as written, with from = `manage`.

## The Matrix

Asked for in the person's own words, the matrix is drawn as manage's `m/matrix` draws it, `render matrix`. Its `t/threshold` and `u/build`, and the replay's Comment, carry on here: the person names a number, and its replay comes first, `render matrix-replay --{setting:[threshold|build]} {n}`.

## Managing a Unit

A unit picked in manage, among the closed units, or at the start's pick, is drawn with what can be done to it, `render manage-unit {work_unit}`. Once it is drawn: Load **[manage-work-unit.md](manage-work-unit.md)** with work_unit = `{work_unit}`.
