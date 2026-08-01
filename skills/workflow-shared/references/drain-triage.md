# Drain Triage

*Shared reference. Loaded by `workflow-discussion-process` (Step 5) and `workflow-research-process` (Step 6) at the session step, before the session loop runs.*

---

Folds the current topic's triage queue — concerns rerouted here from other topics, one file each under `.workflows/{work_unit}/{phase}/.triage/{topic}/` — into its working content, then deletes the drained files. Runs at every entry to the session step — the first pass of a session, and again when the conclusion gate bounces back because a concern landed mid-session. An empty queue is a no-op; a resume or reopen folds whatever landed since the topic last ran.

The fold preserves the **full** rerouted context — each entry becomes real working material the session explores, not a bare map row. The conclusion gate backstops this: a topic cannot conclude while its queue holds entries.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit. Always present.
- `topic` — the current topic, whose artefact is drained.
- `phase` — `discussion` or `research`. Selects the artefact path and the fold shape.

## A. Read

List the topic's triage queue: `.workflows/{work_unit}/{phase}/.triage/{topic}/*.md`.

#### If the directory is missing or empty

Nothing landed. No-op — do not commit, surface nothing.

→ Return to caller.

#### Otherwise

Each file holds one `### {title}` entry (shape pinned in [triage-landing.md](triage-landing.md)). Read every file.

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
