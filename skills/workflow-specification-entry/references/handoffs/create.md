# Handoff: Create Specification

*Reference for **[confirm-create.md](../confirm-create.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{work_unit}" \
  "skills/technical-specification/SKILL.md" \
  ".workflows/{work_unit}/specification/{topic}/specification.md"
```

This skill's purpose is now fulfilled. Invoke the [technical-specification](../../../technical-specification/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed.

Determine work_type: use the value from Step 2 if available. Otherwise, read work_type from the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} work_type`).

```
Specification session for: {Title Case Name}
Work type: {work_type}

Sources:
- .workflows/{work_unit}/discussion/{discussion-name}.md
- .workflows/{work_unit}/discussion/{discussion-name}.md

Output: .workflows/{work_unit}/specification/{topic}/specification.md

---
Invoke the technical-specification skill.
```
