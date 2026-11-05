---
name: leeway-implementation-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

# The Build

The work unit's build: every phase of its cut, from its first phase's start to its last phase's close, then straight on into the review phase, all in this one conversation. You orchestrate and delegate: a task writer writes each phase's tasks as it starts, a builder builds each task, a pair of reviewers reviews it, and other agents consolidate a phase's notes and review the phase whole, each from a brief the engine issues and never from this conversation. You schedule the work, land what the agents find through the doors, fix the nits a review leaves, and keep the person out of it except where the engine stops for them. Nothing here decides the product afresh: the spec is concluded, and a call the build meets goes to the ledger or the person.

## Arguments

- `$0` — **work_type**: `epic`, `feature` or `bugfix`.
- `$1` — **work_unit**.

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

## Done When

Every phase of the unit's cut has closed, and the review phase, entered straight from here, has reached finish's yes.

## Entering

Every engine call is `node .claude/skills/leeway-engine/scripts/engine.cjs {verb} …`, each verb under **Doors**; one made from a task's worktree runs as the entry's `engine`.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs enter implementation {work_unit}
```

A refusal names the way on: say it in a line. Where another session holds the checkout's code or the unit's build, the entry asks first: emit its sections verbatim per their markers and follow the answer's `next`; carrying on from it ends the turn.

Then read what the DATA names: the unit's `record` and its `affected` entries, by running each call, and the `build log`, beside the ledger. Each affected entry is confirmed (`ledger hold`) or replaced before the work resting on it goes on. The rest of the DATA is where the build stands:
- Each `phase` line, and the `fixes owed` beneath one, say where the phase is.
- Each task `in flight` says what it waits on. A task with no builder dispatched here goes the way its line names, through the task loop. One at its gate is drawn there again; one behind the task in flight, or parked on a question, waits — none of these is ever sent to a new builder.
- `waiting` lists the questions waiting on the person.
- A `merge waiting` is that phase's gate, which comes before anything else: load **[phase-close.md](references/phase-close.md)** and follow its instructions as written, from **The Merge**.
- `finished` means the build is through: go on as **Closing** says.

In your own words, say in a line where the build stands and what comes first.

## The Build

The phases run in the cut's order, each through three stretches:
1. **Its start** — its tasks written and its start checklist closed: load **[phase-start.md](references/phase-start.md)** and follow its instructions as written, with N = `{N}`.
2. **Its tasks** — each built, reviewed and landed: load **[the-task-loop.md](references/the-task-loop.md)** and follow its instructions as written, with place = `implementation` and N = the phase's number.
3. **Its close** — its notes consolidated, its phase review, its stack merged and its close checklist closed: load **[phase-close.md](references/phase-close.md)** and follow its instructions as written, with N = `{N}`.

Phases overlap where they can. A phase relying on nothing unfinished may start whenever you schedule it — usually as the one before goes into its phase review — and a phase relying on another waits for that one's merge. Its start checklist says which: `relies-on-done` stays open until what it relies on is done. Plan ahead and pull work forward through the tracker as you see fit; the tasks' links and the checklists hold the order.

Nothing is finished while the cut holds a phase not yet written: no task ready with a phase still to start means that phase starts next.

### The Person

The build runs start to finish without the person, stopping only where the engine stops it. In the build, every question for the person goes through `raise`: one asked in plain prose is a slip. A waiting question is never a gate, and the build never goes back to a menu for one.

### The Build Log

Append to the build's log, `.leeway/{work_unit}/build/log.md`, as the work goes: what is in flight, what was tried and dropped, and at each phase's close what it left for the next. It is read after a compaction and when the build resumes, so write it for a reader who has only it and the ledger.

## Doors

- A phase's tasks → the task writer: `brief task-writer {work_unit} {N}`, after `task phase {work_unit} {N} --title "{name}"`; the phase's start → `checklist show|done|skip|close phase-start {work_unit} {N}`.
- What runs → `task ready {work_unit} [{N}]`, its `back` a task whose builder goes back in, `task start {work_unit} {task}`; its headline → `render build-headline {work_unit} --file {payload}`.
- An agent → `brief builder|fix {work_unit} {task}`, `brief reviewer {work_unit} {task} --letter {letter}`, `brief consolidation {work_unit} {N}`, `brief phase-review {work_unit} {N} --letter {letter}`; then the Agent call with the agent and the pointer `brief` answers, or SendMessage of the pointer to the agent already working the task.
- A builder's change, and your fix of a nit → `commit --paths {file}… --task {work_unit} {task} -m "{message}"`, from the task's worktree, yours run as the entry's `engine`.
- What the task was not told → `task add {work_unit} {task} --file {addition} --by {by:[orchestrator|person]}`; a task's type → `task type`; its order → `task link {work_unit} {task} --after {task}`.
- A note for later → `task note {work_unit} --file {note} [--phase {N}]`.
- A stuck task, or a phase review that failed → `task settle {work_unit} {task} --file {why}`, `task settle {work_unit} --phase {N} --file {why} [--fixes {task},…]`.
- A bugfix's reproducing test on the unfixed code, once task 1.1's account is taken → `verify run {work_unit} {scenario} --unfixed --test "{command}"`.
- A task landing → `task account {work_unit} {task}`, `render task-landed {work_unit} {task}`, `render step-gate {work_unit} {task}`, then `land open|chain {work_unit} {task}` and `task done {work_unit} {task}`; a task given up → `task close {work_unit} {task} --reason "{reason}"`; the phase's mutation run, the `next` of either ending its last task once its notes are consolidated, or named by `brief phase-review`'s refusal → `verify mutants {work_unit} {N}`.
- A phase's merge → `render phase-merge-gate {work_unit} {N}`, `land phase {work_unit} {N}`; its close → `checklist show|close phase-close {work_unit} {N}`.
- A call or a question → `ledger ask {work_unit}.implementation [--task {task}]`, then `raise {work_unit}.implementation --answers {question_id} [--parks {task}]`; a decision that must change → `raise {work_unit}.implementation --replaces {decision_id} --reason {reason} [--parks {task}]`; what relied on it → `ledger affected {work_unit}`, `ledger hold`.
- A question waiting → `raise waiting|draw|aside {work_unit} …`, its answer `raise answer {id} …`.
- A gate's answer → `gate "{name}" --pick {key}`, or `--typed {key}` for a typed row such as a Comment.

## Closing

The build closes as its last phase does: once every phase of the cut has closed, it runs straight on into the review phase, in this conversation, with no stop between them.

Invoke `/leeway-review-process {work_type} {work_unit}`.

## Something Outside the Plan

A bug the person reports, a gap or a find an agent reports beyond its task, anything the plan never held. Load **[outside-the-plan.md](references/outside-the-plan.md)** and follow its instructions as written, with place = `implementation`.

## Ready to Discuss a Question

The person says they are ready to talk about a waiting question, or all of them — in their own words, or as a message from the board naming the questions they queued. Load **[questions-waiting.md](references/questions-waiting.md)** and follow its instructions as written.

## A Task's Account

The person asks for a task's account, however long ago it landed. Fetch `render task-account {work_unit} {task}` and emit its sections verbatim per their markers.

## The Phases and Tasks

The person asks where the build stands, or for its phases and tasks. Fetch `render build-progress {work_unit}` and emit its sections verbatim per their markers.

## A Switch of Position

The person asks to run the build in auto, or in step. Record it, `workunit position {work_unit} {position:[auto|step]}`, and say in a line that it is switched.

## Backlogging

The person puts an idea, a bug or a fix aside — "roadmap it", "inbox it", "backlog that", "push it back". Load **[backlogging.md](../leeway-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{work_unit}`, phase = `implementation`.
