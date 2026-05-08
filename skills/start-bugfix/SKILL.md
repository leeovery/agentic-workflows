---
name: start-bugfix
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(ls .workflows/), Bash(mkdir -p .workflows/.inbox/.archived/), Bash(mv .workflows/.inbox/)
---

Start a new bugfix. Gather a brief description, create the work unit, and route to investigation.

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

### Step 0.3: Intro and Knowledge Check

> *Output the next fenced block as a code block:*

```
●───────────────────────────────────────────────●
  New Bugfix
●───────────────────────────────────────────────●

```

> *Output the next fenced block as markdown (not a code block):*

```
> Starting a new bugfix. I'll ask what's broken, suggest a name,
> then hand off to investigation to diagnose the root cause.
```

Load **[knowledge-check.md](../workflow-knowledge/references/knowledge-check.md)** and follow its instructions as written.

→ Proceed to **Step 1**.

---

## Step 1: Gather Bug Context

> *Output the next fenced block as a code block:*

```
── Gather Bug Context ───────────────────────────
```

#### If inbox file path was provided as positional argument (`$0`)

> *Output the next fenced block as markdown (not a code block):*

```
> Using context from your inbox item. Reading the inbox file
> to understand the issue and suggest a name.
```

Read the inbox file at the provided path. Use its content as the bug description — skip the gather-context prompt. The slug from the filename (strip the `YYYY-MM-DD--` prefix, strip `.md`) becomes the suggested work unit name in Step 2.

→ Proceed to **Step 2**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
> Gathering context about the bug. A brief description of
> what's broken is enough to get started.
```

Load **[gather-bug-context.md](references/gather-bug-context.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Bugfix Name and Conflict Check

> *Output the next fenced block as a code block:*

```
── Bugfix Name ──────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Naming the bugfix and checking for conflicts. The name becomes
> the identifier used throughout the workflow.
```

Load **[name-check.md](references/name-check.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Invoke Entry-Point Skill

> *Output the next fenced block as a code block:*

```
── Invoke Investigation ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the investigation phase. This will gather
> symptoms and analyse code to find the root cause.
```

Invoke `/workflow-investigation-entry bugfix {work_unit}`.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
