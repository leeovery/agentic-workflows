# Gather Context: Fresh Topic

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Ask each question below **one at a time**. After each, **STOP** and wait for the user's response before proceeding.

---

## A. Core Problem

> *Output the next fenced block as markdown (not a code block):*

```
> **Setting up the discussion.** I'll ask a few questions to understand the problem, constraints, and any relevant code before we begin.
```

> *Output the next fenced block as a code block:*

```
New discussion: {topic}

What's the core problem or decision we need to work through?
```

**STOP.** Wait for user response.

Remember the response — it defines the central problem or decision that the discussion will be structured around.

→ Proceed to **B. Constraints**.

---

## B. Constraints

> *Output the next fenced block as a code block:*

```
Any constraints or context I should know about?
```

**STOP.** Wait for user response.

Remember the response — these constraints will bound the solution space during the discussion.

→ Proceed to **C. Codebase**.

---

## C. Codebase

> *Output the next fenced block as a code block:*

```
Are there specific files in the codebase I should review first?

(Or "none" if not applicable)
```

**STOP.** Wait for user response.

Remember the response — these files will be read for context when the discussion begins.

→ Return to caller.
