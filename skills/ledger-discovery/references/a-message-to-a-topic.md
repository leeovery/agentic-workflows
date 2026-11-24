# A Message to a Topic

*Reference for **[ledger-discovery](../SKILL.md)***

---

A started topic's brief is never rewritten: what bears on it reaches it as a message, decided there in its own frame, and a message carrying why is also how a decided topic is reopened. One message is one ask: what was found, the reasoning, and what the topic is asked to decide, a point from before named by its id.

Write it to `.ledger/.cache/{home}/discovery/{home}/message-{slug}.md`, its first line the title, then send it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs topic send {home} {topic} --from {home}.discovery --content .ledger/.cache/{home}/discovery/{home}/message-{slug}.md --slug {slug}
```

Draw its report from the path the send answered — its `message_path`, or its `inbox_path` where the topic is cancelled or removed:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render send-report {home}.{topic} --sent '{path}'
```
