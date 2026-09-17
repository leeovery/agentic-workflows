# Landing Shared Files

*Shared reference. Loaded by the session wrappers of `workflow-research-process` and `workflow-discussion-process` (whose session loops enter **A. Land It** when the user offers a path), by `workflow-investigation-process` at its code-analysis step and its symptom interview, and by `workflow-discovery`'s session loop.*

---

A file the user shares is an import, whenever it arrives: one home, `.workflows/{work_unit}/imports/`, for every phase and every file type. A markdown-ish source (`.md`, `.markdown`, `.txt`, `.text`, or no extension) lands as `{stem}.md` and reaches the knowledge base; anything else — an image, a pdf — keeps its extension, lowercased, and is tracked on the manifest alone. Land it, read it, link it, carry on.

## Parameters

The caller provides these via context before loading:

- `work_unit` — the work unit the file belongs to. Always present.
- `origin` — where the file was taken: `discovery`, or `{phase}/{topic}` with the phase `research`, `discussion`, or `investigation`.

## A. Land It

The user's message offers a path — a document or an image, one or several, dropped in from the desktop or named in prose.

#### If the message carries a pasted image and no path

Bytes in the message with no file behind it: vision reads the picture and cannot write it back out. Ask in one line for the file saved somewhere.

**STOP.** Wait for user response.

**If the answer names a path:**

→ Return to **A. Land It**.

**If the user has no file to give:**

Nothing lands. Carry on with what vision read.

→ Return to caller.

#### Otherwise

Land every path offered in one call. Single-quote every path — an image's filename carries spaces and capitals, and unquoted each word becomes its own positional — and write a `~` path out in full, since the quotes stop the shell expanding it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs workunit import {work_unit} '{path}' ['{path}' …] --from {origin}
```

The verb copies, records, indexes what the store can read, and commits itself.

**If the response is `ok: false` with `missing_imports`:**

Nothing landed. Name the paths that do not exist and ask for the corrected one(s).

**STOP.** Wait for user response.

→ Return to **A. Land It**.

**If the response is `ok: false` for any other reason:**

Surface the engine's error verbatim — it names the recovery path. Nothing landed, and nothing is linked.

→ Return to caller.

**Otherwise:**

`skipped_imports` names any source whose filename normalised away to nothing — say which, so the user knows it never landed.

→ Proceed to **B. Read and Link**.

## B. Read and Link

The landed name is the response's `imports[].path` — the engine normalises and dedupes, so it is rarely the name the user typed. Read what landed at that path — an image with vision — and work with it in the conversation as you would anything else the user said.

The document carries it at its next write: an inline link by relative path under the landed name, the link text saying what the file shows.

```markdown
![The competitor's permissions screen, third onboarding step](../imports/competitor-permissions.png)
```

`../imports/{name}` from a phase document at `{phase}/{topic}.md`; `../../imports/{name}` from a specification or from a discovery session log at `discovery/sessions/`, where the link sits in the exploration that discusses the file — the caller's **Edits** line records the landing, not the link. The prose around the link is the searchable record and the link is what a later reader opens — the file's content is never transcribed into the document.

The landing adds no commit of its own to the phase's cadence: the import already committed itself.

→ Return to caller.
