# Experiments

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

The laboratory measures what a decision rests on. This conversation states the problem and hands it over: the question's refinement, the prediction, the decision rule and the method are the laboratory's.

## The Offer

Offer it in the conversation, never as a menu. Declined, a measurement here stands in for it: what it shows is an `exploratory` finding, with its command and result.

## The Spawn

The question it measures is on the map; ask it first where it is not. Write the problem statement to `.ledger/.cache/{work_unit}/discussion/{topic}/problem.md`: the problem in plain terms — what needs picking or learning, the space around it, what is hoped — closing on where it was born, `Spawned from the "{topic}" discussion, at {the point, in a few words}, on {today}.` No design content: no hypothesis, prediction, decision rule or setup.

Record it under a kebab-case slug drawn from the problem:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs experiment create {work_unit} {topic} --slug {slug} --from discussion --problem .ledger/.cache/{work_unit}/discussion/{topic}/problem.md --question {question}
```

Its answer's `id` is the experiment. Working it now would leave the topic, so bring the log up to date, then fetch the gate:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render experiment-spawn-gate {work_unit}.discussion.{topic} --id {id}
```

## A Report Back

A question the map shows waiting on an experiment that has reported takes its `report.md` in: its result is a `measured` finding, with its command and result, and the question goes back to the conversation, which reads the report as evidence.

## One No One Will Run

`experiment abandon {work_unit} {topic} {id} --reason "{reason}"`. Its question opens again.
