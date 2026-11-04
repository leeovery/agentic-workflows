# The Task Loop

*Reference for **[leeway-implementation-process](../SKILL.md)***

---

Each task goes from ready to done: started, built by its builder in a worktree of its own, reviewed whole by its pair until a round passes, its nits fixed by you, its account taken, then landed into its phase's stack. The loop takes on as many tasks as can run, and runs until every task of phase {N} is done or closed. Its calls and questions land at `{work_unit}.{place}`, the place the caller names: the build's, `implementation`, or the review phase's for its fix tasks.

## Taking Tasks

`task ready {work_unit} {N}` answers what can start: the tracker's links hold what waits on what, and a task a question parks is never ready. Tasks that share no files run side by side, each in its own worktree; work on a shared file runs one task at a time. Start each task you take, `task start {work_unit} {task}`. A refusal says why the task cannot start yet — its phase not started, or the build running one task at a time — and it waits.

Where it answers `back`, that task is in progress already, an answer having freed it, and its turn has come: send its builder its brief again, `brief builder {work_unit} {task}`, by SendMessage to the builder's id. Where this conversation holds no builder for it, after a `/clear`, it goes through **The Builder** afresh, its new builder carrying on from where the work stands.

Tasks started together share one headline. Write, for each, what it is about to change and what to watch when it lands, in the product's terms, to `.leeway/.cache/{work_unit}/build/headline.json` — `{"tasks": [{"task", "changes", "watch"}, …]}` — then fetch it and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render build-headline {work_unit} --file .leeway/.cache/{work_unit}/build/headline.json
```

## The Builder

Brief the task's builder, then make the Agent call — its `subagent_type` the agent `brief` answers, its prompt the pointer alone — in a worktree of its own, `isolation: "worktree"`, whatever the build's position:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief builder {work_unit} {task}
```

Every later message to the task's builder goes to the id its Agent call answered, by SendMessage of a pointer `brief` issued — the id held in the entry's `in flight` after a compaction. A builder is never replaced while its task is in flight here. An agent this conversation holds no id for, one an earlier conversation dispatched, is sent nothing: its brief goes in an Agent call of its own, as **The Builder** and **The Pair** make them.

When it reports, land what it lists first. Each call — a way it took that the record left open — goes on the ledger for its task, `ledger ask {work_unit}.{place} --task {task}`, then `raise {work_unit}.{place} --answers {question_id} --parks {task}`, its way your lean. Each question it lists goes the same way, put as the person meets the product. Each note goes into the notes for later, `task note {work_unit} --file {note}`, written to `.leeway/.cache/{work_unit}/build/note.md`. Then go on by its status:
- **Built**, or **fixed** — the pair reads it (**The Pair**).
- **Stopped** — **A Builder That Stops**.
- **Accounted** — its account is written (**Landing**).
- **Merged** — its branch holds its chain's tip again, its account taken: land it, from `land open` (**Landing**).

## The Pair

Brief each reviewer of the pair, `{letter}` `a` and `b` — the engine reads where the task's range starts — then make their Agent calls side by side, each its `subagent_type` the agent `brief` answers and its prompt the pointer alone, with no worktree:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs brief reviewer {work_unit} {task} --letter {letter}
```

Of each report you take its nits, its verdict and its notes for later, each note under its `## Notes for later` going into the notes, `task note`, one each. A verb refusing the round's reports names each reviewer's way on: one still running is waited for; one that does not read, or stopped without its report, gets its brief again, by SendMessage to its id: the brief names the report it replaces.

- **A round that fails** goes back to the same builder, with its reviewers' reports and nothing of yours: `brief fix {work_unit} {task}`, its pointer by SendMessage to the builder's id. Where it refuses naming the builder's brief — no builder briefed in this conversation, or the task changed since its builder's last brief — send that first, `brief builder {work_unit} {task}`, then the fix brief. Once the builder reports it fixed, the same pair reads the whole task again: brief each again, each pointer by SendMessage to that reviewer's id. No count stops the rounds.
- **A round that passes** — nothing serious and no bug — leaves its nits to you. Fix each there and then in the task's worktree, and commit the fixes from there through the door, the entry's `engine` running `commit --paths {file}… --task {work_unit} {task} -m "{message}"`, so the tasks after it build on the fixed code: no round and no trip back to the builder. Then, unless a question parks the task, send the builder its brief again, `brief builder {work_unit} {task}`, by SendMessage: its brief says the task has landed, and it writes its account — or, where something was added to the task or one of its calls decided against its lean since its pair was briefed, that the task changed: the builder builds what changed, and the pair reads the task again. A parked task's builder is sent nothing until the answer frees it.

### A Stuck Task

A finding it fixed coming back, or the builder and the pair going round on one point, is yours to judge and settle, in either position. Where a change settles it, put what the builder needs onto the task (**A Builder That Stops**) and let the rounds run on. Where the finding is wrong, or nothing more is owed, settle the round: write why, and what was done about it, to `.leeway/.cache/{work_unit}/build/settle.md`, run `task settle {work_unit} {task} --file .leeway/.cache/{work_unit}/build/settle.md`, and send the builder its brief again, which names the settlement. Only an answer that needs the person stops the task: raise it for the task, and the rest of the build runs on.

## A Builder That Stops

A builder stops on a problem it cannot build past. Record the stop, `task stopped {work_unit} {task}`, then decide what to do: think it through, or where the answer needs the person, raise it for the task. Then put what the builder should know onto the task, written to `.leeway/.cache/{work_unit}/build/addition.md` — a fact about the code the task was written before, an answer to its question, or the person's instruction — `task add {work_unit} {task} --file .leeway/.cache/{work_unit}/build/addition.md --by {by:[orchestrator|person]}`, and send the builder back in, `brief builder {work_unit} {task}` by SendMessage. A decision goes to the ledger, never onto the task, and the builder's brief carries it among the decided calls. Nothing onto a task sets how its builder works, where it looks or how big the work is, and the builder never edits its task.

## Waiting on the Person

A question that waits parks its task, and whatever depends on it, while everything else carries on: say so in the one line the raise answers. The parked task waits, its builder idle, until the answer frees it: the receipt says it builds again, and its builder goes back in the same way. A question is drawn only once the person says they are ready to discuss it.

When nothing left can go on without an answer, stop with the build's report: fetch it and emit its sections verbatim per their markers, which ends the turn.

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render build-stop {work_unit}
```

It refuses while anything can go on, naming what: take that on instead.

## Landing

Once the builder reports its account written, take it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs task account {work_unit} {task}
```

A refusal of the account goes back to the builder: its brief again, by SendMessage, names every fault. Then fetch the task's landing summary and emit its sections verbatim per their markers:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render task-landed {work_unit} {task}
```

Then fetch its gate:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs render step-gate {work_unit} {task}
```

It is refused where the build runs in auto, where no gate follows a task: land it. Otherwise emit its sections verbatim per their markers, which ends the turn, and take the person's answer to `gate "step gate"`:
- **yes** — land it.
- **auto** — its `next` switches the build to auto; run it, then land the task.
- **technical** — retell the task's account from the code's side (**[technical-lens.md](../../leeway-shared/references/technical-lens.md)**), then run its `next`.
- **show** — draw what the task built as diagrams, then run its `next`.
- **Comment** — the person's change goes onto the task as theirs, `--by person`, before the builder goes back in; the pair reads the task again, a new account is taken, and its gate comes again once the task stands at it. Where this conversation holds no builder for the task, after a `/clear`, it goes through **The Builder** afresh, its new builder carrying on from where the work stands.

Land a task into its phase's stack:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs land open {work_unit} {task}
node .claude/skills/leeway-engine/scripts/engine.cjs land chain {work_unit} {task}
```

`land open`, `land chain` and `task done` refuse a task with no account taken: send the builder its brief again, by SendMessage, and go on by its status. Where `land open` refuses a branch that does not descend from its chain's tip — a task built beside another that chained first — the brief again says to merge the tip back. Then end it:

```bash
node .claude/skills/leeway-engine/scripts/engine.cjs task done {work_unit} {task}
```

Where `land chain`, or `task close` for a task given up, answers a `next`, run it.

The loop ends once every task of phase {N} is done or closed, and hands back to where it was loaded from.
