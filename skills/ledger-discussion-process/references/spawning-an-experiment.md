# Spawning an Experiment

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

The laboratory measures what a decision rests on. This conversation states the problem and hands it over: the question's refinement, the prediction, the decision rule and the method are the laboratory's.

## The Offer

Offer it in the conversation, never as a menu: the question a controlled experiment would settle, what a dependable answer takes off the table, and that a measurement here is a fine alternative. A declined offer is that measurement: what it shows is an `exploratory` finding, with its command and result.

## The Spawn

The question it measures is on the map; ask it first where it is not. Write the problem statement to `.ledger/.cache/{work_unit}/discussion/{topic}/problem.md`: the problem in plain terms — what needs picking or learning, the space around it, what is hoped — closing on where it was born, `Spawned from the "{topic}" discussion, at {the point, in a few words}, on {today}.` No design content: no hypothesis, prediction, decision rule or setup.

Record it under a kebab-case slug drawn from the problem:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs experiment create {work_unit} {topic} --slug {slug} --from discussion --problem .ledger/.cache/{work_unit}/discussion/{topic}/problem.md --question {question}
```

A refused create: say why in a line. Otherwise its `id` is the experiment.

## Now or Later

Working it now would leave the topic, so ready it before asking: bring the log up to date, then fetch `render wait-agents {work_unit}.{topic}`. Then fetch the gate:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render experiment-spawn-gate {work_unit}.discussion.{topic} --id {id}
```
