---
name: workflow-start
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/workflow-start/scripts/discovery.js), Bash(node .claude/skills/workflow-manifest/scripts/manifest.js)
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

> *Output the next fenced block as a code block:*

```
──────────────────────────────────────────────────────────────────────
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

──────────────────────────────────────────────────────────────────────
Agentic engineering workflows — from idea to implementation.
──────────────────────────────────────────────────────────────────────
```

---

## Step 0: Run Migrations

**This step is mandatory. You must complete it before proceeding.**

Invoke the `/workflow-migrate` skill and follow its instructions exactly — if it issues a STOP gate, you must stop.

---

## Step 1: Run Discovery

!`node .claude/skills/workflow-start/scripts/discovery.js`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/workflow-start/scripts/discovery.js
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

**From `state` section:**
- Counts for each work type, `has_any_work` flag

→ Proceed to **Step 2**.

---

## Step 2: Check State

#### If `state.has_any_work` is false

Load **[empty-state.md](references/empty-state.md)** and follow its instructions as written.

#### Otherwise

→ Proceed to **Step 3**.

---

## Step 3: Display and Route

Load **[active-work.md](references/active-work.md)** and follow its instructions as written.
