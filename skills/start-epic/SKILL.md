---
name: start-epic
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(ls .workflows/), Bash(.claude/hooks/workflows/write-session-state.sh)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Start a new epic and route it through the pipeline: (Research) → Discussion → Specification → Planning → Implementation → Review.

Research is optional — offered when significant unknowns exist. Epics are phase-centric, multi-session, and long-running.

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

## Step 1: Gather Epic Context

Load **[gather-epic-context.md](references/gather-epic-context.md)** and follow its instructions.

→ Proceed to **Step 2**.

---

## Step 2: Epic Name and Conflict Check

Load **[name-check.md](references/name-check.md)** and follow its instructions.

→ Proceed to **Step 3**.

---

## Step 3: Create Manifest

Create the work unit manifest for this epic:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init {work_unit} --work-type epic --description "{description}"
```

Where `{description}` is a concise one-line summary compiled from the epic context gathered in Step 1.

→ Proceed to **Step 4**.

---

## Step 4: Route to First Phase

Load **[route-first-phase.md](references/route-first-phase.md)** and follow its instructions.

→ Proceed to **Step 5**.

---

## Step 5: Invoke Processing Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions.
