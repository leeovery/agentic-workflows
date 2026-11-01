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

A refused take is the agent's to answer: brief it again — the fresh brief carries the refusal — and call it again. A refused brief names the way on: take it. The take sends each of the sweep's messages to its topic and stages each candidate, and neither reaches a screen. Where its `reopened` names topics, say in a line that the sweep's messages reopened them, each waiting in its topic for the person. Then follow its `next`:
- **Approve the map**, with the candidates: **Approve the Map**.
- **The epic's menu**, where a message reopened a topic: the spec waits until it is decided again.
- **Carry on**, nothing found: the spec is written next.

## Approve the Map

The sweep's candidates wait on the person until approve the map answers them, and the spec waits with them. Draw it with the call you hold — the take's `next`, or the entry's `approve the map` call, which reads back a map Keep shaping staged — emitting its sections verbatim per their markers. The answer goes to `gate`; follow its `next`, and then the `next` of what it ran — the yes's is the epic's menu where a topic is no longer decided, else the spec carrying on.

Keep shaping takes the person's word back into the conversation. A candidate they would not take is struck. A change to the map itself — a topic added, or the order — is staged as the map is in discovery, the sweep's candidates and their strikes carried over: load **[approving-the-map.md](../../leeway-discovery/references/approving-the-map.md)** and follow its instructions as written, from **The Topics**, with home = `{work_unit}`. A change to a topic already on the map is made as discovery makes it: load **[changing-the-map.md](../../leeway-discovery/references/changing-the-map.md)** and follow its instructions as written, with home = `{work_unit}`.

The spec keeps no log, so here those references differ:
- **A brief** cites the records it draws on in place of the log's links: each entry by its short id, and each topic's log by its path from the state root.
- **A park's `sources`** are the topics' logs it draws on, by their paths from the state root.
- **A message to a started topic** — a brief's rewrite once its topic has started, or a decided topic reopened — goes from the spec. Write it to `.leeway/.cache/{work_unit}/specification/message-{slug}.md`, its first line the title, and send it; then draw its report from the path the send answered, its `message_path`, or its `inbox_path` where the topic is cancelled, and emit its DISPLAY section verbatim per its marker:

  ```bash
  node .claude/skills/leeway-engine/scripts/engine.cjs topic send {work_unit} {topic} --from {work_unit}.specification --content .leeway/.cache/{work_unit}/specification/message-{slug}.md --slug {slug}
  node .claude/skills/leeway-engine/scripts/engine.cjs render send-report {work_unit}.{topic} --sent {path}
  ```
