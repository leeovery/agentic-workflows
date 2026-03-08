# Handoff: Unify All

*Reference for **[confirm-unify.md](../confirm-unify.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "unified" \
  "skills/technical-specification/SKILL.md" \
  ".workflows/{work_unit}/specification/unified/specification.md"
```

This skill's purpose is now fulfilled. Invoke the [technical-specification](../../../technical-specification/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed.

```
Specification session for: Unified

Sources:
- .workflows/{work_unit}/discussion/{discussion-name}.md
- .workflows/{work_unit}/discussion/{discussion-name}.md
...

Output: .workflows/{work_unit}/specification/unified/specification.md

---
Invoke the technical-specification skill.
```
