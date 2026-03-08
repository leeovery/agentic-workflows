# Invoke the Skill

*Reference for **[workflow-implementation-entry](../SKILL.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{work_unit}" \
  "skills/technical-implementation/SKILL.md" \
  ".workflows/{work_unit}/implementation/{topic}/implementation.md"
```

After completing the steps above, this skill's purpose is fulfilled.

Invoke the [technical-implementation](../../technical-implementation/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Query format and ext_id from manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} format
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} ext_id
```

Check implementation status:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase implementation --topic {topic} status
```

```
Implementation session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Plan: .workflows/{work_unit}/planning/{topic}/planning.md
Format: {format}
Ext ID: {ext_id} (if applicable)
Specification: .workflows/{work_unit}/specification/{topic}/specification.md (exists: {true|false})
Implementation: {exists | new} (status: {in-progress | not-started | completed})

Dependencies: {All satisfied | List any notes}
Environment: {Setup required | No special setup required}

Invoke the technical-implementation skill.
```
