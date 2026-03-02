# Topic Name and Conflict Check

*Reference for **[start-bugfix](../SKILL.md)***

---

Based on the bug description, suggest a topic name:

> *Output the next fenced block as a code block:*

```
Suggested topic name: {suggested-topic:(kebabcase)}

This will create: .workflows/{suggested-topic}/investigation/investigation.md
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

#### If an investigation with the same name exists

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
A work unit named "{topic}" already exists.

- **`r`/`resume`** — Resume the existing investigation
- **`n`/`new`** — Choose a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `resuming`

Check the investigation status. If in-progress:

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

#### If no conflict

→ Return to **[the skill](../SKILL.md)**.
