# Root Cause Validation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

An independent agent validates the root cause hypothesis by tracing the code fresh. This step is optional — offered before the findings are presented, so anything it surfaces is folded in ahead of sign-off.

## A. Offer Validation

> *Output the next fenced block as markdown (not a code block):*

```
> An independent agent can trace the code fresh to validate the root cause before the findings are presented for sign-off.
```

Fetch the offer, emitting the section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render validation-gate {work_unit}.investigation.{topic} --variant root-cause
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

Write the payload to `.workflows/.cache/{work_unit}/investigation/{topic}/validation.json` with the Write tool:

- `status` and `confidence` — the agent's own, verbatim
- `checks` — one `[label, outcome]` pair per section the agent worked through (symptom coverage, code trace, alternative root causes, blast radius), the outcome stated in a few words, never the detail beneath it
- `summary` — the agent's `SUMMARY` line
- `items` — on `gaps_found` only, the key gaps as one line each, stating what could be wrong in behaviour terms with code refs as anchors rather than the lead

Do not dump the full output; the analysis path carries the reader there.

`{"status": "{STATUS:[validated|gaps_found]}", "confidence": "{CONFIDENCE:[high|medium|low]}", "checks": [["{label}", "{outcome}"]], "summary": "{SUMMARY}", "items": ["{gap}"], "analysis_path": "{the row's content file path}"}`

Fetch the report, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render validation-report {work_unit}.investigation.{topic} --file .workflows/.cache/{work_unit}/investigation/{topic}/validation.json --variant root-cause
```

#### If `validated`

The verdict is the whole response — there is nothing to decide.

→ Return to caller.

#### If `gaps_found`

The gaps live only in cache — each must land in the investigation file or be explicitly dismissed before the phase concludes over them, which is what the gate above asks.

**STOP.** Wait for user response.

**If `address`:**

Work through each gap with the user — re-trace code where needed — and update the investigation file's affected sections (Analysis, Root Cause, Blast Radius) with what the answers change or confirm. Commit the updated file.

→ Return to caller.

**If `dismiss`:**

Record the gaps under a short "Validation gaps (dismissed)" note in the investigation file's Analysis section so the record shows they were considered. Commit.

→ Return to caller.
