# Bugfix Name

*Reference for **[start-bugfix](../SKILL.md)***

---

Based on the bug description, suggest a name in kebab-case. Once confirmed, this becomes both `{work_unit}` and `{topic}` — for bugfix, they are always the same value.

> *Output the next fenced block as a code block:*

```
Suggested bugfix name: {work_unit}
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
node .claude/skills/workflow-manifest/scripts/manifest.js init {work_unit} --work-type bugfix --description "{description}"
```

Where `{description}` is a concise one-line summary compiled from the bug context gathered in Step 1.

→ Return to **[the skill](../SKILL.md)**.
