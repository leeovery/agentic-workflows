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

Paths below are from the state's folder, but one under `.workflows/`, which is from the project's folder in the main checkout; a topic's brief names both. `{phase}` is the phase the topic's item is in: discussion; investigation for a bugfix's topic; discovery for an epic's topic never started.

## A Topic's Sources

- Its log, `{unit}/topics/{topic}/log.md`, its brief, `brief.md` beside it, and its experiments' records in `experiments/`.
- Its specs: each spec that draws on the topic, kept in `{unit}/assets/specs/` while the unit's building has not started, and still in `.workflows/` once it has.
- Its old discussion map and its research's threads, as the code branch's HEAD holds them in the main checkout, never a working tree; a promoted topic's research as the unit it came from holds it.
- Its reviews never folded in, which the move appended to its log, each under `## Review {id}, never folded in`.

Its brief lists each of these as the check reads them.

## A Topic's Record

Compose the record from the sources:

- **Current answers only.** Each question's answer as it now stands; an answer replaced later is left in the log.
- **One thing per entry.** A decision holds one rule.
- **Cited.** Every entry cites where it came from, `cites`: each `{"path", "section"}`, the file's path and the nearest heading above the text whose wording its file holds once. The file is the topic's own — its log, its brief, an experiment's record — or the unit's: one of its assets, or its `spec.md`; never another topic's. A heading the file repeats, such as each subtopic's `Decision`, names no one section, so the cite takes the heading above it. A decision made at the spec stage — a review gap decided in the spec, an amendment, a corrigendum — is an entry of the topic it belongs to, citing the spec's section: at `{unit}/assets/specs/{spec}.md`, or at `{unit}/spec.md` where the unit's building has started, since the next step joins its specs into that file verbatim, so a heading two of them share names no one section there.
- **Who decided.** `by` `person` where the source shows the person deciding; `by` `claude`, `given` `own`, where it shows Claude's own call; `given` `your-call` or `dont-care` where the person handed the call over in those words; and where it shows no one, `by` `claude`, `given` `carried`. A question's `by` is whoever the source shows raising it, else `claude`.
- **How a finding is known.** A measured result is `known` `measured`, with its `command` and `result` as the log or the experiment's record gives them; one whose command neither gives is `read`, its `how` saying it was measured. Every other finding says `documented`, `spike` or `read`.
- **Open questions.** A question no decision of the record answers is open.
- **The old map.** Every subtopic the old map shows decided is carried by an entry naming it, `map_item`: by its decision, or by an open question where no source says what was decided. Every one pending, exploring, converging or deferred is carried by an open question naming it. An entry that settles several names them all, `map_item` a list.
- **Threads.** Every thread the register shows `open` or `digging` is carried by an open question naming it, `thread`, a list where one question carries several.
- **Nothing invented.** An entry says what a source says, and nothing more.
- **Product-wide.** An entry that holds for the whole product is `product_wide` `true`.
- **Assets.** Each of the unit's assets its brief marks the topic's to link, and any other its log or brief links to, is linked as `reference` from the entry that draws on it. One its brief shows gone is linked from none.
- **A record at least.** A topic whose log holds anything has an entry at least.
- **Points no source settles** — what was decided where the log is unclear, a log at odds with its spec — are open questions marked `raise` `true`, for the raises at the end.

The record is one JSON object. Each entry names itself by its `ref`, and links to an entry before it by that ref: a decision's `answers`, a question's `part_of`, any entry's `relies_on`. The rest is the content its event takes, as `ledger ask`, `find` and `decide` take it:

```json
{"entries": [
  {"ref": "q1", "event": "asked", "text": "{question}", "by": "person", "map_item": "{subtopic}", "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}]},
  {"ref": "d1", "event": "decided", "answers": "q1", "text": "{answer}", "why": "{why}", "by": "claude", "given": "carried", "map_item": "{subtopic}", "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}], "assets": [{"path": "{unit}/assets/{file}", "status": "reference"}]},
  {"ref": "f1", "event": "found", "text": "{fact}", "how": "{how}", "known": "measured", "command": "{command}", "result": "{result}", "by": "claude", "cites": [{"path": "{unit}/topics/{topic}/experiments/{experiment}/report.md", "section": "{report heading}"}]}
]}
```

## Working Through the Topics

A topic the check names is composed from the start, never from what an earlier session left of it. Each brief takes the verifier's findings and the carry's refusal waiting beside the topic's record, and clears them, as a carry does, so none reaches a later brief.

Give each topic to the migration's per-topic agent; the topics run side by side. Its brief names where it writes the record:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief migration-topic --topic {unit}.{phase}.{topic} --directive 079-records
```

Then the verifier reads each record against its sources and writes its findings beside it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief migration-verifier --topic {unit}.{phase}.{topic} --directive 079-records
```

Dispatch each brief's agent with its pointer alone. Where the verifier finds something, a fresh per-topic agent composes the record again, its brief carrying the findings, and the verifier reads it again, until it passes the record. Then carry it, which reads the record where the brief said it goes and appends it whole in one write:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs ledger carry {unit}.{phase}.{topic}
```

Carrying holds the record to the check's rules before it writes anything. A record that breaks one is refused, naming what it breaks, the refusal kept beside the record for the next brief, and nothing is carried: a fresh per-topic agent composes it again, its brief carrying the refusal, and it is verified and carried again. An agent's record is never edited by hand.

## The Raises at the End

Once every topic is carried, the check passes, and its answer lists under `raise` each point still to raise, `{"place", "answers", "text"}`: an open question marked `raise`, on a live topic, that no raise of this conversation has drawn. Read them there whenever you need them, never from memory. Before the directive's checklist is closed, raise each, one at a time, as a fact only the person holds, at its `place`, answering its question. A point on a topic or unit that isn't live, cancelled or postponed, is not listed: it stays an open question on its topic, left open until the topic returns. Nor is a point on a topic never started, carried in discovery, where nothing is decided: it stays an open question on its topic, for its discussion to open with.

The raise takes one JSON object on stdin, `{"question", "rows", "mechanism", "product_wide"}`: the point as the person reads it, cold; the rows, each `{"key", "name", "text", "notice"}`, only where the answers are few and known, else `[]`; what the sources say of it and where, as the mechanism; and whether its answer holds for the whole product, `true` or `false`.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs raise {place} --answers {answers} --fact
```

Emit its sections verbatim per their markers. Record the person's answer with `raise answer {id}`, the raise's id: a row they pick, `--pick {key}`, with `{"why"}` on stdin; their own words, `--own`, with `{"text", "why"}`. A point they leave open stays an open question on its topic.
