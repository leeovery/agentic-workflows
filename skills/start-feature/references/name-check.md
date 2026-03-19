# Feature Name and Conflict Check

*Reference for **[start-feature](../SKILL.md)***

---

## A. Name Suggestion

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

Run /continue-feature to resume, or choose a different name.
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
node .claude/skills/workflow-manifest/scripts/manifest.js init {work_unit} --work-type feature --description "{description}"
```

Where `{description}` is a concise one-line summary compiled from the feature context gathered in Step 1.

**If this work unit was started from an inbox file**, archive it:

```bash
mkdir -p .workflows/inbox/.archived/ideas
mv .workflows/inbox/ideas/{file} .workflows/inbox/.archived/ideas/{file}
```

→ Return to caller.
