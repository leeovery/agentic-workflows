# Handoff: Continue Concluded Specification

*Reference for **[confirm-continue.md](../confirm-continue.md)***

---

Before invoking the skill, reset `finding_gate_mode` to `gated` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit} --phase specification --topic {topic} finding_gate_mode gated
```
Commit if changed: `spec({work_unit}): reset gate mode`

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

Continuing existing: .workflows/{work_unit}/specification/{topic}/specification.md (concluded)

New sources to extract:
- .workflows/{work_unit}/discussion/{new-discussion-name}.md

Previously extracted (for reference):
- .workflows/{work_unit}/discussion/{existing-discussion-name}.md

Context: This specification was previously concluded. New source discussions have been identified. Extract and incorporate their content while maintaining consistency with the existing specification.

---
Invoke the technical-specification skill.
```
