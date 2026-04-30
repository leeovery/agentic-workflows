---
name: start-quickfix
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(ls .workflows/), Bash(mkdir -p .workflows/.inbox/.archived/), Bash(mv .workflows/.inbox/)
---

Start a new quick-fix. Gather a brief description, create the work unit, and route to scoping.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Claude Code's harness auto mode does NOT permit skipping STOP gates or selecting menu options on the user's behalf — including the `a`/`auto` opt-in. The only skip mechanism is the manifest `auto` field, scoped to the specific gate it was set on for the current topic.
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
  New Quick-Fix
●───────────────────────────────────────────────●

```

> *Output the next fenced block as markdown (not a code block):*

```
> Starting a new quick-fix. I'll ask what needs changing, suggest
> a name, then hand off to scoping — which combines context, spec,
> and plan into a single streamlined pass.
```

Load **[knowledge-check.md](../workflow-knowledge/references/knowledge-check.md)** and follow its instructions as written.

→ Proceed to **Step 1**.

---

## Step 1: Gather Quick-Fix Context

> *Output the next fenced block as a code block:*

```
── Gather Context ───────────────────────────────
```

#### If inbox file path was provided as positional argument (`$0`)

> *Output the next fenced block as markdown (not a code block):*

```
> Using context from your inbox item. Reading the inbox file
> to understand the change and suggest a name.
```

Read the inbox file at the provided path. Use its content as the quick-fix description — skip the gather-context prompt. The slug from the filename (strip the `YYYY-MM-DD--` prefix, strip `.md`) becomes the suggested work unit name in Step 2.

→ Proceed to **Step 2**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
> Gathering context about the quick-fix. Describe what needs
> changing, where, and why.
```

Load **[gather-quickfix-context.md](references/gather-quickfix-context.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Quick-Fix Name and Conflict Check

> *Output the next fenced block as a code block:*

```
── Quick-Fix Name ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Naming the quick-fix and checking for conflicts. The name
> becomes the identifier used throughout the workflow.
```

Load **[name-check.md](references/name-check.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Invoke Entry-Point Skill

> *Output the next fenced block as a code block:*

```
── Invoke Scoping ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the scoping phase. This will gather context,
> build a lightweight spec, and create the implementation plan
> in a single pass.
```

Invoke `/workflow-scoping-entry quick-fix {work_unit}`.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
