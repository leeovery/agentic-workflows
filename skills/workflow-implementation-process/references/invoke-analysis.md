# Invoke Analysis Agents

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

This step dispatches the three analysis agents in parallel to evaluate the completed implementation from different perspectives: duplication, standards conformance, and architecture.

---

## Identify Scope

Build the list of implementation files using git history:

```bash
git log --oneline --name-only --pretty=format: --grep="impl({work_unit}):" | sort -u | grep -v '^$'
```

This captures all files touched by implementation commits for the topic.

---

## Dispatch All Three Agents

> **CRITICAL — dispatch with clean context.** Pass each agent **only** the seven inputs listed below. Do **not** include prior cycle findings, summaries of what earlier cycles caught or missed, your own hunches, or any framing that suggests where to look. Each cycle must run independently — cross-cycle synthesis happens in the synthesizer, not in the agents. Priming biases results (a clean cycle-N report after a high-finding cycle-(N-1) is a red flag, not convergence).

Dispatch **all three in parallel** via the Task tool. Each agent receives the same inputs:

1. **Implementation files** — the file list from scope identification
2. **Specification path** — from the specification (if available)
3. **Project skill paths** — from `project_skills` in the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.implementation.{topic} project_skills`)
4. **code-quality.md path** — `code-quality.md`
5. **Work unit** — the work unit name (for path construction)
6. **Topic name** — the implementation topic
7. **Cycle number** — from `analysis_cycle_total` in the manifest: `node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.implementation.{topic} analysis_cycle_total`

Each agent knows its own output path convention and writes findings independently.

### Agent 1: Duplication

- **Agent path**: `../../../agents/workflow-implementation-analysis-duplication.md`

### Agent 2: Standards

- **Agent path**: `../../../agents/workflow-implementation-analysis-standards.md`

### Agent 3: Architecture

- **Agent path**: `../../../agents/workflow-implementation-analysis-architecture.md`

---

## Wait for Completion

> **CHECKPOINT**: Do not proceed until all three agents have returned.

Each agent writes its findings to its own output file and returns a brief status. If any agent fails (error, timeout), record the failure and continue — the synthesizer works with whatever findings files are available.

→ Return to caller.
