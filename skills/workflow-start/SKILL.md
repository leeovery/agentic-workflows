---
name: workflow-start
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/workflow-start/scripts/gateway.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(git diff)
---

Unified workflow entry point. Discovers state, shows all active work, and routes to start or continue skills.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.
>
> **⚠️ BANNER FIRST**: The session opens with Step 0's four display blocks — art, title, Initialisation heading, status line — emitted before anything else happens: before any tool call, before loading framework.md, before a single word of narration. No "I'll start by…" pre-line, ever. Emit the four blocks, then load framework.md, then run the boot.

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written — after Step 0's four display blocks: the BANNER FIRST rule above governs the ordering, and this load comes second.

---

## Step 0: Initialisation

> *Output the next fenced block as a properties code block (```properties fence — it colours the art; the space between the two words is the token break that splits the colours, so emit every line byte-for-byte, the version stamp included):*

```
█▀█░█▀▀░█▀▀░█▀█░▀█▀░▀█▀░█▀▀ █░█░█▀█░█▀▄░█░█░█▀▀░█░░░█▀█░█░█░█▀▀
█▀█░█░█░█▀▀░█░█░░█░░░█░░█░░ █▄█░█░█░█▀▄░█▀▄░█▀▀░█░░░█░█░█▄█░▀▀█
▀░▀░▀▀▀░▀▀▀░▀░▀░░▀░░▀▀▀░▀▀▀ ▀░▀░▀▀▀░▀░▀░▀░▀░▀░░░▀▀▀░▀▀▀░▀░▀░▀▀▀
                                                        v0.7.31
```

> *Output the next fenced block as markdown (not a code block):*

```
# **`■ Workflow Start`**
```

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Initialisation`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Checking the workflow system — applying any pending migrations, confirming the knowledge base, and scanning your active work.
```

### Step 0.1: Boot

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

5. Fetch the confirm gate and emit its `MENU: migration gate` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render migration-gate
```

**STOP.** Wait for user response.

**If `continue`:**

Commit the migration changes:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "chore: apply workflow migrations"
```

→ Proceed to **Step 0.2**.

**If ask:**

Answer the user's question, then fetch the confirm gate again and emit it as above.

**STOP.** Wait for user response.

#### Otherwise

> *Output the next fenced block as a code block:*

```
All documents up to date.
```

**Do not stop here.** No migrations were needed.

→ Proceed to **Step 0.2**.

### Step 0.2: Session Labels

Branch on the boot response's `tmux_labels` — `prompt` means the session runs inside tmux and the choice was never recorded. A recorded choice (`on`/`off`) never re-prompts; `no-tmux` records nothing, so a later session inside tmux still asks.

#### If `tmux_labels` is `prompt`

> *Output the next fenced block as markdown (not a code block):*

```
> You're running inside tmux. The workflows can rename your tmux session to show where you're working — `myproject · payments · discussion · auth-flow` — as you move through phases, restoring the original name when the session ends. One choice for all your projects, stored in `~/.config/workflows/config.json`.
```

Fetch the opt-in and emit its `MENU: label gate` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render label-gate
```

**STOP.** Wait for user response.

**If `yes`:**

Record the choice. If the command fails (`ok: false`), surface its error and continue — the prompt returns at a future start once the config file is fixed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label-config true
```

→ Proceed to **Step 0.3**.

**If `no`:**

Record the choice. If the command fails (`ok: false`), surface its error and continue — the prompt returns at a future start once the config file is fixed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label-config false
```

→ Proceed to **Step 0.3**.

#### Otherwise

→ Proceed to **Step 0.3**.

### Step 0.3: Knowledge Gate

Branch on the boot response — run no further commands (`compact` already ran inside boot when the knowledge base was ready).

#### If `knowledge` is `not-ready`

The response's `system_config` object carries what the gate needs to branch. Load **[knowledge-gate.md](references/knowledge-gate.md)** and follow its instructions as written.

#### If `knowledge` is `ready`

→ Proceed to **Step 0.4**.

### Step 0.4: Baseline Judgment

Branch on the boot response's `baseline` — the one-time judgment on whether the project carries a codebase that predates the workflows. A recorded status (`native`/`in-progress`/`completed`/`skipped`) never re-judges and never re-offers: manage carries the way into the assessment for every recorded status, and the start menus carry an interview in progress or a declined offer.

While `baseline` is `none`, nothing is recorded yet. Read the response's `baseline_signal` — the repository's own account of what came before the workflows — and decide the one question: was there real development before the workflows arrived, or only setup? `history_before` lists the commits before the arrival as `date  subject` (`commits_before` of `commits_total`, from `root_date` to `workflows_date` — `null` when nothing under `.workflows/` is committed yet: the workflows are arriving now, and the whole history came before them); `tree_at_arrival` and `files_at_arrival` are the project tree they arrived into, less the workflows' own footprint. Read them as you would by hand — the counts are context, never thresholds. Commits that are an initial commit, setup, configuration, a generator's skeleton, and a tree with no application code in it: the project grew up on the workflows, whatever it has become since — **native**. Application code and the history of building it before the arrival: a codebase the workflows were installed into — it **predates** them. A `null` signal is a project with no history to read (no repository, no commits, a shallow clone): look at the project tree yourself, and an empty or scaffold-only tree is native.

#### If `baseline` is `none` and the project is native

Record the verdict — written and committed in one call, so the question is settled for good. If it fails (`ok: false`), surface the error and continue — the judgment returns at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs baseline record native
```

→ Proceed to **Step 1**.

#### If `baseline` is `none` and the codebase predates the workflows

> *Output the next fenced block as markdown (not a code block):*

```
> This project has an existing codebase the workflows know nothing about. A baseline assessment researches it, then interviews you to capture the intent the code can't show — landing docs the knowledge base surfaces in every later phase. Pausable any time; also available later from the workflow-start menus.
```

Fetch the offer and emit its `MENU: baseline offer` section verbatim as markdown (not a code block):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-offer-gate
```

**STOP.** Wait for user response.

**If `yes`:**

Invoke `/workflow-baseline`.

This skill ends. The invoked skill will load into context and provide additional instructions. Terminal.

**If `no`:**

Record the decline — written and committed in one call, so the offer never repeats. If it fails (`ok: false`), surface the error and continue — the offer returns at the next start:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs baseline record skipped
```

→ Proceed to **Step 1**.

#### Otherwise

A recorded status — render nothing.

→ Proceed to **Step 1**.

---

## Step 1: Discover and Route

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

Display and routing derive from the `view` snapshot in **active-work.md** — this dump is the index, not the display surface.

#### If `state.has_any_work` is false

Load **[empty-state.md](references/empty-state.md)** and follow its instructions as written.

#### Otherwise

Load **[active-work.md](references/active-work.md)** and follow its instructions as written.
