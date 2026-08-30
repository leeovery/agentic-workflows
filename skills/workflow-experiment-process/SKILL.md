---
name: workflow-experiment-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(git status), Bash(grep), Bash(rg), Bash(ls), Bash(wc), Bash(find)
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup'
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" session cleanup'
---

# Experiment Process

Act as **rigorous experimentalist** — design experiments with the user, run them as designed, and report what was measured. The discipline is temporal, not ceremonial: the design exists before the data, and everything else follows from that.

## Purpose in the Workflow

The confirmatory phase, entered from discovery, research, or a discussion that hit the empirical wall — turn decision-bearing questions into designed, measured experiments whose results the topic's discussion can trust. Research pokes at things exploratorily; the moment a number is going to bear a decision, it graduates to an experiment here.

### What This Skill Needs

- **Topic** (required) - The question territory the experiment series serves
- **Output directory** (required) - The topic's series directory from the handoff
- **Work type** (required) - `epic`, `feature`, or `cross-cutting`. Determines session behaviour — epic sessions reroute off-topic concerns to sibling topics; feature and cross-cutting log or pivot
- **Context** (optional) - The question, prior sightings, expectations, what to measure against
- **Spawned from** (optional) - The discussion point whose settlement waits on this series (the empirical-wall exit); when present, the walk's first conceive records the evidence wait

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read the series state.** Render the register (`node .claude/skills/workflow-engine/scripts/engine.cjs render experiment-register {work_unit}.experiment.{topic}`) and read the live experiment's `design.md` and `report.md` under `.workflows/{work_unit}/experiment/{topic}/`. The register and the record files are your source of truth for where the series stands — a frozen design is frozen whatever the conversation remembered.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: emit the register's DISPLAY section verbatim as a code block, state which experiment is live and at what lifecycle status, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Session Setup

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} experiment {topic}
```

Read the phase status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.experiment.{topic} status
```

#### If status is `triaged`

A first start, not a resume — no session has ever run. Parked concerns wait in the topic's triage queue, untouched by initialization — the session loop's triage check surfaces them.

→ Proceed to **Step 1**.

#### If status is empty (no experiment entry)

→ Proceed to **Step 1**.

#### Otherwise

A resumed series — the phase inputs were read when it began, and the register carries the position. Skip initialization; there is no restart: the series is an append-only record, and a run that went wrong is abandoned with its reason or concluded with its verdict, never erased.

→ Proceed to **Step 2**.

---

## Step 1: Initialize Experiments

Load **[initialize-experiments.md](references/initialize-experiments.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Conduct

Load **[conduct.md](references/conduct.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Knowledge Usage

Load **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Contextual Query

Load **[contextual-query.md](../workflow-knowledge/references/contextual-query.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Experiment Session

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Experiment Session`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Starting the experiment session. Each experiment is designed and confirmed before anything is measured — the register below shows where the series stands.
```

Load **[session.md](references/session.md)** and follow its instructions as written.

*Knowledge-base nudge — if a question feels familiar, or you're about to re-measure ground another work unit may have covered, run a quick query before proceeding. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*
