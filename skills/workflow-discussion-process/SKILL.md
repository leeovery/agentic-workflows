---
name: workflow-discussion-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-discussion-process/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/.cache/), Bash(ls .workflows/.cache/), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/)
hooks:
  SessionEnd:
    - hooks:
        - type: command
          command: 'node "$CLAUDE_PROJECT_DIR/.claude/skills/workflow-engine/scripts/engine.cjs" presence cleanup'
---

# Discussion Process

Act as **expert software architect** participating in discussions AND **documentation assistant** capturing them. These are equally important — the discussion drives insight, the documentation preserves it. Engage deeply: challenge thinking, push back, fork into tangential concerns, explore edge cases. Then capture what emerged.

## Purpose in the Workflow

The decision phase, entered from discovery — or from research when it ran. Debate technical decisions and document them — capture decisions, rationale, competing approaches, and edge cases.

### What This Skill Needs

- **Topic** (required) - What technical area to discuss/document
- **Work type** (required) - `epic`, `feature`, or `cross-cutting`. Determines session behaviour — off-topic concerns reroute between an epic's topics but log or pivot on single-topic work
- **Context** (optional) - Interview answers or live conversation context; prior research, the discovery brief, and the carrier are read at initialisation
- **Seed concerns** (optional) - Initial subtopics or architectural questions to explore

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read the discussion file** at `.workflows/{work_unit}/discussion/{topic}.md`. This is the only working document this skill creates. The Discussion Map is your primary progress indicator — which subtopics are decided, exploring, converging, pending, or deferred. It lives in the manifest; read it with `node .claude/skills/workflow-discussion-process/scripts/gateway.cjs map {work_unit} {topic}`.
3. **Check agent state.** Run `node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} discussion {topic}` — `in_flight` agents still running, `pending` results unread, `acknowledged` results partially surfaced.
4. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
5. **Announce your position** to the user before continuing: render the current Discussion Map (the adapter call above — emit its DISPLAY section verbatim as a code block), state what step you believe you're at, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Resume Detection

Read the phase status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic} status
```

Then check if the discussion file exists at `.workflows/{work_unit}/discussion/{topic}.md`.

#### If status is `triaged`

A first start, not a resume — no session has ever run and no subtopics exist, so there is no map to render. Parked concerns wait in the topic's triage queue, untouched by initialization — the session loop's triage check surfaces them.

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
> An in-progress discussion file exists for this topic — choose whether to pick it up or start fresh.
```

Show the current map state so the continue-or-restart choice is informed:

```bash
node .claude/skills/workflow-discussion-process/scripts/gateway.cjs map {work_unit} {topic}
```

Emit the DISPLAY section verbatim as a code block — never the `===` marker lines.

Load **[resume-detection.md](../workflow-shared/references/resume-detection.md)** with artifact = `discussion`, file = `.workflows/{work_unit}/discussion/{topic}.md`, continue_step = `Step 2`, restart_targets = `the discussion file, the manifest's map state (node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discussion.{topic} subtopics), and the phase cache directory (rm -rf .workflows/.cache/{work_unit}/discussion/{topic}/ — content and agent state together) — stale agent results would poison the restarted session's review gates`, commit = `discussion({work_unit}): restart discussion`.

---

## Step 1: Initialize Discussion

Load **[initialize-discussion.md](references/initialize-discussion.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Load Discussion Guidelines

Load **[discussion-guidelines.md](references/discussion-guidelines.md)** and follow its instructions as written.

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

## Step 5: Discussion Session

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Discussion Session`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Discussion starting. I'll track our conversation on a Discussion Map. You can lead wherever you want — I'll challenge thinking, explore edge cases, and capture decisions as we go.
```

Both blocks above are emitted before the reference loads.

Load **[discussion-session.md](references/discussion-session.md)** and follow its instructions as written.

*Knowledge-base nudge — before committing to a direction on a new subtopic, or when a decision might echo one made elsewhere, run a quick query. See **[knowledge-usage.md](../workflow-knowledge/references/knowledge-usage.md)**.*

→ On return, proceed to **Step 6**.

---

## Step 6: Final Gap Review

Load **[final-review.md](references/final-review.md)** and follow its instructions as written.

→ On return, proceed to **Step 7**.

---

## Step 7: Document Review

Load **[document-review.md](references/document-review.md)** and follow its instructions as written.

→ On return, proceed to **Step 8**.

---

## Step 8: Compliance Self-Check

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ On return, proceed to **Step 9**.

---

## Step 9: Conclude Discussion

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Conclude Discussion`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final confirmation before marking the discussion as complete.
```

Load **[conclude-discussion.md](references/conclude-discussion.md)** and follow its instructions as written.
