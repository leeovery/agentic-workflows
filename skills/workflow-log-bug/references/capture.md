# Capture Bug

*Reference for **[workflow-log-bug](../SKILL.md)***

---

Conversational capture for a bug report. Draw out the symptoms through natural dialogue.

> *Output the next fenced block as a code block:*

```
What's broken?

- What behavior are you seeing?
- What did you expect instead?
```

**STOP.** Wait for user response.

Continue the conversation naturally — clarify symptoms, conditions, and impact. Ask follow-up questions as needed.

**Hard boundaries — capture, don't explore:**
- Do not read code or explore the codebase
- Do not search the web
- Do not validate or reproduce the bug
- Do not suggest fixes or workarounds
- Do not diagnose root causes
- Do not propose solutions

The goal is to capture what's broken, not to investigate it.

**Convergence:** Recognise when the bug has enough detail to write up (typically 2-4 exchanges). When it does, wrap up without being told.

→ Return to caller.
