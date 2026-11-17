# Records

## Touches

- The ledger, through `ledger carry`, one topic's record at a time, and
  through `raise` for the points raised at the end.
- Each topic's record as composed, the verifier's findings on it, and a
  carry's refusal of it, in the state's cache, where the topic's brief
  names them.

## Asks

- Nothing for any one entry.
- At the end, each point no source settles on a live topic that has
  started, raised one at a time: answered, or left open.

## What It Does

Every topic of every unit gets its record in the ledger, completed and cancelled units among them: what its sources settle, carried forward one entry at a time. A quick-fix holds no topic, and nothing of it is carried. A topic an epic promoted to a cross-cutting unit is carried on that unit, never on the epic.

Paths below are from the state's folder, but one under `.workflows/`, which is from the project's folder in the main checkout; a topic's brief names both. `{phase}` is the phase the topic's item is in: discussion; investigation for a bugfix's topic; discovery for an epic's topic never started, whose record holds questions and findings alone.

## A Topic's Sources

- Its log, `{unit}/topics/{topic}/log.md`, its brief, `brief.md` beside it, and its experiments' records in `experiments/`.
- Its specs: each spec that draws on the topic, kept in `{unit}/assets/specs/` while the unit's building has not started, and joined into `{unit}/spec.md` once it has, each spec a part of it under its own numbered heading. Its brief marks each approved or a draft.
- Its old discussion map and its research's threads, in its unit's manifest under `.workflows/`, as the move read them; a promoted topic's research as the unit it came from holds it.
- Its reviews never folded in, which the move appended to its log, each under `## Review {id}, never folded in`.

Its brief lists each of these as the check reads them. Each topic's record is carried from its own sources alone: where another topic's says otherwise, each is carried as its own sources say.

## A Topic's Record

### What It Holds

Every current decision, every finding and every open question the topic's sources hold, and nothing else:

- **Current answers only.** Each question's answer as it now stands; an answer replaced later is left in the log. An approved spec is the current answer where it and the log differ, its corrigenda and amendments among it; a decision made at the spec stage — a review gap decided in the spec, an amendment, a corrigendum — is an entry of the topic it belongs to, citing the spec's section.
- **A shared spec.** From a spec several topics draw on, carry only what this topic's log discusses, or what its plan rests on.
- **One thing per entry.** A decision holds one rule. A question settled in several rules is answered by several decisions, one for each, each answering it.
- **Cited.** Every entry cites the sections it came from, each by the nearest heading above its text.
- **Who decided.** `by` `person` where a line of the source shows the person deciding; `by` `claude`, `given` `own`, where it shows Claude's own call; `given` `your-call` or `dont-care` where the person handed the call over in those words; and where it shows no one, `by` `claude`, `given` `carried`. A question's `by` is whoever the source shows raising it, else `claude`.
- **How a finding is known.** A measured result is `known` `measured`, with its `command` and `result` as the log or the experiment's record gives them; one whose command neither gives is `read`, its `how` saying it was measured. Every other finding says `documented`, `spike` or `read`.
- **The old map.** Each subtopic of the old map is carried by an entry naming it, `map_item`: its decision where a source settles it, else an open question, whatever the map's state says; an entry carrying several names them all. The map is as it stood when last written: a later section of the log, or an approved spec, may have settled a subtopic it shows open.
- **Threads.** Each thread the register shows `open` or `digging` is carried by an entry naming it, `thread`: an open question where no source answers it, else the decision or finding that answers it, citing where.
- **Product-wide.** An entry is `product_wide` `true` where it holds for the whole product: what the product is, who it is for, what it values, or a standing rule that cuts across topics. A cross-cutting unit's every finding and decision is product-wide.
- **A topic never started.** Nothing is decided in discovery: its record holds questions and findings alone, none product-wide, and what its research concluded is a finding.
- **Assets.** Each of the unit's assets its brief marks the topic's to link, and any other its log or brief links to, is linked as `reference` from the entry that draws on it. One its brief shows gone is linked from none.
- **A record at least.** A topic whose log holds anything has an entry at least.
- **Points no source settles** are open questions marked `raise` `true`, for the raises at the end: a log unclear on what was decided, with no approved spec to settle it; a draft spec at odds with its log; a spec at odds with itself. Where an approved spec settles it, it is settled.
- **Nothing invented.** An entry says what a source says, and nothing more.

### Its Shape

The record is one JSON object, `{"entries": [...]}`, its entries in the order they link: an entry links only to an entry before it.

- **`ref`**: the entry's name in the record, given once; every link names an entry by it.
- **`event`**: `asked`, a question; `found`, a finding; or `decided`, a decision.
- **A question** holds `text` and `by`; `part_of`, the ref of the question it is part of, where it is one.
- **A decision** holds `answers`, the ref of the question it answers, `text`, `why`, `by` and `given`; `rules_out`, `alternatives` and `evidence` where the source gives them, each a list of lines; and `product_wide`.
- **A finding** holds `text`, `how`, `known` and `by`, a measured one its `command` and `result`; and `product_wide`.
- **Any entry** may hold `relies_on`, a list of the refs it rests on; `map_item` and `thread`, each a name or a list of names; and `assets`, a list of `{"path", "status"}`, each a file the state holds, `status` `reference` or `canonical`.
- **`cites`**: a list of `{"path", "section"}`, one at least: the file's path from the state's folder and a heading it holds. The file is the topic's own, but its mail, or the unit's beside its topics — its assets, its `spec.md` — never the cache, another topic's or another unit's.
- **`raise`**: `true`, on an open question alone, one no decision of the record answers.
- **`who_moved_whom`** is never given: an entry the migration carries moves no one.

```json
{"entries": [
  {"ref": "q1", "event": "asked", "text": "{question}", "by": "person", "map_item": "{subtopic}", "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}]},
  {"ref": "d1", "event": "decided", "answers": "q1", "text": "{answer}", "why": "{why}", "by": "claude", "given": "carried", "product_wide": false, "map_item": "{subtopic}", "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}], "assets": [{"path": "{unit}/assets/{file}", "status": "reference"}]},
  {"ref": "d2", "event": "decided", "answers": "q1", "text": "{second answer}", "why": "{why}", "by": "claude", "given": "carried", "product_wide": false, "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}]},
  {"ref": "f1", "event": "found", "text": "{fact}", "how": "{how}", "known": "measured", "command": "{command}", "result": "{result}", "by": "claude", "product_wide": false, "relies_on": ["d1"], "cites": [{"path": "{unit}/topics/{topic}/experiments/{experiment}/report.md", "section": "{report heading}"}]},
  {"ref": "q2", "event": "asked", "text": "{open question}", "by": "claude", "thread": "{thread}", "raise": true, "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}]}
]}
```

## Working Through the Topics

Give each topic the check names to the migration's per-topic agent; the topics run side by side. Its brief names where it writes the record, and how to check it before handing back:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief migration-topic --topic {unit}.{phase}.{topic} --directive 079-records
```

A record composed already, by this session or an earlier one, is amended, never composed from the start: each brief carries the verifier's findings and the carry's refusal waiting beside the topic's record.

Once it has returned, check the record as the carry would; this names every fault and writes nothing:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger carry {unit}.{phase}.{topic} --dry-run
```

Where it names a fault, a fresh per-topic agent amends the record, its own check naming the faults. Where it names none, the verifier reads the record against its sources and writes its findings beside it, an empty file its pass; its brief carries the last verifier's findings and clears them, so a verifier that never writes leaves no verdict:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief migration-verifier --topic {unit}.{phase}.{topic} --directive 079-records
```

Dispatch each brief's agent with its pointer alone. Where the verifier finds something, a fresh per-topic agent amends the record, its brief carrying the findings, and a fresh verifier reads it again, until one passes it. Then carry it, which reads the record where the brief said it goes and appends it whole in one write:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger carry {unit}.{phase}.{topic}
```

Carrying holds the record to the check's rules before it writes anything. A record that breaks one is refused, naming every fault, the refusal kept beside the record for the next brief, and nothing is carried: a fresh per-topic agent amends it, its brief carrying the refusal, and it is checked, verified and carried again. An agent's record is never edited by hand.

## The Raises at the End

Once every topic is carried, the check passes, and its answer lists under `raise` each point still to raise, `{"place", "answers", "text"}`: an open question marked `raise`, on a live topic, that no raise of this conversation has drawn. Read them there whenever you need them, never from memory. Before the directive's checklist is closed, raise each, one at a time, as a fact only the person holds, at its `place`, answering its question. A point on a topic or unit that isn't live, cancelled or postponed, is not listed: it stays an open question on its topic, left open until the topic returns. Nor is a point on a topic never started, carried in discovery, where nothing is decided: it stays an open question on its topic, for its discussion to open with. Nor is a point of a cross-cutting unit: its record is the product's, and the point stays an open question, the product's, which the product's conversation opens on.

The raise takes one JSON object on stdin, `{"question", "rows", "mechanism", "product_wide"}`: the point as the person reads it, cold; the rows, each `{"key", "name", "text", "notice"}`, only where the answers are few and known, else `[]`; what the sources say of it and where, as the mechanism; and whether its answer holds for the whole product, `true` or `false`.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs raise {place} --answers {answers} --fact
```

Emit its sections verbatim per their markers. Record the person's answer with `raise answer {id}`, the raise's id: a row they pick, `--pick {key}`, with `{"why"}` on stdin; their own words, `--own`, with `{"text", "why"}`. A point they leave open stays an open question on its topic.
