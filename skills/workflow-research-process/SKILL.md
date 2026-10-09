---
name: workflow-research-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(mkdir -p .workflows/.cache/), Bash(rm .workflows/.cache/), Bash(rm -rf .workflows/.cache/), Bash(git status), Bash(grep), Bash(rg), Bash(ls), Bash(wc), Bash(find)
---

# Research Process

Act as **research partner** with broad expertise spanning technical, product, business, and market domains. Your role is learning, exploration, and discovery.

## Purpose in the Workflow

The exploration phase, entered from discovery — explore feasibility (technical, business, market), validate assumptions, and document findings before discussion begins.

**Stay in your lane**: Explore freely. This is the time for broad thinking, feasibility checks, and learning. Surface options and tradeoffs — don't make decisions. When a topic converges toward a conclusion, that's a signal it's ready for discussion phase, not a cue to start deciding. Park it and move on.

### What This Skill Needs

Positional arguments:
- `$0` — **work_type**: `epic`, `feature`, or `cross-cutting`. Determines session behaviour — epic sessions carry topic awareness and reroute a grown thread to its own topic; feature and cross-cutting use the single-topic session.
- `$1` — **work_unit**: the work unit name.
- `$2` — **topic**: what to research. A single-topic unit's topic is the work unit, so it may be left off: topic = `$2`, or `$1` where `work_type` is not `epic`.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read all research files** in `.workflows/{work_unit}/research/`. These are the working documents this skill creates. Their content is your source of truth for progress. The thread register — what the topic set out to learn and where each question stands — lives in the manifest; read it with `node .claude/skills/workflow-engine/scripts/engine.cjs render research-threads {work_unit}.research.{topic}`.
3. **Check agent state.** Run `node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} research {topic}` — `in_flight` deep dives still running, `pending` reports landed and not yet folded.
4. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
5. **Carry on from where the conversation was**, as if the break never happened — no recap and no announcement. Where the person's message is waiting, answer it; where the conversation was at a gate, put the gate back, fetched fresh; otherwise continue the step it was on.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Backlogging

The user says to put an idea aside — "roadmap it", "inbox it", "backlog that", "push it back" — and the words take this door whatever else is in flight. An idea, not a topic: a topic takes the postponing door. Load **[backlogging.md](../workflow-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Postponing the Topic

The user pushes a topic back to the roadmap — "postpone this", "move the loyalty topic to v2", "take this whole topic back to the roadmap" — this one, or one on the map by name; `{name}` is that topic. The request is taken as said — never argued, and never checked back with a question first: load **[postponing-the-topic.md](../workflow-shared/references/postponing-the-topic.md)** with work_unit = `{work_unit}`, name = `{name}`, topic = `{topic}`, phase = `research`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Cancelling the Topic

The user calls the topic off — they say to cancel, or the conversation agrees it is not worth pursuing. Never is not yet: a topic wanted later takes the postponing door. The call-off is taken as said — never argued, and never checked back with a question first: load **[cancelling-the-topic.md](../workflow-shared/references/cancelling-the-topic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `research`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Step 0: Resume Detection

Load **[ensure-discovery-item.md](../workflow-shared/references/ensure-discovery-item.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, routing = `research`.

Record where this session is working — the call also labels the tmux session where the user opted in:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} research {topic}
```

Read the phase status, storing it as `phase_status`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{topic} status
```

#### If `phase_status` is empty or `triaged`

A first start, not a resume — no session has ever run. A `triaged` stub's parked concerns wait in the topic's triage queue, untouched by initialization — the session loop's triage check surfaces them.

Set `resumed` = `false`.

→ Proceed to **Step 1**.

#### If `phase_status` is `in-progress` or `completed`

Where `phase_status` is `completed`, reopen it — resuming is not starting:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} research {topic}
```

Render the phase note — `Reopening` for a topic just reopened, `Resuming` otherwise — and emit the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.research.{topic} --verb {Reopening|Resuming}
```

Load **[reconcile-advisory.md](../workflow-shared/references/reconcile-advisory.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, downstream_phase = `research`.

**If no file exists at `.workflows/{work_unit}/research/{topic}.md`:**

A restart that never reached initialization — the earlier session's file is already gone.

Set `resumed` = `false`.

→ Proceed to **Step 1**.

**Otherwise:**

Show the thread register so the continue-or-restart choice is informed:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render research-threads {work_unit}.research.{topic}
```

Emit the DISPLAY section verbatim per its marker. An empty response means no thread is registered; nothing is shown.

Load **[resume-detection.md](../workflow-shared/references/resume-detection.md)** with artifact = `research`, file = `.workflows/{work_unit}/research/{topic}.md`, continue_step = `Step 2`, restart_targets = `the research file, the manifest's thread register when the item carries one (node .claude/skills/workflow-engine/scripts/engine.cjs manifest exists {work_unit}.research.{topic} threads, then manifest delete on true), and the phase cache directory (rm -rf .workflows/.cache/{work_unit}/research/{topic}/ — content and agent state together) — a landed report would otherwise fold into the restarted session as its own`, commit = `research({work_unit}): restart research`.

Set `resumed` from where the reference returns: `true` for **Step 2**, the earlier session's file still standing; `false` for **Step 1**, its file deleted and rebuilt.

→ On return, proceed as the reference directed — `continue` lands on **Step 2**, `restart` on **Step 1**.

#### If `phase_status` is `postponed` or `cancelled`

Render the terminal blocker — the engine derives which from the item's status — and emit both sections verbatim per their markers:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.research.{topic} --own
```

**STOP.** Do not proceed — terminal condition.

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

Load **[knowledge-usage.md](../workflow-shared/references/knowledge-usage.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Contextual Query

Load **[contextual-query.md](../workflow-shared/references/contextual-query.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: Research Session

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Research Session`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> @if(resumed) Picking the research back up where it left off. @else Starting the research session. @endif This is open-ended exploration — follow threads, surface options, and document findings; I'll keep a register of what we set out to learn and where each question stands. No decisions needed at this stage.
```

Load **[route-session.md](references/route-session.md)** and follow its instructions as written.

*Knowledge-base nudge — if a thread feels familiar, or you're about to re-tread ground that might have been covered in another work unit, run a quick query before proceeding. See **[knowledge-usage.md](../workflow-shared/references/knowledge-usage.md)**.*
