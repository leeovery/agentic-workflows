---
name: start-planning
allowed-tools: Bash(node .claude/skills/start-planning/scripts/discovery.js), Bash(.claude/hooks/workflows/write-session-state.sh), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Invoke the **technical-planning** skill for this conversation.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 4** of the six-phase workflow:

| Phase | Focus | You |
|-------|-------|-----|
| 1. Research | EXPLORE - ideas, feasibility, market, business | |
| 2. Discussion | WHAT and WHY - decisions, architecture, edge cases | |
| 3. Specification | REFINE - validate into standalone spec | |
| **4. Planning** | HOW - phases, tasks, acceptance criteria | ◀ HERE |
| 5. Implementation | DOING - tests first, then code | |
| 6. Review | VALIDATING - check work against artifacts | |

**Stay in your lane**: Create the plan - phases, tasks, and acceptance criteria. Don't jump to implementation or write code. The specification is your sole input; transform it into actionable work items.

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

---

## Step 1: Discovery State

!`node .claude/skills/start-planning/scripts/discovery.js`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```node
node .claude/skills/start-planning/scripts/discovery.js
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From `specifications` section:**
- `exists` - whether any specifications exist
- `feature` - list of feature specs (name, status, has_plan, plan_status, has_impl, impl_status)
- `crosscutting` - list of cross-cutting specs (name, status)
- `counts.feature` - total feature specifications
- `counts.feature_ready` - feature specs ready for planning (concluded + no plan)
- `counts.feature_with_plan` - feature specs that already have plans
- `counts.feature_actionable_with_plan` - specs with plans that are NOT fully implemented
- `counts.feature_implemented` - specs with `impl_status: completed`
- `counts.crosscutting` - total cross-cutting specifications

**From `plans` section:**
- `exists` - whether any plans exist
- `files` - each plan's name, format, status, and plan_id (if present)
- `common_format` - the output format if all existing plans share the same one; empty string otherwise

**From `state` section:**
- `scenario` - one of: `"no_specs"`, `"nothing_actionable"`, `"has_options"`

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Determine Mode

Check for arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional)
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`

#### If `topic` resolved (bridge mode)

→ Proceed to **Step 3**.

#### If `work_type` and `work_unit` provided but no `topic` (scoped discovery)

Store work_type for the handoff.

→ Proceed to **Step 4**.

#### If neither is provided

→ Proceed to **Step 4**.

---

## Step 3: Validate Specification

Load **[validate-spec.md](references/validate-spec.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 4: Route Based on Scenario

Load **[route-scenario.md](references/route-scenario.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Present State and Options

Load **[display-state.md](references/display-state.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Route by Plan State

Load **[route-plan-state.md](references/route-plan-state.md)** and follow its instructions as written.

---

## Step 7: Cross-Cutting Context

Load **[cross-cutting-context.md](references/cross-cutting-context.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
