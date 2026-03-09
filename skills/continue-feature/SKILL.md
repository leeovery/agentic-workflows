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

## Step 1: Discovery State

!`node .claude/skills/continue-feature/scripts/discovery.js`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/continue-feature/scripts/discovery.js
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From `features` array:**
- `name` - the work unit name
- `next_phase` - the phase to route to
- `phase_label` - human-readable phase status
- `concluded_phases` - list of concluded/completed phases (for backwards navigation)

**From top-level fields:**
- `count` - number of active features
- `summary` - human-readable state summary
- `concluded` / `cancelled` - arrays of non-active features with name, status, last_phase
- `concluded_count` / `cancelled_count` - counts for each

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Check Count and Arguments

#### If `count` is 0

> *Output the next fenced block as a code block:*

```
Continue Feature

No features in progress.

Run /start-feature to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### If `work_unit` argument `$0` provided

Store the work_unit.

→ Proceed to **Step 4**.

#### If `work_unit` not provided

→ Proceed to **Step 3**.

---

## Step 3: Select Feature

Load **[select-feature.md](references/select-feature.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Validate Selection

Load **[validate-selection.md](references/validate-selection.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Backwards Navigation

Load **[revisit-phase.md](references/revisit-phase.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Route to Phase Skill

Using the selected feature's `next_phase`, invoke the appropriate phase skill:

| next_phase | Invoke |
|------------|--------|
| research | `/workflow-research-entry feature {work_unit}` |
| discussion | `/workflow-discussion-entry feature {work_unit}` |
| specification | `/workflow-specification-entry feature {work_unit}` |
| planning | `/workflow-planning-entry feature {work_unit}` |
| implementation | `/workflow-implementation-entry feature {work_unit}` |
| review | `/workflow-review-entry feature {work_unit}` |

Skills receive positional arguments: `$0` = work_type (`feature`), `$1` = work_unit. Topic is inferred from work_unit.

If the user chose to revisit a concluded phase in Step 5, use that phase instead of `next_phase`.

Invoke the skill. This is terminal — do not return to the backbone.
