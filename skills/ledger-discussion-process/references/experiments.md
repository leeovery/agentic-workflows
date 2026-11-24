# Experiments

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

The laboratory measures what a decision rests on. This conversation states the problem and hands it over: the question's refinement, the prediction, the decision rule and the method are the laboratory's.

The question it measures, `{id}`, is on the map, asked first where it is not. Write the problem statement to `.ledger/.cache/{work_unit}/discussion/{topic}/problem.md`: the problem in plain terms — what needs picking or learning, the space around it, what is hoped — closing on where it was born, `Spawned from the "{topic}" discussion, at {the point, in a few words}, on {today}.` No design content: no hypothesis, prediction, decision rule or setup.

Record it under a kebab-case slug drawn from the problem:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs experiment create {work_unit} {topic} --slug {slug} --from discussion --problem .ledger/.cache/{work_unit}/discussion/{topic}/problem.md --question {id}
```

Its answer's `id` is the experiment, `{experiment}`. Fetch the gate, whose "now" leaves the topic for the laboratory:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render experiment-spawn-gate {work_unit}.discussion.{topic} --id {experiment}
```

