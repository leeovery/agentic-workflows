# Validate Specification

*Reference for **[workflow-planning-entry](../SKILL.md)***

---

Check the specification prerequisite — the engine derives the verdict from manifest state:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.planning.{topic}
```

#### If the response is empty

The specification is completed — clear to plan.

→ Return to caller.

#### If the response carried `DISPLAY: entry blocker`

Emit both sections verbatim per their markers — the red blocker line, then its guidance.

**STOP.** Do not proceed — terminal condition.
