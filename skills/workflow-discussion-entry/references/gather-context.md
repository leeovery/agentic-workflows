# Gather Context

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

Route based on the `source` variable set in earlier steps.

#### If source is `new`

New discussion entry: topic was provided by the caller.

Check research status via manifest:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.research status
```

**If research status is `completed`:**

List the research files via `ls .workflows/{work_unit}/research/*.md`.

> *Output the next fenced block as a code block:*

```
Starting discussion: {topic:(titlecase)}

Research available:
  • .workflows/{work_unit}/research/{filename1}.md
  • .workflows/{work_unit}/research/{filename2}.md

These will be read when the discussion begins.

Anything to add or adjust before we begin, or "go" to proceed:
```

**STOP.** Wait for user response.

Set source="new-with-research".

→ Return to **[the skill](../SKILL.md)**.

**Otherwise:**

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

→ Return to **[the skill](../SKILL.md)**.

#### If source is `research`

→ Load **[gather-context-research.md](gather-context-research.md)** and follow its instructions as written.

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.

#### If source is `fresh`

→ Load **[name-topic.md](name-topic.md)** and follow its instructions as written.

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.

#### If source is `continue`

→ Load **[gather-context-continue.md](gather-context-continue.md)** and follow its instructions as written.

**STOP.** Wait for user response.

→ Return to **[the skill](../SKILL.md)**.
