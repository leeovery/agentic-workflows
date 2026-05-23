# Gather Context

*Reference for **[workflow-discussion-entry](../SKILL.md)***

---

## A. Route on Source

Route based on the `source` variable set in earlier steps.

#### If source is `topic-provided`

New discussion entry: topic was provided by the caller.

→ Proceed to **B. Check Research Status**.

#### If source is `fresh`

The user named the topic in Step 1's no-topic-epic prompt; Step 2 confirmed no existing discussion for it.

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

→ Return to caller.

#### If source is `continue`

→ Load **[gather-context-continue.md](gather-context-continue.md)** and follow its instructions as written.

→ Return to caller.

---

## B. Check Research Status

Read research item statuses for this work unit:

```bash
node .claude/skills/workflow-manifest/scripts/manifest.cjs get '{work_unit}.research.*' status
```

#### If output is empty (no research items)

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

→ Return to caller.

#### If any research item has status `completed`

List the research files via `ls .workflows/{work_unit}/research/*.md`.

> *Output the next fenced block as a code block:*

```
Starting discussion: {topic:(titlecase)}

Research available:
  • .workflows/{work_unit}/research/{filename1}.md
  • .workflows/{work_unit}/research/{filename2}.md

These will be read when the discussion begins.
```

Set source="topic-provided-with-research".

→ Return to caller.

#### Otherwise

→ Load **[gather-context-fresh.md](gather-context-fresh.md)** and follow its instructions as written.

→ Return to caller.
