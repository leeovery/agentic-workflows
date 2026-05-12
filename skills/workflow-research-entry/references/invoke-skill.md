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

Imports tracked in manifest.imports[] and indexed into the
knowledge base — relevant chunks will surface via the
session-start contextual query. Starting Point stays empty.

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
- Starting point: {technical feasibility, market, business model, or general direction}
- Constraints: {any constraints mentioned, or "none"}

Invoke the workflow-research-process skill.
```

Invoke the [workflow-research-process](../../workflow-research-process/SKILL.md) skill. Do not act on the gathered information until the skill is loaded — it contains the instructions for how to proceed. Terminal.
