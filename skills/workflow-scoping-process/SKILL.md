---
name: workflow-scoping-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(tick), Bash(ls .workflows/), Bash(rm -rf .workflows/), Bash(git status), Bash(git log), Bash(git rev-parse), Bash(git add), Bash(git commit)
---

# Scoping Process

Act as **expert technical analyst** performing rapid scoping of a mechanical change. Assess scope, write a lightweight specification, and produce 1-2 task files — all in a single pass.

## Purpose in the Workflow

Scope a mechanical change — gather context, write a specification, and produce a plan with 1-2 task files ready for implementation.

## What This Skill Needs

- **Work unit description** (required) - From the manifest, summarising the mechanical change
- **Topic name** (required) - Same as work_unit for quick-fix
- **Output format preference** (optional) - Will ask if not specified

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- Don't invent stops. Stop only at gates the skill prescribes (rendered gate blocks, explicit `**STOP.**` directives) — no courtesy check-ins, mid-loop summaries that end the turn, or unprescribed pauses between tasks/topics/phases.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Check what artifacts exist on disk** — spec file, plan file, task files. Their presence reveals which steps completed.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

1. **Maximum 2 tasks** — if the change needs more, it's not a quick-fix. Promote it.
2. **No acceptance criteria** — mechanical changes are verified by test baselines and completeness checks, not by acceptance criteria.
3. **No agents** — scoping writes specs and tasks directly, without invoking planning agents or review cycles.

---

## Step 0: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for existing scoping work. If a spec and plan
> already exist, you can adjust them, rescope from scratch,
> or skip ahead.
```

Check if a specification already exists:

```bash
ls .workflows/{work_unit}/specification/{topic}/specification.md 2>/dev/null && echo "exists" || echo "none"
```

#### If specification does not exist

→ Proceed to **Step 1**.

#### If specification exists

Read the plan and scoping statuses:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} status
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.scoping.{topic} status
```

**If plan status is `completed` and scoping status is `in-progress`** (reopened for revisit):

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Found completed scoping for **{topic:(titlecase)}** — spec and plan are in place.

- **`c`/`continue`** — Adjust the existing spec and plan
- **`r`/`restart`** — Erase the spec, plan, and task files, then rescope from scratch
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If plan status is `completed` and scoping status is not `in-progress`:**

> *Output the next fenced block as a code block:*

```
Scoping already completed for "{topic:(titlecase)}". Spec and plan are in place.
```

If the scoping status read was empty (item missing), register and complete it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} scoping {topic}
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} scoping {topic}
```

→ Proceed to **Step 8**.

**If plan status is not `completed`** (empty or `in-progress`):

The spec exists but the plan is incomplete — an interrupted prior run. Rebuild the context the interrupted run had:

1. Read `.workflows/{work_unit}/specification/{topic}/specification.md` in full — it is the gathered context Step 7 authors tasks from.
2. Read the specification item's status:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} status
   ```
   If the output is empty (the run crashed between writing the spec file and registering it), register and index it now:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} specification {topic}
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} specification {topic}
   ```
   If the `complete` response carries `warnings`, display them but do not block — the artifact is already saved.
3. Reconcile tasks the interrupted run may already have created in an external backend:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
   ```
   If both are set, load the format's **[reading.md](../workflow-planning-process/references/output-formats/{format}/reading.md)** and list the tasks already created under `external_id`. Carry that list into Step 7 — existing tasks are adjusted or completed, never re-authored as duplicates. If either read is empty, nothing was authored — resume cleanly.

→ Proceed to **Step 6** (resume from format selection).

#### If `continue`

Load the artifacts as session context: read the spec (`.workflows/{work_unit}/specification/{topic}/specification.md`) and the plan (`.workflows/{work_unit}/planning/{topic}/planning.md`) in full, then read the `format` and the plan's `external_id` from the manifest and locate and read the task files via the format's **[reading.md](../workflow-planning-process/references/output-formats/{format}/reading.md)**:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
```

> *Output the next fenced block as a code block:*

```
Revisiting scoping for "{topic:(titlecase)}".

What should change in the spec or plan?
```

**STOP.** Wait for user response.

Apply the requested edits — the spec and `planning.md` directly, task file content per the format's **[authoring.md](../workflow-planning-process/references/output-formats/{format}/authoring.md)**. Hard rules still hold: maximum 2 tasks, no acceptance criteria. Then:

1. If the spec changed, re-index it (re-completion re-indexes over the same identity):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} specification {topic}
   ```
2. Re-complete scoping:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} scoping {topic}
   ```
3. Commit with raw git — the format's task storage may live outside the work unit, so the scoped helper cannot cover it:
   ```bash
   git add -- .workflows/{work_unit} .workflows/.knowledge {format task storage paths touched}
   git commit -m "scoping({work_unit}): adjust specification and plan"
   ```

→ Proceed to **Step 8**.

#### If `restart`

1. Read the `format` and the plan's `external_id` from the manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
   ```
2. Load the format's **[authoring.md](../workflow-planning-process/references/output-formats/{format}/authoring.md)**
3. Follow the authoring file's cleanup instructions to remove authored tasks for this topic — the cleanup targets the entity identified by `external_id`
4. Delete the spec and plan files: `rm -rf .workflows/{work_unit}/specification/{topic}/ .workflows/{work_unit}/planning/{topic}/`
5. Remove the spec's knowledge-base entry:
   ```bash
   node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {work_unit} --phase specification --topic {topic}
   ```
6. Delete the specification and planning manifest entries — the scoping item stays `in-progress`; the fresh run re-completes it at Write Tasks:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.specification items.{topic}
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.planning items.{topic}
   ```
7. Commit with raw git — the format's cleanup may remove task storage outside the work unit, so the scoped helper cannot cover it. Stage the work unit, the knowledge store, and every path the cleanup touched, then commit:
   ```bash
   git add -- .workflows/{work_unit} .workflows/.knowledge {paths the format cleanup touched}
   git commit -m "scoping({work_unit}): restart scoping"
   ```

→ Proceed to **Step 1**.

---

## Step 1: Knowledge Usage

> *Output the next fenced block as a code block:*

```
── Knowledge Usage ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the usage guide for the knowledge base so
> proactive querying is available while scoping the change.
```

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Gather Context

> *Output the next fenced block as a code block:*

```
── Gather Context ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Understanding what needs changing — reading code, asking
> clarifying questions, and building a picture of the change.
```

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

*Knowledge-base nudge — if the change touches an area with prior discussions, investigations, or specs, query the knowledge base while gathering context. A "mechanical change" often has a history. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*

→ On return, proceed to **Step 3**.

---

## Step 3: Contextual Query

> *Output the next fenced block as a code block:*

```
── Contextual Query ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the knowledge base for prior discussions, investigations,
> or specs that touch the area being changed.
```

Load **[contextual-query.md](../workflow-knowledge/references/contextual-query.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Complexity Check

> *Output the next fenced block as a code block:*

```
── Complexity Check ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Assessing whether this change fits the quick-fix model.
> If it's too complex, it should be promoted to a feature.
```

Load **[complexity-check.md](references/complexity-check.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Write Specification

> *Output the next fenced block as a code block:*

```
── Write Specification ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Writing a lightweight specification for the change.
> This captures what's changing and why.
```

Load **[write-specification.md](references/write-specification.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: Select Output Format

> *Output the next fenced block as a code block:*

```
── Select Output Format ─────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Choosing the output format for task files.
```

Load **[select-format.md](references/select-format.md)** and follow its instructions as written.

→ On return, proceed to **Step 7**.

---

## Step 7: Write Tasks

> *Output the next fenced block as a code block:*

```
── Write Tasks ──────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Writing 1-2 task files for the change. Quick-fixes
> are limited to two tasks maximum.
```

Load **[write-tasks.md](references/write-tasks.md)** and follow its instructions as written.

→ On return, proceed to **Step 8**.

---

## Step 8: Conclude Scoping

> *Output the next fenced block as a code block:*

```
── Conclude Scoping ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Spec and plan are ready for implementation.
```

Load **[conclude-scoping.md](references/conclude-scoping.md)** and follow its instructions as written.
