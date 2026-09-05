---
name: workflow-baseline
user-invocable: false
allowed-tools: Bash(node .claude/skills/workflow-engine/scripts/engine.cjs), Bash(node .claude/skills/workflow-knowledge/scripts/knowledge.cjs), Bash(git log)
---

# Project Baseline

Act as a **product archaeologist and interviewer**. Backfill the record a project built without the workflows never accumulated: fan-out research over the existing codebase, synthesised into an interview that captures the WHY layer from the user, landed as a knowledge-base-indexed doc set at `.workflows/.baseline/`.

## Purpose in the Workflow

Project-level and outside the pipeline — no work unit, no phases. Invoked from `workflow-start` (the one-time offer, the resume row, or manage). All state it needs is fetched at initialisation; the caller passes nothing.

Three trust layers govern every claim the baseline records:

- **observed** — what the code shows, confirmed by the user where load-bearing
- **stated** — rationale and history from the interview, in the user's words
- **open** — asked and unanswered, or never asked; recorded as `OPEN:` items, never filled with a plausible guess

Baseline content is reference material, never record: it informs later phases through knowledge-base retrieval, but it never settles a call the way a discussion or specification does.

---

## Instructions

Load **[framework.md](../workflow-shared/references/framework.md)** and follow its instructions as written.

---

## Resuming After Context Refresh

Context refresh (compaction) summarizes the conversation, losing procedural detail. When you detect a context refresh has occurred — the conversation feels abruptly shorter, you lack memory of recent steps, or a summary precedes this message — follow this recovery protocol:

1. **Re-read this skill file completely, then re-load [framework.md](../workflow-shared/references/framework.md).** Do not rely on your summary of either, and re-read both even if you believe they are already loaded — that belief is what a summary feels like from the inside.
2. **Read the manifest state.** `node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.baseline` — status and per-area statuses.
3. **Read the session files.** The dossiers and agendas under `.workflows/.baseline/.state/` are the working documents; each agenda's per-question `**Status**` rows are the authoritative interview position.
4. **Check git state.** `git status` and `git log --oneline -10` — baseline commits reveal what landed.
5. **Announce your position** to the user before continuing: which step, which area, what remains. Wait for confirmation.

Do not guess at progress or continue from memory. The files on disk and git history are authoritative — your recollection is not.

---

## Step 0: Initialisation

> *Output the next fenced block as markdown (not a code block):*

```
# **`■ Project Baseline`**
```

Read the baseline status (empty output, or `native`, means no assessment has been started):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get project.baseline.status
```

#### If the status is empty, `native`, or `skipped`

→ Proceed to **Step 1**.

#### If the status is `in-progress`

→ Proceed to **Step 3**.

#### If the status is `completed`

→ Proceed to **Step 4**.

#### Otherwise

An unrecognised status — treat it as no assessment started.

→ Proceed to **Step 1**.

---

## Step 1: Scope the Assessment

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Scoping the Assessment`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> A quick survey of the codebase proposes the areas worth assessing; you shape the list before any deeper research runs.
```

Load **[scope-areas.md](references/scope-areas.md)** and follow its instructions as written.

→ On return, proceed to **Step 2**.

---

## Step 2: Research the Codebase

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Researching the Codebase`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> One researcher agent per area reads the code and comes back with what it shows — and the questions only you can answer. Those questions become the interview.
```

Load **[research-and-agenda.md](references/research-and-agenda.md)** and follow its instructions as written.

→ On return, proceed to **Step 3**.

---

## Step 3: Interview

Load **[interview-loop.md](references/interview-loop.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

---

## Step 4: Manage

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Managing the Baseline`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> The assessment is complete — view a doc, or expand into new or deeper ground.
```

Load **[manage-baseline.md](references/manage-baseline.md)** and follow its instructions as written.

→ On return, proceed as the reference directed.

---

## Step 5: Conclude

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Concluding the Assessment`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Every area is documented and indexed — closing the assessment.
```

Load **[conclude.md](references/conclude.md)** and follow its instructions as written.
