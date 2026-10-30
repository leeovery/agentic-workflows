# Records

## Touches

- The ledger, through `ledger carry`, one topic's record at a time, and
  through `raise` for the points raised at the end.
- Each topic's log, `.leeway/{unit}/topics/{topic}/log.md`, to fold in a
  review never folded in.
- Each topic's record as composed, and the verifier's findings on it, in
  `.leeway/.cache/migrate/records/{unit}/`.

## Asks

- Nothing for any one entry.
- At the end, each point no source settles, raised one at a time: answered,
  or left open.

## What It Does

Every topic of every unit gets its record in the ledger, completed and cancelled units among them: what its sources settle, carried forward one entry at a time. A quick-fix holds no topic, and nothing of it is carried. Paths below are from `.leeway/` unless they name `.workflows/`.

## A Topic's Sources

- Its log, `{unit}/topics/{topic}/log.md`, its brief, `brief.md` beside it, and its experiments' records in `experiments/`.
- Its spec. Where the unit's building has not started, `{unit}/assets/specs/{topic}.md`. Where it has, the spec is still at `.workflows/{unit}/specification/{spec}/specification.md`, the one whose sources name the topic.
- Its old discussion map: `phases.discussion.items.{topic}.subtopics` in `.workflows/{unit}/manifest.json`, each subtopic with its state.
- Its reviews never folded in: each row of `.workflows/.cache/{unit}/{research|discussion|investigation}/{topic}/state.json` of kind `review` whose status is not `incorporated` and whose report, `{id}.md` beside it, landed.

## A Topic's Record

First append each review never folded in to the end of the topic's log, verbatim, under `## Review {id}, never folded in`. Then compose the record from the sources:

- **Current answers only.** Each question's answer as it now stands; an answer replaced later is left in the log.
- **One thing per entry.** A decision holds one rule.
- **Cited.** Every entry cites where it came from, `cites`: each `{"path", "section"}`, the file's path and the nearest heading above the text. A decision made at the spec stage — a review gap decided in the spec, an amendment, a corrigendum — is an entry of the topic it belongs to, citing the spec's section: at `{unit}/assets/specs/{topic}.md`, or at `{unit}/spec.md` where the unit's building has started, since the next step joins its specs into that file verbatim.
- **Who decided.** `by` `person` where the source shows the person deciding; `by` `claude`, `given` `own`, where it shows Claude's own call; `given` `your-call` or `dont-care` where the person handed the call over in those words; and where it shows no one, `by` `claude`, `given` `carried`. A question's `by` is whoever the source shows raising it, else `claude`.
- **How a finding is known.** A measured result is `known` `measured`, with its `command` and `result` as the log or the experiment's record gives them; one whose command neither gives is `read`, its `how` saying it was measured. Every other finding says `documented`, `spike` or `read`.
- **Open questions.** An item still exploring or pending is an open question.
- **The old map.** Every subtopic the old map shows decided, pending, exploring or converging is carried by an entry naming it, `map_item`: a decided one by its decision, or by an open question where no source says what was decided; any other by its open question.
- **Nothing invented.** An entry says what a source says, and nothing more.
- **Product-wide.** An entry that holds for the whole product is `product_wide` `true`.
- **Assets.** Each of the unit's assets that came in from the topic, or that its log or brief links to, is linked as `reference` from the entry that draws on it.
- **Points no source settles** — what was decided where the log is unclear, a log at odds with its spec — are open questions, kept for the raises at the end.

The record is one JSON object. Each entry names itself by its `ref`, and links to an entry before it by that ref: a decision's `answers`, a question's `part_of`, any entry's `relies_on`. The rest is the content its event takes, as `ledger ask`, `find` and `decide` take it:

```json
{"entries": [
  {"ref": "q1", "event": "asked", "text": "{question}", "by": "person", "map_item": "{subtopic}", "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}]},
  {"ref": "d1", "event": "decided", "answers": "q1", "text": "{answer}", "why": "{why}", "by": "claude", "given": "carried", "map_item": "{subtopic}", "cites": [{"path": "{unit}/topics/{topic}/log.md", "section": "{heading}"}], "assets": [{"path": "{unit}/assets/{file}", "status": "reference"}]},
  {"ref": "f1", "event": "found", "text": "{fact}", "how": "{how}", "known": "measured", "command": "{command}", "result": "{result}", "by": "claude", "cites": [{"path": "{unit}/topics/{topic}/experiments/{experiment}/report.md", "section": "{heading}"}]}
]}
```

## Working Through the Topics

A topic the check names is composed from the start, never from what an earlier session left of it.

In a large unit, give each topic to the migration's per-topic agent; the topics run side by side. Its brief names where it writes the record:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief migration-topic --topic {unit}.{phase}.{topic} --directive 079-records
```

Otherwise compose the record yourself, at `.leeway/.cache/migrate/records/{unit}/{topic}.json`. `{phase}` is the phase the topic's item is in: discussion; investigation for a bugfix's topic; discovery for an epic's topic never started.

Then the verifier reads each record against its sources and writes its findings beside it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief migration-verifier --topic {unit}.{phase}.{topic} --directive 079-records
```

Dispatch each brief's agent with its pointer alone. Where the verifier finds something, the record is composed again with its findings — by a fresh per-topic agent where one composed it — and verified again, until the verifier passes it. Then carry it, which appends the whole record in one write:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs ledger carry {unit}.{phase}.{topic} --file .leeway/.cache/migrate/records/{unit}/{topic}.json
```

Its answer gives each entry's id by its ref: keep the ids of the points to raise.

## The Raises at the End

Once every topic is carried and the check passes, raise each point no source settles, one at a time, as a fact only the person holds, answering its open question on the topic it was carried on:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs raise {unit}.{phase}.{topic} --answers {question} --fact
```

Record the person's answer with `raise answer`. A point they leave open stays an open question on its topic. A point on a cancelled unit or topic is not raised.
