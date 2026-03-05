# Topic Name and Conflict Check

*Reference for **[start-bugfix](../SKILL.md)***

---

Based on the bug description, suggest a topic name:

> *Output the next fenced block as a code block:*

```
Suggested topic name: {suggested-topic:(kebabcase)}

This will create: .workflows/{suggested-topic}/investigation/{suggested-topic}.md
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

For bugfix, the topic name and work unit name are the same value.

#### If a work unit with the same name exists

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
A work unit named "{work_unit}" already exists.

- **`r`/`resume`** — Resume the existing investigation
- **`n`/`new`** — Choose a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `resuming`

Check the investigation status via manifest CLI: `get {work_unit} --phase investigation --topic {work_unit} status`

**If in-progress:**

→ Return to **[the skill](../SKILL.md)** for **Step 3**.

**Otherwise:**

> *Output the next fenced block as a code block:*

```
"{work_unit:(titlecase)}" already exists and is past the investigation phase.

Run /workflow-start to continue from where you left off.
```

**STOP.** Do not proceed — terminal condition.

#### If no conflict

Create the work unit manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init {work_unit} --work-type bugfix --description "{description}"
```

Where `{description}` is a concise one-line summary compiled from the bug context gathered in Step 1.

→ Return to **[the skill](../SKILL.md)**.
