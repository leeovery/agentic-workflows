# The build

The build turns the specification into code: every phase of the cut, from the first phase's start to the last phase's close, then straight on into the [review phase](review.md), all in one conversation. The screens call it the build; the phase is implementation.

Claude orchestrates and delegates. A task writer writes each phase's tasks as the phase starts, a builder builds each task, the reviewers Claude chooses review it, and other agents consolidate a phase's notes and review the phase whole, each from a brief the engine issues and never from the conversation. Claude schedules the work, lands what the agents find, and fixes the nits a review leaves. Nothing here decides the product afresh: the specification is concluded, and a call the build meets goes to the ledger or to you.

A quick-fix runs on the same machinery in a smaller shape, described at the end.

## Auto and step

The build runs in the position you picked at [ready to build](specification.md#ready-to-build):

- **Auto** runs on its own. Only the gates that are always yours, danger and the questions that need you reach you; tasks that share no files run side by side; and each phase's stack merges with no gate.
- **Step** also stops after each task, with its account, for you to review and try it, and before each phase's stack merges. Tasks run one at a time.

Switch at any time by saying so, or with `a/auto` at step's stop after a task.

## Phases

The phases run in the cut's order, each through three stretches: its start, its tasks, and its close. They overlap where they can. A phase that relies on nothing unfinished can start whenever Claude schedules it, usually as the one before goes into its phase review; a phase that relies on another waits until that one's stack has merged.

The build's first entry runs the project's steps that prepare its environment, from the [environment setup](verification.md), which can take minutes.

An epic or a feature whose build starts with two or more phases gets a **branch of its own**, `feat/{unit}`: each phase's stack starts from it and merges into it, and it lands on the default branch once, at finish. Every other piece of work lands on the default branch directly. Each phase start brings the default branch into the work's own branch, and the review phase does again before its first round; where the two conflict, the conflicts are settled with you in the conversation before the work goes on.

### The phase start

A phase's tasks are written as it starts, against the code the phases before it left, never all at once at the specification. The task writer writes them from the phase's part of the spec, and they are recorded in the tracker, linked by what waits on what, before anything in the phase runs. A design several of the phase's tasks touch is settled as they are written, put into each task it touches and on the ledger, so no two builders settle it apart. A gap the writer meets is decided as any call is, and the tasks it held back are written once it is answered.

Each task the task writer writes holds the same fields: a one-line title; its type (`feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci` or `chore`); the problem, the solution and the outcome in the product's terms; its acceptance scenarios; and the sections of the spec it draws on. A one-line task, something small Claude makes mid-build, holds its title and type alone. A task names no mechanism the record did not decide. Once written, a task is never rewritten: what it needs later is added to it.

## The task loop

Each task goes from ready to done the same way.

1. **Start.** The tracker answers which tasks can start. Tasks that share no files run side by side, each built in a git worktree of its own; work on a shared file runs one task at a time, and so does anything the project cannot run twice at once, such as a port or a database. Tasks started together share a short headline of what each is about to change and what to watch for when it lands.
2. **Build.** A builder builds the task with the tests that prove it, from the task's acceptance scenarios, committing through the engine, whose door runs the project's tests and linters first. Where the project records a verify setup, it then runs each scenario through it, driving the running product; what the runs prove is the engine's to say, never the builder's. A way it took that the record left open is reported as its call, with why. A question you would want to answer, what the product does, or a decision the work shows wrong, it never settles: it stops and reports it.
3. **Review.** Claude chooses who reviews each task and records the choice on it with why: usually one independent reviewer, two where the stakes call for it. Its reviewers, fresh to the code and never the builder, read the whole task. A round that fails goes back to the same builder with their reports, and once it is fixed the same reviewers read the whole task again. No count of rounds stops it: the loop runs until a round passes, with nothing serious and no bug. A round that passes leaves its nits, which Claude fixes there and then.
4. **Account.** The builder writes the task's account: what was done in the product's terms, where in the code, what the tests prove, how the work differs from the task as written, and each review round with what was done about it.
5. **Land.** In step, the task stops for you with its account: yes lands it, `a/auto` switches the build to auto and lands it, `t/technical` retells the account from the code's side, `s/show` draws what it built as diagrams, and a comment goes onto the task as yours, for the builder to build and its reviewers to read again. In auto it lands with no stop. Landing puts the task into its phase's stack.

A task that looks stuck, a finding coming back after it was fixed, or the builder and its reviewers going round on one point, is Claude's to judge and settle in either position: by giving the builder what it needs, or by settling the round with why, written into the task's account. Only an answer that needs you stops it.

A bugfix's first task is the test that reproduces the bug. It lands only once that test has failed on the unfixed code, five times in a row; a run that passes sends it back to its builder.

## Questions while the build runs

The build never goes back to a menu to ask you something. A builder's calls go on the ledger for their task and through the [ask rule](trust.md). A question that needs you **parks** only the tasks that depend on it, while everything else carries on, and each parked task picks up from where it stood once you have answered. A question bearing on no single task, met at a phase's start for instance, parks each written task it bears on.

Claude asks each question as it comes up, with what it is about, in full and product first, from the work as it stands now; you answer then, or whenever you come back to it. One question is asked at a time: once you answer, Claude asks the next, the one you queued on the board or else the oldest still waiting that you haven't set aside in this conversation. You can set one aside to come back to, or turn to any of them yourself. Where the mod runs, the board beside the conversation lists them as they arrive, and you can queue the ones you want to discuss. When nothing left can go on without an answer, the build stops with a report of what waits on you.

At any time you can ask where the build stands, for its phases and tasks, or for any task's account, however long ago it landed.

## Notes for later

What a builder or a reviewer noticed that belongs to no task in hand, an improvement or an edge beyond the task's boundary, is put down as a note for later as it arrives. A wrong result in what a task does is never a note: it is a finding, or a fix. At the phase's end an agent reads the notes against the finished code, groups them, drops the ones the code already settled with a reason, and makes the rest tasks of the same phase, which go through the loop like any other. A note that needs your call goes through the ask rule.

## The phase close

A phase closes once every task of it is done or closed:

1. **Its notes are consolidated**, as above.
2. **Its mutation run is made**, where the verify setup names a mutation tool: the tests are run against deliberately broken copies of the phase's code, to show they catch what they claim to.
3. **The phase review** is one more independent review, a reviewer pair over the phase's whole change: its tasks' acceptance, its coherence, and where it meets what earlier phases built. Where it fails, Claude judges what the phase owes, and each fix becomes a task of the phase, passed by its own reviewers; no phase review runs over them again. A finding for a later phase, or a note, lands where it belongs.
4. **Its stack merges**: in step at the phase merge gate, where a comment becomes one more task first; in auto with no gate.
5. **Its close is checked.** The first phase's close waits until the [verify setup](verification.md) is recorded: having the product running and drivable is the first phase's to build.

The build's log records what each phase left for the next.

## Something nobody planned for

A bug you report mid-build, something you ask for, a gap or a find an agent reports beyond its task, anything the tasks never held: Claude judges where it goes and its weight, and lands it through one door. No code changes without a task, and a find never corrects the specification.

- Something small you ask for is woven into an open task, or Claude makes it itself; with no task open, as a one-line task of its own, with no builder and no reviewer.
- Something too big for this work Claude says so of, and you start it as its own work or park it.
- Work for this phase, or a later one already written, becomes a **task**, linked after anything it waits on; work for a phase not yet written is held for that phase's task writer.
- Something beside the change becomes a **note for later**.
- A call or a question goes on the **ledger**, through the ask rule.
- A decision in the work's own record that must change is **replaced** where it is found, and whatever was built on the old answer is reworked by tasks.
- Something another piece of work's topic must decide, while that topic is still in discussion, goes there as a **message**.
- Anything else goes to the **inbox** or the **roadmap**.

## The drivers

Ledger reaches the tools around your code through two drivers, chosen per project. The task driver keeps the build's tasks in your tracker; the landing driver lands each task's change in your repository. Both are checked at ready to build, and a driver changes from manage only while no build is in flight, since a build never changes driver under it. [Configuration](configuration.md) covers choosing them.

### The tracker

The default task driver keeps the tasks in [Tick](https://github.com/leeovery/tick). Each piece of work is one entry in it, with a child for each phase as it is written and the phase's tasks beneath that; the links between tasks are what the build reads to know what waits on what. Its store lives with Ledger's records on the state branch, so the tasks travel with them. Everything in the tracker is written through the engine as the build goes; you can read it with the tracker's own commands whenever you want to see the build that way.

### Landing

- **On GitHub**, each task is a pull request and each phase a stack of them, each based on the one before, merged whole once the phase review passes. Every task's pull request is squashed, so the branch the work lands on gains one commit per task, under the task's own subject and id. It needs GitHub's CLI and its stack extension, at the versions ready to build names; the project's first ready to build offers to make squash merges the repository's default, which landing needs, and its yes also allows merge commits.
- **Locally**, for a project with no remote or one on another host, the same shape lands with no pull request and no push: each phase's stack is a branch, each task squashed onto it as one commit in the order the tasks merged back, and merging the phase moves the branch the work lands on to it.

The branch the work lands on is the default branch, or the work's own branch where it has one. That branch lands on the default branch at finish by one merge commit: on GitHub its own pull request, which finish refuses to merge on a repository that allows no merge commits, and locally a merge commit made in place.

Where the project's folder holds other git repositories, clones nested inside it, a task's commit lands in each one it touches, and every read of the change spans them all.

## Closing

The build closes as its last phase does: once every phase of the cut has closed, it runs straight on into the [review phase](review.md), in the same conversation, with no stop between them.

Cancelling the work mid-build stops it where it stands, once you confirm. It closes every pull request open on the work's branches and keeps every branch under its own name, so nothing is lost; [lifecycle operations](lifecycle-operations.md) covers bringing it back.

## The build's log

The build keeps a log, `build/log.md`, appended as the work goes: what is in flight, what was tried and dropped, and at each phase's close what it left for the next. An inbox item the work resolved is claimed there, so finish can archive it. It is read after a compaction and whenever the build resumes, so it is written for a reader who has only it and the ledger. Each task's account, its review rounds and its figures live beside it, under `build/tasks/`.

## A quick-fix

A quick-fix is built by the same task loop, without a specification or a cut. The change was settled with you when the work was started, so Claude splits it into fixes, each a change that stands on its own and lands as its own commit, one for each item where the quick-fix started from several. Each fix is a task, with acceptance scenarios in your own words, built by a builder and passed by the reviewers Claude chooses for it.

The differences come from size:

- **A worktree of its own, one branch.** The fixes are built one at a time on the quick-fix's one branch, in a git worktree of its own, `.claude/worktrees/ledger-{unit}`, laid out as the first fix starts and taken apart at the close, a cancel or a move. Your checkout never moves while the fixes are built, whatever branch you have out and whatever it holds; Claude runs a fix from the worktree to show it to you. Another session's build or review never waits on a quick-fix, nor a quick-fix on them.
- **One pull request.** Every commit goes to the quick-fix's one pull request as it is made, or under the local driver its one branch. There is no stack, no stop after a fix, and no position to choose.
- **A question parks its fix.** A question a builder asks parks its fix and sets aside the work it had not committed, leaving the worktree clean for the next fix. Once you answer, the work is put back and the fix carries on.
- **A short record for each fix**: what changed, why, and what it leaves out, in the product's terms. It is what the [knowledge base](knowledge-base.md) keeps of a quick-fix.
- **The close is its one gate.** Once every fix is done, the notes for later its builders and reviewers left are each filed to the inbox or dropped, and the close asks a verdict on each call you changed. Its yes lands the pull request whole, or under the local driver the branch's commits, and completes the work, and the conversation carries on where it is, with no menu drawn. Your checkout is touched only where it has the branch the work lands on out, and then only as a build's finish touches it: brought up to the landing. Where its own changes stand in the way, a landing through GitHub stands all the same, and a line says your branch is behind, what stopped it, and how to bring it up; under the local driver, whose landing is that branch's move, the close says which changes are in the way and lands once they are not. Where the quick-fix's branch conflicts with what reached the branch it lands on meanwhile, nothing lands: Claude merges that branch into the worktree as a one-line fix of its own, settles the conflict, commits the merge through the door, and closes again. It also offers a review: ask for one, and the [review phase](review.md) holds the whole change against the fixes' acceptance, then hands back to the close.

A quick-fix that turns out to need a decision beyond a quick call moves to a feature, or to a bugfix where a cause is still to find, on your word, before any of its fixes has landed. The work it had not committed is set aside and kept for you, its pull request closed and its branch kept, and the new piece of work's first conversation names what was kept. A cancel carries on in the conversation, as the close does.
