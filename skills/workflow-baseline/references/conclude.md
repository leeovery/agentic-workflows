# Conclude

*Reference for **[workflow-baseline](../SKILL.md)***

---

Every area is documented. Close the assessment.

Mark it and commit:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest set project.baseline.status completed
node .claude/skills/workflow-engine/scripts/engine.cjs commit --workflows -m "baseline: complete the assessment"
```

Fetch the completion receipt and emit its `DISPLAY: baseline receipt` section:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render baseline-receipt
```

> *Output the next fenced block as markdown (not a code block):*

```
> The docs are reference, not record — they inform later phases without deciding for them. Open questions stay open until a discussion settles them properly, and the baseline is expandable any time from the workflow-start manage menu.
```

**STOP.** Do not proceed — terminal condition.
