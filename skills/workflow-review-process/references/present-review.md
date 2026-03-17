# Present Review

*Reference for **[workflow-review-process](../SKILL.md)***

---

## A. Present Verdict

Read the review file at `.workflows/{work_unit}/review/{topic}/report.md`.

Present a structured summary to the user:

> *Output the next fenced block as a code block:*

```
Review: {topic}

Verdict: {Approve | Request Changes | Comments Only}

{One paragraph summary from the review}
```

#### If verdict is `Approve`

> *Output the next fenced block as a code block:*

```
All acceptance criteria met. No blocking issues found.

{Any recommendations, if present}
```

→ Proceed to **B. Q&A Loop**.

#### If verdict is `Request Changes`

> *Output the next fenced block as a code block:*

```
Required Changes:

  1. {change description}
     {file:line reference if available}

  2. ...

{Recommendations section, if present}
```

→ Proceed to **B. Q&A Loop**.

#### If verdict is `Comments Only`

> *Output the next fenced block as a code block:*

```
Comments:

  {Recommendations from the review}
```

→ Proceed to **B. Q&A Loop**.

---

## B. Q&A Loop

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Any questions before proceeding?

- **`c`/`continue`** — Proceed to review actions
- **Ask a question** — Ask about the review findings
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user asks a question

Answer the question using the review file, QA task files, specification, and plan as context.

→ Return to **B. Q&A Loop**.

#### If `continue`

→ Return to caller.
