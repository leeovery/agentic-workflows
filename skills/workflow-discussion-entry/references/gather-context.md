# Gather Context

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

## A. Route on Source

Route based on the `source` variable set in earlier steps.

#### If source is `topic-provided`

New discussion entry: topic was provided by the caller.

→ Proceed to **B. Check Research**.

#### If source is `research`

→ Load **[gather-context-research.md](gather-context-research.md)** and follow its instructions as written.

→ Return to **[the skill](../SKILL.md)**.

#### If source is `fresh`

→ Load **[name-topic.md](name-topic.md)** and follow its instructions as written.

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

→ Return to **[the skill](../SKILL.md)**.

#### If source is `continue`

→ Load **[gather-context-continue.md](gather-context-continue.md)** and follow its instructions as written.

→ Return to **[the skill](../SKILL.md)**.

---

## B. Check Research

Check if any research items exist for this work unit:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js exists {work_unit}.research.*
```

**If exists (`true`):**

→ Proceed to **C. Check Research Status**.

**If not exists (`false`):**

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

→ Return to **[the skill](../SKILL.md)**.

---

## C. Check Research Status

```bash
node .claude/skills/workflow-manifest/scripts/manifest.js get {work_unit}.research.* status
```

**If any research item has status `completed`:**

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

Set source="topic-provided-with-research".

→ Return to **[the skill](../SKILL.md)**.

**Otherwise:**

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

→ Return to **[the skill](../SKILL.md)**.
