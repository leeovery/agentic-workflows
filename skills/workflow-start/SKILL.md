---
name: workflow-start
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/workflow-start/scripts/discovery.js)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Unified workflow entry point. Discovers state, determines work type, and routes appropriately.

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

## Step 1: Run Discovery

!`node .claude/skills/workflow-start/scripts/discovery.js`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/workflow-start/scripts/discovery.js
```

Parse the output to understand the current workflow state:

**From `epics` section:**
- `work_units` — work units with `work_type: epic` — name, next_phase, phase_label, per-phase statuses

**From `features` section:**
- `work_units` — work units with `work_type: feature` — name, next_phase, phase_label, per-phase statuses

**From `bugfixes` section:**
- `work_units` — work units with `work_type: bugfix` — name, next_phase, phase_label, per-phase statuses (includes investigation)

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

#### If work type is `epic`

Load **[epic-routing.md](references/epic-routing.md)** and follow its instructions.

#### If work type is `feature`

Load **[feature-routing.md](references/feature-routing.md)** and follow its instructions.

#### If work type is `bugfix`

Load **[bugfix-routing.md](references/bugfix-routing.md)** and follow its instructions.
