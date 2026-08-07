# Gather Context

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Route based on the `source` variable set in earlier steps.

#### If source is `continue`

→ Load **[gather-context-continue.md](gather-context-continue.md)** and follow its instructions as written.

→ Return to caller.

#### Otherwise

Completed research can stand in for gathered context. Read the topic's research status:

```bash
node .claude/skills/workflow-engine/scripts/engine.cjs manifest get {work_unit}.research.{topic} status
```

**If the status is `completed`:**

Nothing to gather — the processing skill reads the research at initialisation.

→ Return to caller.

**Otherwise:**

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

→ Return to caller.
