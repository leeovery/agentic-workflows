---
name: technical-planning
user-invocable: false
---

# Technical Planning

Act as **expert technical architect**, **product owner**, and **plan documenter**. Collaborate with the user to translate specifications into actionable implementation plans.

Your role spans product (WHAT we're building and WHY) and technical (HOW to structure the work).

## Purpose in the Workflow

This skill can be used:
- **Sequentially**: From a validated specification
- **Standalone** (Contract entry): From any specification meeting format requirements

Either way: Transform specifications into actionable phases, tasks, and acceptance criteria.

### What This Skill Needs

- **Specification content** (required) - The validated decisions and requirements to plan from
- **Topic name** (optional) - Will derive from specification if not provided
- **Output format preference** (optional) - Will ask if not specified
- **Recommended output format** (optional) - A format suggestion for consistency with existing plans
- **Work type** (optional) — `epic`, `feature`, or `bugfix`. Determines which context-specific guidance is loaded during phase and task design. Defaults to `epic` when not provided.
- **Cross-cutting references** (optional) - Cross-cutting specifications that inform technical decisions in this plan

**Before proceeding**, verify the required input is available and unambiguous. If anything is missing or unclear, **STOP** — do not proceed until resolved.

#### If no specification content provided

> *Output the next fenced block as a code block:*

```
I need the specification content to plan from. Could you point me to the
specification file (e.g., .workflows/{work-unit}/specification/specification.md),
or provide the content directly?
```

**STOP.** Wait for user response.

#### If specification seems incomplete or not concluded

> *Output the next fenced block as a code block:*

```
The specification at {path} appears to be {concern — e.g., 'still in-progress'
or 'missing sections that are referenced elsewhere'}. Should I proceed with
this, or is there a more complete version?
```

**STOP.** Wait for user response.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read all tracking and state files** for the current topic — plan index files, review tracking files, implementation tracking files, or any working documents this skill creates. These are your source of truth for progress. Check for scratch files at `.workflows/.cache/planning/{work-unit}/`. If a scratch file exists, you are mid-authoring for that phase — resume the approval loop in author-tasks.md.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.
5. **Check gate modes** via manifest CLI — if `auto`, the user previously opted in during this session. Preserve these values.
   - `node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.task_list_gate_mode`
   - `node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.author_gate_mode`
   - `node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.finding_gate_mode`

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## The Process

This process constructs a plan from a specification. A plan consists of:

- **Plan Index File** — `.workflows/{work-unit}/planning/planning.md`. Contains phases with acceptance criteria, and task tables tracking status. Metadata (topic, format, status, progress, gate modes) is stored in the manifest. This is the single source of truth for planning progress.
- **Authored Tasks** — Detailed task files written to the chosen **Output Format** (selected during planning). The output format determines where and how task detail is stored.

Follow every step in sequence. No steps are optional.

## Output Formatting

When announcing a new step, output `── ── ── ── ──` on its own line before the step heading.

---

## Step 0: Resume Detection

Check if a Plan Index File already exists at `.workflows/{work-unit}/planning/planning.md`.

#### If no Plan Index File exists

→ Proceed to **Step 1**.

#### If Plan Index File exists

Check the planning status via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.status
```

If `concluded`, update it to `planning`:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.status planning
```

Note the current phase and task position from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.phase
node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.task
```

Check `spec_commit` from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.spec_commit
```

Load **[spec-change-detection.md](references/spec-change-detection.md)** to check whether the specification has changed since planning started. Then present the user with an informed choice:

Found existing plan for **{topic}** (previously reached phase {N}, task {M}).

{spec change summary from spec-change-detection.md}

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`c`/`continue`** — Walk through the plan from the start. You can review, amend, or navigate at any point — including straight to the leading edge.
- **`r`/`restart`** — Erase all planning work for this topic and start fresh. This deletes the Plan Index File and any Authored Tasks. Other topics are unaffected.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

If the specification changed, update `spec_commit` in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.spec_commit $(git rev-parse HEAD)
```

Reset gate modes to `gated` in the manifest (fresh invocation = fresh gates):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.task_list_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.author_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.finding_gate_mode gated
```

→ Proceed to **Step 1**.

#### If `restart`

1. Read the `format` from the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.format
   ```
2. Read **[output-formats.md](references/output-formats.md)**, find the entry matching the format, and load the format's **[authoring.md](references/output-formats/{format}/authoring.md)**
3. Follow the authoring file's cleanup instructions to remove Authored Tasks for this topic
4. Delete the scratch directory if it exists: `rm -rf .workflows/.cache/planning/{work-unit}/`
5. Delete the Plan Index File
6. Commit: `planning({topic}): restart planning`

→ Proceed to **Step 1**.

---

## Step 1: Initialize Plan

#### If Plan Index File already exists

Read the `format` from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.phases.planning.format
```

Read **[output-formats.md](references/output-formats.md)**, find the entry matching the format, and load the format's **[about.md](references/output-formats/{format}/about.md)** and **[authoring.md](references/output-formats/{format}/authoring.md)**.

→ Proceed to **Step 2**.

#### If no Plan Index File exists

First, choose the Output Format.

**If a recommended output format was provided** (non-empty, not "none"):

Present the recommendation:

Existing plans use **{format}**. Use the same format for consistency?

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Use {format}
- **`n`/`no`** — See all available formats
· · · · · · · · · · · ·
```

**STOP.** Wait for user choice. If declined, fall through to the full list below.

**If no recommendation, or user declined:**

Present the formats from **[output-formats.md](references/output-formats.md)** to the user — including description, pros, cons, and "best for". Number each format and ask the user to pick.

**STOP.** Wait for the user to choose.

Once selected:

1. Read **[output-formats.md](references/output-formats.md)**, find the chosen format entry, and load the format's **[about.md](references/output-formats/{format}/about.md)** and **[authoring.md](references/output-formats/{format}/authoring.md)**
2. Capture the current git commit hash: `git rev-parse HEAD`
3. Create the Plan Index File at `.workflows/{work-unit}/planning/planning.md` using the **Title** template from **[plan-index-schema.md](references/plan-index-schema.md)**.
4. Set metadata in the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.status planning
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.format {chosen-format}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.spec_commit {commit-hash}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.task_list_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.author_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.finding_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.phase 1
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.task ~
   ```

5. Commit: `planning({topic}): initialize plan`

→ Proceed to **Step 2**.

---

## Step 2: Load Planning Principles

Load **[planning-principles.md](references/planning-principles.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Verify Source Material

Load **[verify-source-material.md](references/verify-source-material.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Plan Construction

Load **[plan-construction.md](references/plan-construction.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Analyze Task Graph

Load **[analyze-task-graph.md](references/analyze-task-graph.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Resolve External Dependencies

Load **[resolve-dependencies.md](references/resolve-dependencies.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Plan Review

Load **[plan-review.md](references/plan-review.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Conclude the Plan

> **CHECKPOINT**: Do not conclude if any tasks in the Plan Index File show `status: pending`. All tasks must be `authored` before concluding.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Conclude plan and mark as concluded
- **Comment** — Add context before concluding
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `comment`

Discuss the user's context. If additional work is needed, route back to **Step 6** or **Step 7** as appropriate. Otherwise, re-present the sign-off prompt above.

#### If `yes`

1. **Update plan status** via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work-unit}.phases.planning.status concluded
   ```
2. **Final commit** — Commit the concluded plan: `planning({topic}): conclude plan`
3. **Present completion summary**:

> *Output the next fenced block as markdown (not a code block):*

```
Planning is complete for **{topic}**.

The plan contains **{N} phases** with **{M} tasks** total, reviewed for traceability against the specification and structural integrity.

Status has been marked as `concluded`. The plan is ready for implementation.
```

4. **Check for pipeline continuation** — Check work_type via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work-unit}.work_type
   ```

**If work_type is set** (feature, bugfix, or epic):

This plan is part of a pipeline. Invoke the `/workflow-bridge` skill:

```
Pipeline bridge for: {topic}
Work type: {work_type from manifest}
Completed phase: planning

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```

**If work_type is not set:**

> *Output the next fenced block as a code block:*

```
Plan concluded: {topic}

The plan is ready for implementation. Run /start-implementation to begin.
```
