---
name: workflow-specification-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-specification-entry/scripts/discovery.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/*/.state), Bash(rm .workflows/*/.state/discussion-consolidation-analysis.md)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

You are in the **Specification** phase — refining prior work into a standalone spec. Where Specification sits in the pipeline depends on the work type:

| Work type | Pipeline |
|---|---|
| Epic | Discovery → Research → Discussion → **Specification** → Planning → Implementation → Review |
| Feature | Discussion → **Specification** → Planning → Implementation → Review |
| Bugfix | Investigation → **Specification** → Planning → Implementation → Review |
| Cross-cutting | Research (optional) → Discussion → **Specification** (terminal) |

**Stay in your lane**: Validate and refine discussion content into standalone specifications. Don't jump to planning, phases, tasks, or code. The specification is the "line in the sand" - everything after this has hard dependencies on it.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them. Present output using the EXACT format shown in examples - do not simplify or alter the formatting.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- Don't invent stops. Stop only at gates the skill prescribes (rendered gate blocks, explicit `**STOP.**` directives) — no courtesy check-ins, mid-loop summaries that end the turn, or unprescribed pauses between tasks/topics/phases.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
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

Render the scoped snapshot:

```bash
node .claude/skills/workflow-specification-entry/scripts/discovery.cjs view {work_unit}
```

The output is one snapshot in up to three demarcated sections:

- **DATA** — reasoning surface: `scenario`, counts, `cache_status`, `discussions_checksum`, the discussion/specification detail (statuses, sources, consult references with slice hints), and — for scenarios with a menu — the `ACTIONS` key table (`key  action  topic  verb`). Reason from it; never display or restate it.
- **DISPLAY** — the scenario's overview block. Emitted verbatim as a code block, only where a later step directs.
- **MENU** — the scenario's selection menu. Emitted verbatim as markdown (not a code block), only where a later step directs. Absent for menu-less scenarios.

A section is everything beneath its `===` marker up to the next marker — the marker lines themselves are never emitted.

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
