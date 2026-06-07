# Drain Incoming

*Shared reference. Loaded by `workflow-discussion-process` and `workflow-research-process` at session start.*

---

Folds any entries in the current topic artefact's `## Incoming` section into the session's working map, then clears the section. Runs **once at session start** — before the session loop and before its first "check for findings" step — so a concern that landed while the topic was idle is picked up before any work begins, and the map is never reshuffled mid-turn. Both the fresh-start path and the resume/reopen path reach the session step, so a single invocation there covers both: on a fresh artefact the section is `(none)` and the drain is a no-op; on resume or after a reopen it folds whatever landed.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit. Always present.
- `topic` — the current topic whose artefact is being drained.
- `phase` — the current phase, `research` or `discussion`. Selects the artefact and how entries fold in.

## A. Read the Section

The artefact is `.workflows/{work_unit}/{phase}/{topic}.md`. Read its `## Incoming` section.

#### If the section is exactly `(none)`

Nothing landed — no drain needed.

→ Return to caller.

#### Otherwise

→ Proceed to **B. Fold Each Entry**.

## B. Fold Each Entry

Each landed concern is a `### {concern}` subsection. For each, in order:

**If `phase` is `discussion`:** add the concern to the Discussion Map as a `pending` subtopic, so it enters the session as something to explore.

**If `phase` is `research`:** fold the concern into the body as a seed thread — research has no formal map, so the freeform body (near the Starting Point) is its home.

After folding an entry, **delete its `### {concern}` subsection** from `## Incoming`. The git history is the audit trail. When the last entry is removed, reset the section body to `(none)`.

→ Proceed to **C. Commit**.

## C. Commit

Commit the folded working map and the cleared section together:

```bash
git add -- .workflows/{work_unit}/{phase}/{topic}.md
git commit -m "{phase}({work_unit}/{topic}): drain incoming"
```

→ Return to caller.
