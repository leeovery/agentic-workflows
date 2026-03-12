---
name: technical-implementation
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
---

# Technical Implementation

Orchestrate implementation by dispatching **executor** and **reviewer** agents per task. Each agent invocation starts fresh — flat context, no accumulated state.

- **Executor** (`../../agents/implementation-task-executor.md`) — implements one task via strict TDD
- **Reviewer** (`../../agents/implementation-task-reviewer.md`) — independently verifies the task (opus)

The orchestrator owns: plan reading, task extraction, agent invocation, git operations, tracking, task gates.

## Purpose in the Workflow

Follows planning. Execute the plan by dispatching agents per task — executor implements via TDD, reviewer verifies independently.

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
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic}
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
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} task_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} fix_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} analysis_gate_mode gated
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} fix_attempts 0
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} analysis_cycle 0
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
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} format
   ```
   If not set in the implementation phase, check the planning phase:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} format
   ```
3. Load the format's per-concern adapter files from `../technical-planning/references/output-formats/{format}/`:
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
   node .claude/skills/workflow-manifest/scripts/manifest.js init-phase {work_unit} --phase implementation --topic {topic}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} format {format from plan}
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} task_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} fix_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} analysis_gate_mode gated
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} fix_attempts 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} analysis_cycle 0
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} linters []
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} project_skills []
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} current_phase 1
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} current_task ~
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

Check `project_skills` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} project_skills`).

#### If `project_skills` is populated

Present the existing configuration for confirmation:

> *Output the next fenced block as markdown (not a code block):*

```
Previous session used these project skills:
- `{skill-name}` — {path}
- ...

· · · · · · · · · · · ·
Keep these project skills?

- **`y`/`yes`** — Keep and proceed
- **`c`/`change`** — Re-discover and choose skills
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **Step 5**.

#### If `change`

Clear `project_skills` and fall through to discovery below.

#### If `.claude/skills/` does not exist or is empty

> *Output the next fenced block as a code block:*

```
No project skills found. Proceeding without project-specific conventions.
```

→ Proceed to **Step 5**.

#### If project skills exist

Scan `.claude/skills/` for project-specific skill directories. Present findings:

> *Output the next fenced block as markdown (not a code block):*

```
Found these project skills that may be relevant to implementation:
- `{skill-name}` — {brief description}
- `{skill-name}` — {brief description}
- ...

· · · · · · · · · · · ·
Which project skills should be used?

- **`a`/`all`** — Use all listed skills
- **`n`/`none`** — Skip project skills
- **List the ones you want** — e.g. "golang-pro, react-patterns"
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Store the selected skill paths via manifest CLI, pushing each path individually:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit} --phase implementation --topic {topic} project_skills "{path1}"
node .claude/skills/workflow-manifest/scripts/manifest.js push {work_unit} --phase implementation --topic {topic} project_skills "{path2}"
```

→ Proceed to **Step 5**.

---

## Step 5: Linter Discovery

Load **[linter-setup.md](references/linter-setup.md)** and follow its instructions as written.

Check `linters` via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} linters`). If already populated, present the existing configuration for confirmation (same pattern as project skills in Step 4). If confirmed, skip discovery and proceed.

Otherwise, present discovery findings to the user:

> *Output the next fenced block as markdown (not a code block):*

```
**Linter discovery:**
- {tool} — `{command}` (installed / not installed)
- ...

Recommendations: {any suggested tools with install commands}

· · · · · · · · · · · ·
Approve these linters?

- **`y`/`yes`** — Approve and proceed
- **`c`/`change`** — Modify the linter list
- **`s`/`skip`** — Skip linter setup (no linting during TDD)
· · · · · · · · · · · ·
```

**STOP.** Wait for user choice.

#### If `yes`

Store the approved linter commands via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} linters [...]`).

→ Proceed to **Step 6**.

#### If `change`

Adjust based on user input, re-present for confirmation.

#### If `skip`

Store empty linters array via manifest CLI (`node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} linters []`).

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
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} status completed
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} analysis_cycle 0
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} fix_attempts 0
```

Commit: `impl({work_unit}): complete implementation`

**Pipeline continuation** — Invoke the bridge:

```
Pipeline bridge for: {work_unit}
Completed phase: implementation

Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
```


