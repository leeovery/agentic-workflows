# Gather Bug Context

*Reference for **[start-investigation](../SKILL.md)***

---

Route based on the `source` variable set in earlier steps.

#### If source is `bridge`

Bridge mode: topic and work_type were provided by the caller.

> *Output the next fenced block as a code block:*

```
Starting investigation: {topic:(titlecase)}

What bug are you investigating? Please provide:
- What's broken (expected vs actual behavior)
- Any initial context (error messages, how it manifests)
```

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.

#### If source is `fresh`

Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions.

→ Return to **[the skill](../SKILL.md)**.
