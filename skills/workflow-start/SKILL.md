---
name: workflow-start
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/workflow-start/scripts/discovery.cjs), Bash(node .claude/skills/workflow-manifest/scripts/manifest.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs)
---

Unified workflow entry point. Discovers state, shows all active work, and routes to start or continue skills.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- Complete each step fully before moving to the next

---

## Step 0: Initialisation

> *Output the next fenced block as a code block:*

```
●─────────────────────────────────────────────────────────────────●
    ___   _____________   __________________
   /   | / ____/ ____/ | / /_  __/  _/ ____/
  / /| |/ / __/ __/ /  |/ / / /  / // /
 / ___ / /_/ / /___/ /|  / / / _/ // /___
/_/  |_\____/_____/_/ |_/ /_/ /___/\____/
 _       ______  ____  __ __ ________    ____ _       _______
| |     / / __ \/ __ \/ //_// ____/ /   / __ \ |     / / ___/
| | /| / / / / / /_/ / ,<  / /_  / /   / / / / | /| / /\__ \
| |/ |/ / /_/ / _, _/ /| |/ __/ / /___/ /_/ /| |/ |/ /___/ /
|__/|__/\____/_/ |_/_/ |_/_/   /_____/\____/ |__/|__//____/

●─────────────────────────────────────────────────────────────────●
  Agentic engineering workflows — from idea to implementation.
●─────────────────────────────────────────────────────────────────●
```

> *Output the next fenced block as a code block:*

```
── Initialisation ───────────────────────────────
```

### Step 0.1: Casing Conventions

Load **[casing-conventions.md](../workflow-shared/references/casing-conventions.md)** and follow its instructions as written.

→ Proceed to **Step 0.2**.

### Step 0.2: Migrations

> *Output the next fenced block as markdown (not a code block):*

```
> Running migrations to keep workflow files in sync.
```

**Run migrations — this is mandatory. You must complete it before proceeding.**

Invoke the `/workflow-migrate` skill and follow its instructions exactly — if it issues a STOP gate, you must stop.

**CRITICAL**: When the migrate skill returns (either after committing changes or reporting no changes needed), you MUST continue to **Step 0.3**. Do not stop after migration completes.

→ Proceed to **Step 0.3**.

### Step 0.3: Knowledge Check

Load **[knowledge-check.md](../workflow-knowledge/references/knowledge-check.md)** and follow its instructions as written.

→ Proceed to **Step 1**.

---

## Step 1: Run Discovery

> *Output the next fenced block as a code block:*

```
── Run Discovery ────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Scanning your workflow directory. Looking for active work,
> completed items, and inbox entries to show you the full picture.
```

!`node .claude/skills/workflow-start/scripts/discovery.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/workflow-start/scripts/discovery.cjs
```

Parse the output to understand the current workflow state:

**From `epics` section:**
- `work_units` — name, active_phases (list of phase names with artifacts)

**From `features` section:**
- `work_units` — name, next_phase, phase_label

**From `bugfixes` section:**
- `work_units` — name, next_phase, phase_label

**From `completed`/`cancelled` arrays:**
- Non-active work units with name, work_type, status, last_phase
- `completed_count`, `cancelled_count`

**From `inbox` section (only present when inbox items exist):**
- `ideas` — slug, date, title for each idea
- `bugs` — slug, date, title for each bug
- `idea_count`, `bug_count`, `total_count`

**From `state` section:**
- Counts for each work type, `has_any_work` flag
- `has_inbox`, `inbox_count`

→ Proceed to **Step 2**.

---

## Step 2: Check State

> *Output the next fenced block as a code block:*

```
── Check State ──────────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Determining what to show you. Routing based on whether
> active work was found.
```

#### If `state.has_any_work` is false

Load **[empty-state.md](references/empty-state.md)** and follow its instructions as written.

#### Otherwise

→ Proceed to **Step 3**.

---

## Step 3: Display and Route

> *Output the next fenced block as a code block:*

```
── Display and Route ────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Showing your active work and available options.
```

Load **[active-work.md](references/active-work.md)** and follow its instructions as written.
