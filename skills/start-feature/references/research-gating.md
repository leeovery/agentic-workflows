# Route to First Phase

*Reference for **[start-feature](../SKILL.md)***

---

Let the user choose whether to start with research or go directly to discussion.

> *Output the next fenced block as markdown (not a code block):*

```
> Choose your starting point. Research is open-ended exploration
> — gather context, weigh options, no commitments. Discussion is
> structured conversation that works toward decisions. If you're
> unsure, research is a safe place to start.

· · · · · · · · · · · ·
How would you like to start?

- **`r`/`research`** — Explore ideas and options first, no decisions yet
- **`d`/`discussion`** — Ready to discuss and make decisions
- **`i`/`import`** — Import existing research files verbatim

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

#### If user chooses import

Load **[collect-import.md](collect-import.md)** and follow its instructions as written.

Set phase="research" and source="import".

→ Return to caller.
