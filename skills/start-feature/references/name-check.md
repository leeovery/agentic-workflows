# Feature Name and Conflict Check

*Reference for **[start-feature](../SKILL.md)***

---

Based on the feature description, suggest a name in kebab-case. Once confirmed, this becomes both `{work_unit}` and `{topic}` — for feature, they are always the same value.

> *Output the next fenced block as a code block:*

```
Suggested feature name: {work_unit}
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

Run /continue-feature to resume, or choose a different name.
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

Create the work unit manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init {work_unit} --work-type feature --description "{description}"
```

Where `{description}` is a concise one-line summary compiled from the feature context gathered in Step 1.

→ Return to **[the skill](../SKILL.md)**.
