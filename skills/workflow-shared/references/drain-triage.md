# Drain Triage

*Shared reference. Loaded by `workflow-discussion-process` (Step 5) and `workflow-research-process` (Step 6) at the session step, before the session loop runs.*

---

Folds the current topic's `## Triage` entries — concerns rerouted here from other topics — into its working content, then resets the section to `(none)`. Runs once per session, before the loop. A fresh `(none)` artefact is a no-op; a resume or reopen folds whatever landed since the topic last ran.

The fold preserves the **full** rerouted context — each entry becomes real working material the session explores, not a bare map row. The conclusion gate backstops this: a topic cannot conclude while its `## Triage` ≠ `(none)`.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the epic. Always present.
- `topic` — the current topic, whose artefact is drained.
- `phase` — `discussion` or `research`. Selects the artefact path and the fold shape.

## A. Read

Read the `## Triage` section of `.workflows/{work_unit}/{phase}/{topic}.md`.

#### If it holds exactly `(none)`

Nothing landed. No-op — do not commit, surface nothing.

→ Return to caller.

#### Otherwise

The section holds one or more `### {title}` entries (shape pinned in [triage-landing.md](triage-landing.md)).

→ Proceed to **B. Fold Each Entry**.

## B. Fold Each Entry

For each `### {title}` subsection under `## Triage`, carry its **full body** (everything below the `*From: ...*` line) into the topic's working content:

**If `phase` is `discussion`:**

- Add `{title}` to the Discussion Map as a `pending` subtopic (`○ {title} [pending]`).
- Create a `## {title}` subtopic section with the entry body written in as its `### Context`, so the session explores it from there.

**If `phase` is `research`:**

- Fold the entry body into the freeform research body as a seed thread under a `### {title}` heading, so the session picks it up from there.

Delete each drained `### {title}` subsection from `## Triage`. When the last entry is removed, reset the section to its `(none)` placeholder.

Surface that concerns arrived from elsewhere:

> *Output the next fenced block as a code block:*

```
  ⚑ Drained {N} rerouted concern(s) into this topic:
    {title}, {title}
```

→ Proceed to **C. Commit**.

## C. Commit

Commit the drained artefact with message `{phase}({work_unit}/{topic}): drain triage`.

→ Return to caller.
