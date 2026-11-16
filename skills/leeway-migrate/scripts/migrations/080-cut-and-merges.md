# Cut and Merges

## Touches

- The tracker, through `task close-plan` for a unit nothing of which was
  built, and through `cut --migrating` for a unit whose building started.
- The units, through `workunit retire`, `workunit split` and
  `topic postpone`.
- Each epic's topics' logs, which grow by the research placed on them.
- Each unit's staging in the state's cache,
  `.cache/migrate/cut-and-merges/{unit}/`: each phase's piece,
  `phases/{N}.json`, and the verifier's findings on it,
  `phases/{N}.findings.md`; the plan joined from them, `plan.json`; and the
  research's placement, `placed.json`.

## Asks

- Once for each building unit with topics its specs do not cover: where
  those topics go, a new epic the person names or the roadmap, and, for the
  roadmap, which horizon.
- Nothing else.

## What It Does

Every unit takes the shape Leeway builds from. A unit whose building started is cut into phases from its old plans, the tracker's tasks carried on under them; one nothing of which was built has its old plans' tasks closed in the tracker, its one spec written fresh once its topics are decided; a cross-cutting unit's record becomes the product's, and the unit leaves the registry; and research that fed several topics is placed in the logs of the topics it bears on.

The check names each piece not done and what it lacks: `{unit}` for a unit, `{unit}/research` for an epic's research. Work through them in the check's order: a unit's topics leave it before its research is placed. A piece is done once the check names it no more; a session ending part-way leaves the next to carry on from what the check names, and what the person answered is kept, so nothing is asked twice.

Paths below are from the state's folder, but one under `.workflows/`, which is from the project's folder in the main checkout; each phase's brief names both.

## A Unit Nothing of Which Was Built

Its old plans put tasks in the tracker, and its build will be planned afresh from its spec. Close each plan the check names, by the root it names:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs task close-plan {unit} --parent {root}
```

Where the close refuses because the plan holds a task done, the unit built some of it: say so to the person, as the refusal reads, and stop the directive there.

## A Cross-Cutting Unit

Its record is the product's: the records step carried each of its findings and decisions product-wide. Take it off the registry, its folder kept in the product's assets and each topic an epic promoted to it gone from that epic:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs workunit retire {unit}
```

## A Unit Whose Building Started

Its specs past their gate are joined, one area each, into `{unit}/spec.md`; its old plans' spec, planning and implementation items wait on the manifest for the cut. Take it through each step below the check still names.

### Its Topics Leaving

A unit being built can't take a topic its specs don't cover, so where the check says the person has not said where its topics go, ask, once:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render migration-leaving {unit} --directive 080-cut-and-merges
```

Emit its sections verbatim per their markers.

**STOP.** Wait for user response.

The answer goes to `gate`.

- **`n/new`:** ask in prose what the new epic is called — a name is content, not a choice — and **STOP.** Wait for user response. Their answer, as a unit's name, lowercase words joined by hyphens, is `{epic}`.
- **`r/roadmap`:** load **[choosing-a-horizon.md](../../../leeway-shared/references/choosing-a-horizon.md)**, `{names}` the leaving topics' names, comma-joined, and follow it to its return.

Before anything moves, keep the answer with the unit's plan, `.cache/migrate/cut-and-merges/{unit}/plan.json`, writing the file where it is not there yet, `{"answers": {"leaving": {"to": "epic", "epic": "{epic}"}}}` or `{"answers": {"leaving": {"to": "roadmap", "horizon": "{horizon}"}}}`, and the rest of the plan as it stands.

Where the check says the topics have not left yet, the answer is kept: read it from the plan, never from memory, and move them. To a new epic, `{topics}` is the leaving topics, comma-joined, and `{description}` a line saying what the epic is for, drawn from their briefs. Write the epic's first discovery log to a file of your own, `{log}` — the epic made from the unit's topics at the migration, each named, as the person chose — then:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs workunit split {unit} --topics {topics} --into {epic} --description "{description}" --session-log-file {log}
```

To the roadmap, postpone each:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs topic postpone {unit} {topic} --horizon "{horizon}"
```

### Its Phases

The unit's cut is laid out phase by phase: each old plan's phase with a tracker parent, and each area of the spec no plan put in the tracker, numbered as the cut numbers them, the plans in the order their dependencies allow. An agent composes each phase's piece from that phase alone, but a phase the manifest counts built whose every task the tracker holds ended, where the two agree: the join writes that one itself. Each phase's brief lists the whole cut and which phases the join writes.

For each phase whose piece is not written, or whose verifier has findings, give it to the migration's per-phase agent, `{N}` the phase's number:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief migration-phase {unit} --directive 080-cut-and-merges --phase {N}
```

Then the verifier reads the piece against the phase's sources and writes its findings beside it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief migration-phase-verifier {unit} --directive 080-cut-and-merges --phase {N}
```

Dispatch each brief's agent with its pointer alone; phases' agents can run at once, each writing its own piece. Where a verifier finds something, a fresh per-phase agent composes that piece again, its brief carrying the findings, and the verifier reads it again, until it passes the piece. A piece is never edited by hand.

### A Phase's Piece

A piece, `phases/{N}.json`, is one JSON object. A phase still to build:

```json
{
  "phase": {"name": "{name}", "goal": "{goal}", "sections": ["{A}", "{A}.{M}"], "relies_on": [2]},
  "scenarios": ["Given {context}, when {action}, then {outcome}.", "…"],
  "notes": ["{text}"],
  "corrections": [
    {"was": "{what disagreed}", "found": "{what the code shows}", "changed": "{what was changed}", "task": "{N}.{n}", "title": "{title}", "to": "done"}
  ]
}
```

A phase found built is `{"phase": {"name": "{name}", "goal": "{goal}", "sections": ["{A}"], "built": true}, "scenarios": [], "notes": [], "corrections": [ … ]}`.

- **The phase** is the old plan's phase its brief names, or the area it names where no plan put one in the tracker. `{A}` is the phase's area of the spec, as its brief names it.
- **A phase built** is its name, its goal, `"built": true`, and the sections its old plan built: its area, `{A}`, or its parts, `{A}.{M}`. A phase is built where the tracker holds every task of it done or closed, once the corrections are made.
- **A phase still to build** names the sections of its area it draws on, and its scenarios, written from the phase and each acceptance criterion of its tasks still to build, as the brief draws each task's text and the old plan's files hold it. Each scenario is one line, `Given …, when …, then …`, of one behaviour; criteria that prove the same behaviour make one scenario, and no scenario says again what another does. The join numbers them in the area, `{A}.S1` on, in the cut's order.
- **An area with no plan** is a phase still to build, its scenarios written from the area.
- **What it relies on, `relies_on`,** is required of a phase still to build: each earlier phase of this cut, by its number, or another unit, by its name, that builds what it depends on. Each dependency the brief names, on a phase still to build, is among them; `[]` where it relies on nothing.
- **The notes** are what the corrections leave for the build to settle.
- **The corrections** settle where the manifest and the tracker disagree, each disagreement the phase's brief names, from both and the code. Read the code for what the task or the phase was to build, and say what was found:
  - The code holds it, and the tracker holds the task neither done nor closed: the tracker is wrong. The correction ends the task, named as the brief names it, `"task": "{N}.{n}"`, with its title as the tracker holds it, `"to": "done"`.
  - The code holds it in another way than the task asked, or the work it asked for is no longer wanted: `"to": "closed"`, what was found its reason.
  - The code does not hold it: the tracker stands, and the correction changes nothing in it. Where the manifest counted the phase built, it is still to build.
  - The tracker holds the phase's every task ended, and the manifest does not count it built: the phase is built.
  - A task the tracker holds done that the code does not hold stays done; a note for later says what is missing.

  Each correction says, one line each, what disagreed, `was`, what the code shows, `found`, and what was changed, `changed`: the task ended, the phase's mark, or nothing.

### Its Cut

Once every phase's piece has passed its verifier, join them into the unit's plan:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs migrate join {unit} --directive 080-cut-and-merges
```

Where the join refuses, write its refusal, as it reads, into the findings of each phase it names, and compose those again. Once it is joined, the cut applies the plan whole, `{plan}` the path the join answers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs cut {unit} --migrating --file {plan}
```

A cut that refuses writes nothing: write its refusal, as it reads, into the findings of each phase it names, and compose those again; then verify, join and cut again.

## An Epic's Research

The move kept research that fed several topics on the epic's discovery log, in a session of its own, `{unit}/discovery/session-{NNN}.md`, opening on the migration's line, each source under `## Research: {source}`, `{source}` the name of the research file it came from. Place each source by judgment:

- **Where it bears.** A topic it bears on is one whose conversation needs what the section holds to be had: its decisions turn on it, or it answers that topic's questions. A section bearing on one theme of the epic goes to that topic; one bearing on several goes to each.
- **Epic-wide.** A section that bears on the epic as a whole, or on no topic more than another, stays where it is.
- **Logs only grow.** Append the section to the end of each topic's log, under `## Research: {source}, from discovery session {NNN}`, a blank line, then everything the session holds under its source's heading up to the next source's, word for word, its own headings among it. A topic's log is `{unit}/topics/{topic}/log.md`, or, for a topic a split took to a new epic, `{epic}/topics/{topic}/log.md`. Change nothing already in the log, and leave the session as it stands.

Then write the placement, `.cache/migrate/cut-and-merges/{unit}/placed.json`: for each session, each of its sources and the topics it went to, `[]` for one left epic-wide:

```json
{"session-{NNN}.md": {"{source}": ["{topic}", "{topic}"], "{source}": []}}
```
