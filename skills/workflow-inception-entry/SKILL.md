---
name: workflow-inception-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

You are in the **Inception** phase of the epic pipeline — the curation surface where moving parts are named, classified as research or discussion, and shaped into the discovery map:

**Inception** → Research → Discussion → Specification → Planning → Implementation → Review

Inception is epic-only — features, bugfixes, quick-fixes, and cross-cutting work units skip this phase.

**Stay in your lane**: Inception is curatorial — name the moving parts, classify each as research or discussion, build the discovery map. Don't investigate (that's research). Don't decide (that's discussion). Hold the macro view; if the conversation tunnels into one item, anchor and return to mapping.

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them. Present output using the EXACT format shown in examples - do not simplify or alter the formatting.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
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
> Reading the handoff context. Inception is per-work-unit;
> topics emerge during the session.
```

Arguments: work_type = `$0`, work_unit = `$1`. Inception is epic-only and per-work-unit, so no `$2` topic argument is consumed.

Store `work_unit` for the handoff.

→ Proceed to **Step 2**.

---

## Step 2: Check Phase Entry

> *Output the next fenced block as a code block:*

```
── Check Phase Entry ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking whether inception items already exist for this
> work unit (refinement) or this is the first session.
```

Check if any inception items exist in the discovery map:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists '{work_unit}.inception.*'
```

#### If exists (`true`)

→ Proceed to **Step 3**.

#### If not exists (`false`)

Set `source` = `first-session`.

→ Proceed to **Step 4**.

---

## Step 3: Validate Phase

> *Output the next fenced block as a code block:*

```
── Validate Phase ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Inception items already exist — this is a refinement
> session.
```

Set `source` = `refinement` for the handoff.

→ Proceed to **Step 4**.

---

## Step 4: Gather Context

> *Output the next fenced block as a code block:*

```
── Gather Context ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the work-unit description and any imported seed
> files as starting context for the session.
```

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Invoke the Skill

> *Output the next fenced block as a code block:*

```
── Invoke Inception ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the inception process with all gathered
> context.
```

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
