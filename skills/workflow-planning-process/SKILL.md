---
name: workflow-planning-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

# Planning Process

Act as **expert technical architect**, **product owner**, and **plan documenter**. Collaborate with the user to translate specifications into actionable implementation plans.

Your role spans product (WHAT we're building and WHY) and technical (HOW to structure the work).

## Purpose in the Workflow

Follows specification. Transform the validated specification into actionable phases, tasks, and acceptance criteria.

### What This Skill Needs

- **Specification content** (required) - The validated specification from the prior phase
- **Topic name** (optional) - Will derive from specification if not provided
- **Output format preference** (optional) - Will ask if not specified
- **Work type** (required) — `epic`, `feature`, or `bugfix`. Determines which context-specific guidance is loaded during phase and task design.
- **Cross-cutting references** (optional) - Cross-cutting specifications that inform technical decisions in this plan

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read all tracking and state files** for the current topic — the Plan Index File (`.workflows/{work_unit}/planning/{topic}/planning.md`), task files in the `tasks/` subdirectory, and plan review tracking files (`review-*-tracking-c*.md`). These are your source of truth for progress. Check for scratch files at `.workflows/.cache/planning/{work_unit}/{topic}/`. If a scratch file exists, you are mid-authoring for that phase — resume the approval loop in author-tasks.md.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.
5. **Check gate modes** via manifest CLI — if `auto`, the user previously opted in during this session. Preserve these values.
   - `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} task_list_gate_mode`
   - `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} author_gate_mode`
   - `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} finding_gate_mode`

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## The Process

This process constructs a plan from a specification. A plan consists of:

- **Plan Index File** — `.workflows/{work_unit}/planning/{topic}/planning.md`. Contains phases with acceptance criteria, and task tables tracking status. Metadata (topic, format, status, progress, gate modes) is stored in the manifest. This is the single source of truth for planning progress.
- **Authored Tasks** — Detailed task files written to the chosen **Output Format** (selected during planning). The output format determines where and how task detail is stored.

Follow every step in sequence. No steps are optional.

## Output Formatting

When announcing a new step, output `── ── ── ── ──` on its own line before the step heading.

---

## Step 0: Resume Detection

Check if a Plan Index File already exists at `.workflows/{work_unit}/planning/{topic}/planning.md`.

#### If no plan index file exists

→ Proceed to **Step 1**.

#### If plan index file exists

Check the planning status via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} status
```

Note the current phase and task position from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} phase
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} task
```

Check `spec_commit` from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} spec_commit
```

Load **[spec-change-detection.md](references/spec-change-detection.md)** and follow its instructions as written. Then present the user with an informed choice:

> *Output the next fenced block as a code block:*

```
Found existing plan for {work_unit} (previously reached phase {N}, task {M}).

{spec change summary from spec-change-detection.md}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continue or restart?

- **`c`/`continue`** — Walk through the plan from the start. You can review, amend, or navigate at any point — including straight to the leading edge.
- **`r`/`restart`** — Erase all planning work for this topic and start fresh. This deletes the Plan Index File and any Authored Tasks. Other topics are unaffected.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Proceed to **Step 2**.

#### If `restart`

1. Read the `format` from the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format
   ```
2. Read **[output-formats.md](references/output-formats.md)**, find the entry matching the format, and load the format's **[authoring.md](references/output-formats/{format}/authoring.md)**
3. Follow the authoring file's cleanup instructions to remove Authored Tasks for this topic
4. Delete the scratch directory if it exists: `rm -rf .workflows/.cache/planning/{work_unit}/{topic}/`
5. Delete the Plan Index File
6. Commit: `planning({work_unit}): restart planning`

→ Proceed to **Step 1**.

---

## Step 1: Initialize Plan

Choose the Output Format.

Query the manifest for any existing plan format preference:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning format
```

#### If a phase-level format exists

Present the recommendation:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Existing plans use **{format}**. Use the same format for consistency?

- **`y`/`yes`** — Use {format}
- **`n`/`no`** — See all available formats
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If no phase-level format exists or user declined

Read **[output-formats.md](references/output-formats.md)** and present each format to the user.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
@foreach(format in output_formats)
{N}. **{format.name}** — {format.description}
   Best for: {format.best_for}
@endforeach

Select a format (enter number):
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Once selected:

1. Capture the current git commit hash: `git rev-parse HEAD`
2. Create the Plan Index File at `.workflows/{work_unit}/planning/{topic}/planning.md` using the **Title** template from **[plan-index-schema.md](references/plan-index-schema.md)**.
3. Register planning and set metadata in the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.planning.{topic}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} format {chosen-format}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning format {chosen-format}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} spec_commit {commit-hash}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task_list_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} author_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} finding_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} phase 1
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task ~
   ```

4. Commit: `planning({work_unit}): initialize plan`

→ Proceed to **Step 2**.

---

## Step 2: Session Setup

1. Read the `format` from the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format
   ```
2. Read **[output-formats.md](references/output-formats.md)**, find the entry matching the format, and load the format's **[about.md](references/output-formats/{format}/about.md)** and **[authoring.md](references/output-formats/{format}/authoring.md)**
3. Reset gate modes to `gated` in the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} task_list_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} author_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} finding_gate_mode gated
   ```
4. Update `spec_commit` to current HEAD:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} spec_commit $(git rev-parse HEAD)
   ```

→ Proceed to **Step 3**.

---

## Step 3: Load Planning Principles

Load **[planning-principles.md](references/planning-principles.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Verify Source Material

Load **[verify-source-material.md](references/verify-source-material.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Plan Construction

Load **[plan-construction.md](references/plan-construction.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Analyze Task Graph

Load **[analyze-task-graph.md](references/analyze-task-graph.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Resolve External Dependencies

Load **[resolve-dependencies.md](references/resolve-dependencies.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Plan Review

Load **[plan-review.md](references/plan-review.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Conclude the Plan

> **CHECKPOINT**: Do not conclude if any tasks in the Plan Index File show `status: pending`. All tasks must be `authored` before concluding.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to conclude?

- **`y`/`yes`** — Conclude plan and mark as completed
- **Comment** — Add context before concluding
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If comment

Discuss the user's context.

**If additional work is needed:**

→ Return to **Step 7** or **Step 8** as appropriate.

**Otherwise:**

Re-present the sign-off prompt above.

#### If `yes`

1. **Update plan status** via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.planning.{topic} status completed
   ```
2. **Final commit** — Commit the completed plan: `planning({work_unit}): complete plan`
3. **Present completion summary**:

> *Output the next fenced block as markdown (not a code block):*

```
Planning is complete for **{work_unit}**.

The plan contains **{N} phases** with **{M} tasks** total, reviewed for traceability against the specification and structural integrity.

Status has been marked as `completed`. The plan is ready for implementation.
```

4. **Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: planning

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```
