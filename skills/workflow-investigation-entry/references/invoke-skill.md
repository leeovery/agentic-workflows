# Invoke the Skill

*Reference for **[workflow-investigation-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill. The handoff carries session identity only — the durable carrier (manifest `description` + session log) is read by the processing skill at initialisation, never added to the handoff.

---

## Handoff

#### If source is `new`

Invoke the **workflow-investigation-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Investigation session for: {work_unit}

Output: .workflows/{work_unit}/investigation/{topic}.md
```

#### If source is `continue`

Invoke the **workflow-investigation-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Investigation session for: {work_unit}

Source: existing investigation
Output: .workflows/{work_unit}/investigation/{topic}.md
```
