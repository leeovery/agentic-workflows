# Gather Context

*Reference for **[initialize-discussion](initialize-discussion.md)***

---

Ask each question below **one at a time**. After each, stop and wait for the user's response before proceeding.

---

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Gather Context`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Setting up the discussion. I'll ask a few questions to understand the problem, constraints, and any relevant code before we begin.
```

## A. Core Problem

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render opener {work_unit}.discussion.{topic} --variant discussion
```

Emit the call's DISPLAY section verbatim per its marker.

**STOP.** Wait for user response.

Remember the response — it defines the central problem or decision that the discussion will be structured around.

→ Proceed to **B. Constraints**.

---

## B. Constraints

> *Output the next fenced block as markdown (not a code block):*

```
Any constraints or context I should know about?
```

**STOP.** Wait for user response.

Remember the response — these constraints will bound the solution space during the discussion.

→ Proceed to **C. Codebase**.

---

## C. Codebase

> *Output the next fenced block as markdown (not a code block):*

```
Are there specific files in the codebase I should review first?

(Or "none" if not applicable)
```

**STOP.** Wait for user response.

Remember the response — these files will be read for context when the discussion begins.

→ Return to caller.
