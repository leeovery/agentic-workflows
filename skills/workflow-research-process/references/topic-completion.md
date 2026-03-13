# Topic Completion

*Reference for **[workflow-research-process](../SKILL.md)***

---

**Never decide for the user.** Even if the answer seems obvious, flag it and ask.

The current topic is converging — tradeoffs are clear, it's approaching decision territory.

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`c`/`conclude`** — Mark this topic as complete, ready for discussion
- **`k`/`keep`** — Keep digging, there's more to understand
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If the user concludes

→ Load **[conclude-research.md](conclude-research.md)** and follow its instructions as written.

#### If the user keeps digging

Continue exploring. The convergence signal isn't a stop sign — it's an awareness check. The user might want to stress-test the emerging conclusion, explore edge cases, or understand the problem more deeply before moving on.

→ Return to the calling session file and resume the **Session Loop**.
