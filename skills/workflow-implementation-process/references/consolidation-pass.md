# Consolidation Pass

*Reference for **[task-loop.md](task-loop.md)** — loaded at the phase boundary.*

---

One pass per phase, bounded by construction: a finder sweeps the phase's combined surface, the survivors become ordinary plan tasks in the still-open phase, and the phase records complete — there is no re-check after those tasks land. `{N}` throughout is the manifest's `current_phase`. The walk's gate mode is `consolidation_gate_mode` (session-reset by `task init`); read it here:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} consolidation_gate_mode
```

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Consolidation Pass (phase {N})`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Phase {N}'s tasks are done. Before the phase closes: one sweep over what they built side by side — consolidation the plan could not author, plus everything banked along the way.
```

Resume guards — read the durable state (both prints are empty when the field is absent), then check in order, first match wins:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} staging
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} consolidated_phases
```

#### If the work unit's `work_type` is `quick-fix` (read at loop entry)

A quick-fix plan never grows — record the phase without a sweep.

→ Proceed to **F. Record the Phase**.

#### If the phase's label (the planning file's `Phase {N}:` heading) names machinery-created remediation work (starts with `Analysis (Cycle` or `Review Remediation`)

The boundary never applies to remediation phases — record the phase without a sweep.

→ Proceed to **F. Record the Phase**.

#### If `staging.p{N}` holds a `pending` task

The walk is mid-approval.

→ Proceed to **C. Approval Overview**.

#### If `staging.p{N}` holds no `pending` task and at least one `approved` row's task is missing from the plan

The session died between the walk and the plan write — or partway through the task writer's run.

→ Proceed to **E. Create Tasks in Plan**.

#### If the manifest's `consolidated_phases` contains `{N}`

The pass ran; only the phase record is outstanding.

→ Proceed to **F. Record the Phase**.

#### If `.workflows/{work_unit}/implementation/{topic}/consolidation-findings-p{N}.md` exists

→ Proceed to **B. Judge the Findings** over the existing file.

#### Otherwise

→ Proceed to **A. Dispatch the Finder**.

---

## A. Dispatch the Finder

→ Load **[invoke-consolidation-finder.md](invoke-consolidation-finder.md)** and follow its instructions as written.

> **CHECKPOINT**: Do not proceed until the finder has returned.

When the finder wrote its file, commit the findings (the scoped commit covers the file and the manifest):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): phase {N} consolidation — findings"
```

#### If `STATUS` is `clean`

> *Output the next fenced block as a code block:*

```
Consolidation sweep: nothing owed.
```

→ Proceed to **F. Record the Phase**.

#### If `STATUS` is `findings`

→ Proceed to **B. Judge the Findings**.

---

## B. Judge the Findings

Read the findings file. The finder proposes; this stage disposes, with the session context the finder lacks:

1. **Re-apply the bar** — drop findings the session already settled: an ad hoc change that made one moot, a deferral the user chose, ground a finding would trample. Anything that could have been in the plan — a missed requirement, a design gap — is not consolidation: keep it out of the staging — the exit steps (**E**/**F**) surface it and offer **[ad-hoc-plan-changes.md](ad-hoc-plan-changes.md)**.
2. **Fold the survivors into tasks** — related findings about one pattern become one task; anything giant splits. Normal planning granularity, the count dictated by the work. Every task is a pure refactor: behaviour unchanged, tests stay green, test semantics untouched. Give each task a one-word class tag (its dominant finding class — e.g. `duplication`, `near-miss`, `drift`, `dead-code`, `complexity`, `comments`).
3. **Settle each bank verdict** — the findings file carries the finder's verdict per banked entry, with the entry's JSON quoted verbatim. Record each disposition in the staging file's `## Bank Disposition` section: `folded into task {n}`, `mooted — {reason}`, or `residue — {reason}` (pre-existing debt and out-of-phase entries ride to the end-of-implementation analysis).
4. **Bank the finder's pre-existing debt** — push each `## Pre-existing Debt` entry the bank does not already hold (read it back first — a re-entry must not double-deposit); it rides to the end-of-implementation analysis:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.implementation.{topic} bank '{"source":"finder","pre_existing":true,"summary":"{one line}","detail":"{what and where, file:line}","files":["{path}"]}'
   ```

Write the staging file to `.workflows/{work_unit}/implementation/{topic}/consolidation-tasks-p{N}.md`:

```markdown
# Consolidation Tasks: {Topic} (Phase {N})

## Task 1: {title}
placement: phase {N}
severity: {class tag}

**Problem**: {what the phase left duplicated, drifted, dead, or stale}
**Solution**: {the consolidation}
**Outcome**: {what the phase's surface looks like after}
**Do**: {step-by-step implementation instructions}
**Acceptance Criteria**:
- {criterion — behaviour unchanged, existing tests green}
**Tests**:
- {the existing coverage that proves the refactor safe; new tests only where an extracted helper earns its own}

## Task 2: ...

## Bank Disposition

- {entry summary} — {folded into task {n} | mooted — {reason} | residue — {reason}}
  {the entry's JSON, verbatim as banked}
```

#### If no task survives

→ Proceed to **F. Record the Phase**.

#### Otherwise

Initialise the walk's gate state — one batched write, one `pending` per staged task:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.p{N}.tasks.1=pending … staging.p{N}.tasks.{K}=pending
```

→ Proceed to **C. Approval Overview**.

---

## C. Approval Overview

Write the overview payload to `.workflows/.cache/{work_unit}/implementation/{topic}/tasks-overview.json` with the Write tool (`{"label": "Phase {N} consolidation", "tasks": [{"title": "…", "severity": "{class tag}", "status": "…"}]}` — each task's `status` is its `staging.p{N}.tasks.{n}` value), render, and emit the section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render tasks-overview {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/tasks-overview.json
```

→ Proceed to **D. Process Task**.

---

## D. Process Task

#### If no pending tasks remain in `staging.p{N}`

**If any task is `approved`:**

→ Proceed to **E. Create Tasks in Plan**.

**If none is:**

→ Proceed to **F. Record the Phase**.

#### Otherwise

Present the next pending task. Write its payload to `.workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json` with the Write tool — `{"current": …, "total": …, "title": "…", "severity": "{class tag}", "placement": "phase {N}", "problem": "…", "solution": "…", "outcome": "…", "steps": […], "criteria": […], "tests": […]}` from the staging file — then render with `{consolidation_gate_mode}` (`auto` from the moment the user opts in mid-walk), and emit each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render proposed-task {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json --gate {consolidation_gate_mode} --comment-hint "Provide feedback to adjust"
```

#### If the response carried `DISPLAY: task auto-approved`

Record the approval (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.p{N}.tasks.{n} approved`), then emit the section per its marker.

→ Return to **D. Process Task**.

#### If the response carried `MENU: task approval`

**STOP.** Wait for user response.

**If `yes`:**

Record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.p{N}.tasks.{n} approved`.

→ Return to **D. Process Task**.

**If `auto`:**

Record the approval: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.p{N}.tasks.{n} approved`.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} consolidation_gate_mode auto
```

→ Return to **D. Process Task**.

**If `skip`:**

Record the skip: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.p{N}.tasks.{n} skipped`.

→ Return to **D. Process Task**.

**If comment:**

Revise the staged task in the staging file based on the user's feedback (content only), and rewrite the payload.

→ Return to **D. Process Task**.

---

## E. Create Tasks in Plan

Record the pass as landed before the plan write — a crash after this point resumes at task creation, never a re-sweep. Skip the push when `consolidated_phases` already contains `{N}`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.implementation.{topic} consolidated_phases {N}
```

Invoke the task-writer agent.

**Agent path**: `../../../agents/workflow-implementation-task-writer.md`

Pass via the orchestrator's prompt:

1. **Work unit** — the work unit name (for path construction)
2. **Topic name** — the implementation topic (scopes tasks to the correct plan)
3. **Staging file path** — the `consolidation-tasks-p{N}.md` file from **B**
4. **Planning file path** — `.workflows/{work_unit}/planning/{topic}/planning.md`
5. **Plan format reading adapter path** — `../../workflow-planning-process/references/output-formats/{format}/reading.md`
6. **Plan format authoring adapter path** — `../../workflow-planning-process/references/output-formats/{format}/authoring.md`
7. **Phase placement** — `per-task` (every staged task carries `placement: phase {N}`), declared as a **consolidation-boundary placement**: phase {N}'s completion is deferred by the caller — the writer treats the phase as open
8. **Approved task numbers** — the task numbers whose `staging.p{N}` rows are `approved`

The agent creates exactly the approved tasks; a crash-resume re-invocation is safe (it creates only those not yet present).

> **CHECKPOINT**: Do not proceed until the task writer has returned.

#### If `STATUS` is `failed`

Nothing was created. State the writer's reason plainly; the staging and the bank stay untouched.

**STOP.** Wait for user response.

**If the user resolves the input:**

→ Return to **E. Create Tasks in Plan** — re-invocation is idempotent.

**If the user abandons the tasks:**

Mark each remaining `approved` row `skipped` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.p{N}.tasks.{n} skipped`).

→ Proceed to **F. Record the Phase**.

#### If `STATUS` is `complete`

```
STATUS: complete
TASKS_CREATED: {K}
PHASES: {phase numbers}
SUMMARY: {1 sentence}
```

**Consume the settled bank entries** — pull each entry whose disposition is `folded` or `mooted`: its work is now a plan task (approved or declined — offered and declined is decided), or its premise is gone. `residue` entries stay for the end-of-implementation analysis. Use the JSON quoted in the staging file's `## Bank Disposition`, verbatim — `"removed": false` means the entry is not in the bank: read it back (`manifest get`) and pull the matching entry, or move on if it is already gone:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest pull {work_unit}.implementation.{topic} bank '{entry json exactly as banked}'
```

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'`).

Commit — `--plan` stages the work unit and the plan's declared storage:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): phase {N} consolidation — {K} task(s)" --plan {topic}
```

**Surface anything set aside at B** — present each plan-authorable finding and offer **[ad-hoc-plan-changes.md](ad-hoc-plan-changes.md)**; it returns here.

The loop's next task fetch sees the consolidation tasks; the phase records complete when they land (stage **H**'s `completing` disposition). Any task totals held in session context are stale — re-derive them at the next display.

→ Return to caller.

---

## F. Record the Phase

Close the phase:

1. **Consume the settled bank entries** — skip when no staging or findings file exists for this phase (no sweep ran). Pull each entry marked `mooted` (by the staging file's `## Bank Disposition`, else by the findings file's bank verdicts), and each `folded` entry — its task was offered and declined or abandoned, which is decided. `residue` entries stay. Use the quoted JSON, verbatim — `"removed": false` means the entry is not in the bank: read it back (`manifest get`) and pull the matching entry, or move on if it is already gone:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest pull {work_unit}.implementation.{topic} bank '{entry json exactly as banked}'
   ```
2. **Bank the finder's pre-existing debt** — push each `## Pre-existing Debt` entry the bank does not already hold, as at **B** step 4. A no-op when the findings file is absent or the entries are already deposited.
3. **Mark the boundary** — skip the push when `consolidated_phases` already contains `{N}`:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.implementation.{topic} consolidated_phases {N}
   ```
4. **Complete the phase in the plan** — follow the format's **updating.md** instructions for phase completion.
5. **Record it via the engine** — re-run the completion for the phase's last completed task (session context; after a crash, any `-{N}-` id from the manifest's `completed_tasks`). The re-record is idempotent — the id and the phase each land once:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs task complete {work_unit} {topic} {internal_id} --phase {N} --phase-complete
   ```
6. **If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'`).
7. **Commit** — the scoped commit covers the manifest and the plan's declared storage:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): phase {N} consolidated" --plan {topic}
   ```
8. **Surface anything set aside at B**, when it ran — present each plan-authorable finding and offer **[ad-hoc-plan-changes.md](ad-hoc-plan-changes.md)**; it returns here.

→ Return to caller.
