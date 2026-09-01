---
name: workflow-planning-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

You are in the **Planning** phase — defining HOW: phases, tasks, acceptance criteria. Where Planning sits in the pipeline depends on the work type:

| Work type | Pipeline |
|---|---|
| Epic | Discovery → Research → (Experiment) → Discussion → Specification → **Planning** → Implementation → Review |
| Feature | Discussion → Specification → **Planning** → Implementation → Review |
| Bugfix | Investigation → Specification → **Planning** → Implementation → Review |

**Stay in your lane**: Create the plan - phases, tasks, and acceptance criteria. Don't jump to implementation or write code. The specification is your sole input; transform it into actionable work items.

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

## Step 2: Validate Specification

Load **[validate-spec.md](references/validate-spec.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Validate Phase

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

#### If source is `existing`

→ Proceed to **Step 5**.

#### If source is `fresh`

→ Proceed to **Step 4**.

---

## Step 4: Cross-Cutting Context

Load **[cross-cutting-context.md](references/cross-cutting-context.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
