# Display: Block Scenarios

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Terminal — the discussion record does not support entry: none exist, none are completed, or discussions are still open and the phase waits on the settled record.

Render the scoped snapshot:

```bash
node .claude/skills/workflow-specification-entry/scripts/gateway.cjs view {work_unit}
```

Emit the TITLE section, then the DISPLAY section, each verbatim per its marker.

**STOP.** Do not proceed — terminal condition.
