---
name: start-epic
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(ls .workflows/)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Start a new epic. Gather a brief description, create the work unit, and route to the first phase.

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

Invoke the `/migrate` skill and assess its output.

---

## Step 1: Gather Epic Context

Load **[gather-epic-context.md](references/gather-epic-context.md)** and follow its instructions.

→ Proceed to **Step 2**.

---

## Step 2: Epic Name and Conflict Check

Load **[name-check.md](references/name-check.md)** and follow its instructions.

→ Proceed to **Step 3**.

---

## Step 3: Route to First Phase

Load **[route-first-phase.md](references/route-first-phase.md)** and follow its instructions.

→ Proceed to **Step 4**.

---

## Step 4: Invoke Entry-Point Skill

Invoke the appropriate entry-point skill based on the selected phase:

| Phase | Invoke |
|-------|--------|
| research | `/workflow-research-entry epic {work_unit}` |
| discussion | `/workflow-discussion-entry epic {work_unit}` |

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
