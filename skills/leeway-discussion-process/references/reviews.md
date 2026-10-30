# Reviews

*Reference for **[leeway-discussion-process](../SKILL.md)***

---

The review agents read the topic from its record, never the conversation, and run in the background while the conversation carries on. What they find is taken at a natural pause, never jumped to. Each is dispatched, then briefed, then called: the Agent call's `subagent_type` is the agent `brief` answers, and its prompt the pointer alone.

## The Background Review

At a natural pause after entries have landed:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind review
node .claude/skills/leeway-engine/scripts/engine.cjs brief discussion-reviewer {work_unit} {topic} --agent {id}
```

The dispatch refuses while the topic has moved too little since the last review, or while mail waits: carry on, and try again at a later pause. A review the person asks for adds `--final` to the dispatch.

## Perspectives

A decision with two or more defensible ways and no clear winner, where the person is unsure, or disputes a challenge and stays unsettled, is offered perspectives in the conversation. The signal comes from the conversation, never from the domain alone: a straightforward decision, or one the person made with confidence, takes none.

On yes, with the decision a question on the map, pick the polarity pair whose tension it turns on, from the pairs in `.claude/agents/leeway-discussion-perspective.md`, and dispatch both lenses as one set; brief each agent the response names, and call both:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind perspective --label {lens} --label {counter_lens}
node .claude/skills/leeway-engine/scripts/engine.cjs brief perspective {work_unit} {topic} --question {question} --agent {id}
```

Once both have reported, the synthesis reconciles them, on the set the dispatch answered:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind synthesis --set {set}
node .claude/skills/leeway-engine/scripts/engine.cjs brief synthesis {work_unit} {topic} --agent {id}
```

The perspectives feed the synthesis; the person hears its tensions.

## When a Report Lands

`agent scan {work_unit} discussion {topic}` lists what has landed as `pending`. Read the report, then record its findings by the ids its headings carry — `agent ack {work_unit} discussion {topic} {id} --findings {F1,F2}`, or `--clean` where it found none. Take the findings at natural pauses, recording each as you take it, `agent surface {work_unit} discussion {topic} {id} {finding}`; `agent incorporate` closes the rest where the person declines them.

Each finding is a question the review asked: `ledger ask` with `"by": "review"`. The reviewer's lane is where you start, never where a finding must end. Re-derive each from the record before you act on it:
- **apply** — the record or a fact settles it. Check it: a question a current decision answers merges into that decision; one a fact settles is answered as your decision, relying on the finding that records the fact. An `apply` the record contradicts is a call.
- **call** — a call the topic leaves open is worked through in the conversation while the topic's shape is still open, and goes through `raise` once it is agreed: the decision point, never you, decides whether it reaches the person. A fix you cannot stand behind is raised as a call with several defensible answers.
- **route** — another topic's: load **[sending-a-message.md](sending-a-message.md)** and follow its instructions as written, the question moving with the message. Work no topic owns is a scope call — not this topic's, a candidate for the decided screen — answered as any call is.
- A synthesis's tensions are told to the person; one they take up is a question on the map.

A finding a later decision has made moot merges into that decision, and you say so in one line. A finding bound for the person is checked first against the answers given earlier and the record. Only the decision point moves a finding away from the person: one that turns out to hide a real choice goes to `raise`, never settled alone. The person declining a finding settles their interest in it, never who owns it — another topic's still goes there. No finding is cut for count.
