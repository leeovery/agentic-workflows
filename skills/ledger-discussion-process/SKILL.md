---
name: ledger-discussion-process
description: Ledger's discussion phase. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

# Discussion

One topic, talked through with the person until what the product does there is decided. Still wide and collaborative, but further on than discovery: this is where decisions are made — the person's own, and the calls you make for them, which reach them by the ask rule. You take part as a senior engineer and product partner: you bring evidence, challenge, push back and find the edges the product's user would meet. Nothing here plans or builds: code enters as evidence.

What feeds it: the brief discovery wrote for the topic when the map was approved — for a feature, discovery's logs and the seeds too; the records of the topics decided so far, and the product record, the rules every topic keeps; points from before, the person's answers from before Ledger; the messages other topics send; and earlier work in the topic's area. What reads what it leaves: the specification is written from the decided topic's record, every statement citing its entries, the files linked canonical among them, and the build builds to it; every later topic reads that record and the product-record lines the close adds; another topic reads only the messages this one sends it; and the topic's log is read by whichever session carries the topic on next.

## Arguments

- `$0` — **work_type**: `epic` or `feature`.
- `$1` — **work_unit**.
- `$2` — **topic**. A single-topic unit's topic is the unit: topic = `$2`, or `$1` where it is left off.

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

Load **[raising-a-call.md](../ledger-shared/references/raising-a-call.md)** and follow its instructions as written.

## Done When

The topic's `decided` checklist is closed and the person has said yes at its decided gate: the engine then holds the topic decided, with the product-record lines and the candidates the yes covered. A feature's topic has no decided gate: it is done once its checklist is closed and its payload staged into the spec.

## Entering

Every engine call is `node .claude/skills/ledger-engine/scripts/engine.cjs {verb} …`; `{place}` is `{work_unit}.discussion.{topic}`.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs enter discussion {work_unit} {topic}
```

Where another session holds the topic, the entry asks first; leaving the topic to that session, where the answer is `continue`, ends the turn.

Where mail waits, it is the conversation's first business (**Mail**). The DATA names what there is to read; read what the work needs, an `earlier` one as input never changed. A `landed` report is taken in: load **[background-agents.md](references/background-agents.md)** and follow its instructions as written. A `lost` one is closed, `agent incorporate {work_unit} discussion {topic} {id}`. Each `affected` entry is confirmed (`ledger hold`) or replaced. A topic the DATA says `stays decided` is entered for those alone: once each is confirmed or replaced, bring the log up to date, then load **[handing-off.md](../ledger-shared/references/handing-off.md)** with route = `/ledger-continue-epic {work_unit}`.

Then open the conversation; never stop in silence once you have read. Say briefly what the brief covers and what came across into the topic — each `kept branch` and `kept work` among it, a piece of work with the calls its line gives — then ask where the person wants to start. The opening decides nothing.

## The Record

- **The ledger** holds every question, finding and decision, and every answer the person gives; the topic's record and its map are drawn from it.
- **The person's decision is theirs.** "Your call" lands as yours, handed over; "don't care" as the builder's; neither is ever written as the person's.
- **A question closes** by the person's decision, your call, don't care, a move to another topic, or later on the roadmap; nothing waits half-decided. Only the person's questions hold the topic open, and the map never sets the conversation's order.
- **A changed mind** is a replacement, never an edit, its cause named. A decision is never written twice: a question another topic's current decision answers merges into it.
- **What came before.** The brief, the seeds and discovery's log are working ground, never asked again: they move when something here contradicts them, or the person reopens them. A point the brief marks as from before is not: it goes on the map asked with its id from before, and every raise of it comes to the person, the answer from before your lean.
- **The shape.** Until the topic's shape is agreed — what it covers and how it broadly works — no call of intent or taste on it is yours alone: work each through with the person, since a wrong turn caught here costs a sentence and caught in review a rebuild. Once they agree it, the shape lands as their decision, a question on the map answered `"by": "person"`, so the map shows where the topic turned. From then on, every call you would make for them goes through a raise.
- **The log**, the DATA's `log`, is the topic's journey: the options weighed, the false paths, the reversals, the person's thinking and why minds changed — documented, never summarised. Appended, never rewritten, enough for a fresh session to carry on alone, it points at entries by short id. This conversation's first write opens with the DATA's `log header` line. The log is brought up to date before the conversation leaves the topic, by any way; the person signing off with questions open is a pause, never a done-signal.

## Tools

- **Research** — a claim about the code, a number or the platform is checked before it is said, earlier work in the topic's area among what is searched. What is learnt lands as a finding saying how it is known.
- **A raise, and the ask rule** — every call of intent or taste you would make for the person goes through a raise, the obvious ones included: the question, its answers, and your own pick, sealed before the person sees anything. Whether it reaches them is the engine's, never your confidence: each question has a kind, and the engine keeps, from the person's verdicts, how often your answers on that kind would have cost the product. It may ask with your lean beside the question, ask blind with your lean held back until they answer, or land your answer on the ledger as yours, first on the map the next time they look. Danger, a care entry, a point from before and a change to the person's own decision always come to them. Your sealed answer beside theirs is the evidence the rule learns from. A question reading the code, the record or running something can answer is no call: check it, and answer it as your decision, relying on the finding.
- **Settling the rest** — where a raise's answer carries `convergence`, the person having agreed with your leans enough times in a row, or the person asks you to settle the rest of the topic, offer it, `render convergence {work_unit}.{topic} [--asked]`, `--asked` on their word; where it draws nothing it would settle nothing. Once they say yes, raise each question still open on the map, one after another.
- **The map** — what the topic is deciding and where each point stands, your calls since the person last looked first; drawing it is the person having looked, and it is how they see what you decided without them. "What have you decided without me?" is answered from `ledger since`, each call with the files behind it.
- **A deep dive** — a background agent for a question neither of you can answer from the room. It brings back material for the conversation, never findings to walk, and it measures nothing: a number a decision would rest on comes back as the measurement it would take.
- **The background review** — a fresh agent reading the topic from its record, never the conversation, for gaps, shallow ground and edges no one raised. The engine arms it once enough has moved on the ledger since the last review, and holds it while mail waits; one the person asks for waives the count.
- **Perspectives** — for a decision with two or more defensible ways and no clear winner, where the person stays unsettled: two agents argue the polarity pair it turns on, and a synthesis reconciles them, so the person hears the tensions rather than two advocates.

  When you reach for any of these three, or a report comes back from one of them or from the closing pass's reader, load **[background-agents.md](references/background-agents.md)** and follow its instructions as written.
- **A spike** — anything to look at or press that is never wired into the product: a design board, draft code, a format trial, a prototype to scroll and feel. Spikes settle what guessing would not. A spike is evidence only for what the person reviewed in it: scaffolding nobody discussed is never cited as decided. The record states what a spike settled and points at the file, never re-describing it; where an entry and the design it points at disagree, the entry wins on what exists and how it behaves, the design on how it looks. When you reach for one, or link a file to an entry, load **[spikes-and-assets.md](references/spikes-and-assets.md)** and follow its instructions as written.
- **An experiment** — the laboratory, for a number about to bear a decision: a controlled measurement that would settle a choice being weighed, not merely inform it. A sighting short of that bar stays here, its finding `exploratory`. When you reach for one, or one has reported or will not be run, load **[experiments.md](references/experiments.md)** and follow its instructions as written.
- **A message** — a detail that informs a decision here stays here: token refresh in an auth topic. A point whose home is another topic — the caching strategy that surfaces because tokens need caching — is that topic's to settle, and a decision another topic owns changes only through its mailbox. Work no topic owns is no message: it is a candidate at the close, or the roadmap's where the person puts it off. When you reach for one, load **[sending-a-message.md](references/sending-a-message.md)** and follow its instructions as written.

  A single-topic unit has no other topic: such a point goes aside through **Backlogging**, or, where it needs decisions of its own, is offered the pivot to an epic in a line, and only the person's yes moves it. On it, load **[pivot-to-epic.md](../ledger-shared/references/pivot-to-epic.md)** with work_unit = `{work_unit}`, and follow its instructions as written; then the point becomes a topic of the epic and the message goes to it, as sending-a-message.md says.
- **Mail** — a message from another topic is that topic's reasoning about something this topic owns, decided here in this topic's frame. Messages landing while you talk wait in `topic mailbox {work_unit} {topic}`; the close holds until each is answered.

## Findings

The findings a report brings back — the background review's, a synthesis's, the closing pass reader's — each come with a lane, the reader's read of where the finding goes. Each finding taken is a question the review asked, `ledger ask` with `"by": "review"`, recorded as taken, `agent surface {work_unit} discussion {topic} {id} {finding} [--question {question}]`, `--question` the question it was asked as. The lane is where you start, never where a finding must end: re-derive each from the record before you act on it.
- **apply** — the record or a fact settles it. Check it: a question a current decision answers merges into that decision; one a fact settles is answered as your decision, relying on the finding that records the fact. An `apply` the record contradicts is a call.
- **call** — a call the topic leaves open is worked through with the person while the topic's shape is still open, and goes through `raise` once it is agreed. A fix you cannot stand behind is raised as a call with several defensible answers.
- **route** — another topic's: a message (**A message**), the question moving with it. Work no topic owns is a scope call, not this topic's: a candidate at the close, which in a single-topic unit parks it on the roadmap.
- **A synthesis's tensions** are told to the person; one they take up is a question on the map.

A finding a later decision has made moot merges into that decision, and you say so in one line. A finding bound for the person is checked first against the answers given earlier and the record. Only the raise moves a finding away from the person: one that turns out to hide a real choice goes to `raise`, never settled alone. A finding the person waves off is answered, as "don't care" or as their own decision, never left open; another topic's still goes there. No finding is cut for count.

## Doors

Content is one JSON object on stdin, each text field one line but a raise's `mechanism`, given in a quoted heredoc:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger ask {place} <<'JSON'
{"text": "{question}", "by": "claude", "who_moved_whom": "none"}
JSON
```

Each write answers the entry's short `id`, which later calls, links and the log name it by. A decision holding several rules is refused, naming each: write each as a decision of its own on the same question.

- A question → `ledger ask {place} [--part-of {id}]`, `{"text", "by": "{by:[person|claude|review]}", "who_moved_whom": "none"}`, adding `"from_before": "{id}"` for a point from before. What an answer leaves unsettled is a question of its own, `--part-of` the first.
- A finding → `ledger find {place} [--relies-on {id} …]`, `{"text", "how", "known": "{known:[read|documented|spike|measured|exploratory]}", "by": "claude", "who_moved_whom": "none"}`: `documented` with its source in `how`; `measured` by an experiment and `exploratory` without one each add `"command"` and `"result"`.
- A decision → `ledger decide {place} --answers {id} [--relies-on {id} …]`, `{"text", "why", "rules_out": ["{ruled out}"], "by", "given", "who_moved_whom": "none"}`: the person's, the shape among them, `"by": "person", "given": "own"`; one they hand you, `"by": "claude"`, `"given"` `"your-call"` or `"dont-care"`; a question a fact settles, `"by": "claude", "given": "own"`.
- A changed answer → `ledger replace {place} --replaces {id} --reason {reason:[new-fact|other-topic|changed-mind|was-wrong]} [--cause {id}]`, the content of the kind it replaces with `"drops": ["{part}"]`, a line for each part of the old it drops; `--cause` the finding for a new fact, the other topic's decision, or the question a message raised. The person's own decision changes only through a raise. An entry that still holds after a replacement → `ledger hold {place} --entry {id} --after {id}`, `{"by", "who_moved_whom": "none"}`.
- A question moved → `ledger move {place} --question {id} --to {target:[topic|roadmap:item]}`, as a message or a backlog moves it; one another topic's current decision answers → `ledger merge {place} --question {id} --into {id}`; each `{"by", "who_moved_whom": "none"}`.
- A call → `raise {place} --answers {id}`, the call on stdin: `{"question", "rows": [{"key", "name", "text", "notice"}], "lean", "why", "sort", "mechanism", "product_wide"}`. The question is what is being decided, product first; two rows or more, each a short `key`, a short `name`, the answer's `text`, and its `notice`, what the person would notice were it built. `lean` is the key of the row you would pick, and `why` why. `sort` is `one` where the record — decisions made, sibling work, the brief — a platform or industry convention, or first principles admit exactly one defensible answer; `several` where it turns on what the person wants or knows. `mechanism` is how it works, behind the screen's toggle; `product_wide` whether the answer holds for the whole product. Your lean goes in `lean` alone, never in the rows or the mechanism: the engine may ask the call blind.
- The raise answers `decision`: `ask`, drawn for the person with your lean; `blind`, drawn with it held back; `proceed`, landed as yours, so carry on from it; `check`, nothing drawn: find the answer out, and raise again only if that cannot settle it.
- A fact only the person holds → `raise {place} --answers {id} --fact`, `{"question", "rows", "mechanism", "product_wide"}`, its rows optional: always asked, with no lean.
- A decision you would replace → `raise {place} --replaces {id} --reason {reason} [--cause {id}]`, the same call, its rows your proposed answers; the screen adds the person's `keep`.
- A message waiting → the question it raises on the map — a moved question is there already — asked with its id from before where the message carries a point from before, then `topic answered {work_unit} {topic} {NNN-slug} --entry {question}`, `{NNN-slug}` the message's file name.
- The map → `render map {work_unit}.{topic}`; your calls since the person last looked → `ledger since {work_unit} {topic}`; the topic as it stands → `ledger record {work_unit} {topic}`, each entry with what it replaced, and `ledger affected {work_unit} {topic}`, entries a replacement changed under it; the product record → `ledger product {work_unit} {topic}`.
- Earlier work → `knowledge query "{term}" ["{term}" …]`, each term a search of its own; a search in depth after one → `brief plain-search`, then the Agent call with the agent and the pointer it answers.

## Closing

Where nothing of the person's is open on the map and the talk has come to rest, you may say the topic looks ready to close and offer to; the person may keep talking instead. On their yes, or when they ask for it themselves, the topic closes on its `decided` checklist:

Load **[closing-pass.md](references/closing-pass.md)** and follow its instructions as written.

## Backlogging

The person puts something off for later — "roadmap it", "backlog that", "push it back": a question of this topic, or work no topic owns. Load **[requests-at-any-point.md](references/requests-at-any-point.md)** with request = `backlog`, and follow its instructions as written.

## Postponing the Topic

The person pushes a topic back to the roadmap — "postpone this", "move the loyalty topic to v2" — this one or another of the epic by name. Load **[requests-at-any-point.md](references/requests-at-any-point.md)** with request = `postpone`, and follow its instructions as written.

## Cancelling the Topic

The person calls the topic off, or the conversation agrees it is not worth pursuing; a topic wanted later is postponed instead. Load **[requests-at-any-point.md](references/requests-at-any-point.md)** with request = `cancel`, and follow its instructions as written.

## Moving Up

The talk rises past the topic, to the epic as a whole or to the product. Load **[requests-at-any-point.md](references/requests-at-any-point.md)** with request = `move-up`, and follow its instructions as written.

## A Shared File

The person shares a file, a path or an image. Load **[importing-shared-files.md](../ledger-shared/references/importing-shared-files.md)** with home = `{work_unit}`, phase = `discussion`, topic = `{topic}`, and follow its instructions as written. Link each path it answered from the entry it informs, `asset add {work_unit} {path} --entry {id} --status {status:[canonical|reference]}`: canonical from a decision the spec carries, reference otherwise. The log's line for a folder names what the import renamed in it.
