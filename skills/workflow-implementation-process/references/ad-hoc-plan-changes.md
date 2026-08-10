# Ad Hoc Plan Changes

*Reference for **[workflow-implementation-process](../SKILL.md)***

---

Unplanned work surfaced mid-implementation — a bug hit while testing, a gap the conversation exposed, an agent result naming missing work, a changed decision. This reference folds it into the plan through the same infrastructure that authored the plan, never by hand.

The caller is whatever flow the conversation interrupted — mid-task-loop, at a gate, during analysis, while a backgrounded executor runs. On `→ Return to caller.`, resume that flow exactly where it stopped; if a gate menu was pending, re-render it from its surface before continuing.

When the user names the work, start from their words. When you spot it first — in their question, in an agent's result, in what they hit while testing — offer it: name what you think the work is and ask whether to fold it in. Proceed only on their yes.

## A. Frame the Work

Establish in conversation what the work is and what done looks like.

**If the work requires a decision the specification doesn't answer:**

Present the decision to the user and stop — implementation absorbs work, never makes decisions (Hard Rules). Work the user rules outside this plan's scope is captured through the capture skills (`workflow-log-idea`, `workflow-log-bug`, `workflow-log-quickfix`), never absorbed into tasks.

→ Return to caller.

**Otherwise:**

Pick the landing by first match:

- The task currently executing already owns the ground — same files, same scope, a "watch out for this". → Proceed to **B. Deliver to the Executor**.
- A pending task already owns the ground — the work refines or extends a task not yet run. → Proceed to **C. Amend a Pending Task**.
- New work. → Proceed to **D. Add Tasks to the Plan**.

## B. Deliver to the Executor

No plan write — the instruction rides the current task, and the task's reviewer verifies it with the rest.

- Executor still running (backgrounded): send it the instruction as an agent message now.
- Otherwise: append the instruction to the task's next dispatch prompt — a retry, or its first dispatch — beneath the normalised task content, marked as an addition from the user.

→ Return to caller.

## C. Amend a Pending Task

Read the plan format's updating adapter — `../../workflow-planning-process/references/output-formats/{format}/updating.md`, **Updating Task Content** — and apply the change: edit the description or append to it, whichever the format supports and the change warrants. The task carries the addition when its turn comes.

Confirm the wording with the user before writing when the change is more than mechanical.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'`).

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): amend task {internal_id}" --plan {topic}
```

→ Return to caller.

## D. Add Tasks to the Plan

**Placement first.** Settle in conversation where the work surfaces — it usually falls out of the problem: a bug blocking the user's testing comes up next; deferred polish tails the plan; work belonging to an upcoming phase joins it. Express ordering through the format's own mechanics, never by rewriting phases. Read the format's `graph.md` (`../../workflow-planning-process/references/output-formats/{format}/graph.md`) when the discussion needs its mechanics. Per task, the choices are:

- an existing phase (current, upcoming, or last) or a new phase at the tail
- a priority, when natural ordering would surface it too late or too early
- dependency edges, when order matters and natural ordering wouldn't produce it

**Draft.** Write each task in the staging shape below — `placement:` always; `priority:` and `depends_on:` only when the placement discussion called for them. Present the draft verbatim:

> *Output the next fenced block as a code block:*

```
{drafted task content}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
**`◆ Add to the plan?`**

**`y/yes`**  → Write the task(s) to the plan
**Adjust** → Tell me what to change
```

**STOP.** Wait for user response.

#### If the user adjusts

Revise the draft per their feedback and re-present.

→ Return to **D. Add Tasks to the Plan** (the gate above).

#### If `yes`

Write the staging file to `.workflows/{work_unit}/implementation/{topic}/adhoc-tasks-{n}.md` (`{n}` = next integer not on disk) — pure markdown, no frontmatter; the conversation above is the approval record:

```markdown
# Ad Hoc Tasks: {Topic}

## Task 1: {title}
placement: {phase {N}|new phase "{label}"}
priority: {level}
depends_on: {internal_id, ...}

**Problem**: {what's missing or wrong}
**Solution**: {what to do}
**Outcome**: {what success looks like}
**Do**: {step-by-step implementation instructions}
**Acceptance Criteria**:
- {criterion}
**Tests**:
- {test description}

## Task 2: {title}
...
```

Invoke the task-writer agent.

**Agent path**: `../../../agents/workflow-implementation-analysis-task-writer.md`

Pass via the orchestrator's prompt:

1. **Work unit** — the work unit name (for path construction)
2. **Topic name** — the implementation topic (scopes tasks to the correct plan)
3. **Staging file path** — the `adhoc-tasks-{n}.md` file just written
4. **Planning file path** — `.workflows/{work_unit}/planning/{topic}/planning.md`
5. **Plan format reading adapter path** — `../../workflow-planning-process/references/output-formats/{format}/reading.md`
6. **Plan format authoring adapter path** — `../../workflow-planning-process/references/output-formats/{format}/authoring.md`
7. **Phase placement** — `per-task`
8. **Approved task numbers** — every task in the staging file
9. **Plan format graph adapter path** — `../../workflow-planning-process/references/output-formats/{format}/graph.md`

> **CHECKPOINT**: Do not proceed until the task writer has returned.

**If the planning item carries no `storage_paths`** (a plan initialised before the field existed): record it now — read the format's authoring.md → Storage Pathspecs and copy the fenced array (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'`).

Commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "impl({work_unit}): add {K} ad hoc task(s)" --plan {topic}
```

→ Return to caller.
