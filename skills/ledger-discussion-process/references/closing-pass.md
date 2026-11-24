# Closing Pass

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

`checklist show decided {work_unit} {topic}` lists the close's items. Mark each as it holds, `checklist done decided {work_unit} {topic} {item}`, or skip it with its reason, `checklist skip decided {work_unit} {topic} {item} --reason '{reason}'`.

## Waiting for Agents

Fetch `render wait-agents {work_unit}.{topic}`, which draws nothing where no agent of the topic runs.

## The Closing Pass

It has two readers: a fresh agent, unanchored by the conversation, and you, who were in it. The fresh reader reads the log: bring it up to date, then dispatch the reader, brief it, `{agent}` the `id` the dispatch answered, and make the Agent call; do your own reads while it works.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind closing-pass
node .claude/skills/ledger-engine/scripts/engine.cjs brief closing-pass-reader {work_unit} {topic} --agent {agent}
```

Its report is taken in as any report coming back is (the skill's **Tools**). A `product` finding is a line for the close's payload, written nowhere before the person's yes.

Where the pass changed what the topic decides — a question opened, an answer replaced — another pass reads what changed, unasked, once the conversation has closed what it opened. The passes end at one that changes nothing, and `closing-pass` is done.

Your own reads:
- `decisions-entered` — the conversation and the log read against the record: every decision made in the conversation has its entry, and every answer the person gave landed. The brief read against it too: an open question of the brief's that never reached the map goes on it, as does a point it marks as from before, asked with its id from before.
- `conflicts-read` — no two current answers on the topic contradict each other.
- `findings-rerun` — each measured or exploratory finding a decision rests on is run again by its command. A value that has changed is replaced, `--reason was-wrong`, with the new result; each decision relying on it is then confirmed (`ledger hold`) or raised as its replacement (`raise --replaces`).

## The Payload

`product-lines-shown` — the product-record lines and any candidates, for the screen that shows the close: an epic's decided screen, a feature's ready to build. Write them to `.ledger/.cache/{work_unit}/discussion/{topic}/decided-payload.json` — `{"lines": [{"text", "why", "widens"}], "withdraws": [{"line", "why"}], "candidates": [...]}`: each product-record line the closing pass found, `widens` the id of the decision it makes a rule for the whole product, one line to a decision; where a rule of the record should go, its line by id with why, `withdraws` left out where none should; and each candidate, work no topic owns that holds a call the person would make, with its reason.
- **An epic's candidate** is `{"name", "reason", "brief"}`, named as a topic, `brief` the path of its brief's draft under `.ledger/.cache/{work_unit}/discussion/{topic}/`: what the work is, where it was read, why it matters, and its open questions. One matching a waiting roadmap item takes it in, `"from_roadmap": "{item}"`.
- **A single-topic unit's candidate** parks on the roadmap at the yes: `{"name", "reason", "horizon"}`, named as a roadmap item, on the horizon the person named.

Once it is written, mark the item done.

## The Close

Close the checklist: `checklist close decided {work_unit} {topic}`. Then stage the payload. An epic's topic draws the decided screen:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render decided {work_unit}.{topic} --file .ledger/.cache/{work_unit}/discussion/{topic}/decided-payload.json
```

A feature's topic closes into its spec with no gate, what it decided shown with ready to build; stage it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs decided stage {work_unit} {topic} --file .ledger/.cache/{work_unit}/discussion/{topic}/decided-payload.json
```

A line widening a decision the product record already widens is refused, naming that entry: leave the line out of the payload, stage it again, and say in a line that it is in the record already. A yes refused for a product-record line resting on a decision replaced since: where its rule still holds, stage a line widening the replacement, in the same words; where it should go, withdraw the line. Then draw the screen again.

An epic's screen asks a verdict of each call the person changed, one at a time; after each, draw `render decided {work_unit}.{topic} --alone`. A Comment that changes a product-record line changes the payload, staged again with `--file`. One keeping a struck candidate after all undoes its strike, `decided unstrike {work_unit} {topic} {n}`. Once what a refused yes names is fixed, draw the screen again.
