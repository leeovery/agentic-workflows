---
name: leeway-quick-fix-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

# Quick-Fix

A small, known change, made in one sitting: from its first fix to its close, all in this conversation, with no document and no plan before the work. You orchestrate and delegate: each fix is a task, built by a builder and passed by a pair of reviewers through the build's own task loop, each from a brief the engine issues. You write the fixes as tasks, their builders build them; you land what the agents find through the doors, fix the nits a review leaves, write each fix's short record, and keep the person out of it except where a raise or the close stops for them. Nothing here decides the product afresh: a call goes to the ledger or the person, and work that needs more than a quick call becomes a feature or a bugfix.

## Arguments

- `$0` — **work_type**: `quick-fix`.
- `$1` — **work_unit**.

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

## Done When

The person has said yes at the close: `finish yes` has landed the quick-fix's pull request, and the engine holds the work unit completed. Where they asked for the review there, the review phase reaches that yes instead.

## Entering

Every engine call is `node .claude/skills/leeway-engine/scripts/engine.cjs {verb} …`, each verb under **Doors**.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs enter implementation {work_unit}
```

A refusal names the way on: say it in a line. Where another session holds the checkout's code, the entry asks first: emit its sections verbatim per their markers and follow the answer's `next`; carrying on from it ends the turn.

Then read what the DATA names: the `change` and each `seed`, the person's own account of what to change; the unit's `record` by running its call; the `build log`; and the `summary` where it is written. The rest is where the fixes stand:
- `tasks` lists each fix and where it stands.
- Each fix `in flight` says what it waits on. One with no builder dispatched here goes the way its line names, through the task loop; one parked on a question waits, and is never sent to a new builder.
- `waiting` lists the questions waiting on the person.

On resume, say in your own words, in a line, where the fixes stand and what comes next.

## The Fixes

The change was settled with the person when this work was started: carry it out. Split it into fixes, each a change that stands on its own and lands as its own commit — one for each item where the quick-fix was started from several. A fix the work turns up later is one more.

### Writing a Fix

Write each fix as a task of phase 1, in the tracker's template, to `.leeway/.cache/{work_unit}/build/fix.md`: a level-one title on one line; then `## Type` — `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci` or `chore` — `## Problem`, `## Solution` and `## Outcome`, in the product's terms; `## Acceptance scenarios`, a list, each as the person would see it; and `## Spec reference`, `none`. Its pair reads it against its acceptance in its own words, so say there everything the fix must hold. Where the project records a verify setup and the fix changes what the product does, a criterion it is proven by running opens with its scenario's id, `{n}.S{k}` for fix `1.{n}`. Then record it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs task create {work_unit} 1 --file .leeway/.cache/{work_unit}/build/fix.md
```

A refusal names every fault: answer them and record it again.

### Building the Fixes

The fixes are built in the same loop as every task of a build: load **[the-task-loop.md](../leeway-implementation-process/references/the-task-loop.md)** and follow its instructions as written, with place = `implementation` and N = `1`. They run with no stop between them: the close is the quick-fix's one gate.

Once a fix's pair has passed it and its nits are committed, write its short record: what changed, why, and what it leaves out, each in the product's terms, to `.leeway/.cache/{work_unit}/build/record.md` under three level-two headings, `## What changed`, `## Why` and `## Leaves out`, none empty. Record it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs quick-fix record {work_unit} {task} --file .leeway/.cache/{work_unit}/build/record.md
```

A refusal names the way on: a fix with no commit of its own waits for one, and a record that does not read is written again.

### The Person

Every question for the person goes through `raise`: one asked in plain prose is a slip. One you raise in this conversation is drawn here, and parks nothing. One a fix's builder asks parks its fix, as the task loop says, and waits on the person; the other fixes carry on.

### The Build Log

Append to the build's log, `.leeway/{work_unit}/build/log.md`, as the work goes: what is in flight, what was tried and dropped, and what each fix came to. It is read after a compaction and when the quick-fix resumes, so write it for a reader who has only it and the ledger.

## Doors

- A fix → `task create {work_unit} 1 --file {path}`; its order → `task link {work_unit} {task} --after {task}`.
- What runs → `task ready {work_unit} 1`, `task start {work_unit} {task}`.
- An agent → `brief builder|fix {work_unit} {task}`, `brief reviewer {work_unit} {task} --letter {letter}`; then the Agent call with the agent and the pointer `brief` answers, or SendMessage of the pointer to the agent already working the fix.
- Your fix of a nit → `commit --paths {file}… --task {work_unit} {task} -m "{message}"`.
- What the fix was not told → `task add {work_unit} {task} --file {addition} --by {by:[orchestrator|person]}`; a builder that stops → `task stopped {work_unit} {task}`; a stuck fix → `task settle {work_unit} {task} --file {why}`.
- A fix landing → `land open {work_unit} {task}`, `task account {work_unit} {task}`, `task done {work_unit} {task}`; a fix given up → `task close {work_unit} {task} --reason "{reason}"`.
- A fix's short record → `quick-fix record {work_unit} {task} --file {record}`.
- A note for later → `task note {work_unit} --file {note}`; the notes answered at the close → `quick-fix notes {work_unit} --file {path}`, its file `{findings}`, each finding `{"area": "notes", "scope": "out", "call", "text", "from"}`, `from` the notes it answers as `notes#{k}`, then `inbox` the item filed or `drop` why, and `ledger`, your call's id.
- Your call on a note → `ledger ask {work_unit}.implementation`, `{"text", "by": "claude", "who_moved_whom": "none"}`; then `ledger decide {work_unit}.implementation --answers {question_id}`, `{"text", "why", "by": "claude", "who_moved_whom": "none"}`; a note filed → `inbox file {work_unit} --file {item}`, `{"kind", "text", "call"}`: its kind `idea`, `bug` or `quick-fix`, its text opening on its `# Title`, its call your decision's id.
- A call or a question → `ledger ask {work_unit}.implementation [--task {task}]`, then `raise {work_unit}.implementation --answers {question_id} [--parks {task}]`; a decision that must change → `raise {work_unit}.implementation --replaces {decision_id} --reason {reason} [--parks {task}]`; what relied on it → `ledger affected {work_unit}`, `ledger hold`.
- A question waiting → `raise waiting|draw|aside {work_unit} …`, its answer `raise answer {id} …`.
- Earlier work → `knowledge query "{term}" …`.
- The close → `checklist show|done|skip|close finish {work_unit}`, then `render finish {work_unit}`, whose yes runs `finish yes` and whose review row runs `review ask`.
- The work as a feature or a bugfix → `workunit move {work_unit} --to {type:[feature|bugfix]} --file {payload}`, whose yes runs `start-this-work yes`.
- The work leaving → `render cancel-gate {work_unit}`, whose `next` runs `workunit cancel`; then `render workunit-receipt`.
- A gate's answer → `gate "{name}" --pick {key}`, or `--typed {key}` for a typed row such as an Ask.

## Closing

The quick-fix closes once every fix is done or closed, each done fix recorded. Finish closes on its checklist; `checklist show finish {work_unit}` lists its items, and the engine checks most of them, an open one naming its way on. Yours:
- `inbox-closed` — the build's log names each live inbox item this work resolved, by its path, and the item stays in the inbox.
- `build-log-closed` — the build's log ends on what the fixes came to, nothing left in flight.

Where `notes-answered` stays open, the notes for later its fixes' builders and pairs left stand: each is answered by a finding out of scope, of the area `notes`, from `notes#{k}`, note {k} of `.leeway/{work_unit}/build/notes.md`, filed to the inbox or dropped by your call. Write them, `{findings}`, to `.leeway/.cache/{work_unit}/build/notes.json` and record them:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs quick-fix notes {work_unit} --file .leeway/.cache/{work_unit}/build/notes.json
```

A refusal names every fault: put each right and record them again.

Mark each as it holds, `checklist done finish {work_unit} {item}`, or skip it with its reason, `checklist skip finish {work_unit} {item} --reason "{reason}"`. Close it, `checklist close finish {work_unit}`, then draw the close, emitting its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render finish {work_unit}
```

A refusal names the way on: take it, then draw the close again. Each verdict the screen asks before its gate goes to `gate`, whose `next` gives the verdict; then draw the screen again. The gate's answer goes to `gate`: follow its `next`, and then the `next` of what it ran. The yes lands the quick-fix's pull request and completes the work; a refusal of the yes names the way on: take it, then run the yes again. The review row records the person's request, and its `next` carries this conversation into the review phase, which hands back to this close once it ends.

## Something Outside the Plan

A bug the person reports, a gap or a find an agent reports beyond its fix, anything the change never held. Load **[outside-the-plan.md](../leeway-implementation-process/references/outside-the-plan.md)** and follow its instructions as written, with place = `implementation`; a fix it calls for is one more task of phase 1, written as **Writing a Fix** says.

## Ready to Discuss a Question

The person says they are ready to talk about a waiting question, or all of them — in their own words, or as a message from the board naming the questions they queued. Load **[questions-waiting.md](../leeway-implementation-process/references/questions-waiting.md)** and follow its instructions as written.

## Backlogging

The person puts an idea, a bug or a fix aside — "roadmap it", "inbox it", "backlog that", "push it back". Load **[backlogging.md](../leeway-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{work_unit}`, phase = `implementation`.

## Moving It to a Feature or a Bugfix

The work needs a decision from the person beyond a quick call — what the product should do, or a cause still to find. Say so as a tentative read the person can push back on; on their word it moves, a feature where it needs deciding, a bugfix where it needs investigating. The move is refused once a fix has landed.

Bring the build's log up to date, then draft the new type's brief at `.leeway/.cache/{work_unit}/build/brief.md`: what the quick-fix set out to change, what the work showed, and the open questions — nothing in it a decision. Write `{"description": "{one line in the person's framing}", "reason": "{one line on why it is this type}", "brief": ".leeway/.cache/{work_unit}/build/brief.md"}` to `.leeway/.cache/{work_unit}/build/move.json`, then stage the move and draw start this work's screen, emitting its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs workunit move {work_unit} --to {type:[feature|bugfix]} --file .leeway/.cache/{work_unit}/build/move.json
```

A refusal names what to fix. The answer goes to `gate`; follow its `next`, and then the `next` of what it ran: the move closes the fixes not done, so stop every agent you dispatched with the TaskStop tool before the handoff into the new type's first phase. The person keeping shaping keeps the quick-fix: carry on with its fixes.

## Cancelling the Quick-Fix

The person calls the quick-fix off. Bring the build's log up to date, then fetch the confirm, `render cancel-gate {work_unit}`, emit its MENU verbatim per its marker and follow the answer's `next`. A refusal names what holds the unit: say it in a line.

The cancel takes the unit's cache, its agents' rows with it: stop every agent you dispatched with the TaskStop tool. Fetch its receipt, adding `--warn` where the response carries warnings and `--inbox {n}` where its `inbox` lists the waiting messages the cancel moved, `{n}` their count, and emit its sections verbatim per their markers; the unit is closed, and the turn ends:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render workunit-receipt {work_unit} --verb cancel [--warn] [--inbox {n}]
```
