# Validate Phase

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Read the specification item's status from the manifest — not the file on disk. A `proposed` grouping has no file yet but is a real item:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.specification.{topic} status
```

#### If the output is empty

The item does not exist. Set verb = "Creating".

→ Return to caller.

#### If the status is `proposed`

The grouping exists as a proposed item; the process skill flips it to in-progress on entry. Set verb = "Creating".

→ Return to caller.

#### If the status is `in-progress`

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.specification.{topic} --verb Resuming
```

Set verb = "Continuing".

→ Return to caller.

#### If the status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} specification {topic}
```

Render and emit the section verbatim:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render phase-note {work_unit}.specification.{topic} --verb Reopening
```

Set verb = "Continuing".

→ Return to caller.

#### If the status is `superseded` or `promoted`

Render the terminal blocker — the engine derives which from the item's status — and emit the section verbatim per its marker:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.specification.{topic} --own
```

**STOP.** Do not proceed — terminal condition.
