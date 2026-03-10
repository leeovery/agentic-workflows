---
name: workflow-bridge
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(node .claude/skills/workflow-bridge/scripts/discovery.js), Bash(node .claude/skills/continue-epic/scripts/discovery.js)
---

Enter plan mode with deterministic continuation instructions.

This skill is invoked by processing skills (technical-discussion, technical-specification, etc.) when a pipeline phase concludes. It discovers the next phase and creates a plan mode handoff that survives context compaction.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

This skill receives context from the calling processing skill:
- **Work unit**: The work unit name (directory under `.workflows/`) = `{work_unit}`
- **Completed phase**: The phase that just completed = `{completed_phase}`

---

## Step 1: Read Work Type and Run Discovery

Read work type from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} work_type
```

#### If work type is `epic`

→ Proceed to **Step 2** (epic continuation runs its own enriched discovery).

#### Otherwise

Run the discovery script with the work unit:

```bash
node .claude/skills/workflow-bridge/scripts/discovery.js {work_unit}
```

The output contains: `work_type`, `phases` (per-phase status), and `next_phase`.

→ Proceed to **Step 2**.

---

## Step 2: Route to Continuation Reference

Based on work type, load the appropriate continuation reference:

#### If work type is `feature`

Load **[feature-continuation.md](references/feature-continuation.md)** and follow its instructions as written.

#### If work type is `bugfix`

Load **[bugfix-continuation.md](references/bugfix-continuation.md)** and follow its instructions as written.

#### If work type is `epic`

Load **[epic-continuation.md](references/epic-continuation.md)** and follow its instructions as written.

---

## Notes

**Feature/bugfix** continuation references:
1. Use discovery output to compute a single `next_phase`
2. Call `EnterPlanMode` tool, write plan file with instructions to invoke `workflow-{next_phase}-entry` with work_unit + work_type
3. Call `ExitPlanMode` tool for user approval

The user will then clear context, and the fresh session will invoke the appropriate phase entry skill with the work_unit and work_type provided, causing it to skip discovery and proceed directly to validation/processing.

**Epic** continuation is interactive — epic is phase-centric with multiple actionable items, so there is no single next phase. The reference displays state, presents a menu of choices, waits for user selection, then enters plan mode with that specific choice. The plan mode content is deterministic (same as feature/bugfix) once the user has chosen.
