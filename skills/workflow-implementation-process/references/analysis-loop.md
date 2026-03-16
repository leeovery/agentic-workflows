# Analysis Loop

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Each cycle follows stages A through H sequentially. Always start at **A. Cycle Gate**.

```
A. Cycle gate (check analysis_cycle, warn if over limit)
B. Git checkpoint
C. Dispatch analysis agents → invoke-analysis.md
D. Dispatch synthesis agent → invoke-synthesizer.md
E. Approval overview
F. Process task (per-task approval loop)
G. Route on results
H. Create tasks in plan → invoke-task-writer.md
→ Route on result
```

---

## A. Cycle Gate

Increment `analysis_cycle` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_cycle {N}`).

#### If `analysis_cycle` <= 3

→ Proceed to **B. Git Checkpoint**.

#### If `analysis_cycle` > 3

**Do NOT skip analysis autonomously.** This gate is an escape hatch for the user — not a signal to stop. The expected default is to continue running analysis until no issues are found. Present the choice and let the user decide.

> *Output the next fenced block as a code block:*

```
Analysis cycle {N}

Analysis has run {N-1} times so far. You can continue (recommended if issues
were still found last cycle) or skip to completion.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continue with analysis?

- **`p`/`proceed`** — Continue analysis
- **`s`/`skip`** — Skip analysis, proceed to completion
· · · · · · · · · · · ·
```

You MUST NOT choose on the user's behalf.

**STOP.** Wait for user response.

**If `proceed`:**

→ Proceed to **B. Git Checkpoint**.

**If `skip`:**

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

---

## B. Git Checkpoint

Ensure a clean working tree before analysis. Run `git status`.

#### If the working tree is clean

→ Proceed to **C. Dispatch Analysis Agents**.

#### If there are unstaged changes or untracked files

Categorize them:

- **Implementation files** (files touched by `impl({work_unit}):` commits) — stage these automatically.
- **Unexpected files** (files not touched during implementation) — present to the user:

> *Output the next fenced block as a code block:*

```
Pre-analysis checkpoint — unexpected files detected:
- {file} ({status: modified/untracked})
- ...
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Include unexpected files in the checkpoint commit?

- **`y`/`yes`** — Include all
- **`s`/`skip`** — Exclude unexpected files, commit only implementation files
- **Comment** — Specify which to include
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

Stage all files (implementation and unexpected). Commit:
```
impl({work_unit}): pre-analysis checkpoint
```

→ Proceed to **C. Dispatch Analysis Agents**.

**If `skip`:**

Stage only implementation files. Leave unexpected files unstaged. Commit:
```
impl({work_unit}): pre-analysis checkpoint
```

→ Proceed to **C. Dispatch Analysis Agents**.

**If comment:**

Stage the files the user specified alongside implementation files. Commit:
```
impl({work_unit}): pre-analysis checkpoint
```

→ Proceed to **C. Dispatch Analysis Agents**.

---

## C. Dispatch Analysis Agents

→ Load **[invoke-analysis.md](invoke-analysis.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until all agents have returned.

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

→ Load **[invoke-synthesizer.md](invoke-synthesizer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the synthesizer has returned.

Commit the synthesis output:

```
impl({work_unit}): analysis cycle {N} — synthesis
```

#### If `STATUS` is `clean`

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

#### If `STATUS` is `tasks_proposed`

→ Proceed to **E. Approval Overview**.

---

## E. Approval Overview

Read the staging file from `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{cycle-number}.md`.

> *Output the next fenced block as a code block:*

```
Analysis cycle {N}: {K} proposed tasks

  1. {title} ({severity})
  2. {title} ({severity})
```

→ Proceed to **F. Process Task**.

---

## F. Process Task

#### If no pending tasks remain

→ Proceed to **G. Route on Results**.

Present the next pending task:

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

Check `analysis_gate_mode` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} analysis_gate_mode`).

#### If `analysis_gate_mode` is `auto`

Update `status: approved` in the staging file.

> *Output the next fenced block as a code block:*

```
Task {current} of {total}: {title} — approved (auto).
```

→ Return to **F. Process Task**.

#### If `analysis_gate_mode` is `gated`

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Approve this task?

- **`y`/`yes`** — Approve this task
- **`a`/`auto`** — Approve this and all remaining tasks automatically
- **`s`/`skip`** — Skip this task
- **Comment** — Provide feedback to adjust
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `yes`:**

Update `status: approved` in the staging file.

→ Return to **F. Process Task**.

**If `auto`:**

Update `status: approved` in the staging file.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_gate_mode auto
```

→ Return to **F. Process Task**.

**If `skip`:**

Update `status: skipped` in the staging file.

→ Return to **F. Process Task**.

**If comment:**

Revise the task content in the staging file based on the user's feedback.

→ Return to **F. Process Task**.

---

## G. Route on Results

#### If any tasks have `status: approved`

→ Proceed to **H. Create Tasks in Plan**.

#### If all tasks were skipped

Commit the staging file updates:

```
impl({work_unit}): analysis cycle {N} — tasks skipped
```

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

---

## H. Create Tasks in Plan

→ Load **[invoke-task-writer.md](invoke-task-writer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the task writer has returned.

Commit all analysis and plan changes:

```
impl({work_unit}): add analysis phase {N} ({K} tasks)
```

→ Return to **[the skill](../SKILL.md)**.
