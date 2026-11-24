# Sending a Message

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

A point another topic owns goes to it as a message, and that topic's session decides it in its own frame. Never visit the target: its record and log stay out of this conversation, and no agent carries the message.

- **A unit just pivoted to an epic** first adds the point to the map as a new topic, `{new_topic}`, its brief drafted at `.ledger/.cache/{work_unit}/discussion/{topic}/brief-{new_topic}.md`, holding what the point is, where it came up, why it matters, and its open questions, then sends the message to it:

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs topic add {work_unit} {new_topic} --summary '{summary}' --brief .ledger/.cache/{work_unit}/discussion/{topic}/brief-{new_topic}.md
  ```

  The conversation carries on in this topic.
- **A topic on the map.** Name the target as the map names it, never a part of one.
- **One ask.** What this topic found, the reasoning, and what the target is asked to decide. A change to a decision the target owns is asked for, never written here.
- **A question that moves.** A question on this topic's map the target is to decide goes with the message, which names it, and moves once the message is sent.

Write the message to `.ledger/.cache/{work_unit}/discussion/{topic}/message-{slug}.md`, its first line the title, and send it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs topic send {work_unit} {target} --from {topic} --content .ledger/.cache/{work_unit}/discussion/{topic}/message-{slug}.md --slug {slug}
```

Once it is sent, move each question the message names to the target, `{"by", "who_moved_whom": "none"}` on stdin:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger move {place} --question {id} --to {target}
```

Draw the report from the path the send answered, its `message_path`, or its `inbox_path` where the target is cancelled:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render send-report {work_unit}.{target} --sent '{path}'
```
