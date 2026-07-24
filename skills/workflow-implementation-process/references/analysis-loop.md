# Analysis Loop

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Each cycle follows stages A through H sequentially. Always start at **A. Cycle Gate**.

```
A. Cycle gate (record the cycle, warn if over the session limit)
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

Crash-resume guards — read `manifest get {work_unit}.implementation.{topic} staging` and check in order. On a resume, `{N}` is the resumed cycle's number and `{analysis_gate_mode}` comes from the manifest's topic-level `analysis_gate_mode` (no cycle response exists to carry either).

#### If the latest `staging.c{N}` still holds a `pending` task

The cycle is mid-approval — do not record a new one.

→ Proceed to **E. Approval Overview**.

#### If the latest `staging.c{N}` holds no `pending` task and at least one `approved` and the planning file carries no `Analysis (Cycle {N})` phase

The session died between the last gate decision and the plan write — the approvals are recorded but unrealised.

→ Proceed to **H. Create Tasks in Plan**.

#### If a staging file exists on disk with no matching manifest cycle

A crash between the synthesizer's write and the init — initialise the cycle from the file's task count.

→ Proceed to **E. Approval Overview**.

#### If the previous cycle's findings are committed and its synthesis never ran

→ Proceed to **D. Dispatch Synthesis Agent** over the existing findings.

#### Otherwise

Record the cycle via the engine (increments both the lifetime and session counters):
```bash
node .claude/skills/workflow-engine/scripts/engine.cjs task analysis-cycle {work_unit} {topic}
```

`{N}` throughout this loop refers to the response's `cycle_total`; **F. Process Task**'s `{analysis_gate_mode}` is the response's `analysis_gate_mode`.

#### If the response's `over_session_limit` is `false`

→ Proceed to **B. Git Checkpoint**.

#### If the response's `over_session_limit` is `true`

**Do NOT skip analysis autonomously.** This gate is an escape hatch for the user — not a signal to stop. The expected default is to continue running analysis until no issues are found. Present the choice and let the user decide.

The response carries two rendered sections after its JSON line — emit each byte-for-byte where prescribed below: a section is everything beneath its `===` marker up to the next marker or the end of the response, the marker lines themselves never emitted. DISPLAY sections are emitted as a code block, MENU sections as markdown (not a code block).

Emit the response's `DISPLAY: cycle limit` section.

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `analysis`, work_unit = `{work_unit}`, topic = `{topic}`.

Emit the response's `MENU: cycle gate` section.

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

Read the staging file from `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{N}.md` (task content) and the cycle's statuses from `manifest get {work_unit}.implementation.{topic} staging.c{N}`.

Write the overview payload to `.workflows/.cache/{work_unit}/implementation/{topic}/tasks-overview.json` with the Write tool (`{"label": "Analysis cycle {N}", "tasks": [{"title": "…", "severity": "…"}]}`), render, and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render tasks-overview {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/tasks-overview.json
```

→ Proceed to **F. Process Task**.

---

## F. Process Task

#### If no pending tasks remain

→ Proceed to **G. Route on Results**.

#### Otherwise

Present the next pending task. Write its payload to `.workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json` with the Write tool — `{"current": …, "total": …, "title": "…", "severity": "…", "sources": "…", "problem": "…", "solution": "…", "outcome": "…", "steps": […], "criteria": […], "tests": […]}` from the staging file — then render with `{analysis_gate_mode}` (`auto` from the moment the user opts in mid-cycle), and emit each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render proposed-task {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json --gate {analysis_gate_mode} --comment-hint "Provide feedback to adjust"
```

#### If the response carried `DISPLAY: task auto-approved`

Record the approval (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.{n} approved`), then emit the section per its marker.

→ Return to **F. Process Task**.

#### If the response carried `MENU: task approval`

**STOP.** Wait for user response.

**If `yes`:**

Record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.{n} approved`.

→ Return to **F. Process Task**.

**If `auto`:**

Record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.{n} approved`.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} analysis_gate_mode auto
```

→ Return to **F. Process Task**.

**If `skip`:**

Record the skip: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.{n} skipped`.

→ Return to **F. Process Task**.

**If comment:**

Revise the task content in the staging file based on the user's feedback.

→ Return to **F. Process Task**.

---

## G. Route on Results

#### If the manifest's `staging.c{N}.tasks` marks any task `approved`

→ Proceed to **H. Create Tasks in Plan**.

#### If all tasks were skipped

Commit the cycle's decisions:

```
impl({work_unit}): analysis cycle {N} — tasks skipped
```

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

---

## H. Create Tasks in Plan

→ Load **[invoke-task-writer.md](invoke-task-writer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the task writer has returned.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'
```

Commit all analysis and plan changes with raw git — stage the analysis outputs, the plan's `storage_paths` (recorded on the planning item), and the work unit, then commit:

```
impl({work_unit}): add analysis phase {N} ({K} tasks)
```

→ Return to caller.
