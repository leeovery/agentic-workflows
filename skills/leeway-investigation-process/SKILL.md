---
name: leeway-investigation-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

# Investigation

A bugfix's one topic: the product does something wrong and its cause is not yet known. This finds the cause — from the symptoms the person reports, through the code, to a root cause the evidence proves — and agrees what the fix should do. You lead the hunt as an expert debugger: you trace the code yourself, test each hypothesis against the evidence and rule causes in or out; the person steers it at its gates and owns what the product should do. The topic's log is the investigation, dead ends included; the root cause, the findings and the fix land on the ledger. Nothing here builds the fix: the spec is written from what this phase settles.

## Arguments

- `$0` — **work_type**: `bugfix`.
- `$1` — **work_unit**.
- `$2` — **topic**. The bugfix's one topic is the unit: topic = `$2`, or `$1` where it is left off.

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

## Done When

`investigation conclude` has answered: the engine holds the investigation concluded, with the unit whose code the bug is in where one is named, and its `next` hands the work into the spec.

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

Write `{"order": [{"hypothesis": "H{n}", "check": "{how it is checked}"}, …]}` — every hypothesis still open, in the order you'll check them — to `.leeway/.cache/{work_unit}/investigation/{work_unit}/plan.json`. A finding that invalidates the agreed plan — the cause clearly elsewhere, a new suspect dominant, the remaining checks moot — brings the revised plan back to the same gate before the analysis goes on: its payload says besides what the finding changed, `"changed"`, and the call adds `--revised`. The analysis never re-plans past it. Fetch the plan gate and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render investigation-plan {work_unit} --file .leeway/.cache/{work_unit}/investigation/{work_unit}/plan.json [--revised]
```

### The Analysis

Trace from where the person meets the bug back to its source: the data's path, the control flow and the state that reach it, what it depends on, and what changed lately — the history, blame, a bisect; in a repository nested inside the project, its history is read there (`git -C {folder} …`). As you read, check whether the area was fixed before and whether the cause sits in the design; none of this is shown to the person or counted.

What the code or a run shows is a finding, saying how it is known: `read` in the code, `documented` with its source, or `exploratory` with the command and its result. A check run to test a hypothesis is the investigation's own experiment, logged with what it showed and resting on its finding (`investigation-log experiment`). A trace or a longer account goes beneath its entry as `--body`. A hypothesis's state follows the evidence — confirmed, or ruled out, a dead end kept and never deleted — and one the person says is intended behaviour is `intended`, `--by` their answer. A new suspect joins as a hypothesis of its own.

Whenever hypotheses resolve, before the trace moves on, write `{"resolved": ["H{n}", …], "next": "{what is checked next}"}`, those resolved since the last gate, to `.leeway/.cache/{work_unit}/investigation/{work_unit}/check-in.json`, then fetch the check-in gate and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render investigation-check-in {work_unit} --file .leeway/.cache/{work_unit}/investigation/{work_unit}/check-in.json
```

Between gates, a line or two on what just flipped and why it matters keeps the person with the hunt, and never ends the turn.

### What Only the Person Can Say

Each is a question on the map, saying what was tried and why it blocks the trace:
- a fact only the person holds — whether a behaviour is intended, the environment, a reproduction that fails here — goes to `raise --fact`;
- what the product should do is a call, and goes to `raise`.

Whether anything may run against a live server is a call of the person's, every time and before it runs. It is a permission for the hunt, never a rule the fix keeps: ask it at the investigation's own level, `{work_unit}.investigation`, through `raise`. The project's verify setup, where it has one, holds how to run the product safely.

### The Root Cause

Once the evidence settles it, the root cause is your decision on the findings: a question on the map, answered relying on the findings that prove it, its why the chain from the cause to every symptom; then log it (`investigation-log root-cause`). Set down in the log beside it what lets it happen, why nothing caught it, and what else shares the code or the pattern.

### Validations

Both always run, each against what it validates as it stands: the root cause's once the root cause is logged, the fix's once the fix is decided. A root cause or a fix replaced is validated again. Each is dispatched, briefed and called, `{kind}` `root-cause-validation` or `fix-validation` and `{id}` the one the dispatch answers; the Agent call's `subagent_type` is the agent `brief` answers, and its prompt the pointer alone:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs agent dispatch {work_unit} investigation {work_unit} --kind {kind}
node .claude/skills/leeway-engine/scripts/engine.cjs brief {kind} {work_unit} --agent {id}
```

It runs in the background while the work goes on: the step back, while the root cause is checked.

When a report lands, `agent scan {work_unit} investigation {work_unit}` lists it. Read it, then record its findings by the ids its headings carry — `agent ack {work_unit} investigation {work_unit} {id} --findings {F1,F2}`, or `--clean` where it found none. Check each against the code. One that holds lands as your finding, then is marked taken, `agent surface {work_unit} investigation {work_unit} {id} {finding}`, once what it reaches the person as is drawn:
- one that breaks the root cause: the root cause is replaced for it, `--cause` the finding, and logged again;
- one that changes what the fix does for the person reaches them as a product question: `raise` replacing the fix, `--cause` the finding, then surfaced as that replacement, `--replaces {fix} --reason new-fact`;
- one that puts to the person what the product should do, before any fix stands: asked and raised as **What Only the Person Can Say** says, then surfaced as that question, `--question {question}`;
- any other stands as a finding of the hunt.

One that does not hold up is declined: say why in the log, and never surface it. Then close the report, `agent incorporate {work_unit} investigation {work_unit} {id}`, and log what it found and what you did with it (`investigation-log validation`).

### The Step Back

Before setting out fix options, step back from the bug. Was the implementation wrong, or was it right and an edge case has turned up? Is there another way to do it — a different abstraction or mechanism — that thinking higher up reveals? The options show what it found.

### The Fix Direction

The fix is a question on the map, set out through `raise`, its call holding besides `"stepped_back"`, a line for each thing the step back found. Each row is a way to fix it, said as what the person would notice. Where the cause sits in the design or the area keeps breaking, it carries one row more: rework the area as a feature. The direction says what the fix does, never how it is written — that is the spec's.

Once the fix is decided, log the fix direction (`investigation-log fix-direction`), which carries what the step back found from the raise; then dispatch the fix's validation. Reworking the area as a feature, decided, dispatches no validation: go on to **Reworking It as a Feature**.

### Mail

At natural pauses, check `topic mailbox {work_unit} {work_unit}`: a message is what another phase needs settled here, such as a gap the spec sent back. Put the question it raises on the map, then remove the message: `topic answered {work_unit} {work_unit} {NNN-slug} --entry {question}`.

### The Log

The DATA's `log`, `topics/{work_unit}/log.md`, is the investigation: the hunt's lists under the headings `investigation-log` writes, and your account of it — the paths traced, the dead ends and why, what changed your mind — under headings of your own, never under the hunt's. Write it as you go, appended and never rewritten, enough for a fresh session to carry on alone, pointing at entries by short id rather than restating them. This conversation's first write opens with the DATA's `log header` line.

## Doors

Content is one JSON object on stdin; `{place}` is `{work_unit}.investigation.{work_unit}`.

- A symptom → `investigation-log symptom {work_unit} --text "{their words}"`.
- A hypothesis → `investigation-log hypothesis {work_unit} --title "{title}"`; where it stands now → `investigation-log hypothesis {work_unit} H{n} --state {state:[suspected|confirmed|ruled-out|intended]} [--by {decision}]`.
- An experiment → `investigation-log experiment {work_unit} --title "{title}" --showed "{what it showed}" --entry {finding}`.
- The root cause → `investigation-log root-cause {work_unit} --entry {decision}`; the fix direction → `investigation-log fix-direction {work_unit} --question {question}`.
- A validation → `investigation-log validation {work_unit} {which:[root-cause|fix]} --found "{what it found}" --did "{what you did with it}"`.
- Any of these takes `--body {file}`, lines beneath its entry.
- The plan → `render investigation-plan {work_unit} --file {plan} [--revised]`; a check-in → `render investigation-check-in {work_unit} --file {check-in}`.
- A question → `ledger ask {place}`, `{"text", "by": "person|claude", "who_moved_whom": "none"}`.
- A finding → `ledger find {place} [--relies-on {id} …]`, adding `"how"`, `"known"`, and `"command"` and `"result"` where exploratory.
- A decision → `ledger decide {place} --answers {id} [--relies-on {id} …]`, `{"text", "why", "rules_out", "by", "who_moved_whom": "none"}`; a changed one → `ledger replace {place} --replaces {id} --reason {reason:[new-fact|changed-mind|was-wrong]} [--cause {id}]`, the content of the kind it replaces.
- A call → `raise {place} --answers {id}`; a fix a validation changes for the person → `raise {place} --replaces {id} --reason new-fact --cause {id}`; a fix settled afresh once the person keeps shaping → `raise {place} --replaces {id} --reason changed-mind`; a fact only the person holds → `raise {place} --answers {id} --fact`; a run against a live server → `ledger ask {work_unit}.investigation`, then `raise {work_unit}.investigation --answers {id}`.
- The topic as it stands → `ledger record|map {work_unit} {work_unit}`.
- A validation's agent → `agent dispatch`, then `brief root-cause-validation|fix-validation`, then the Agent call; its report → `agent scan|ack|surface|incorporate`; a finding that reached the person → `agent surface {work_unit} investigation {work_unit} {id} {finding} --replaces {fix} --reason new-fact`, or `--question {question}`.
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

The person shares a file, a path or an image — a log, an export, a screenshot of the failure. Load **[importing-shared-files.md](../leeway-shared/references/importing-shared-files.md)** with home = `{work_unit}`, phase = `investigation`, and follow its instructions as written. What a file shows is evidence like any other: link each from the finding it informs, `asset add {work_unit} {path} --entry {finding} --status reference`, or from the log.

## Reworking It as a Feature

The person has decided the fix direction is to rework the area as a feature. Before anything moves, the root cause's validation is taken in (**Validations**), so the feature never starts from a cause its validator would have broken. Bring the log up to date, then draft the feature's brief at `.leeway/.cache/{work_unit}/investigation/{work_unit}/brief.md`: the symptoms, the root cause and why it is the design's, the ways ruled out and why, and the open questions — nothing in it a decision.

Write `{"description": "{one line in the person's framing}", "reason": "{one line on why it is a feature}", "brief": ".leeway/.cache/{work_unit}/investigation/{work_unit}/brief.md"}` to `.leeway/.cache/{work_unit}/investigation/{work_unit}/move.json`, then stage the move and draw start this work's screen, emitting its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs workunit move {work_unit} --to feature --file .leeway/.cache/{work_unit}/investigation/{work_unit}/move.json
```

A refusal names what to fix. The answer goes to `gate`; follow its `next`, and then the `next` of what it ran: the handoff into the feature's discussion, which reads this investigation as its earlier log.

The person keeping shaping at start this work, the bugfix staying one, settles the fix afresh: replace the fix through `raise --replaces {fix} --reason changed-mind`, its call holding what the step back found again, then carry on as **The Fix Direction** says once it is decided.
