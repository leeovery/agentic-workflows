# Records

## Touches

- The ledger, through `ledger carry`, one record at a time, and through
  `raise`, `raise answer`, `ledger merge` and `ledger replace` for the
  points raised at the end.
- Each record as composed, the verifier's findings, rulings and verdicts
  on it and every round of them before, the findings its composer handed back, the
  points the session settled, and a carry's refusal of it, in the state's cache, where its brief names them;
  and each unit's sections of its specs, its discovery sessions and its
  assets that hold no record's decision, finding or open question,
  `.cache/migrate/records/{unit}.sections.json`, and each contradiction a
  record names that another record citing it carries no side of,
  `.cache/migrate/records/{unit}.at-odds.json`.

## Asks

- Nothing for any one entry, but a point the record's sources do not
  settle that a verifier reverses, that a composer hands back, or that a
  finding of the third round or a later one raises.
- At the end, each point no source settles on a started topic of a unit
  in progress that stays in its unit, raised one at a time: answered, or
  left open.

## What It Does

Every topic of every unit gets its record in the ledger, completed and cancelled units among them: what its sources settle, carried forward one entry at a time. A quick-fix holds no topic, and nothing of it is carried. Nor is anything of a cancelled unit holding an approved spec and no topic: its spec stays in its assets, the reference it is, and a cancelled unit's decisions govern nothing. A topic an epic promoted to a cross-cutting unit is carried on that unit, never on the epic. Each epic whose discovery holds a session gets a record of its own too, `{unit}.discovery`: each point of its discovery sessions bearing on no topic's subject, carried at the epic's discovery. A unit of one topic has none: its discovery is its topic's.

Paths below are from the state's folder, but one under `.workflows/`, which is from the project's folder in the main checkout. Run every engine call from the project's folder: a brief names each file its agent reads or writes by its whole path, and the check each file it asks the session to write. `{phase}` is the phase the topic's item is in: discussion; investigation for a bugfix's topic; discovery for an epic's topic never started.

## A Topic's Sources

- Its log, `{unit}/topics/{topic}/log.md`, its brief, `brief.md` beside it, and its experiments' records in `experiments/`.
- Its specs: each spec that draws on the topic, kept in `{unit}/assets/specs/` while the unit's building has not started, and joined into `{unit}/spec.md` once it has, each spec a part of it under its own numbered heading. Its brief marks each approved or a draft.
- Its unit's approved specs it does not draw on, kept or joined the same way: the later answer to each of its points.
- Its old discussion map and its research's threads, in its unit's manifest under `.workflows/`, as the move read them; a promoted topic's research as the unit it came from holds it.
- Its reviews never folded in, which the move appended to its log, each under `## Review {id}, never folded in`.
- Its unit's discovery sessions, `{unit}/discovery/session-{NNN}.md`, the migration's own among them where research fed several topics, and for a promoted topic those of the unit it came from.
- Its unit's assets its brief lists to walk: each markdown file in `{unit}/assets/` but its specs and its legacy files — the documents the person shared; and the research a legacy split superseded, in `assets/research/`, a topic's where it bears the topic's name, else the unit's own record's alone. Its later answers decide what of an asset is current, as of any source.

A unit's own record has the unit's discovery sessions, the assets its brief lists to walk, and the threads still open of research under no topic's name that its brief lists, as its sources.

A point in a shared source — a discovery session, an asset of the unit, a spec several topics draw on, research that fed several topics — belongs to the record of the topic whose subject it bears on, whether or not it names the topic. A point of the discovery sessions, their research or the unit's assets bearing on no topic's subject is the unit's own record's, `{unit}.discovery`, where the unit has one, an epic's; in a unit of one topic, it is that topic's. A spec section bearing on no one topic's subject is one of the topics' drawing on the spec, the session choosing which once every record is composed.

Its brief lists each of these as the check reads them; and the unit's other topics, each with what it is about, to judge whose a point is by, and the unit's other assets, each with where it came from: they are not sources. Each record is carried from its own sources alone, never another topic's log, brief or record — where another topic's says otherwise, each is carried as its own sources say — and never the project's code: a record is what its sources decided.

## A Topic's Record

### What It Holds

Each current decision, finding and open question the topic's sources hold, and nothing else:

- **Current answers only.** Each question's answer as it now stands; an answer replaced later is left in the log. Two things are a later answer, where they and what came before them differ: an approved spec of its unit, whether it draws on the topic or not, its corrigenda and amendments among it, to what the log settled before the spec was approved; and the log's own word, a scope note, wherever it stands in the log, or a later section, that sets material aside, delegates it or puts it out of scope. Its brief dates each approved spec's approval where the old manifest does, to judge by against the dates the log's headings carry; where no date shows otherwise, the log came before the spec, but for a section appended after its approval, such as a review never folded in. A decision or proposal a later answer replaces is left in the log, and so is a finding it overtakes — a figure, a behaviour or a fact it states otherwise, or a point it settles that the finding calls unknown or unverified; a question it answers is answered by a decision citing its section, or, in a record carried in discovery, where nothing is decided, by a finding saying so. Where a later answer replaces part of a decision or a finding, the entry carries only what still stands. Research's findings and recommendations are held to their later answers as a discussion's decisions are, and so is a topic set aside, cancelled or postponed: its entries wait with it, current again once it returns. The approved specs the topic draws no part of are searched for each of its points, and only the sections of them an entry cites are walked. A point the log settled after the spec was approved, otherwise than the spec, is the log's, and current: its entry names the spec's section it departs from, and the two are not at odds. A corrigendum a cancelled unit wrote, one of the units its brief lists so, is no later answer for what that unit itself decided: a cancelled unit's decisions govern nothing, so the point stands as its other sources have it, and the corrigendum is carried, if at all, as a finding naming that unit, never as current. One recording what a unit not cancelled changed stays a later answer. A decision made at the spec stage — a review gap decided in the spec, an amendment, a corrigendum — is an entry of the topic it belongs to, citing the spec's section.
- **A shared spec.** From a spec several topics draw on, carry each point bearing on this topic's subject, its log discussing it or not, and each section its findings send it.
- **A cited section, whole.** A section of a spec drawing on the topic, cited, is carried whole: each current decision, finding and open question it holds that concerns this topic is an entry. Citing a section for one of its rules and leaving its others out is a gap. A section cited as a later answer gives that answer alone.
- **One thing per entry.** A decision holds one rule. A question settled in several rules is answered by several decisions, one for each, each answering it.
- **Cited.** Every entry cites the sections it came from, each by the nearest heading above its text; where its file holds that heading more than once, by its path, as many of the headings over it as tell it apart, then its own: `Identity & Naming > Decision`; in a spec joined into `spec.md`, where another part holds it too, by its part's heading first, whatever headings stand between: `2. Switching > Dependencies`; and where headings share their whole path, siblings of one heading, by that path and its place among them, from one: `Skill Identity > Decision > revised [2]`, the second.
- **Who decided.** `by` `person`, `given` `own`, where a line of the source shows the person deciding; `by` `claude`, `given` `own`, where a line shows Claude making the call itself; `by` `claude`, `given` `your-call` or `dont-care`, where the person handed the call over in those words; and where it shows no one deciding, `by` `claude`, `given` `carried`. A recommendation, a proposal or a conclusion no line shows anyone taking up — research's among them — shows no one deciding, whoever wrote it. A question's `by` is whoever the source shows raising it, else `claude`.
- **How a finding is known.** A measured result is `known` `measured`, with its `command` and `result` as the log or the experiment's record gives them; one whose command neither gives is `read`, its `how` saying it was measured. Every other finding says `documented`, where its source has it from documentation; `spike`, from a spike; or `read`, from reading the code or a file.
- **The old map.** Each subtopic of the old map is carried by an entry naming it, `map_item`: its decision where a source settles it, else an open question, whatever the map's state says; an entry carrying several names them all. The map is as it stood when last written: a later section of the log, or an approved spec, may have settled a subtopic it shows open.
- **Threads.** Each thread its brief lists, `open` or `digging` in the register, is carried by an entry naming it, `thread`: an open question where no source answers it, else the decision or finding that answers it, citing where.
- **A topic never started**, as its brief's topic line shows: an epic's topic no item past discovery holds, carried in discovery, or one whose item is `unstarted`, a message waiting on it never opened. Nothing is decided before its discussion opens: its record holds questions and findings alone, none product-wide, and what its research concluded is a finding.
- **A unit's own record** is carried in discovery too, so it holds questions and findings alone, none product-wide. A record of no entries is one, where every point of the sessions bears on a topic's subject.
- **Assets.** Each of the unit's assets its brief marks the record's to link, and any other its log or brief links to, is linked as `reference` from the entry that draws on it. One its brief shows gone is linked from none.
- **A record at least.** A topic that draws on a spec, or whose log, brief or experiments' records — its markdown files — hold text past their headings, has an entry at least.
- **What no one measured.** A point a source names unmeasured, untested, unverified or left to check is carried: an open question, or a finding stating that it is unmeasured. A ruling sets it aside only where a later source measured it or made it moot, or a scope note of the log, wherever it stands, puts it out of scope.
- **Sources at odds.** Where the sources, or the sections of one, contradict each other on a point, and no later source settles it, the record says so, and settles the point on neither side: an open question names the contradiction, cites both and holds the sections at odds as its `at_odds`, no decision answering it, nor any question part of it — and where each side is a finding, the findings name each other. It is a point no source settles, marked `raise` as the rules below say. A record naming a contradiction carries neither side of it as settled.
- **Points no source settles** are open questions marked `raise` `true`, for the raises at the end, and they alone: a log unclear on what was decided, with no approved spec to settle it; a draft spec at odds with its log; a spec at odds with itself. Where an approved spec settles it, it is settled, unless the log settled it after the spec's approval, as above. Any other open question, one its sources leave for later work to answer, is carried unmarked. So is such a point where nothing raises it, and the carry refuses the mark there: on a topic never started, carried in discovery or its item `unstarted`, for its first opening to read; on a topic leaving its building unit, as its brief's topic line shows, for its discussion where it goes; on a unit's own record, carried in discovery, where nothing is decided; of a cross-cutting unit, whose record is the product's, for the product's conversation; of a completed unit, whose code settled what it built; and of a cancelled unit, or a topic set aside, waiting with it.
- **Nothing invented.** An entry says what a source says, and nothing more.

### Its Shape

The record is one JSON object, `{"entries": [...]}`, its entries in the order they link: an entry links only to an entry before it. Where its brief says no map row says what the topic is about, the record says it beside its entries, `"description"`, one line, which the other topics' briefs list it by.

- **`ref`**: the entry's name in the record, given once; every link names an entry by it, and no entry's words do: say in words what the other entry holds.
- **`event`**: `asked`, a question; `found`, a finding; or `decided`, a decision.
- **A question** holds `text` and `by`; `part_of`, the ref of the question it is part of, where it is one. It holds no `product_wide`: that is a decision's or a finding's alone.
- **A decision** holds `answers`, the ref of the question it answers, `text`, `why`, `by` and `given`; `rules_out`, `alternatives` and `evidence` where the source gives them, each a list of lines; and `product_wide`. The person's decision is given `own`; one given `your-call`, `dont-care` or `carried` is `by` `claude`.
- **A finding** holds `text`, `how`, `known` and `by`, a measured one its `command` and `result`; and `product_wide`.
- **`product_wide`**: `true` where the entry holds across the whole product — every command, every screen, every output — not only this topic's part of it: what the product is, who it is for, what it values, or a standing rule that cuts across topics. A CLI's exit codes, its error stream and its global flags are product-wide; one command's options are not. A cross-cutting unit's every finding and decision is product-wide.
- **Any entry** may hold `relies_on`, a list of the refs it rests on; `map_item` and `thread`, each a name or a list of names; and `assets`, a list of `{"path", "status"}`, each a file the state holds, `status` `reference` or `canonical`.
- **`cites`**: a list of `{"path", "section"}`, one at least: the file's path from the state's folder and the section, named as **Cited** says, `{"path": "{unit}/spec.md", "section": "2. Switching > Dependencies"}`: the carry refuses a cite naming several — a bare one tells none of its copies apart — and names those that tell them apart. The file is the topic's own, but its mail, or the unit's beside its topics — its assets, its `spec.md`, its discovery sessions — or, for a promoted topic, a discovery session of the unit it came from; never the cache, another topic's or another unit's.
- **`raise`**: `true` on a point no source settles, as the rules above name them, an open question no decision of the record answers; on no other entry.
- **`at_odds`**: on an open question naming sources at odds, never a finding or a decision, the sections at odds, `[{"path", "section"}, …]`, two at least, each one its cites name.
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

Run the check after each agent returns. It names each record's next step, `next`, as the rules below have it; take that step:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs migrate check 079-records
```

Once the per-topic agent has returned, settle first each finding it handed back, as below: the verifier's brief and the carry are refused while its hand-back file stands. Then, where no `Settled:` finding stands, check the record as the carry would; this names every fault and writes nothing:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger carry {place} --dry-run
```

Where it names a fault, a fresh per-topic agent amends the record, its own check naming the faults. Where it names none, the verifier reads the record against its sources, walking the sheet its brief draws: every section of every source, in order, with the entries citing each — from the second round, every section the sheet marks open, a closed one walked in an earlier round, every entry citing it passed unchanged, and none that cited it then gone from it — a section an entry stopped citing is open again. It reads each section in its source, checks that what each entry beneath it takes from the section is what the section says, and each point the section makes is carried or not this record's — that a cited heading exists is no check — and writes its findings beside the record, an empty file its pass; its rulings: each point of the sources it ruled is not this record's, or is replaced by a later answer, in whole or in part, naming what still stands, one line each, with its source; and its verdict on each entry the sheet does not mark passed unchanged, `{ref}: ok` or `{ref}: see finding`. Its brief carries every round of findings and rulings before it, keeps the last as a round in the rounds file beside the record, its rulings and verdicts with it, and clears them, so a verifier that never writes leaves no verdict. The next brief and the carry are refused while the last verifier's verdicts miss an entry its brief asked a verdict of, or name one the record it read does not hold: remove what it wrote, and brief a fresh verifier. The carry refuses a record changed since its verifier was briefed on it — brief a fresh verifier — and keeps the passing round with the rounds before it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief migration-verifier --topic {place} --directive 079-records
```

Dispatch each brief's agent with its pointer alone. Where the verifier finds something, a fresh per-topic agent amends the record, its brief carrying the findings, and a fresh verifier reads what changed since, until one passes it. A file an agent left beside the records, which the check names, is removed.

A reversal is a finding against a point an earlier round's rulings set aside, opening `Reverses round {R}:`, R the round that ruled, or against one the session settled, opening `Reverses the session:`; a new point on what an earlier round passed, or on what its findings had the record changed to, is a finding as any other. A reversal goes to no agent, nor does a finding a per-topic agent handed back unanswered, asking for a point the rulings set aside, in the hand-back file beside the record, nor a finding the third round or a later one writes. Settle every handed-back finding before anything else. Settle the point from the record's sources; where they don't settle it, ask the person in prose, naming what each round found and the lines of the sources each rests on, and **STOP.** Wait for user response. Write what settles it, a line naming the point and the source or answer it rests on, into the settled file beside the record, as its brief names it, which every later brief of it carries as closed. Of a round before the third, where it has the record change, replace the finding with `Settled: {point}, amend to agree`, and where it keeps the record as it stands, take the finding out of the findings file. Once every handed-back finding is settled, remove the hand-back file. Then, where a `Settled:` finding stands, a fresh per-topic agent amends the record to answer it, and a fresh verifier reads it again, its brief keeping it as a round.

A finding of the third round or a later one stays in the findings file as the verifier wrote it. Settle each as above, into the settled file, a finding kept as it stands among them; where one has the record change, a fresh per-topic agent amends it, its brief carrying the findings and the points settled. Then pass the record in the verifier's place, every finding of the round on stdin by its number, its list item's place in the findings file, one entry naming several settled alike: `{"findings": [{"numbers": [1, 3], "settled", "why"}]}`, `settled` `fixed` or `ruled-out`. The verifier's round and the session's after it are kept with the rounds, and the record goes to the carry as it stands:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger settle {place}
```

A finding the session writes itself, a section the check names below among them, always goes to a fresh verifier once the record is amended, never to the settlement, which is refused while the session's pass is the last.

Where none stands after a hand-back, the findings left are those the agent answered: check the record, and a fresh verifier reads it next. Where none stands after a reversal, a finding left goes to a fresh per-topic agent, and where none is left, the file empty, the record has passed. An empty findings file is only ever a pass.

Once every record of a unit is composed, read each draft spec several of its topics draw on: a section of it bearing on no one topic's subject goes to one of the topics drawing on it, as below, for the check names an approved spec's sections alone. Then the check names each section holding text that no record cites: of each of the unit's approved specs, on the topics drawing on it, for a decision made at the spec stage on a subject no log discusses is in no other source; and of each of its discovery sessions and each asset its records walk, on the topic an asset came in from or a split's research bears the name of, else on the unit's own record, else on each of its topics — never a section any topic of the unit holds word for word in its own files, of a session a topic the unit promoted too, which that topic's verifier walks there with its log's later word, but for a section whose text is one line under 40 characters. A cite by any record of the unit settles a section of a session or an asset, whichever records walk it; of a session, a cite by a topic the unit promoted too. The check names each section as a cite names it alone: in a spec joined into `spec.md`, by its part's heading first. Read each such section. Where it holds a current decision, finding or open question, it goes to the record its subject belongs to — of a spec's section, one of the topics the check names it on: write into that record's settled file, as the check names it, a line naming the section as the record's and what of it the record misses, and into its findings `Settled: {section}, amend to agree`. That record is amended to carry it, whatever its rulings said of whose the point is, and verified again. Where it holds none — a section that frames the others, says again what a cited one holds, holds only what a later answer replaced, or is a corrigendum recording only what a cancelled unit decided — mark it in `.cache/migrate/records/{unit}.sections.json`, only once you have read it and never by a script over the check's list, as the check names the mark: `{"{path}": ["{section}", …]}`, or in a joined spec under its part, `{"{path}": {"{part}": ["{section}", …]}}`, a section named by its path marked by that path.

Once every record of a unit is composed, the check names too each contradiction a record names between sections of the sources its unit's records share — its approved specs, its discovery sessions and the assets its records walk — on each other record citing one of those sections where no entry of it names the same, its `at_odds` holding those sections: the sections, each dated where its source shows when it was approved or written, those it cites and the records naming them. Read what it cites of them, and judge first whether the contradiction stands. Where a later answer settles it — an approved spec, or a part of one, approved after the other side was written — it goes to each record naming it, and to the citing record where it carries the side the later answer replaced: a line in each one's settled file, as its brief names it, naming the section that settles it, and into its findings `Settled: {sections} settled by {section}, amend to agree` — the point is then no point at odds: no entry holds `at_odds` for it, its question is not marked `raise`, and the decision agreeing with the later answer answers it; the citing record keeps its answer only where it is the later one. Write every line a later answer owes, on each record naming the contradiction and on each record the check names it on that carries the replaced side, before any of them is amended: once no record names it, the check names it on none. Where the citing record's own log settled the point after the approval, its answer is its log's: mark it in `.cache/migrate/records/{unit}.at-odds.json` as its log's, as the check names the mark, and the record naming the contradiction keeps naming what its own sources hold. Where it stands and the citing record carries a side of the point at odds, write into its settled file, as the check names it, a line naming the sections at odds and the point, and that the record carries neither side as settled, and into its findings `Settled: {sections} at odds, amend to agree`. It is amended to carry neither side as settled, naming the contradiction as the record naming it does, its `at_odds` holding the same sections, and verified again. Where what it cites of them is not the point at odds, mark it there as the check names that mark.

So a unit's records are carried in order: compose every record, have each verifier pass it, settle the sections and the contradictions the check names, then carry them. The carry of a record of a unit with an approved spec, or with a discovery session or an asset its records walk holding text, its own among them, waits until each record drawing on them has passed its verifier or the session's settlement — of a session, the unit's own and a topic it promoted among them — and the check names no such section nor contradiction, naming what it waits on, or how many of them the check names. Every record of a unit a topic was promoted to waits on the unit it came from in the same way.

Carry each record its verifier has passed, which reads the record where the brief said it goes and appends it whole in one write:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger carry {place}
```

Carrying refuses a record neither its verifier nor the session has passed, its findings file missing or holding findings, writing nothing: the carry clears that file, and a record is carried once. It holds the record to the check's rules before it writes anything. A record that breaks one is refused, naming every fault, the refusal kept beside the record for the next brief, and nothing is carried: a fresh per-topic agent amends it, its brief carrying the refusal, and it is checked, verified and carried again. An agent's record is never edited by hand.

## The Raises at the End

Once every record is carried, the check passes, and its answer lists under `raise` each point still to raise, `{"place", "answers", "text", "candidates"}`: an open question marked `raise` that no raise of this conversation has drawn, listed until it is answered or merged; and beside it, as `candidates`, each other record's question marked `raise` naming a contradiction between the same sections, `{"place", "answers", "text", "raised", "answered"}`: its text, `raised` where this conversation drew it, and `answered`, each answer it holds already, `{"id", "text"}`; and, as `settled_on`, each record marked as its own log's for the same sections, `{"place", "decisions"}`, each decision of it citing a side still current, `{"id", "text"}`. A point with `settled_on` stays listed, once answered with its own `answered`, until each is done; one the person leaves open is raised, and listed no more. Read them there whenever you need them, never from memory. Before the directive's checklist is closed, raise each, one at a time, as a decision only the person can make, at its `place`, answering its question. Judge from the texts whether a candidate, or any other point listed, is the same point: the same sections at odds never say so alone. A point two records carry is raised once, its answer recorded on the other; where it was raised and left open, it stays open on the other record too, raised no further; a different point between the same sections is raised on its own. Where a point is `settled_on` a record, tell the person, as its mechanism, that that record's own log settled it after the approval, and how: its decisions' texts.

The raise takes one JSON object on stdin, `{"question", "rows", "mechanism", "product_wide"}`: the point as the person reads it, cold; the rows, only where the answers are few and known, else `[]`, each `{"key", "name", "text", "notice"}` — its key, a short name for the answer, the answer, and what the person would notice were it the one, each one line; what the sources say of it and where, as the mechanism; and whether its answer holds for the whole product, `true` or `false`.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs raise {place} --answers {answers} --fact
```

Record the person's answer with `raise answer {id}`, the raise's id: a row they pick, `--pick {key}`, with `{"why"}` on stdin; their own words, `--own`, with `{"text", "why"}`. A point they leave open stays an open question on its topic. Where another record carries the point, record the answer on it too: merge its question, at its own `place` as listed, into the answer, `{answered}` the `id` `raise answer` answered, or the `id` of a candidate's `answered` where its question was answered first and its text answers this point, with `{"by": "claude", "who_moved_whom": "none"}` on stdin:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger merge {place} --question {answers} --into {answered}
```

Where a point is `settled_on` a record, once the person answers it: where the answer agrees with that record's decisions, nothing changes on that record — mark it so, `"agrees": true` beside its `log` mark. Where it differs, the person's answer is the newer one: record it on that record too, replacing each of its decisions listed, at the record's `place` as listed, `{answered}` the `id` `raise answer` answered, with `{"text", "why", "by": "person", "given": "own", "who_moved_whom": "none", "drops"}` on stdin, the person's answer, why, and `drops` the replaced decision's text:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs ledger replace {place} --replaces {id} --reason other-topic --cause {answered}
```
