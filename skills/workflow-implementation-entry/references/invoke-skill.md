# Invoke the Skill

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

Query format and external_id from manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} format
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning.{topic} external_id
```

Check implementation state:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.implementation.{topic}
```

#### If implementation does not exist (`false`)

Set `status` = `not-started`.

#### If implementation exists (`true`)

Check status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.implementation.{topic} status
```

```
Implementation session for: {topic}
Work unit: {work_unit}

Format: {format}
External ID: {external_id} (if applicable)
Specification: .workflows/{work_unit}/specification/{topic}/specification.md (exists: {true|false})
Implementation: {exists | new} (status: {in-progress | not-started | completed})

Dependencies: {All satisfied | List any notes}
Environment: {Setup required | No special setup required}

Invoke the workflow-implementation-process skill.
```

Invoke the [workflow-implementation-process](../../workflow-implementation-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
