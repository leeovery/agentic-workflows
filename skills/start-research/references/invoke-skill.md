# Invoke the Skill

*Reference for **[start-research](../SKILL.md)***

---

This skill's purpose is now fulfilled.

Invoke the [technical-research](../../technical-research/SKILL.md) skill for your next instructions. Do not act on the gathered information until the skill is loaded - it contains the instructions for how to proceed.

**If work_type is available** (from Step 1), add the Work type line in the handoff.

**Example handoff:**
```
Research session for: {topic}
Work type: {work_type}
Output: .workflows/{work_unit}/research/exploration.md

Context:
- Prompted by: {problem, opportunity, or curiosity}
- Already knows: {any initial thoughts or research, or "starting fresh"}
- Starting point: {technical feasibility, market, business model, or "open exploration"}
- Constraints: {any constraints mentioned, or "none"}

Invoke the technical-research skill.
```
