# Invoke the Skill

*Reference for **[workflow-scoping-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

Read the description from manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} description
```

```
Scoping session for: {topic}
Work unit: {work_unit}
Description: {description}

Invoke the workflow-scoping-process skill.
```

Invoke the [workflow-scoping-process](../../workflow-scoping-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
