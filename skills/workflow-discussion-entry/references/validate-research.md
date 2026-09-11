# Validate Research

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Check the research prerequisite — the engine derives the verdict from the topic's research item, whether or not a discussion item exists:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs render entry-gate {work_unit}.discussion.{topic}
```

#### If the response is empty

No research is outstanding on the topic — clear to discuss.

→ Return to caller.

#### If the response carried `DISPLAY: entry blocker`

Emit both sections verbatim per their markers — the red blocker line, then its guidance.

**STOP.** Do not proceed — terminal condition.
