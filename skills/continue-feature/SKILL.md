---
name: continue-feature
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/continue-feature/scripts/discovery.js), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Continue an in-progress feature. Determines current phase and routes to the appropriate phase skill.

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

## Step 1: Check Arguments

Check for arguments: work_unit = `$0` (optional).

→ Proceed to **Step 2**.

---

## Step 2: Run Discovery

```bash
node .claude/skills/continue-feature/scripts/discovery.js {work_unit}
```

If `work_unit` was not provided, run without arguments to get all features.

Parse the output. The discovery script returns one of:

- **Error `not_found`**: No feature with that name exists
- **Error `wrong_type`**: Work unit exists but is not a feature
- **Error `done`**: Feature pipeline is complete
- **Mode `list`**: List of active features with phase info
- **Mode `single`**: Single feature with phase info

#### If error is `not_found` or `wrong_type` or `done`

> *Output the next fenced block as a code block:*

```
Continue Feature

No feature named "{work_unit}" found.

Run /continue-feature to see available features, or /start-feature to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### If mode is `list` and `count` is 0

> *Output the next fenced block as a code block:*

```
Continue Feature

No features in progress.

Run /start-feature to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### If mode is `list`

Load **[display-and-select.md](references/display-and-select.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

#### If mode is `single`

Store the feature data and skip to **Step 3**.

→ Proceed to **Step 3**.

---

## Step 3: Backwards Navigation

Load **[revisit-phase.md](references/revisit-phase.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Route to Phase Skill

Using the selected feature's `next_phase`, invoke the appropriate phase skill:

| next_phase | Invoke |
|------------|--------|
| research | `/start-research feature {work_unit}` |
| discussion | `/start-discussion feature {work_unit}` |
| specification | `/start-specification feature {work_unit}` |
| planning | `/start-planning feature {work_unit}` |
| implementation | `/start-implementation feature {work_unit}` |
| review | `/start-review feature {work_unit}` |

Skills receive positional arguments: `$0` = work_type (`feature`), `$1` = work_unit. Topic is inferred from work_unit.

If the user chose to revisit a concluded phase in Step 3, use that phase instead of `next_phase`.

Invoke the skill. This is terminal — do not return to the backbone.
