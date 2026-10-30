# Analyze Task Graph

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-dependency-grapher` agent (`.claude/agents/workflow-planning-dependency-grapher.md`) to analyze all authored tasks, establish internal dependencies, assign priorities, and detect cycles. You invoke the agent, present its output, and handle the approval gate.

---

## A. Analyze

Read the `format`, the plan's `external_id`, and the `task_map` from the manifest:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} task_map
```

Load the format's **[reading.md](output-formats/{format}/reading.md)** and **[graph.md](output-formats/{format}/graph.md)**.

Invoke `workflow-planning-dependency-grapher` with these inputs:

1. **Planning file path**: `.workflows/{work_unit}/planning/{topic}/planning.md`
2. **reading.md**: `.claude/skills/workflow-planning-process/references/output-formats/{format}/reading.md`
3. **graph.md**: `.claude/skills/workflow-planning-process/references/output-formats/{format}/graph.md`
4. **Plan external ID**: the `external_id` value read above
5. **Task map**: the `task_map` value read above

The agent clears any existing dependencies/priorities, analyzes all tasks, and — if no cycles — applies the new graph data directly. It returns a structured summary of what was done.

> *Output the next fenced block as markdown (not a code block):*

```
All tasks are authored. Now I'll analyze internal dependencies and priorities across the full plan.
```

This dispatch and every re-invocation of the grapher below run in the background (`run_in_background: true`) and end the turn on exactly `The dependency grapher agent has been dispatched for the plan's task graph.`

→ Proceed to **B. Review and Approve**.

---

## B. Review and Approve

The `no-changes` and `complete` branches write the grapher's report to `.workflows/.cache/{work_unit}/planning/{topic}/task-graph.json` with the Write tool before their render.

#### If `STATUS` is `no-changes`

The natural task order is already correct. Write the grapher's `NOTES` as the payload — `{"notes": "…"}` — then render and emit each section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render dependency-approval-gate {work_unit}.planning.{topic} --variant graph --file .workflows/.cache/{work_unit}/planning/{topic}/task-graph.json
```

**STOP.** Wait for user response.

**If the user provides feedback:**

Re-invoke `workflow-planning-dependency-grapher` with all original inputs PLUS:
- **Previous output**: the current analysis
- **User feedback**: what to change

The agent will clear all existing graph data and re-analyze from scratch.

→ Return to **B. Review and Approve**.

**If `yes`:**

Commit — `--plan` stages the planning topic, the manifests, and the plan's declared storage in one scoped call:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): analyze task dependencies and priorities" --plan {topic}
```

→ Return to caller.

#### If `STATUS` is `blocked`

No changes were applied. In your own words, say the dependency analysis found a circular dependency, quote the grapher's `CYCLES` chain, and say it must be resolved before continuing — usually two tasks each assume the other is done first, so one is restructured or the dependency removed.

**STOP.** Wait for user response.

Adjust based on user direction — options include adjusting task scope, merging tasks, or removing a dependency.

→ Return to **A. Analyze**.

#### If `STATUS` is `complete`

Dependencies and priorities have already been written to the task files. Write the grapher's `DEPENDENCIES` and `PRIORITIES` as the payload, one row per line without its leading dash, and its `NOTES` only where it has any:

```json
{"dependencies": ["{internal_id} depends on {internal_id} — {reason}"], "priorities": ["{internal_id}: {priority} — {reason}"], "notes": "…"}
```

Render and emit each section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render dependency-approval-gate {work_unit}.planning.{topic} --variant updated-graph --file .workflows/.cache/{work_unit}/planning/{topic}/task-graph.json
```

**STOP.** Wait for user response.

**If the user provides feedback:**

Re-invoke `workflow-planning-dependency-grapher` with all original inputs PLUS:
- **Previous output**: the current analysis
- **User feedback**: what to change

The agent will clear all existing graph data and re-analyze from scratch.

→ Return to **B. Review and Approve**.

**If `yes`:**

Commit — `--plan` stages the planning topic, the manifests, and the plan's declared storage in one scoped call:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): analyze task dependencies and priorities" --plan {topic}
```

→ Return to caller.
