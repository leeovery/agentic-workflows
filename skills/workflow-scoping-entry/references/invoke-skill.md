# Invoke the Skill

*Reference for **[workflow-scoping-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

Read the durable carrier discovery left, to seed the scoping session. It has two halves — read **both**:

1. The manifest `description`:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get {work_unit} description
```

2. The latest discovery session log when one exists (`.workflows/{work_unit}/discovery/session-NNN.md`, highest-numbered) — read its **Exploration** so discovery's shaped context is in hand for scoping-process. A logless quick-fix (e.g. one created before phase-17) has none; scoping-process then gathers from scratch.

Construct the handoff:

```
Scoping session for: {topic}
Work unit: {work_unit}
Description: {description}

Invoke the workflow-scoping-process skill.
```

Invoke the [workflow-scoping-process](../../workflow-scoping-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
