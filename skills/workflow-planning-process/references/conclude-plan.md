# Conclude the Plan

*Reference for **[workflow-planning-process](../SKILL.md)***

---

> **CHECKPOINT**: Do not conclude if any tasks in the Plan Index File show `status: pending`. All tasks must be `authored` before concluding.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to conclude?

- **`y`/`yes`** — Conclude plan and mark as completed
- **Comment** — Add context before concluding
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If comment

Discuss the user's context.

**If additional work is needed:**

→ Return to **[the skill](../SKILL.md)** for **Step 7** or **Step 8** as appropriate.

**Otherwise:**

Re-present the sign-off prompt above.

#### If `yes`

1. **Update plan status** via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} status completed
   ```
2. **Final commit** — Commit the completed plan: `planning({work_unit}): complete plan`
3. **Present completion summary**:

> *Output the next fenced block as markdown (not a code block):*

```
Planning is complete for **{work_unit}**.

The plan contains **{N} phases** with **{M} tasks** total, reviewed for traceability against the specification and structural integrity.

Status has been marked as `completed`. The plan is ready for implementation.
```

4. **Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: planning

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```
