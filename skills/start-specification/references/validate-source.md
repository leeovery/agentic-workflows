# Validate Source Material

*Reference for **[start-specification](../SKILL.md)***

---

Check if source material exists and is ready.

#### If `work_type` is `feature`

Check if discussion exists and is concluded:

```bash
ls .workflows/discussion/
```

Read `.workflows/discussion/{topic}.md` frontmatter.

**If discussion doesn't exist:**

> *Output the next fenced block as a code block:*

```
Source Material Missing

No discussion found for "{topic:(titlecase)}".

A concluded discussion is required before specification.
Run /start-discussion feature {topic} to start one.
```

**STOP.** Do not proceed — terminal condition.

**If discussion exists but status is "in-progress":**

> *Output the next fenced block as a code block:*

```
Discussion In Progress

The discussion for "{topic:(titlecase)}" is not yet concluded.
Run /start-discussion feature {topic} to continue.
```

**STOP.** Do not proceed — terminal condition.

**If discussion exists and status is "concluded":**

→ Return to **[the skill](../SKILL.md)**.

#### If `work_type` is `bugfix`

Check if investigation exists and is concluded:

```bash
ls .workflows/investigation/
```

Read `.workflows/investigation/{topic}/investigation.md` frontmatter.

**If investigation doesn't exist:**

> *Output the next fenced block as a code block:*

```
Source Material Missing

No investigation found for "{topic:(titlecase)}".

A concluded investigation is required before specification.
Run /start-investigation bugfix {topic} to start one.
```

**STOP.** Do not proceed — terminal condition.

**If investigation exists but status is "in-progress":**

> *Output the next fenced block as a code block:*

```
Investigation In Progress

The investigation for "{topic:(titlecase)}" is not yet concluded.
Run /start-investigation bugfix {topic} to continue.
```

**STOP.** Do not proceed — terminal condition.

**If investigation exists and status is "concluded":**

→ Return to **[the skill](../SKILL.md)**.
