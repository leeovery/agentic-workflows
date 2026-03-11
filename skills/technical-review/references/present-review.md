# Present Review

*Reference for **[technical-review](../SKILL.md)***

---

Read the review file at `.workflows/{work_unit}/review/{topic}/r{N}/review.md`.

Present a structured summary to the user:

> *Output the next fenced block as a code block:*

```
Review: {topic} (r{N})

Verdict: {Approve | Request Changes | Comments Only}

{One paragraph summary from the review}
```

#### If verdict is `Approve`

> *Output the next fenced block as a code block:*

```
All acceptance criteria met. No blocking issues found.

{Any recommendations, if present}
```

#### If verdict is `Request Changes`

> *Output the next fenced block as a code block:*

```
Required Changes:

  1. {change description}
     {file:line reference if available}

  2. ...

{Recommendations section, if present}
```

#### If verdict is `Comments Only`

> *Output the next fenced block as a code block:*

```
Comments:

  {Recommendations from the review}
```

---

## Q&A Loop

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`c`/`continue`** — Proceed to review actions
- **Or ask a question** about the review findings
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user asks a question

Answer the question using the review file, QA task files, specification, and plan as context. After answering:

→ Return to **Q&A Loop**.

#### If `continue`

→ Return to **[the skill](../SKILL.md)**.
