---
name: workflow-specification-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-specification-entry/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(mkdir -p .workflows/*/.state), Bash(rm .workflows/*/.state/discussion-consolidation-analysis.md)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

This is **Phase 3** of the six-phase workflow:

| Phase                | Focus                                              | You    |
|----------------------|----------------------------------------------------|--------|
| 1. Research          | EXPLORE - ideas, feasibility, market, business     |        |
| 2. Discussion        | WHAT and WHY - decisions, architecture, edge cases |        |
| **3. Specification** | REFINE - validate into standalone spec             | ◀ HERE |
| 4. Planning          | HOW - phases, tasks, acceptance criteria           |        |
| 5. Implementation    | DOING - tests first, then code                     |        |
| 6. Review            | VALIDATING - check work against artifacts          |        |

**Stay in your lane**: Validate and refine discussion content into standalone specifications. Don't jump to planning, phases, tasks, or code. The specification is the "line in the sand" - everything after this has hard dependencies on it.

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
> Reading the handoff context and determining which
> specification to work with.
```

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_unit for the handoff.

#### If `topic` resolved

→ Proceed to **Step 2** (Validate Source Material).

#### If no `topic` (epic — scoped path)

Run discovery scoped to this work unit:

```bash
node .claude/skills/workflow-specification-entry/scripts/discovery.cjs {work_unit}
```

Parse the discovery output to understand:

**From `discussions` array:** Each discussion's name, work_unit, status, work_type, and whether it has an individual specification.

**From `specifications` array:** Each specification's name, work_unit, status, work_type, sources, and superseded_by (if applicable). Specifications with `status: superseded` should be noted but excluded from active counts.

**From `cache` section:** `entries` array — each entry has `status` (valid/stale), `reason`, `generated`, `anchored_names`. Empty array if no cache exists.

**From `current_state`:** `completed_count`, `spec_count`, `has_discussions`, `has_completed`, `has_specs`, and other counts/booleans for routing.

**IMPORTANT**: Use ONLY this script for discovery. Do NOT run additional bash commands (ls, head, cat, etc.) to gather state.

→ Proceed to **Step 5** (Check Prerequisites).

---

## Step 2: Validate Source Material

> *Output the next fenced block as a code block:*

```
── Validate Source Material ─────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking that the required source material is ready
> — completed discussions or investigations.
```

Load **[validate-source.md](references/validate-source.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Validate Phase

> *Output the next fenced block as a code block:*

```
── Validate Phase ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking whether a specification already exists
> for this topic.
```

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Invoke the Skill

> *Output the next fenced block as a code block:*

```
── Invoke Specification ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the specification process with all
> gathered context.
```

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.

---

## Step 5: Check Prerequisites

> *Output the next fenced block as a code block:*

```
── Check Prerequisites ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying that completed discussions are available
> to build specifications from.
```

Load **[check-prerequisites.md](references/check-prerequisites.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Route Based on State

> *Output the next fenced block as a code block:*

```
── Route Based on State ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Evaluating what discussions and specifications exist
> to determine next steps.
```

Load **[route-scenario.md](references/route-scenario.md)** and follow its instructions as written.
