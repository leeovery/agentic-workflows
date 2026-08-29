# Analysis Loop

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Each cycle follows stages A through H sequentially. Always start at **A. Cycle Gate**.

```
A. Cycle gate (record the cycle, warn if over the session limit)
B. Git checkpoint
C. Dispatch analysis agents → invoke-analysis.md
D. Dispatch synthesis agent → invoke-synthesizer.md
E. Approval overview (spec defects settled first)
F. Process task (per-task approval loop)
G. Route on results
H. Create tasks in plan → invoke-task-author.md, invoke-task-writer.md
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

#### If an `analysis-tasks-c{N}.md` staging file exists on disk with no matching manifest cycle

A crash between the synthesizer's write and the init — initialise the cycle from the file's task count (the batched `pending` set from **[invoke-synthesizer.md](invoke-synthesizer.md)**). Only the `analysis-tasks-` family counts: `review-tasks-c*.md`, `ad-hoc-tasks-*.md`, and `consolidation-tasks-p*.md`/`consolidation-findings-p*.md` files in the same directory belong to the review item, the ad hoc plan-changes flow, and the consolidation boundary.

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

Fetch and emit the `DISPLAY: cycle limit` section verbatim as a code block (a section is everything beneath its `===` marker — the marker line itself is never emitted):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render cycle-limit {work_unit}.implementation.{topic}
```

→ Load **[convergence-analysis.md](../../workflow-shared/references/convergence-analysis.md)** with loop_type = `analysis`, work_unit = `{work_unit}`, topic = `{topic}`.

Fetch the cycle gate and emit its `MENU: cycle gate` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render cycle-gate
```

You MUST NOT choose on the user's behalf.

**STOP.** Wait for user response.

**If `proceed`:**

→ Proceed to **B. Git Checkpoint**.

**If `skip`:**

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

---

## B. Git Checkpoint

Ensure clean code before analysis. Run `git status` and set aside every `.workflows/` path — those belong to their own phase's scope, and the loop's own commits carry them.

#### If nothing outside `.workflows/` is dirty

→ Proceed to **C. Dispatch Analysis Agents**.

#### Otherwise

Categorize the dirty code files:

- **Implementation files** (files touched by `impl({work_unit}):` commits) — name these in the checkpoint commit automatically.
- **Unexpected files** (files not touched during implementation) — present to the user:

> *Output the next fenced block as a code block:*

```
Pre-analysis checkpoint — unexpected files detected:
- {file} ({status: modified/untracked})
- ...
```

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render checkpoint-files-gate {work_unit}.implementation.{topic}
```

Emit the call's MENU section verbatim per its marker.

**STOP.** Wait for user response.

The checkpoint is a code commit — name the files, and the engine confines the commit to them.

**If `yes`:**

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --paths {implementation and unexpected files} -m "impl({work_unit}): pre-analysis checkpoint" --for {work_unit} implementation/{topic}
```

→ Proceed to **C. Dispatch Analysis Agents**.

**If `skip`:**

Name only the implementation files; the unexpected ones stay uncommitted, and come back in the response's `left_dirty`.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --paths {implementation files} -m "impl({work_unit}): pre-analysis checkpoint" --for {work_unit} implementation/{topic}
```

→ Proceed to **C. Dispatch Analysis Agents**.

**If comment:**

Name the implementation files plus the ones the user specified.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --paths {implementation files and the named ones} -m "impl({work_unit}): pre-analysis checkpoint" --for {work_unit} implementation/{topic}
```

→ Proceed to **C. Dispatch Analysis Agents**.

---

## C. Dispatch Analysis Agents

→ Load **[invoke-analysis.md](invoke-analysis.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until all agents have returned.

Commit the analysis findings — the scoped commit covers the findings files and the manifest's cycle counters:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): analysis cycle {N} — findings" --topic implementation/{topic}
```

Read the bank (an absent field prints empty):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} bank
```

#### If all three agents returned `STATUS: clean` and the bank holds entries

The phase boundaries left residue — the synthesizer runs over the bank alone for its verdicts.

→ Proceed to **D. Dispatch Synthesis Agent**.

#### If all three agents returned `STATUS: clean` and the bank is empty

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

#### Otherwise

→ Proceed to **D. Dispatch Synthesis Agent**.

---

## D. Dispatch Synthesis Agent

→ Load **[invoke-synthesizer.md](invoke-synthesizer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the synthesizer has returned.

Commit the synthesis output — the scoped commit covers the report, any staging file, and the manifest's gate state:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): analysis cycle {N} — synthesis" --topic implementation/{topic}
```

#### If `STATUS` is `clean`

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

#### If `STATUS` is `tasks_proposed`

→ Proceed to **E. Approval Overview**.

---

## E. Approval Overview

Settle the spec defects first — each `## Spec Defects` entry in `analysis-report-c{N}.md` is classified before the overview renders, so the tasks are authored against a correct specification. Once per entry:

→ Load **[correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** for **B. This Work Unit's Specification** and follow its instructions, with specification path = `.workflows/{work_unit}/specification/{topic}/specification.md`, correcting_phase = `implementation/{topic}`.

A record-settled entry lands there silently. A code-wrong verdict becomes a staged proposal — the tree owes the change; an open verdict becomes one whose Solution says what is settled and whose **Decision** carries the question and two to four sides in the order they should be offered. An entry the reference returns unsettled (the item back in its own phase, or held by a live session) is left exactly as reported — never re-classified here. Add each staged verdict under the next `## Task {n}` heading in `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{N}.md` — a synthesis that staged none wrote no file: create it with its `# Analysis Tasks: {Topic} (Cycle {N})` header — shaped like the proposals beside it: a `severity:` line carrying the defect's grade (`high`, `medium`, `low` — never a refactor class), a `sources:` line naming the report entry, then **Problem**, **Solution**, and the **Decision** where there is one — and initialise its row:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.{n} pending
```

An entry an earlier run already settled — its corrigendum present in the specification, or its proposal already in the staging file — is skipped; a proposal already in the staging file whose `staging.c{N}` row is missing is a crashed landing — initialise the row and move on, never re-append. When at least one correction landed, confirm in one line total — `{count} spec correction(s) recorded.` — never a per-correction recap; nothing when none did.

#### If the cycle stages no proposal

The synthesis staged none and the record settled every defect.

→ Proceed to **G. Route on Results**.

#### Otherwise

Read the staging file from `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{N}.md` (proposal content) and the cycle's statuses from `manifest get {work_unit}.implementation.{topic} staging.c{N}`.

Write the overview payload to `.workflows/.cache/{work_unit}/implementation/{topic}/tasks-overview.json` with the Write tool (`{"label": "Analysis cycle {N}", "tasks": [{"title": "…", "severity": "…", "status": "…"}]}` — each task's `status` is its `staging.c{N}.tasks.{n}` value: `pending`, `approved`, or `skipped`), render, and emit the section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render tasks-overview {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/tasks-overview.json
```

→ Proceed to **F. Process Task**.

---

## F. Process Task

#### If no pending tasks remain

→ Proceed to **G. Route on Results**.

#### Otherwise

Present the next pending proposal. Write its payload to `.workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json` with the Write tool — `{"current": …, "total": …, "title": "…", "severity": "…", "sources": "…", "problem": "…", "solution": "…"}` from the staging proposal, adding `"outcome": "…"` when it carries one and `"decision": {"question": "…", "options": ["{side}", …]}` when it carries a Decision, its sides in the staged order — then render with `{analysis_gate_mode}` (`auto` from the moment the user opts in mid-cycle), and emit each section verbatim at its marked instruction:

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

**If `decline`:**

Record the decline: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.{n} skipped`.

→ Return to **F. Process Task**.

**If comment:**

Revise the staged proposal in the staging file based on the user's feedback (content only), and rewrite the payload.

→ Return to **F. Process Task**.

#### If the response carried `MENU: task decision`

**STOP.** Wait for user response.

**If a numbered side:**

Rewrite the proposal in the staging file — Solution becomes the settled direction carrying the chosen side, and the Decision block goes — then record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.{n} approved`.

→ Return to **F. Process Task**.

**If `decline`:**

Record the decline: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.{n} skipped`.

→ Return to **F. Process Task**.

**If comment:**

Revise the staged proposal in the staging file based on the user's feedback (content only) — feedback that settles the question settles it the same way a chosen side does — and rewrite the payload. The revision is an interpretation of the user's words: re-render this item with `--gate gated` whatever the walk's mode, so it lands with an explicit approval.

→ Return to **F. Process Task**.

---

## G. Route on Results

#### If the manifest's `staging.c{N}.tasks` marks any task `approved`

→ Proceed to **H. Create Tasks in Plan**.

#### Otherwise

Nothing is approved — the cycle's proposals were declined, or it staged none. Commit the cycle's decisions (the scoped commit covers the manifest):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): analysis cycle {N} — no tasks approved" --topic implementation/{topic}
```

→ Return to **[the skill](../SKILL.md)** for **Step 8**.

---

## H. Create Tasks in Plan

The approved proposals carry no bodies — the author expands exactly those, in the staging file, before the writer transcribes them:

→ Load **[invoke-task-author.md](invoke-task-author.md)** and follow its instructions as written, with staging file path = `.workflows/{work_unit}/implementation/{topic}/analysis-tasks-c{N}.md`, findings file paths = the cycle's `analysis-report-c{N}.md` and the `analysis-duplication-c{N}.md`, `analysis-standards-c{N}.md` and `analysis-architecture-c{N}.md` files that exist, approved task numbers = the task numbers whose `staging.c{N}` rows are `approved`.

> **CHECKPOINT**: Do not proceed until the task author has returned.

#### If the author's `STATUS` is `failed`

Nothing was authored. State the author's reason plainly; the staging stays untouched.

**STOP.** Wait for user response.

**If the user resolves the input:**

→ Return to **H. Create Tasks in Plan** — re-invocation is idempotent.

**If the user abandons the tasks:**

Mark each remaining `approved` row `skipped` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.c{N}.tasks.{n} skipped`).

→ Return to **G. Route on Results**.

#### Otherwise

→ Load **[invoke-task-writer.md](invoke-task-writer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the task writer has returned.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'
```

Commit the staging file with this topic's implementation artifacts, then the tasks — `--plan` stages the planning topic, the manifests, and the plan's declared storage:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): analysis cycle {N} — staged tasks" --topic implementation/{topic}
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): add analysis cycle {N} — {K} task(s)" --plan {topic}
```

→ Return to caller.
