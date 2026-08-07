# Gather Bug Context

*Reference for **[workflow-investigation-entry](../SKILL.md)***

---

> *Output the next fenced block as markdown (not a code block):*

```
**`□ Gather Bug Context`**
```

> *Output the next fenced block as markdown (not a code block):*

```
> Collecting information about the bug — what's broken, how it manifests, and any initial context.
```

> *Output the next fenced block as a code block:*

```
Starting investigation: {work_unit:(titlecase)}

What bug are you investigating? Please provide:
- What's broken (expected vs actual behavior)
- Any initial context (error messages, how it manifests)
```

**STOP.** Wait for user response.

→ Return to caller.
