# Conclude Research

*Reference for **[workflow-research-process](../SKILL.md)***

---

1. Set research status to completed:
   ```bash
   node .claude/skills/workflow-manifest/scripts/manifest.js set {work_unit}.research.{topic} status completed
   ```
2. Final commit: `research({work_unit}): complete {topic} research`
3. Invoke the `/workflow-bridge` skill:
   ```
   Pipeline bridge for: {work_unit}
   Completed phase: research

   Invoke the workflow-bridge skill to enter plan mode with continuation instructions.
   ```

**STOP.** Do not proceed — terminal condition.
