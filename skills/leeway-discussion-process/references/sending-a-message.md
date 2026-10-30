# Sending a Message

*Reference for **[leeway-discussion-process](../SKILL.md)***

---

A point another topic owns goes to it as a message, and that topic's session decides it in its own frame. Never visit the target: its record and log stay out of this conversation, and no agent carries the message.

- **Only between topics.** A single-topic unit has no other topic: the point goes aside through the skill's **Backlogging**, or, where the work has outgrown one topic, load **[pivot-to-epic.md](../../leeway-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}` first.
- **A topic on the map.** Name the target as the map names it, never a part of one. Work no topic owns is no message: it is a candidate for the decided screen.
- **One ask.** What this topic found, the reasoning, and what the target is asked to decide. A change to a decision the target owns is asked for, never written here.
- **A question that moves.** A question on this topic's map moves first, `ledger move {work_unit}.discussion.{topic} --question {id} --to {target}`; the message carries it.

Write the message to `.leeway/.cache/{work_unit}/discussion/{topic}/message-{slug}.md`, its first line the title, and send it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic send {work_unit} {target} --from {topic} --content .leeway/.cache/{work_unit}/discussion/{topic}/message-{slug}.md --slug {slug}
```

Draw the report from the path the send answered, its `message_path`, or its `inbox_path` where the target is cancelled, and emit its DISPLAY section verbatim per its marker:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render send-report {work_unit}.{target} --sent {path}
```
