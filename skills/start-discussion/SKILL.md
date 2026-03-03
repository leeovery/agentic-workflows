---
name: start-discussion
allowed-tools: Bash(node .claude/skills/start-discussion/scripts/discovery.js), Bash(mkdir -p .workflows/*/.state), Bash(rm .workflows/*/.state/research-analysis.md), Bash(.claude/hooks/workflows/write-session-state.sh), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(ls .workflows/)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Invoke the **technical-discussion** skill for this conversation.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 2** of the six-phase workflow:

| Phase              | Focus                                              | You    |
|--------------------|----------------------------------------------------|--------|
| 1. Research        | EXPLORE - ideas, feasibility, market, business     |        |
| **2. Discussion**  | WHAT and WHY - decisions, architecture, edge cases | ◀ HERE |
| 3. Specification   | REFINE - validate into standalone spec             |        |
| 4. Planning        | HOW - phases, tasks, acceptance criteria           |        |
| 5. Implementation  | DOING - tests first, then code                     |        |
| 6. Review          | VALIDATING - check work against artifacts          |        |

**Stay in your lane**: Capture the WHAT and WHY - decisions, rationale, competing approaches, edge cases. Don't jump to specifications, plans, or code. This is the time for debate and documentation.

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

## Step 0: Run Migrations

**This step is mandatory. You must complete it before proceeding.**

Invoke the `/migrate` skill and assess its output.

#### If files were updated

**STOP.** Wait for the user to review the changes (e.g., via `git diff`) and confirm before proceeding.

#### If no updates needed

→ Proceed to **Step 1**.

---

## Step 1: Discovery State

!`node .claude/skills/start-discussion/scripts/discovery.js`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/start-discussion/scripts/discovery.js
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From `research` section:**
- `exists` - whether research files exist
- `files` - each research file's name and topic
- `checksum` - current checksum of all research files

**From `discussions` section:**
- `exists` - whether discussion entries exist (from manifests)
- `files` - each discussion's name, work_unit, status, and work_type
- `counts.in_progress` and `counts.concluded` - totals for routing

**From `cache` section:**
- `status` - one of three values:
  - `"valid"` - cache exists and checksums match (safe to load)
  - `"stale"` - cache exists but research has changed (needs re-analysis)
  - `"none"` - no cache file exists
- `reason` - explanation of the status
- `generated` - when the cache was created (null if none)
- `research_files` - list of files that were analyzed

**From `state` section:**
- `scenario` - one of: `"fresh"`, `"research_only"`, `"discussions_only"`, `"research_and_discussions"`

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Determine Mode

Check for arguments: work_type = `$0`, topic = `$1`

#### If `work_type` and `topic` are both provided

→ Proceed to **Step 3** (Validate Topic).

#### If `work_type` is provided without `topic`

Store work_type for the handoff.

→ Proceed to **Step 4** (Route Based on Scenario).

#### If neither is provided

→ Proceed to **Step 4** (Route Based on Scenario).

---

## Step 3: Validate Topic

Load **[validate-topic.md](references/validate-topic.md)** and follow its instructions as written.

#### If `resume`

→ Proceed to **Step 8**.

#### If no collision

→ Proceed to **Step 8**.

---

## Step 4: Route Based on Scenario

Load **[route-scenario.md](references/route-scenario.md)** and follow its instructions as written.

#### If research exists

→ Proceed to **Step 5**.

#### If discussions only

→ Proceed to **Step 6**.

#### If fresh

→ Proceed to **Step 8**.

---

## Step 5: Research Analysis

Load **[research-analysis.md](references/research-analysis.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Present Options

Load **[display-options.md](references/display-options.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Handle Selection

Load **[handle-selection.md](references/handle-selection.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Gather Context

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
