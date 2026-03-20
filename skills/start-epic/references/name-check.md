# Epic Name and Conflict Check

*Reference for **[start-epic](../SKILL.md)***

---

## A. Name Suggestion

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

→ Proceed to **B. Conflict Check**.

## B. Conflict Check

Check for naming conflicts:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}
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

→ Return to **A. Name Suggestion**.

#### If no conflict

Create the work unit manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js init {work_unit} --work-type epic --description "{description}"
```

Where `{description}` is a concise one-line summary compiled from the epic context gathered in Step 1.

**If this work unit was started from an inbox file**, archive it:

```bash
mkdir -p .workflows/.inbox/.archived/ideas
mv .workflows/.inbox/ideas/{file} .workflows/.inbox/.archived/ideas/{file}
```

→ Return to caller.
