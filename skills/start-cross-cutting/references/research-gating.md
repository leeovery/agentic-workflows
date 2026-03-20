# Route to First Phase

*Reference for **[start-cross-cutting](../SKILL.md)***

---

Let the user choose whether to start with research or go directly to discussion.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
How would you like to start?

- **`r`/`research`** — Explore ideas and options first, no decisions yet
- **`d`/`discussion`** — Ready to discuss and make decisions

Select an option:
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If user chooses research

Set phase="research".

→ Return to caller.

#### If user chooses discussion

Set phase="discussion".

→ Return to caller.
