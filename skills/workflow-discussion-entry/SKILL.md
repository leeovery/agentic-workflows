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
| Epic | Discovery → Research → **Discussion** → Specification → Planning → Implementation → Review |
| Feature | Research (optional) → **Discussion** → Specification → Planning → Implementation → Review |
| Cross-cutting | Research (optional) → **Discussion** → Specification (terminal) |

**Stay in your lane**: Capture the WHAT and WHY - decisions, rationale, competing approaches, edge cases. Don't jump to specifications, plans, or code. This is the time for debate and documentation.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Step 1: Parse Arguments

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_unit for the handoff.

#### If `topic` resolved

Read the discussion phase status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic} status
```

Store the result as `phase_status`.

**If empty (no discussion entry — new entry):**

Set `source = "topic-provided"`.

Load **[ensure-discovery-item.md](../workflow-shared/references/ensure-discovery-item.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, routing = `discussion`.

→ On return, proceed to **Step 3**.

**Otherwise (an entry exists):**

→ On return, proceed to **Step 2** (Validate Phase).

#### If no `topic`

> *Output the next fenced block as a code block:*

```
What topic would you like to discuss?
```

**STOP.** Wait for user response.

Kebab-case the response, store as `{topic}`. Set `source = "fresh"`.

Silently derive `direct_entry_summary` (one-line) and `direct_entry_description` (one or two paragraphs) from the user's response. Do not render anything — these are local variables passed to `ensure-discovery-item` in Step 2. The derivation is part of the same Claude turn that kebab-cases the response; no separate STOP gate.

Read the discussion phase status for the resolved topic — a freshly named topic is usually empty, but this catches a collision with an existing discussion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic} status
```

Store the result as `phase_status`.

→ Proceed to **Step 2** (Validate Phase).

---

## Step 2: Validate Phase

Load **[ensure-discovery-item.md](../workflow-shared/references/ensure-discovery-item.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, routing = `discussion`. On the direct-entry path (`source = "fresh"`), also pass summary = `{direct_entry_summary}`, description = `{direct_entry_description}`. On the topic-resolved path, omit both — the caller didn't derive them.

Load **[validate-phase.md](references/validate-phase.md)** with phase_status = `{phase_status}`.

→ On return, proceed to **Step 3**.

---

## Step 3: Gather Context

Decide whether a context interview is needed. The durable inputs — the carrier, the discovery brief, completed research — are seeded by the processing skill, never from here; any read below only decides the route.

#### If `work_type` is not `epic`

Single-phase work (feature, cross-cutting) shaped in discovery leaves its carrier in the discovery session log. Single-phase work has exactly one, at a fixed path — it has no resumable loop to create others. Read `.workflows/{work_unit}/discovery/sessions/session-001.md` and check its **Exploration** section. A legacy work unit may have no log, or a placeholder log whose **Exploration** is absent or `(none)`.

**If the log's `Exploration` section has content (not absent or `(none)`):**

A usable carrier exists — nothing to gather.

→ Proceed to **Step 4**.

**Otherwise:**

No usable carrier — the log is missing or has no **Exploration**. Gather context.

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

#### If `work_type` is `epic`

The map item's `source` says whether the topic was shaped on the discovery map or started fresh from this entry. Read it, storing the result as `map_source`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discovery.{topic} source
```

**If `map_source` is exactly `direct-start`:**

The topic was started fresh, not shaped on the map — there is no curated carrier, so gather context.

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

**Otherwise:**

The topic was shaped on the discovery map — nothing to gather. A new discussion reads the brief at initialisation; a resumed one already carries its position in the discussion file.

→ Proceed to **Step 4**.

---

## Step 4: Invoke the Skill

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
