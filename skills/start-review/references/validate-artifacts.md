# Validate Plan and Implementation

*Reference for **[start-review](../SKILL.md)***

---

Check if plan and implementation exist and are ready.

```bash
ls .workflows/planning/
ls .workflows/implementation/
```

Read `.workflows/planning/{topic}/plan.md` frontmatter.

#### If plan doesn't exist

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{topic:(titlecase)}".

A concluded plan and implementation are required for review.
Run /start-planning {work_type} {topic} to create one.
```

**STOP.** Do not proceed — terminal condition.

Read `.workflows/implementation/{topic}/tracking.md` frontmatter.

#### If implementation tracking doesn't exist

> *Output the next fenced block as a code block:*

```
Implementation Missing

No implementation found for "{topic:(titlecase)}".

A completed implementation is required for review.
Run /start-implementation {work_type} {topic} to start one.
```

**STOP.** Do not proceed — terminal condition.

#### If implementation status is not `completed`

> *Output the next fenced block as a code block:*

```
Implementation Not Complete

The implementation for "{topic:(titlecase)}" is not yet completed.
Run /start-implementation {work_type} {topic} to continue.
```

**STOP.** Do not proceed — terminal condition.

#### If plan and implementation are both ready

→ Return to **[the skill](../SKILL.md)**.
