# Handoff: Create With Incorporation

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

```
Specification session for: {Title Case Name}

Source discussions:
- .workflows/{work_unit}/discussion/{discussion-name}.md
- .workflows/{work_unit}/discussion/{discussion-name}.md

Existing specifications to incorporate:
- .workflows/{work_unit}/specification/{source-topic}/specification.md (covers: {discussion-name} discussion)

Output: .workflows/{work_unit}/specification/{topic}/specification.md

Context: This consolidates multiple sources. The existing specification should be incorporated - extract and adapt its content alongside the discussion material. The result should be a unified specification, not a simple merge.

After the specification is complete, mark the incorporated specs as superseded via manifest CLI:

    set {source-work-unit} --phase specification --topic {source-topic} status superseded
    set {source-work-unit} --phase specification --topic {source-topic} superseded_by {work_unit}

---
Invoke the technical-specification skill.
```
