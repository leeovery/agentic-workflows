---
name: workflow-start
disable-model-invocation: true
allowed-tools: Bash(node .claude/skills/workflow-start/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(git status), Bash(git diff)
---

Unified workflow entry point. Discovers state, shows all active work, and routes to start or continue skills.

> **⚠️ ZERO OUTPUT RULE**: Do not narrate your processing. Produce no output until a step or reference file explicitly specifies display content. No "proceeding with...", no discovery summaries, no routing decisions, no transition text. Your first output must be content explicitly called for by the instructions.
>
> **⚠️ BANNER FIRST**: The session opens with Step 0's four display blocks — art, title, Initialisation heading, status line — emitted before anything else happens: before any tool call, before loading framework.md, before a single word of narration. No "I'll start by…" pre-line, ever. Emit the four blocks, then load framework.md, then run the boot.

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written — after Step 0's four display blocks: the BANNER FIRST rule above governs the ordering, and this load comes second.

---

## Step 0: Initialisation

> *Output the next fenced block as a properties code block (```properties fence) — it colours the art; the space between the two words is the token break that splits the colours, so emit every line byte-for-byte, the version stamp included:*

```properties
█▀█░█▀▀░█▀▀░█▀█░▀█▀░▀█▀░█▀▀ █░█░█▀█░█▀▄░█░█░█▀▀░█░░░█▀█░█░█░█▀▀
█▀█░█░█░█▀▀░█░█░░█░░░█░░█░░ █▄█░█░█░█▀▄░█▀▄░█▀▀░█░░░█░█░█▄█░▀▀█
▀░▀░▀▀▀░▀▀▀░▀░▀░░▀░░▀▀▀░▀▀▀ ▀░▀░▀▀▀░▀░▀░▀░▀░▀░░░▀▀▀░▀▀▀░▀░▀░▀▀▀
                                                        v0.8.11
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
> Checking the workflow system — applying any pending migrations, making sure Claude Code is set up for the workflows, confirming the knowledge base, and scanning your active work.
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

#### If `migrations.changed` is `true` or `migrations.verify` or `migrations.notices` is non-empty

Load **[migration-review.md](references/migration-review.md)** and follow its instructions as written.

→ On return, proceed to **Step 0.2**.

#### Otherwise

> *Output the next fenced block as a text code block (```text fence):*

```text
All documents up to date.
```

**Do not stop here.** No migrations were needed.

→ Proceed to **Step 0.2**.

### Step 0.2: Claude Code Setup

Branch on the boot response's `gate_surface` — `on` and `unavailable` render nothing.

#### If `gate_surface` is `not-running` or `outdated`

Load **[claude-code-setup.md](references/claude-code-setup.md)** and follow its instructions as written.

→ On return, proceed to **Step 0.3**.

#### Otherwise

→ Proceed to **Step 0.3**.

### Step 0.3: Walkthrough

Branch on the boot response's `walkthrough` — the one-time offer of a short walk through how the workflows work. A recorded answer (`walked` or `skipped`) never re-offers, and the walk stays reachable from the `h/help` row on the start menu either way.

#### If `walkthrough` is `none`

Load **[walkthrough-offer.md](references/walkthrough-offer.md)** and follow its instructions as written.

→ On return, proceed to **Step 0.4**.

#### Otherwise

→ Proceed to **Step 0.4**.

### Step 0.4: Session Labels

Branch on the boot response's `tmux_labels` — `prompt` means the session runs inside tmux and the choice was never recorded. A recorded choice (`on`/`off`) never re-prompts; `no-tmux` records nothing, so a later session inside tmux still asks.

#### If `tmux_labels` is `prompt`

Load **[session-label-prompt.md](references/session-label-prompt.md)** and follow its instructions as written.

→ On return, proceed to **Step 0.5**.

#### Otherwise

→ Proceed to **Step 0.5**.

### Step 0.5: Knowledge Gate

Branch on the boot response — run no further commands (boot already brought the knowledge base in line with the files and compacted it when it was ready, building the store first where this checkout had none). If it carries `warnings`, surface them and continue — boot is complete.

#### If `knowledge` is `not-ready`

The response's `system_config` object carries what the gate needs to branch. Load **[knowledge-gate.md](references/knowledge-gate.md)** and follow its instructions as written.

#### If `knowledge` is `ready`

→ Proceed to **Step 0.6**.

### Step 0.6: Baseline Judgment

Branch on the boot response's `baseline` — the one-time judgment on whether the project carries a codebase that predates the workflows. A recorded status (`native`/`in-progress`/`completed`/`skipped`) never re-judges and never re-offers: manage carries the way into the assessment for every recorded status, and the start menus carry an interview in progress or a declined offer.

#### If `baseline` is `none`

Load **[baseline-judgment.md](references/baseline-judgment.md)** and follow its instructions as written.

→ On return, proceed to **Step 1**.

#### Otherwise

A recorded status — render nothing.

→ Proceed to **Step 1**.

---

## Step 1: Discover and Route

!`node .claude/skills/workflow-start/scripts/gateway.cjs`

If the above shows a script invocation rather than discovery output, the dynamic content preprocessor did not run — and on a return to this step the output above is stale. In either case, execute the script before continuing:

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

→ On return, return to **Step 1**.

#### Otherwise

Load **[active-work.md](references/active-work.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.
