# Validate Phase

*Reference for **[workflow-review-entry](../SKILL.md)***

---

Check if plan and implementation exist and are ready.

## A. Prerequisite Gate

The engine derives the verdict from manifest state:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.review.{topic}
```

#### If the response carried `DISPLAY: entry blocker`

Emit the section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.

#### If the response is empty

Plan and implementation are completed.

→ Proceed to **C. Review State**.

## C. Review State

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.review.{topic} status
```

#### If output is empty (review does not exist)

→ Return to caller.

#### If status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} review {topic}
```

→ Return to caller.

#### If status is `in-progress`

→ Return to caller.
