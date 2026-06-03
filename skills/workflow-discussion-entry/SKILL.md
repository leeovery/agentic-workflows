---
name: workflow-discussion-entry
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(ls .workflows/)
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
> discussion to work with.
```

Arguments: work_type = `$0`, work_unit = `$1`, topic = `$2` (optional).
Resolve topic: topic = `$2`, or if not provided and work_type is not `epic`, topic = `$1`.

Store work_unit for the handoff.

#### If `topic` resolved

Check if discussion phase entry exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.discussion.{topic}
```

**If exists (`true`):**

→ Proceed to **Step 2** (Validate Phase).

**If not exists (`false` — new entry):**

Set `source = "topic-provided"`.

Load **[ensure-discovery-item.md](../workflow-shared/references/ensure-discovery-item.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, routing = `discussion`.

→ Proceed to **Step 3** (Gather Context).

#### If no `topic`

> *Output the next fenced block as a code block:*

```
What topic would you like to discuss?
```

**STOP.** Wait for user response.

Kebab-case the response, store as `{topic}`. Set `source = "fresh"`.

Silently derive `direct_entry_summary` (one-line) and `direct_entry_description` (one or two paragraphs) from the user's response. Do not render anything — these are local variables passed to `ensure-discovery-item` in Step 2. The derivation is part of the same Claude turn that kebab-cases the response; no separate STOP gate.

→ Proceed to **Step 2** (Validate Phase).

---

## Step 2: Validate Phase

> *Output the next fenced block as a code block:*

```
── Validate Phase ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the status of this discussion — new,
> in progress, or completed.
```

Load **[ensure-discovery-item.md](../workflow-shared/references/ensure-discovery-item.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, routing = `discussion`. On the direct-entry path (`source = "fresh"`), also pass summary = `{direct_entry_summary}`, description = `{direct_entry_description}`. On the topic-resolved path, omit both — the caller didn't derive them.

Load **[validate-phase.md](references/validate-phase.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Gather Context

> *Output the next fenced block as a code block:*

```
── Gather Context ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Collecting the context needed before starting the discussion.
```

#### If `work_type` is not `epic`

Single-phase work (feature, cross-cutting) shaped in discovery. The carrier has two halves — read both. First the manifest `description`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} description
```

Then the discovery session log. Single-phase work has exactly one, at a fixed path — it has no resumable loop to create others. Read `.workflows/{work_unit}/discovery/session-001.md`. A legacy work unit may have no log, or a placeholder log whose **Exploration** is absent or `(none)`.

**If the log's `Exploration` section has content (not absent or `(none)`):**

Seed the discussion from the `description` and that **Exploration**. Do not re-ask; live conversation context, when present, supplements the carrier.

→ Proceed to **Step 4**.

**Otherwise:**

No usable carrier — the log is missing or has no **Exploration**. Gather context.

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

#### If `work_type` is `epic`

The map item's `source` says whether the topic was shaped on the discovery map or started fresh from this entry. Read it:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{topic} source
```

**If `source` is exactly `direct-start`:**

The topic was started fresh, not shaped on the map — there is no curated carrier to seed from.

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

**Otherwise:**

The topic was shaped on the discovery map — its seed lives on the map item. Read the `description` and seed the discussion from it:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.discovery.{topic} description
```

Do not re-ask; live conversation context, when present, supplements the carrier.

→ Proceed to **Step 4**.

---

## Step 4: Invoke the Skill

> *Output the next fenced block as a code block:*

```
── Invoke Discussion ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Handing off to the discussion process with all
> gathered context.
```

Load **[invoke-skill.md](references/invoke-skill.md)** and follow its instructions as written.
