---
name: workflow-research-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/.cache/), Bash(ls .workflows/.cache/), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/)
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup'
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup'
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

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read all research files** in `.workflows/{work_unit}/research/`. These are the working documents this skill creates. Their content is your source of truth for progress.
3. **Check agent state.** Run `node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} research {topic}` — `in_flight` agents still running, `pending` results unread, `acknowledged` results partially surfaced.
4. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
5. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Resume Detection

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} research {topic}
```

Read the phase status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{topic} status
```

Then check if the research file exists at `.workflows/{work_unit}/research/{topic}.md`.

#### If status is `triaged`

A first start, not a resume — no session has ever run. Parked concerns wait in the topic's triage queue, untouched by initialization — the session loop's triage check surfaces them.

→ Proceed to **Step 1**.

#### If no file exists

→ Proceed to **Step 1**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Resume Detection`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> An in-progress research file exists for this topic — choose whether to pick it up or start fresh.
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

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Research Session`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Starting the research session. This is open-ended exploration — follow threads, surface options, and document findings. No decisions needed at this stage.
```

Load **[route-session.md](references/route-session.md)** and follow its instructions as written.

*Knowledge-base nudge — if a thread feels familiar, or you're about to re-tread ground that might have been covered in another work unit, run a quick query before proceeding. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*
