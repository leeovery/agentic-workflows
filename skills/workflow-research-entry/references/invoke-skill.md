# Invoke the Skill

*Reference for **[workflow-research-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled.

Invoke the [workflow-research-process](../../workflow-research-process/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff.

#### If source is `continue`

```
Research session for: {topic}
Work unit: {work_unit}

Source: existing research
Output: .workflows/{work_unit}/research/{resolved_filename}

Invoke the workflow-research-process skill.
```

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
