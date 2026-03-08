# Invoke the Skill

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Before invoking the processing skill, save a session bookmark.

> *Output the next fenced block as a code block:*

```
Saving session state so Claude can pick up where it left off if the conversation is compacted.
```

```bash
.claude/hooks/workflows/write-session-state.sh \
  "{work_unit}" \
  "skills/technical-planning/SKILL.md" \
  ".workflows/{work_unit}/planning/{topic}/planning.md"
```

This skill's purpose is now fulfilled.

Invoke the [technical-planning](../../technical-planning/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff based on the plan state. Work type is always available.

#### If creating fresh plan (no existing plan)

Query the manifest for any existing plan format preference:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning format
```

```
Planning session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Specification: .workflows/{work_unit}/specification/{topic}/specification.md
Additional context: {summary of user's additional context, or "none"}
Cross-cutting references: {list of applicable cross-cutting specs with brief summaries, or "none"}
Recommended output format: {format from manifest if found, otherwise "none"}

Invoke the technical-planning skill.
```

#### If continuing or reviewing existing plan

```
Planning session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Specification: .workflows/{work_unit}/specification/{topic}/specification.md
Existing plan: .workflows/{work_unit}/planning/{topic}/planning.md

Invoke the technical-planning skill.
```
