# Gather Bug Context (Fresh)

*Reference for **[start-investigation](../SKILL.md)***

---

> *Output the next fenced block as a code block:*

```
Starting new investigation.

What bug are you investigating? Please provide:
- A short name for tracking (e.g., "login-timeout-bug")
- What's broken (expected vs actual behavior)
- Any initial context (error messages, how it manifests)
```

**STOP.** Wait for user response.

---

If the user didn't provide a clear name, suggest one in kebab-case based on the bug description. Once confirmed, this becomes both `{work_unit}` and `{topic}` — for bugfix, they are always the same value.

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

Once the name is confirmed, check for naming conflicts:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}
```

If a work unit with the same name exists, inform the user:

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
A bugfix named "{work_unit}" already exists.

- **`r`/`resume`** — Resume the existing investigation
- **`n`/`new`** — Choose a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `resuming`

Set source="continue".

Check the investigation status via manifest CLI: `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase investigation --topic {topic} status`

If concluded → suggest `/start-specification bugfix {work_unit}`. If in-progress:

→ Return to **[the skill](../SKILL.md)** for **Step 6**.

#### If no conflict

→ Return to **[the skill](../SKILL.md)**.
