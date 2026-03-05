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

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Identify the topic.** Check conversation history for the topic name. If unknown, check `.workflows/` for recently modified work unit directories.
3. **Determine current step from artifacts:**
   - No research or discussion file exists → resume at **Step 1**
   - Research file exists, no discussion → resume at **Step 4** (re-invoke technical-research)
   - Check discussion status via CLI: `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase discussion --topic {topic} status`
   - Status is `in-progress` → resume at **Step 4** (re-invoke technical-discussion)
   - Status is `concluded` → already handled by processing skill's bridge invocation
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Run Migrations

**This step is mandatory. You must complete it before proceeding.**

Invoke the `/migrate` skill and assess its output.

---

## Step 1: Gather Feature Context

Load **[gather-feature-context.md](references/gather-feature-context.md)** and follow its instructions.

→ Proceed to **Step 2**.

---

## Step 2: Feature Name

Load **[topic-name-check.md](references/topic-name-check.md)** and follow its instructions.

→ Proceed to **Step 3**.

---

## Step 3: Research Gating

Load **[research-gating.md](references/research-gating.md)** and follow its instructions.

→ Proceed to **Step 4**.

---

## Step 4: Invoke Processing Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions.
