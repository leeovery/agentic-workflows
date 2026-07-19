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

1. **Re-baseline `spec_commit`** — the plan now reflects the specification as of this point; stamp the baseline spec-change detection will diff against on any later resume:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} spec_commit $(git rev-parse HEAD)
   ```
2. **Mark the plan completed** — the engine sets the status:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} planning {topic}
   ```
3. **Final commit** — Commit the completed plan:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): complete plan"
   ```
4. **Present completion summary**:

> *Output the next fenced block as markdown (not a code block):*

```
Planning is complete for **{work_unit}**.

The plan contains **{N} phases** with **{M} tasks** total, reviewed for traceability against the specification and structural integrity.

Status has been marked as `completed`. The plan is ready for implementation.
```

5. **Pipeline continuation**:

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
