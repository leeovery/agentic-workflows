# Validate Phase

*Reference for **[workflow-scoping-entry](../SKILL.md)***

---

Check if scoping entry exists and determine entry state.

## A. Scoping Check

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.scoping.{topic} status
```

#### If output is empty (scoping doesn't exist)

Proceed normally (new entry).

→ Return to caller.

#### If status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} scoping {topic}
```

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.scoping.{topic} --verb Reopening
```

→ Return to caller.

#### If status is `in-progress`

Proceed normally.

→ Return to caller.
