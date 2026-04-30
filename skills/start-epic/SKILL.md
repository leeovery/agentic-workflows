---
name: start-epic
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(ls .workflows/), Bash(mkdir -p .workflows/.inbox/.archived/), Bash(mv .workflows/.inbox/)
---

Start a new epic. Gather a brief description, create the work unit, and route to the first phase.

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
  New Epic
●───────────────────────────────────────────────●

```

> *Output the next fenced block as markdown (not a code block):*

```
> Starting a new epic. I'll ask what you're building, suggest
> a name, then you'll choose whether to research first or go
> straight to discussion.
```

Load **[knowledge-check.md](../workflow-knowledge/references/knowledge-check.md)** and follow its instructions as written.

→ Proceed to **Step 1**.

---

## Step 1: Gather Epic Context

> *Output the next fenced block as a code block:*

```
── Gather Epic Context ──────────────────────────
```

#### If inbox file path was provided as positional argument (`$0`)

> *Output the next fenced block as markdown (not a code block):*

```
> Using context from your inbox item. Reading the inbox file
> to understand scope and suggest a name.
```

Read the inbox file at the provided path. Use its content as the epic description — skip the gather-context prompt. The slug from the filename (strip the `YYYY-MM-DD--` prefix, strip `.md`) becomes the suggested work unit name in Step 2.

→ Proceed to **Step 2**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
> Gathering context for the epic. A brief description is enough
> to understand the scope and suggest a name.
```

Load **[gather-epic-context.md](references/gather-epic-context.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Epic Name and Conflict Check

> *Output the next fenced block as a code block:*

```
── Epic Name ────────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Naming the epic and checking for conflicts. The name becomes
> the identifier used throughout the workflow.
```

Load **[name-check.md](references/name-check.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Route to First Phase

> *Output the next fenced block as a code block:*

```
── Choose Starting Phase ────────────────────────
```

Load **[route-first-phase.md](references/route-first-phase.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Invoke Entry-Point Skill

> *Output the next fenced block as a code block:*

```
── Invoke Phase Skill ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the selected phase. The next skill will load
> and guide you through the process.
```

Invoke the appropriate entry-point skill based on the selected phase:

| Phase | Invoke |
|-------|--------|
| research | `/workflow-research-entry epic {work_unit}` |
| discussion | `/workflow-discussion-entry epic {work_unit}` |

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
