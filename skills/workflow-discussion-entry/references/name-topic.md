# Name Topic

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

## A. Name Suggestion

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

**STOP.** Wait for user response.

#### If `yes`

→ Proceed to **B. Conflict Check**.

#### If user suggests a different name

Use the suggested name as `{topic}`.

→ Proceed to **B. Conflict Check**.

---

## B. Conflict Check

Check if a discussion with this topic already exists:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.discussion.{topic}
```

#### If exists (`true`)

> *Output the next fenced block as a code block:*

```
A discussion named "{topic}" already exists in this work unit.

Run /workflow-start to resume, or choose a different name.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`n`/`new`** — Choose a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

→ Return to **A. Name Suggestion**.

#### If not exists (`false`)

Name confirmed. No conflict.
