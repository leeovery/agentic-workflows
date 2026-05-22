# Route to First Phase

*Reference for **[start-cross-cutting](../SKILL.md)***

---

Let the user choose whether to start with research or go directly to discussion.

> *Output the next fenced block as markdown (not a code block):*

```
> Choose your starting point. Research is a scoped, per-topic
> investigation that produces a focused file at
> .workflows/{work_unit}/research/{topic}.md. Discussion is a
> structured conversation that works toward decisions. If you're
> unsure, research is a safe place to start.

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
