# Epic Name and Conflict Check

*Reference for **[start-epic](../SKILL.md)***

---

Based on the epic description, suggest a name. Once confirmed, this becomes `{work_unit}` for all subsequent references.

> *Output the next fenced block as a code block:*

```
Suggested epic name: {work_unit:(kebabcase)}
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
ls .workflows/
```

#### If a work unit with the same name exists

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
An epic named "{work_unit}" already exists.

- **`r`/`resume`** — Resume the existing epic
- **`n`/`new`** — Choose a different name
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `resuming`

Check the manifest for current phase status. Determine which phase to resume:

**If research is `in-progress`:**

Set phase="research".

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

**If discussion is `in-progress`:**

Set phase="discussion".

→ Return to **[the skill](../SKILL.md)** for **Step 5**.

**Otherwise:**

The epic exists but is past the initial phases. Direct to workflow-start for continuation.

> *Output the next fenced block as a code block:*

```
"{work_unit:(titlecase)}" already exists and is past the initial phases.

Run /workflow-start to continue from where you left off.
```

**STOP.** Do not proceed — terminal condition.

#### If no conflict

→ Return to **[the skill](../SKILL.md)**.
