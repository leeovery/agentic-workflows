# Background Agents

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

The deep dive, the background review and the perspectives read the topic from its record, never the conversation, and run in the background while the conversation carries on. Each is dispatched, then briefed, then called: the Agent call's `subagent_type` is the agent `brief` answers, its prompt the pointer alone. What they bring back is taken at a natural pause, never jumped to.

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

The engine refuses the dispatch until the review is armed: carry on, and try again at a later pause. A review the person asks for adds `--final` to the dispatch.

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

**A deep dive's report** is read in full, then `agent ack {work_unit} discussion {topic} {id} --clean`. What it learnt lands as findings, each saying how it is known as the report does, and the log keeps what came back. At the next natural pause the person hears it: what was asked, what came back, what it opened, and its answers in full — every condition, threshold and alternative, scoped as the report scoped it, told as what the product does before any symbol the report used. Each line under its Opened is judged: a new question on the map, a point another topic owns, a number a decision would rest on — the laboratory's cue — or nothing worth carrying.

**Any other report** is read, then its findings recorded by the ids its headings carry: `agent ack {work_unit} discussion {topic} {id} --findings {F1,F2}`, or `--clean` where it found none. The findings are taken at natural pauses, each one taken recorded, `agent surface {work_unit} discussion {topic} {id} {finding} [--question {question}]`, `--question` the question it was asked as.

Each finding is a question the review asked: `ledger ask` with `"by": "review"`. The reviewer's lane is where you start, never where a finding must end: re-derive each from the record before you act on it.
- **apply** — the record or a fact settles it. Check it: a question a current decision answers merges into that decision; one a fact settles is answered as your decision, relying on the finding that records the fact. An `apply` the record contradicts is a call.
- **call** — a call the topic leaves open is worked through in the conversation while the topic's shape is still open, and goes through `raise` once it is agreed. A fix you cannot stand behind is raised as a call with several defensible answers.
- **route** — another topic's: a message, as the skill's **Tools** sends one, the question moving with it. Work no topic owns is a scope call, not this topic's: a candidate at the close, which in a single-topic unit parks it on the roadmap.
- **A synthesis's tensions** are told to the person; one they take up is a question on the map.

A finding a later decision has made moot merges into that decision, and you say so in one line. A finding bound for the person is checked first against the answers given earlier and the record. Only the raise moves a finding away from the person: one that turns out to hide a real choice goes to `raise`, never settled alone. A finding the person waves off is answered, as "don't care" or as their own decision, never left open; another topic's still goes there. No finding is cut for count.
