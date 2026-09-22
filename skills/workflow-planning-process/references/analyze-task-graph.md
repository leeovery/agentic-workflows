# Analyze Task Graph

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-dependency-grapher` agent (`../../../agents/workflow-planning-dependency-grapher.md`) to analyze all authored tasks, establish internal dependencies, assign priorities, and detect cycles. You invoke the agent and carry its output into the approval gate.

---

## A. Analyze

> *Output the next fenced block as markdown (not a code block):*

```
All tasks are authored. Now I'll analyze internal dependencies and priorities across the full plan.
```

Read the `format`, the plan's `external_id`, and the `task_map` from the manifest:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} task_map
```

Load the format's **[reading.md](output-formats/{format}/reading.md)** and **[graph.md](output-formats/{format}/graph.md)**.

Invoke `workflow-planning-dependency-grapher` with these inputs:

1. **Planning file path**: `.workflows/{work_unit}/planning/{topic}/planning.md`
2. **reading.md**: the format's reading reference loaded above
3. **graph.md**: the format's graph reference loaded above
4. **Plan external ID**: the `external_id` value read above
5. **Task map**: the `task_map` value read above

The agent clears any existing dependencies/priorities, analyzes all tasks, and — if no cycles — applies the new graph data directly. It returns a structured summary of what was done.

→ Proceed to **B. Review and Approve**.

---

## B. Review and Approve

#### If `STATUS` is `no-changes`

The natural task order is already correct.

Write the finding to `.workflows/.cache/{work_unit}/planning/{topic}/dependency-graph.md` with the Write tool — "I've analyzed all {M} tasks and the natural execution order is already correct — no explicit dependencies or priorities are needed.", then the agent's notes beneath it, nothing else. Then fetch the gate, emitting each section verbatim at its marked instruction — the finding first, then the approval menu:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render dependency-approval-gate {work_unit}.planning.{topic} --variant graph --present .workflows/.cache/{work_unit}/planning/{topic}/dependency-graph.md
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

No changes were applied.

> *Output the next fenced block as markdown (not a code block):*

```
The dependency analysis found a circular dependency:

{cycle chain from agent output}

This must be resolved before continuing. The cycle usually means two tasks each assume the other is done first — one needs to be restructured or the dependency removed.
```

**STOP.** Wait for user response.

Adjust based on user direction — options include adjusting task scope, merging tasks, or removing a dependency.

→ Return to **A. Analyze**.

#### If `STATUS` is `complete`

Dependencies and priorities have already been written to the task files.

Write the applied graph to `.workflows/.cache/{work_unit}/planning/{topic}/dependency-graph.md` with the Write tool — "I've analyzed and applied dependencies and priorities across all {M} tasks:", then a **Dependencies** ({count} relationships) list and a **Priorities** list from the agent's output, then any notes it returned. Then fetch the gate, emitting each section verbatim at its marked instruction — the graph first, then the approval menu:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render dependency-approval-gate {work_unit}.planning.{topic} --variant updated-graph --present .workflows/.cache/{work_unit}/planning/{topic}/dependency-graph.md
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
