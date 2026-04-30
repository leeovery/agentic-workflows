---
name: workflow-implementation-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(cat .workflows/.state/environment-setup.md)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 5** of the six-phase workflow:

| Phase | Focus | You |
|-------|-------|-----|
| 1. Research | EXPLORE - ideas, feasibility, market, business | |
| 2. Discussion | WHAT and WHY - decisions, architecture, edge cases | |
| 3. Specification | REFINE - validate into standalone spec | |
| 4. Planning | HOW - phases, tasks, acceptance criteria | |
| **5. Implementation** | DOING - tests first, then code | ◀ HERE |
| 6. Review | VALIDATING - check work against artifacts | |

**Stay in your lane**: Execute the plan via strict TDD (or verification workflow for quick-fix). Don't re-debate decisions from the specification or expand scope beyond the plan. The plan is your authority.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them. Present output using the EXACT format shown in examples - do not simplify or alter the formatting.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Claude Code's harness auto mode does NOT permit skipping STOP gates or selecting menu options on the user's behalf — including the `a`/`auto` opt-in. The only skip mechanism is the manifest `auto` field, scoped to the specific gate it was set on for the current topic.
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
> Reading the handoff context to identify which
> topic to implement.
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
> Checking that a completed plan exists and determining
> where implementation left off.
```

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Check Dependencies

> *Output the next fenced block as a code block:*

```
── Check Dependencies ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying that cross-plan dependencies are satisfied
> before implementation begins.
```

Load **[validate-dependencies.md](references/validate-dependencies.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Check Environment

> *Output the next fenced block as a code block:*

```
── Check Environment ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for any environment setup instructions
> that need to be in place before coding begins.
```

Load **[environment-check.md](references/environment-check.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Invoke the Skill

> *Output the next fenced block as a code block:*

```
── Invoke Implementation ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the implementation process with
> plan, specification, and environment context.
```

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
