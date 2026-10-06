---
name: workflow-discussion-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-discussion-process/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/.cache/), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/), Bash(git status), Bash(grep), Bash(rg), Bash(ls), Bash(wc), Bash(find)
---

# Discussion Process

Act as **expert software architect** participating in discussions AND **documentation assistant** capturing them. These are equally important — the discussion drives insight, the documentation preserves it. Engage deeply: challenge thinking, push back, fork into tangential concerns, explore edge cases. Then capture what emerged.

## Purpose in the Workflow

The decision phase, entered from discovery — or from research when it ran. Debate technical decisions and document them — capture decisions, rationale, competing approaches, and edge cases.

### What This Skill Needs

Positional arguments:
- `$0` — **work_type**: `epic`, `feature`, or `cross-cutting`. Determines session behaviour — off-topic concerns reroute between an epic's topics but log or pivot on single-topic work.
- `$1` — **work_unit**: the work unit name.
- `$2` — **topic**: the technical area to discuss. A single-topic unit's topic is the work unit, so it may be left off: topic = `$2`, or `$1` where `work_type` is not `epic`.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read the discussion file** at `.workflows/{work_unit}/discussion/{topic}.md`. This is the only working document this skill creates. The Discussion Map is your primary progress indicator — which subtopics are decided, exploring, converging, pending, or deferred. It lives in the manifest; read it with `node .claude/skills/workflow-discussion-process/scripts/gateway.cjs map {work_unit} {topic}`.
3. **Check agent state.** Run `node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} discussion {topic}` — `in_flight` agents still running, `pending` results unread, `acknowledged` results partially surfaced. Read `.workflows/.cache/{work_unit}/discussion/{topic}/calls-queue.json` if present — queued settled calls and pulled raises survive there, not in conversation memory. A close underway does not survive either: treat it as ended — the next signal or settling set re-enters it, a settled map on its own never does.
4. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
5. **Announce your position** to the user before continuing: render the current Discussion Map (the adapter call above — emit its DISPLAY section verbatim per its marker), state what step you believe you're at, and what comes next. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Backlogging

The user says to put an idea aside — "roadmap it", "inbox it", "backlog that", "push it back" — and the words take this door whatever else is in flight. An idea, not a topic: a topic takes the postponing door. Load **[backlogging.md](../workflow-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `discussion`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Postponing the Topic

The user pushes a topic back to the roadmap — "postpone this", "move the loyalty topic to v2", "take this whole topic back to the roadmap" — this one, or one on the map by name; `{name}` is that topic. The request is taken as said — never argued, and never checked back with a question first: load **[postponing-the-topic.md](../workflow-shared/references/postponing-the-topic.md)** with work_unit = `{work_unit}`, name = `{name}`, topic = `{topic}`, phase = `discussion`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Cancelling the Topic

The user calls the topic off — they say to cancel, or the conversation agrees it is not worth pursuing. Never is not yet: a topic wanted later takes the postponing door. The call-off is taken as said — never argued, and never checked back with a question first: load **[cancelling-the-topic.md](../workflow-shared/references/cancelling-the-topic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `discussion`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Step 0: Session Setup

### Step 0.1: Entry Gate

Check the research prerequisite — the engine derives the verdict from the topic's research item, whether or not a discussion item exists:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.discussion.{topic}
```

#### If the response is empty

No research is outstanding on the topic — clear to discuss.

→ Proceed to **Step 0.2**.

#### If the response carried `DISPLAY: entry blocker`

Emit both sections verbatim per their markers — the red blocker line, then its guidance.

**STOP.** Do not proceed — terminal condition.

### Step 0.2: Resume Detection

Load **[ensure-discovery-item.md](../workflow-shared/references/ensure-discovery-item.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, routing = `discussion`.

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} discussion {topic}
```

Read the phase status, storing it as `phase_status`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.discussion.{topic} status
```

#### If `phase_status` is empty or `triaged`

A first start, not a resume — no session has ever run and no subtopics exist, so there is no map to render. A `triaged` stub's parked concerns wait in the topic's triage queue, untouched by initialization — the session loop's triage check surfaces them.

Set `resumed` = `false`.

→ Proceed to **Step 1**.

#### If `phase_status` is `in-progress` or `completed`

Where `phase_status` is `completed`, reopen it — resuming is not starting:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} discussion {topic}
```

Render the phase note — `Reopening` for a topic just reopened, `Resuming` otherwise — and emit the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.discussion.{topic} --verb {Reopening|Resuming}
```

Load **[reconcile-advisory.md](../workflow-shared/references/reconcile-advisory.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, downstream_phase = `discussion`.

**If no file exists at `.workflows/{work_unit}/discussion/{topic}.md`:**

A restart that never reached initialization — the earlier session's file is already gone.

Set `resumed` = `false`.

→ Proceed to **Step 1**.

**Otherwise:**

Show the current map state so the continue-or-restart choice is informed:

```bash
node .claude/skills/workflow-discussion-process/scripts/gateway.cjs map {work_unit} {topic}
```

Emit the DISPLAY section verbatim per its marker.

Load **[resume-detection.md](../workflow-shared/references/resume-detection.md)** with artifact = `discussion`, file = `.workflows/{work_unit}/discussion/{topic}.md`, continue_step = `Step 2`, restart_targets = `the discussion file, the manifest's map state (node .claude/skills/workflow-engine/scripts/engine.cjs manifest delete {work_unit}.discussion.{topic} subtopics), and the phase cache directory (rm -rf .workflows/.cache/{work_unit}/discussion/{topic}/ — content and agent state together) — stale agent results would poison the restarted session's review gates`, commit = `discussion({work_unit}): restart discussion`.

Set `resumed` from where the reference returns: `true` for **Step 2**, the earlier session's map still standing; `false` for **Step 1**, its file and map deleted and rebuilt.

→ On return, proceed as the reference directed — `continue` lands on **Step 2**, `restart` on **Step 1**.

#### If `phase_status` is `postponed`

The topic waits on the roadmap — it returns through the epic menu's `f/forward` row, never through this skill. Tell the user in one line.

**STOP.** Do not proceed — terminal condition.

#### If `phase_status` is `cancelled`

The discussion is cancelled — its topic returns through the epic menu's reactivate option, never through this skill. Tell the user in one line.

**STOP.** Do not proceed — terminal condition.

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

Load **[knowledge-usage.md](../workflow-shared/references/knowledge-usage.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Contextual Query

Load **[contextual-query.md](../workflow-shared/references/contextual-query.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Discussion Session

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Discussion Session`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> @if(resumed) Picking the discussion back up where the map leaves it. @else Discussion starting. I'll track our conversation on a Discussion Map. @endif You can lead wherever you want — I'll challenge thinking, explore edge cases, and capture decisions as we go.
```

Both blocks above are emitted before the reference loads.

Load **[discussion-session.md](references/discussion-session.md)** and follow its instructions as written.

*Knowledge-base nudge — before committing to a direction on a new subtopic, or when a decision might echo one made elsewhere, run a quick query. See **[knowledge-usage.md](../workflow-shared/references/knowledge-usage.md)**.*

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
