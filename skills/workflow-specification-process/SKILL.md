---
name: workflow-specification-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(node .claude/skills/workflow-discovery/scripts/gateway.cjs), Bash(git log), Bash(grep), Bash(rg), Bash(ls), Bash(wc), Bash(find)
---

# Specification Process

Act as **expert technical architect** and **specification builder**. Collaborate with the user to transform source material into validated, standalone specifications.

Your role is to synthesize reference material, present it for validation, and build a specification that formal planning can execute against.

## Purpose in the Workflow

Follows discussion (or investigation for bugfix). Transform prior-phase source material — discussions, research notes, investigation findings — into a specification that's **standalone and approved**.

**Stay in your lane**: Validate and refine source material into a standalone specification. Don't jump to planning, phases, tasks, or code. The specification is the "line in the sand" — everything after this has hard dependencies on it.

### What This Skill Needs

Positional arguments:
- `$0` — **work_type**: `epic`, `feature`, `bugfix`, or `cross-cutting`.
- `$1` — **work_unit**: the work unit name.
- `$2` — **topic**: the specification's topic. A single-topic unit's topic is the work unit, so it may be left off: topic = `$2`, or `$1` where `work_type` is not `epic`.

The source material is the specification item's `sources` — an epic grouping's discussions, a feature's or cross-cutting unit's discussion, a bugfix's investigation — beside a cross-cutting unit's completed research and the specifications this one incorporates, all read at session setup.

**If source material seems incomplete or unclear:**

> *Output the next fenced block as markdown (not a code block):*

```
I have the source material, but {concern}. Should I proceed as-is, or is there additional material I should review?
```

**STOP.** Wait for user response.

**Multiple sources:** When the specification has several sources, extract exhaustively from ALL of them. Content may be scattered across sources — a decision in one discussion may have constraints or details in another. The specification consolidates everything into a single standalone document.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside. The full process, steps, and rules must be reloaded.
2. **Read all tracking and state files** for the current topic — the specification file, review tracking files, or any working documents this skill creates. These are your source of truth for progress. Hold the source material again as **[session-setup.md](references/session-setup.md)** holds it — the sources, the grouping's tensions, the incorporated specifications — without its gate-mode reset.
3. **Check git state.** Run `git status` and `git log --oneline -10` to see recent commits. Commit messages follow a conventional pattern that reveals what was completed.
4. **Announce your position** to the user before continuing: what step you believe you're at, what's been completed, and what comes next. Wait for confirmation.
5. **Check `finding_gate_mode` and `construction_gate_mode`** via `engine manifest` (`node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} finding_gate_mode` and `... construction_gate_mode`) — if either is `auto`, the user previously opted in during this session. Preserve that value.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Hard Rules

1. **STOP AND WAIT** for explicit approval before any write to the specification. Present content, wait for the user to explicitly approve (`y/yes` or equivalent), then log. No exceptions.
2. **Log verbatim** — when approved, write exactly what was presented. No silent modifications.
3. **Commit frequently** — commit at natural breaks and before any context refresh. Context refresh = lost work. Commits go through the scoped helper, action-scoped to this topic — the specification directory and the work-unit manifest, never a sibling session's files:
   ```bash
   node .claude/skills/workflow-engine/scripts/engine.cjs commit {work_unit} -m "{message}" --topic specification/{topic}
   ```

---

## Backlogging

The user says to put an idea aside — "roadmap it", "inbox it", "backlog that", "push it back" — and the words take this door whatever else is in flight. An idea, not a topic: a topic takes the postponing door. Load **[backlogging.md](../workflow-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `specification`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Postponing the Topic

The user pushes a topic back to the roadmap — "postpone this", "move the loyalty topic to v2", "take this whole topic back to the roadmap" — this one, or one on the map by name; `{name}` is that topic. The request is taken as said — never argued, and never checked back with a question first: load **[postponing-the-topic.md](../workflow-shared/references/postponing-the-topic.md)** with work_unit = `{work_unit}`, name = `{name}`, topic = `{topic}`, phase = `specification`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Cancelling the Topic

The user calls the topic off — they say to cancel, or the conversation agrees it is not worth pursuing. Never is not yet: a topic wanted later takes the postponing door. The call-off is taken as said — never argued, and never checked back with a question first: load **[cancelling-the-topic.md](../workflow-shared/references/cancelling-the-topic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `specification`, from any point in the phase.

→ On return, resume the interrupted flow — a gate that was pending was set aside; once the exchange looks settled, ask in conversation whether the person is ready to move on, and on yes put it back — never fall through to Step 0.

---

## Step 0: Phase Start

### Step 0.1: Entry Gate

Check the source-material prerequisite — the engine derives the verdict from manifest state (work-type-aware: the discussion for feature and cross-cutting, the investigation for bugfix; for an epic, at least one completed discussion and none of this specification's own sources still open — back in progress, or opened by the gap exit and parked):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.specification.{topic}
```

#### If the response is empty

Source material is ready.

→ Proceed to **Step 0.2**.

#### If the response carried `DISPLAY: entry blocker`

Emit both sections verbatim per their markers — the red blocker line, then its guidance.

**STOP.** Do not proceed — terminal condition.

### Step 0.2: Resume Detection

Refresh the tmux session label — a no-op unless the user opted in and this session runs inside tmux:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs session label {work_unit} specification {topic}
```

Read the phase status, storing it as `phase_status`:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} status
```

#### If `phase_status` is empty or `proposed`

A first start — an epic's grouping lands its specification `proposed`, and initialization starts it.

→ Proceed to **Step 1**.

#### If `phase_status` is `in-progress` or `completed`

Where `phase_status` is `completed`, reopen it — resuming is not starting:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} specification {topic}
```

Render the phase note — `Reopening` for a specification just reopened, `Resuming` otherwise — and emit the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.specification.{topic} --verb {Reopening|Resuming}
```

Load **[reconcile-advisory.md](../workflow-shared/references/reconcile-advisory.md)** with work_type = `{work_type}`, work_unit = `{work_unit}`, topic = `{topic}`, downstream_phase = `specification`.

**If no file exists at `.workflows/{work_unit}/specification/{topic}/specification.md`:**

A restart that never reached initialization — the earlier session's file is already gone.

→ Proceed to **Step 1**.

**Otherwise:**

Load **[resume-detection.md](../workflow-shared/references/resume-detection.md)** with artifact = `specification`, file = `.workflows/{work_unit}/specification/{topic}/specification.md`, continue_step = `Step 2`, restart_targets = `the specification file and all review tracking files (review-*-tracking-c*.md) in .workflows/{work_unit}/specification/{topic}/`, restart_resets = `every sources.{name}.status row under {work_unit}.specification.{topic} to pending via engine manifest set — initialization never overwrites an existing row, so without this reset the fresh file would never get its content re-extracted — and the tracking subtree and review_baseline_words deleted where present (engine manifest delete {work_unit}.specification.{topic} tracking, then the same for review_baseline_words — an absent field's delete errors and is skipped) to match the deleted tracking files`, commit = `spec({work_unit}): restart specification`.

→ On return, proceed as the reference directed — `continue` lands on **Step 2**, `restart` on **Step 1**.

#### If `phase_status` is `cancelled`, `superseded`, or `promoted`

Render the terminal blocker — the engine derives which from the item's status — and emit both sections verbatim per their markers:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.specification.{topic} --own
```

**STOP.** Do not proceed — terminal condition.

---

## Step 1: Initialize Specification

Load **[initialize-specification.md](references/initialize-specification.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Session Setup

Load **[session-setup.md](references/session-setup.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Load Specification Principles

Load **[specification-principles.md](references/specification-principles.md)** and follow its instructions as written.

→ On return, proceed to **Step 4**.

---

## Step 4: Spec Construction

Read the sources map:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} sources
```

#### If no source row reads `pending`

Set `constructed` = `false`.

→ Proceed to **Step 5**.

#### Otherwise

Set `constructed` = `true`.

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Spec Construction`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Building the specification. Topics from your source material will be extracted and presented one at a time. Nothing gets written without your explicit approval.
```

Load **[spec-construction.md](references/spec-construction.md)** and follow its instructions as written.

→ On return, proceed to **Step 5**.

---

## Step 5: Document Dependencies

#### If work_type is not `epic`

→ Proceed to **Step 6**.

#### If `constructed` is `false` and the specification carries a `## Dependencies` section

→ Proceed to **Step 6**.

#### Otherwise

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Document Dependencies`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Recording cross-topic dependencies — for epics, specifications may depend on each other.
```

Load **[dependencies.md](references/dependencies.md)** and follow its instructions as written.

→ On return, proceed to **Step 6**.

---

## Step 6: Specification Review

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Specification Review`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Reviewing the specification. Agents will measure its claims against the codebase and analyse it against source material for gaps and inconsistencies. Settled findings come as a batch, each carrying the call and what it rests on; genuine choices stop for your call, and any finding can be talked through — adjusted, challenged, or declined.
```

Load **[spec-review.md](references/spec-review.md)** and follow its instructions as written.

→ On return, proceed to **Step 7**.

---

## Step 7: Compliance Self-Check

Load **[compliance-check.md](../workflow-shared/references/compliance-check.md)** and follow its instructions as written.

→ On return, proceed to **Step 8**.

---

## Step 8: Assess Cross-Cutting & Conclude

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Conclude`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Wrapping up. Final assessment, sign-off, and @if(work_type is cross-cutting) closure — the pipeline completes here @else handover to the planning phase @endif.
```

Load **[spec-completion.md](references/spec-completion.md)** and follow its instructions as written.

