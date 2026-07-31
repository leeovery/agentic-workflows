---
name: workflow-continue-bugfix
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-continue-bugfix/scripts/gateway.cjs), Bash(node .claude/skills/workflow-start/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

Continue an in-progress bugfix. Determines current phase and routes to the appropriate phase skill.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Step 0: Initialisation

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Continue Bugfix
●───────────────────────────────────────────────●

```

→ Proceed to **Step 1**.

---

## Step 1: Discovery State

!`node .claude/skills/workflow-continue-bugfix/scripts/gateway.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/workflow-continue-bugfix/scripts/gateway.cjs
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From the `=== BUGFIXES (N) ===` section:**
- one line per active bugfix — `{name}: {phase_label}`
- `count` — the header count of active bugfixes

**From the `=== COMPLETED (N) ===` / `=== CANCELLED (N) ===` sections:**
- one line per closed bugfix — `{name} (last phase: {phase})`
- `completed_count` / `cancelled_count` — the header counts

Anything richer (next phase, completed phases, revisit routes) comes from the `view` snapshot at Step 5 — this dump is the index, not the state surface.

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Check Count and Arguments

#### If `count` is 0

> *Output the next fenced block as a code block:*

```
No bugfixes in progress.

Run /workflow-start to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### If `work_unit` argument `$0` provided

Store the work_unit.

→ Proceed to **Step 4**.

#### If `work_unit` not provided

→ Proceed to **Step 3**.

---

## Step 3: Select Bugfix

> *Output the next fenced block as a code block:*

```
── Select Bugfix ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing your active bugfixes for selection.
```

Load **[select-bugfix.md](references/select-bugfix.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Validate Selection

Load **[validate-selection.md](references/validate-selection.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Display State and Menu

> *Output the next fenced block as a code block:*

```
── Bugfix State ─────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing the bugfix's pipeline state and available actions.
```

Load **[bugfix-display-and-menu.md](references/bugfix-display-and-menu.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: Route Selection

Invoke the `route` stored for the user's selection — the selected `ACTIONS` entry's route from bugfix-display-and-menu.md (e.g. `/workflow-specification-entry bugfix {work_unit}`).

Skills receive positional arguments: `$0` = work_type (`bugfix`), `$1` = work_unit. Topic is inferred from work_unit.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
