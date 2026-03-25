---
name: start-cross-cutting
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(ls .workflows/), Bash(mkdir -p .workflows/.inbox/.archived/), Bash(mv .workflows/.inbox/)
---

Start a new cross-cutting concern. Gather a brief description, create the work unit, and route to the first phase.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Complete each step fully before moving to the next

---

## Step 0: Initialisation

Load **[casing-conventions.md](../workflow-shared/references/casing-conventions.md)** and follow its instructions as written.

**Run migrations — this is mandatory. You must complete it before proceeding.**

Invoke the `/workflow-migrate` skill and follow its instructions exactly — if it issues a STOP gate, you must stop.

→ Proceed to **Step 1**.

---

## Step 1: Gather Cross-Cutting Context

#### If inbox file path was provided as positional argument (`$0`)

Read the inbox file at the provided path. Use its content as the description — skip the gather-context prompt. The slug from the filename (strip the `YYYY-MM-DD--` prefix, strip `.md`) becomes the suggested work unit name in Step 2.

→ Proceed to **Step 2**.

#### Otherwise

Load **[gather-cc-context.md](references/gather-cc-context.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Name and Conflict Check

Load **[name-check.md](references/name-check.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Route to First Phase

Load **[research-gating.md](references/research-gating.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Invoke Entry-Point Skill

Invoke the appropriate entry-point skill based on the selected phase:

| Phase | Invoke |
|-------|--------|
| research | `/workflow-research-entry cross-cutting {work_unit}` |
| discussion | `/workflow-discussion-entry cross-cutting {work_unit}` |

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.
