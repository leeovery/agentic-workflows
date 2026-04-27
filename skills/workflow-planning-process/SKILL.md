---
name: workflow-planning-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
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
2. **Read all tracking and state files** for the current topic — the planning file (`.workflows/{work_unit}/planning/{topic}/planning.md`), task detail files (`phase-{N}-tasks.md`), task files via the format's reading.md, plan review tracking files (`review-*-tracking-c*.md`), and manifest state. If a task detail file contains `pending` tasks, you are mid-authoring for that phase — resume the approval loop in author-tasks.md.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.
5. **Check gate modes** via manifest CLI — if `auto`, the user previously opted in during this session. Preserve these values.
   - `node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} task_list_gate_mode`
   - `node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} author_gate_mode`
   - `node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} finding_gate_mode`

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## The Process

This process constructs a plan from a specification. A plan consists of:

- **Planning file** — `.workflows/{work_unit}/planning/{topic}/planning.md`. The human-readable plan: phases with goals and acceptance criteria, task tables with internal IDs and edge cases. This is plan content — all state lives in the manifest.
- **Manifest state** — All metadata (format, status, progress, gate modes, `task_map`) is stored in the manifest via the CLI. The manifest is the single source of truth for planning state.
- **Task detail files** — Per-phase files at `.workflows/{work_unit}/planning/{topic}/phase-{N}-tasks.md` containing full task specifications. Written during authoring, persist as a permanent record alongside the output format.
- **Authored tasks** — Detailed task files written to the chosen **Output Format** (selected during planning). The output format determines where and how task detail is stored.

Follow every step in sequence. No steps are optional.

## Step 0: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for an existing plan. If one exists, you can
> pick up where you left off or start fresh.
```

Check if a planning entry exists in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.planning.{topic}
```

#### If planning entry does not exist

→ Proceed to **Step 1**.

#### If planning entry exists

Check the planning status via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} status
```

Note the current phase and task position from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} phase
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} task
```

Check `spec_commit` from the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} spec_commit
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
- **`r`/`restart`** — Erase all planning work for this topic and start fresh. This deletes the planning file, authored tasks, and clears manifest state. Other topics are unaffected.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Proceed to **Step 2**.

#### If `restart`

1. Read the `format` from the manifest:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.planning.{topic} format
   ```
2. Load the format's **[authoring.md](references/output-formats/{format}/authoring.md)**
3. Follow the authoring file's cleanup instructions to remove authored tasks for this topic
4. Delete all planning files: `rm -rf .workflows/{work_unit}/planning/{topic}/`
5. Delete the planning manifest entry:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.planning items.{topic}
   ```
6. Commit: `planning({work_unit}): restart planning`

→ Proceed to **Step 1**.

---

## Step 1: Initialize Plan

> *Output the next fenced block as a code block:*

```
── Initialize Plan ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Setting up the plan. Selecting an output format and creating
> the planning file structure.
```

Load **[initialize-plan.md](references/initialize-plan.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Session Setup

> *Output the next fenced block as a code block:*

```
── Session Setup ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading context from previous work. Reading the specification
> and any existing planning progress.
```

Load **[session-setup.md](references/session-setup.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Load Planning Principles

> *Output the next fenced block as a code block:*

```
── Load Planning Principles ─────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the guidelines for how plans are structured.
> These ensure tasks are well-scoped, testable, and sequenced
> correctly.
```

Load **[planning-principles.md](references/planning-principles.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Knowledge Usage

> *Output the next fenced block as a code block:*

```
── Knowledge Usage ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the usage guide for the knowledge base so
> proactive querying is available while planning tasks.
```

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Verify Source Material

> *Output the next fenced block as a code block:*

```
── Verify Source Material ───────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reading the specification that drives this plan. Everything
> in the plan traces back to the specification.
```

Load **[verify-source-material.md](references/verify-source-material.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Plan Construction

> *Output the next fenced block as a code block:*

```
── Plan Construction ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Building the plan. Designing phases with goals and acceptance
> criteria, then authoring detailed tasks for each phase. You'll
> approve task lists and individual tasks as we go.
```

Load **[plan-construction.md](references/plan-construction.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Analyze Task Graph

> *Output the next fenced block as a code block:*

```
── Analyze Task Graph ───────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Analysing dependencies between tasks. Setting priority and
> execution order based on what depends on what.
```

Load **[analyze-task-graph.md](references/analyze-task-graph.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Resolve External Dependencies

> *Output the next fenced block as a code block:*

```
── Resolve External Dependencies ────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for dependencies on other plans. For epics,
> tasks in one plan may depend on tasks in another.
```

#### If work_type is not `epic`

→ Proceed to **Step 9**.

#### Otherwise

Load **[resolve-dependencies.md](references/resolve-dependencies.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Plan Review

> *Output the next fenced block as a code block:*

```
── Plan Review ──────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reviewing the plan. Agents will check that tasks are
> well-scoped, dependencies are sound, and nothing from the
> specification was missed.
```

Load **[plan-review.md](references/plan-review.md)** and follow its instructions as written.

→ Proceed to **Step 10**.

---

## Step 10: Compliance Self-Check

> *Output the next fenced block as a code block:*

```
── Compliance Self-Check ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying the plan follows workflow conventions.
```

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ Proceed to **Step 11**.

---

## Step 11: Conclude the Plan

> *Output the next fenced block as a code block:*

```
── Conclude the Plan ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final confirmation before marking the plan
> as complete and handing off to implementation.
```

Load **[conclude-plan.md](references/conclude-plan.md)** and follow its instructions as written.
