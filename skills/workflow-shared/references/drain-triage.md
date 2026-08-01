# Drain Triage

*Shared reference. Loaded by `workflow-discussion-process` (Step 5) and `workflow-research-process` (Step 6) at the session step, before the session loop runs. The session loops re-enter **D. Mid-Session Check** from their findings check.*

---

Folds the current topic's triage queue — concerns rerouted here from other topics, one file each — into its working content, then deletes the drained files. Runs at every entry to the session step — the first pass of a session, and again when the conclusion gate bounces back because a concern landed mid-session. An empty queue is a no-op; a resume or reopen folds whatever landed since the topic last ran.

The fold preserves the **full** rerouted context — each entry becomes real working material the session explores, not a bare map row. The conclusion gate backstops this: a topic cannot conclude while its queue holds entries.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit. Always present.
- `topic` — the current topic, whose artefact is drained.
- `phase` — `discussion` or `research`. Selects the artefact path and the fold shape.

## A. Read

List the topic's triage queue:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic queue {work_unit} {phase} {topic}
```

#### If `count` is `0`

Nothing landed. No-op — do not commit, surface nothing.

→ Return to caller.

#### Otherwise

Each path in `files` holds one `### {title}` entry (shape pinned in [triage-landing.md](triage-landing.md)). Read every file.

→ Proceed to **B. Fold Each Entry**.

## B. Fold Each Entry

For each queue file, carry its **full body** (everything below the `*From: ...*` line) into the topic's working content:

**If `phase` is `discussion`:**

Attempt to add `{title}` to the Discussion Map:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map add {work_unit} {topic} {title:(kebabcase)}
```

**If the add succeeds** — the concern is new ground: create a `## {title}` subtopic section with the entry body written in as its `### Context`, so the session explores it from there.

**If the add refuses because the subtopic already exists** — the concern names ground this discussion already covers: fold the entry body into that existing subtopic's section, and flip the subtopic back to open so the conclusion gate re-arms and the session must re-decide with the concern in hand:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs discussion-map set {work_unit} {topic} {title:(kebabcase)} exploring
```

**If `phase` is `research`:**

- Fold the entry body into the freeform research body as a seed thread under a `### {title}` heading, so the session picks it up from there.

Delete each drained queue file (`rm`) — the commit below stages the deletions.

Surface that concerns arrived from elsewhere:

> *Output the next fenced block as a code block:*

```
  ⚑ Drained {N} rerouted concern(s) into this topic:
    {title}, {title}
```

→ Proceed to **C. Commit**.

## C. Commit

Commit the drained artefact: `engine commit {work_unit} --topic {phase}/{topic} -m "{phase}({work_unit}/{topic}): drain triage"`.

→ Return to caller.

## D. Mid-Session Check

Entered from the session loop's findings check — notices concerns that landed after the session-entry drain. Run **A. Read**'s queue command. When `count` is `0`, there is nothing to do — return silently.

Otherwise, surface at the next natural break — the same mid-thread protection agent findings get, never interrupting a live thread:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
{count} concern(s) landed in this topic's triage queue mid-session:

- **`d`/`drain`** — Fold them into the session now
- **`l`/`later`** — Keep the current thread; they fold before conclusion
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `drain`:**

→ Return to **A. Read**.

**If `later`:**

Continue the current thread. `later` means *not now*, never *not this session* — the loop's check re-enters here and re-offers at the next natural break, the same cadence review findings keep. The conclusion gate remains the backstop: nothing concludes over an undrained queue.

→ Return to caller.
