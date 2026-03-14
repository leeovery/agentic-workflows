# Validate Source Material

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Check if source material exists and is ready.

#### If `work_type` is `feature`

Check if discussion exists and is completed. Read status via manifest CLI: `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.discussion.{topic} status`.

**If discussion doesn't exist:**

> *Output the next fenced block as a code block:*

```
Source Material Missing

No discussion found for "{work_unit:(titlecase)}".

A completed discussion is required before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If discussion exists but status is "in-progress":**

> *Output the next fenced block as a code block:*

```
Discussion In Progress

The discussion for "{work_unit:(titlecase)}" is not yet completed.

The discussion must be completed before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If discussion exists and status is "completed":**

→ Return to **[the skill](../SKILL.md)**.

#### If `work_type` is `bugfix`

Check if investigation exists and is completed. Read status via manifest CLI: `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.investigation.{topic} status`.

**If investigation doesn't exist:**

> *Output the next fenced block as a code block:*

```
Source Material Missing

No investigation found for "{work_unit:(titlecase)}".

A completed investigation is required before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If investigation exists but status is "in-progress":**

> *Output the next fenced block as a code block:*

```
Investigation In Progress

The investigation for "{work_unit:(titlecase)}" is not yet completed.

The investigation must be completed before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If investigation exists and status is "completed":**

→ Return to **[the skill](../SKILL.md)**.

#### If `work_type` is `epic`

Check if at least one completed discussion exists for this work unit. Read discussion phase items via manifest CLI: `node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.discussion`.

**If no discussions exist:**

> *Output the next fenced block as a code block:*

```
Source Material Missing

No discussions found for "{work_unit:(titlecase)}".

At least one completed discussion is required before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If no completed discussions exist:**

> *Output the next fenced block as a code block:*

```
No Completed Discussions

No completed discussions found for "{work_unit:(titlecase)}".

At least one completed discussion is required before specification can begin.
Run /continue-epic to continue an in-progress discussion.
```

**STOP.** Do not proceed — terminal condition.

**If at least one completed discussion exists:**

→ Return to **[the skill](../SKILL.md)**.
