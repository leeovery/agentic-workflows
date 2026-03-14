---
name: workflow-implementation-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

# Implementation Process

Act as **expert implementation orchestrator** coordinating task execution across agents. Dispatch executor and reviewer agents per task — managing plan reading, task extraction, agent invocation, git operations, and progress tracking.

## Purpose in the Workflow

Follows planning. Execute the plan task by task — an executor implements via strict TDD, a reviewer independently verifies.

### What This Skill Needs

- **Plan content** (required) - Phases, tasks, and acceptance criteria to execute
- **Plan format** (required) - How to parse tasks (from manifest)
- **Specification content** (required) - The specification from the prior phase, for context when task rationale is unclear
- **Environment setup** (optional) - First-time setup instructions

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Check task progress in the plan** — use the plan adapter's instructions to read the plan's current state. Also read the implementation file and any other working documents for additional context.
3. **Check gate modes and progress** via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic}
   ```
   Check `task_gate_mode`, `fix_gate_mode`, `analysis_gate_mode`, `fix_attempts`, and `analysis_cycle` — if gates are `auto`, the user previously opted out. If `fix_attempts` > 0, you're mid-fix-loop for the current task. If `analysis_cycle` > 0, you've completed analysis cycles — check for findings files on disk (`analysis-*-c{cycle-number}.md` in the implementation directory) to determine mid-analysis state.
4. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
5. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Orchestrator Hard Rules

1. **No autonomous decisions on spec deviations** — when the executor reports a blocker or spec deviation, present to user and STOP. Never resolve on the user's behalf.
2. **All git operations are the orchestrator's responsibility** — agents never commit, stage, or interact with git.

## Output Formatting

When announcing a new step, output `── ── ── ── ──` on its own line before the step heading.

---

## Step 0: Resume Detection

Check if an implementation file exists at `.workflows/{work_unit}/implementation/{topic}/implementation.md`.

#### If no implementation file exists

→ Proceed to **Step 1**.

#### If implementation file exists

> *Output the next fenced block as a code block:*

```
Found existing implementation for "{topic:(titlecase)}". Resuming from previous session.
```

Reset gate modes and counters via manifest CLI (fresh session = fresh gates/cycles):
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} task_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_attempts 0
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_cycle 0
```

→ Proceed to **Step 1**.

---

## Step 1: Environment Setup

Run setup commands EXACTLY as written, one step at a time.
Do NOT modify commands based on other project documentation (CLAUDE.md, etc.).
Do NOT parallelize steps — execute each command sequentially.
Complete ALL setup steps before proceeding.

Load **[environment-setup.md](references/environment-setup.md)** and follow its instructions as written.

#### If `.workflows/.state/environment-setup.md` states `No special setup required`

→ Proceed to **Step 2**.

#### If setup instructions exist

Follow them. Complete ALL steps before proceeding.

→ Proceed to **Step 2**.

#### If no setup file exists

> *Output the next fenced block as a code block:*

```
No environment setup document found. Are there any setup instructions
I should follow before implementing?
```

**STOP.** Wait for user response.

Save their instructions to `.workflows/.state/environment-setup.md` (or "No special setup required." if none needed). Commit.

→ Proceed to **Step 2**.

---

## Step 2: Read Plan + Load Plan Adapter

1. Read the plan from the provided location (typically `.workflows/{work_unit}/planning/{topic}/planning.md`)
2. Plans can be stored in various formats. Read the `format` via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} format
   ```
   If not set in the implementation phase, check the planning phase:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format
   ```
3. Load the format's per-concern adapter files from `../workflow-planning-process/references/output-formats/{format}/`:
   - **reading.md** — how to read tasks from the plan
   - **updating.md** — how to write progress to the plan
4. If no `format` field exists, ask the user which format the plan uses.
5. These adapter files apply during Step 6 (task loop) and Step 7 (analysis).
6. Also load the format's **authoring.md** adapter — needed in Step 7 if analysis tasks are created.

→ Proceed to **Step 3**.

---

## Step 3: Initialize Implementation Tracking

#### If `.workflows/{work_unit}/implementation/{topic}/implementation.md` already exists

→ Proceed to **Step 4**.

#### If no implementation file exists

1. Set implementation state via manifest CLI:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit}.implementation.{topic}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} format {format from plan}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} task_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_attempts 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_cycle 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} linters []
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} project_skills []
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} current_phase 1
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} current_task ~
   ```

2. Create `.workflows/{work_unit}/implementation/{topic}/implementation.md`:

   ```markdown
   # Implementation: {Topic Name}

   Implementation started.
   ```

3. Commit: `impl({work_unit}): start implementation`

→ Proceed to **Step 4**.

---

## Step 4: Project Skills Discovery

Load **[project-skills-discovery.md](references/project-skills-discovery.md)** and follow its instructions as written.

→ Proceed to **Step 5**.

---

## Step 5: Linter Discovery

Load **[linter-setup.md](references/linter-setup.md)** and follow its instructions as written.

→ Proceed to **Step 6**.

---

## Step 6: Task Loop

Load **[task-loop.md](references/task-loop.md)** and follow its instructions as written.

After the loop completes:

#### If the task loop exited early (user chose `stop`)

→ Proceed to **Step 8**.

#### Otherwise

→ Proceed to **Step 7**.

---

## Step 7: Analysis Loop

Load **[analysis-loop.md](references/analysis-loop.md)** and follow its instructions as written.

#### If new tasks were created in the plan

→ Return to **Step 6**.

#### If no tasks were created

→ Proceed to **Step 8**.

---

## Step 8: Mark Implementation Complete

Before marking complete, present the sign-off:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to mark implementation as completed?

- **`y`/`yes`** — Mark as completed
- **Comment** — Add context before completing
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If comment

Discuss the user's context.

**If additional work is needed:**

→ Return to **Step 6** or **Step 7** as appropriate.

**Otherwise:**

Re-present the sign-off prompt above.

#### If `yes`

Update implementation status via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} status completed
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} analysis_cycle 0
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.implementation.{topic} fix_attempts 0
```

Commit: `impl({work_unit}): complete implementation`

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: implementation

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```


