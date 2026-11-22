# The Task Loop

*Reference for **[ledger-implementation-process](../SKILL.md)**, **[ledger-quick-fix-process](../../ledger-quick-fix-process/SKILL.md)** and **[ledger-review-process](../../ledger-review-process/SKILL.md)***

---

Each task goes from ready to done: started, built by its builder in a worktree of its own, reviewed whole by the reviewers you chose for it until a round passes, its nits fixed by you, its account taken, then landed into its phase's stack. The loop takes on as many tasks as can run, and runs until every task of phase {N} is done or closed. A quick-fix's tasks differ where **A Quick-Fix's Tasks** says. Its calls and questions land at `{work_unit}.{place}`, the place the caller names: the build's, `implementation`, or the review phase's for its fix tasks.

## Taking Tasks

`task ready {work_unit} {N}` answers what can start. Tasks that share no files run side by side, each in its own worktree; work on a shared file runs one task at a time. Start each task you take, `task start {work_unit} {task}`. A refusal says why the task cannot start yet, and it waits.

Where it answers `back`, that task is in progress already, an answer having freed it, and its turn has come: send its builder its brief again, `brief builder {work_unit} {task}`, by SendMessage to the builder's id. Where this conversation holds no builder for it, after a `/clear`, it goes through **The Builder** afresh, its new builder carrying on from where the work stands.

Tasks of the build started together share one headline. Write, for each, what it is about to change and what to watch when it lands, in the product's terms, to `.ledger/.cache/{work_unit}/build/headline.json` — `{"tasks": [{"task", "changes", "watch"}, …]}` — then fetch it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render build-headline {work_unit} --file .ledger/.cache/{work_unit}/build/headline.json
```

## A Quick-Fix's Tasks

A quick-fix's tasks — its fixes, and its review's fix tasks — are built in the quick-fix's worktree, on its one branch, one at a time: the task in flight holds the worktree until it is done or closed, or a question parks it. Once an answer frees it and `task ready` answers it as `back`, start it again, `task start {work_unit} {task}`, then send its builder its brief again; a start refused names the way on. Its builder's Agent call takes no worktree of its own, and your nit fixes are made and committed in the quick-fix's worktree while the fix holds it: a parked fix's nits wait until it holds the worktree again. Its reviewers read its own commits alone. It has no headline, no landing summary, no gate and no stack: its pull request takes every commit as it is made, so run `land open {work_unit} {task}` each time its builder reports it built or fixed and once your nit fixes are committed. Once its account is taken, or a one-line fix is built, it lands with `land open` again, then `task done`. Its notes for later, its builders' and its reviewers', go into the notes as any task's do, and its close answers them, or its review where the person asks for one.

## Its Review

Before briefing a task's builder, choose its reviewers and record why: `task review {work_unit} {task} --reviewers {count:[1|2]} --file {why}` — usually one, two where the stakes call for it.

## The Builder

Brief the task's builder, then make the Agent call in a worktree of its own, `isolation: "worktree"`, whatever the build's position — a quick-fix's builder in none:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief builder {work_unit} {task}
```

Every later message to the task's builder goes to the id its Agent call answered, by SendMessage of a pointer `brief` issued — the id held in the entry's `in flight` after a compaction. A builder is never replaced while its task is in flight here. An agent this conversation holds no id for, one an earlier conversation dispatched, is sent nothing: its brief goes in an Agent call of its own, as **The Builder** and **The Reviewers** make them.

When it reports, land what it lists first. Each call — a way it took that the record left open — goes on the ledger for its task, `ledger ask {work_unit}.{place} --task {task}`, then `raise {work_unit}.{place} --answers {question_id} --parks {task}`, its way your lean. Each question it lists goes the same way, put as the person meets the product. Each note goes into the notes for later, `task note {work_unit} --file {note}`, written to `.ledger/.cache/{work_unit}/build/note.md`. Then go on by its status:
- **Built**, or **fixed** — its reviewers read it (**The Reviewers**).
- **Stopped** — **A Builder That Stops**.
- **Accounted** — its account is written (**Landing**).
- **Merged** — its branch holds its chain's tip again, its account taken: land it, from `land open` (**Landing**).

## The Reviewers

Brief each of its reviewers, `{letter}` `a`, and `b` where it has two, then make their Agent calls at once, with no worktree:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs brief reviewer {work_unit} {task} --letter {letter}
```

Of each report you take its nits, its verdict and its notes for later, each note under its `## Notes for later` going into the notes, `task note`, one each. A verb refusing the round's reports names each reviewer's way on, a brief again going by SendMessage to its id.

- **A round that fails** goes back to the same builder, with its reviewers' reports and nothing of yours: `brief fix {work_unit} {task}`, its pointer by SendMessage to the builder's id — a parked task's builder once the answer frees it. Once the builder reports it fixed, the same reviewers read the whole task again: brief each again, each pointer by SendMessage to that reviewer's id. No count stops the rounds.
- **A round that passes** — nothing serious and no bug — leaves its nits to you. Fix each there and then in the task's worktree — a quick-fix's in the quick-fix's worktree, once the fix holds it (**A Quick-Fix's Tasks**) — and commit the fixes from there through the door, the entry's `engine` running `commit --paths {file}… --task {work_unit} {task} -m "{message}"`, so the tasks after it build on the fixed code: no round and no trip back to the builder. Then, unless a question parks the task, send the builder its brief again, `brief builder {work_unit} {task}`, by SendMessage. A parked task's builder is sent nothing until the answer frees it.

### A Stuck Task

A finding it fixed coming back, or the builder and its reviewers going round on one point, is yours to judge and settle, in either position. Where a change settles it, put what the builder needs onto the task (**A Builder That Stops**) and let the rounds run on. Where the finding is wrong, or nothing more is owed, settle the round: write why, and what was done about it, to `.ledger/.cache/{work_unit}/build/settle.md`, run `task settle {work_unit} {task} --file .ledger/.cache/{work_unit}/build/settle.md`, and send the builder its brief again. Only an answer that needs the person stops the task: raise it for the task, and the rest of the build runs on.

## A Builder That Stops

A builder stops on a problem it cannot build past. Record the stop, `task stopped {work_unit} {task}`, then decide what to do: think it through, or where the answer needs the person, raise it for the task. Then put what the builder should know onto the task, written to `.ledger/.cache/{work_unit}/build/addition.md` — a fact about the code the task was written before, an answer to its question, or the person's instruction — `task add {work_unit} {task} --file .ledger/.cache/{work_unit}/build/addition.md --by {by:[orchestrator|person]}`, and send the builder back in, `brief builder {work_unit} {task}` by SendMessage. A decision goes to the ledger, never onto the task. Nothing onto a task sets how its builder works, where it looks or how big the work is, and the builder never edits its task.

## Waiting on the Person

A question raised for a task, or for the phase, can wait on the person. Load **[waiting-on-the-person.md](waiting-on-the-person.md)** and follow its instructions as written.

## Landing

A one-line task takes no account: once it is built, it lands. Any other, once the builder reports its account written, take it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs task account {work_unit} {task}
```

A refusal of the account goes back to the builder: its brief again, by SendMessage, names every fault.

A bugfix's task 1.1, the test that reproduces the bug: once its account is taken, run it on the unfixed code with the scenario and the command the task names, `verify run {work_unit} {scenario} --unfixed --test "{command}"`. A run that passes sends the test back to its builder: put the run that passed and its output onto the task, written to `.ledger/.cache/{work_unit}/build/addition.md`, `task add {work_unit} 1.1 --file .ledger/.cache/{work_unit}/build/addition.md --by orchestrator`, and send the builder back in, `brief builder {work_unit} 1.1` by SendMessage.

A quick-fix's task lands as **A Quick-Fix's Tasks** says. Any other: fetch the task's landing summary:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render task-landed {work_unit} {task}
```

Then fetch its gate:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs render step-gate {work_unit} {task}
```

It is refused where the build runs in auto, where no gate follows a task: land it. Otherwise take the person's answer to `gate "step gate"`:
- **yes** — land it.
- **auto** — run its `next`, then land the task.
- **technical** — retell the task's account from the code's side (**[technical-lens.md](../../ledger-shared/references/technical-lens.md)**), then run its `next`.
- **show** — draw what the task built as diagrams, then run its `next`.
- **Comment** — the person's change goes onto the task as theirs, `--by person`, before the builder goes back in; its reviewers read the task again, a new account is taken, and its gate comes again once the task stands at it. Where this conversation holds no builder for the task, after a `/clear`, it goes through **The Builder** afresh, its new builder carrying on from where the work stands. A one-line task you change yourself, committed through the door, and its gate comes again.

Land a task into its phase's stack:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs land open {work_unit} {task}
node .claude/skills/ledger-engine/scripts/engine.cjs land chain {work_unit} {task}
```

`land open`, `land chain` and `task done` refuse such a task with no account taken: send the builder its brief again, by SendMessage, and go on by its status. Where `land open` refuses a branch that does not descend from its chain's tip, the brief again says to merge the tip back. Then end it:

```bash
node .claude/skills/ledger-engine/scripts/engine.cjs task done {work_unit} {task}
```

Where `land chain`, `task done`, or `task close` for a task given up, answers a `next`, run it.

The loop ends once every task of phase {N} is done or closed, and hands back to where it was loaded from.
