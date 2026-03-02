# Invoke Discussion

*Reference for **[start-feature](../SKILL.md)***

---

Invoke the discussion skill with the gathered feature context.

## Handoff

Invoke the [technical-discussion](../../technical-discussion/SKILL.md) skill:

```
Technical discussion for: {topic}
Work type: feature

{compiled feature context from gather-feature-context}

Invoke the technical-discussion skill.
```

When the discussion concludes, the processing skill will read `work_type` from the manifest and invoke workflow-bridge automatically.
