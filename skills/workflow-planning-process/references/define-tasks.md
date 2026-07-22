# Define Tasks

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-task-designer` agent (`../../../agents/workflow-planning-task-designer.md`) to design a task list for a single phase. You invoke the agent, present its output, and handle the approval gate.

---

## A. Design Task List

> *Output the next fenced block as a code block:*

```
Taking Phase {N}: {Phase Name} and breaking it into tasks. I'll delegate
this to a specialist agent that will read the full specification and
propose a task list.
```

### Invoke the Agent

Read `work_type` from the manifest:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

Invoke `workflow-planning-task-designer` with these file paths:

1. **read-specification.md**: `read-specification.md`
2. **Specification**: specification path from the manifest or `.workflows/{work_unit}/specification/{topic}/specification.md`
3. **Cross-cutting specs**: cross-cutting spec paths if any
4. **task-design.md**: `task-design.md`
5. **Context guidance**: `task-design/{work_type}.md` (default to `epic` if `work_type` is empty)
6. **All approved phases**: the complete phase structure from the planning file
7. **Target phase number**: the phase being broken into tasks

### Present the Output

The agent returns a task overview and task table. Write the task table to the planning file under the phase.

Update the manifest planning position:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} phase {N}
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} task '~'
```

Commit:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): draft Phase {N} task list"
```

Write the task-list payload for the render surface to the phase cache — one entry per task, each summary a single line, edge cases as short phrases:

```json
.workflows/.cache/{work_unit}/planning/{topic}/task-list-phase-{N}.json
{"phase": {N}, "phase_name": "{Phase Name}", "tasks": [{"name": "…", "summary": "…", "edge_cases": ["…"]}]}
```

Use the Write tool for the payload — never a shell heredoc.

→ Proceed to **B. Render the Gate**.

---

## B. Render the Gate

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render task-list {work_unit}.planning.{topic} --file .workflows/.cache/{work_unit}/planning/{topic}/task-list-phase-{N}.json
```

The response carries the task-list display plus the surface for the current gate mode. Emit each section verbatim at its marked instruction.

#### If the response carried `DISPLAY: task list auto-approved`

→ Proceed to **C. Finalize Approval**.

#### If the response carried `MENU: task list gate`

**STOP.** Wait for user response.

#### If the user provides feedback

Re-invoke `workflow-planning-task-designer` with all original inputs PLUS:
- **Previous output**: the current task list
- **User feedback**: what the user wants changed

Update the planning file with the revised task table, and rewrite the payload file to match.

→ Return to **B. Render the Gate**.

#### If `auto`

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} task_list_gate_mode auto
```

→ Proceed to **C. Finalize Approval**.

#### If navigate

Resolve the destination per the caller's **Navigation** section — the user's position moves, the leading edge does not.

→ Return to caller for **B. Process Current Phase**.

#### If `yes`

→ Proceed to **C. Finalize Approval**.

---

## C. Finalize Approval

**If the task list is new or was amended:**

1. Update the task table in the planning file: set `status: approved` and `approved_at: YYYY-MM-DD` (use today's actual date)
2. Advance the planning position in the manifest to the first task in this phase:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} task {first_task_id}
   ```
3. Commit:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): approve Phase {N} task list"
   ```

If the task list was already approved and unchanged, no updates are needed.

→ Return to caller.
