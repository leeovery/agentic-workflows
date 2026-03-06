---
name: continue-epic
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/continue-epic/scripts/discovery.js), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
hooks:
  PreToolUse:
    - hooks:
        - type: command
          command: "$CLAUDE_PROJECT_DIR/.claude/hooks/workflows/system-check.sh"
          once: true
---

Continue an in-progress epic. Shows full phase-by-phase state and routes to the appropriate phase skill.

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

#### If work_unit provided

→ Proceed to **Step 3**.

#### Otherwise

→ Proceed to **Step 2**.

---

## Step 2: Select Epic

```bash
node .claude/skills/continue-epic/scripts/discovery.js
```

Parse the output. If `count` is 0:

> *Output the next fenced block as a code block:*

```
Continue Epic

No epics in progress.

Run /start-epic to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

If epics exist, load **[select-epic.md](references/select-epic.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Load Epic Detail

```bash
node .claude/skills/continue-epic/scripts/discovery.js {work_unit}
```

#### If error is `not_found` or `wrong_type`

> *Output the next fenced block as a code block:*

```
Continue Epic

No epic named "{work_unit}" found.

Run /continue-epic to see available epics, or /start-epic to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### Otherwise

→ Proceed to **Step 4**.

---

## Step 4: Display State

Load **[display-state.md](references/display-state.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Build Menu and Route

Load **[build-menu.md](references/build-menu.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Route Selection

Based on the user's menu selection, invoke the appropriate skill:

| Menu option | Invoke |
|-------------|--------|
| Continue {topic} — discussion | `/start-discussion epic {work_unit} {topic}` |
| Continue {topic} — research | `/start-research epic {work_unit} {topic}` |
| Continue {topic} — specification | `/start-specification epic {work_unit} {topic}` |
| Continue {topic} — planning | `/start-planning epic {work_unit} {topic}` |
| Continue {topic} — implementation | `/start-implementation epic {work_unit} {topic}` |
| Start planning for {topic} | `/start-planning epic {work_unit} {topic}` |
| Start implementation of {topic} | `/start-implementation epic {work_unit} {topic}` |
| Start review for {topic} | `/start-review epic {work_unit} {topic}` |
| Start specification | `/start-specification epic {work_unit}` |
| Start new discussion topic | `/start-discussion epic {work_unit}` |
| Start new research | `/start-research epic {work_unit}` |
| Resume a concluded topic | Load **[resume-concluded.md](references/resume-concluded.md)** |

Skills receive positional arguments: `$0` = work_type (`epic`), `$1` = work_unit, `$2` = topic (when provided).

Invoke the selected skill. This is terminal — do not return to the backbone.
