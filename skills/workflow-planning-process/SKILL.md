---
name: workflow-planning-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(ls .workflows/), Bash(rm -rf .workflows/), Bash(git log), Bash(git diff), Bash(git status), Bash(git rev-parse)
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup'
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup'
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

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read all tracking and state files** for the current topic — the planning file (`.workflows/{work_unit}/planning/{topic}/planning.md`), task detail files (`phase-{N}-tasks.md`), task files via the format's reading.md, plan review tracking files (`review-*-tracking-c*.md`), and manifest state. If the manifest carries a `staging.author-p{N}` subtree with `pending` or `rejected` rows, you are mid-authoring for that phase — resume the approval loop in author-tasks.md; never re-invoke the author agent over rows already `approved` (the approved text is what the user saw).
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.
5. **Check gate modes** via `engine manifest`:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic}
   ```
   Check `task_list_gate_mode`, `author_gate_mode`, and `finding_gate_mode` — if any is `auto`, the user previously opted in during this session. Preserve these values.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

1. **Commit frequently** — commit at natural breaks and before any context refresh. Context refresh = lost work. The planning topic's own artifacts commit on its topic scope:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "{message}" --topic planning/{topic}
   ```
2. **`--plan` when the plan format's storage is staged** — task authoring, graph writes, and applied review fixes write through the format adapter, whose task storage may live outside `.workflows/{work_unit}`. Commit those with `engine commit {work_unit} -m "{message}" --plan {topic}` — it stages the planning topic, both manifests, and the plan's recorded `storage_paths`. Restart cleanup commits the same way, before the planning item is deleted — `--plan` reads `storage_paths` off the item, so the cleanup lands while it still resolves.

---

## The Process

This process constructs a plan from a specification. A plan consists of:

- **Planning file** — `.workflows/{work_unit}/planning/{topic}/planning.md`. The human-readable plan: phases with goals and acceptance criteria, task tables with internal IDs and edge cases. This is plan content — all state lives in the manifest.
- **Manifest state** — All metadata (format, status, progress, gate modes, `task_map`) is stored in the manifest via the CLI. The manifest is the single source of truth for planning state.
- **Task detail files** — Per-phase files at `.workflows/{work_unit}/planning/{topic}/phase-{N}-tasks.md` containing full task specifications. Written during authoring, persist as a permanent record alongside the output format.
- **Authored tasks** — Detailed task files written to the chosen **Output Format** (selected during planning). The output format determines where and how task detail is stored.

Follow every step in sequence. No steps are optional.

---

## Step 0: Resume Detection

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} planning {topic}
```

Read the planning entry from the manifest as one subtree — empty means no entry exists:
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic}
```

#### If output is empty (no planning entry)

→ Proceed to **Step 1**.

#### Otherwise (planning entry exists)

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Resume Detection`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> An in-progress plan exists for this topic — choose whether to pick it up or start fresh.
```

The subtree carries the current `phase` and `task` position (for the resume prompt below) and the `spec_commit` baseline (for spec-change detection).

Load **[spec-change-detection.md](references/spec-change-detection.md)** and follow its instructions as written. Then present the informed choice — emit the spec-change summary as markdown, then render the resume menu (the position parenthetical derives from the planning item) and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render resume-gate {work_unit}.planning.{topic} --variant plan
```

**STOP.** Wait for user response.

#### If `continue`

**If the subtree carries no `storage_paths`** (a plan initialised before the field existed): record it now, before anything commits — read the format's authoring.md → Storage Pathspecs and copy the fenced array:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'
```

If spec-change-detection reported changes, carry them into the walkthrough: reconcile the changed spec content into the affected phases and tasks before concluding. The `spec_commit` baseline is re-stamped only at conclusion.

→ Proceed to **Step 2**.

#### If `restart`

Order matters — the cleanup commits while the planning item still exists, so `--plan` resolves the plan's declared storage, and the manifest entry is deleted last. A crash between the two commits leaves the entry standing over cleared files, and the resume gate reads that: it offers the restart alone, which re-runs the cleanup over an already-clean tree.

1. Read the `format` and the plan's `external_id` from the manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
   ```
2. **If the subtree read at resume detection carries no `storage_paths`** (a plan initialised before the field existed): record it now, before anything commits — read the format's authoring.md → Storage Pathspecs and copy the fenced array:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'
   ```
3. Load the format's **[authoring.md](references/output-formats/{format}/authoring.md)**
4. Follow the authoring file's cleanup instructions to remove authored tasks for this topic — the cleanup targets the entity identified by `external_id`
5. Delete all planning files: `rm -rf .workflows/{work_unit}/planning/{topic}/`
6. Commit the cleanup — `--plan` stages the planning topic, both manifests, and the plan's declared storage, so the deleted plan files and the format's own cleanup land together:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): restart planning — clear the authored plan" --plan {topic}
   ```
7. Delete the planning manifest entry:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.planning items.{topic}
   ```
8. Commit the entry's removal on the topic's own scope:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): restart planning" --topic planning/{topic}
   ```

→ Proceed to **Step 1**.

---

## Step 1: Initialize Plan

Load **[initialize-plan.md](references/initialize-plan.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Session Setup

Load **[session-setup.md](references/session-setup.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Load Planning Principles

Load **[planning-principles.md](references/planning-principles.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Knowledge Usage

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Verify Source Material

Load **[verify-source-material.md](references/verify-source-material.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: Plan Construction

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Plan Construction`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Building the plan. Designing phases with goals and acceptance criteria, then authoring detailed tasks for each phase. You'll approve task lists and individual tasks as we go.
```

Load **[plan-construction.md](references/plan-construction.md)** and follow its instructions as written.

→ On return, proceed to **Step 7**.

---

## Step 7: Analyze Task Graph

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Analyze Task Graph`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Analysing dependencies between tasks. Setting priority and execution order based on what depends on what.
```

Load **[analyze-task-graph.md](references/analyze-task-graph.md)** and follow its instructions as written.

→ On return, proceed to **Step 8**.

---

## Step 8: Resolve External Dependencies

#### If work_type is not `epic`

→ Proceed to **Step 9**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Resolve External Dependencies`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for dependencies on other plans — tasks in one plan may depend on tasks in another.
```

Load **[resolve-dependencies.md](references/resolve-dependencies.md)** and follow its instructions as written.

→ On return, proceed to **Step 9**.

---

## Step 9: Plan Review

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Plan Review`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reviewing the plan. Agents will check that tasks are well-scoped, dependencies are sound, and nothing from the specification was missed.
```

Load **[plan-review.md](references/plan-review.md)** and follow its instructions as written.

→ On return, proceed to **Step 10**.

---

## Step 10: Compliance Self-Check

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ On return, proceed to **Step 11**.

---

## Step 11: Conclude the Plan

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Conclude the Plan`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final confirmation before marking the plan as complete and handing off to implementation.
```

Load **[conclude-plan.md](references/conclude-plan.md)** and follow its instructions as written.
