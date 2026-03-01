# Validate Specification

*Reference for **[start-planning](../SKILL.md)***

---

Check if specification exists and is ready.

```bash
ls .workflows/specification/
```

Read `.workflows/specification/{topic}/specification.md` frontmatter.

#### If specification doesn't exist

> *Output the next fenced block as a code block:*

```
Specification Missing

No specification found for "{topic:(titlecase)}".

A concluded specification is required for planning.
Run /start-specification {work_type} {topic} to create one.
```

**STOP.** Do not proceed — terminal condition.

#### If specification exists but status is `in-progress`

> *Output the next fenced block as a code block:*

```
Specification In Progress

The specification for "{topic:(titlecase)}" is not yet concluded.
Run /start-specification {work_type} {topic} to continue.
```

**STOP.** Do not proceed — terminal condition.

#### If specification exists and status is `concluded`

Parse cross-cutting specs from `specifications.crosscutting` in the discovery output.

→ Return to **[the skill](../SKILL.md)**.
