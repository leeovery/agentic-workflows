# Records

## Touches

- The ledger, through `ledger carry`, one record at a time, and through
  `raise` for the points raised at the end.
- Each record as composed, the verifier's findings, rulings and verdicts
  on it and every round of them before, the findings its composer handed back, the
  points the session settled, and a carry's refusal of it, in the state's cache, where its brief names them;
  and each unit's sections of its specs that hold no topic's decision,
  finding or open question, `.cache/migrate/records/{unit}.sections.json`.

## Asks

- Nothing for any one entry, but a point the record's sources do not
  settle that a verifier reverses, or that a finding of the third round or
  a later one raises.
- At the end, each point no source settles on a started topic of a unit
  in progress, raised one at a time: answered, or left open.

## What It Does

Every topic of every unit gets its record in the ledger, completed and cancelled units among them: what its sources settle, carried forward one entry at a time. A quick-fix holds no topic, and nothing of it is carried. Nor is anything of a cancelled unit holding an approved spec and no topic: its spec stays in its assets, the reference it is, and a cancelled unit's decisions govern nothing. A topic an epic promoted to a cross-cutting unit is carried on that unit, never on the epic. Each epic whose discovery holds a session gets a record of its own too, `{unit}.discovery`: each point of its discovery sessions bearing on no topic's subject, carried at the epic's discovery. A unit of one topic has none: its discovery is its topic's.

Paths below are from the state's folder, but one under `.workflows/`, which is from the project's folder in the main checkout; a topic's brief names both. `{phase}` is the phase the topic's item is in: discussion; investigation for a bugfix's topic; discovery for an epic's topic never started, whose record holds questions and findings alone.

## A Topic's Sources

- Its log, `{unit}/topics/{topic}/log.md`, its brief, `brief.md` beside it, and its experiments' records in `experiments/`.
- Its specs: each spec that draws on the topic, kept in `{unit}/assets/specs/` while the unit's building has not started, and joined into `{unit}/spec.md` once it has, each spec a part of it under its own numbered heading. Its brief marks each approved or a draft.
- Its unit's approved specs it does not draw on, kept or joined the same way: the later answer to each of its points.
- Its old discussion map and its research's threads, in its unit's manifest under `.workflows/`, as the move read them; a promoted topic's research as the unit it came from holds it.
- Its reviews never folded in, which the move appended to its log, each under `## Review {id}, never folded in`.
- Its unit's discovery sessions, `{unit}/discovery/session-{NNN}.md`, the migration's own among them where research fed several topics, and for a promoted topic those of the unit it came from.

A unit's own record has the unit's discovery sessions alone as its sources.

A point in a shared source — a discovery session, a spec several topics draw on, research that fed several topics — belongs to the record of the topic whose subject it bears on, whether or not it names the topic. A point of the discovery sessions or their research bearing on no topic's subject is the unit's own record's, `{unit}.discovery`, where the unit has one, an epic's; in a unit of one topic, it is that topic's. A spec section bearing on no one topic's subject is one of the topics' drawing on the spec, the session choosing which once every record is composed.

Its brief lists each of these as the check reads them, and the unit's other topics, each with what it is about, to judge whose a point is by: they are not sources. Each record is carried from its own sources alone, never another topic's log, brief or record: where another topic's says otherwise, each is carried as its own sources say.

## A Topic's Record

### What It Holds

Each current decision, finding and open question the topic's sources hold, and nothing else:

- **Current answers only.** Each question's answer as it now stands; an answer replaced later is left in the log. An approved spec of its unit is the current answer where it and the log differ, whether it draws on the topic or not, its corrigenda and amendments among it: a decision or proposal it replaces is left in the log; a question it answers is answered by a decision citing its section, or, in a record carried in discovery, where nothing is decided, by a finding saying so. A decision made at the spec stage — a review gap decided in the spec, an amendment, a corrigendum — is an entry of the topic it belongs to, citing the spec's section.
- **A shared spec.** From a spec several topics draw on, carry each point bearing on this topic's subject, its log discussing it or not, and each section its findings send it.
- **A cited section, whole.** A section of a spec drawing on the topic, cited, is carried whole: each current decision, finding and open question it holds that concerns this topic is an entry. Citing a section for one of its rules and leaving its others out is a gap. A section cited as a later answer gives that answer alone.
- **One thing per entry.** A decision holds one rule. A question settled in several rules is answered by several decisions, one for each, each answering it.
- **Cited.** Every entry cites the sections it came from, each by the nearest heading above its text; where its file holds that heading more than once — in a spec joined into `spec.md`, more than once in the parts the topic draws on, or in the whole file where none of them holds it — by its path, as many of the headings over it as tell it apart, then its own: `Identity & Naming > Decision`; and where headings share their whole path, siblings of one heading, by that path and its place among them, from one: `Skill Identity > Decision > revised [2]`, the second.
- **Who decided.** `by` `person`, `given` `own`, where a line of the source shows the person deciding; `by` `claude`, `given` `own`, where it shows Claude's own call; `by` `claude`, `given` `your-call` or `dont-care`, where the person handed the call over in those words; and where it shows no one, `by` `claude`, `given` `carried`. A question's `by` is whoever the source shows raising it, else `claude`.
- **How a finding is known.** A measured result is `known` `measured`, with its `command` and `result` as the log or the experiment's record gives them; one whose command neither gives is `read`, its `how` saying it was measured. Every other finding says `documented`, `spike` or `read`.
- **The old map.** Each subtopic of the old map is carried by an entry naming it, `map_item`: its decision where a source settles it, else an open question, whatever the map's state says; an entry carrying several names them all. The map is as it stood when last written: a later section of the log, or an approved spec, may have settled a subtopic it shows open.
- **Threads.** Each thread the register shows `open` or `digging` is carried by an entry naming it, `thread`: an open question where no source answers it, else the decision or finding that answers it, citing where.
- **A topic never started.** An epic's topic no item past discovery holds is carried in discovery, as its brief's topic line shows. Nothing is decided in discovery: its record holds questions and findings alone, none product-wide, and what its research concluded is a finding.
- **A unit's own record** is carried in discovery too, so it holds questions and findings alone, none product-wide. A record of no entries is one, where every point of the sessions bears on a topic's subject.
- **Assets.** Each of the unit's assets its brief marks the record's to link, and any other its log or brief links to, is linked as `reference` from the entry that draws on it. One its brief shows gone is linked from none.
- **A record at least.** A topic that draws on a spec, or whose log, brief or experiments' records — its markdown files — hold text past their headings, has an entry at least.
- **What no one measured.** A point a source names unmeasured, untested, unverified or left to check is carried: an open question, or a finding stating that it is unmeasured. A ruling sets it aside only where a later source measured it, or made it moot.
- **Sources at odds.** Where the sources, or the sections of one, contradict each other on a point, and no later source settles it, the record says so: the entries carrying each side name the other, or an open question names the contradiction and cites both.
- **Points no source settles** are open questions marked `raise` `true`, for the raises at the end, and they alone: a log unclear on what was decided, with no approved spec to settle it; a draft spec at odds with its log; a spec at odds with itself. Where an approved spec settles it, it is settled. Any other open question, one its sources leave for later work to answer, is carried unmarked. So is such a point where nothing raises it, and the carry refuses the mark there: on a topic never started, or a unit's own record, carried in discovery, where nothing is decided, for its first opening to read; of a cross-cutting unit, whose record is the product's, for the product's conversation; of a completed unit, whose code settled what it built; and of a cancelled or postponed unit, or a topic set aside, waiting with it.
- **Nothing invented.** An entry says what a source says, and nothing more.

### Its Shape

The record is one JSON object, `{"entries": [...]}`, its entries in the order they link: an entry links only to an entry before it.

- **`ref`**: the entry's name in the record, given once; every link names an entry by it, and no entry's words do: say in words what the other entry holds.
- **`event`**: `asked`, a question; `found`, a finding; or `decided`, a decision.
- **A question** holds `text` and `by`; `part_of`, the ref of the question it is part of, where it is one. It holds no `product_wide`: that is a decision's or a finding's alone.
- **A decision** holds `answers`, the ref of the question it answers, `text`, `why`, `by` and `given`; `rules_out`, `alternatives` and `evidence` where the source gives them, each a list of lines; and `product_wide`. The person's decision is given `own`; one given `your-call`, `dont-care` or `carried` is `by` `claude`.
- **A finding** holds `text`, `how`, `known` and `by`, a measured one its `command` and `result`; and `product_wide`.
- **`product_wide`**: `true` where the entry holds across the whole product — every command, every screen, every output — not only this topic's part of it: what the product is, who it is for, what it values, or a standing rule that cuts across topics. A CLI's exit codes, its error stream and its global flags are product-wide; one command's options are not. A cross-cutting unit's every finding and decision is product-wide.
- **Any entry** may hold `relies_on`, a list of the refs it rests on; `map_item` and `thread`, each a name or a list of names; and `assets`, a list of `{"path", "status"}`, each a file the state holds, `status` `reference` or `canonical`.
- **`cites`**: a list of `{"path", "section"}`, one at least: the file's path from the state's folder and a heading it holds, or the heading's path, `{heading} > {heading}`, the outermost first. A heading held more than once is cited by its path, `{"path": "{unit}/spec.md", "section": "Identity & Naming > Decision"}`, and one of headings sharing their whole path by its place among them, `"Skill Identity > Decision > revised [2]"`, as the walk sheet shows it: the carry refuses a cite naming several — a bare one tells none of its copies apart — and names those that tell them apart. The file is the topic's own, but its mail, or the unit's beside its topics — its assets, its `spec.md`, its discovery sessions — or, for a promoted topic, a discovery session of the unit it came from; never the cache, another topic's or another unit's.
- **`raise`**: `true` on a point no source settles, as the rules above name them, an open question no decision of the record answers; on no other entry.
- **`who_moved_whom`** is never given: an entry the migration carries moves no one.

```json
{"entries": [
  {"ref": "q1", "event": "asked", "text": "{question}", "by": "person", "map_item": "{subtopic}", "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}]},
  {"ref": "d1", "event": "decided", "answers": "q1", "text": "{answer}", "why": "{why}", "by": "claude", "given": "carried", "product_wide": false, "map_item": "{subtopic}", "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}], "assets": [{"path": "{unit}/assets/{file}", "status": "reference"}]},
  {"ref": "d2", "event": "decided", "answers": "q1", "text": "{second answer}", "why": "{why}", "by": "claude", "given": "carried", "product_wide": false, "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading} > {repeated heading}"}]},
  {"ref": "f1", "event": "found", "text": "{fact}", "how": "{how}", "known": "measured", "command": "{command}", "result": "{result}", "by": "claude", "product_wide": false, "relies_on": ["d1"], "cites": [{"path": "{unit}/topics/{topic}/experiments/{experiment}/report.md", "section": "{report heading}"}]},
  {"ref": "q2", "event": "asked", "text": "{open question}", "by": "claude", "thread": "{thread}", "raise": true, "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}]}
]}
```

## Working Through the Topics

Give each record the check names to the migration's per-topic agent; the records run side by side. `{place}` is the record's place: a topic's, `{unit}.{phase}.{topic}`, or a unit's own, `{unit}.discovery`, as the check names it. Its brief names where it writes the record, and how to check it before handing back:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief migration-topic --topic {place} --directive 079-records
```

A record composed already, by this session or an earlier one, is amended, never composed from the start: each brief carries the verifier's findings, every round's rulings, the carry's refusal and the points this session settled, waiting beside the record.

Once it has returned, settle first each finding it handed back, as below: the verifier's brief and the carry are refused while its hand-back file stands. Then, where no `Settled:` finding stands, check the record as the carry would; this names every fault and writes nothing:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger carry {place} --dry-run
```

Where it names a fault, a fresh per-topic agent amends the record, its own check naming the faults. Where it names none, the verifier reads the record against its sources, walking the sheet its brief draws: every section of every source, in order, with the entries citing each — from the second round, every section the sheet marks open, a closed one walked in an earlier round, nothing citing it changed since. It reads each section in its source, checks that what each entry beneath it takes from the section is what the section says, and each point the section makes is carried or not this record's — that a cited heading exists is no check — and writes its findings beside the record, an empty file its pass; its rulings: each point of the sources it ruled is not this record's, or is replaced by a later answer, one line each, with its source; and its verdict on each entry the sheet does not mark passed unchanged, `{ref}: ok` or `{ref}: see finding`. Its brief carries every round of findings and rulings before it, keeps the last as a round in the rounds file beside the record, its rulings and verdicts with it, and clears them, so a verifier that never writes leaves no verdict. The next brief and the carry are refused while the last verifier's verdicts miss an entry its brief asked a verdict of, or name one the record it read does not hold: remove what it wrote, and brief a fresh verifier. The carry refuses a record changed since its verifier was briefed on it — brief a fresh verifier — and keeps the passing round with the rounds before it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief migration-verifier --topic {place} --directive 079-records
```

Dispatch each brief's agent with its pointer alone. Where the verifier finds something, a fresh per-topic agent amends the record, its brief carrying the findings, and a fresh verifier reads what changed since, until one passes it. A file an agent left beside the records, which the check names, is removed.

A reversal is a finding against a point an earlier round's rulings set aside, opening `Reverses round {R}:`, R the round that ruled, or against one the session settled, opening `Reverses the session:`; a new point on what an earlier round passed, or on what its findings had the record changed to, is a finding as any other. A reversal goes to no agent, nor does a finding a per-topic agent handed back unanswered, asking for a point the rulings set aside, in the hand-back file beside the record, nor a finding the third round or a later one writes. Settle every handed-back finding before anything else. Settle the point from the record's sources; where they don't settle it, ask the person in prose, naming what each round found and the lines of the sources each rests on, and **STOP.** Wait for user response. Write what settles it, a line naming the point and the source or answer it rests on, into the settled file beside the record, which every later brief of it carries as closed. Of a round before the third, where it has the record change, replace the finding with `Settled: {point}, amend to agree`, and where it keeps the record as it stands, take the finding out of the findings file. Once every handed-back finding is settled, remove the hand-back file. Then, where a `Settled:` finding stands, a fresh per-topic agent amends the record to answer it, and a fresh verifier reads it again, its brief keeping it as a round.

A finding of the third round or a later one stays in the findings file as the verifier wrote it. Settle each as above, into the settled file, a finding kept as it stands among them; where one has the record change, a fresh per-topic agent amends it, its brief carrying the findings and the points settled. Then pass the record in the verifier's place, every finding of the round on stdin by its number, its list item's place in the findings file, one entry naming several settled alike: `{"findings": [{"numbers": [1, 3], "settled", "why"}]}`, `settled` `fixed` or `ruled-out`. The verifier's round and the session's after it are kept with the rounds, and the record goes to the carry as it stands:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger settle {place}
```

A finding the session writes itself, a section the check names below among them, always goes to a fresh verifier once the record is amended, never to the settlement, which is refused while the session's pass is the last.

Where none stands after a hand-back, the findings left are those the agent answered: check the record, and a fresh verifier reads it next. Where none stands after a reversal, a finding left goes to a fresh per-topic agent, and where none is left, the file empty, the record has passed. An empty findings file is only ever a pass.

Once every topic of a unit has its record composed, read each draft spec several of its topics draw on: a section of it bearing on no one topic's subject goes into the findings of one of the topics drawing on it, as below, for the check names an approved spec's sections alone. Then the check names, on the topics drawing on each of the unit's approved specs, each section of it holding text that no record cites: a decision made at the spec stage on a subject no log discusses is in no other source. In a spec joined into `spec.md` a section is its part's, and the check names its part; a section whose heading its part, or a kept spec, holds more than once, it names by its path. Read each such section. Where it holds a decision, a finding or an open question of a topic's, write it into the findings of the topic its subject belongs to, one of those the check names it on, naming the section and what the record misses, and that topic's record is amended and verified again. Where that topic's rulings set the section aside, write what settles it into its settled file instead, a line naming the section as the topic's, and the finding as `Settled: {section}, amend to agree`. Where it holds none, a section that frames the others or says again what a cited one holds, mark it in `.cache/migrate/records/{unit}.sections.json` as the check names the mark: `{"{path}": ["{section}", …]}`, or in a joined spec under its part, `{"{path}": {"{part}": ["{section}", …]}}`, a section named by its path marked by that path.

So a unit's topics are carried in order: compose every topic's record, have each verifier pass it, settle the sections the check names, then carry them. The carry of a record of a unit with an approved spec, its own among them, waits until each of the unit's topics has its record passed by its verifier and the check names no such section, naming what it waits on.

Carry each record its verifier has passed, which reads the record where the brief said it goes and appends it whole in one write:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger carry {place}
```

Carrying refuses a record neither its verifier nor the session has passed, its findings file missing or holding findings, writing nothing: the carry clears that file, and a record is carried once. It holds the record to the check's rules before it writes anything. A record that breaks one is refused, naming every fault, the refusal kept beside the record for the next brief, and nothing is carried: a fresh per-topic agent amends it, its brief carrying the refusal, and it is checked, verified and carried again. An agent's record is never edited by hand.

## The Raises at the End

Once every record is carried, the check passes, and its answer lists under `raise` each point still to raise, `{"place", "answers", "text"}`: an open question marked `raise` that no raise of this conversation has drawn. Read them there whenever you need them, never from memory. Before the directive's checklist is closed, raise each, one at a time, as a decision only the person can make, at its `place`, answering its question. A point two records carry, listed twice, is raised once.

The raise takes one JSON object on stdin, `{"question", "rows", "mechanism", "product_wide"}`: the point as the person reads it, cold; the rows, only where the answers are few and known, else `[]`, each `{"key", "name", "text", "notice"}` — its key, a short name for the answer, the answer, and what the person would notice were it the one, each one line; what the sources say of it and where, as the mechanism; and whether its answer holds for the whole product, `true` or `false`.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs raise {place} --answers {answers} --fact
```

Record the person's answer with `raise answer {id}`, the raise's id: a row they pick, `--pick {key}`, with `{"why"}` on stdin; their own words, `--own`, with `{"text", "why"}`. A point they leave open stays an open question on its topic. Where another record carries the point, record the answer on it too: merge its question into the answer, `{answered}` the `id` `raise answer` answered, with `{"by": "claude", "who_moved_whom": "none"}` on stdin:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger merge {place} --question {answers} --into {answered}
```
