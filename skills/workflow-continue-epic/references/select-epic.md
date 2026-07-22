# Select Epic

*Reference for **[workflow-continue-epic](../SKILL.md)***

---

## A. Display and Select

Display active epics and let the user select one.

Read the most recent index dump (re-run after any loop-back that changed state).

**If it carries no selection sections** (no active epics remain — possible after a loop-back cancelled or completed the last one): render the caller's no-epics-in-progress terminal from its Step 2 and stop there.

Otherwise emit its `DISPLAY: selection` and `MENU: selection` sections verbatim, each per its marker — from the most recent dump only, never a stale earlier one. No auto-select, even with one item.

**STOP.** Wait for user response.

#### If user chose an epic number

Store the selected epic's name as `work_unit`.

→ Return to caller.

#### If user chose "View completed & cancelled"

Set work_type filter = `epic`.

→ Load **[view-completed.md](../../workflow-start/references/view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.

#### If user chose `m`/`manage`

→ Load **[manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.
