---
name: workflow-scoping-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is the **entry phase** of the quick-fix pipeline:

| Phase | Focus | You |
|-------|-------|-----|
| **Scoping** | SCOPE - context, spec, plan in one pass | ◀ HERE |
| Implementation | DOING - execute the plan | |
| Review | VALIDATING - check work against artifacts | |

**Stay in your lane**: Gather context, validate prerequisites, and hand off to the processing skill. Don't analyse the change or assess complexity — that's the processing skill's job.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them. Present output using the EXACT format shown in examples - do not simplify or alter the formatting.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Claude Code's harness auto mode does NOT permit skipping STOP gates or selecting menu options on the user's behalf — including the `a`/`auto` opt-in. The only skip mechanism is the manifest `auto` field, scoped to the specific gate it was set on for the current topic.
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
> Reading the handoff context to identify which
> quick-fix to scope.
```

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_unit for the handoff.

→ Proceed to **Step 2**.

---

## Step 2: Validate Phase

> *Output the next fenced block as a code block:*

```
── Validate Phase ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking if scoping has already been started for
> this quick-fix.
```

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Invoke the Skill

> *Output the next fenced block as a code block:*

```
── Invoke Scoping ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the scoping process. This will gather
> context, build a spec, and create the plan in one pass.
```

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
