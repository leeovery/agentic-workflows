# Invoke the Skill

*Reference for **[workflow-review-entry](../SKILL.md)***

---

Invoke the [workflow-review-process](../../workflow-review-process/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

Query format from manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit} --phase planning --topic {topic} format
```

**Handoff:**
```
Review session
Work unit: {work_unit}

Plans to review:
  - work_unit: {work_unit}
    plan: .workflows/{work_unit}/planning/{topic}/planning.md
    format: {format}
    specification: .workflows/{work_unit}/specification/{topic}/specification.md (exists: {true|false})

Invoke the workflow-review-process skill.
```
