# Confirm: Unify All

*Reference for **[confirm-and-handoff.md](confirm-and-handoff.md)***

---

## A. Display Confirmation

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render spec-confirm-gate {work_unit}.specification.unified --variant unify
```

Emit the call's DISPLAY and MENU sections verbatim per their markers.

**STOP.** Wait for user response.

→ Proceed to **B. Handle Response**.

---

## B. Handle Response

#### If `yes`

**If the DATA lists an `in-progress` or `completed` specification:**

→ Load **[unify-with-incorporation.md](handoffs/unify-with-incorporation.md)** and follow its instructions as written.

**Otherwise:**

→ Load **[unify.md](handoffs/unify.md)** and follow its instructions as written.

#### If `no`

→ Return to caller.
