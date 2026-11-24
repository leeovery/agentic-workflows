# Background Agents

*Reference for **[ledger-discussion-process](../SKILL.md)***

---

The deep dive, the background review and the perspectives read the topic from its record, the review from its log too, never the conversation, and run in the background while the conversation carries on. Each is dispatched, then briefed, then called: the Agent call's `subagent_type` is the agent `brief` answers, its prompt the pointer alone. `{agent}` is the `id` a dispatch answered; for an agent an earlier conversation left, the id the DATA's `lost` line gives or the name of its `landed` line's file, its row's `id` in `agent scan`. `{id}` is the question on the map the agent works on.

## A Deep Dive

Offer it in the conversation; one the person asks for needs no offer. The question it answers is on the map, asked first where it is not. Pick its kind:
- `survey` — how several implementations do it;
- `read` — one file held against the question, named by `--path`;
- `feasibility` — whether the platform can do it;
- `landscape` — what exists, what it costs, where the gaps are;
- `verify` — a claim held against sources.

Dispatch it under a kebab-case label, brief it, then make the Agent call:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind deep-dive --label {slug}
node .claude/skills/ledger-engine/scripts/engine.cjs brief deep-dive {work_unit} {topic} --question {id} --agent {agent} --kind {kind} [--path {file}]
```

## The Background Review

The reviewer reads the log: bring it up to date before the dispatch. A dispatch refused — mail waiting, or too few moves since the last review — leaves the conversation carrying on: dispatch again later. `--final` waives the count, and only for a review the person asked for, whatever the refusal suggests.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind review [--final]
node .claude/skills/ledger-engine/scripts/engine.cjs brief discussion-reviewer {work_unit} {topic} --agent {agent}
```

## Perspectives

Offer them in the conversation. On yes, the decision's question on the map, asked first where it is not, pick the polarity pair whose tension it turns on, from the pairs in `.claude/agents/ledger-discussion-perspective.md`, and dispatch both lenses as one set; brief each agent the response's `agents` names, and call both:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind perspective --label {lens} --label {counter_lens}
node .claude/skills/ledger-engine/scripts/engine.cjs brief perspective {work_unit} {topic} --question {id} --agent {agent}
```

Once both have reported, the synthesis reconciles them, on the `set` the dispatch answered:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs agent dispatch {work_unit} discussion {topic} --kind synthesis --set {set}
node .claude/skills/ledger-engine/scripts/engine.cjs brief synthesis {work_unit} {topic} --agent {agent}
```

The perspectives feed the synthesis, never the conversation: once it is dispatched, close each of the set's perspectives, `agent incorporate {work_unit} discussion {topic} {agent}`.

## When a Report Lands

`agent scan {work_unit} discussion {topic}` lists what has landed as `pending`. A perspective waits for its synthesis. A `lost` agent went with the conversation that dispatched it and will never report: close it, `agent incorporate {work_unit} discussion {topic} {agent}`.

**A deep dive's report** is read in full, then `agent ack {work_unit} discussion {topic} {agent} --clean`. What it learnt lands as findings, each saying how it is known as the report does, and the log keeps what came back. The person hears it: what was asked, what came back, what it opened, and its answers in full. Each line under its Opened is judged: a new question on the map, a point another topic owns, a number a decision would rest on — the laboratory's cue — or nothing worth carrying.

**Any other report** is read, then its findings recorded by the ids its headings carry, `agent ack {work_unit} discussion {topic} {agent} --findings {F1,F2}`, or `--clean` where it found none.

## A Report's Findings

The background review's findings and the closing pass reader's each come with a lane, the reader's read of where the finding goes; a synthesis brings tensions. The lane is where you start, never where a finding must end: re-derive each from the record before you act on it.
- **apply** — the reader takes the record or a fact to settle it: check that it does. Where a current decision states the answer, the question merges into that decision, nothing decided again; where the code or a run answers it, it closes as the skill's **Research** says; where the record only leaves one answer, or contradicts the finding, it is a call.
- **call** — a call the topic leaves open is worked through with the person while the topic's shape is still open, and raised once it is agreed. A fix you cannot stand behind is raised as a call with several defensible answers.
- **route** — another topic's: a message, the question moving with it. Work no topic owns goes as the skill's **A message** says.

A synthesis's tensions are told to the person; one they take up is a question on the map. Each of its Unresolved Questions is judged as a deep dive's Opened line is.

A finding is a question the review asked, `ledger ask` with `"by": "review"`, unless it would change a decision, which is raised as that decision's replacement and asks none, or it asks nothing of the map: work no topic owns, a `product` line, a tension the person has not taken up. Each is recorded as it is taken, `agent surface {work_unit} discussion {topic} {agent} {finding}`, adding `--question {id}` for the question it was asked as, or `--replaces {decision_id} --reason {reason}` for the decision it was raised to replace; one that asked nothing takes neither.

A finding a later decision has made moot is dropped, and you say so in one line. A finding bound for the person is checked first against the answers given earlier and the record. Only the raise moves a finding away from the person: one that turns out to hide a real choice goes to `raise`, never settled alone. A finding the person waves off is answered, as "don't care" or as their own decision, never left open; another topic's still goes there. No finding is cut for count.
