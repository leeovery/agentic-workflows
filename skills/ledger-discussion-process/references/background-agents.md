# Background Agents

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

The deep dive, the background review and the perspectives read the topic from its record, never the conversation, and run in the background while the conversation carries on. Each is dispatched, then briefed, then called: the Agent call's `subagent_type` is the agent `brief` answers, its prompt the pointer alone.

## A Deep Dive

Offer it in the conversation; one the person asks for needs no offer. The question it answers is on the map. Pick its kind:
- `survey` — how several implementations do it;
- `read` — one file held against the question, named by `--path`;
- `feasibility` — whether the platform can do it;
- `landscape` — what exists, what it costs, where the gaps are;
- `verify` — a claim held against sources.

Dispatch it under a kebab-case label, brief it, then make the Agent call:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind deep-dive --label {slug}
node .claude/skills/ledger-engine/scripts/engine.cjs brief deep-dive {work_unit} {topic} --question {question} --agent {id} --kind {kind} [--path {file}]
```

## The Background Review

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind review
node .claude/skills/ledger-engine/scripts/engine.cjs brief discussion-reviewer {work_unit} {topic} --agent {id}
```

A review the person asks for adds `--final` to the dispatch.

## Perspectives

Offer them in the conversation. The signal comes from the conversation, never from the domain alone: a straightforward decision, or one the person made with confidence, takes none. On yes, with the decision a question on the map, pick the polarity pair whose tension it turns on, from the pairs in `.claude/agents/ledger-discussion-perspective.md`, and dispatch both lenses as one set; brief each agent the response names, and call both:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind perspective --label {lens} --label {counter_lens}
node .claude/skills/ledger-engine/scripts/engine.cjs brief perspective {work_unit} {topic} --question {question} --agent {id}
```

Once both have reported, the synthesis reconciles them, on the set the dispatch answered:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind synthesis --set {set}
node .claude/skills/ledger-engine/scripts/engine.cjs brief synthesis {work_unit} {topic} --agent {id}
```

The perspectives feed the synthesis, never the conversation: once it is dispatched, close each of the set's perspectives, `agent incorporate {work_unit} discussion {topic} {id}`.

## When a Report Lands

`agent scan {work_unit} discussion {topic}` lists what has landed as `pending`. A perspective waits for its synthesis.

**A deep dive's report** is read in full, then `agent ack {work_unit} discussion {topic} {id} --clean`. What it learnt lands as findings, each saying how it is known as the report does, and the log keeps what came back. The person hears it: what was asked, what came back, what it opened, and its answers in full — every condition, threshold and alternative, scoped as the report scoped it, told as what the product does before any symbol the report used. Each line under its Opened is judged: a new question on the map, a point another topic owns, a number a decision would rest on — the laboratory's cue — or nothing worth carrying.

**Any other report** is read, then its findings recorded by the ids its headings carry, `agent ack {work_unit} discussion {topic} {id} --findings {F1,F2}`, or `--clean` where it found none; each is then taken as the skill's **Findings** says.
