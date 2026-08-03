---
name: workflow-start
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/workflow-start/scripts/gateway.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(git diff)
---

Unified workflow entry point. Discovers state, shows all active work, and routes to start or continue skills.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

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
  Agentic Engineering Workflows (v0.6.33)
●─────────────────────────────────────────────────────────────────●
```

> *Output the next fenced block as a code block:*

```
── Initialisation ───────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Setting up the session — running the system boot checks.
```

### Step 0.1: Boot

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the workflow system before anything runs — applying any
> pending migrations, then confirming the knowledge base is ready.
```

**Run the boot pipeline — this is mandatory. You must complete it before proceeding.**

Run the boot command with sandbox disabled (migrations may need to modify `.claude/settings.json`) and capture its JSON response:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs boot
```

**CRITICAL**: Use `dangerouslyDisableSandbox: true` when calling the Bash tool for this command.

#### If the command fails (`ok: false` or non-zero exit)

Migrations must never half-run silently. Surface the reported error to the user.

**STOP.** Do not proceed — terminal condition.

#### If `migrations.changed` is `true` or `migrations.verify` is non-empty

Files were updated, or a migration handed over checks its code could not perform. You MUST complete the steps below before proceeding.

1. **If `migrations.verify` is non-empty:** each entry is a migration that ran this boot. Its `info` says what the migration does in any project; its `verify` says what to check in this one. Perform each entry's checks with judgment against the actual files — the migration's code is exact-match and may have missed what it could not recognise — and fix what you find. Your fixes are migration changes: they join the diff, the summary, and the commit below.

2. Run `git status --short -- .workflows` and `git diff -- .workflows` to see what changed. Status shows moved and newly-created files that diff cannot (untracked destinations render a move as bare deletions) — read both before summarising.

   **If nothing changed** (the migrations skipped everything and verification found nothing to fix):

   > *Output the next fenced block as a code block:*

   ```
   All documents up to date.
   ```

   **Do not stop here.** Nothing needs review.

   → Proceed to **Step 0.2**.

3. Write a brief natural language summary of what the migrations did — verification fixes included (e.g., "Restructured workflow directories, created manifest files, recovered a rerouted concern the converter missed"). Focus on the nature of the changes, not individual file paths — these are internal workflow state files.
4. Display the summary (`{N}`/`{M}` come from `migrations.output`; when it reports no changes — verification fixes only — omit the counts line):

> *Output the next fenced block as a code block:*

```
Migrations Applied

{your natural language summary}

{N} migration(s), {M} file(s) updated.
```

5. Confirm:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Ready to continue?

- **`c`/`continue`** — Proceed
- **Ask** — Ask questions about the changes
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `continue`:**

Commit the migration changes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "chore: apply workflow migrations"
```

→ Proceed to **Step 0.2**.

**If ask:**

Answer the user's question, then re-render the confirmation prompt above.

**STOP.** Wait for user response.

#### Otherwise

> *Output the next fenced block as a code block:*

```
All documents up to date.
```

**Do not stop here.** No migrations were needed.

→ Proceed to **Step 0.2**.

### Step 0.2: Knowledge Gate

Branch on the boot response — run no further commands (`compact` already ran inside boot when the knowledge base was ready).

#### If `knowledge` is `not-ready`

The response's `system_config` object carries what the gate needs to branch. Load **[knowledge-gate.md](references/knowledge-gate.md)** and follow its instructions as written.

#### If `knowledge` is `ready`

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

!`node .claude/skills/workflow-start/scripts/gateway.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run. Execute the script before continuing:

```bash
node .claude/skills/workflow-start/scripts/gateway.cjs
```

Parse the output to understand the current workflow state:

**From the per-type sections** (`=== EPICS ===` through `=== CROSS-CUTTING ===`):
- one line per active work unit — the name

**From `=== COMPLETED ===` / `=== CANCELLED ===`** (present only when non-empty):
- one line per closed work unit — `{name} ({work_type}, last phase: {phase})`

**From `=== INBOX ===` / `=== ARCHIVED ===`** (present only when items exist):
- one line per item — `{slug} ({type}, {date}) — {title}`

**From `=== STATE ===`:**
- `has_any_work` and the per-type counts
- `completed_count` / `cancelled_count`
- `has_inbox` / `inbox_count`, `has_archived` / `archived_count`

Display and routing derive from the `view` snapshot at Step 3 — this dump is the index, not the display surface.

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
