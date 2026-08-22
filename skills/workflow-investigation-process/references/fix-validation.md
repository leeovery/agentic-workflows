# Fix Validation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

An independent agent pressure-tests the agreed fix direction — does it actually resolve the root cause, and what might it break. Every agreed direction takes this pass: agreeing to a direction is what commissions it.

## A. Dispatch

Record the dispatch — the engine allocates the id and answers with the content-file path; no file is created (the file's later existence is the completion signal):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent dispatch {work_unit} investigation {topic} --kind fix-validation
```

**Agent path**: `../../../agents/workflow-investigation-fix-validation.md`

> *Output the next fenced block as a code block:*

```
Pressure-testing fix direction... (validation agent running)
```

Dispatch **one agent** via the Task tool (**synchronous** — do not use `run_in_background`).

The validation agent receives:

1. **Investigation file path** — `.workflows/{work_unit}/investigation/{topic}.md`
2. **Output file path** — the `file` from the dispatch response. The agent writes its completed verdict there — pure markdown, never frontmatter.

The validation agent returns:

```
STATUS: validated | risks_found
CONFIDENCE: high | medium | low
RISKS_COUNT: {N}
SUMMARY: {1 sentence}
```

→ Proceed to **B. Process Results**.

---

## B. Process Results

The agent ran in the foreground, so its report has landed. Promote and read it, then close the row — the verdict is consumed inline, never surfaced finding-by-finding:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs agent scan {work_unit} investigation {topic}
node .claude/skills/workflow-engine/scripts/engine.cjs agent incorporate {work_unit} investigation {topic} {id}
```

Read the report at the row's content file.

Write the payload to `.workflows/.cache/{work_unit}/investigation/{topic}/validation.json` with the Write tool:

- `status` and `confidence` — the agent's own, verbatim
- `direction` — the Chosen Approach's name from the investigation file's Fix Direction section, so the verdict says which option it confirms
- `checks` — one `[label, outcome]` pair per section the agent worked through (root cause coverage, blast radius, side effects, assumptions, testing), the outcome stated in a few words, never the detail beneath it
- `summary` — the agent's `SUMMARY` line
- `items` — on `risks_found` only, the key risks as one line each, stating what could break in behaviour terms with code refs as anchors rather than the lead

Do not dump the full output; the analysis path carries the reader there.

`{"status": "{STATUS:[validated|risks_found]}", "confidence": "{CONFIDENCE:[high|medium|low]}", "direction": "{chosen approach}", "checks": [["{label}", "{outcome}"]], "summary": "{SUMMARY}", "items": ["{risk}"], "analysis_path": "{the row's content file path}"}`

Fetch the report, emitting each section verbatim at its marked instruction:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render validation-report {work_unit}.investigation.{topic} --file .workflows/.cache/{work_unit}/investigation/{topic}/validation.json --variant fix
```

#### If `validated`

The verdict is the whole response — there is nothing to decide.

→ Return to caller.

#### If `risks_found`

The risks live only in cache — each must land in the investigation file or be explicitly dismissed before the phase concludes over them, which is what the gate above asks.

**STOP.** Wait for user response.

**If `address`:**

Work through each risk with the user — re-trace code where needed. Update the Fix Direction section with what changes: Risk Assessment and Testing Recommendations always; Chosen Approach and Options Explored if a risk shifts the direction itself. Commit the updated file.

→ Return to caller.

**If `dismiss`:**

Record the risks under a short "Fix validation risks (dismissed)" note in the investigation file's Fix Direction section so the record shows they were considered. Commit.

→ Return to caller.
