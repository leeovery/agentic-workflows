# Invoke the Skill

*Reference for **[workflow-experiment-entry](../SKILL.md)***

---

The output directory is `.workflows/{work_unit}/experiment/{topic}/`.

This skill's purpose is now fulfilled. Construct the handoff and invoke the processing skill. The handoff carries session identity plus any interview answers — the durable inputs (carrier description, discovery brief, completed research) are read by the processing skill at initialisation, never added to the handoff.

---

## Handoff

#### If source is `continue`

Invoke the **workflow-experiment-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Experiment session for: {topic}
Work unit: {work_unit}
Work type: {work_type}

Source: existing experiments
Output: .workflows/{work_unit}/experiment/{topic}/
```

#### If the context was gathered by interview

gather-context ran at Step 4 — its answers fill the Context block, the one input only this session holds.

Invoke the **workflow-experiment-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Experiment session for: {topic}
Work unit: {work_unit}
Work type: {work_type}

Output: .workflows/{work_unit}/experiment/{topic}/

Context:
- Question: {what the experiment should answer, and the decision it feeds}
- Already knows: {prior sightings, numbers, or hunches, or "starting fresh"}
- Expects: {the predicted outcome and its reason, or "no prediction yet"}
- Measuring against: {the system or process under test, and any available tools}
```

#### Otherwise

The carrier seeded this topic — a feature's discovery record, or an epic topic's brief — or completed research stands in. No interview ran, so there are no gathered answers to relay: the processing skill reads the durable inputs itself at initialisation.

Invoke the **workflow-experiment-process** skill (Skill tool) with the next fenced block as its arguments. Do not act on the gathered context until its instructions load — the skill defines the process.

```
Experiment session for: {topic}
Work unit: {work_unit}
Work type: {work_type}

Output: .workflows/{work_unit}/experiment/{topic}/
```
