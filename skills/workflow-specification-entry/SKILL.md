---
name: workflow-specification-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-specification-entry/scripts/discovery.js), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(mkdir -p .workflows/*/.state), Bash(rm .workflows/*/.state/discussion-consolidation-analysis.md), Bash(.claude/hooks/workflows/write-session-state.sh)
---

Invoke the **technical-specification** skill for this conversation.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 3** of the six-phase workflow:

| Phase                | Focus                                              | You    |
|----------------------|----------------------------------------------------|--------|
| 1. Research          | EXPLORE - ideas, feasibility, market, business     |        |
| 2. Discussion        | WHAT and WHY - decisions, architecture, edge cases |        |
| **3. Specification** | REFINE - validate into standalone spec             | ◀ HERE |
| 4. Planning          | HOW - phases, tasks, acceptance criteria           |        |
| 5. Implementation    | DOING - tests first, then code                     |        |
| 6. Review            | VALIDATING - check work against artifacts          |        |

**Stay in your lane**: Validate and refine discussion content into standalone specifications. Don't jump to planning, phases, tasks, or code. The specification is the "line in the sand" - everything after this has hard dependencies on it.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them. Present output using the EXACT format shown in examples - do not simplify or alter the formatting.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Even if the user's initial prompt seems to answer a question, still confirm with them at the appropriate step
- Complete each step fully before moving to the next
- Do not act on gathered information until the skill is loaded - it contains the instructions for how to proceed

---

## Step 1: Parse Arguments

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_type and work_unit for the handoff.

#### If `topic` resolved

→ Proceed to **Step 2** (Validate Source Material).

#### If no `topic` (epic — scoped path)

Run discovery scoped to this work unit:

```bash
node .claude/skills/workflow-specification-entry/scripts/discovery.js {work_unit}
```

Parse the discovery output to understand:

**From `discussions` array:** Each discussion's name, work_unit, status, work_type, and whether it has an individual specification.

**From `specifications` array:** Each specification's name, work_unit, status, work_type, sources, and superseded_by (if applicable). Specifications with `status: superseded` should be noted but excluded from active counts.

**From `cache` section:** `entries` array — each entry has `status` (valid/stale), `reason`, `generated`, `anchored_names`. Empty array if no cache exists.

**From `current_state`:** `concluded_count`, `spec_count`, `has_discussions`, `has_concluded`, `has_specs`, and other counts/booleans for routing.

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 5** (Check Prerequisites).

---

## Step 2: Validate Source Material

Load **[validate-source.md](references/validate-source.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Validate Phase

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Invoke the Skill (Bridge Mode)

Load **[invoke-skill-bridge.md](references/invoke-skill-bridge.md)** and follow its instructions as written.

---

## Step 5: Check Prerequisites

Load **[check-prerequisites.md](references/check-prerequisites.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Route Based on State

Load **[route-scenario.md](references/route-scenario.md)** and follow its instructions as written.
