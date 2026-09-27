# Select Cross-Cutting Concern

*Reference for **[workflow-continue-cross-cutting](../SKILL.md)***

---

## A. Display and Select

Display active cross-cutting concerns and let the user select one.

Fetch the selection — a fresh index dump, then the pick list and its menu:

```bash
node .claude/skills/workflow-continue-cross-cutting/scripts/gateway.cjs select
```

**If it carries no selection sections** (no active cross-cutting concerns remain — possible after a loop-back cancelled or completed the last one): render the caller's no-cross-cutting-in-progress terminal from its Step 2 and stop there.

Otherwise emit its `DISPLAY: selection` and `MENU: selection` sections verbatim per their markers. No auto-select, even with one item.

**STOP.** Wait for user response.

#### If user chose a number

The number counts down the dump's `CROSS-CUTTING` rows, in order — store that row's name as `work_unit`.

→ Return to caller.

#### If user chose `v/view`

Set work_type filter = `cross-cutting`.

→ Load **[view-completed.md](../../workflow-start/references/view-completed.md)** and follow its instructions as written.

→ On return, return to **A. Display and Select**.

#### If user chose `m/manage`

→ Load **[manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)** and follow its instructions as written.

→ On return, return to **A. Display and Select**.
