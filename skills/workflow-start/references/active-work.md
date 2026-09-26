# Active Work

*Reference for **[workflow-start](../SKILL.md)***

---

Display all active work and present a unified menu for continuing or starting work.

## A. Display and Menu

Render the workflow overview snapshot:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs view
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: state flags, counts, and the `ACTIONS` table — one line per menu key, `key  word  action  work_unit  → route`, with `(pre_seed: …)` markers on start-new entries. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim per its marker, directly above the display.
- **DISPLAY** — the workflow overview. Emit verbatim per its marker. Never redraw, reflow, or trim it.
- **MENU** — the selection menu. Emit verbatim per its marker.

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Match the user's input to its `ACTIONS` entry — a number or a command option's letter by `key`, its long form by `word`. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `continue_work_unit`

Invoke the entry's stored `route` (e.g. `/workflow-continue-feature {work_unit}`).

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

#### If `action` is `open_baseline`

Invoke `/workflow-baseline` — it reads the baseline status and routes itself.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

#### If `action` is `open_roadmap`

Invoke `/workflow-roadmap open` — it reads the roadmap state and routes itself.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

#### If `action` is `open_help`

Invoke `/workflow-help` — it opens the help home.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

#### If `action` is `start_new`

→ Load **[route-to-discovery.md](route-to-discovery.md)** with work_type = `{pre_seed}`, inbox_seeds = `none`.

#### If `action` is `view_inbox`

Load **[start-from-inbox.md](start-from-inbox.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.

#### If `action` is `view_completed`

Load **[view-completed.md](view-completed.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.

#### If `action` is `manage`

Load **[manage-work-unit.md](manage-work-unit.md)** and follow its instructions as written.

→ Return to **A. Display and Menu**.
