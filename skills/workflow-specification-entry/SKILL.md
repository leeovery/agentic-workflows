---
name: workflow-specification-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

You are in the **Specification** phase — refining prior work into a standalone spec. Where Specification sits in the pipeline depends on the work type:

| Work type | Pipeline |
|---|---|
| Epic | Discovery → Research → (Experiment) → Discussion → **Specification** → Planning → Implementation → Review |
| Feature | Discussion → **Specification** → Planning → Implementation → Review |
| Bugfix | Investigation → **Specification** → Planning → Implementation → Review |
| Cross-cutting | Research (optional) → (Experiment) → Discussion → **Specification** (terminal) |

**Stay in your lane**: Validate and refine discussion content into standalone specifications. Don't jump to planning, phases, tasks, or code. The specification is the "line in the sand" - everything after this has hard dependencies on it.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Step 1: Parse Arguments

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_unit for the handoff.

→ Proceed to **Step 2**.

---

## Step 2: Validate Source Material

Load **[validate-source.md](references/validate-source.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Validate Phase

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
