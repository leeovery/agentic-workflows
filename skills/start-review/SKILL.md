---
name: start-review
allowed-tools: Bash(node .claude/skills/start-review/scripts/discovery.js), Bash(.claude/hooks/workflows/write-session-state.sh), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Invoke the **technical-review** skill for this conversation.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 6** of the six-phase workflow:

| Phase | Focus | You |
|-------|-------|-----|
| 1. Research | EXPLORE - ideas, feasibility, market, business | |
| 2. Discussion | WHAT and WHY - decisions, architecture, edge cases | |
| 3. Specification | REFINE - validate into standalone spec | |
| 4. Planning | HOW - phases, tasks, acceptance criteria | |
| 5. Implementation | DOING - tests first, then code | |
| **6. Review** | VALIDATING - check work against artifacts | ◀ HERE |

**Stay in your lane**: Verify that every plan task was implemented, tested adequately, and meets quality standards. Don't fix code - identify problems. You're reviewing, not building.

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

!`node .claude/skills/start-review/scripts/discovery.js`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```node
node .claude/skills/start-review/scripts/discovery.js
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From `plans` section:**
- `exists` - whether any plans exist
- `files` - list of plans with: name, work_type, planning_status, format, specification_exists, implementation_status, review_count, latest_review_version, latest_review_verdict
- `count` - total number of plans

**From `reviews` section:**
- `exists` - whether any reviews exist
- `entries` - list of reviews with: name, versions, latest_version, latest_verdict, latest_path, has_synthesis

**From `state` section:**
- `scenario` - one of: `"no_plans"`, `"single_plan"`, `"multiple_plans"`
- `implemented_count` - plans with implementation_status != "none"
- `completed_count` - plans with implementation_status == "completed"
- `reviewed_plan_count` - plans that have been reviewed
- `all_reviewed` - whether all implemented plans have reviews

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

## Step 3: Validate Plan and Implementation

Load **[validate-artifacts.md](references/validate-artifacts.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 4: Route Based on Scenario

Load **[route-scenario.md](references/route-scenario.md)** and follow its instructions as written.

---

## Step 5: Determine Review Version

Load **[determine-review-version.md](references/determine-review-version.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 6: Display Plans

Load **[display-plans.md](references/display-plans.md)** and follow its instructions as written.

---

## Step 7: Select Plans

Load **[select-plans.md](references/select-plans.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
