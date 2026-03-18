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
2. **Read all tracking and state files** for the current topic — the planning file (`.workflows/{work_unit}/planning/{topic}/planning.md`), task files via the format's reading.md, plan review tracking files (`review-*-tracking-c*.md`), and manifest state. Check for scratch files at `.workflows/.cache/{work_unit}/planning/{topic}/`. If a scratch file exists, you are mid-authoring for that phase — resume the approval loop in author-tasks.md.
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

- **Planning file** — `.workflows/{work_unit}/planning/{topic}/planning.md`. The human-readable plan: phases with goals and acceptance criteria, task tables with internal IDs and edge cases. This is plan content — all state lives in the manifest.
- **Manifest state** — All metadata (format, status, progress, gate modes, `task_map`) is stored in the manifest via the CLI. The manifest is the single source of truth for planning state.
- **Scratch files** — Temporary files at `.workflows/.cache/{work_unit}/planning/{topic}/` used during task authoring. Discarded after tasks are written to the output format.
- **Authored Tasks** — Detailed task files written to the chosen **Output Format** (selected during planning). The output format determines where and how task detail is stored.

Follow every step in sequence. No steps are optional.

## Output Formatting

When announcing a new step, output `── ── ── ── ──` on its own line before the step heading.

---

## Step 0: Resume Detection

Check if a planning entry exists in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.planning.{topic}
```

#### If planning entry does not exist

→ Proceed to **Step 1**.

#### If planning entry exists

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
- **`r`/`restart`** — Erase all planning work for this topic and start fresh. This deletes the planning file, Authored Tasks, and clears manifest state. Other topics are unaffected.
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
2. Load the format's **[authoring.md](references/output-formats/{format}/authoring.md)**
3. Follow the authoring file's cleanup instructions to remove Authored Tasks for this topic
4. Delete the planning file: `rm .workflows/{work_unit}/planning/{topic}/planning.md`
5. Delete the scratch directory if it exists: `rm -rf .workflows/.cache/{work_unit}/planning/{topic}/`
6. Delete the planning manifest entry:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js delete {work_unit}.planning items.{topic}
   ```
7. Commit: `planning({work_unit}): restart planning`

→ Proceed to **Step 1**.

---

## Step 1: Initialize Plan

Load **[initialize-plan.md](references/initialize-plan.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Session Setup

Load **[session-setup.md](references/session-setup.md)** and follow its instructions as written.

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

#### If work_type is not `epic`

→ Proceed to **Step 8**.

#### Otherwise

Load **[resolve-dependencies.md](references/resolve-dependencies.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Plan Review

Load **[plan-review.md](references/plan-review.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Conclude the Plan

Load **[conclude-plan.md](references/conclude-plan.md)** and follow its instructions as written.
