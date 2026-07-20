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

Present the task list to the user using the overview returned by the agent:

> *Output the next fenced block as a code block:*

```
Phase {N}: {Phase Name} — {M} tasks.

1. {Task Name} — {One-line summary}
   └─ Edge cases: {comma-separated list, or "none"}

2. ...
```

→ Proceed to **B. Check Gate Mode**.

---

## B. Check Gate Mode

Check `task_list_gate_mode` via `engine manifest`:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} task_list_gate_mode
```

#### If `task_list_gate_mode` is `auto`

> *Output the next fenced block as a code block:*

```
Phase {N}: {Phase Name} — task list approved. Proceeding to authoring.
```

→ Proceed to **C. Finalize Approval**.

#### If `task_list_gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve this task list?

- **`y`/`yes`** — Proceed to authoring
- **`a`/`auto`** — Approve this and all remaining task list gates automatically
- **Tell me what to change** — which tasks to reorder, split, merge, add, edit, or remove
- **Navigate** — Tell me where to go: a different phase or task, or the leading edge
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If the user provides feedback

Re-invoke `workflow-planning-task-designer` with all original inputs PLUS:
- **Previous output**: the current task list
- **User feedback**: what the user wants changed

Update the planning file with the revised task table.

→ Return to **B. Check Gate Mode**.

#### If `auto`

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} task_list_gate_mode auto
```

→ Proceed to **C. Finalize Approval**.

#### If navigate

Resolve the destination per the caller's **Navigation** section — the user's position moves, the leading edge does not.

→ Return to caller for **B. Process Current Phase**.

#### If approved (`y`/`yes`)

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
