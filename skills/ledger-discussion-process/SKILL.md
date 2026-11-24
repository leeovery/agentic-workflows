---
name: ledger-discussion-process
description: Ledger's discussion phase. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

# Discussion

One topic, talked through with the person until what the product does there is decided. Further on than discovery, still wide and collaborative: this is where decisions are made — the person's own, and the calls you make for them, which reach them by the ask rule. You take part as a senior engineer and product partner: you bring evidence, challenge, push back and find the edges the product's user would meet. Nothing here plans or builds: code enters as evidence.

What feeds it: the topic's brief — an epic's written at approve the map, a feature's at start this work, with discovery's logs and the seeds; the decided topics' records; the product record, with its `views`, principles the person stated in the product's conversation, and its `not_taken`, directions dropped with why; the messages other topics send; and earlier units' decisions in the topic's area. A view that bears on this topic, and that the product record holds no decision for, is your position here, and is decided here. What reads what it leaves: the specification is written from the decided topic's record, citing its entries and canonical files; every later topic of the unit reads that record and the product-record lines the close adds; and the log is read by the next session on the topic, the background review and the closing pass's reader.

## Arguments

- `$0` — **work_type**: `epic` or `feature`.
- `$1` — **work_unit**.
- `$2` — **topic**. A single-topic unit's topic is the unit: topic = `$2`, or `$1` where it is left off.

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

Load **[raising-a-call.md](../ledger-shared/references/raising-a-call.md)** and follow its instructions as written.

## Done When

The topic's `decided` checklist is closed and the person has said yes at its decided gate, the engine then holding the topic decided, with the product-record lines and candidates the yes covered; a feature's topic, which has no decided gate, once its checklist is closed and its payload staged into the spec.

## Entering

Every engine call is `node .claude/skills/ledger-engine/scripts/engine.cjs {verb} …`; `{place}` is `{work_unit}.discussion.{topic}`; a value carrying words is single-quoted, a quote inside written `'\''`.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs enter discussion {work_unit} {topic}
```

Where another session holds the topic, the entry asks first and enters nothing. Where the person leaves it to that session and the gate's `next` is to carry on — a single-topic unit's, with no menu to go back to — the turn ends.

Where mail waits, it is the conversation's first business (**Mail**). The DATA names what there is to read; read what the work needs, the `product` read among it, and an `earlier` one as input never changed, a `catch up` transcript as far as the framework says. A `landed` or `lost` report is taken in:

Load **[background-agents.md](references/background-agents.md)** and follow its instructions as written.

Each `affected` entry is confirmed (`ledger hold`) or replaced, one of the person's with them. A topic the DATA says `stays decided` is entered for those alone; once each is settled, hand off:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs handoff /ledger-continue-epic {work_unit}
```

Then open the conversation. A first opening says briefly what the brief covers and what came across into the topic — each `kept branch` and `kept work`, set-aside work with the calls its line gives — then asks where the person wants to start. A return says where the topic stands, from its map and where its log leaves off, and carries on.

The brief's open questions go on the map (`ledger ask`) as the conversation first starts, wherever it begins: only a question on the map holds the close. Each time the topic opens, earlier units' decisions in its area are searched (`knowledge query`): one that still holds is built on, nothing decided again; one that must change is replaced, never decided afresh beside it.

## The Record

- **The ledger** holds every question, finding and decision, every answer of the person's among them; the topic's record and map are drawn from it.
- **The person's decision is theirs.** "Your call" lands as yours, handed over, and "don't care" as the builder's, neither ever written as the person's: said in the talk with no raise drawn, each as the decision's door gives it; at a raise on screen, both as the raise's "don't care".
- **A question closes** by the person's decision, your call, don't care, a move to another topic with its message, or later on the roadmap; nothing waits half-decided. Every question open on the map holds the close, and the map never sets the conversation's order.
- **A changed mind** is a replacement, never an edit, its cause named. The person's change, to their own decision or to a call of yours they overrule, is a replacement recorded as theirs, which the engine counts as a reversal where the old answer was your call or your lean; a change you would make, to their decision or your own, is a call, raised as its replacement. A decision is never written twice: a question a current decision already answers, another topic's or an earlier unit's, merges into it.
- **What came before.** The brief, the seeds and discovery's log are working ground: what the person settled there is never asked again unless something here contradicts it or they reopen it, and what the brief leaves open is still open. A point from before is neither: a point of the record the person brought from before Ledger, marked in the brief by its id. It goes on the map as a question asked with that id, so every raise of it comes to the person, the answer from before your lean. A decision from before Ledger, an entry the migration carried, is another thing: the DATA's `decisions from before` names its reference.
- **The shape.** Until the topic's shape is agreed — what it covers and how it broadly works — no call on the topic is made or raised: each is worked through with the person. Where several ways are open, put ideas forward and ask what they think; where one way is clear, set out how you see it working and invite them to pull it apart; never in set phrases. Once they agree it, the shape lands as theirs — one question on the map, each rule of it a decision answering it `"by": "person"` — so the map shows where the topic turned. From then every call on the topic goes through a raise, one you would sooner put to the person in the talk included: the raise is how it is put.
- **The log**, the DATA's `log`, is the topic's journey: the options weighed, the false paths, the reversals, the person's thinking and why minds changed — documented, never summarised. Written as the talk goes, at the points where it makes sense, appended and never rewritten, it is enough for a fresh session to carry on alone, and points at entries by short id. This conversation's first write opens with the DATA's `log header` line. It is up to date before the gate or the verb of any way out of the topic — a hand-off, a postpone, a cancel, a move up, an experiment worked now — and before the turn ends on the person signing off; signing off with questions open is a pause, never a done-signal.

## Tools

A raise and background work — a landed report, waiting mail, the map — are taken up at a natural pause, never across what the person is in the middle of.

- **Research** — a claim about the code, a number or the platform is checked before it is said; what is learnt lands as a finding saying how it is known. A question on the map that the code or a run answers closes as your decision stating what was found, relying on that finding; it holds no choice, and one that does is a call.
- **Settling the rest** — offered where a raise's answer carries `convergence`, the person having agreed with your leans enough times running, or when they ask, `render convergence {work_unit}.{topic} [--asked]`, `--asked` on their word; drawing nothing, it would settle nothing. Its yes is the close's yes: raise each question still open on the map in turn, and once each is answered, close (**Closing**).
- **The map** — what the topic is deciding and where each point stands, your calls since the person last looked first; drawing it is the person having looked. "What have you decided without me?" is answered from `ledger since`, with the files behind each call.
- **A deep dive** — a background agent for a question neither of you can answer from the room and the next turn does not need. It brings back material for the conversation, never findings to walk, and measures nothing: a number a decision would rest on comes back as the measurement to take.
- **The background review** — a fresh agent reading the topic from its record and log, never the conversation, for gaps, shallow ground and edges no one raised. It recurs: dispatched once the conversation has got going, and again whenever `agent scan`'s `review_arming` shows it armed, the engine holding its back-off.
- **Perspectives** — where a decision has two or more defensible ways and the person stays unsettled: two agents argue the polarity pair it turns on and a synthesis reconciles them, so the person hears tensions, not advocates.

  For these three, and any report that comes back, the closing pass reader's among them:

  Load **[background-agents.md](references/background-agents.md)** and follow its instructions as written.
- **A spike** — anything to look at or press, never wired into the product: a design board, draft code, a format trial, a prototype to feel. Spikes are encouraged: one settles what guessing would not. It is evidence only for what the person reviewed in it; the record states what it settled and points at the file, and where an entry and its design disagree, the entry wins on what exists and how it behaves, the design on how it looks. To start one, link a file to an entry, or lock a design:

  Load **[spikes-and-assets.md](references/spikes-and-assets.md)** and follow its instructions as written.
- **An experiment** — the laboratory, for a number a decision would rest on: a controlled measurement that would settle a choice, not merely inform it; a sighting short of that stays here, its finding `exploratory`. An experiment is offered in the conversation first, a measurement here its alternative, since creating one holds the topic's close on its question; one the person asks for needs no offer. A question `ledger map` shows `waiting_on` an experiment no longer `running` takes its `report.md` in as a `measured` finding, with its command and result, and comes back to the conversation. One no one will run → `experiment abandon {work_unit} {topic} {experiment} --reason '{reason}'`, its question open again. To create one:

  Load **[experiments.md](references/experiments.md)** and follow its instructions as written.
- **A message** — a detail that informs a decision here stays here: token refresh in an auth topic. A point whose home is another topic — the caching strategy that surfaces because tokens need caching — is that topic's, and a decision another topic owns changes only through its mailbox. To send one:

  Load **[sending-a-message.md](references/sending-a-message.md)** and follow its instructions as written.

  Work no topic owns is no message: where the person puts it off, **Backlogging**; otherwise a candidate at the close, which in a single-topic unit parks it on the roadmap. A single-topic unit's point needing decisions of its own is offered the pivot to an epic in a line, moved only on the person's yes:

  Load **[pivot-to-epic.md](../ledger-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`, and follow its instructions as written.

  Then send it as a message, the epic's new topic its target. Declined, the point is work no topic owns.
- **Mail** — another topic's reasoning about something this topic owns, decided here in this topic's frame. Messages landing while you talk wait in `topic mailbox {work_unit} {topic}`, which nothing announces: check it at a natural pause.

## Doors

Content is one JSON object on stdin in a quoted heredoc, `<<'JSON'`, each text field one line. Each write answers the entry's short `id`. A decision holds one rule.

- A question → `ledger ask {place} [--part-of {id}]`, `{"text", "by": "{by:[person|claude|review]}", "who_moved_whom": "none"}`, adding `"from_before": "{id}"` for a point from before. What an answer leaves unsettled is a question of its own, `--part-of` the first.
- A finding → `ledger find {place} [--relies-on {entry_id} …]`, `{"text", "how", "known": "{known:[read|documented|spike|measured|exploratory]}", "by": "claude", "who_moved_whom": "none"}`: `documented` with its source in `how`; `measured` by an experiment and `exploratory` without one each add `"command"` and `"result"`.
- A decision → `ledger decide {place} --answers {id} [--relies-on {entry_id} …]`, `{"text", "why", "rules_out": ["{ruled out}"], "by", "given", "who_moved_whom": "none"}`: the person's own, each rule of the shape among them, `"by": "person", "given": "own"`; "your call" or "don't care" said in the talk, `"by": "claude"`, `"given"` `"your-call"` or `"dont-care"`; a question the code or a run answers, `"by": "claude", "given": "own"`, relying on its finding.
- A changed answer → `ledger replace {place} --replaces {id} --reason {reason:[new-fact|other-topic|changed-mind|was-wrong]} [--cause {cause_id}]`, the content of the kind it replaces with `"drops": ["{part}"]`, one per part of the old it drops; the cause a finding for a new fact, the other topic's decision, or the question a message raised. The person changing their own decision, or overruling a call of yours, is this door, `"by": "person", "given": "own"`: for a new fact or another topic's decision, `"who_moved_whom": "none"`; for a changed mind or a mistake, `who_moved_whom` left out — the engine sets it, logging a reversal where the old answer was your call or your lean — or, where it answers that the content needs it, `claude-moved-person` where they come back round to your lean, `person-moved-claude` where they stand against it still. An entry that still holds after a replacement → `ledger hold {place} --entry {id} --after {replacement_id}`, `{"by", "who_moved_whom": "none"}`.
- A question another topic is to decide moves with its message (**A message**), and one put off moves to its roadmap item (**Backlogging**), never alone; one a current decision already answers → `ledger merge {place} --question {id} --into {decision_id}`, `{"by", "who_moved_whom": "none"}`.
- A call → `raise {place} --answers {id}`, its question on the map, asked first where it is not; a fact only the person holds → the same with `--fact`; a decision you would replace → `raise {place} --replaces {id} --reason {reason} [--cause {cause_id}]`, its reason and cause as a changed answer's.
- A message waiting → its question on the map, asked first where it is not, with its id from before where the message carries one; then `topic answered {work_unit} {topic} {message} --entry {id}`, `{message}` the message's `NNN-slug` file name.
- The map → `render map {work_unit}.{topic}`; `ledger map|since|record|affected|product {work_unit} {topic}` → its questions as they stand, your calls since the person last looked, the topic's record, the entries a replacement changed under it, the product record with its views and directions not taken.
- Earlier work → `knowledge query '{term}' ['{term}' …]`, each term a search of its own; a search in depth after one → `brief plain-search`, then the Agent call with the agent and the pointer it answers.
- A file's status, changed in the person's words → `asset status {work_unit} {path} {status:[canonical|reference]} [--entry {id}]`.

## Closing

Where no question is open on the map and the talk has come to rest, you may say the topic looks ready to close and offer to; the person may keep talking instead. On their yes, the convergence yes, or their asking, it closes on its `decided` checklist. Where they ask with questions still open, each is closed first, raised in turn or through settling the rest.

Load **[closing-pass.md](references/closing-pass.md)** and follow its instructions as written.

## Backlogging

The person puts something off for later — "roadmap it", "inbox it", "backlog that", "push it back": a question of this topic, or work no topic owns.

Load **[backlogging.md](references/backlogging.md)** and follow its instructions as written.

## Postponing the Topic

The person pushes this topic, or another of the epic by name, back to the roadmap — "postpone this", "move the loyalty topic to v2".

Load **[postponing-the-topic.md](references/postponing-the-topic.md)** and follow its instructions as written.

## Cancelling the Topic

The person calls the topic off, or you agree it is not worth pursuing; one wanted later is postponed instead.

Load **[cancelling-the-topic.md](references/cancelling-the-topic.md)** and follow its instructions as written.

## Moving Up

The talk rises past the topic, to the epic or the product.

Load **[moving-up.md](references/moving-up.md)** and follow its instructions as written.

## A Shared File

The person shares a file, a path or an image.

Load **[importing-shared-files.md](../ledger-shared/references/importing-shared-files.md)** with home = `{work_unit}`, phase = `discussion`, topic = `{topic}`, and follow its instructions as written.

Link each path it answered from the entry it informs, `asset add {work_unit} {path} --entry {id} --status {status:[canonical|reference]}`: canonical from a decision the spec carries, reference otherwise.
