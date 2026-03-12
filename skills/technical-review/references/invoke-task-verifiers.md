# Invoke Task Verifiers

*Reference for **[technical-review](../SKILL.md)***

---

This step dispatches `review-task-verifier` agents in batches to verify tasks across the selected plan(s). Each verifier independently checks one task for implementation, tests, and code quality, writing its full findings to a file and returning a brief status.

---

## Identify Scope

Build the list of implementation files using git history. For each plan in scope:

```bash
git log --oneline --name-only --pretty=format: --grep="impl({work_unit}):" | sort -u | grep -v '^$'
```

This captures all files touched by implementation commits for the topic.

---

## Extract All Tasks

Using the format reading adapter loaded in Step 2, extract every task across all phases from each plan in scope:
- Note each task's description
- Note each task's acceptance criteria
- Note expected micro acceptance (test name)
- Note each task's **internal ID** (format: `{topic}-{phase_id}-{task_id}`) for file naming

---

## Filter Tasks (Incremental Mode)

#### If `review_mode` is `incremental`

Filter the extracted task list to only include tasks whose internal IDs appear in the `unreviewed_tasks` list passed from the entry point. Skip all other tasks — they have already been reviewed.

#### If `review_mode` is `full`

Review all extracted tasks. No filtering needed.

---

## Create Output Directory

Ensure the review output directory exists:

```bash
mkdir -p .workflows/{work_unit}/review/{topic}
```

---

## Batch Dispatch

Dispatch verifiers in **batches of 5** via the Task tool.

- **Agent path**: `../../../agents/review-task-verifier.md`

1. Group tasks into batches of 5
2. For each batch:
   - Dispatch all agents in the batch in parallel
   - Wait for all agents in the batch to return
   - Record statuses
3. After all batches complete, proceed to aggregation

Each verifier receives:

1. **Plan task** — the specific task with acceptance criteria
2. **Specification path** — from the manifest (if available)
3. **Plan path** — the full plan for phase context
4. **Project skill paths** — from Step 3 discovery
5. **Review checklist path** — `skills/technical-review/references/review-checklist.md`
6. **Work unit** — the work unit name (for path construction)
7. **Topic** — the plan topic name (used for output directory)
8. **Internal ID** — the internal ID (for output file naming, e.g., `{topic}-1-1`)

If any verifier fails (error, timeout), record the failure and continue — aggregate what's available.

---

## Expected Result

Each verifier returns a brief status:

```
STATUS: Complete | Incomplete | Issues Found
FINDINGS_COUNT: {N blocking issues}
SUMMARY: {1 sentence}
```

Full findings are written to `.workflows/{work_unit}/review/{topic}/qa-task-{internal_id}.md`.

---

## Update Reviewed Tasks

After all verifiers complete, push each verified task's internal ID to the review manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit} --phase review --topic {topic} reviewed_tasks "{internal_id}"
```

This enables incremental review detection on subsequent review sessions.

---

## Aggregate Findings

Once all batches have completed:

1. Read all `.workflows/{work_unit}/review/{topic}/qa-task-*.md` files
2. Synthesize findings from file contents:
   - Collect all tasks with `STATUS: Incomplete` or `STATUS: Issues Found` as blocking issues
   - Collect all test issues (under/over-tested)
   - Collect all code quality concerns
   - Include specific file:line references
   - Check overall plan completion (see [review-checklist.md](review-checklist.md) — Plan Completion Check)
