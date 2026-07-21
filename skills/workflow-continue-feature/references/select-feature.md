# Select Feature

*Reference for **[workflow-continue-feature](../SKILL.md)***

---

## A. Display and Select

Display active features and let the user select one.

The index dump already carries the selection surfaces. Emit its `DISPLAY: selection` and `MENU: selection` sections verbatim, each per its marker. No auto-select, even with one item.

**STOP.** Wait for user response.

#### If user chose a feature number

Store the selected feature's name as `work_unit`.

→ Return to caller.

#### If user chose "View completed & cancelled"

Set work_type filter = `feature`.

→ Load **[view-completed.md](../../workflow-start/references/view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.

#### If user chose `m`/`manage`

→ Load **[manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.
