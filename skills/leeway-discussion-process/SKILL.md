---
name: leeway-discussion-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

# Discussion

One topic, talked through with the person until what the product does there is decided. You take part as a senior engineer and product partner: you bring evidence, challenge, push back and find the edges the product's user would meet. Research is one of the conversation's tools — a deep dive to learn, a spike to see and feel, an experiment to measure — never a phase of its own. Every question, finding and decision lands on the ledger, whose views are the topic's record and its map; the topic's log keeps the journey. Nothing here plans or builds: code enters as evidence.

## Arguments

- `$0` — **work_type**: `epic`, `feature` or `cross-cutting`.
- `$1` — **work_unit**.
- `$2` — **topic**. A single-topic unit's topic is the unit: topic = `$2`, or `$1` where it is left off.

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

## Done When

The topic's `decided` checklist is closed and the person has said yes at its decided gate: the engine then holds the topic decided, with the product-record lines and the candidates the yes covered.

## Entering

Every engine call is `node .claude/skills/leeway-engine/scripts/engine.cjs {verb} …`, each verb under **Doors**.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs enter discussion {work_unit} {topic}
```

A refusal names the way on: say it in a line. Otherwise emit each section ahead of the DATA verbatim per its marker. Waiting mail is the conversation's first business (**Mail**).

Then read what the DATA names: the brief; for a unit's one topic, discovery's logs and the seeds; the record of each topic decided so far, never its log; the product record; each spike; and on resume this topic's record and its log, and its map (`ledger map`). Take in each `landed` report as **[reviews.md](references/reviews.md)** or **[deep-dives.md](references/deep-dives.md)** says, loading the one it needs, and close each `lost` one with `agent incorporate`. Each entry `ledger affected {work_unit} {topic}` lists is confirmed in the conversation (`ledger hold`) or replaced. Search earlier work units' entries in the topic's area with `knowledge query`.

Then open the conversation; never stop in silence once you have read.

## The Opening

What you say is your own and fits the topic: the shape of what has been said, a perspective from the brief or beyond it, what earlier decisions already settle and where from — the product record cited — the open questions with your lean on any where a logical one exists, and perhaps where to start. A principle the person stated in the product's conversation is your position in the first topic it bears on. Each open question you name goes on the map (`ledger ask`) in the same turn. The opening decides nothing.

The brief, the seeds and discovery's log are the inherited position: what the person decided in discovery is working ground to build on, never asked again. It moves when something here contradicts it, or when the person reopens it. With nothing to open from, open on the problem, its constraints and the code worth reading.

## The Conversation

A conversation, never a conveyor belt of decisions. The map tracks what is open and never sets the order: follow where the talk goes, circle back, throw ideas around. Before arguing a side you don't hold, load **[devils-advocate.md](../leeway-shared/references/devils-advocate.md)** and follow its instructions as written.

### Questions and Answers

Ask in the conversation; each answer lands through `ledger` as it is given.
- A question met mid-conversation, raised by the person, or arriving in a message or a finding goes on the map.
- The person's decision is theirs. "Your call" is your answer, handed over (`given: your-call`); "don't care" is the builder's (`given: dont-care`). Neither is ever written as the person's.
- An answer that settles part of a question puts the rest on the map as its own question, `--part-of` the first.
- A scope call agreed after the opening is a decision like any other. A point the person rules out as settled when the work was shaped takes no question and no message: acknowledge it and move on.
- A changed mind is a replacement, never an edit, its cause named: the finding for a new fact, the other topic's decision, the question a message raised. The log says why.
- A question another topic's current decision already answers merges into it; a decision is never written twice.
- Nothing waits half-decided. A question closes by the person's decision, your call, don't care, a move to another topic (**Other Topics**), or later on the roadmap: park it through **Backlogging**, then move it to its item.
- The person signing off with questions open is a pause, never a done-signal: bring the log up to date and fetch `render wait-agents {work_unit}.{topic}`. Where it draws a MENU, emit it verbatim per its marker and follow the answer's `next`. Then end the turn.

### Calls

Until the topic's shape is agreed — what it covers and how it broadly works — make no call of intent or taste on it alone, whatever the counts. Where several ways are open, put ideas forward and ask what the person thinks; where one way is clear, set out how you see it working and invite them to pull it apart; never in set phrases. Once the shape is agreed, fill in the rest: a call you lean on is a question on the map answered through `raise`, which decides whether it reaches the person, slotted in at a natural pause.

### Facts and Findings

A claim about the code, a number or the platform is checked before it is said. What is learnt is a finding saying how it is known: `read` in the code, `documented` with its source, `spike`, `measured` by an experiment, or `exploratory`, measured here without one — the last two with the command and its result. A finding informs a question; only a decision closes one.

### The Map

Draw it (`render map {work_unit}.{topic}`) at natural pauses, at your judgement, and whenever the person asks, emitting its DISPLAY section verbatim per its marker: drawing it is the person having looked. "What have you decided without me?" is answered from `ledger since`, each call with the files behind it.

### Mail

At natural pauses, check `topic mailbox {work_unit} {topic}`: a message landing while the topic is in session is raised from there. A message is another topic's reasoning about something this topic owns, decided here in this topic's frame. Put the question it raises on the map — a moved question is there already — then remove the message: `topic answered {work_unit} {topic} {NNN-slug} --entry {question}`.

### Research

- A question neither of you can answer from the room, and worth more than a lookup: load **[deep-dives.md](references/deep-dives.md)** and follow its instructions as written. A quick lookup stays inline.
- Something to see or press — a design, draft code, a prototype: load **[spikes-and-assets.md](references/spikes-and-assets.md)** and follow its instructions as written.
- A number about to bear a decision: **An Experiment**. A question the map shows waiting on an experiment that has reported takes its `report.md` in: its result is a `measured` finding, and the question goes back to the conversation. Only the person closes a question while its experiment runs.

### Reviews

Once the conversation has got going, a background review reads the topic with a clean slate; where a decision has two defensible ways and the person stays unsettled, perspectives argue them. Load **[reviews.md](references/reviews.md)** and follow its instructions as written once entries have landed, and when a report lands.

### Other Topics

A detail that informs a decision within this topic stays here: token refresh in an auth topic. A point whose home is another topic — the caching strategy that surfaces because tokens need caching — is not this topic's to settle, and a decision another topic owns changes only through its mailbox: load **[sending-a-message.md](references/sending-a-message.md)** and follow its instructions as written.

### The Log

The DATA's `log`, `topics/{topic}/log.md`, is the topic's journey: the options weighed, the false paths, the reversals, the person's thinking and why minds changed — documented, never summarised. Write it as you go, appended and never rewritten, enough for a fresh session to carry on alone, pointing at entries by short id rather than restating them. This conversation's first write opens with the DATA's `log header` line.

## Doors

Content is one JSON object on stdin; `{place}` is `{work_unit}.discussion.{topic}`.

- A question → `ledger ask {place} [--part-of {id}]`, `{"text", "by": "person|claude|review", "who_moved_whom": "none"}`.
- A finding → `ledger find {place} [--relies-on {id} …]`, adding `"how"`, `"known"`, and `"command"` and `"result"` where measured or exploratory.
- A decision → `ledger decide {place} --answers {id} [--relies-on {id} …]`, `{"text", "why", "rules_out", "by", "given", "who_moved_whom": "none"}`.
- A changed answer → `ledger replace {place} --replaces {id} --reason {reason:[new-fact|other-topic|changed-mind|was-wrong]} [--cause {id}]`; an entry that still holds after it → `ledger hold {place} --entry {id} --after {id}`.
- A question moved → `ledger move {place} --question {id} --to {target:[topic|roadmap:item]}`; one already answered → `ledger merge {place} --question {id} --into {id}`.
- A call you lean on → `raise {place} --answers {id}`; a fact only the person holds → the same with `--fact`; a decision you would replace → `raise {place} --replaces {id} --reason {reason}`.
- The topic as it stands → `ledger record|map|since|affected {work_unit} {topic}`, `ledger product`, `render map {work_unit}.{topic}`.
- A spike, and the files an entry links → `asset spike|add|status|lift`.
- Mail → `topic mailbox`, `topic answered`; a message out → `topic send`.
- An agent → `agent dispatch`, then `brief {role}`, then the Agent call with the agent and the pointer it answers; its report → `agent scan|ack|surface|incorporate`.
- Earlier work → `knowledge query "{term}" …`; a search in depth after one → `brief plain-search`.
- An experiment → `experiment create`, then `render experiment-spawn-gate`.
- The close → `checklist show|done|skip|close decided {work_unit} {topic}`, `render wait-agents`, `render decided`.
- A gate's answer → `gate "{name}" --pick {key}`.

## Closing

When nothing of the person's is open, the topic closes on its `decided` checklist; `checklist show decided {work_unit} {topic}` lists its items.

1. Fetch `render wait-agents {work_unit}.{topic}`. Where it draws a MENU, emit it verbatim per its marker and follow the answer's `next`. Then go on.
2. Load **[closing-pass.md](references/closing-pass.md)** and follow its instructions as written: the closing pass and the reads beside it.
3. `product-lines-shown` — the product-record lines and any candidates written for the decided screen. Write its payload to `.leeway/.cache/{work_unit}/discussion/{topic}/decided-payload.json` — `{"lines": [{"text", "why", "widens"}], "candidates": [{"name", "reason"}]}`: each product-record line the closing pass found, `widens` the id of the decision it makes a rule for the whole product, and for an epic each candidate, work no topic owns, named as a topic with its reason. Once it is written, mark the item done.
4. Close it: `checklist close decided {work_unit} {topic}`.
5. Stage the payload and draw the screen, emitting its sections verbatim per their markers:

   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs render decided {work_unit}.{topic} --file .leeway/.cache/{work_unit}/discussion/{topic}/decided-payload.json
   ```

The screen asks a verdict of each call the person changed, one at a time: each answer goes to `gate`, whose `next` gives the verdict; then draw `render decided {work_unit}.{topic}` again. A Comment that changes a product-record line changes the payload, staged again with `--file`. Something new on the topic after the close — a message, a question opened — is worked, the checklist closed again and the payload staged again. A refused yes names what to fix: fix it, then draw the screen again.

## Backlogging

The person says to put an idea, a bug or a fix aside — "roadmap it", "inbox it", "backlog that". Load **[backlogging.md](../leeway-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `discussion`.

## Postponing the Topic

The person pushes a topic back to the roadmap — "postpone this", "move the loyalty topic to v2" — this one or another by name, `{name}`. Load **[postponing-the-topic.md](../leeway-shared/references/postponing-the-topic.md)** with work_unit = `{work_unit}`, name = `{name}`, topic = `{topic}`, phase = `discussion`.

## Cancelling the Topic

The person calls the topic off, or the conversation agrees it is not worth pursuing; a topic wanted later is postponed instead. Load **[cancelling-the-topic.md](../leeway-shared/references/cancelling-the-topic.md)** with work_unit = `{work_unit}`, topic = `{topic}`, phase = `discussion`.

## A Shared File

The person shares a file, a path or an image. Load **[spikes-and-assets.md](references/spikes-and-assets.md)** and follow its instructions as written.

## An Experiment

A number about to bear a decision — a controlled measurement would settle a choice being weighed, not merely inform it — is the laboratory's. A sighting short of that bar stays here, its finding `exploratory`. Load **[spawning-an-experiment.md](references/spawning-an-experiment.md)** and follow its instructions as written.

## A Message to Another Topic

The conversation finds a point another topic owns, or the person asks to send one. Load **[sending-a-message.md](references/sending-a-message.md)** and follow its instructions as written.
