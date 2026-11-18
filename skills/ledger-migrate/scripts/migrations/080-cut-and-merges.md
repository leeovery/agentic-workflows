# Cut and Merges

## Touches

- The tracker, through `task close-plan` for a unit nothing of which was
  built or a cancelled one, and through `cut --migrating` for a unit whose
  building started,
  `task unlink` taking off a link the cut refuses that no longer holds.
- The units, through `workunit retire`, `workunit split` and
  `topic postpone`.
- Each epic's topics' logs, which grow by the research placed on them.
- Each unit's staging in the state's cache,
  `.cache/migrate/cut-and-merges/{unit}/`: each phase's piece,
  `phases/{N}.json`, the verifier's findings on it,
  `phases/{N}.findings.txt`, empty where it passed, every round of them
  before, `phases/{N}.rounds.md`, the points the session settled,
  `phases/{N}.settled.md`, and the piece each verifier read,
  `phases/{N}.verifying.json` and `phases/{N}.verified.json`; the plan
  joined from them, `plan.json`; and the research's placement,
  `placed.json`.

## Asks

- Once for each building unit with topics its specs do not cover: where
  those topics go, a new epic the person names or the roadmap, and, for the
  roadmap, which horizon.
- For each link in the tracker the cut refuses that the sources do not
  settle: whether it still holds; and for one that holds on a later phase
  of its own old plan, which way on.
- For a point the sources do not settle that a verifier reverses, or
  that a finding of the third round or a later one raises: how it stands.
- Nothing else.

## What It Does

Every unit takes the shape Ledger builds from. A unit whose building started is cut into phases from its old plans, the tracker's tasks carried on under them; one nothing of which was built has its old plans' tasks closed in the tracker, its one spec written fresh once its topics are decided, and a cancelled one has its old plans' tasks still open closed; a cross-cutting unit's record becomes the product's, and the unit leaves the registry; and research that fed several topics is placed in the logs of the topics it bears on.

The check names each piece not done and what it lacks: `{unit}` for a unit, `{unit}/research` for an epic's research. Work through them in the check's order: a unit's topics leave it before its research is placed. A piece is done once the check names it no more; a session ending part-way leaves the next to carry on from what the check names, and what the person answered is kept, so nothing is asked twice.

Paths below are from the state's folder, but one under `.workflows/`, which is from the project's folder in the main checkout. Run every engine call from the project's folder: each phase's brief names each file its agent reads or writes by its whole path.

## A Unit Nothing of Which Was Built, or Cancelled

Its old plans put tasks in the tracker: a unit nothing of which was built will have its build planned afresh from its spec, and a cancelled one builds nothing more, whether its building started or not. Close each plan the check names, by the root it names:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs task close-plan {unit} --parent {root}
```

Where the close of a plan of a unit not cancelled refuses because the plan holds a task done, the unit built some of it: say so to the person, as the refusal reads, and stop the directive there.

## A Cross-Cutting Unit

Its record is the product's: the records step carried each of its findings and decisions product-wide. Take it off the registry, its folder kept in the product's assets and each topic an epic promoted to it gone from that epic:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs workunit retire {unit}
```

## A Unit Whose Building Started

Its specs past their gate are joined, one area each, into `{unit}/spec.md`; its old plans' spec, planning and implementation items wait on the manifest for the cut. Take it through each step below the check still names.

### Its Topics Leaving

A unit being built can't take a topic its specs don't cover, so where the check says the person has not said where its topics go, ask, once:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render migration-leaving {unit} --directive 080-cut-and-merges
```

**STOP.** Wait for user response.

The answer goes to `gate`.

- **`n/new`:** ask in prose what the new epic is called — a name is content, not a choice — and **STOP.** Wait for user response. Their answer, as a unit's name, lowercase words joined by hyphens, is `{epic}`.
- **`r/roadmap`:** load **[choosing-a-horizon.md](../../../ledger-shared/references/choosing-a-horizon.md)**, `{names}` the leaving topics' names, comma-joined, and follow it to its return.

Before anything moves, keep the answer with the unit's plan, `.cache/migrate/cut-and-merges/{unit}/plan.json`, writing the file where it is not there yet, `{"answers": {"leaving": {"to": "epic", "epic": "{epic}"}}}` or `{"answers": {"leaving": {"to": "roadmap", "horizon": "{horizon}"}}}`, and the rest of the plan as it stands.

Where the check says the topics have not left yet, the answer is kept: read it from the plan, never from memory, and move them. To a new epic, `{topics}` is the leaving topics, comma-joined, and `{description}` a line saying what the epic is for, drawn from their briefs. Write the epic's first discovery log to a file of your own, `{log}`: the epic made from the unit's topics at the migration, each named, as the person chose. Then split them into it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs workunit split {unit} --topics {topics} --into {epic} --description "{description}" --session-log-file {log}
```

To the roadmap, postpone each:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs topic postpone {unit} {topic} --horizon "{horizon}"
```

### Its Phases

The unit's cut is laid out phase by phase: each old plan's phase with a tracker parent, and each area of the spec no plan put in the tracker, numbered as the cut numbers them, the plans in the order their dependencies allow. An agent composes each phase's piece from that phase alone, but a phase the manifest counts built whose every task the tracker holds ended, where the two agree: the join writes that one itself. Each phase's brief lists the whole cut and which phases the join writes.

A verifier reads each piece and writes its findings beside it, `phases/{N}.findings.txt`. An empty file is the pass. A file holding findings sends the piece back to be amended. No file means the piece was never verified: the verifier's brief keeps the findings it reads the piece for as a round, `phases/{N}.rounds.md`, and clears them, so a session that ends between composing and verifying leaves none.

For each phase whose piece is not written, or whose findings file holds findings, give it to the migration's per-phase agent, `{N}` the phase's number. It amends a piece composed already, never composing it from the start, and checks the piece as the join would before handing back:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief migration-phase {unit} --directive 080-cut-and-merges --phase {N}
```

Once it has returned, and for each piece with no findings file, the verifier reads the piece against the phase's sources and writes its findings:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief migration-phase-verifier {unit} --directive 080-cut-and-merges --phase {N}
```

Dispatch each brief's agent with its pointer alone; phases' agents can run at once, each writing its own piece. Where a verifier finds something, a fresh per-phase agent amends that piece, its brief carrying the findings, and the verifier reads what changed since, its brief carrying every round before and the changes, until it passes the piece. A piece is never edited by hand. A file an agent left under the phases, which the check names, is removed.

A reversal is a finding against a point the session settled, opening `Reverses the session:`; a new point on what an earlier round passed, or on what its findings had the piece changed to, is a finding as any other. A reversal goes to no agent, nor does a finding the third round or a later one writes. Settle the point from the phase's sources and the code; where they don't settle it, ask the person in prose, naming what each round found and what each rests on, and **STOP.** Wait for user response. Write the ruling, a line naming the point and what settles it, into `phases/{N}.settled.md`, which every later brief of the phase carries as closed. Where the ruling has the piece change, replace the finding with `Settled: {point}, amend to agree`: a fresh per-phase agent amends the piece to answer it, and the verifier reads it again, its brief keeping it as a round. Where the ruling keeps the piece as it stands, take the finding out of the findings file; where no finding is left, the file empty, the piece has passed. An empty findings file is only ever a pass.

### A Phase's Piece

A piece, `phases/{N}.json`, is one JSON object. A phase still to build:

```json
{
  "phase": {"name": "{name}", "goal": "{goal}", "sections": ["{A}"], "relies_on": [2]},
  "scenarios": ["Given {context}, when {action}, then {outcome}.", "…"],
  "notes": ["{text}"],
  "corrections": [
    {"was": "{what was wrong}", "found": "{what the code shows}", "changed": "{what was changed}", "task": "{N}.{n}", "title": "{title}", "to": "done"}
  ]
}
```

A phase found built is `{"phase": {"name": "{name}", "goal": "{goal}", "sections": ["{A}"], "built": true}, "scenarios": [], "notes": [], "corrections": [ … ]}`.

- **The phase** is the old plan's phase its brief names, or the area it names where no plan put one in the tracker. Its sources are the brief's: its tasks as the tracker holds them, its tasks' file and its own section of the plan, under the heading the brief names. Where the tracker's text and the plan's differ, the tracker's stands: the build reads it.
- **Its sections** are those the brief names its area numbering, and no other: the area, `{A}`, or a part of it, `{A}.{M}`, where the spec numbers one. The join refuses a section `spec.md` lacks.
- **A phase built** is its name, its goal, `"built": true`, and the sections its old plan built. A phase is built where the tracker holds every task of it done or closed, once the corrections are made.
- **A phase still to build** has its scenarios, at least one, written from the phase and each acceptance criterion of its tasks still to build. Each scenario is one line, `Given …, when …, then …`, of one behaviour; criteria that prove the same behaviour make one scenario, and no scenario says again what another does. A criterion about structure — a file's path, a class of its own — is carried as a scenario like any other. The join numbers them in the area, `{A}.S1` on, in the cut's order.
- **An area with no plan** is a phase still to build, its scenarios written from each section of the area: each of its rules is carried by a scenario.
- **What it relies on, `relies_on`,** is required of a phase still to build: each earlier phase of this cut, by its number, or another unit, by its name, that builds what it depends on. Each dependency the brief names, on a phase still to build, is among them; `[]` where it relies on nothing.
- **The notes** are what the build must know that no scenario says, with corrections or without: what a correction leaves to settle, a spike's question, where the tracker's text and the plan's differ, and each task still to build that the code holds in part — the build reads the code before building it. A note is a line or several, and holds no heading at level one or two, which would read as another note.
- **The corrections** settle what the tracker has wrong, from the phase's sources and the code: each disagreement between the manifest and the tracker the phase's brief names, every one, and any other task its sources show done, superseded by later work, or no longer wanted, which is corrected, never carried on as work to build. Read the code for what the task or the phase was to build, and say what was found, naming its evidence — the code's files, the later task by its id:
  - The code holds it, and the tracker holds the task neither done nor closed: the tracker is wrong. The correction ends the task, named as the brief names it, `"task": "{N}.{n}"`, with its title as the tracker holds it, `"to": "done"`.
  - The code holds it in another way than the task asked, or the work it asked for is no longer wanted: `"to": "closed"`, what was found its reason.
  - The code does not hold it: the tracker stands, and the correction changes nothing in it. Where the manifest counted the phase built, it is still to build.
  - The tracker holds the phase's every task ended, and the manifest does not count it built: the phase is built.
  - A task the tracker holds done that the code does not hold stays done; a note for later says what is missing.

  Each correction says, one line each, what was wrong, `was`, what the code shows, `found`, and what was changed, `changed`: the task ended, the phase's mark, or nothing. One that ends a task names it too, `task`, `title` and `to`, all three; one that changes nothing in the tracker names none of them:

  ```json
  {"was": "{what was wrong}", "found": "{what the code shows}", "changed": "Nothing in the tracker: the task stands, and the phase is cut still to build."}
  ```

### Its Cut

Once every phase's piece has passed its verifier, join them into the unit's plan:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs migrate join {unit} --directive 080-cut-and-merges
```

The join refuses a piece no verifier has passed. Where it refuses, write its refusal, as it reads, into the findings of each phase it names, and amend those. Once it is joined, the cut applies the plan whole, `{plan}` the path the join answers:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs cut {unit} --migrating --file {plan}
```

A cut that refuses writes nothing. Write each fault of its refusal, as it reads, into the findings of each phase it names, and amend those; then verify, join and cut again.

But a link it names, a task held after one of a later phase or another unit's — of this unit's tasks, or another unit's held after one of them — is the tracker's, which no piece settles. Judge each from the phases' sources and the code: whether the task still needs what the one it waits on builds. Where they don't settle it, ask the person in prose, naming both tasks as the refusal does and what the sources show, and **STOP.** Wait for user response.

- **It no longer holds.** Take the link off, `{task}` and `{after}` as the refusal names them, another unit's task by its id, `{plan}` the plan the join answered:

  ```bash
  node .claude/skills/ledger-engine/scripts/engine.cjs task unlink {unit} {task} --after {after} --file {plan}
  ```

- **It holds, a task of this unit's on another unit's.** Take the link off as above; the waiting task's phase relies on that unit instead, the build holding it until that unit completes. The ruling is `Settled: phase {N} relies on {other unit}, whose task {after} task {task} waits on, amend to agree`.
- **It holds, on a later phase of its own old plan.** Ask the person which way on, and **STOP.** Wait for user response. Either the link comes off as above, the waiting phase noting what the task waits on — `Settled: a note on phase {N} names task {after}, which task {task} waits on, amend to agree` — or the task is corrected as superseded by that later phase, closed, what was found its reason — `Settled: task {task} is superseded by task {after}, amend to agree`.
- **It holds, on a later phase of another of the unit's old plans.** A known edge: the cut orders the plans by what they depend on, never by the tracker's links. Say so to the person, as the refusal reads, and stop the directive there.
- **It holds, another unit's task on one of this unit's.** That unit was cut first, so its phase can't be amended to rely on this one: a known edge. Say so to the person, as the refusal reads, and stop the directive there.

Write each `Settled:` ruling above, a task of this unit's on another unit's and one on a later phase of its own old plan, into `phases/{N}.settled.md` of the waiting task's phase, as a reversal's is, and into its findings: it is amended and verified as any finding sends it. Once each link is settled, join and cut again.

## An Epic's Research

The move kept research that fed several topics on the epic's discovery log, in a session of its own, `{unit}/discovery/session-{NNN}.md`, opening on the migration's line, each source under `## Research: {source}`, `{source}` the name of the research file it came from. Only such a heading naming a research file opens a source: any other under it, a `## Research:` heading the research's own title made among them, is part of the source above it. Place each source by judgment:

- **Where it bears.** A topic it bears on is one whose conversation needs what the section holds to be had: its decisions turn on it, or it answers that topic's questions. A section bearing on one theme of the epic goes to that topic; one bearing on several goes to each.
- **Epic-wide.** A section that bears on the epic as a whole, or on no topic more than another, stays where it is: the records step carried what it holds on the epic's own record.
- **Logs only grow.** Append the section to the end of each topic's log, under `## Research: {source}, from discovery session {NNN}`, a blank line, then everything the session holds under its source's heading up to the next source's, word for word, its own headings among it, but each relative link rebased to resolve from the log's folder to what it named from the session's. A topic's log is `{unit}/topics/{topic}/log.md`, or, for a topic a split took to a new epic, `{epic}/topics/{topic}/log.md`. Change nothing already in the log, and leave the session as it stands.

Then write the placement, `.cache/migrate/cut-and-merges/{unit}/placed.json`: for each session, each of its sources and the topics it went to, `[]` for one left epic-wide:

```json
{"session-{NNN}.md": {"{source}": ["{topic}", "{topic}"], "{source}": []}}
```
