# Conclude the Plan

*Reference for **[workflow-planning-process](../SKILL.md)***

---

> **CHECKPOINT**: Do not conclude if any designed task internal IDs are missing from `task_map` in the manifest. All tasks must be authored before concluding.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to conclude?

- **`y`/`yes`** — Conclude plan and mark as completed
- **`n`/`no`** — Go back and make changes
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `no`

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If `yes`

1. **Update plan status** via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.planning.{topic} status completed
   ```
2. **Final commit** — Commit the completed plan: `planning({work_unit}): complete plan`
3. **Present completion summary**:

> *Output the next fenced block as markdown (not a code block):*

```
Planning is complete for **{work_unit}**.

The plan contains **{N} phases** with **{M} tasks** total, reviewed for traceability against the specification and structural integrity.

Status has been marked as `completed`. The plan is ready for implementation.
```

4. **Pipeline continuation**:

> *Output the next fenced block as markdown (not a code block):*

```
> Planning complete. The implementation phase will execute
> these tasks using TDD — tests first, then code.
```

Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: planning

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**STOP.** Do not proceed — terminal condition.
