---
name: start-implementation
allowed-tools: Bash(node .claude/skills/start-implementation/scripts/discovery.js), Bash(.claude/hooks/workflows/write-session-state.sh), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Invoke the **technical-implementation** skill for this conversation.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 5** of the six-phase workflow:

| Phase | Focus | You |
|-------|-------|-----|
| 1. Research | EXPLORE - ideas, feasibility, market, business | |
| 2. Discussion | WHAT and WHY - decisions, architecture, edge cases | |
| 3. Specification | REFINE - validate into standalone spec | |
| 4. Planning | HOW - phases, tasks, acceptance criteria | |
| **5. Implementation** | DOING - tests first, then code | ◀ HERE |
| 6. Review | VALIDATING - check work against artifacts | |

**Stay in your lane**: Execute the plan via strict TDD - tests first, then code. Don't re-debate decisions from the specification or expand scope beyond the plan. The plan is your authority.

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

!`node .claude/skills/start-implementation/scripts/discovery.js`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```node
node .claude/skills/start-implementation/scripts/discovery.js
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From `plans` section:**
- `exists` - whether any plans exist
- `files` - list of plans with: name, topic, status, format, specification, specification_exists, plan_id (if present)
- Per plan `external_deps` - array of dependencies with topic, state, task_id
- Per plan `has_unresolved_deps` - whether plan has unresolved dependencies
- Per plan `unresolved_dep_count` - count of unresolved dependencies
- Per plan `deps_satisfied` - whether all resolved deps have their tasks completed
- Per plan `deps_blocking` - list of deps not yet satisfied with reason
- `count` - total number of plans

**From `implementation` section:**
- `exists` - whether any implementation files exist
- `files` - list of implementation files with: topic, status, current_phase, completed_phases, completed_tasks

**From `environment` section:**
- `setup_file_exists` - whether environment-setup.md exists
- `requires_setup` - true, false, or null (null when file doesn't exist)

**From `state` section:**
- `scenario` - one of: `"no_plans"`, `"single_plan"`, `"multiple_plans"`

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Determine Mode

Check for arguments: work_type = `$0`, work_unit = `$1`

#### If `work_type` and `work_unit` are both provided

→ Proceed to **Step 3**.

#### If `work_type` is provided without `work_unit`

Store work_type for the handoff.

→ Proceed to **Step 4**.

#### If neither is provided

→ Proceed to **Step 4**.

---

## Step 3: Validate Plan

Load **[validate-plan.md](references/validate-plan.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 4: Route Based on Scenario

Load **[route-scenario.md](references/route-scenario.md)** and follow its instructions.

→ Proceed to **Step 5**.

---

## Step 5: Present Plans and Select

Load **[display-plans.md](references/display-plans.md)** and follow its instructions as written.

→ Proceed to **Step 6** with selected work unit.

---

## Step 6: Check Dependencies

Load **[check-dependencies.md](references/check-dependencies.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Check Environment

Load **[environment-check.md](references/environment-check.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
