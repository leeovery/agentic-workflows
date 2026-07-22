# Select Quick-Fix

*Reference for **[workflow-continue-quickfix](../SKILL.md)***

---

## A. Display and Select

Display active quick-fixes and let the user select one.

Read the most recent index dump (re-run after any loop-back that changed state).

**If it carries no selection sections** (no active quick-fixes remain — possible after a loop-back cancelled or completed the last one): render the caller's no-quick-fixes-in-progress terminal from its Step 2 and stop there.

Otherwise emit its `DISPLAY: selection` and `MENU: selection` sections verbatim, each per its marker — from the most recent dump only, never a stale earlier one. No auto-select, even with one item.

**STOP.** Wait for user response.

#### If user chose a quick-fix number

Store the selected quick-fix's name as `work_unit`.

→ Return to caller.

#### If user chose "View completed & cancelled"

Set work_type filter = `quick-fix`.

→ Load **[view-completed.md](../../workflow-start/references/view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.

#### If user chose `m`/`manage`

→ Load **[manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.
