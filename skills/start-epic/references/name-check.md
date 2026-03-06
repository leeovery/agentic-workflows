# Epic Name and Conflict Check

*Reference for **[start-epic](../SKILL.md)***

---

Based on the epic description, suggest a name in kebab-case. Once confirmed, this becomes `{work_unit}` for all subsequent references.

> *Output the next fenced block as a code block:*

```
Suggested epic name: {work_unit}
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

Once the name is confirmed, check for naming conflicts:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} work_type
```

#### If a work unit with the same name exists

> *Output the next fenced block as a code block:*

```
A work unit named "{work_unit}" already exists.

Run /continue-epic to resume, or choose a different name.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`n`/`new`** — Choose a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

If they choose a new name, return to the name suggestion prompt above.

#### If no conflict

→ Return to **[the skill](../SKILL.md)**.
