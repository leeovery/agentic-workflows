# Root Cause Validation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

An independent agent validates the root cause hypothesis by tracing the code fresh. This step is optional — offered before the findings are presented, so anything it surfaces is folded in ahead of sign-off.

## A. Offer Validation

> *Output the next fenced block as markdown (not a code block):*

```
> An independent agent can trace the code fresh to validate the
> root cause before the findings are presented for sign-off.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Root cause documented. Run validation?

- **`y`/`yes`** — Run root cause validation
- **`s`/`skip`** — Skip straight to findings sign-off
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `skip`

→ Return to caller.

#### If `yes`

→ Proceed to **B. Dispatch**.

---

## B. Dispatch

Record the dispatch — the engine allocates the id and answers with the content-file path; no file is created (the file's later existence is the completion signal):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} investigation {topic} --kind root-cause-validation
```

**Agent path**: `../../../agents/workflow-investigation-root-cause-validation.md`

> *Output the next fenced block as a code block:*

```
Validating root cause hypothesis... (validation agent running)
```

Dispatch **one agent** via the Task tool (**synchronous** — do not use `run_in_background`).

The validation agent receives:

1. **Investigation file path** — `.workflows/{work_unit}/investigation/{topic}.md`
2. **Output file path** — the `file` from the dispatch response. The agent writes its completed verdict there — pure markdown, never frontmatter.

The validation agent returns:

```
STATUS: validated | gaps_found
CONFIDENCE: high | medium | low
GAPS_COUNT: {N}
SUMMARY: {1 sentence}
```

→ Proceed to **C. Process Results**.

---

## C. Process Results

The agent ran in the foreground, so its report has landed. Promote and read it, then close the row — the verdict is consumed inline, never surfaced finding-by-finding:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} investigation {topic}
node .claude/skills/workflow-engine/scripts/engine.cjs agent incorporate {work_unit} investigation {topic} {id}
```

Read the report at the row's content file.

#### If `validated`

> *Output the next fenced block as a code block:*

```
Validation: Root cause validated ({CONFIDENCE} confidence). No gaps found.
```

→ Return to caller.

#### If `gaps_found`

Extract the key gaps from the validation file. Present a brief summary — do not dump the full output. Each gap line states what could be wrong in behaviour terms — code refs as anchors, not the lead.

> *Output the next fenced block as a code block:*

```
Validation: {CONFIDENCE} confidence. {GAPS_COUNT} gap(s) identified.

  {gap 1}
  {gap 2}

Full analysis: {the row's content file path}
```

The gaps live only in cache — each must land in the investigation file or be explicitly dismissed before the phase concludes over them:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How should these gaps be handled?

- **`a`/`address`** — Work through them and fold the answers into the investigation
- **`d`/`dismiss`** — Note them as considered-and-dismissed and proceed
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `address`:**

Work through each gap with the user — re-trace code where needed — and update the investigation file's affected sections (Analysis, Root Cause, Blast Radius) with what the answers change or confirm. Commit the updated file.

→ Return to caller.

**If `dismiss`:**

Record the gaps under a short "Validation gaps (dismissed)" note in the investigation file's Analysis section so the record shows they were considered. Commit.

→ Return to caller.
