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

> *Output the next fenced block as a code block:*

```
Resuming specification: {work_unit:(titlecase)}
```

Set verb = "Continuing".

→ Return to caller.

#### If the status is `completed`

Reopen it:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs topic reopen {work_unit} specification {topic}
```

> *Output the next fenced block as a code block:*

```
Reopening specification: {work_unit:(titlecase)}
```

Set verb = "Continuing".

→ Return to caller.

#### If the status is `superseded`

> *Output the next fenced block as a code block:*

```
Specification Superseded

The specification for "{topic:(titlecase)}" was consolidated into
"{superseded_by:(titlecase)}". Work on that specification instead.
```

**STOP.** Do not proceed — terminal condition.

#### If the status is `promoted`

> *Output the next fenced block as a code block:*

```
Specification Promoted

"{topic:(titlecase)}" was promoted to the cross-cutting work unit
"{promoted_to}". Continue it from that work unit.
```

**STOP.** Do not proceed — terminal condition.
