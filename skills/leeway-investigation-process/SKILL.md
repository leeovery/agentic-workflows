---
name: leeway-investigation-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

# Investigation

A bugfix's one topic: something that worked now fails, and this finds why — from the symptoms the person reports, through the code, to a root cause the evidence proves — and agrees what the fix should do. You lead the hunt as an expert debugger: you trace the code yourself, test each hypothesis against the evidence and rule causes in or out; the person steers it at its gates and owns what the product should do. The topic's log is the investigation, dead ends included; the root cause, the findings and the fix land on the ledger. Nothing here builds the fix: the spec is written from what this phase settles.

## Arguments

- `$0` — **work_type**: `bugfix`.
- `$1` — **work_unit**. Its one topic is the unit.

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

## Done When

The person has said yes at the conclude gate and `investigation conclude` has closed the investigation: the engine then holds it concluded, with the unit whose code the bug is in where one is named, and its `next` hands the work into the spec.

## Entering

Every engine call is `node .claude/skills/leeway-engine/scripts/engine.cjs {verb} …`, each verb under **Doors**.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs enter investigation {work_unit}
```

A refusal names the way on: say it in a line. Where another session holds the topic, the entry asks first: emit its MENU verbatim per its marker and follow the answer's `next`; carrying on from it ends the turn. Otherwise emit each section ahead of the DATA verbatim per its marker. Waiting mail is the conversation's first business (**Mail**).

Then read what the DATA names: the brief; discovery's logs and the seeds, the person's own account of the bug; the product record; at a first opening of a quick-fix moved here, its `earlier record`, `earlier build log` and each `kept branch`, read as input and never changed; and on resume the topic's record, its map and the `log`, the hunt so far. Take in each `landed` report as **Validations** says, and close each `lost` one with `agent incorporate`. Search earlier work units' entries in the bug's area with `knowledge query`.

Then open the conversation; never stop in silence once you have read. On resume, say in your own words where the hunt stands and what comes next.

## The Hunt

The rigour holds — the symptoms, then the code, and the root cause settled before any fix is set out. Within it the work is yours to order.

### Symptoms

The brief, the seeds and discovery's log are the person's account: confirm what they already answer rather than ask it again, and ask what they leave open — what should happen and what happens instead, the exact steps, how often, where, since when, and what they have tried. Start with what matters most and follow their answers down; never a barrage of questions. Log each symptom in their words as they give it (`investigation-log symptom`). What they don't know stays unknown, never guessed.

### The Plan

Before tracing deep, a bounded recon: the symptoms, the code they implicate and what surrounds it, and whatever the knowledge base turned up. From it form the hypotheses, each with what points at it rather than proof, and log each (`investigation-log hypothesis`). A cause the seeds already pinpoint is a plan of one. Recon that starts confirming rather than forming has gone past the plan: draw it.

Write `{"order": [{"hypothesis": "H{n}", "check": "{how it is checked}"}, …]}` — every hypothesis still open, in the order you'll check them — to `.leeway/.cache/{work_unit}/investigation/{work_unit}/plan.json`, then fetch the plan gate and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render investigation-plan {work_unit} --file .leeway/.cache/{work_unit}/investigation/{work_unit}/plan.json
```

A finding that invalidates the agreed plan — the cause clearly elsewhere, a new suspect dominant, the remaining checks moot — brings the revised plan back to the same gate before the analysis goes on, its payload saying besides what the finding changed, `"changed"`, and the call adding `--revised`. The analysis never re-plans past it.

### The Analysis

Trace from where the person meets the bug back to its source: the data's path, the control flow and the state that reach it, what it depends on, and what changed lately — the history, blame, a bisect; in a repository nested inside the project, its history is read there (`git -C {folder} …`). As you read, check whether the area was fixed before and whether the cause sits in the design; none of this is shown to the person or counted.

What the code or a run shows is a finding, saying how it is known: `read` in the code, `documented` with its source, or `exploratory` with the command and its result. A check run to test a hypothesis is the investigation's own experiment, logged with what it showed and resting on its finding (`investigation-log experiment`). A trace or a longer account goes beneath its entry as `--body`. A hypothesis's state follows the evidence — confirmed, or ruled out, a dead end kept and never deleted — and one the person rules intended behaviour is `intended`, `--by` their decision. A new suspect joins as a hypothesis of its own.

Whenever hypotheses resolve, before the trace moves on, write `{"resolved": ["H{n}", …], "next": "{what is checked next}"}`, those resolved since the last gate, to `.leeway/.cache/{work_unit}/investigation/{work_unit}/check-in.json`, then fetch the check-in gate and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render investigation-check-in {work_unit} --file .leeway/.cache/{work_unit}/investigation/{work_unit}/check-in.json
```

Between gates, a line or two on what just flipped and why it matters keeps the person with the hunt, and never ends the turn.

### The Person's Part

Some things only the person knows: what the product should do, the environment, a reproduction that fails here. Ask them in the conversation, saying what was tried and why it blocks the trace. A question the work rests on — what the product should do, whether a behaviour is intended — goes on the map, and their answer lands as their decision.

Whether anything may run against a live server is the person's to say, every time and before it runs: ask it through `raise --fact`. The project's verify setup, where it has one, holds how to run the product safely.

### The Root Cause

Once the evidence settles it, the root cause is your decision on the findings: a question on the map, answered relying on the findings that prove it, its why the chain from the cause to every symptom; then log it (`investigation-log root-cause`). Set down in the log beside it what lets it happen, why nothing caught it, and what else shares the code or the pattern.

A root cause that is really a design problem is the person's: say so in the conversation before any fix is set out, with reworking the area as a feature among the ways forward. The fix question is then put to them there, their answer landing as their decision, and the log's fix direction takes what the step back found as its `--body`, a line each.

### Validations

Both always run, each against what it validates as it stands: the root cause's once the root cause is logged, the fix's once the fix direction is. A root cause or a fix replaced is validated again. Each is dispatched, briefed and called, `{kind}` `root-cause-validation` or `fix-validation` and `{id}` the one the dispatch answers; the Agent call's `subagent_type` is the agent `brief` answers, and its prompt the pointer alone:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent dispatch {work_unit} investigation {work_unit} --kind {kind}
node .claude/skills/leeway-engine/scripts/engine.cjs brief {kind} {work_unit} --agent {id}
```

It runs in the background while the work goes on: the step back, while the root cause is checked.

When a report lands, `agent scan {work_unit} investigation {work_unit}` lists it. Read it, then record its findings by the ids its headings carry — `agent ack {work_unit} investigation {work_unit} {id} --findings {F1,F2}`, or `--clean` where it found none. Act on each finding and mark it as you do, `agent surface {work_unit} investigation {work_unit} {id} {finding}`:
- one that breaks the root cause is checked, then landed as your finding; the root cause is replaced for it and logged again;
- one that changes what the fix does for the person reaches them as a product question: `raise` replacing the fix;
- one that does not hold up is said in the log, with why.

Then close the report, `agent incorporate {work_unit} investigation {work_unit} {id}`, and log what it found and what you did with it (`investigation-log validation`).

### The Step Back

Before setting out fix options, step back from the bug. Was the implementation wrong, or was it right and an edge case has turned up? Is there another way to do it — a different abstraction or mechanism — that thinking higher up reveals? The options show what it found.

### The Fix Direction

The fix is a question on the map, set out through `raise`, its call holding besides `"stepped_back"`, a line for each thing the step back found. Each row is a way to fix it, said as what the person would notice; where the cause sits in the design or the area keeps breaking, one row more: rework the area as a feature. The direction says what the fix does, never how it is written — that is the spec's.

In the turn the person answers, log the fix direction (`investigation-log fix-direction`), which carries what the step back found from the raise; then dispatch the fix's validation. Reworking the area as a feature, picked, goes on from there to **Reworking It as a Feature**.

### Mail

At natural pauses, check `topic mailbox {work_unit} {work_unit}`: a message is what another phase needs settled here, such as a gap the spec sent back. Put the question it raises on the map, then remove the message: `topic answered {work_unit} {work_unit} {NNN-slug} --entry {question}`.

### The Log

The DATA's `log`, `topics/{work_unit}/log.md`, is the investigation: the hunt's lists under the headings `investigation-log` writes, and your account of it — the paths traced, the dead ends and why, what changed your mind — under headings of your own, never under the hunt's. Write it as you go, appended and never rewritten, enough for a fresh session to carry on alone, pointing at entries by short id rather than restating them. This conversation's first write opens with the DATA's `log header` line.

## Doors

Content is one JSON object on stdin; `{place}` is `{work_unit}.investigation.{work_unit}`.

- A symptom, a hypothesis, an experiment, the root cause, a validation, the fix direction → `investigation-log symptom|hypothesis|experiment|root-cause|validation|fix-direction {work_unit} …`, each `[--body {file}]`.
- The plan → `render investigation-plan {work_unit} --file {plan} [--revised]`; a check-in → `render investigation-check-in {work_unit} --file {check-in}`.
- A question → `ledger ask {place}`, `{"text", "by": "person|claude", "who_moved_whom": "none"}`.
- A finding → `ledger find {place} [--relies-on {id} …]`, adding `"how"`, `"known"`, and `"command"` and `"result"` where exploratory.
- A decision → `ledger decide {place} --answers {id} [--relies-on {id} …]`, `{"text", "why", "rules_out", "by", "who_moved_whom": "none"}`; a changed one → `ledger replace {place} --replaces {id} --reason {reason:[new-fact|changed-mind|was-wrong]} [--cause {id}]`, the content of the kind it replaces.
- The fix direction → `raise {place} --answers {id}`; a fix a validation changes for the person → `raise {place} --replaces {id} --reason new-fact --cause {id}`; a fact only the person holds → `raise {place} --answers {id} --fact`.
- The topic as it stands → `ledger record|map {work_unit} {work_unit}`.
- A validation → `agent dispatch`, then `brief root-cause-validation|fix-validation`, then the Agent call; its report → `agent scan|ack|surface|incorporate`.
- Earlier work → `knowledge query "{term}" …`.
- Mail → `topic mailbox`, `topic answered`.
- A shared file → `asset import`, `render import-reprompt`, `asset add`.
- The close → `render conclude {work_unit} [--file {recap}]`, whose yes runs `investigation conclude {work_unit}`.
- The work as a feature → `workunit move {work_unit} --to feature --file {payload}`, whose yes runs `start-this-work yes`.
- The work leaving → `render cancel-gate {work_unit}`, whose `next` runs `workunit cancel`; then `render workunit-receipt`.
- A gate's answer → `gate "{name}" --pick {key}`, or `--typed {key}` for a typed row such as a Comment.

## Closing

The investigation closes once the root cause and the fix stand, both validated since, nothing of the person's open on the map and no mail waiting. It has no checklist.

The recap names what the bug is in, for the bugs found after review:
- `fixes` — the work unit whose code the bug is in, read from the code's history and the project's units; asked of the person where it isn't plain, and left out where no unit built that code.
- `area` — where the project records a verify setup, the area of the feature map it names that the bug sits in, in the words the gate's DATA lists an area by where it is one already recorded; left out otherwise.

Write `{"hunt": "{one paragraph}", "fixes": "{unit}", "area": "{area}"}` — the hunt told short in product terms, what was suspected and what ruled each out, what proved the cause; `fixes` and `area` only where named — to `.leeway/.cache/{work_unit}/investigation/{work_unit}/recap.json`, then stage it and fetch the conclude gate:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render conclude {work_unit} --file .leeway/.cache/{work_unit}/investigation/{work_unit}/recap.json
```

Where its DATA lists the area you named under another spelling, stage the recap again with the DATA's before emitting anything. Then emit its sections verbatim per their markers. A refusal names the way on: work it — a validation, a question open, mail — then fetch the gate again; one refusing the recap is staged again as it says.

The screen asks a verdict of each call the person changed, one at a time: each answer goes to `gate`, whose `next` gives the verdict; then draw `render conclude {work_unit}` again. At the conclude gate the answer goes to `gate`: the yes runs `investigation conclude`, whose `next` hands the work into the spec — follow it; keep going carries the hunt on. A Comment that changes what the screen says is worked, and the recap staged again.

## Backlogging

The person puts an idea, a bug or a fix aside — "roadmap it", "inbox it", "backlog that", "push it back". Load **[backlogging.md](../leeway-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{work_unit}`, phase = `investigation`.

## Postponing the Investigation

The person pushes the bug back to the roadmap. The topic is the unit, so there is nothing to postpone, and its "not now" is a cancel: say so in a line.

## Cancelling the Investigation

The person calls the bugfix off, or the conversation agrees it is not worth fixing. Bring the log up to date, then fetch the confirm, `render cancel-gate {work_unit}`, emit its MENU verbatim per its marker and follow the answer's `next`. A refusal names what holds the unit: say it in a line.

The cancel takes the unit's cache, its agents' rows with it: stop every task you dispatched with the TaskStop tool. Fetch its receipt, adding `--warn` where the response carries warnings and `--inbox {n}` where its `inbox` lists the waiting messages the cancel moved, `{n}` their count, and emit its sections verbatim per their markers; the unit is closed, and the turn ends:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb cancel [--warn] [--inbox {n}]
```

## A Shared File

The person shares a file, a path or an image — a log, an export, a screenshot of the failure. Land every path in one call, each single-quoted, a `~` path written out in full and a single quote inside a path written `'\''`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs asset import {work_unit} '{path}' ['{path}' …]
```

A refusal carrying `missing_imports` landed nothing. Write `{"missing": ["{path}", …]}`, the paths it names in its order, to `.leeway/.cache/{work_unit}/investigation/{work_unit}/import-reprompt.json`, then fetch the prompt and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render import-reprompt --file .leeway/.cache/{work_unit}/investigation/{work_unit}/import-reprompt.json
```

The answer goes to `gate`: corrected paths land with the ones the refusal did not name; `skip` lands only those. Read what landed — markdown as prose, an image by looking at it, anything else named to the person rather than opened. What it shows is evidence like any other: link each file from the finding it informs, `asset add {work_unit} {path} --entry {finding} --status reference`, or from the log.

## Reworking It as a Feature

The person takes reworking the area as a feature — the fix direction's row, or their word once a design problem is raised. Only their word moves the work. Bring the log up to date, then draft the feature's brief at `.leeway/.cache/{work_unit}/investigation/{work_unit}/brief.md`: the symptoms, the root cause and why it is the design's, the ways ruled out and why, and the open questions — nothing in it a decision.

Write `{"description": "{one line in the person's framing}", "reason": "{one line on why it is a feature}", "brief": ".leeway/.cache/{work_unit}/investigation/{work_unit}/brief.md"}` to `.leeway/.cache/{work_unit}/investigation/{work_unit}/move.json`, then stage the move and draw start this work's screen, emitting its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs workunit move {work_unit} --to feature --file .leeway/.cache/{work_unit}/investigation/{work_unit}/move.json
```

A refusal names what to fix. The answer goes to `gate`; follow its `next`, and then the `next` of what it ran: the handoff into the feature's discussion, which reads this investigation as its earlier log.
