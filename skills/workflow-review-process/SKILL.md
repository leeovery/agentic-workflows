---
name: workflow-review-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(mkdir -p .workflows/.inbox)
---

# Review Process

Act as a **senior software architect** with deep experience in code review. You haven't seen this code before. Your job is to verify that every plan task was implemented correctly, tested adequately, and meets professional quality standards — then assess the product holistically.

## Purpose in the Workflow

Follows implementation. Verify plan tasks were implemented, tested adequately, and meet quality standards — then assess the product holistically.

### What This Skill Needs

- **Review scope** (required) - single, multi, or all
- **Plan content** (required) - Tasks and acceptance criteria to verify against (one or more plans)
- **Specification content** (required) - The specification from the prior phase, for design decision context

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read review and synthesis files** for the current topic. Review documents are at `.workflows/{work_unit}/review/{topic}/report.md` with per-task report files alongside (`report-{phase_id}-{task_id}.md`). Synthesis staging files are at `.workflows/{work_unit}/implementation/{topic}/review-tasks-c{N}.md`. These are your source of truth for progress.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

1. **Review ALL tasks** — Verify every planned task, or only unreviewed tasks when continuing a prior review
2. **Don't fix code** — Identify problems, don't solve them
3. **Don't re-implement** — You're reviewing, not building
4. **Be specific** — "Test doesn't cover X" not "tests need work"
5. **Reference artifacts** — Link findings to plan/spec with file:line references
6. **Balanced test review** — Flag both under-testing AND over-testing
7. **Fresh perspective** — You haven't seen this code before; question everything

---

## Step 0: Resume Detection

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking for an existing review. If one exists, you can
> continue reviewing unreviewed tasks or start fresh.
```

Check if a review file exists at `.workflows/{work_unit}/review/{topic}/report.md`.

#### If no review file exists

→ Proceed to **Step 1**.

#### If review file exists

Gather coverage state. Read `completed_tasks` from the implementation manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.implementation.{topic} completed_tasks
```

Check if `reviewed_tasks` exists in the review manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.review.{topic} reviewed_tasks
```

If `true`, read it:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit}.review.{topic} reviewed_tasks
```

Compare `completed_tasks` against `reviewed_tasks`. Let {C} = total completed, {R} = reviewed, {U} = unreviewed ({C} − {R}).

**If `reviewed_tasks` exists and unreviewed tasks remain:**

> *Output the next fenced block as a code block:*

```
Found existing review for "{topic:(titlecase)}".
Review covered {R} of {C} tasks. {U} task(s) not yet reviewed.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continue or restart?

- **`c`/`continue`** — Review the {U} unreviewed tasks
- **`r`/`restart`** — Delete review, re-review all {C} tasks
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**Otherwise** (all tasks reviewed, or no tracking data):

> *Output the next fenced block as a code block:*

```
Found existing review for "{topic:(titlecase)}".
@if(reviewed_tasks exists) All {C} tasks have been reviewed. @endif
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continue or restart?

- **`c`/`continue`** — Continue from current review state
- **`r`/`restart`** — Delete review, start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

**If unreviewed tasks exist:**

Set `unreviewed_tasks` = `[{list of unreviewed internal IDs}]`.

→ Proceed to **Step 1**.

**If all tasks reviewed:**

→ Proceed to **Step 7**.

**Otherwise** (no tracking data):

→ Proceed to **Step 1**.

#### If `restart`

1. Delete the review file and all report files (`report-*.md`) in the review directory (`.workflows/{work_unit}/review/{topic}/`)
2. Clear review tracking (if it exists):
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.review.{topic} reviewed_tasks
   ```
   If `true`:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.cjs delete {work_unit}.review.{topic} reviewed_tasks
   ```
3. Commit: `review({work_unit}): restart review`

→ Proceed to **Step 1**.

---

## Step 1: Initialize Review

> *Output the next fenced block as a code block:*

```
── Initialize Review ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Registering the review phase in the manifest.
```

Check if review phase is registered in manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs exists {work_unit}.review.{topic}
```

#### If `false`

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs init-phase {work_unit}.review.{topic}
```

→ Proceed to **Step 2**.

#### Otherwise

→ Proceed to **Step 2**.

---

## Step 2: Read Plan(s) and Specification(s)

> *Output the next fenced block as a code block:*

```
── Read Plans and Specifications ────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reading the plan and specification that the
> implementation was built from.
```

Load **[read-plans.md](references/read-plans.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Load Project Skills

> *Output the next fenced block as a code block:*

```
── Load Project Skills ──────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading project-level skills that inform
> quality expectations.
```

Load **[load-project-skills.md](references/load-project-skills.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: Knowledge Usage

> *Output the next fenced block as a code block:*

```
── Knowledge Usage ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Loading the usage guide for the knowledge base so
> proactive querying is available while verifying decisions.
```

Load **[knowledge-usage.md](../workflow-shared/references/knowledge-usage.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: QA Verification

> *Output the next fenced block as a code block:*

```
── QA Verification ──────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Dispatching task verifier agents. Each task is
> independently verified against its acceptance criteria
> and the specification.
```

Load **[invoke-task-verifiers.md](references/invoke-task-verifiers.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Produce Review

> *Output the next fenced block as a code block:*

```
── Produce Review ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Synthesising agent findings into the review report.
> Aggregating per-task results into an overall assessment.
```

Load **[produce-review.md](references/produce-review.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Present Review

> *Output the next fenced block as a code block:*

```
── Present Review ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Presenting the review findings. You'll see the
> verdict, summary, and detailed per-task results.
```

Load **[present-review.md](references/present-review.md)** and follow its instructions as written.

→ Proceed to **Step 8**.

---

## Step 8: Compliance Self-Check

> *Output the next fenced block as a code block:*

```
── Compliance Self-Check ────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Verifying the review follows workflow conventions.
```

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ Proceed to **Step 9**.

---

## Step 9: Review Actions

> *Output the next fenced block as a code block:*

```
── Review Actions ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Deciding what to do with the findings. You can
> accept the review, request fixes, or ask questions.
```

Load **[review-actions-loop.md](references/review-actions-loop.md)** and follow its instructions as written.

