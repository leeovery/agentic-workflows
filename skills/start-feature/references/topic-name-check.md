# Topic Name and Conflict Check

*Reference for **[start-feature](../SKILL.md)***

---

Based on the feature description, suggest a topic name:

> *Output the next fenced block as a code block:*

```
Suggested topic name: {suggested-topic:(kebabcase)}

This will create: .workflows/{suggested-topic}/discussion/{suggested-topic}.md
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

Once the topic name is confirmed, check for work unit naming conflicts:

```bash
ls .workflows/
```

For feature, the topic name and work unit name are the same value.

#### If a work unit with the same name exists

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
A work unit named "{work_unit}" already exists.

- **`r`/`resume`** — Resume the existing discussion
- **`n`/`new`** — Choose a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `resuming`

Check the discussion status via manifest CLI: `get {work_unit} --phase discussion --topic {work_unit} status`

**If in-progress:**

Set phase="discussion".

→ Return to **[the skill](../SKILL.md)** for **Step 4**.

**Otherwise:**

> *Output the next fenced block as a code block:*

```
"{work_unit:(titlecase)}" already exists and is past the discussion phase.

Run /workflow-start to continue from where you left off.
```

**STOP.** Do not proceed — terminal condition.

#### If no conflict

Create the work unit manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init {work_unit} --work-type feature --description "{description}"
```

Where `{description}` is a concise one-line summary compiled from the feature context gathered in Step 1.

→ Return to **[the skill](../SKILL.md)**.
