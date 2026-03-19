# Capture Idea

*Reference for **[workflow-log-idea](../SKILL.md)***

---

Conversational capture for a new idea. Draw out the concept through natural dialogue.

> *Output the next fenced block as a code block:*

```
What's on your mind?

- What idea or concept do you want to capture?
- What prompted this — a problem, opportunity, curiosity?
```

**STOP.** Wait for user response.

Continue the conversation naturally — clarify, draw out details, help the user articulate the idea. Ask follow-up questions as needed.

**Hard boundaries — capture, don't explore:**
- Do not read code or explore the codebase
- Do not search the web
- Do not validate feasibility
- Do not suggest architecture or implementation
- Do not play devil's advocate
- Do not propose solutions

The goal is to capture what the user is thinking, not to evaluate or refine it.

**Convergence:** Recognise when the idea has enough shape to write up (typically 2-4 exchanges). When it does, wrap up without being told.

→ Return to caller.
