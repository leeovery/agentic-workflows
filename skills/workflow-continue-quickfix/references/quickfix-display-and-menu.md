# Quick-Fix State Display and Menu

*Reference for **[workflow-continue-quickfix](../SKILL.md)***

---

Display the selected quick-fix's pipeline state, then collect the user's proceed-or-revisit choice. The caller provides `work_unit` — the quick-fix's work unit name.

This reference stores the selected `ACTIONS` entry's `action` and `route` and returns control to the caller, which invokes the route.

---

## A. State Display and Menu

Render the quick-fix snapshot:

```bash
node .claude/skills/workflow-continue-quickfix/scripts/gateway.cjs view {work_unit}
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: state flags (`next_phase`, `phase_label`, `finalising`, `completed_phases`, `revisit_available`) and the `ACTIONS` table — one line per key, `key  action  topic  → route`. Reason from it; never display or restate it.
- **DISPLAY** — the status block. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the proceed/revisit menu. Emit verbatim as markdown (not a code block). Empty when there is nothing to revisit or finalise.
- **MENU: revisit phases** — labelled deferred section, present when earlier phases can be revisited. Emitted only at **C. Select Phase**, never here.

Emit the DISPLAY section. A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

#### If `revisit_available` is `false`

Store the `continue` entry's `action` and `route` from `ACTIONS`.

→ Return to caller.

#### Otherwise

Emit the MENU section.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Selection**.

---

## B. Handle Selection

Match the user's input to its `ACTIONS` entry by `key` — a command option's letter or long form. Every decision below reads the entry's `action` value, never its label text.

#### If `action` is `continue`

Store the entry's `action` and `route`.

→ Return to caller.

#### If `action` is `finalise`

Complete the work unit — one command sets `status: completed`, stamps `completed_at`, and commits:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete quick-fix pipeline" --pipeline
```

Emit the response's `DISPLAY: confirmation` section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.

#### If `action` is `revisit`

→ Proceed to **C. Select Phase**.

---

## C. Select Phase

Emit the snapshot's `MENU: revisit phases` section verbatim as markdown (not a code block). Its numbering matches the `revisit_phase` keys in `ACTIONS`.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a phase

Store the matched `revisit_phase` entry's `action` and `route`.

→ Return to caller.
