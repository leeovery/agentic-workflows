# Check Existing Specification

*Reference for **[start-specification](../SKILL.md)***

---

Check if a specification already exists for this topic.

Read `.workflows/specification/{topic}/specification.md` if it exists.

#### If specification doesn't exist

→ Return to **[the skill](../SKILL.md)** with verb="Creating".

#### If specification exists with status `in-progress`

> *Output the next fenced block as a code block:*

```
Specification In Progress

A specification for "{topic:(titlecase)}" already exists and is in progress.
```

> *Output the next fenced block as markdown (not a code block):*

```
· · · · · · · · · · · ·
- **`r`/`resume`** — Resume the existing specification
- **`s`/`start-fresh`** — Archive and start fresh
· · · · · · · · · · · ·
```

**STOP.** Wait for user response.

#### If `resume`

→ Return to **[the skill](../SKILL.md)** with verb="Continuing".

#### If `start-fresh`

Archive the existing spec.

→ Return to **[the skill](../SKILL.md)** with verb="Creating".

#### If specification exists with status `concluded`

> *Output the next fenced block as a code block:*

```
Specification Concluded

The specification for "{topic:(titlecase)}" has already concluded.
Run /start-planning {work_type} {topic} to continue to planning.
```

**STOP.** Do not proceed — terminal condition.
