# Display: Block Scenarios

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Terminal — the discussion record does not support entry: none exist, none are completed, or discussions are still open and the phase waits on the settled record.

Re-run the scoped snapshot — the emission draws from this response, never a carried one:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs view {work_unit}
```

Emit the TITLE section (markdown), then the DISPLAY section verbatim as a code block.

**STOP.** Do not proceed — terminal condition.
