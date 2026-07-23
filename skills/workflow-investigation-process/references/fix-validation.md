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
Fix validation: Direction confirmed ({CONFIDENCE} confidence). No unaddressed risks.
```

→ Return to caller.

#### If `risks_found`

Extract the key risks from the validation file. Present a brief summary — do not dump the full output. Each risk line states what could break in behaviour terms — code refs as anchors, not the lead.

> *Output the next fenced block as a code block:*

```
Fix validation: {CONFIDENCE} confidence. {RISKS_COUNT} risk(s) identified.

  {risk 1}
  {risk 2}

Full analysis: {the row's content file path}
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
