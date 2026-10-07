# State Display and Menu

*Reference for **[workflow-continue-linear](../SKILL.md)***

---

Display the work unit's pipeline state, then collect the user's proceed-or-revisit choice. The caller provides `work_unit`.

This reference stores the selected `ACTIONS` entry's `action` and `route` and returns control to the caller, which hands the work off along the route.

---

## A. State Display and Menu

Render the work unit's snapshot:

```bash
node .claude/skills/workflow-continue-linear/scripts/gateway.cjs view {work_unit}
```

The output is one snapshot in demarcated sections:

- **DATA** — reasoning surface: state flags (`work_type`, `next_phase`, `phase_label`, `finalising`, `completed_phases`, `revisit_available`) and the `ACTIONS` table — one line per key, `key  word  action  topic  → route` — or, where no unit by that name is in progress, an `error`. Reason from it; never display or restate it.
- **TITLE** — the view's chrome heading. Emit verbatim per its marker, directly above the display.
- **DISPLAY** — the status block, or the not-found display. Emit verbatim per its marker. Never redraw, reflow, or trim it.
- **MENU** — the proceed/revisit menu, present only when there is something to revisit or finalise. Emit verbatim per its marker.

#### If the DATA carries an `error`

Emit the `DISPLAY: not found` section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.

#### If `revisit_available` is `false`

Emit the TITLE section, then the DISPLAY section, each verbatim per its marker.

Store the `continue` entry's `action` and `route` from `ACTIONS`.

→ Return to caller.

#### Otherwise

Emit the TITLE section, then the DISPLAY section, then the MENU section, each verbatim per its marker.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Match the user's input to its `ACTIONS` entry — a command option's letter by `key`, its long form by `word`. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `continue`

Store the entry's `action` and `route`.

→ Return to caller.

#### If `action` is `finalise`

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits, its message naming the DATA's `work_type`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete {work_type} pipeline"
```

Fetch and emit the receipt's `DISPLAY: confirmation` section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb complete --pipeline
```

**STOP.** Do not proceed — terminal condition.

#### If `action` is `revisit`

→ Proceed to **C. Select Phase**.

#### If `action` is `back`

→ Load **[start-menu.md](../../workflow-start/references/start-menu.md)**.

---

## C. Select Phase

Fetch and emit the `MENU: revisit phases` section verbatim per its marker (its numbering matches the `revisit_phase` keys in `ACTIONS`):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render revisit-phases {work_unit}
```

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a phase

Store the matched `revisit_phase` entry's `action` and `route`.

→ Return to caller.
