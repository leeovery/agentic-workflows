# Analyze Task Graph

*Reference for **[technical-planning](../SKILL.md)***

---

This step uses the `planning-dependency-grapher` agent (`../../../agents/planning-dependency-grapher.md`) to analyze all authored tasks, establish internal dependencies, assign priorities, and detect cycles. You invoke the agent, present its output, and handle the approval gate.

---

## Analyze Dependencies and Priorities

> *Output the next fenced block as a code block:*

```
All tasks are authored. Now I'll analyze internal dependencies and
priorities across the full plan.
```

Read the `format` from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.format
```

Read **[output-formats.md](output-formats.md)**, find the entry matching the format, and load the format's **[reading.md](output-formats/{format}/reading.md)** and **[graph.md](output-formats/{format}/graph.md)**.

### Invoke the Agent

Invoke `planning-dependency-grapher` with these file paths:

1. **Plan Index File path**: `.workflows/{work-unit}/planning/planning.md`
2. **reading.md**: the format's reading reference loaded above
3. **graph.md**: the format's graph reference loaded above

The agent clears any existing dependencies/priorities, analyzes all tasks, and — if no cycles — applies the new graph data directly. It returns a structured summary of what was done.

---

## Review and Approve

#### If the agent reports no changes needed (`STATUS: no-changes`)

The natural task order is already correct.

> *Output the next fenced block as markdown (not a code block):*

```
I've analyzed all {M} tasks and the natural execution order is already correct — no explicit dependencies or priorities are needed.

{notes from agent output}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**To proceed:**
- **`y`/`yes`** — Confirmed.
- **Or tell me what to change.**
· · · · · · · · · · · ·
```

**STOP.** Wait for the user's response.

#### If the agent reports a cycle (`STATUS: blocked`)

No changes were applied.

> *Output the next fenced block as markdown (not a code block):*

```
The dependency analysis found a circular dependency:

{cycle chain from agent output}

This must be resolved before continuing. The cycle usually means two tasks each assume the other is done first — one needs to be restructured or the dependency removed.
```

**STOP.** Wait for the user to decide how to resolve.

Options include adjusting task scope, merging tasks, or removing a dependency. Re-invoke the agent after changes.

#### If the agent applied changes successfully (`STATUS: complete`)

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
**To proceed:**
- **`y`/`yes`** — Approved.
- **Or tell me what to change.**
· · · · · · · · · · · ·
```

**STOP.** Wait for the user's response.

#### If the user provides feedback

Re-invoke `planning-dependency-grapher` with all original inputs PLUS:
- **Previous output**: the current analysis
- **User feedback**: what to change

The agent will clear all existing graph data and re-analyze from scratch. Present the revised analysis in full. Ask the same choice again. Repeat until approved.

#### If `approved`

Commit: `planning({topic}): analyze task dependencies and priorities`
