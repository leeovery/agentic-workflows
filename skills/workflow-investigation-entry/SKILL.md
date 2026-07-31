---
name: workflow-investigation-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

You are in the **Investigation** phase of the bugfix pipeline:

**Investigation** → Specification → Planning → Implementation → Review

Investigation gathers symptoms and traces code to find the root cause before any fix is written.

**Stay in your lane**: Investigate the bug — gather symptoms, trace code, find root cause. Don't jump to fixing or implementing. This is the time for deep analysis.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Step 1: Parse Arguments

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Investigation is always bugfix work_type. Store work_unit for the handoff.

Read the investigation phase status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.investigation.{topic} status
```

Store the result as `phase_status`.

**If empty (no investigation entry):**

Set source="new".

→ Proceed to **Step 3** (Gather Bug Context).

**Otherwise (an entry exists):**

→ Proceed to **Step 2** (Validate Phase).

---

## Step 2: Validate Phase

Load **[validate-phase.md](references/validate-phase.md)** with phase_status = `{phase_status}`.

#### If source is `continue`

→ Proceed to **Step 4**.

#### Otherwise

→ Proceed to **Step 3**.

---

## Step 3: Gather Bug Context

> *Output the next fenced block as a code block:*

```
── Gather Bug Context ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Collecting information about the bug — what's broken,
> how it manifests, and any initial context.
```

#### If a discovery session log exists for this work unit

The bug was shaped in discovery. Read the durable carrier as the seed — the manifest `description` and the latest discovery session log (`.workflows/{work_unit}/discovery/sessions/session-NNN.md`, highest-numbered) — and seed the investigation from it. Do not re-ask; live conversation context, when present, supplements the carrier.

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.investigation.{topic} --verb Starting
```

→ Proceed to **Step 4**.

#### Otherwise

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
