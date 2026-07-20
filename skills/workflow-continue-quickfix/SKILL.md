---
name: workflow-continue-quickfix
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-continue-quickfix/scripts/gateway.cjs), Bash(node .claude/skills/workflow-start/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(tick)
---

Continue an in-progress quick-fix. Determines current phase and routes to the appropriate phase skill.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- Don't invent stops. Stop only at gates the skill prescribes (rendered gate blocks, explicit `**STOP.**` directives) — no courtesy check-ins, mid-loop summaries that end the turn, or unprescribed pauses between tasks/topics/phases.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

---

## Step 0: Initialisation

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Continue Quick-Fix
●───────────────────────────────────────────────●

```

> *Output the next fenced block as a code block:*

```
── Initialisation ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading shared display conventions for this session.
```

Load **[casing-conventions.md](../workflow-shared/references/casing-conventions.md)** and follow its instructions as written.

→ Proceed to **Step 1**.

---

## Step 1: Discovery State

> *Output the next fenced block as a code block:*

```
── Run Discovery ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Scanning for active quick-fixes and their current progress.
```

!`node .claude/skills/workflow-continue-quickfix/scripts/gateway.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/workflow-continue-quickfix/scripts/gateway.cjs
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From the `=== QUICK-FIXES (N) ===` section:**
- one line per active quick-fix — `{name}: {phase_label}`
- `count` — the header count of active quick-fixes

**From the `=== COMPLETED (N) ===` / `=== CANCELLED (N) ===` sections:**
- one line per closed quick-fix — `{name} (last phase: {phase})`
- `completed_count` / `cancelled_count` — the header counts

Anything richer (next phase, completed phases, revisit routes) comes from the `view` snapshot at Step 5 — this dump is the index, not the state surface.

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 2**.

---

## Step 2: Check Count and Arguments

> *Output the next fenced block as a code block:*

```
── Check State ──────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking if there are any quick-fixes in progress.
```

#### If `count` is 0

> *Output the next fenced block as a code block:*

```
No quick-fixes in progress.

Run /workflow-start to begin a new one.
```

**STOP.** Do not proceed — terminal condition.

#### If `work_unit` argument `$0` provided

Store the work_unit.

→ Proceed to **Step 4**.

#### If `work_unit` not provided

→ Proceed to **Step 3**.

---

## Step 3: Select Quick-Fix

> *Output the next fenced block as a code block:*

```
── Select Quick-Fix ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing your active quick-fixes for selection.
```

Load **[select-quickfix.md](references/select-quickfix.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Validate Selection

> *Output the next fenced block as a code block:*

```
── Validate Selection ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Confirming the selected quick-fix exists and is active.
```

Load **[validate-selection.md](references/validate-selection.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Display State and Menu

> *Output the next fenced block as a code block:*

```
── Display State and Menu ───────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing the quick-fix's pipeline state and available actions.
```

Load **[quickfix-display-and-menu.md](references/quickfix-display-and-menu.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Route Selection

> *Output the next fenced block as a code block:*

```
── Route Selection ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the selected phase for this quick-fix.
```

Invoke the `route` stored for the user's selection — the selected `ACTIONS` entry's route from quickfix-display-and-menu.md (e.g. `/workflow-implementation-entry quick-fix {work_unit}`).

Skills receive positional arguments: `$0` = work_type (`quick-fix`), `$1` = work_unit. Topic is inferred from work_unit.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
