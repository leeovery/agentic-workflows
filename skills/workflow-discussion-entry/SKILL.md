---
name: workflow-discussion-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs)
---

Act as **precise intake coordinator**. Follow each step literally without interpretation. Do not engage with the subject matter — your role is preparation, not processing.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Workflow Context

You are in the **Discussion** phase — capturing WHAT and WHY through decisions, rationale, competing approaches, and edge cases. Where Discussion sits in the pipeline depends on the work type:

| Work type | Pipeline |
|---|---|
| Epic | Discovery → Research → (Experiment) → **Discussion** → Specification → Planning → Implementation → Review |
| Feature | Research (optional) → (Experiment) → **Discussion** → Specification → Planning → Implementation → Review |
| Cross-cutting | Research (optional) → (Experiment) → **Discussion** → Specification (terminal) |

**Stay in your lane**: Capture the WHAT and WHY - decisions, rationale, competing approaches, edge cases. Don't jump to specifications, plans, or code. This is the time for debate and documentation.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Step 1: Parse Arguments

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_unit for the handoff.

→ Proceed to **Step 2**.

---

## Step 2: Validate Research

Load **[validate-research.md](references/validate-research.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Check Phase Entry

Load **[ensure-discovery-item.md](../workflow-shared/references/ensure-discovery-item.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, routing = `discussion`.

Read the discussion phase status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic} status
```

Store the result as `phase_status`.

#### If output is empty (no discussion entry)

→ Proceed to **Step 5**.

#### Otherwise

→ Proceed to **Step 4**.

---

## Step 4: Validate Phase

Load **[validate-phase.md](references/validate-phase.md)** with phase_status = `{phase_status}`.

→ On return, proceed to **Step 5**.

---

## Step 5: Gather Context

Decide whether a context interview is needed. The durable inputs — the carrier, the discovery brief, completed research — are seeded by the processing skill, never from here; any read below only decides the route.

#### If `work_type` is not `epic` and `.workflows/{work_unit}/discovery/sessions/session-001.md` exists

Single-phase work (feature, cross-cutting) carries its context in the discovery session log — nothing to gather.

→ Proceed to **Step 6**.

#### If `work_type` is not `epic` and the work unit has no discovery session log

A cross-cutting unit promoted from an epic's specification carries no discovery session log, so nothing seeds the discussion — gather context.

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

#### If `work_type` is `epic`

The map item's `source` says whether the topic was shaped on the discovery map or started fresh from the epic menu. Read it, storing the result as `map_source`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery.{topic} source
```

**If `map_source` is exactly `direct-start`:**

The topic was started fresh, not shaped on the map — there is no curated carrier, so gather context.

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

**Otherwise:**

The topic was shaped on the discovery map — nothing to gather. A new discussion reads the brief at initialisation; a resumed one already carries its position in the discussion file.

→ Proceed to **Step 6**.

---

## Step 6: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
