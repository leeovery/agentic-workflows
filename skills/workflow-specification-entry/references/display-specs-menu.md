# Display: Specs Menu

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Shows when materialized specifications exist and no proposed groupings remain (every grouping has already been started). The tree, the menu, and the `ACTIONS` table share one ordering and numbering; concluded specs live behind `c/completed`.

## A. Display

Re-run the scoped snapshot — the emission draws from this response, never a carried one:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs view {work_unit}
```

Emit the TITLE section (markdown), then the DISPLAY section verbatim as a code block.

→ Proceed to **B. Menu**.

---

## B. Menu

Emit the MENU section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

Match the user's input to its `ACTIONS` entry by `key` — a number, or the command option's letter / long form. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `analyze`

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

#### If `action` is `continue_spec`

The entry's `topic` and `verb`, plus that spec's DATA detail (sources, consult references), become the context for confirmation.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If `action` is `blocked_spec`

The spec's source discussions reopened — it cannot be entered until they re-conclude. Tell the user in one line which discussions hold it (the spec's `blocked_by` in DATA names them) and that concluding those unlocks the spec, then re-present.

→ Return to **B. Menu**.

#### If `action` is `completed_menu`

→ Load **[display-completed-specs.md](display-completed-specs.md)** and follow its instructions as written.

→ Return to **B. Menu**.
