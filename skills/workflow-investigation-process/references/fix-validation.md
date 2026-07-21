# Fix Validation

*Reference for **[workflow-investigation-process](../SKILL.md)***

---

An independent agent pressure-tests the agreed fix direction — does it actually resolve the root cause, and what might it break. This step is optional — the user chooses whether to run it.

## A. Offer Validation

> *Output the next fenced block as markdown (not a code block):*

```
> An independent agent can pressure-test the agreed direction —
> confirming it resolves the root cause and hunting for side
> effects before the investigation concludes.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Fix direction agreed. Run fix validation?

- **`y`/`yes`** — Run fix validation
- **`s`/`skip`** — Skip to wrap-up
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

Use the next available `{NNN}` for `fix-validation-*` files (zero-padded, e.g., `001`, `002`).

Write the skeleton cache file at `.workflows/.cache/{work_unit}/investigation/{topic}/fix-validation-{NNN}.md` — frontmatter only, no body. `status: in-flight` is the dispatch record; the agent's rewrite flips it to `pending`:

```yaml
---
type: fix-validation
status: in-flight
created: {date}
---
```

**Agent path**: `../../../agents/workflow-investigation-fix-validation.md`

> *Output the next fenced block as a code block:*

```
Pressure-testing fix direction... (validation agent running)
```

Dispatch **one agent** via the Task tool (**synchronous** — do not use `run_in_background`).

The validation agent receives:

1. **Investigation file path** — `.workflows/{work_unit}/investigation/{topic}.md`
2. **Output file path** — `.workflows/.cache/{work_unit}/investigation/{topic}/fix-validation-{NNN}.md` (the skeleton above is already on disk there)

The validation agent returns:

```
STATUS: validated | risks_found
CONFIDENCE: high | medium | low
RISKS_COUNT: {N}
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
Fix validation: Direction confirmed ({CONFIDENCE} confidence). No unaddressed risks.
```

→ Return to caller.

#### If `risks_found`

Update the output file frontmatter to `status: read`.

Extract the key risks from the validation file. Present a brief summary — do not dump the full output.

> *Output the next fenced block as a code block:*

```
Fix validation: {CONFIDENCE} confidence. {RISKS_COUNT} risk(s) identified.

  {risk 1}
  {risk 2}

Full analysis: .workflows/.cache/{work_unit}/investigation/{topic}/fix-validation-{NNN}.md
```

The risks live only in cache — each must land in the investigation file or be explicitly dismissed before the phase concludes over them:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How should these risks be handled?

- **`a`/`address`** — Work through them and fold the outcome into the fix direction
- **`d`/`dismiss`** — Note them as considered-and-dismissed and proceed
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

**If `address`:**

Work through each risk with the user — re-trace code where needed. Update the Fix Direction section with what changes: Risk Assessment and Testing Recommendations always; Chosen Approach and Options Explored if a risk shifts the direction itself. Commit the updated file.

→ Return to caller.

**If `dismiss`:**

Record the risks under a short "Fix validation risks (dismissed)" note in the investigation file's Fix Direction section so the record shows they were considered. Commit.

→ Return to caller.
