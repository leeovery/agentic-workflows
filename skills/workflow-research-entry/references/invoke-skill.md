# Invoke the Skill

*Reference for **[workflow-research-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill.

---

## Handoff

#### If source is `continue`

```
Research session for: {topic}
Work unit: {work_unit}

Source: existing research
Output: .workflows/{work_unit}/research/{resolved_filename}

Invoke the workflow-research-process skill.
```

Invoke the [workflow-research-process](../../workflow-research-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### If source is `import`

```
Research session for: {topic}
Work unit: {work_unit}

Source: import
Output: .workflows/{work_unit}/research/{resolved_filename}

Import files:
  • {path_1}
  • {path_2}
  • ...

Invoke the workflow-research-process skill.
```

Invoke the [workflow-research-process](../../workflow-research-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.

#### Otherwise

```
Research session for: {topic}
Work unit: {work_unit}

Output: .workflows/{work_unit}/research/{resolved_filename}

Context:
- Prompted by: {problem, opportunity, or curiosity}
- Already knows: {any initial thoughts or research, or "starting fresh"}
- Starting point: {technical feasibility, market, business model, or "open exploration"}
- Constraints: {any constraints mentioned, or "none"}

Invoke the workflow-research-process skill.
```

Invoke the [workflow-research-process](../../workflow-research-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
