# Validate Source Material

*Reference for **[workflow-specification-entry](../SKILL.md)***

---

Check the source-material prerequisite — the engine derives the verdict from manifest state (work-type-aware: discussions for feature/cross-cutting, the investigation for bugfix, at least one completed discussion for epic):

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.specification.{topic}
```

#### If the response is empty

Source material is ready.

→ Return to caller.

#### If the response carried `DISPLAY: entry blocker`

Emit the section verbatim per its marker.

**STOP.** Do not proceed — terminal condition.
