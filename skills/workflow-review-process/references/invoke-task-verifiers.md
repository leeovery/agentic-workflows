# Invoke Task Verifiers

*Reference for **[workflow-review-process](../SKILL.md)***

---

This step dispatches `workflow-review-task-verifier` agents in batches to verify tasks across the selected plan(s). Each verifier independently checks one task for implementation, tests, and code quality, writing its full findings to a file and returning a brief status.

---

## A. Identify Scope

Build the list of implementation files using git history. For each plan in scope:

```bash
git log --oneline --name-only --pretty=format: --grep="impl({work_unit}): T{topic}-" | sort -u | grep -v '^$'
```

This captures all files touched by that plan topic's task commits (internal IDs embed the topic, so the `T{topic}-` prefix keeps sibling topics of a multi-topic epic out of scope).

→ Proceed to **B. Extract All Tasks**.

---

## B. Extract All Tasks

Read the work type:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit} work_type
```

Using the format reading adapter loaded in Step 2, extract every task across all phases from each plan in scope — excluding tasks the backend marks skipped or cancelled (deliberately discarded work is not reviewed; note the excluded ids — they are recorded as covered after the verifiers run, and the report discloses them):
- Note each task's description
- Note each task's acceptance criteria — quick-fix tasks carry a **Verification** section instead of acceptance criteria; note that
- Note expected micro acceptance (test name) — absent for quick-fix tasks
- Note each task's **internal ID** (format: `{topic}-{phase_id}-{task_id}`) — derive the **task suffix** by stripping the topic prefix (e.g., `auth-flow-1-1` → `1-1`)

→ Proceed to **C. Filter Tasks**.

---

## C. Filter Tasks

#### If `unreviewed_tasks` is set

Filter the extracted task list to only include tasks whose internal IDs appear in the `unreviewed_tasks` list. Skip all other tasks — they have already been reviewed.

→ Proceed to **D. Create Output Directory**.

#### Otherwise

Review all extracted tasks. No filtering needed.

→ Proceed to **D. Create Output Directory**.

---

## D. Create Output Directory

Ensure the review output directory exists:

```bash
mkdir -p .workflows/{work_unit}/review/{topic}
```

→ Proceed to **E. Batch Dispatch**.

---

## E. Batch Dispatch

Dispatch verifiers in **batches of 5** via the Task tool.

- **Agent path**: `../../../agents/workflow-review-task-verifier.md`

Before the first batch, read the recorded coverage once and hold it as a local set — `push` appends unconditionally, so a crash-resume re-run must never double-record (empty stdout means none):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.review.{topic} reviewed_tasks
```

1. Group tasks into batches of 5 — no task to verify is no batch, and the step falls through to the excluded tasks and the aggregation, which re-reads the reports already on disk
2. For each batch:
   - Dispatch all agents in the batch in parallel
   - Wait for all agents in the batch to return
   - Record statuses
   - Push the internal ID of each task whose verifier returned and that is not already in the set, and add it to the set — coverage lands per batch, so a crash mid-verification resumes from the batch it lost, never from the start; a failed verifier's task stays unrecorded, so the next session picks it up:
     ```bash
     node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.review.{topic} reviewed_tasks "{internal_id}"
     ```
3. After all batches complete, proceed to the excluded tasks

Each verifier receives:

1. **Plan task** — the specific task with acceptance criteria
2. **Specification path** — from the manifest (if available)
3. **Plan path** — the full plan for phase context
4. **Project skill paths** — from Step 3 discovery
5. **Review checklist path** — `.claude/skills/workflow-review-process/references/review-checklist.md`
6. **Work unit** — the work unit name (for path construction)
7. **Topic** — the plan topic name (used for output directory)
8. **Task suffix** — the `{phase_id}-{task_id}` portion of the internal ID (for output file naming, e.g., `1-1`)
9. **Work type** — from the manifest (`quick-fix` switches the verifier to completeness-based criteria)
10. **Implementation files** — the plan's file list from **A. Identify Scope** (the verifier's starting set for locating the task's code)

If any verifier fails (error, timeout), record the failure and continue — aggregate what's available.

Each verifier returns a brief status:

```
STATUS: complete | incomplete | issues_found
FINDINGS_COUNT: {N blocking issues}
SUMMARY: {1 sentence}
```

Full findings are written to `.workflows/{work_unit}/review/{topic}/report-{phase_id}-{task_id}.md`.

→ Proceed to **F. Record Excluded Tasks**.

---

## F. Record Excluded Tasks

Push the ids excluded as skipped/cancelled at extraction — excluded-by-design is covered; without this, the resume gate counts them unreviewed forever. `push` appends unconditionally: skip any id already in the set.

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest push {work_unit}.review.{topic} reviewed_tasks "{internal_id}"
```

→ Proceed to **G. Aggregate Findings**.

---

## G. Aggregate Findings

1. Read every `.workflows/{work_unit}/review/{topic}/report-*.md` file from disk — the aggregation draws from the files as they stand, never from memory of the dispatches that produced them. Make each Read before aggregating; a read not actually made is never claimed or paraphrased from the dispatch summaries
2. Synthesize findings from file contents:
   - Collect the blocking issues from each report's `BLOCKING ISSUES` section — every entry other than `- None`. Never infer one from `STATUS`: `issues_found` is a delivered task with non-blocking findings
   - Collect all test issues (under/over-tested)
   - Collect all code quality concerns
   - Include specific file:line references
   - Check overall plan completion (see [review-checklist.md](review-checklist.md) — Plan Completion Check)
3. Collect every `UNSETTLED` entry other than `- None` into `.workflows/.cache/{work_unit}/review/{topic}/unsettled.txt` with the Write tool — one block per criterion, opening with `[{task suffix}]` and carrying the entry verbatim. When there are none, delete any `unsettled.txt` an earlier run left there and write nothing: the executing pass treats an absent file as no unsettled criteria

> **CHECKPOINT**: Do not proceed until ALL task verifiers have returned and findings are aggregated.

→ Return to caller.
