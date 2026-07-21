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

Ensure the cache directory exists:

```bash
mkdir -p .workflows/.cache/{work_unit}/investigation/{topic}
```

Determine the next set number by checking existing files:

```bash
ls .workflows/.cache/{work_unit}/investigation/{topic}/ 2>/dev/null
```

Use the next available `{NNN}` for `synthesis-*` files (zero-padded, e.g., `001`, `002`).

Write the skeleton cache file at `.workflows/.cache/{work_unit}/investigation/{topic}/synthesis-{NNN}.md` — frontmatter only, no body. `status: in-flight` is the dispatch record; the agent's rewrite flips it to `pending`:

```yaml
---
type: synthesis
status: in-flight
created: {date}
---
```

**Agent path**: `../../../agents/workflow-investigation-synthesis.md`

> *Output the next fenced block as a code block:*

```
Validating root cause hypothesis... (validation agent running)
```

Dispatch **one agent** via the Task tool (**synchronous** — do not use `run_in_background`).

The validation agent receives:

1. **Investigation file path** — `.workflows/{work_unit}/investigation/{topic}.md`
2. **Output file path** — `.workflows/.cache/{work_unit}/investigation/{topic}/synthesis-{NNN}.md` (the skeleton above is already on disk there)

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

Read the validation output file.

#### If `validated`

Update the output file frontmatter to `status: read`.

> *Output the next fenced block as a code block:*

```
Validation: Root cause validated ({CONFIDENCE} confidence). No gaps found.
```

→ Return to caller.

#### If `gaps_found`

Update the output file frontmatter to `status: read`.

Extract the key gaps from the validation file. Present a brief summary — do not dump the full output.

> *Output the next fenced block as a code block:*

```
Validation: {CONFIDENCE} confidence. {GAPS_COUNT} gap(s) identified.

  {gap 1}
  {gap 2}

Full analysis: .workflows/.cache/{work_unit}/investigation/{topic}/synthesis-{NNN}.md
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
