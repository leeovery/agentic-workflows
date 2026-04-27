---
name: continue-feature
allowed-tools: Bash(node .claude/skills/continue-feature/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
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

## Step 0: Initialisation

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  Continue Feature
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

Load **[knowledge-check.md](../workflow-shared/references/knowledge-check.md)** and follow its instructions as written.

→ Proceed to **Step 1**.

---

## Step 1: Discovery State

> *Output the next fenced block as a code block:*

```
── Run Discovery ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Scanning for active features and their current progress.
```

!`node .claude/skills/continue-feature/scripts/discovery.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/continue-feature/scripts/discovery.cjs
```

If discovery output is already displayed, it has been run on your behalf.

Parse the discovery output to understand:

**From `features` array:**
- `name` - the work unit name
- `next_phase` - the phase to route to
- `phase_label` - human-readable phase status
- `completed_phases` - list of completed phases (for backwards navigation)

**From top-level fields:**
- `count` - number of active features
- `summary` - human-readable state summary
- `completed` / `cancelled` - arrays of non-active features with name, status, last_phase
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
> Checking if there are any features in progress.
```

#### If `count` is 0

> *Output the next fenced block as a code block:*

```
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

> *Output the next fenced block as a code block:*

```
── Select Feature ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing your active features for selection.
```

Load **[select-feature.md](references/select-feature.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Validate Selection

> *Output the next fenced block as a code block:*

```
── Validate Selection ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Confirming the selected feature exists and is active.
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
> Handing off to the next phase for this feature.
```

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

If the user chose to revisit a completed phase in Step 5, use that phase instead of `next_phase`.

Invoke the skill. This is terminal — do not return to the backbone.
