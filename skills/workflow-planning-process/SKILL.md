---
name: workflow-planning-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(ls .workflows/), Bash(rm -rf .workflows/), Bash(git log), Bash(git diff), Bash(git status), Bash(git rev-parse)
---

# Planning Process

Act as **expert technical architect**, **product owner**, and **plan documenter**. Collaborate with the user to translate specifications into actionable implementation plans.

Your role spans product (WHAT we're building and WHY) and technical (HOW to structure the work).

## Purpose in the Workflow

Follows specification. Transform the validated specification into actionable phases, tasks, and acceptance criteria.

**Stay in your lane**: Create the plan - phases, tasks, and acceptance criteria. Don't jump to implementation or write code. The specification is your sole input; transform it into actionable work items.

### What This Skill Needs

Positional arguments:
- `$0` — **work_type**: `epic`, `feature`, or `bugfix`. Determines which context-specific guidance is loaded during phase and task design.
- `$1` — **work_unit**: the work unit name.
- `$2` — **topic**: the specification to plan. A single-topic unit's topic is the work unit, so it may be left off: topic = `$2`, or `$1` where `work_type` is not `epic`.

The plan is built from the specification at `.workflows/{work_unit}/specification/{topic}/specification.md`. Initialization settles the rest — any context added since the specification completed, the cross-cutting specifications that bear on the plan, and the output format.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read all tracking and state files** for the current topic — the planning file (`.workflows/{work_unit}/planning/{topic}/planning.md`), task detail files (`phase-{N}-tasks.md`), task files via the format's reading.md, plan review tracking files (`review-*-tracking-c*.md`), and manifest state. If the manifest carries a `staging.author-p{N}` subtree with `pending` or `rejected` rows, you are mid-authoring for that phase — resume the approval loop in author-tasks.md; never re-invoke the author agent over rows already `approved` (the approved text is what the user saw). A plan whose every task is in `task_map` and whose latest review tracking file is closed is at the conclude gate — once the position is confirmed, resume at **Step 11**, which fetches the wait gate and then the conclude gate.
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

## Backlogging

The user says to put an idea, a bug or a fix aside — "roadmap it", "inbox it", "backlog that", "push it back" — and the words take this door whatever else is in flight. Never a topic: a topic takes the postponing door. Load **[backlogging.md](../workflow-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `planning`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Postponing the Topic

The user pushes a topic back to the roadmap — "postpone this", "move the loyalty topic to v2", "take this whole topic back to the roadmap" — this one, or one on the map by name; `{name}` is that topic. The request is taken as said — never argued, and never checked back with a question first: load **[postponing-the-topic.md](../workflow-shared/references/postponing-the-topic.md)** with work_unit = `{work_unit}`, name = `{name}`, topic = `{topic}`, phase = `planning`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Cancelling the Topic

The user calls the topic off — they say to cancel, or the conversation agrees it is not worth pursuing. Never is not yet: a topic wanted later takes the postponing door. The call-off is taken as said — never argued, and never checked back with a question first: load **[cancelling-the-topic.md](../workflow-shared/references/cancelling-the-topic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `planning`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Step 0: Phase Start

### Step 0.1: Entry Gate

Check the specification prerequisite — the engine derives the verdict from manifest state:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.planning.{topic}
```

#### If the response is empty

The specification is completed and settled — clear to plan.

→ Proceed to **Step 0.2**.

#### If the response carried `DISPLAY: entry blocker`

Emit both sections verbatim per their markers — the red blocker line, then its guidance.

**STOP.** Do not proceed — terminal condition.

### Step 0.2: Resume Detection

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} planning {topic}
```

Read the phase status, storing it as `phase_status`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} status
```

#### If `phase_status` is empty

A first start.

→ Proceed to **Step 1**.

#### If `phase_status` is `in-progress` or `completed`

Where `phase_status` is `completed`, reopen it — resuming is not starting:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} planning {topic}
```

Render the phase note — `Reopening` for a plan just reopened, `Resuming` otherwise — and emit the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.planning.{topic} --verb {Reopening|Resuming} --noun plan
```

Load **[reconcile-advisory.md](../workflow-shared/references/reconcile-advisory.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, downstream_phase = `planning`.

Load **[spec-change-detection.md](references/spec-change-detection.md)** and follow its instructions as written. Then render the resume menu (the position parenthetical derives from the planning item) and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render resume-gate {work_unit}.planning.{topic} --variant plan
```

**STOP.** Wait for user response.

#### If `continue`

If spec-change-detection reported changes, carry them into the walkthrough: reconcile the changed spec content into the affected phases and tasks before concluding. The `spec_commit` baseline is re-stamped only at conclusion.

→ Proceed to **Step 2**.

#### If `restart`

Order matters — the cleanup commits while the planning item still exists, so `--plan` resolves the plan's declared storage, and the manifest entry is deleted last. A crash between the two commits leaves the entry standing over cleared files, and the resume gate reads that: it offers the restart alone, which re-runs the cleanup over an already-clean tree.

1. Read the `format` and the plan's `external_id` from the manifest:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
   ```
2. Load the format's **[authoring.md](references/output-formats/{format}/authoring.md)**
3. Follow the authoring file's cleanup instructions to remove authored tasks for this topic — the cleanup targets the entity identified by `external_id`
4. Delete all planning files: `rm -rf .workflows/{work_unit}/planning/{topic}/`
5. Commit the cleanup — `--plan` stages the planning topic, both manifests, and the plan's declared storage, so the deleted plan files and the format's own cleanup land together:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "planning({work_unit}): restart planning — clear the authored plan" --plan {topic}
   ```
6. Delete the planning manifest entry:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.planning items.{topic}
   ```
7. Commit the entry's removal on the topic's own scope:
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

Load **[knowledge-usage.md](../workflow-shared/references/knowledge-usage.md)** and follow its instructions as written.

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
> Wrapping up. Final confirmation before marking the plan as complete and handing off to implementation — unless the specification is unsettled beneath it, in which case the plan pauses here and concludes once the record lands.
```

Load **[conclude-plan.md](references/conclude-plan.md)** and follow its instructions as written.
