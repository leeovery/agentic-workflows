---
name: workflow-implementation-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

# Implementation Process

Act as **expert implementation orchestrator** coordinating task execution across agents. Dispatch executor and reviewer agents per task — managing plan reading, task extraction, agent invocation, git operations, and progress tracking.

## Purpose in the Workflow

Follows planning. Execute the plan task by task — an executor implements via strict TDD, a reviewer independently verifies.

### What This Skill Needs

- **Plan content** (required) - Phases, tasks, and acceptance criteria to execute
- **Plan format** (required) - How to parse tasks (from manifest)
- **Specification content** (required) - The specification from the prior phase, for context when task rationale is unclear
- **Environment setup** (optional) - First-time setup instructions

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate `*_gate_mode: auto` value in the manifest, set by the user's explicit `a`/`auto` choice at a prior gate.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Check task progress in the plan** — use the plan adapter's instructions to read the plan's current state. Check manifest state for additional context.
3. **Check gate modes and progress** via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.implementation.{topic}
   ```
   Check `task_gate_mode`, `fix_gate_mode`, `analysis_gate_mode`, `fix_attempts`, and `analysis_cycle` — if gates are `auto`, the user previously opted out. If `fix_attempts` > 0, you're mid-fix-loop for the current task. If `analysis_cycle` > 0, you've completed analysis cycles — check for findings files on disk (`analysis-*-c{cycle-number}.md` in the implementation directory) to determine mid-analysis state.
4. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
5. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

1. **No autonomous decisions on spec deviations** — when the executor reports a blocker or spec deviation, present to user and STOP. Never resolve on the user's behalf.
2. **All git operations are the orchestrator's responsibility** — agents never commit, stage, or interact with git.

## Step 0: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for existing implementation progress. If a
> previous session exists, gates and counters will be reset
> for this session.
```

Check if an implementation entry exists in the manifest:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.implementation.{topic}
```

#### If implementation entry does not exist

→ Proceed to **Step 1**.

#### If implementation entry exists

> *Output the next fenced block as a code block:*

```
Found existing implementation for "{topic:(titlecase)}". Resuming from previous session.
```

Reset gate modes and counters via manifest CLI (fresh session = fresh gates/cycles):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} task_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} fix_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} analysis_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} fix_attempts 0
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.implementation.{topic} analysis_cycle 0
```

→ Proceed to **Step 1**.

---

## Step 1: Environment Setup

> *Output the next fenced block as a code block:*

```
── Environment Setup ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for environment setup instructions. Any
> first-time setup will be handled before tasks begin.
```

Load **[environment-setup.md](references/environment-setup.md)** and follow its instructions as written.

→ Proceed to **Step 2**.

---

## Step 2: Read Plan + Load Plan Adapter

> *Output the next fenced block as a code block:*

```
── Read Plan ────────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reading the plan and loading the format adapter.
> This determines how tasks are extracted and tracked.
```

Load **[load-plan-adapter.md](references/load-plan-adapter.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Initialize Implementation Tracking

> *Output the next fenced block as a code block:*

```
── Initialize Tracking ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Setting up implementation tracking in the manifest.
> This records progress as tasks are completed.
```

Load **[initialize-tracking.md](references/initialize-tracking.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Project Skills Discovery

> *Output the next fenced block as a code block:*

```
── Project Skills Discovery ─────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Discovering project-level skills that agents should
> use during implementation.
```

Load **[project-skills-discovery.md](references/project-skills-discovery.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Linter Discovery

> *Output the next fenced block as a code block:*

```
── Linter Discovery ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Discovering linters and formatters that should be
> run after each task to ensure code quality.
```

Load **[linter-setup.md](references/linter-setup.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Knowledge Usage

> *Output the next fenced block as a code block:*

```
── Knowledge Usage ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the usage guide for the knowledge base. Implementation reads
> the code as the source of truth for *what* exists — the guide
> documents the rare cases where the KB is useful for the *why*
> behind an existing pattern.
```

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Task Loop

> *Output the next fenced block as a code block:*

```
── Task Loop ────────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Executing tasks from the plan. Each task is implemented
> via TDD by an executor agent, then independently verified by
> a reviewer agent. You'll approve each task before it proceeds.
```

Load **[task-loop.md](references/task-loop.md)** and follow its instructions as written.

*Knowledge-base nudge — code is the source of truth for *what* exists; read it rather than query. Reach for the KB only when you need the *why* behind an existing pattern (rare). Never to fill spec gaps — those are blockers. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*

After the loop completes:

#### If the task loop exited early (user chose `stop`)

→ Proceed to **Step 9**.

#### Otherwise

**CRITICAL**: This routing applies on **every** task loop completion — including after returning from Step 8 with analysis-created tasks. Step 7 and Step 8 form a mandatory cycle: tasks execute → analysis runs → new tasks may be created → tasks execute again → analysis runs again. Never skip Step 8 after a task loop completes.

→ Proceed to **Step 8**.

---

## Step 8: Analysis Loop

> *Output the next fenced block as a code block:*

```
── Analysis Loop ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Analysing the implementation for gaps and issues.
> Agents review what was built against the plan and spec.
> New tasks may be created if problems are found.
```

Load **[analysis-loop.md](references/analysis-loop.md)** and follow its instructions as written.

#### If new tasks were created in the plan

→ Return to **Step 7**.

#### If no tasks were created

→ Proceed to **Step 9**.

---

## Step 9: Compliance Self-Check

> *Output the next fenced block as a code block:*

```
── Compliance Self-Check ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying the implementation follows workflow conventions.
```

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ Proceed to **Step 10**.

---

## Step 10: Mark Implementation Complete

> *Output the next fenced block as a code block:*

```
── Conclude Implementation ──────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final confirmation before marking
> implementation as complete and moving to review.
```

Load **[conclude-implementation.md](references/conclude-implementation.md)** and follow its instructions as written.


