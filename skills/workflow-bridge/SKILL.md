---
name: workflow-bridge
user-invocable: false
allowed-tools: Bash(.claude/skills/workflow-bridge/scripts/discovery.sh)
---

Enter plan mode with deterministic continuation instructions.

This skill is invoked by processing skills (technical-discussion, technical-specification, etc.) when a pipeline phase concludes. It discovers the next phase and creates a plan mode handoff that survives context compaction.

> **ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

This skill receives context from the calling processing skill:
- **Topic**: The topic name
- **Work type**: greenfield, feature, or bugfix
- **Completed phase**: The phase that just concluded

---

## Step 1: Run Discovery

!`.claude/skills/workflow-bridge/scripts/discovery.sh`

If the above shows a script invocation rather than YAML output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
.claude/skills/workflow-bridge/scripts/discovery.sh
```

The output contains three sections: `features:`, `bugfixes:`, and `greenfield:`. Use the known work type and topic from the calling context to extract the relevant data:

#### If work type is `feature`

Find the topic entry under `features: > topics:` and extract its `next_phase`.

#### If work type is `bugfix`

Find the topic entry under `bugfixes: > topics:` and extract its `next_phase`.

#### If work type is `greenfield`

Parse the `greenfield:` section for phase-centric state:
- `state`: Counts of artifacts across all phases
- Phase-specific file lists with their statuses

→ Proceed to **Step 2**.

---

## Step 2: Route to Continuation Reference

Based on work type, load the appropriate continuation reference:

#### If work type is `feature`

Load **[feature-continuation.md](references/feature-continuation.md)** and follow its instructions as written.

#### If work type is `bugfix`

Load **[bugfix-continuation.md](references/bugfix-continuation.md)** and follow its instructions as written.

#### If work type is `greenfield`

Load **[greenfield-continuation.md](references/greenfield-continuation.md)** and follow its instructions as written.

---

## Notes

**Feature/bugfix** continuation references:
1. Use discovery output to compute a single `next_phase`
2. Call `EnterPlanMode` tool, write plan file with instructions to invoke `start-{next_phase}` with topic + work_type
3. Call `ExitPlanMode` tool for user approval

The user will then clear context, and the fresh session will invoke the appropriate start-* skill with the topic and work_type provided, causing it to skip discovery and proceed directly to validation/processing.

**Greenfield** continuation is interactive — greenfield is phase-centric with multiple actionable items, so there is no single next phase. The reference displays state, presents a menu of choices, waits for user selection, then enters plan mode with that specific choice. The plan mode content is deterministic (same as feature/bugfix) once the user has chosen.
