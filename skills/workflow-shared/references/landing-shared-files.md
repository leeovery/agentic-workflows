# Landing Shared Files

*Shared reference. Loaded by the session wrappers of `workflow-research-process` and `workflow-discussion-process` (whose session loops enter **A. Land It** when the user offers a path), by `workflow-investigation-process` at its code-analysis step and its symptom interview, and by `workflow-discovery`'s session loop.*

---

A file the user shares is an import, whenever it arrives: one home, `.workflows/{work_unit}/imports/`, for every phase and every file type. A markdown-ish source (`.md`, `.markdown`, `.txt`, `.text`, or no extension) lands as `{stem}.md` and reaches the knowledge base; anything else — an image, a pdf — keeps its extension, lowercased, and is tracked on the manifest alone. Land it, read it, link it, carry on — no gate anywhere in it.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit the file belongs to. Always present.
- `origin` — where the file was taken: `discovery`, or `{phase}/{topic}` with the phase `research`, `discussion`, or `investigation`.

## A. Land It

The user's message offers a path — a document or an image, one or several, dropped in from the desktop or named in prose. A pasted image is the exception: bytes in the message with no file behind it, and nothing can land it — vision reads the picture and cannot write it back out. Ask in one line for the file saved somewhere, and land that path instead.

Land every path offered in one call:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit import {work_unit} {path} [{path} …] --from {origin}
```

The verb copies, records, indexes what the store can read, and commits itself.

#### If the response is `ok: false` with `missing_imports`

Nothing landed. Name the paths that do not exist, ask for the corrected one, and run the call again over what comes back.

→ Proceed to **B. Read and Link**.

#### Otherwise

`skipped_imports` names any source whose filename normalised away to nothing — say which, so the user knows it never landed.

→ Proceed to **B. Read and Link**.

## B. Read and Link

Read what landed — an image with vision — and work with it in the conversation as you would anything else the user said.

The document carries it at its next write: an inline link by relative path, the link text saying what the file shows.

```markdown
![The competitor's permissions screen, third onboarding step](../imports/competitor-permissions.png)
```

`../imports/{name}` from a phase document at `{phase}/{topic}.md`; `../../imports/{name}` from a discovery session log or a specification. The prose around the link is the searchable record and the link is what a later reader opens — the file's content is never transcribed into the document.

The write commits on the phase's own cadence, unchanged: the import already committed itself.

→ Return to caller.
