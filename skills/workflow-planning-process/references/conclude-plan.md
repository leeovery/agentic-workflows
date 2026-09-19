# Conclude the Plan

*Reference for **[workflow-planning-process](../SKILL.md)***

---

> **CHECKPOINT**: Do not conclude if any designed task internal IDs are missing from `task_map` in the manifest. All tasks must be authored before concluding.

The plan's waits gate the conclusion — a plan does not close over a specification that is not settled, and the engine would refuse the completion anyway. Fetch the gate (empty when nothing is owed):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render wait-gate {work_unit}.planning.{topic}
```

**If sections are returned:**

Emit them verbatim per their markers — the blocker naming what is owed, its guidance, then the menu.

**STOP.** Wait for user response.

**If `yes`:**

Commit the session's work:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): pause — the specification is unsettled" --topic planning/{topic}
```

Then hand off to the pipeline bridge as a pause:

> *Output the next fenced block as markdown (not a code block):*

```
> Paused on the specification — the plan concludes once the specification has settled and the plan is reconciled against it.
```

Invoke `/workflow-bridge {work_unit} planning none paused`.

**If `keep`:**

The plan stays open, and the conclusion meets the wait again.

→ Return to caller.

**If the output is empty:**

Nothing blocks the conclusion.

→ Proceed to **A. Conclude Gate**.

## A. Conclude Gate

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render conclude-gate {work_unit}.planning.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

#### If ask

Answer from the record the session already holds — the plan and the specification.

→ Return to **A. Conclude Gate**.

#### If `yes`

→ Proceed to **B. Complete and Continue**.

## B. Complete and Continue

1. **Mark the plan completed** — the engine sets the status, and refuses while the specification is unsettled, naming what is owed:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} planning {topic}
   ```
2. **Re-baseline `spec_commit`** — the completion stands, so the plan reflects the specification as of this point; stamp the baseline spec-change detection will diff against on any later resume:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} spec_commit $(git rev-parse HEAD)
   ```
3. **Final commit** — Commit the completed plan:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): complete plan" --topic planning/{topic}
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
> Planning complete. The implementation phase will execute these tasks using TDD — tests first, then code.
```

Invoke `/workflow-bridge {work_unit} planning`.
