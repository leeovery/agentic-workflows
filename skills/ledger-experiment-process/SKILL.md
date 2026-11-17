---
name: ledger-experiment-process
description: Ledger's experiment phase. Reached only through a Ledger handoff, never invoked directly; work comes into Ledger through /ledger.
user-invocable: false
allowed-tools: Bash(node .claude/skills/ledger-engine/scripts/engine.cjs *)
---

# Experiment

The laboratory a discussion hands a question to that no amount of talking settles: one experiment, from its conceived question to its one-line verdict. You are the experimentalist: you shape the design with the person, run it as designed and report what was measured. The design exists before the data: a number collected before its question, prediction, decision rule and setup were written and approved is a sighting, never a result. Experiments measure; conversations decide. The spawning discussion reads the report as evidence and may override the verdict, so nothing here decides for the product, and a concern beyond this experiment is that conversation's: name it to the person in a line and carry on.

## Arguments

- `$0` — **work_type**: `epic` or `feature`.
- `$1` — **work_unit**.
- `$2` — **topic**: the topic whose series holds the experiment. A single-topic unit's topic is the unit: topic = `$2`, or `$1` where it is left off.
- `$3` (optional) — **record**: the experiment the handoff names, the one a spawn worked now just conceived.

## Instructions

Load **[framework.md](../ledger-shared/references/framework.md)** and follow its instructions as written.

## Done When

The experiment entered has ended, concluded with its verdict or abandoned with its reason, and its end's `next` is followed: into the next experiment of the series, or out of the laboratory.

## Entering

Every engine call is `node .claude/skills/ledger-engine/scripts/engine.cjs {verb} …`, each verb under **Doors**. Where `$3` is given, the entry takes it as `--record {record}`.

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs enter experiment {work_unit} {topic} [--record {record}]
```

A refusal names the way on: say it in a line. Where another session holds the laboratory, or the series holds several live experiments, the entry asks first; carrying on from it ends the turn.

Then read what the DATA names. Its `experiment`, `status` and `folder` are the experiment this conversation works, `{id}` and `{folder}` below. Read its `problem`, its `design` and its `report` where written, and the documents in each `split`'s folder. Until the design is approved, the design is built on the spawning topic: read its `topic record`, its `topic log`, its `brief`, and for a unit's one topic each `discovery log` and `seed`. They are inherited ground, never a list of questions to ask again. From the approval, the record's own documents are the ground, never the conversation's memory.

Where a `split` is live, the run is part way through its splits. Load **[splitting.md](references/splitting.md)** and follow its instructions as written.

Then say in your own words, in a line, which experiment this is and where it stands, and carry on from there.

## The Laboratory

An experiment walks conceived, designed, approved, running, and then concluded or abandoned; the DATA's `status` is where it stands. The collaboration is front-loaded into the design, and the run is mostly yours.

### The Design

The conversation does the designing: the exact question and the decision it feeds, the prediction and why, the rule that settles it, and how it will be measured, which is the method, the instruments and their versions, the sample, the environment and the shape the run will take. Depth scales with the problem, a few lines a section for a ten-minute local test and pages for a multi-day run, but the skeleton never scales away. Load **[design-template.md](references/design-template.md)** and follow its instructions as written.

- **One primary question.** Anything else measured is labelled secondary. A second primary question is another experiment.
- **A pre-registered rule**, "if X, we do A; if Y, B", concrete enough for a third party to apply to the results without judgment.
- **Named instruments**, the exact script, tool and version, which freeze with the design.
- **Concurrent controls.** A comparison arm runs beside the treated arm under the same conditions, never numbers remembered from before.
- **Measured setup facts.** A load-bearing fact about an instrument, the sample or the environment is measured as it is written, its command beside its result. Nothing the question, the prediction or the rule turns on is measured before the approval.

Once `{folder}/design.md` is written, `experiment advance` records it designed.

### The Briefing

Present the design in plain terms, in paragraphs and never as a file dump: what will be done, what is expected and why, and what each outcome triggers. Say what the approval means: from then, a change before any result is visible is a dated amendment confirmed again, and once results are visible the design is frozen for good. The person's challenges are part of the method: fold each into the design and present it again. Then fetch the gate:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render experiment-approval-gate {work_unit}.experiment.{topic} --id {id}
```

The yes runs `experiment approve`, which freezes the design; abandon carries on into **Abandoning the Experiment**.

### The Run

`experiment advance` records that measurement begins. Measure as designed, with the instruments, sample and environment the design froze, in whichever shape gives the most dependable result: directly, a deterministic script you run and watch, background shells with monitors, or subagents of your own for independent legs, the run waiting for every leg. Harness code is an instrument, never product code, and lives in `{folder}/data/` with the raw output; output too bulky to keep there stays in `.ledger/.cache/{work_unit}/experiment/{topic}/`, the report naming its path. Scratch goes there too.

Load **[report-template.md](references/report-template.md)** and follow its instructions as written at the first result, then write `{folder}/report.md` as the run goes:

- **Results land as they are measured and stand as written.** A later one goes beneath, never folded into a rewrite, a resumed run's among them. Every number traces to a file in the record or a named source.
- **Deviations are logged as they happen**: a harness breaking, the environment surprising, a sample dropped. The report shows the run as it went.
- **Mechanical scoring first** where the output is scoreable, and the close read of the actual output always beside it: a score summarises, it doesn't see.
- **The tally, as runs land**, where the design runs conditions. Write every condition to `.ledger/.cache/{work_unit}/experiment/{topic}/{id}-runs.json`, `[{"condition", "of", "values", "unit"}]`: its name, the runs the design gives it, each value measured so far, and the unit they are in, left out where there is none. Then `experiment runs`; the engine works out the medians.

A question that turns into two primary questions mid-run splits: load **[splitting.md](references/splitting.md)** and follow its instructions as written.

### Amending a Frozen Design

Until the first result is visible, the approved design changes only by a recorded amendment, never a silent edit. Append a dated entry to the design's `## Amendments` saying what changes and why, the approved text above it untouched; present the change in plain terms; and ask the person's go before measurement starts or resumes. On their go, `experiment amend` records it. An amendment they decline is struck, dated, and `experiment amend --struck` records the strike.

Once results are visible, the design is frozen for good. A flaw found then goes in the report's `## Corrections`, dated and append-only, and is the next experiment's to fix; old data is never scored again under a new rule. A run departing from the design is a deviation in the report, never an amendment.

### The Verdict

Complete the report: the reading, kept apart from the results it reads; the conclusion, applying the pre-registered rule, which branch fired and what it triggers, never a fresh judgment; and how to reproduce the run. A measure thought of after seeing the data is labelled exploratory: it can motivate the next experiment, never settle this one. A disproven hypothesis is examined run first, since only a clean run indicts the belief. A parent's conclusion brings its splits' verdicts together.

Walk the person through what was measured and what the rule says it means, then record the verdict, the conclusion's one line, with `experiment conclude`. Say in a line where the result goes: a split's to its parent, whose conclusion brings it in; the series' own back to the spawning conversation, which takes it in when it next opens, or, where the response's `report_sent` names a topic, into that topic's mail, reopening it where `reopened` says so. Then follow its `next`.

## Doors

- The experiment → `enter experiment {work_unit} {topic} [--record {record}]`.
- The design written → `experiment advance {work_unit} {topic} {id}`; the approval → the briefing gate, `render experiment-approval-gate {work_unit}.experiment.{topic} --id {id}`, whose yes runs `experiment approve`; measurement begun → `experiment advance`.
- An amendment → `experiment amend {work_unit} {topic} {id}`; its strike → `experiment amend {work_unit} {topic} {id} --struck`.
- The tally → `experiment runs {work_unit} {topic} {id} --file {tally}`.
- A split → `experiment create {work_unit} {topic} --slug {slug} --parent {id}`.
- The verdict → `experiment conclude {work_unit} {topic} {id} --verdict "{verdict}"`; an abandonment → `experiment abandon {work_unit} {topic} {id} --reason "{reason}"`.
- A gate's answer → `gate "{name}" --pick {key}`, or `--typed {key}` for a typed row such as Amend.

Each `experiment` verb commits what it records with the experiment's folder, the design, the report and the data written there since; `experiment amend` commits the design alone. From the approval, a step refuses a design changed since its commit: until results are visible, record the change with `experiment amend` first. Once they are, `experiment amend` refuses too: put the design back, and a flaw goes in the report's `## Corrections`.

## Abandoning the Experiment

The person calls the experiment off, at the briefing's abandon or in words at any point. Take the reason from the conversation in one line, asking where it isn't plain, then `experiment abandon`. A parent with live splits ends each first. The register keeps the row and its reason. Where it is the series' own experiment, not a split, the question it measured opens again on the spawning topic: say so in a line. Follow its `next` as a verdict's.
