# Analysis Loop

*Reference for **[technical-implementation](../SKILL.md)***

---

Each cycle follows stages A through F sequentially. Always start at **A. Cycle Gate**.

```
A. Cycle gate (check analysis_cycle, warn if over limit)
B. Git checkpoint
C. Dispatch analysis agents → invoke-analysis.md
D. Dispatch synthesis agent → invoke-synthesizer.md
E. Approval gate (present tasks, approve/skip/comment)
F. Create tasks in plan → invoke-task-writer.md
→ Route on result
```

---

## A. Cycle Gate

Increment `analysis_cycle` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} analysis_cycle {N}`).

→ If `analysis_cycle <= 3`, proceed to **B. Git Checkpoint**.

If `analysis_cycle > 3`:

**Do NOT skip analysis autonomously.** This gate is an escape hatch for the user — not a signal to stop. The expected default is to continue running analysis until no issues are found. Present the choice and let the user decide.

**Analysis cycle {N}**

Analysis has run {N-1} times so far. You can continue (recommended if issues were still found last cycle) or skip to completion.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`p`/`proceed`** — Continue analysis *(default)*
- **`s`/`skip`** — Skip analysis, proceed to completion
· · · · · · · · · · · ·
```

**STOP.** Wait for user choice. You MUST NOT choose on the user's behalf.

- **`proceed`**: → Proceed to **B. Git Checkpoint**.
- **`skip`**: → Return to **[the skill](../SKILL.md)** for **Step 8**.

---

## B. Git Checkpoint

Ensure a clean working tree before analysis. Run `git status`.

→ If the working tree is clean, proceed to **C. Dispatch Analysis Agents**.

If there are unstaged changes or untracked files, categorize them:

- **Implementation files** (files touched by `impl({work_unit}):` commits) — stage these automatically.
- **Unexpected files** (files not touched during implementation) — present to the user:

**Pre-analysis checkpoint — unexpected files detected:**
- `{file}` ({status: modified/untracked})
- ...

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`y`/`yes`** — Include all in the checkpoint commit
- **`s`/`skip`** — Exclude unexpected files, commit only implementation files
- **Comment** — Specify which to include
· · · · · · · · · · · ·
```

**STOP.** Wait for user choice.

Commit included files:

```
impl({work_unit}): pre-analysis checkpoint
```

→ Proceed to **C. Dispatch Analysis Agents**.

---

## C. Dispatch Analysis Agents

Load **[invoke-analysis.md](invoke-analysis.md)** and follow its instructions.

**STOP.** Do not proceed until all agents have returned.

Commit the analysis findings:

```
impl({work_unit}): analysis cycle {N} — findings
```

#### If all three agents returned `STATUS: clean`

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

#### Otherwise

→ Proceed to **D. Dispatch Synthesis Agent**.

---

## D. Dispatch Synthesis Agent

Load **[invoke-synthesizer.md](invoke-synthesizer.md)** and follow its instructions.

**STOP.** Do not proceed until the synthesizer has returned.

Commit the synthesis output:

```
impl({work_unit}): analysis cycle {N} — synthesis
```

→ If `STATUS: clean`, return to the skill for **Step 8**.

→ If `STATUS: tasks_proposed`, proceed to **E. Approval Gate**.

---

## E. Approval Gate

Read the staging file from `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{cycle-number}.md`.

Check `analysis_gate_mode` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} analysis_gate_mode`).

Present an overview:

> *Output the next fenced block as a code block:*

```
Analysis cycle {N}: {K} proposed tasks

  1. {title} ({severity})
  2. {title} ({severity})
```

Then present each task with `status: pending` individually:

> *Output the next fenced block as markdown (not a code block):*

```
**Task {current}/{total}: {title}** ({severity})
Sources: {sources}

**Problem**: {problem}
**Solution**: {solution}
**Outcome**: {outcome}

**Do**:
{steps}

**Acceptance Criteria**:
{criteria}

**Tests**:
{tests}
```

#### If `analysis_gate_mode: gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve this task?

- **`y`/`yes`** — Approve this task
- **`a`/`auto`** — Approve this and all remaining tasks automatically
- **`s`/`skip`** — Skip this task
- **Comment** — Revise based on feedback
· · · · · · · · · · · ·
```

**STOP.** Wait for user input.

#### If `analysis_gate_mode: auto`

Update `status: approved` in the staging file. Note that `analysis_gate_mode` should be updated to `auto` via manifest CLI during the next commit.

> *Output the next fenced block as a code block:*

```
Task {current} of {total}: {title} — approved (auto).
```

→ Proceed to next task without stopping.

---

Process user input:

#### If `yes`

Update `status: approved` in the staging file.

→ Present the next pending task, or proceed to routing below if all tasks processed.

#### If `auto`

Update `status: approved` in the staging file. Note that `analysis_gate_mode` should be updated to `auto` via manifest CLI during the next commit.

→ Continue processing remaining tasks without stopping.

#### If `skip`

Update `status: skipped` in the staging file.

→ Present the next pending task, or proceed to routing below if all tasks processed.

#### If `comment`

Revise the task content in the staging file based on the user's feedback. Re-present this task.

---

After all tasks processed:

→ If any tasks have `status: approved`, proceed to **F. Create Tasks in Plan**.

→ If all tasks were skipped:

Commit the staging file updates (include manifest if `analysis_gate_mode` was updated):

```
impl({work_unit}): analysis cycle {N} — tasks skipped
```

Return to the skill for **Step 8**.

---

## F. Create Tasks in Plan

Load **[invoke-task-writer.md](invoke-task-writer.md)** and follow its instructions.

**STOP.** Do not proceed until the task writer has returned.

Commit all analysis and plan changes (staging file, plan tasks, Plan Index File, and manifest if `analysis_gate_mode` was updated):

```
impl({work_unit}): add analysis phase {N} ({K} tasks)
```

→ Return to **[the skill](../SKILL.md)**. New tasks are now in the plan.
