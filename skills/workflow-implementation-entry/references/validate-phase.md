# Validate Phase

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

Check if plan exists and is ready.

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} status
```

Also verify the plan file exists at `.workflows/{work_unit}/planning/{topic}/planning.md`.

#### If plan doesn't exist

> *Output the next fenced block as a code block:*

```
Plan Missing

No plan found for "{topic:(titlecase)}".

A completed plan is required for implementation.
```

**STOP.** Do not proceed — terminal condition.

#### If plan exists but status is not `completed`

> *Output the next fenced block as a code block:*

```
Plan Not Completed

The plan for "{topic:(titlecase)}" is not yet completed.
```

**STOP.** Do not proceed — terminal condition.

#### If plan exists and status is `completed`

Check implementation's own status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} status
```

**If status is `completed`:**

Reset to in-progress:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase implementation --topic {topic} status in-progress
```

> *Output the next fenced block as a code block:*

```
Reopening implementation: {topic:(titlecase)}
```

→ Return to **[the skill](../SKILL.md)**.

**If status is `in-progress` or not found:**

Proceed normally.

→ Return to **[the skill](../SKILL.md)**.
