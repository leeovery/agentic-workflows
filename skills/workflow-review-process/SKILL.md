---
name: workflow-review-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
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

1. **Review ALL tasks** — In full mode, verify every planned task. In incremental mode, verify only unreviewed tasks
2. **Don't fix code** — Identify problems, don't solve them
3. **Don't re-implement** — You're reviewing, not building
4. **Be specific** — "Test doesn't cover X" not "tests need work"
5. **Reference artifacts** — Link findings to plan/spec with file:line references
6. **Balanced test review** — Flag both under-testing AND over-testing
7. **Fresh perspective** — You haven't seen this code before; question everything

---

## Output Formatting

When announcing a new step, output `── ── ── ── ──` on its own line before the step heading.

---

## Step 0: Resume Detection

Check if a review file exists at `.workflows/{work_unit}/review/{topic}/report.md`.

#### If no review file exists

→ Proceed to **Step 1**.

#### If review file exists

> *Output the next fenced block as a code block:*

```
Found existing review for "{topic:(titlecase)}".
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Continue or restart?

- **`c`/`continue`** — Continue the review from its current state
- **`r`/`restart`** — Delete the review and all report files. Start fresh.
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `continue`

→ Proceed to **Step 1**.

#### If `restart`

1. Delete the review file and all report files (`report-*.md`) in the review directory (`.workflows/{work_unit}/review/{topic}/`)
2. Clear review tracking (if it exists):
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.review.{topic} reviewed_tasks
   ```
   If `true`:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js delete {work_unit}.review.{topic} reviewed_tasks
   ```
3. Commit: `review({work_unit}): restart review`

→ Proceed to **Step 1**.

---

## Step 1: Initialize Review

Load **[initialize-review.md](references/initialize-review.md)** and follow its instructions as written.

---

## Step 2: Read Plan(s) and Specification(s)

Load **[read-plans.md](references/read-plans.md)** and follow its instructions as written.

→ Proceed to **Step 3**.

---

## Step 3: Load Project Skills

Load **[load-project-skills.md](references/load-project-skills.md)** and follow its instructions as written.

→ Proceed to **Step 4**.

---

## Step 4: QA Verification

Load **[invoke-task-verifiers.md](references/invoke-task-verifiers.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Produce Review

Load **[produce-review.md](references/produce-review.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Present Review

Load **[present-review.md](references/present-review.md)** and follow its instructions as written.

→ Proceed to **Step 7**.

---

## Step 7: Review Actions

Load **[review-actions-loop.md](references/review-actions-loop.md)** and follow its instructions as written.

