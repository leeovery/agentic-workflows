# Confirm: Continue Specification

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

## A. Display Confirmation

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-confirm-gate {work_unit}.specification.{topic} --variant continue
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

---

## B. Handle Response

#### If `yes`

→ Load **[reconcile-advisory.md](../../workflow-shared/references/reconcile-advisory.md)** with downstream_phase = `specification`, topic = `{the selected spec's name}`.

**If spec is completed with pending or stale sources:**

→ Load **[continue-completed.md](handoffs/continue-completed.md)** and follow its instructions as written.

**Otherwise:**

→ Load **[continue.md](handoffs/continue.md)** and follow its instructions as written.

#### If `no`

**If single discussion (no menu to return to):**

> *Output the next fenced block as markdown (not a code block):*

```
Understood. Continue working on discussions, or re-run this command when ready.
```

**STOP.** Do not proceed — terminal condition.

**If groupings or specs menu:**

→ Return to caller.
