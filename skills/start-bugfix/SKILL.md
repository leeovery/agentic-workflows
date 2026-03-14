---
name: start-bugfix
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(ls .workflows/)
---

Start a new bugfix. Gather a brief description, create the work unit, and route to investigation.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Complete each step fully before moving to the next

---

## Step 0: Run Migrations

**This step is mandatory. You must complete it before proceeding.**

Invoke the `/workflow-migrate` skill and follow its instructions exactly — if it issues a STOP gate, you must stop.

---

## Step 1: Gather Bug Context

Load **[gather-bug-context.md](references/gather-bug-context.md)** and follow its instructions.

→ Proceed to **Step 2**.

---

## Step 2: Bugfix Name and Conflict Check

Load **[name-check.md](references/name-check.md)** and follow its instructions.

→ Proceed to **Step 3**.

---

## Step 3: Invoke Entry-Point Skill

Invoke `/workflow-investigation-entry bugfix {work_unit}`.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
