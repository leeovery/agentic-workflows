# Invoke the Skill

*Reference for **[workflow-scoping-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

Read the durable carrier discovery left — the manifest `description` and the latest discovery session log (`.workflows/{work_unit}/discovery/session-NNN.md`, highest-numbered, when present) — to seed the scoping session:

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
