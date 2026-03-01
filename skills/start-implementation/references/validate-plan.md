# Validate Plan

*Reference for **[start-implementation](../SKILL.md)***

---

Check if plan exists and is ready.

```bash
ls .workflows/planning/
```

Read `.workflows/planning/{topic}/plan.md` frontmatter.

#### If plan doesn't exist

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{topic:(titlecase)}".

A concluded plan is required for implementation.
Run /start-planning {work_type} {topic} to create one.
```

**STOP.** Do not proceed — terminal condition.

#### If plan exists but status is not `concluded`

> *Output the next fenced block as a code block:*

```
Plan Not Concluded

The plan for "{topic:(titlecase)}" is not yet concluded.
Run /start-planning {work_type} {topic} to continue.
```

**STOP.** Do not proceed — terminal condition.

#### If plan exists and status is `concluded`

→ Return to **[the skill](../SKILL.md)**.
