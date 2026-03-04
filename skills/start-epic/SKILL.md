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

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Identify the work unit.** Check conversation history for the work unit name. If unknown, check `.workflows/` for recently modified work unit directories.
3. **Determine current step from artifacts:**
   - No manifest exists → resume at **Step 1**
   - Manifest exists, no research or discussion file → resume at **Step 4** (re-evaluate routing)
   - Research file exists, no discussion → resume at **Step 5** (re-invoke technical-research)
   - Discussion exists with `in-progress` status in manifest → resume at **Step 5** (re-invoke technical-discussion)
   - Discussion has `concluded` status in manifest → already handled by processing skill's bridge invocation
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

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
