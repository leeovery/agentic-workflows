# Select Bugfix

*Reference for **[workflow-continue-bugfix](../SKILL.md)***

---

## A. Display and Select

Display active bugfixes and let the user select one.

Run the index dump — the emission draws from this response, never a carried one:

```bash
node .claude/skills/workflow-continue-bugfix/scripts/gateway.cjs
```

**If it carries no selection sections** (no active bugfixes remain — possible after a loop-back cancelled or completed the last one): render the caller's no-bugfixes-in-progress terminal from its Step 2 and stop there.

Otherwise emit its `DISPLAY: selection` and `MENU: selection` sections verbatim, each per its marker. No auto-select, even with one item.

**STOP.** Wait for user response.

#### If user chose a bugfix number

Store the selected bugfix's name as `work_unit`.

→ Return to caller.

#### If user chose "View completed & cancelled"

Set work_type filter = `bugfix`.

→ Load **[view-completed.md](../../workflow-start/references/view-completed.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.

#### If user chose `m/manage`

→ Load **[manage-work-unit.md](../../workflow-start/references/manage-work-unit.md)** and follow its instructions as written.

Re-run discovery to refresh state after potential changes.

→ Return to **A. Display and Select**.
