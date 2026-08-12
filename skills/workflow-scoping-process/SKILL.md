---
name: workflow-scoping-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(ls .workflows/), Bash(rm -rf .workflows/), Bash(git log), Bash(git rev-parse), Bash(git add), Bash(git commit)
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup'
---

# Scoping Process

Act as **expert technical analyst** performing rapid scoping of a mechanical change. Assess scope, write a lightweight specification, and produce 1-2 task files — all in a single pass.

## Purpose in the Workflow

Scope a mechanical change — gather context, write a specification, and produce a plan with 1-2 task files ready for implementation.

## What This Skill Needs

- **Work unit description** (required) - From the manifest, summarising the mechanical change
- **Topic name** (required) - Same as work_unit for quick-fix
- **Output format preference** (optional) - Will ask if not specified

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Check what artifacts exist on disk** — spec file, plan file, task files. Their presence reveals which steps completed.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

1. **Maximum 2 tasks** — if the change needs more, it's not a quick-fix. Promote it.
2. **No acceptance criteria** — mechanical changes are verified by test baselines and completeness checks, not by acceptance criteria.
3. **No agents** — scoping writes specs and tasks directly, without invoking planning agents or review cycles.

---

## Step 0: Resume Detection

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} scoping {topic}
```

Check if a specification already exists:

```bash
ls .workflows/{work_unit}/specification/{topic}/specification.md 2>/dev/null && echo "exists" || echo "none"
```

#### If specification does not exist

→ Proceed to **Step 1**.

#### If specification exists

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Resume Detection`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> An in-progress scoping specification exists — choose whether to pick it up or start fresh.
```

Read the plan and scoping statuses:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} status
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.scoping.{topic} status
```

**If plan status is `completed` and scoping status is `in-progress`** (reopened for revisit):

Render the resume menu and emit its section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render resume-gate {work_unit}.scoping.{topic} --variant scoping
```

**STOP.** Wait for user response.

**If plan status is `completed` and scoping status is not `in-progress`:**

> *Output the next fenced block as a code block:*

```
Scoping already completed for "{topic:(titlecase)}". Spec and plan are in place.
```

If the scoping status read was empty (item missing), register and complete it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} scoping {topic}
node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} scoping {topic}
```

→ Proceed to **Step 8**.

**If plan status is not `completed`** (empty or `in-progress`):

The spec exists but the plan is incomplete — an interrupted prior run. Rebuild the context the interrupted run had:

1. Read `.workflows/{work_unit}/specification/{topic}/specification.md` in full — it is the gathered context Step 7 authors tasks from.
2. Read the specification item's status:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} status
   ```
   If the output is empty (the run crashed between writing the spec file and registering it), register and index it now:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic start {work_unit} specification {topic}
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} specification {topic}
   ```
   If the `complete` response carries `warnings`, display them but do not block — the artifact is already saved.
3. Reconcile tasks the interrupted run may already have created in an external backend:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} format
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic} external_id
   ```
   If both are set, load the format's **[reading.md](../workflow-planning-process/references/output-formats/{format}/reading.md)** and list the tasks already created under `external_id`. Carry that list into Step 7 — existing tasks are adjusted or completed, never re-authored as duplicates. If either read is empty, nothing was authored — resume cleanly.

→ Proceed to **Step 6** (resume from format selection).

#### If `continue`

Load the artifacts as session context: read the spec (`.workflows/{work_unit}/specification/{topic}/specification.md`) and the plan (`.workflows/{work_unit}/planning/{topic}/planning.md`) in full, then read the planning item once — `format`, `external_id`, and `storage_paths` all ride the subtree — and locate and read the task files via the format's **[reading.md](../workflow-planning-process/references/output-formats/{format}/reading.md)**:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic}
```

**If the subtree carries no `storage_paths`** (a plan initialised before the field existed): record it now, before anything commits — read the format's authoring.md → Storage Pathspecs and copy the fenced array:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set {work_unit}.planning.{topic} storage_paths '{format storage pathspecs}'
```

> *Output the next fenced block as a code block:*

```
Revisiting scoping for "{topic:(titlecase)}".

What should change in the spec or plan?
```

**STOP.** Wait for user response.

Apply the requested edits — the spec and `planning.md` directly, task file content per the format's **[authoring.md](../workflow-planning-process/references/output-formats/{format}/authoring.md)**. Hard rules still hold: maximum 2 tasks, no acceptance criteria. Then:

1. If the spec changed, re-index it (re-completion re-indexes over the same identity):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} specification {topic}
   ```
2. Re-complete scoping:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs topic complete {work_unit} scoping {topic}
   ```
3. Commit — `--plan` stages the work unit, the project manifest, and the plan's declared storage in one scoped call (the knowledge store rides along automatically):
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "scoping({work_unit}): adjust specification and plan" --plan {topic}
   ```

→ Proceed to **Step 8**.

#### If `restart`

1. Read the planning item once — `format`, `external_id`, and `storage_paths` all ride the subtree:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.planning.{topic}
   ```
2. Load the format's **[authoring.md](../workflow-planning-process/references/output-formats/{format}/authoring.md)**
3. Follow the authoring file's cleanup instructions to remove authored tasks for this topic — the cleanup targets the entity identified by `external_id`
4. Delete the spec and plan files: `rm -rf .workflows/{work_unit}/specification/{topic}/ .workflows/{work_unit}/planning/{topic}/`
5. Remove the spec's knowledge-base entry:
   ```bash
   node .claude/skills/workflow-knowledge/scripts/knowledge.cjs remove --work-unit {work_unit} --phase specification --topic {topic}
   ```
6. Delete the specification and planning manifest entries — the scoping item stays `in-progress`; the fresh run re-completes it at Write Tasks:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.specification items.{topic}
   node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.planning items.{topic}
   ```
7. Commit with raw git — the planning item was just deleted, so `--plan` has nothing to read; stage the work unit, the knowledge store (only when `.workflows/.knowledge` exists — staging a nonexistent path is a git error), and the `storage_paths` read in step 1, then commit. Each entry passes as a bare pathspec; when the array is `[]` or the field is absent, stage nothing extra.
   ```bash
   git add -- .workflows/{work_unit} .workflows/.knowledge {storage_paths}
   git commit -m "scoping({work_unit}): restart scoping"
   ```

→ Proceed to **Step 1**.

---

## Step 1: Knowledge Usage

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Gather Context

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Gather Context`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Understanding what needs changing — reading code, asking clarifying questions, and building a picture of the change.
```

Load **[gather-context.md](references/gather-context.md)** and follow its instructions as written.

*Knowledge-base nudge — if the change touches an area with prior discussions, investigations, or specs, query the knowledge base while gathering context. A "mechanical change" often has a history. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*

→ On return, proceed to **Step 3**.

---

## Step 3: Contextual Query

Load **[contextual-query.md](../workflow-knowledge/references/contextual-query.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Complexity Check

Load **[complexity-check.md](references/complexity-check.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Write Specification

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Write Specification`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Writing a lightweight specification for the change. This captures what's changing and why.
```

Load **[write-specification.md](references/write-specification.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: Select Output Format

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Select Output Format`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Choosing the output format for task files.
```

Load **[select-format.md](references/select-format.md)** and follow its instructions as written.

→ On return, proceed to **Step 7**.

---

## Step 7: Write Tasks

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Write Tasks`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Writing 1-2 task files for the change. Quick-fixes are limited to two tasks maximum.
```

Load **[write-tasks.md](references/write-tasks.md)** and follow its instructions as written.

→ On return, proceed to **Step 8**.

---

## Step 8: Conclude Scoping

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Conclude Scoping`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Spec and plan are ready for implementation.
```

Load **[conclude-scoping.md](references/conclude-scoping.md)** and follow its instructions as written.
