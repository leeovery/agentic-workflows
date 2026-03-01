---
name: workflow-start
disable-model-invocation: true
allowed-tools: Bash(.claude/skills/workflow-start/scripts/discovery.sh)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Unified workflow entry point. Discovers state, determines work type, and routes appropriately.

> **ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

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

## Step 1: Run Discovery

!`.claude/skills/workflow-start/scripts/discovery.sh`

If the above shows a script invocation rather than YAML output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
.claude/skills/workflow-start/scripts/discovery.sh
```

Parse the output to understand the current workflow state:

**From `greenfield` section:**
- Research files, discussions (name, status, work_type), specifications (name, status, work_type, type), plans, implementations

**From `features` section:**
- Topics with `work_type: feature` at any phase

**From `bugfixes` section:**
- Topics with `work_type: bugfix` at any phase (includes investigations)

**From `state` section:**
- Counts for each work type, `has_any_work` flag

→ Proceed to **Step 2**.

---

## Step 2: Work Type Selection

Load **[work-type-selection.md](references/work-type-selection.md)** and follow its instructions.

The reference will present the current state and ask the user which work type they want to work on.

→ Proceed to **Step 3** with the selected work type.

---

## Step 3: Route to Work Type

Based on the selected work type, load the appropriate routing reference:

#### If work type is `greenfield`

Load **[greenfield-routing.md](references/greenfield-routing.md)** and follow its instructions.

#### If work type is `feature`

Load **[feature-routing.md](references/feature-routing.md)** and follow its instructions.

#### If work type is `bugfix`

Load **[bugfix-routing.md](references/bugfix-routing.md)** and follow its instructions.
