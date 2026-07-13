# Display: Specs Menu

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Shows when materialized specifications exist and no proposed groupings remain (every grouping has already been started). The tree, the menu, and the `ACTIONS` table share one ordering and numbering; concluded specs live behind `c`/`completed`.

## A. Display

Emit the DISPLAY section from the Step 1 snapshot verbatim as a code block.

→ Proceed to **B. Menu**.

---

## B. Menu

Emit the MENU section verbatim as markdown (not a code block).

**STOP.** Wait for user response.

Match the user's input to its `ACTIONS` entry by `key` — a number, or the command option's letter / long form. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `analyze`

If `cache_status` is `stale`, delete the cache first:
```bash
rm .workflows/{work_unit}/.state/discussion-consolidation-analysis.md
```

→ Load **[analysis-flow.md](analysis-flow.md)** and follow its instructions as written.

#### If `action` is `continue_spec`

The entry's `topic` and `verb`, plus that spec's DATA detail (sources, consult references), become the context for confirmation.

→ Load **[confirm-and-handoff.md](confirm-and-handoff.md)** and follow its instructions as written.

#### If `action` is `completed_menu`

→ Load **[display-completed-specs.md](display-completed-specs.md)** and follow its instructions as written.

→ Return to **B. Menu**.
