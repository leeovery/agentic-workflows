# Synthesis Agent

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

An independent synthesis agent validates the root cause hypothesis by tracing code fresh. This step is optional — the user chooses whether to run it.

## A. Present Findings

Summarize the investigation findings in a structured display. Pull from the investigation file — do not invent or embellish.

> *Output the next fenced block as a code block:*

```
Investigation Findings: {work_unit}

Root Cause:
  {clear, precise root cause statement}

Contributing Factors:
  {factor 1}
  {factor 2}

Blast Radius:
  Directly affected:  {components}
  Potentially affected: {components sharing code/patterns}

Why It Wasn't Caught:
  {testing gap, edge case, recent change}
```

→ Proceed to **B. Offer Validation**.

---

## B. Offer Validation

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Root cause documented. Run synthesis validation?

An independent agent will trace the code to validate the
root cause hypothesis before confirming.

- **`y`/`yes`** — Run synthesis validation
- **`s`/`skip`** — Skip straight to findings review
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `skip`

→ Return to caller.

#### If `yes`

→ Proceed to **C. Dispatch**.

---

## C. Dispatch

Ensure the cache directory exists:

```bash
mkdir -p .workflows/.cache/{work_unit}/investigation/{topic}
```

Determine the next set number by checking existing files:

```bash
ls .workflows/.cache/{work_unit}/investigation/{topic}/ 2>/dev/null
```

Use the next available `{NNN}` (zero-padded, e.g., `001`, `002`).

**Agent path**: `../../../agents/workflow-investigation-synthesis.md`

> *Output the next fenced block as a code block:*

```
Validating root cause hypothesis... (synthesis agent running)
```

Dispatch **one agent** via the Task tool (**synchronous** — do not use `run_in_background`).

The synthesis agent receives:

1. **Investigation file path** — `.workflows/{work_unit}/investigation/{topic}.md`
2. **Output file path** — `.workflows/.cache/{work_unit}/investigation/{topic}/synthesis-{NNN}.md`
3. **Frontmatter** — the frontmatter block to write:
   ```yaml
   ---
   type: synthesis
   status: pending
   created: {date}
   ---
   ```

The synthesis agent returns:

```
STATUS: validated | gaps_found
CONFIDENCE: high | medium | low
GAPS_COUNT: {N}
SUMMARY: {1 sentence}
```

→ Proceed to **D. Process Results**.

---

## D. Process Results

Read the synthesis output file.

#### If `validated`

Update the output file frontmatter to `status: read`.

> *Output the next fenced block as a code block:*

```
Synthesis: Root cause validated ({CONFIDENCE} confidence). No gaps found.
```

→ Return to caller.

#### If `gaps_found`

Update the output file frontmatter to `status: read`.

Extract the key gaps from the synthesis file. Present a brief summary — do not dump the full output.

> *Output the next fenced block as a code block:*

```
Synthesis: {CONFIDENCE} confidence. {GAPS_COUNT} gap(s) identified.

  {gap 1}
  {gap 2}

Full analysis: .workflows/.cache/{work_unit}/investigation/{topic}/synthesis-{NNN}.md
```

→ Return to caller.
