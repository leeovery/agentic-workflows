# Closing Pass

*Reference for **[leeway-discussion-process](../SKILL.md)***

---

The closing pass has two readers: a fresh agent, unanchored by the conversation, and you, who were in it. Mark each item as it holds, `checklist done decided {work_unit} {topic} {item}`, or skip it with its reason, `checklist skip decided {work_unit} {topic} {item} --reason "{reason}"`; a skip shows on the decided screen.

## The Fresh Reader

Dispatch it, brief it, then make the Agent call — its `subagent_type` the agent `brief` answers, its prompt the pointer alone. Its brief says whether a gap review has run since the topic's last decision; where none has, the reader runs one too. Do your own reads while it works: the close waits on its report.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind closing-pass
node .claude/skills/leeway-engine/scripts/engine.cjs brief closing-pass-reader {work_unit} {topic} --agent {id}
```

Its findings are taken as a review's are: load **[reviews.md](reviews.md)** and follow its instructions as written, where this conversation has not loaded it already. A `product` finding is a line for the decided screen's payload, written nowhere before the person's yes. Every point the pass finds lands — an entry, a question on the map, a message, later on the roadmap, a candidate or a product-record line — never left in the log as a thread no one owns.

Where the pass changed what the topic decides — a question opened, an answer replaced — another pass reads what changed, unasked, once the conversation has closed what it opened. The passes end at one that changes nothing, and `closing-pass` is done.

## Your Own Reads

- `decisions-entered` — the conversation and the log read against the record: every decision made in the conversation has its entry, and every answer the person gave landed.
- `replacements-checked` — each replacement on the topic holds up against what it replaced, and its why says why.
- `conflicts-read` — no two current answers on the topic contradict each other.
- `findings-rerun` — each measured or exploratory finding a decision rests on is run again by its command. A value that has changed is replaced, `--reason was-wrong`, with the new result; each decision relying on it is then confirmed (`ledger hold`) or replaced — a decision of the person's through `raise --replaces`.
