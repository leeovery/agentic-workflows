---
name: start-investigation
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js), Bash(node .claude/skills/start-investigation/scripts/discovery.js), Bash(.claude/hooks/workflows/write-session-state.sh), Bash(ls .workflows/)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Invoke the **technical-investigation** skill for this conversation.

> **ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 1** of the bugfix pipeline:

| Phase              | Focus                                              | You    |
|--------------------|----------------------------------------------------|--------|
| **Investigation**  | Symptom gathering + code analysis → root cause     | ◀ HERE |
| 2. Specification   | REFINE - validate into fix specification           |        |
| 3. Planning        | HOW - phases, tasks, acceptance criteria           |        |
| 4. Implementation  | DOING - tests first, then code                     |        |
| 5. Review          | VALIDATING - check work against artifacts          |        |

**Stay in your lane**: Investigate the bug — gather symptoms, trace code, find root cause. Don't jump to fixing or implementing. This is the time for deep analysis.

---

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

#### If files were updated

**STOP.** Wait for the user to review the changes (e.g., via `git diff`) and confirm before proceeding.

#### If no updates needed

→ Proceed to **Step 1**.

---

## Step 1: Discovery State

!`node .claude/skills/start-investigation/scripts/discovery.js`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```node
node .claude/skills/start-investigation/scripts/discovery.js
```

Parse the discovery output to understand:

**From `investigations` section:**
- `exists` - whether investigation files exist
- `files` - each investigation's work_unit, status, and work_type
- `counts.in_progress` and `counts.concluded` - totals for routing

**From `state` section:**
- `scenario` - one of: `"fresh"`, `"has_investigations"`

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Determine Mode

Check for arguments: work_type = `$0`, work_unit = `$1`

Investigation is always bugfix work_type. If work_type is provided, it should be `bugfix`.

#### If `work_type` and `work_unit` are both provided

→ Proceed to **Step 3** (Validate Investigation).

#### If `work_type` is provided without `work_unit`

→ Proceed to **Step 4** (Route Based on Scenario).

#### If neither is provided

→ Proceed to **Step 4** (Route Based on Scenario).

---

## Step 3: Validate Work Unit

Load **[validate-investigation.md](references/validate-investigation.md)** and follow its instructions as written.

#### If `resume`

→ Proceed to **Step 6**.

#### If no collision

→ Proceed to **Step 5**.

---

## Step 4: Route Based on Scenario

Load **[route-scenario.md](references/route-scenario.md)** and follow its instructions as written.

#### If `resuming`

→ Proceed to **Step 6**.

#### If new or fresh

→ Proceed to **Step 5**.

---

## Step 5: Gather Bug Context

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
