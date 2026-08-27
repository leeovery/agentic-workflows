---
name: workflow-implementation-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(git log), Bash(git diff), Bash(git status)
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup'
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup'
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

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Check task progress in the plan** — use the plan adapter's instructions to read the plan's current state. Check manifest state for additional context.
3. **Check gate modes and progress** via `engine manifest`:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic}
   ```
   Check `task_gate_mode`, `fix_gate_mode`, `analysis_gate_mode`, `consolidation_gate_mode`, `fix_attempts`, and `analysis_cycle_total` — if gates are `auto`, the user previously opted out. If `fix_attempts` > 0, you're mid-fix-loop for the current task. If `analysis_cycle_total` > 0, you've completed analysis cycles — check for findings files on disk (`analysis-*-c{cycle-number}.md` in the implementation directory) to determine mid-analysis state. If `staging` holds an `ad-hoc-{n}` subtree with `pending` rows, an ad hoc addition died mid-gate — resume its walk at **[ad-hoc-plan-changes.md](references/ad-hoc-plan-changes.md)** section F; `approved` rows with no matching plan tasks mean the task writer never ran — re-invoke it (idempotent) per section G. A `staging.p{N}` subtree, or a phase whose tasks are all complete while `completed_phases` lacks it, is a consolidation boundary in flight — the task loop's guard routes it to stage J, whose resume guards (**[consolidation-pass.md](references/consolidation-pass.md)**) discriminate the exact seam. A `staging.p{N}` whose rows are all decided, with the phase in both `consolidated_phases` and `completed_phases`, is history, not a signal.
4. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
5. **Re-fetch lost sections.** Every gate menu and header is served by its own render surface, fetched at the stage that displays it — the task verbs answer with JSON only, and re-running one re-emits nothing. Fetch the section for the moment you are resuming at: `engine render task-gate {work_unit}.implementation.{topic}` for a pending task gate, `engine render fix-gate` at the same address for a pending fix gate; a presentation moment re-runs its display reference (**[display-task-brief.md](references/display-task-brief.md)**, **[display-task-result.md](references/display-task-result.md)**), which rebuilds its payload before rendering. Never run `fix-attempt` or `analysis-cycle` to reconstruct position — each records a new attempt or cycle.
6. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

1. **No autonomous decisions on spec deviations** — when the executor reports a blocker or spec deviation, present to user and STOP. Never resolve on the user's behalf.
2. **All git operations are the orchestrator's responsibility** — agents never commit, stage, or interact with git.

---

## Ad Hoc Plan Changes

Unplanned work surfaces mid-implementation — the user hits a bug while testing, the conversation exposes a gap, an agent result names missing work, a decision changes. When it does — or when you spot it and the user confirms — load **[ad-hoc-plan-changes.md](references/ad-hoc-plan-changes.md)** and follow its instructions as written, from any point in the phase. Never fold unplanned work into the plan by hand.

→ On return, resume the interrupted flow — never fall through to Step 0.

---

## Step 0: Resume Detection

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} implementation {topic}
```

Initialize or resume implementation tracking (idempotent — creates the manifest entry with default gates and counters, or resets the gate modes and session counters of an existing one; lifetime counters and progress are preserved):
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs task init {work_unit} {topic}
```

#### If the response's `mode` is `created`

Commit the tracking (the scoped commit covers the manifest):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): start implementation" --topic implementation/{topic}
```

→ Proceed to **Step 1**.

#### If the response's `mode` is `resumed`

> *Output the next fenced block as a code block:*

```
Found existing implementation for "{topic:(titlecase)}". Resuming from previous session.
```

→ Proceed to **Step 1**.

---

## Step 1: Environment Setup

Load **[environment-setup.md](references/environment-setup.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Read Plan + Load Plan Adapter

Load **[load-plan-adapter.md](references/load-plan-adapter.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Project Skills Discovery

Load **[project-skills-discovery.md](references/project-skills-discovery.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Linter Discovery

Load **[linter-setup.md](references/linter-setup.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Knowledge Usage

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: Task Loop

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Task Loop`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Executing tasks from the plan. Each task is implemented via TDD by an executor agent, then independently verified by a reviewer agent. You'll approve each task before it proceeds.
```

Load **[task-loop.md](references/task-loop.md)** and follow its instructions as written.

*Knowledge-base nudge — code is the source of truth for *what* exists; read it rather than query. Reach for the KB only when you need the *why* behind an existing pattern (rare). Never to fill spec gaps — those are blockers. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*

After the loop completes:

#### If the task loop exited early (user chose `stop`)

→ Proceed to **Step 8**.

#### Otherwise

**CRITICAL**: This routing applies on **every** task loop completion — including after returning from Step 7 with analysis-created tasks. Step 6 and Step 7 form a mandatory cycle: tasks execute → analysis runs → new tasks may be created → tasks execute again → analysis runs again. Never skip Step 7 after a task loop completes.

→ Proceed to **Step 7**.

---

## Step 7: Analysis Loop

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Analysis Loop`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Analysing the implementation for gaps and issues. Agents review what was built against the plan and spec. New tasks may be created if problems are found.
```

Load **[analysis-loop.md](references/analysis-loop.md)** and follow its instructions as written.

#### If new tasks were created in the plan

→ Return to **Step 6**.

#### If no tasks were created

→ Proceed to **Step 8**.

---

## Step 8: Compliance Self-Check

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ On return, proceed to **Step 9**.

---

## Step 9: Mark Implementation Complete

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Conclude Implementation`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final confirmation before marking implementation as complete and moving to review.
```

Load **[conclude-implementation.md](references/conclude-implementation.md)** and follow its instructions as written.


