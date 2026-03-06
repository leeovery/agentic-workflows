---
name: start-feature
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(.claude/hooks/workflows/write-session-state.sh)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Start a new feature and route it through the pipeline: (Research) → Discussion → Specification → Planning → Implementation → Review.

Research is optional — offered when significant uncertainties exist.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Even if the user's initial prompt seems to answer a question, still confirm with them at the appropriate step
- Complete each step fully before moving to the next

---

## Step 0: Run Migrations

**This step is mandatory. You must complete it before proceeding.**

Invoke the `/migrate` skill and assess its output.

---

## Step 1: Gather Feature Context

Load **[gather-feature-context.md](references/gather-feature-context.md)** and follow its instructions.

→ Proceed to **Step 2**.

---

## Step 2: Feature Name and Conflict Check

Load **[name-check.md](references/name-check.md)** and follow its instructions.

→ Proceed to **Step 3**.

---

## Step 3: Research Gating

Load **[research-gating.md](references/research-gating.md)** and follow its instructions.

→ Proceed to **Step 4**.

---

## Step 4: Invoke Processing Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions.
