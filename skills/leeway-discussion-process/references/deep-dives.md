# Deep Dives

*Reference for **[leeway-discussion-process](../SKILL.md)***

---

A deep dive learns, in the background, what neither of you can answer from the room. It reports material for the conversation, never findings to walk, and it measures nothing: a number a decision would rest on comes back as the measurement it would take.

## The Bar

A question neither of you can answer from the room, worth more than a lookup, and independent of the turn in hand. Offer it in the conversation; a dive the person asks for needs no offer. A quick lookup, or what the next turn needs, stays inline.

## Dispatching

The question it answers is on the map. Pick its kind:
- `survey` — how several implementations do it;
- `read` — one file held against the question, named by `--path`;
- `feasibility` — whether the platform can do it;
- `landscape` — what exists, what it costs, where the gaps are;
- `verify` — a claim held against sources.

Dispatch it under a kebab-case label, brief it, then make the Agent call — its `subagent_type` the agent `brief` answers, its prompt the pointer alone. The conversation carries on.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind deep-dive --label {slug}
node .claude/skills/leeway-engine/scripts/engine.cjs brief deep-dive {work_unit} {topic} --question {question} --agent {id} --kind {kind} [--path {file}]
```

## When It Lands

`agent scan {work_unit} discussion {topic}` lists it as `pending`. Read the report in full, then `agent ack {work_unit} discussion {topic} {id} --clean`. What it learnt lands as findings, each saying how it is known as the report does, and the log keeps what came back.

At the next natural pause the person hears it. A dive that answered its question — a `read`, a `feasibility`, a `verify` — gives its answers in full: every condition, threshold and alternative, scoped as the report scoped it, told as what the product does before any symbol the report used. A `survey` or a `landscape` gives a short digest: what was asked, what came back, what it opened.

Each line under its Opened is judged: a new question on the map, a point another topic owns, a number a decision would rest on — the laboratory's cue — or nothing worth carrying.
