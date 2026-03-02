# Handoff: Continue Specification

*Reference for **[confirm-continue.md](../confirm-continue.md)** and **[confirm-refine.md](../confirm-refine.md)***

---

Before invoking the skill, reset `finding_gate_mode` to `gated` via manifest CLI:
```bash
node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.phases.specification.finding_gate_mode gated
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
  ".workflows/{work_unit}/specification/specification.md"
```

This skill's purpose is now fulfilled. Invoke the [technical-specification](../../../technical-specification/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed.

Determine work_type: use the value from Step 2 if available. Otherwise, read work_type from the manifest (`node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.work_type`).

```
Specification session for: {Title Case Name}
Work type: {work_type}

Continuing existing: .workflows/{work_unit}/specification/specification.md

Sources for reference:
- .workflows/{work_unit}/discussion/{discussion-name}.md
- .workflows/{work_unit}/discussion/{discussion-name}.md

Context: This specification already exists. Review and refine it based on the source discussions.

---
Invoke the technical-specification skill.
```
