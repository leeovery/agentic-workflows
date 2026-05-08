---
name: continue-bugfix
allowed-tools: Bash(node .claude/skills/continue-bugfix/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

Continue an in-progress bugfix. Determines current phase and routes to the appropriate phase skill.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

---

## Step 0: Initialisation

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Continue Bugfix
●───────────────────────────────────────────────●

```

> *Output the next fenced block as a code block:*

```
── Initialisation ───────────────────────────────
```

### Step 0.1: Casing Conventions

Load **[casing-conventions.md](../workflow-shared/references/casing-conventions.md)** and follow its instructions as written.

→ Proceed to **Step 0.2**.

### Step 0.2: Migrations

#### If the `/workflow-migrate` skill has already been invoked in this conversation

→ Proceed to **Step 0.3**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
> Running migrations to keep workflow files in sync.
```

**Run migrations — this is mandatory. You must complete it before proceeding.**

Invoke the `/workflow-migrate` skill and follow its instructions exactly — if it issues a STOP gate, you must stop.

**CRITICAL**: When the migrate skill returns (either after committing changes or reporting no changes needed), you MUST continue to **Step 0.3**. Do not stop after migration completes.

→ Proceed to **Step 0.3**.

### Step 0.3: Knowledge Check

Load **[knowledge-check.md](../workflow-knowledge/references/knowledge-check.md)** and follow its instructions as written.

→ Proceed to **Step 1**.

---

## Step 1: Discovery State

> *Output the next fenced block as a code block:*

```
── Run Discovery ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Scanning for active bugfixes and their current progress.
```

!`node .claude/skills/continue-bugfix/scripts/discovery.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/continue-bugfix/scripts/discovery.cjs
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From `bugfixes` array:**
- `name` - the work unit name
- `next_phase` - the phase to route to
- `phase_label` - human-readable phase status
- `completed_phases` - list of completed phases (for backwards navigation)

**From top-level fields:**
- `count` - number of active bugfixes
- `summary` - human-readable state summary
- `completed` / `cancelled` - arrays of non-active bugfixes with name, status, last_phase
- `completed_count` / `cancelled_count` - counts for each

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
> Checking if there are any bugfixes in progress.
```

#### If `count` is 0

> *Output the next fenced block as a code block:*

```
No bugfixes in progress.

Run /start-bugfix to begin a new one.
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

→ Proceed to **Step 4**.

---

## Step 4: Validate Selection

> *Output the next fenced block as a code block:*

```
── Validate Selection ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Confirming the selected bugfix exists and is active.
```

Load **[validate-selection.md](references/validate-selection.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Backwards Navigation

> *Output the next fenced block as a code block:*

```
── Check Progress ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking whether earlier phases are available to revisit.
```

Load **[revisit-phase.md](references/revisit-phase.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Route to Phase Skill

> *Output the next fenced block as a code block:*

```
── Route to Phase ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the next phase for this bugfix.
```

Using the selected bugfix's `next_phase`, invoke the appropriate phase skill:

| next_phase | Invoke |
|------------|--------|
| investigation | `/workflow-investigation-entry bugfix {work_unit}` |
| specification | `/workflow-specification-entry bugfix {work_unit}` |
| planning | `/workflow-planning-entry bugfix {work_unit}` |
| implementation | `/workflow-implementation-entry bugfix {work_unit}` |
| review | `/workflow-review-entry bugfix {work_unit}` |

Skills receive positional arguments: `$0` = work_type (`bugfix`), `$1` = work_unit. Topic is inferred from work_unit.

If the user chose to revisit a completed phase in Step 5, use that phase instead of `next_phase`.

Invoke the skill.

**STOP.** Do not proceed — terminal condition.
