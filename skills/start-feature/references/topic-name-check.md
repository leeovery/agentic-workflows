# Feature Name

*Reference for **[start-feature](../SKILL.md)***

---

Based on the feature description, suggest a name. Once confirmed, this becomes both `{work_unit}` and `{topic}` — for feature, they are always the same value.

> *Output the next fenced block as a code block:*

```
Suggested feature name: {work_unit:(kebabcase)}
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
Is this name okay?

- **`y`/`yes`** — Use this name
- **something else** — Suggest a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

Create the work unit manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init {work_unit} --work-type feature --description "{description}"
```

Where `{description}` is a concise one-line summary compiled from the feature context gathered in Step 1.

→ Return to **[the skill](../SKILL.md)**.
