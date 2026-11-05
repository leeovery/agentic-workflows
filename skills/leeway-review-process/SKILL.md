---
name: leeway-review-process
user-invocable: false
allowed-tools: Bash(node .claude/skills/leeway-engine/scripts/engine.cjs *)
---

# Review

The third review, once every phase of the build has closed: the whole change held against the spec's intent by independent agents — a pair for each of the spec's areas, reading its area, where it meets the others and the unit's calls whole, and running what touches it; and one reader over every test file of the change. You orchestrate the rounds. Every finding lands somewhere — a fix task, the inbox, or dropped — the fixes are built through the build's own task loop, and the areas they changed are read again, until a round passes. Each round's report is shown to the person, and finish is theirs.

## Arguments

- `$0` — **work_type**: `epic`, `feature`, `bugfix` or `quick-fix`.
- `$1` — **work_unit**.

## Instructions

Load **[framework.md](../leeway-shared/references/framework.md)** and follow its instructions as written.

## Done When

The person has said yes at finish: the engine then holds every phase of the build landed, the review's fix phases last, and the work unit completed.

## Entering

The build runs straight into this phase, invoking it in place once the cut's last phase has closed; after a break, a menu moves into it. Every engine call is `node .claude/skills/leeway-engine/scripts/engine.cjs {verb} …`, each verb under **Doors**.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs enter review {work_unit}
```

A refusal names the way on: say it in a line. Where another session holds the unit or the checkout's code, the entry asks first: emit its sections verbatim per their markers and follow the answer's `next`; carrying on from it ends the turn.

Otherwise read what the DATA names that this conversation does not hold already — the spec, the unit's record by its call, the build's log, each round's report, the builders' `notes`: each once in the conversation, and after that only what is new since. `base` is the branch the unit's work lands on, and `waiting` lists the questions waiting on the person. Then its lines say what comes next, the first that applies:
- `fix task waiting` — the last round's fix tasks are built (**The Fixes**).
- `merge waiting` — their phase merges at its gate (**The Fixes**).
- a `round` saying its builders' notes are answered — **The Builders' Notes**.
- a `round` saying finish is next — **Closing**.
- `reads` not yet named — **Reading Again**.
- otherwise **The Round** reads what `reads` names.

Each ends by entering again, whose DATA says what comes next.

## The Round

Each move once the one before it holds:
1. **The readers.** For each area `reads` names, its pair: `brief review-area {work_unit} --area {n} --base {base} --letter {letter:[a|b]}`, once for each letter; and where it names the test surface, its one reader: `brief test-surface {work_unit} --base {base}`. `{n}` is the area's number, `{base}` the entry's `base`. A report the entry names `report in` is in already, and its reader is not briefed again. Make the Agent call with the agent and the pointer each brief answers. The round waits for every report.
2. **The findings.** Each report is whole in its file; the agent's final message holds only its nits, its notes for later and its verdict. Every item of every report is answered by exactly one finding, and each finding lands somewhere:
   - **In scope**, in the unit's delivered change: a fix task, however small, since no code changes outside a task. One below the floor, or not real, is dropped with its reason.
   - **Out of scope**, beside the change: drop what is not worth doing, group related findings into one item, and file the rest to the inbox. Nothing is offered to the person, and a drop is never raised.
   - A report's notes for later are items of it too, and lie beyond the change: each is answered by a finding out of scope, filed or dropped, never a fix.
   - Each `builder note` the entry names is an item of the round too, `notes#{k}`, note {k} of the `notes` file — a note a fix task's builder left — answered as a report's note is; a finding answering those alone is of the area `notes`.

   Each file-or-drop call out of scope, and each serious finding or bug dropped in scope, is your call on the ledger with its reason. A finding filed goes to the inbox once its call is in.
3. **The fix tasks.** A round's fix tasks are one more phase of the build, its own: phase {N}, as the entry's `fix phase` line names it. Write the phase, then each fix as a task, findings one change fixes sharing it: its type `fix`, its acceptance scenario the finding's user scenario, its spec reference the area.
4. **The record.** Write the round to `.leeway/.cache/{work_unit}/review/round.json` and record it, `review round {work_unit} --file .leeway/.cache/{work_unit}/review/round.json`. A refusal names every fault. A report missing or not reading goes back to its reader: brief it again, the fresh brief naming the report it replaces, and never edit a reader's report. A tree changed is **The Working Tree**. Put every other fault right, and record the round again.
5. **The report.** Draw it, emitting its sections verbatim per their markers:

   ```bash
   node .claude/skills/leeway-engine/scripts/engine.cjs render review-report {work_unit}
   ```

   The report is no gate: enter again.

### A Round That Fails Again

A round that fails on findings its fix tasks already addressed is yours to settle, as a stuck task is: judge what is wrong and settle it. Where the fix missed, a new fix task carries what it missed, and its finding's text says so: the earlier round's fix missed it, and what the new task carries. Where the findings were fixed in an earlier round or are rightly dropped, the round makes no fix task and its `settled` says how. The report shows either. No count stops the rounds, and settling one stops for the person only where the answer needs them: a question to them goes through `raise` (**The Person**).

### The Working Tree

The review takes its turn in the checkout and leaves the working tree as it found it. Where `review round` refuses a tree outside `.leeway/` changed since the round began, or holds no snapshot of it, the person answers what becomes of the tree at its gate: fetch it and emit its sections verbatim per their markers.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render review-tree {work_unit}
```

The answer goes to `gate`: follow its `next`, then record the round again; where something stays changed, the round refuses again and the gate returns with what remains. Where putting it back answers a `set_aside`, say in a line where what it changed is kept until the person removes it: its `folder`, and each of its `paths`. Where the person puts back by hand what the gate could not, record the round again.

## The Fixes

The fix tasks the entry names are built in the same loop as every task of the build: load **[the-task-loop.md](../leeway-implementation-process/references/the-task-loop.md)** and follow its instructions as written, with place = `review` and N = `{N}`, as the entry's `fix phase` line names it. A fix phase has no checklists and no phase review: the areas its tasks changed are read again instead. Once the loop hands back, enter again.

Where the entry names a `merge waiting` gate, phase {M}, the phase that line names, merges first; it can be lower than the fix phase. Fetch the gate and emit its sections verbatim per their markers; the answer goes to `gate`, and you follow its `next`:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render phase-merge-gate {work_unit} {M}
```

### The Builders' Notes

Once the round that ended the review has its fix tasks done, the notes their builders left are answered before finish, as a round answers its notes: each `builder note` the entry names by a finding out of scope, of the area `notes`, filed or dropped by your call. Write them, `{findings}`, to `.leeway/.cache/{work_unit}/review/notes.json` and record them, `review notes {work_unit} --file .leeway/.cache/{work_unit}/review/notes.json`; they join that round's report. A refusal names every fault: put each right and record them again. Then draw the report again, emitting its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render review-report {work_unit}
```

The report is no gate: enter again.

## Reading Again

Once a round's fix tasks are done, the next round reads again, whole, every area whose code they changed: name them, `review reads {work_unit} {read} …`, each read the entry's `reads` line says it must take among them. An area nothing changed is not read again, and the whole change is never read against the spec once more. Then enter again, and **The Round** reads them.

## The Person

The review runs without the person but for its reports and finish. Every question for them goes through `raise`, at the review's place: one asked in plain prose is a slip. One that waits — raised in a round, as one is settled, or for a fix task — is never a gate. Load **[waiting-on-the-person.md](../leeway-implementation-process/references/waiting-on-the-person.md)** and follow its instructions as written.

## Doors

- A reader → `brief review-area {work_unit} --area {n} --base {base} --letter {letter:[a|b]}`, `brief test-surface {work_unit} --base {base}`; then the Agent call with the agent and the pointer `brief` answers.
- Your call on a finding → `ledger ask {work_unit}.review`, `{"text", "by": "claude", "who_moved_whom": "none"}`; then `ledger decide {work_unit}.review --answers {question_id}`, `{"text", "why", "by": "claude", "who_moved_whom": "none"}`.
- A finding filed → `inbox file {work_unit} --file {item}`, `{"kind", "text", "call"}`: its kind `idea`, `bug` or `quick-fix`, its text opening on its `# Title`, its call your decision's id.
- The fix phase → `task phase {work_unit} {N} --title "{title}"`, then `task create {work_unit} {N} --file {path}` for each task, its file a `#` title over `## Type`, `## Problem`, `## Solution`, `## Outcome`, `## Acceptance scenarios` and `## Spec reference`, in the cache.
- The tree changed → `render review-tree {work_unit}`, its rows running `review restore-tree` or `review accept-tree {work_unit}`.
- The builders' notes → `review notes {work_unit} --file {path}`, its file `{findings}`, each finding as the round's.
- The round → `review reads|round|accept-tree {work_unit}`, the round's file `{can_now, findings, settled?}`: `can_now`, each line of what the person can now do that they could not; each finding's `area` by its name, `tests` for the test surface, `scope` `in` or `out`, `call`, `text` and `from`, the report items it answers as `{report}#{n}`, a note for later as `{report}#n{k}`, a builder's note as `notes#{k}`, then where it landed — `fix` its task, `inbox` the item filed, or `drop` why — and `ledger`, your call's id, where you made one; `settled`, how a round that makes no fix task was settled. Its report → `render review-report {work_unit} [--round {r}]`.
- A question only the person can answer → `ledger ask {work_unit}.review [--task {task}]`, then `raise {work_unit}.review --answers {question_id} [--parks {task}]`.
- A question waiting → `raise waiting|draw|aside {work_unit} …`, its answer `raise answer {id} …`.
- The close → `checklist show|done|skip|close finish {work_unit}`, then `render finish {work_unit}`, whose yes runs `finish yes`.
- A gate's answer → `gate "{name}" --pick {key}`, or `--typed {key}` for a typed row such as a Comment.

## Closing

Once a round has passed, or been settled, and its fix tasks are done, finish closes on its checklist; `checklist show finish {work_unit}` lists its items, and the engine checks most of them, an open one naming its way on. Yours:
- `inbox-closed` — the build's log names each live inbox item this work resolved, by its path, and the item stays in the inbox.
- `build-log-closed` — the build's log ends on what the build and its review came to, nothing left in flight.

Mark each as it holds, `checklist done finish {work_unit} {item}`, or skip it with its reason, `checklist skip finish {work_unit} {item} --reason "{reason}"`. Close it, `checklist close finish {work_unit}`, then draw finish, emitting its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render finish {work_unit}
```

Each verdict the screen asks before its gate goes to `gate`, whose `next` gives the verdict; then draw the screen again. The gate's answer goes to `gate`: follow its `next`, and then the `next` of what it ran. A refusal of the yes names the way on: take it, then run the yes again.

## The Calls

The person asks what was decided for them — "show me the calls", "what did you decide". Fetch the calls and emit their sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render review-calls {work_unit}
```

## Something Outside the Plan

While the fix tasks run, a bug the person reports, or a gap or a find an agent reports beyond its task. Load **[outside-the-plan.md](../leeway-implementation-process/references/outside-the-plan.md)** and follow its instructions as written, with place = `review` and N = the fix phase.

## Ready to Discuss a Question

The person says they are ready to talk about a waiting question, or all of them — in their own words, or as a message from the board naming the questions they queued. Load **[questions-waiting.md](../leeway-implementation-process/references/questions-waiting.md)** and follow its instructions as written.

## A Task's Account

The person asks for a task's account, a fix task's or any of the build's. Fetch `render task-account {work_unit} {task}` and emit its sections verbatim per their markers.

## The Phases and Tasks

The person asks for the build's phases and tasks, the fix phases among them. Fetch `render build-progress {work_unit}` and emit its sections verbatim per their markers.

## A Switch of Position

The person asks to run the fix tasks in auto, or in step. Record it, `workunit position {work_unit} {position:[auto|step]}`, and say in a line that it is switched.

## Backlogging

The person puts an idea, a bug or a fix aside — "roadmap it", "inbox it", "backlog that", "push it back". Load **[backlogging.md](../leeway-shared/references/backlogging.md)** with work_unit = `{work_unit}`, topic = `{work_unit}`, phase = `review`.
