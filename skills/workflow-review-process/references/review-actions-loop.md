# Review Actions Loop

*Reference for **[workflow-review-process](../SKILL.md)***

---

After the review is presented, this loop closes the phase: a pass completes it, and a fail turns the replan findings into tasks and reopens implementation.

Stages A through G run sequentially. Always start at **A. Verdict Gate**.

```
A. Verdict gate (pass completes; fail proceeds to synthesis)
B. Dispatch review synthesizer → invoke-review-synthesizer.md
C. Approval overview (spec defects settled first)
D. Process task (per-task approval loop)
E. Route on results
F. Create tasks in plan → invoke-task-author.md, invoke-review-task-writer.md
G. Re-open implementation + plan mode handoff
```

---

## A. Verdict Gate

Read the verdict — arms in order, the resume guard first (on a resume a verdict arm also matches; the guard wins).

#### If a prior session's staging cycle is still mid-flight

Read `manifest get {work_unit}.review.{topic} staging` — `{N}` is the latest cycle present there; with no cycle in `staging`, only the file-with-no-cycle clause can hold. Mid-flight means any of: a cycle's `tasks` still hold a `pending` row; the latest cycle has approvals but the planning file carries no `Review Remediation (Cycle {N})` phase; that phase exists and none of its task ids appear in `{work_unit}.implementation.{topic}` `completed_tasks` (the re-open never ran); or a `review-tasks-c*.md` file exists in `.workflows/{work_unit}/implementation/{topic}/` with no matching manifest cycle. The synthesis decision was already made — do not re-ask; **B**'s guards resume it precisely.

→ Proceed to **B. Dispatch Review Synthesizer**.

#### If the verdict is `Pass`

The user chose `c/complete` at the review gate. Mark the review completed — the engine sets the status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase" --topic review/{topic}
```

**Pipeline continuation** — Invoke `/workflow-bridge {work_unit} review`.

**STOP.** Do not proceed — terminal condition.

#### If the verdict is `Fail`

The user chose `p/plan` at the review gate — the choice is made; never re-ask. The `replan` actions in `.workflows/.cache/{work_unit}/review/{topic}/actions.json` become tasks, and implementation reopens to build them.

→ Proceed to **B. Dispatch Review Synthesizer**.

---

## B. Dispatch Review Synthesizer

Crash-resume guards — read `manifest get {work_unit}.review.{topic} staging` and check in order. On a resume, `{N}` is the resumed cycle's number and its file is `review-tasks-c{N}.md`. "The latest cycle" always means the latest cycle present in `staging` — with none there, only the file-with-no-cycle guard can hold.

#### If a staging cycle's `tasks` still hold a `pending` row

The cycle is mid-approval — do not re-dispatch. Its `staging.c{N}` subtree carries `gate_mode` and the per-task decisions.

→ Proceed to **C. Approval Overview**.

#### If the latest cycle holds no `pending` row and at least one `approved` and the planning file carries no `Review Remediation (Cycle {N})` phase

The session died between the last gate decision and the plan write — the approvals are recorded but unrealised.

→ Proceed to **F. Create Tasks in Plan**.

#### If a `review-tasks-c{N}.md` staging file exists on disk with no matching manifest cycle

A crash between the synthesizer's write and the init — initialise the cycle now from the file's task count (the batched `pending` set from **[invoke-review-synthesizer.md](invoke-review-synthesizer.md)**). Only the `review-tasks-` family counts: `analysis-tasks-c*.md`, `ad-hoc-tasks-*.md`, and `consolidation-tasks-p*.md`/`consolidation-findings-p*.md` files in the same directory belong to the implementation item, the ad hoc plan-changes flow, and the consolidation boundary.

→ Proceed to **C. Approval Overview**.

#### If the latest cycle's remediation phase is in the plan and none of its tasks are in `completed_tasks`

The session died between **F**'s plan write and **G**'s re-open (task ids land in `completed_tasks` when the re-opened implementation runs them, declines included). Re-enter **F** — the task writer is idempotent and completes any partial `task_map`, and its commit picks up whatever the crash left unstaged.

→ Proceed to **F. Create Tasks in Plan**.

#### Otherwise

→ Load **[invoke-review-synthesizer.md](invoke-review-synthesizer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the synthesizer has returned.

#### If `STATUS` is `clean`

No actionable tasks from synthesis. Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the completion:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): complete review phase" --topic review/{topic}
```

> *Output the next fenced block as a code block:*

```
No actionable tasks synthesized. Review complete.
```

**Pipeline continuation** — Invoke `/workflow-bridge {work_unit} review`.

**STOP.** Do not proceed — terminal condition.

#### If `STATUS` is `tasks_proposed`

→ Proceed to **C. Approval Overview**.

---

## C. Approval Overview

Settle the spec defects first — each `## Spec Defects` entry in `review-report-c{N}.md` is classified before the overview renders, so the tasks are authored against a correct specification. Once per entry:

→ Load **[correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** for **B. This Work Unit's Specification** and follow its instructions, with specification path = `.workflows/{work_unit}/specification/{topic}/specification.md`, correcting_phase = `review/{topic}`.

A record-settled entry lands there silently. A code-wrong verdict becomes a staged proposal — the tree owes the change; an open verdict becomes one whose Solution says what is settled and whose **Decision** carries the question and two to four sides in the order they should be offered. An entry the reference returns unsettled (the item back in its own phase, or held by a live session) is left exactly as reported — never re-classified here. Add each staged verdict under the next `## Task {n}` heading in `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{N}.md` — a synthesis that staged none wrote no file: create it with its `# Review Tasks: {topic:(titlecase)} (Cycle {N})` header — shaped like the proposals beside it: a `severity:` line carrying the defect's grade (`high`, `medium`, `low` — never a refactor class), a `sources:` line naming the report entry, then **Problem**, **Solution**, and the **Decision** where there is one — and initialise its row:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} pending
```

An entry an earlier run already settled — its corrigendum present in the specification, or its proposal already in the staging file — is skipped; a proposal already in the staging file whose `staging.c{N}` row is missing is a crashed landing — initialise the row and move on, never re-append. When at least one correction landed, confirm in one line total — `{count} spec correction(s) recorded.` — never a per-correction recap; nothing when none did.

#### If the cycle stages no proposal

The synthesis staged none and the record settled every defect.

→ Proceed to **E. Route on Results**.

#### Otherwise

Read the staging file from `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{N}.md` (proposal content) and the cycle's state from `manifest get {work_unit}.review.{topic} staging.c{N}` (statuses + `gate_mode`).

Write the overview payload to `.workflows/.cache/{work_unit}/review/{topic}/tasks-overview.json` with the Write tool (`{"label": "Review synthesis cycle {N}", "tasks": [{"title": "…", "severity": "…", "status": "…"}]}` — each task's `status` is its `staging.c{N}.tasks.{n}` value: `pending`, `approved`, or `skipped`), render, and emit the section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render tasks-overview {work_unit}.review.{topic} --file .workflows/.cache/{work_unit}/review/{topic}/tasks-overview.json
```

→ Proceed to **D. Process Task**.

---

## D. Process Task

#### If no pending tasks remain

→ Proceed to **E. Route on Results**.

#### Otherwise

Present the next pending proposal. Write its payload to `.workflows/.cache/{work_unit}/review/{topic}/proposed-task.json` with the Write tool — `{"current": …, "total": …, "title": "…", "severity": "…", "sources": "…", "problem": "…", "solution": "…"}` from the staging proposal, adding `"outcome": "…"` when it carries one and `"decision": {"question": "…", "options": ["{side}", …]}` when it carries a Decision, its sides in the staged order — then render with the `gate_mode` from the manifest's `staging.c{N}` subtree, and emit each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render proposed-task {work_unit}.review.{topic} --file .workflows/.cache/{work_unit}/review/{topic}/proposed-task.json --gate {gate_mode}
```

#### If the response carried `DISPLAY: task auto-approved`

Record the approval (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} approved`), then emit the section per its marker.

→ Return to **D. Process Task**.

#### If the response carried `MENU: task approval`

**STOP.** Wait for user response.

**If `yes`:**

Record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} approved`.

→ Return to **D. Process Task**.

**If `auto`:**

Record both in one write: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n}=approved staging.c{N}.gate_mode=auto`.

→ Return to **D. Process Task**.

**If `decline`:**

Record the decline: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} skipped`.

→ Return to **D. Process Task**.

**If comment:**

Revise the staged proposal in the staging file based on the user's feedback (content only), and rewrite the payload.

→ Return to **D. Process Task**.

#### If the response carried `MENU: task decision`

**STOP.** Wait for user response.

**If a numbered side:**

Rewrite the proposal in the staging file — Solution becomes the settled direction carrying the chosen side, and the Decision block goes — then record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} approved`.

→ Return to **D. Process Task**.

**If `decline`:**

Record the decline: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} skipped`.

→ Return to **D. Process Task**.

**If comment:**

Revise the staged proposal in the staging file based on the user's feedback (content only) — feedback that settles the question settles it the same way a chosen side does — and rewrite the payload. The revision is an interpretation of the user's words: re-render this item with `--gate gated` whatever the walk's mode, so it lands with an explicit approval.

→ Return to **D. Process Task**.

---

## E. Route on Results

#### If the manifest's `staging.c{N}.tasks` marks any task `approved`

→ Proceed to **F. Create Tasks in Plan**.

#### Otherwise

Nothing is approved — the cycle's proposals were declined, or it staged none. Mark the review completed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} review {topic}
```

Commit the cycle's staging material, then its decisions (the second scoped commit covers the manifest):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): synthesis cycle {N} — staging" --topic implementation/{topic} --sweep
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): synthesis cycle {N} — no tasks approved" --topic review/{topic}
```

**Pipeline continuation** — Invoke `/workflow-bridge {work_unit} review`.

**STOP.** Do not proceed — terminal condition.

---

## F. Create Tasks in Plan

The approved proposals carry no bodies — the author expands exactly those, in the staging file, before the writer transcribes them:

→ Load **[invoke-task-author.md](../../workflow-implementation-process/references/invoke-task-author.md)** and follow its instructions as written, with staging file path = `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{N}.md`, findings file paths = the cycle's `review-report-c{N}.md` and the per-task `report-*.md` files in `.workflows/{work_unit}/review/{topic}/`, approved task numbers = the task numbers whose `staging.c{N}` rows are `approved`.

> **CHECKPOINT**: Do not proceed until the task author has returned.

#### If the author's `STATUS` is `failed`

Nothing was authored. State the author's reason plainly; the staging stays untouched.

**STOP.** Wait for user response.

**If the user resolves the input:**

→ Return to **F. Create Tasks in Plan** — re-invocation is idempotent.

**If the user abandons the tasks:**

Mark each remaining `approved` row `skipped` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.review.{topic} staging.c{N}.tasks.{n} skipped`).

→ Return to **E. Route on Results**.

#### Otherwise

Filter to the tasks the manifest's `staging.c{N}.tasks` marks `approved`, taking their content from the staging file.

→ Load **[invoke-review-task-writer.md](invoke-review-task-writer.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the task writer has returned.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'
```

Commit the staging file with this topic's implementation artifacts, then the plan tasks and `task_map` updates — `--plan` stages the planning topic, the manifests, and the plan's declared storage:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): stage review remediation" --topic implementation/{topic} --sweep
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): add review remediation — {K} task(s)" --plan {topic}
```

→ On return, proceed to **G. Re-open Implementation**.

---

## G. Re-open Implementation

For each plan that received new tasks:

1. Update the manifest via CLI:
   - `node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} implementation {topic}`
   - `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} updated {today's date}`
2. Commit tracking changes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "review({work_unit}): re-open implementation tracking" --topic review/{topic}
```

Then enter plan mode and write the following plan. Resolve `{work_type}` from the manifest when not already in context:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

```
# Review Actions Complete: {work_unit}

Review findings have been synthesized into {N} implementation tasks.

## Summary

{Summary, e.g., "auth-flow: 3 tasks in Phase 9"}

## Next Step

Invoke `/workflow-implementation-entry {work_type} {work_unit} {topic}`

Arguments: work_type = {work_type}, work_unit = {work_unit}, topic = {topic}
The skill will detect the new tasks and start executing them.

## Context

- Plan updated: {work_unit}
- Tasks created: {total count}
- Implementation tracking: re-opened

## How to proceed

Clear context and continue. The fresh session will start
implementation and pick up the new review remediation tasks
automatically.
```

Exit plan mode. The user will approve and clear context, and the fresh session will pick up with the implementation entry skill routing to the new tasks.
