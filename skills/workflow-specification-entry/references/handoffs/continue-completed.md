# Handoff: Continue Completed Specification

*Reference for **[confirm-continue.md](../confirm-continue.md)***

---

Before invoking the skill, reset `finding_gate_mode` to `gated` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs set {work_unit}.specification.{topic} finding_gate_mode gated
```
Commit if changed: `spec({work_unit}): reset gate mode`

This skill's purpose is now fulfilled. Invoke the [workflow-specification-process](../../../workflow-specification-process/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed.

```
Specification session for: {Title Case Name}

Continuing existing: .workflows/{work_unit}/specification/{topic}/specification.md [completed]

New sources to extract:
- .workflows/{work_unit}/discussion/{new-discussion-name}.md

Previously extracted (for reference):
- .workflows/{work_unit}/discussion/{existing-discussion-name}.md

Context: This specification was previously completed. New source discussions have been identified. Extract and incorporate their content while maintaining consistency with the existing specification.

---
Invoke the workflow-specification-process skill.
```
