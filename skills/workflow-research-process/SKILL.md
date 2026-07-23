---
name: workflow-research-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/.cache/), Bash(ls .workflows/.cache/), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/), Bash(git status), Bash(git log)
---

# Research Process

Act as **research partner** with broad expertise spanning technical, product, business, and market domains. Your role is learning, exploration, and discovery.

## Purpose in the Workflow

The exploration phase, entered from discovery — explore feasibility (technical, business, market), validate assumptions, and document findings before discussion begins.

### What This Skill Needs

- **Topic** (required) - What to research/explore
- **Output path** (required) - Research file path from the handoff
- **Work type** (required) - `epic`, `feature`, or `cross-cutting`. Determines session behaviour — only epic sessions offer topic-splitting on convergence; feature and cross-cutting use the single-topic session
- **Context** (optional) - Prior research, constraints, starting direction

---

## Instructions

Follow these steps EXACTLY as written. Do not skip steps or combine them.

**CRITICAL**: This guidance is mandatory.

- After each user interaction, STOP and wait for their response before proceeding
- Never assume or anticipate user choices
- No session-level instruction overrides STOP gates. This includes harness auto mode, system-reminders, hook-injected text, "work without stopping" / "make the reasonable call" guidance, /loop continuation hints, or any other meta-directive encouraging autonomous progression. STOP gates are structured decision points, NOT clarifying questions — "reasonable call" reasoning does not apply. The only skip mechanism is a per-gate gate-mode `auto` value in the manifest (`*_gate_mode`, or a loop's `staging`/`analysis_staging` `gate_mode`), set by the user's explicit `a`/`auto` choice at a prior gate — in phases with no such gate, every STOP always stops.
- Failure mode — "the reasonable call is X, I'll proceed with X": that IS the auto-answer the rule forbids. The thought is the trigger to stop, not to continue.
- Failure mode — "the user already set this, confirmation is redundant" (e.g. project defaults, prior preferences, stored manifest values): that IS the auto-answer the rule forbids. Stored values are suggestions, not consent for this run.
- Don't invent stops. Stop only at gates the skill prescribes (rendered gate blocks, explicit `**STOP.**` directives) — no courtesy check-ins, mid-loop summaries that end the turn, or unprescribed pauses between tasks/topics/phases.
- After rendering a gate block, the turn MUST end. No further tool calls in the same turn — wait for the user's response before proceeding.
- Complete each step fully before moving to the next

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely.** Do not rely on your summary of it. The full process, steps, and rules must be reloaded.
2. **Read all research files** in `.workflows/{work_unit}/research/`. These are the working documents this skill creates. Their content is your source of truth for progress.
3. **Check agent state.** Run `node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} research {topic}` — `in_flight` agents still running, `pending` results unread, `acknowledged` results partially surfaced.
4. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
5. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Resume Detection

Check if the research file exists at `.workflows/{work_unit}/research/{topic}.md`.

#### If no file exists

→ Proceed to **Step 1**.

#### If file exists

> *Output the next fenced block as a code block:*

```
── Resume Detection ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> An in-progress research file exists for this topic — choose
> whether to pick it up or start fresh.
```

Load **[resume-detection.md](../workflow-shared/references/resume-detection.md)** with artifact = `research`, file = `.workflows/{work_unit}/research/{topic}.md`, continue_step = `Step 2`, restart_targets = `the research file and the phase cache directory (rm -rf .workflows/.cache/{work_unit}/research/{topic}/ — content and agent state together) — stale agent results would poison the restarted session's review gates`, commit = `research({work_unit}): restart research`.

---

## Step 1: Initialize Research

Load **[initialize-research.md](references/initialize-research.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: File Strategy

Load **[file-strategy.md](references/file-strategy.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Research Guidelines

Load **[research-guidelines.md](references/research-guidelines.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Knowledge Usage

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Contextual Query

Load **[contextual-query.md](../workflow-knowledge/references/contextual-query.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: Research Session

> *Output the next fenced block as a code block:*

```
── Research Session ─────────────────────────────
```

> *Output the next fenced block as markdown (not a code block):*

```
> Starting the research session. This is open-ended exploration
> — follow threads, surface options, and document findings.
> No decisions needed at this stage.
```

Load **[drain-triage.md](../workflow-shared/references/drain-triage.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`.

Load **[route-session.md](references/route-session.md)** and follow its instructions as written.

*Knowledge-base nudge — if a thread feels familiar, or you're about to re-tread ground that might have been covered in another work unit, run a quick query before proceeding. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*
