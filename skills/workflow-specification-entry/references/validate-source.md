# Validate Source Material

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Check if source material exists and is ready.

#### If `work_type` is `feature`

Check if discussion exists and is concluded. Read status via manifest CLI: `get {work_unit} --phase discussion --topic {topic} status`.

**If discussion doesn't exist:**

> *Output the next fenced block as a code block:*

```
Source Material Missing

No discussion found for "{work_unit:(titlecase)}".

A concluded discussion is required before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If discussion exists but status is "in-progress":**

> *Output the next fenced block as a code block:*

```
Discussion In Progress

The discussion for "{work_unit:(titlecase)}" is not yet concluded.

The discussion must be concluded before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If discussion exists and status is "concluded":**

→ Return to **[the skill](../SKILL.md)**.

#### If `work_type` is `bugfix`

Check if investigation exists and is concluded. Read status via manifest CLI: `get {work_unit} --phase investigation --topic {topic} status`.

**If investigation doesn't exist:**

> *Output the next fenced block as a code block:*

```
Source Material Missing

No investigation found for "{work_unit:(titlecase)}".

A concluded investigation is required before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If investigation exists but status is "in-progress":**

> *Output the next fenced block as a code block:*

```
Investigation In Progress

The investigation for "{work_unit:(titlecase)}" is not yet concluded.

The investigation must be concluded before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If investigation exists and status is "concluded":**

→ Return to **[the skill](../SKILL.md)**.

#### If `work_type` is `epic`

Check if at least one concluded discussion exists for this work unit. Read discussion phase items via manifest CLI: `get {work_unit} --phase discussion`.

**If no discussions exist:**

> *Output the next fenced block as a code block:*

```
Source Material Missing

No discussions found for "{work_unit:(titlecase)}".

At least one concluded discussion is required before specification can begin.
```

**STOP.** Do not proceed — terminal condition.

**If no concluded discussions exist:**

> *Output the next fenced block as a code block:*

```
No Concluded Discussions

No concluded discussions found for "{work_unit:(titlecase)}".

At least one concluded discussion is required before specification can begin.
Run /continue-epic to continue an in-progress discussion.
```

**STOP.** Do not proceed — terminal condition.

**If at least one concluded discussion exists:**

→ Return to **[the skill](../SKILL.md)**.
