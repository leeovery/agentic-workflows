# Feature State Display and Menu

*Reference for **[workflow-continue-feature](../SKILL.md)***

---

Display the selected feature's pipeline state, then collect the user's proceed-or-revisit choice. The caller provides `work_unit` — the feature's work unit name.

This reference stores the selected `ACTIONS` entry's `action` and `route` and returns control to the caller, which invokes the route.

---

## A. State Display and Menu

Render the feature snapshot:

```bash
node .claude/skills/workflow-continue-feature/scripts/gateway.cjs view {work_unit}
```

The output is one snapshot in three demarcated sections:

- **DATA** — reasoning surface: state flags (`next_phase`, `phase_label`, `finalising`, `completed_phases`, `revisit_available`) and the `ACTIONS` table — one line per key, `key  action  topic  → route`. Reason from it; never display or restate it.
- **DISPLAY** — the status block. Emit verbatim as a code block. Never redraw, reflow, or trim it.
- **MENU** — the proceed/revisit menu. Emit verbatim as markdown (not a code block). Empty when there is nothing to revisit or finalise.

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
node .claude/skills/workflow-engine/scripts/engine.cjs workunit complete {work_unit} -m "workflow({work_unit}): complete feature pipeline"
```

> *Output the next fenced block as a code block:*

```
Feature Completed

"{work_unit:(titlecase)}" has completed all pipeline phases.
```

**STOP.** Do not proceed — terminal condition.

#### If `action` is `revisit`

→ Proceed to **C. Select Phase**.

---

## C. Select Phase

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Which phase would you like to revisit?

- **`1`** — {phase:(titlecase)} — completed
- **`2`** — ...
- **`b`/`back`** — Return to the previous menu

Select an option:
· · · · · · · · · · · ·
```

List one option per `revisit_phase` entry in `ACTIONS`, numbered by its key.

**STOP.** Wait for user response.

#### If user chose `back`

→ Return to **A. State Display and Menu**.

#### If user chose a phase

Store the matched `revisit_phase` entry's `action` and `route`.

→ Return to caller.
