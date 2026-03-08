# Invoke the Skill

*Reference for **[workflow-research-entry](../SKILL.md)***

---

This skill's purpose is now fulfilled.

Invoke the [technical-research](../../technical-research/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

---

## Handoff

Construct the handoff. Work type is always available (callers always provide it).

#### If source is `continue`

```
Research session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Source: existing research
Output: .workflows/{work_unit}/research/exploration.md

Invoke the technical-research skill.
```

#### Otherwise

```
Research session for: {topic}
Work unit: {work_unit}
Work type: {work_type}
Output: .workflows/{work_unit}/research/exploration.md

Context:
- Prompted by: {problem, opportunity, or curiosity}
- Already knows: {any initial thoughts or research, or "starting fresh"}
- Starting point: {technical feasibility, market, business model, or "open exploration"}
- Constraints: {any constraints mentioned, or "none"}

Invoke the technical-research skill.
```
