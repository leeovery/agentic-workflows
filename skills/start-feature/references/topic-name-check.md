# Topic Name and Conflict Check

*Reference for **[start-feature](../SKILL.md)***

---

Based on the feature description, suggest a topic name:

> *Output the next fenced block as a code block:*

```
Suggested topic name: {suggested-topic:(kebabcase)}

This will create: .workflows/{suggested-topic}/discussion/discussion.md
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

Once the topic name is confirmed, check for naming conflicts:

```bash
ls .workflows/
```

#### If a discussion with the same name exists

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
A work unit named "{topic}" already exists.

- **`r`/`resume`** — Resume the existing discussion
- **`n`/`new`** — Choose a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `resuming`

Check the discussion status. If in-progress:

Set phase="discussion".

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

#### If no conflict

→ Return to **[the skill](../SKILL.md)**.
