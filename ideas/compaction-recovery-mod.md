# Compaction Recovery — the fresh context is re-seated by code

## The Idea

After a compaction, the model continues from a summary. Today the
workflows *ask* the summary to keep the position and the loaded rules, and
*ask* the model to re-load `framework.md` and the skill's context-refresh
recovery by name. Both are requests. A `session.compact` hook in the
workflow-gates mod (`design/function-hook-gates.md`) makes them happen:

1. **Steer the summary.** `session.compact` carries `instructions` — what
   the summariser is told to keep or stress. The hook rewrites it to name
   the work unit, phase, topic, current step, gate modes, and the
   references loaded this session.
2. **Append the recovery as a message.** The hook awaits `next(e)` and
   receives the compaction as `{ messages }` — "there is no summary
   string: the summary is a message", and a message without an engine
   handle is read as plugin-built. It appends one user-role message:
   *you are mid-session in `{wu}/{phase}/{topic}` at step N; before
   continuing, re-read `.claude/skills/workflow-{phase}-process/SKILL.md`
   and its context-refresh recovery, then `framework.md`.* The reread is
   the first thing the resumed model sees, every time.
3. **Optionally embed, not point.** `$.fs.read` can put the skill's
   `## Instructions` block and the recovery protocol into that message
   verbatim, so the reread cannot be skipped. Whether to embed or point is
   the one design call — embedding is deterministic, pointing keeps the
   skill the single source (references defer to the owning skill).

## Where It Came From

Lee, 2026-09-22: compaction recovery "has been impossible to solve up
until now". Prose added to the workflows so the information survives
compaction in summarised form and prompts the next session to
re-familiarise itself — better than it was, still a problem. Wanted: a
completely deterministic way of injecting the necessary content and
forcing a reread of the phase's skill, so the fresh agent continues
seamlessly over the compaction event. Also the likely root of the
auto-gate residue (`auto-gate-stall-guard-mod.md`): stalls cluster when
context fills.

## Shape

- **Position source**: the same argv the mod already reads for the
  position line (`position-line-mod.md`) — `engine session label {wu}
  {phase} {topic}` at every Step 0. Step and gate modes come from the
  engine calls the hook has seen this session (`task start`, `manifest
  set … gate_mode`), never from parsing the transcript.
- **Loaded references**: the `tool.call` hook sees every `Read` of a
  `skills/**/references/*.md` and every `Skill` invocation; the list is
  what the appended message names as "re-load these".
- **Triggers**: `manual` (`/compact`), `auto` (threshold or an over-long
  prompt), `plugin`. `precompute` computes a compaction kept for later —
  the hook treats it the same, since its result only lands if that
  compaction is used.
- **Subagents**: `agentId` is set for a subagent's own compaction; the
  hook acts on the main conversation only (absent `agentId`).
- **Nothing in prose changes.** The existing context-refresh recovery
  protocol stays where it is and stays the authority; the mod makes sure
  it is reached.

## Open Verification

- The shape of a plugin-built message in `SessionMessage` (role, content
  blocks) and that the resumed model reads it as a user turn rather than
  as summary text.
- Size: an embedded `## Instructions` block plus the recovery protocol is
  a few thousand tokens; confirm that is acceptable against the
  compaction's purpose, or point rather than embed.
- Whether the appended message should also carry the last engine gate
  (re-fetched through `$.process.run`) so an interrupted gate is
  re-presented rather than lost.
- Interplay with the auto-gate guard: a compaction mid-task-loop followed
  by a stall is the case both must handle together — the recovery message
  should name the do-not-stop state when the last engine section carried
  it.

## Trigger

Build with the workflow-gates mod. Highest-value item of the set: it
replaces a request with a guarantee at the one moment the prose cannot
help itself.
