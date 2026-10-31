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

A refusal names the way on: say it in a line. Where another session holds the topic, the entry asks first: emit its MENU verbatim per its marker and follow the answer's `next`; carrying on from it ends the turn. Otherwise emit each section ahead of the DATA verbatim per its marker. Waiting mail is the conversation's first business (**Mail**).

Then read what the DATA names: the brief; for a unit's one topic, discovery's logs and the seeds; the record of each topic decided so far, never its log; the product record, with what discovery found of the product, this work and this topic; each spike; and on resume this topic's record, its map, its `affected` entries and its log. Take in each `landed` report as **[reviews.md](references/reviews.md)** or **[deep-dives.md](references/deep-dives.md)** says, loading the one it needs, and close each `lost` one with `agent incorporate`. Each `affected` entry is confirmed in the conversation (`ledger hold`) or replaced. Search earlier work units' entries in the topic's area with `knowledge query`.

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
- Nothing waits half-decided. A question closes by the person's decision, your call, don't care, a move to another topic (**Other Topics**), or later on the roadmap (**Backlogging**).
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

A detail that informs a decision within this topic stays here: token refresh in an auth topic. A point whose home is another topic — the caching strategy that surfaces because tokens need caching — is not this topic's to settle, and a decision another topic owns changes only through its mailbox: load **[sending-a-message.md](references/sending-a-message.md)** and follow its instructions as written. Talk that rises past every topic, to the epic as a whole or to the product, is **Moving Up**.

### The Log

The DATA's `log`, `topics/{topic}/log.md`, is the topic's journey: the options weighed, the false paths, the reversals, the person's thinking and why minds changed — documented, never summarised. Write it as you go, appended and never rewritten, enough for a fresh session to carry on alone, pointing at entries by short id rather than restating them. This conversation's first write opens with the DATA's `log header` line.

## Doors

Content is one JSON object on stdin; `{place}` is `{work_unit}.discussion.{topic}`.

- A question → `ledger ask {place} [--part-of {id}]`, `{"text", "by": "person|claude|review", "who_moved_whom": "none"}`.
- A finding → `ledger find {place} [--relies-on {id} …]`, adding `"how"`, `"known"`, and `"command"` and `"result"` where measured or exploratory.
- A decision → `ledger decide {place} --answers {id} [--relies-on {id} …]`, `{"text", "why", "rules_out", "by", "given", "who_moved_whom": "none"}` — `given` `your-call` or `dont-care` with `"by": "claude"`.
- A changed answer → `ledger replace {place} --replaces {id} --reason {reason:[new-fact|other-topic|changed-mind|was-wrong]} [--cause {id}]`, the content of the kind it replaces; an entry that still holds after it → `ledger hold {place} --entry {id} --after {id}`, `{"by", "who_moved_whom"}`.
- A question moved → `ledger move {place} --question {id} --to {target:[topic|roadmap:item]}`; one already answered → `ledger merge {place} --question {id} --into {id}`; each `{"by", "who_moved_whom"}`.
- A call you lean on → `raise {place} --answers {id}`; a fact only the person holds → the same with `--fact`; a decision you would replace → `raise {place} --replaces {id} --reason {reason}`.
- The topic as it stands → `ledger record|map|since|affected|product {work_unit} {topic}`, `render map {work_unit}.{topic}`.
- A spike, and the files an entry links → `asset spike|add|status|lift`.
- Mail → `topic mailbox`, `topic answered`; a message out → `topic send`.
- An agent → `agent dispatch`, then `brief {role}`, then the Agent call with the agent and the pointer it answers; its report → `agent scan|ack|surface|incorporate`.
- Earlier work → `knowledge query "{term}" …`; a search in depth after one → `brief plain-search`.
- An experiment → `experiment create`, then `render experiment-spawn-gate`.
- A question for later → `roadmap add`, then `ledger move --to roadmap:{item}`.
- A topic leaving → `render postpone-gate|horizon-pick|cancel-gate`, whose `next` runs `topic postpone`, `topic cancel` or `workunit cancel`; then `render topic-receipt|workunit-receipt`.
- The talk moving up → `render wait-agents`, then `enter discovery {work_unit}|product --move`.
- The close → `checklist show|done|skip|close decided {work_unit} {topic}`, `render wait-agents`, `render decided`, `decided unstrike`.
- A gate's answer → `gate "{name}" --pick {key}`, or `--typed {key}` for a typed row such as a Comment.

## Closing

When nothing of the person's is open, the topic closes on its `decided` checklist; `checklist show decided {work_unit} {topic}` lists its items.

1. Fetch `render wait-agents {work_unit}.{topic}`. Where it draws a MENU, emit it verbatim per its marker and follow the answer's `next`. Then go on.
2. Load **[closing-pass.md](references/closing-pass.md)** and follow its instructions as written: the closing pass and the reads beside it.
3. `product-lines-shown` — the product-record lines and any candidates written for the decided screen. Write its payload to `.leeway/.cache/{work_unit}/discussion/{topic}/decided-payload.json` — `{"lines": [{"text", "why", "widens"}], "withdraws": [{"line", "why"}], "candidates": [{"name", "reason"}]}`: each product-record line the closing pass found, `widens` the id of the decision it makes a rule for the whole product, one line to a decision; where a rule of the record should go, its line by id with why, `withdraws` left out where none should; and for an epic each candidate, work no topic owns, named as a topic with its reason. Once it is written, mark the item done.
4. Close it: `checklist close decided {work_unit} {topic}`.
5. Stage the payload and draw the screen, emitting its sections verbatim per their markers:

   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs render decided {work_unit}.{topic} --file .leeway/.cache/{work_unit}/discussion/{topic}/decided-payload.json
   ```

   A line widening a decision the product record already widens is refused, naming that entry: leave the line out of the payload, stage it again, and say in a line that it is in the record already. A line widening the replacement of a decision a product-record line rests on replaces that line at the yes, and the screen shows what it replaces. The yes refuses while a product-record line rests on a decision of this topic replaced since and nothing staged replaces or withdraws it, naming the line. Where the rule still holds, stage a line widening the replacement, in the same words; where it should go, withdraw the line. Then draw the screen again.

The screen asks a verdict of each call the person changed, one at a time: each answer goes to `gate`, whose `next` gives the verdict; then draw `render decided {work_unit}.{topic}` again. A Comment that changes a product-record line changes the payload, staged again with `--file`. One keeping a struck candidate after all undoes its strike, `decided unstrike {work_unit} {topic} {n}`, whose `next` draws the screen. Something new on the topic after the close — a message, a question opened — is worked, the checklist closed again and the payload staged again. A refused yes names what to fix: fix it, then draw the screen again. The yes answers a `next`: follow it.

## Backlogging

The person puts a question off for later — "roadmap it", "backlog that", "push it back": it waits on the roadmap and closes here. So does work no topic owns in a single-topic unit. A point not on the map is asked first. The horizon is the person's: take it from their words, or ask in the conversation. Bring the log up to date, then add the item — a kebab-case `{name}` and a one-line `{summary}` saying the question in the product's terms — and move the question to it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs roadmap add {name} --horizon "{horizon}" --summary "{summary}" --origin park:{work_unit} --source {work_unit}/topics/{topic}
node .claude/skills/leeway-engine/scripts/engine.cjs ledger move {work_unit}.discussion.{topic} --question {id} --to roadmap:{name}
```

The move takes `{"by": "person", "who_moved_whom": "none"}` on stdin. A refused add records nothing; a name already on the roadmap takes another. In an epic, work that would be a new topic of the unit is a candidate for the decided screen instead, and a point another topic owns is a message (**A Message to Another Topic**).

## Postponing the Topic

The person pushes a topic back to the roadmap — "postpone this", "move the loyalty topic to v2" — this one or another of the epic by name, `{name}`. A single-topic unit has nothing to postpone: its topic is the unit, and its "not now" is a cancel. Say so in a line.

Where the topic postponed is this one, postponing leaves it: bring the log up to date, then fetch `render wait-agents {work_unit}.{topic}`; where it draws a MENU, emit it verbatim per its marker and follow the answer's `next`. Another topic of the epic, named, leaves this one as it is. Then, where the person named a horizon, fetch the confirm, `render postpone-gate {work_unit}.discovery.{name} --horizon "{horizon}"`; otherwise the pick over the roadmap's horizons, `render horizon-pick {work_unit}.discovery.{name}`. A pick that refuses has none to offer: ask for the horizon in the conversation, then fetch the confirm. Emit each MENU verbatim per its marker and follow the answer's `next`; a horizon named in words, or a Comment changing it, leads to the confirm again with it. A refusal names what holds the topic: say it in a line.

The postpone answers `closed_agents`: stop the task behind each one you dispatched with the TaskStop tool. Fetch the receipt, adding `--warn` where the response carries warnings, and emit its sections verbatim per their markers; then follow the postpone's `next`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render topic-receipt {work_unit}.discovery.{name} --verb postpone [--warn]
```

## Cancelling the Topic

The person calls the topic off, or the conversation agrees it is not worth pursuing; a topic wanted later is postponed instead. Bring the log up to date, then fetch `render wait-agents {work_unit}.{topic}`; where it draws a MENU, emit it verbatim per its marker and follow the answer's `next`. Then fetch the confirm — an epic's topic `render cancel-gate {work_unit}.discovery.{topic}`, a single-topic unit `render cancel-gate {work_unit}` — emit its MENU verbatim per its marker and follow the answer's `next`. A refusal names what holds the topic: say it in a line.

An epic's cancel answers `closed_agents`: stop the task behind each one you dispatched with the TaskStop tool. Fetch its receipt, adding `--warn` where the response carries warnings, and emit its sections verbatim per their markers; say in a line what went with it where the response names any — a proposed grouping `discarded`, an experiment `abandoned` — and where each wait in `released_waits` stands: the point it held is open again, raised when the topic is reactivated. Then follow the cancel's `next`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render topic-receipt {work_unit}.discovery.{topic} --verb cancel [--warn]
```

A single-topic unit's cancel takes the unit's cache, its agents' rows with it: stop every task you dispatched. Its receipt is `render workunit-receipt {work_unit} --verb cancel [--warn]`; the unit is closed, and the turn ends.

## Moving Up

The talk rises past the topic: to the epic as a whole, or to the product. Suggest going there in a line; only the person's word moves it. Bring the log up to date, then fetch `render wait-agents {work_unit}.{topic}`; where it draws a MENU, emit it verbatim per its marker and follow the answer's `next`.

Then move, in this conversation: `{home}` is `{work_unit}` for an epic's discovery, or `product` for the product's conversation, the only place a single-topic unit's talk moves up to.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs enter discovery {home} --move
```

A refusal names the way on: say it in a line. Otherwise invoke `/leeway-discovery none {work_unit}`, or `/leeway-discovery none none` for the product's conversation; the conversation carries on there.

## A Shared File

The person shares a file, a path or an image. Load **[spikes-and-assets.md](references/spikes-and-assets.md)** and follow its instructions as written.

## An Experiment

A number about to bear a decision — a controlled measurement would settle a choice being weighed, not merely inform it — is the laboratory's. A sighting short of that bar stays here, its finding `exploratory`. Load **[spawning-an-experiment.md](references/spawning-an-experiment.md)** and follow its instructions as written.

## A Message to Another Topic

The conversation finds a point another topic owns, or the person asks to send one. Load **[sending-a-message.md](references/sending-a-message.md)** and follow its instructions as written.
