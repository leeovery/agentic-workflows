---
name: workflow-research-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 1** of the six-phase workflow:

| Phase             | Focus                                              | You    |
|-------------------|----------------------------------------------------|--------|
| **1. Research**   | EXPLORE - ideas, feasibility, market, business     | ◀ HERE |
| 2. Discussion     | WHAT and WHY - decisions, architecture, edge cases |        |
| 3. Specification  | REFINE - validate into standalone spec             |        |
| 4. Planning       | HOW - phases, tasks, acceptance criteria           |        |
| 5. Implementation | DOING - tests first, then code                     |        |
| 6. Review         | VALIDATING - check work against artifacts          |        |

**Stay in your lane**: Explore freely. This is the time for broad thinking, feasibility checks, and learning. Surface options and tradeoffs — don't make decisions. When a topic converges toward a conclusion, that's a signal it's ready for discussion phase, not a cue to start deciding. Park it and move on.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them. Present output using the EXACT format shown in examples - do not simplify or alter the formatting.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Even if the user's initial prompt seems to answer a question, still confirm with them at the appropriate step
- Complete each step fully before moving to the next
- Do not act on gathered information until the skill is loaded - it contains the instructions for how to proceed

---

## Step 1: Parse Arguments

> *Output the next fenced block as a code block:*

```
── Parse Arguments ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reading the handoff context and determining which
> research topic to work with.
```

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_unit for the handoff.

Resolve filename:

#### If source is `import`

`resolved_filename = {topic}.md`

→ Proceed to **Step 5**.

#### If work_type is `feature`

`resolved_filename = {topic}.md`

→ Proceed to **Step 2**.

#### If work_type is `epic` and `topic` resolved

`resolved_filename = {topic}.md`

→ Proceed to **Step 2**.

#### If work_type is `epic` and no `topic`

Deferred — gather-context will resolve it.

→ Proceed to **Step 4**.

---

## Step 2: Check Phase Entry

> *Output the next fenced block as a code block:*

```
── Check Phase Entry ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking if research already exists for this topic.
```

Check if the research phase entry exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.research.{topic}
```

#### If exists (`true`)

→ Proceed to **Step 3**.

#### If not exists (`false`)

→ Proceed to **Step 4**.

---

## Step 3: Validate Phase

> *Output the next fenced block as a code block:*

```
── Validate Phase ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the status of this research — in progress
> or completed.
```

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 4: Gather Context

> *Output the next fenced block as a code block:*

```
── Gather Context ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Collecting initial context to seed the research session.
```

#### If research context is already available in conversation

The caller already gathered context (idea description, motivation, constraints). Do not re-ask.

→ Proceed to **Step 5**.

#### Otherwise

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Invoke the Skill

> *Output the next fenced block as a code block:*

```
── Invoke Research ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the research process with all
> gathered context.
```

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
