# Name Topic

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Based on the user's description, suggest a topic name in kebab-case. This becomes `{topic}` for all subsequent references.

> *Output the next fenced block as a code block:*

```
Suggested topic name: {topic}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Is this name okay?

- **`y`/`yes`** — Use this name
- **something else** — Suggest a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response before proceeding.
