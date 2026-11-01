# The Sweep

*Reference for **[leeway-specification-process](../SKILL.md)***

---

One read across every topic's records, before the spec is written, for what falls between the topics. Brief the sweep, then make the Agent call — its `subagent_type` the agent `brief` answers, its prompt the pointer alone — and wait for its report:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief sweep {work_unit}
```

Then take the report in:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs sweep take {work_unit}
```

A refused take is the agent's to answer: brief it again — the fresh brief carries the refusal — and call it again. The take sends each of the sweep's messages to its topic and stages each candidate, and neither reaches a screen. Where its `reopened` names topics, say in a line that the sweep's messages reopened them, each waiting in its topic for the person. Then follow its `next`:
- **Approve the map**, drawn with the candidates: emit its sections verbatim per their markers. The answer goes to `gate`; follow its `next`, and then the `next` of what it ran — the yes's is the epic's menu where a topic is no longer decided, else the spec carrying on.
- **The epic's menu**, where a message reopened a topic: the spec waits until it is decided again.
- **Carry on**, nothing found: the spec is written next.

Keep shaping takes the person's word back into the conversation. A candidate they would not take is struck. A change to the map itself — a topic added, or the order — is staged as the map, every live topic in its order, with `render approve-map {work_unit} --file .leeway/.cache/{work_unit}/specification/approve-map-payload.json`, which carries the sweep's candidates and their strikes over; a refusal names what to fix.
