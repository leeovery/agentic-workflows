# Analyze Task Graph

*Reference for **[workflow-planning-process](../SKILL.md)***

---

This step uses the `workflow-planning-dependency-grapher` agent (`../../../agents/workflow-planning-dependency-grapher.md`) to analyze all authored tasks, establish internal dependencies, assign priorities, and detect cycles. You invoke the agent, present its output, and handle the approval gate.

---

## A. Analyze

> *Output the next fenced block as a code block:*

```
All tasks are authored. Now I'll analyze internal dependencies and
priorities across the full plan.
```

Read the `format` from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format
```

Load the format's **[reading.md](output-formats/{format}/reading.md)** and **[graph.md](output-formats/{format}/graph.md)**.

Invoke `workflow-planning-dependency-grapher` with these file paths:

1. **reading.md**: the format's reading reference loaded above
2. **graph.md**: the format's graph reference loaded above

The agent clears any existing dependencies/priorities, analyzes all tasks, and — if no cycles — applies the new graph data directly. It returns a structured summary of what was done.

→ Proceed to **B. Review and Approve**.

---

## B. Review and Approve

#### If `STATUS` is `no-changes`

The natural task order is already correct.

> *Output the next fenced block as markdown (not a code block):*

```
I've analyzed all {M} tasks and the natural execution order is already correct — no explicit dependencies or priorities are needed.

{notes from agent output}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve the dependency graph?

- **`y`/`yes`** — Proceed
- **Tell me what to change** — Adjust priorities or dependencies
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If the user provides feedback:**

Re-invoke `workflow-planning-dependency-grapher` with all original inputs PLUS:
- **Previous output**: the current analysis
- **User feedback**: what to change

The agent will clear all existing graph data and re-analyze from scratch.

→ Return to **B. Review and Approve**.

**If `approved`:**

Commit: `planning({work_unit}): analyze task dependencies and priorities`

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

> *Output the next fenced block as markdown (not a code block):*

```
I've analyzed and applied dependencies and priorities across all {M} tasks:

**Dependencies** ({count} relationships):
{dependency list from agent output}

**Priorities**:
{priority list from agent output}

{any notes from agent output}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve the updated graph?

- **`y`/`yes`** — Proceed
- **Tell me what to change** — Adjust priorities or dependencies
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If the user provides feedback:**

Re-invoke `workflow-planning-dependency-grapher` with all original inputs PLUS:
- **Previous output**: the current analysis
- **User feedback**: what to change

The agent will clear all existing graph data and re-analyze from scratch.

→ Return to **B. Review and Approve**.

**If `approved`:**

Commit: `planning({work_unit}): analyze task dependencies and priorities`

→ Return to caller.
