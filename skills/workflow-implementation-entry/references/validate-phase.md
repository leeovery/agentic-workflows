# Validate Phase

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

Check if plan exists and is ready.

## A. Plan Check

The engine derives the verdict from manifest state:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.implementation.{topic}
```

#### If the response carried `DISPLAY: entry blocker`

Emit the section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.

#### If the response is empty

The plan is completed.

→ Proceed to **B. Implementation Check**.

## B. Implementation Check

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.implementation.{topic} status
```

#### If output is empty (implementation does not exist)

Proceed normally (new entry).

→ Return to caller.

#### If status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} implementation {topic}
```

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.implementation.{topic} --verb Reopening
```

→ Return to caller.

#### If status is `in-progress`

Proceed normally.

→ Return to caller.
