# Drain Incoming

*Shared reference. Loaded by `workflow-discussion-process` and `workflow-research-process` at session start.*

---

Folds any entries in the current topic artefact's `## Incoming` section into the session's working map, then clears the section. Runs **once at session start** — before the session loop and before the first "check for findings" step — so a concern that landed while the topic was idle is picked up before any work begins, and the map is never reshuffled mid-turn. Invoked from both the initialize path (fresh start) and the resume/reopen path (a reopened decided topic resumes rather than initialises), which is why it is its own reference.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit. Always present.
- `topic` — the current topic whose artefact is being drained.
- `phase` — the current phase, `research` or `discussion` (selects how entries fold in).

## Drain Contract

Read the topic artefact's `## Incoming` section.

- When it is exactly `(none)`, there is nothing to drain — return.
- Otherwise, for each `### {concern}` subsection:
  - **Discussion** — add the concern to the Discussion Map as a `pending` subtopic.
  - **Research** — fold the concern into the body as a seed thread (research has no formal map; the freeform body is its home).
  - After folding an entry, **delete its subsection** from `## Incoming`. When the last entry is removed, reset the section to `(none)`.
- Include the drained map and the cleared `## Incoming` in the same initial / resume commit the caller is about to make.

The full folding procedure is specified where the session flows invoke it.

→ Return to caller.
