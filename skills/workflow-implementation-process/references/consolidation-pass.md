# Consolidation Pass

*Reference for **[task-loop.md](task-loop.md)** — loaded at the phase boundary.*

---

One pass per phase, bounded by construction: a finder sweeps the phase's combined surface, the survivors are walked as proposals and the approved ones become ordinary plan tasks in the still-open phase, and the phase records complete — there is no re-check after those tasks land. `{N}` throughout is the manifest's `current_phase`. The walk's gate mode is `consolidation_gate_mode` (session-reset by `task init`); read it here:

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

The session died between the walk and the plan write — or partway through the task author's or the task writer's run.

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
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): phase {N} consolidation — findings" --topic implementation/{topic}
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

1. **Re-apply the bar** — drop findings the session already settled: an ad hoc change that made one moot, a deferral the user chose, ground a finding would trample. Then list the plan's open tasks with the format's **reading.md** and drop any finding whose ground a pending task already owns — that work is owed either way, so every proposal reaching the walk is one nothing upcoming covers.
2. **Settle the spec defects** — each `## Spec Defects` entry is classified before a proposal is written, so the tasks are authored against a correct specification. Once per entry:

   → Load **[correcting-historical-artifacts.md](../../workflow-shared/references/correcting-historical-artifacts.md)** for **B. This Work Unit's Specification** and follow its instructions, with specification path = `.workflows/{work_unit}/specification/{topic}/specification.md`, correcting_phase = `implementation/{topic}`.

   A record-settled entry lands there silently — a derivable gap included, its derivation in the corrigendum. A code-wrong verdict returns for the fold below as a `behaviour` finding; an open verdict (a product-intent gap, or a call the reference could not stand behind — the only classes it returns open) returns as a finding whose proposal carries the decision. An entry the reference returns unsettled (the item back in its own phase, or held by a live session) is left exactly as reported — never re-classified here. An entry the specification already reads as corrected — its corrigendum present — was settled by an earlier run: skip it. When at least one correction landed, confirm in one line total — `{count} spec correction(s) recorded.` — never a per-correction recap; nothing when none did.
3. **Fold the survivors into proposals** — related findings about one pattern become one proposal; anything giant splits. Normal planning granularity, the count dictated by the work. Give each a one-word class tag: its dominant finding class (`duplication`, `near-miss`, `drift`, `dead-code`, `complexity`, `comments`), or `behaviour` where it changes what the code does. A proposal carries the problem and the direction — the bodies are authored after the walk. Settle the direction: derivable from the record → derive; underivable but technical → an honest judgment call — either way the Solution carries the settled direction with its derivation in a clause. A **Decision** is staged only when all four hold: the fork lives at product level (choosing changes what the product's user gets or how it behaves, not how the tree achieves it — test structure, helper extraction, naming, lint, internal bounds never qualify); the costs conflict irreducibly (both sides defensible, mirrored consequences, and no measurement, convention, spec entry, or further trace breaks the tie — where investigation could break it, the investigation is owed instead); a side visibly costs the user (a fork every side of which leaves the user well served — a clean refusal against support for an input nothing produces — is a preference, not a decision: settle it on whatever convention or precedent leans, an honest call where none does); and the tie-break is the user's (appetite, product intent, a fact only they hold) — and a fork whose sides cannot be written as two distinct product end states is below the bar. Such a proposal keeps a Solution saying what is settled and adds the **Decision** — the question, a **Stakes** line arguing the bar (each side's product consequence as the tree bears it out — never a hypothetical cost — why no investigation settles the tie, and the grounds for the recommendation where a side is marked), and two to four sides, each written as the product end state chosen — what the product *is* if that side wins, never the work to do — the recommended side first and marked `(recommended)`; only an honest no-lean fork carries no marker. Most passes stage zero Decisions.
4. **Settle each bank verdict** — the findings file carries the finder's verdict per banked entry, with the entry's JSON quoted verbatim. Record each disposition in the staging file's `## Bank Disposition` section: `folded into task {n}`, `mooted — {reason}`, or `residue — {reason}` (pre-existing debt and out-of-phase entries ride to the end-of-implementation analysis).
5. **Bank the finder's pre-existing debt** — push each `## Pre-existing Debt` entry the bank does not already hold (read it back first — a re-entry must not double-deposit); it rides to the end-of-implementation analysis:

   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.implementation.{topic} bank '{"source":"finder","pre_existing":true,"summary":"{one line}","detail":"{what and where, file:line}","files":["{path}"]}'
   ```

Write the staging file to `.workflows/{work_unit}/implementation/{topic}/consolidation-tasks-p{N}.md`:

```markdown
# Consolidation Tasks: {Topic} (Phase {N})

## Task 1: {title}
placement: phase {N}
severity: {class tag}

**Problem**: {what the phase left duplicated, drifted, dead, stale, or wrong}
**Solution**: {what will be done}
**Outcome**: {what the phase's surface looks like after — only when it adds what Solution does not}

## Task 2: {title}
placement: phase {N}
severity: {class tag}

**Problem**: {what the phase left wrong}
**Solution**: {what is settled — the part the decision does not touch}
**Decision**: {the question}
**Stakes**: {each side's product consequence, why no investigation settles the tie, and the grounds for the recommendation}
1. {the product end state if this side is chosen} (recommended)
2. {the product end state if this side is chosen}

## Task 3: ...

## Bank Disposition

- {entry summary} — {folded into task {n} | mooted — {reason} | residue — {reason}}
  {the entry's JSON, verbatim as banked}
```

#### If no proposal survives

→ Proceed to **F. Record the Phase**.

#### Otherwise

Initialise the walk's gate state — one batched write, one `pending` per staged proposal:

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

Each pass reads the next pending proposal from the staging file as it now stands — a settle may have rewritten it since the overview. `{consolidation_gate_mode}` is live: `auto` from the moment the user opts in mid-walk.

#### If no pending tasks remain in `staging.p{N}`

**If any task is `approved`:**

→ Proceed to **E. Create Tasks in Plan**.

**If none is:**

→ Proceed to **F. Record the Phase**.

#### If the next pending proposal carries a Decision

→ Load **[raising-a-decision.md](../../workflow-shared/references/raising-a-decision.md)** with dotpath = `{work_unit}.implementation.{topic}`, staging_file = `.workflows/{work_unit}/implementation/{topic}/consolidation-tasks-p{N}.md`, payload_path = `.workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json`, gate_mode = `{consolidation_gate_mode}`, row_address = `staging.p{N}.tasks.{n}`, comment_hint = `Provide feedback to adjust`, findings_paths = `.workflows/{work_unit}/implementation/{topic}/consolidation-findings-p{N}.md`.

→ On return, return to **D. Process Task**.

#### Otherwise

Present it plain. Write its payload to `.workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json` with the Write tool — `{"current": …, "total": …, "title": "…", "severity": "{class tag}", "placement": "phase {N}", "problem": "…", "solution": "…"}` from the staging proposal, adding `"outcome": "…"` when it carries one. `{gate}` is `{consolidation_gate_mode}` — except a proposal whose fork a Comment on its raise settled this session, which renders `gated` whatever the mode: the settled direction interprets the user's words, so it lands with an explicit approval. Render, and emit each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render proposed-task {work_unit}.implementation.{topic} --file .workflows/.cache/{work_unit}/implementation/{topic}/proposed-task.json --gate {gate} --comment-hint "Provide feedback to adjust"
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

**If `decline`:**

Record the decline: `node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.p{N}.tasks.{n} skipped`.

→ Return to **D. Process Task**.

**If comment:**

Revise the staged proposal in the staging file based on the user's feedback (content only), and rewrite the payload.

→ Return to **D. Process Task**.

---

## E. Create Tasks in Plan

Record the pass as landed before the plan write — a crash after this point resumes at task creation, never a re-sweep. Skip the push when `consolidated_phases` already contains `{N}`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.implementation.{topic} consolidated_phases {N}
```

The approved proposals carry no bodies — the author expands exactly those, in the staging file, before the writer transcribes them:

→ Load **[invoke-task-author.md](invoke-task-author.md)** and follow its instructions as written, with staging file path = `.workflows/{work_unit}/implementation/{topic}/consolidation-tasks-p{N}.md`, findings file path = `.workflows/{work_unit}/implementation/{topic}/consolidation-findings-p{N}.md`, approved task numbers = the task numbers whose `staging.p{N}` rows are `approved`.

> **CHECKPOINT**: Do not proceed until the task author has returned.

#### If the author's `STATUS` is `failed`

Nothing was authored. State the author's reason plainly; the staging and the bank stay untouched.

**STOP.** Wait for user response.

**If the user resolves the input:**

→ Return to **E. Create Tasks in Plan** — re-invocation is idempotent.

**If the user abandons the tasks:**

Mark each remaining `approved` row `skipped` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.p{N}.tasks.{n} skipped`).

→ Proceed to **F. Record the Phase**.

#### Otherwise

Invoke the task-writer agent.

**Agent path**: `../../../agents/workflow-implementation-task-writer.md`

Pass via the orchestrator's prompt:

1. **Work unit** — the work unit name (for path construction)
2. **Topic name** — the implementation topic (scopes tasks to the correct plan)
3. **Staging file path** — the `consolidation-tasks-p{N}.md` file: proposals folded at **B**, bodies authored above
4. **Planning file path** — `.workflows/{work_unit}/planning/{topic}/planning.md`
5. **Plan format reading adapter path** — `../../workflow-planning-process/references/output-formats/{format}/reading.md`
6. **Plan format authoring adapter path** — `../../workflow-planning-process/references/output-formats/{format}/authoring.md`
7. **Phase placement** — `per-task` (every staged task carries `placement: phase {N}`), declared as a **consolidation-boundary placement**: phase {N}'s completion is deferred by the caller — the writer treats the phase as open
8. **Approved task numbers** — the task numbers whose `staging.p{N}` rows are `approved`

The agent creates exactly the approved tasks; a crash-resume re-invocation is safe (it creates only those not yet present).

> **CHECKPOINT**: Do not proceed until the task writer has returned.

#### If the writer's `STATUS` is `failed`

Nothing was created. State the writer's reason plainly; the staging and the bank stay untouched.

**STOP.** Wait for user response.

**If the user resolves the input:**

→ Return to **E. Create Tasks in Plan** — re-invocation is idempotent.

**If the user abandons the tasks:**

Mark each remaining `approved` row `skipped` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.implementation.{topic} staging.p{N}.tasks.{n} skipped`).

→ Proceed to **F. Record the Phase**.

#### If the writer's `STATUS` is `complete`

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

Commit the staging file with this topic's implementation artifacts, then the tasks — `--plan` stages the planning topic, the manifests, and the plan's declared storage:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): phase {N} consolidation — staged tasks" --topic implementation/{topic}
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): phase {N} consolidation — {K} task(s)" --plan {topic}
```

The loop's next task fetch sees the consolidation tasks; the phase records complete when they land (stage **H**'s `completing` disposition). Any task totals held in session context are stale — re-derive them at the next display.

→ Return to caller.

---

## F. Record the Phase

Close the phase:

1. **Consume the settled bank entries** — skip when no staging or findings file exists for this phase (no sweep ran). Pull each entry marked `mooted` (by the staging file's `## Bank Disposition`, else by the findings file's bank verdicts), and each `folded` entry — its task was offered and declined or abandoned, which is decided. `residue` entries stay. Use the quoted JSON, verbatim — `"removed": false` means the entry is not in the bank: read it back (`manifest get`) and pull the matching entry, or move on if it is already gone:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest pull {work_unit}.implementation.{topic} bank '{entry json exactly as banked}'
   ```
2. **Bank the finder's pre-existing debt** — push each `## Pre-existing Debt` entry the bank does not already hold, as at **B** step 5. A no-op when the findings file is absent or the entries are already deposited.
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
7. **Commit** — `--plan` stages the planning topic, the manifests, and the plan's declared storage:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): phase {N} consolidated" --plan {topic}
   ```

→ Return to caller.
