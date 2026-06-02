---
name: workflow-bridge
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-bridge/scripts/discovery.cjs), Bash(node .claude/skills/workflow-continue-epic/scripts/discovery.cjs), Bash(node .claude/skills/workflow-discovery/scripts/discovery.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

Enter plan mode with deterministic continuation instructions.

This skill is invoked when a phase concludes — to create a plan-mode handoff that survives context compaction. For most phases it derives the next phase from state; for the discovery handoff the destination is supplied, because discovery is the first phase and the next phase isn't in state yet, so there's nothing to derive.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

This skill receives context from the calling processing skill:
- **Work unit**: The work unit name (directory under `.workflows/`) = `{work_unit}`
- **Completed phase**: The phase that just completed — `discovery` or any later phase = `{completed_phase}`
- **Next phase** (optional): supplied when the caller already knows the destination — discovery handing a single-phase work type to its first phase = `{next_phase}`. Other callers omit it and the continuation computes the next phase from discovery output.

---

## Step 1: Read Work Type and Run Discovery

Read work type from the manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} work_type
```

#### If completed phase is `discovery`

The discovery handoff needs no state computation. Discovery is the first phase, so the next phase isn't in pipeline state yet — the destination is *given*, not derived: an epic returns to its menu, and single-phase types use the `next_phase` the discovery endpoint decided and supplied. Skip the discovery script.

→ Proceed to **Step 2**.

#### If work type is `epic`

→ Proceed to **Step 2** (epic continuation runs its own enriched discovery).

#### Otherwise

Run the discovery script with the work unit:

```bash
node .claude/skills/workflow-bridge/scripts/discovery.cjs {work_unit}
```

The output contains: `work_type`, `phases` (per-phase status), and `next_phase`.

→ Proceed to **Step 2**.

---

## Step 2: Route to Continuation Reference

Based on the completed phase and work type, load the appropriate continuation reference. The completed-phase check runs first so an epic concluding discovery routes to the deterministic discovery continuation; non-discovery epic completions fall through to the work-type branches below.

#### If completed phase is `discovery`

Load **[discovery-continuation.md](references/discovery-continuation.md)** and follow its instructions as written.

#### If work type is `feature`

Load **[feature-continuation.md](references/feature-continuation.md)** and follow its instructions as written.

#### If work type is `bugfix`

Load **[bugfix-continuation.md](references/bugfix-continuation.md)** and follow its instructions as written.

#### If work type is `quick-fix`

Load **[quickfix-continuation.md](references/quickfix-continuation.md)** and follow its instructions as written.

#### If work type is `cross-cutting`

Load **[cross-cutting-continuation.md](references/cross-cutting-continuation.md)** and follow its instructions as written.

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
