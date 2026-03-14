# Invoke the Skill

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled.

Invoke the [workflow-planning-process](../../workflow-planning-process/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff based on the plan state.

#### If creating fresh plan (no existing plan)

Query the manifest for any existing plan format preference:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.planning format
```

```
Planning session for: {topic}
Work unit: {work_unit}

Specification: .workflows/{work_unit}/specification/{topic}/specification.md
Additional context: {summary of user's additional context, or "none"}
Cross-cutting references: {list of applicable cross-cutting specs with brief summaries, or "none"}
Recommended output format: {format from manifest if found, otherwise "none"}

Invoke the workflow-planning-process skill.
```

#### If continuing or reviewing existing plan

```
Planning session for: {topic}
Work unit: {work_unit}

Specification: .workflows/{work_unit}/specification/{topic}/specification.md
Existing plan: .workflows/{work_unit}/planning/{topic}/planning.md

Invoke the workflow-planning-process skill.
```
