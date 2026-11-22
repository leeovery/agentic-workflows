# State and git

Ledger keeps everything it records — the ledger, each work unit's manifest, the logs, the specs, the build's accounts, the tracker's tasks — in git, so the history of every decision is as real and recoverable as the history of your code. But it keeps it apart from your code. This page is where that state lives, how it reaches your remote, how it survives a lost branch, and how two machines share it.

## The state branch

Ledger's state lives on a branch of its own in your repository, `ledger-state`: an orphan branch, sharing no history with your code, checked out as a git worktree at `.ledger/` inside the project's main checkout. Every code branch ignores `.ledger/` — boot keeps the line in the repository's own exclude file, which is never committed, so even a branch cut before Ledger was set up ignores it — and so code branches and pull requests never carry state, and nothing ever merges it.

The worktrees Ledger lays out for its own work — a quick-fix's, a one-line task's, a reviewer's scratch — sit in `.claude/worktrees/` of the main checkout, each named `ledger-…`, and the same exclude file keeps them out of your checkout: `git status` never names one, and `git add -A` never takes one.

There is one copy of the state. Every session writes that one copy, whichever worktree it runs in: a builder working in a worktree of its own finds the same `.ledger/` through the repository's shared git directory, and no code worktree ever holds a `.ledger/` of its own. What is local to one machine stays off the branch: the knowledge base's store, the session caches, the recordings a verification run keeps by hash.

A project inside a larger repository works the same way, its state in the repository's main checkout. Code can also live in repositories nested inside the project's folder, clones of their own: Ledger finds them every time, with nothing to configure, and a code commit lands in each one it touches. The state stays in the project's own repository.

## Every action commits

Every change to the state goes through the engine, and every engine action commits what it wrote, together with any conversation log written since, on `ledger-state`. A state commit is built from a private index, so nothing staged in your checkout is ever swept into it, and it holds each path against the layout Ledger owns: a file the layout has no place for refuses the commit, naming it. Writes take turns under one lock, so the ledger stays one line of appends on one straight branch.

After every commit the engine pushes the state branch, wherever the project has a remote. A push that fails is a warning, never a stop: the commit stands, and the next boot pushes what was left behind.

Your code is committed through the same engine, by a different door: a code commit names its task, runs the project's tests and linters first, and lands on the task's branch, never on `ledger-state`. [The build](the-build.md) has how code lands as pull requests.

Boot also makes two small commits of its own on your code, on whatever branch your session has checked out, a feature branch included. One installs Ledger's hooks in the project's `.claude/settings.json` ("chore: install Ledger session hooks"), the other adds the line naming `.ledger/` to the project's `.gitignore` ("chore: ignore .ledger/ …"). Each is made only where the branch lacks it, so a branch cut before Ledger was set up gains them the first time a session boots there. Together they are Ledger's trace in your code, which tells a project that has lost its state from one being set up for the first time.

## What protects it

The state worktree is locked when it is created, with the reason "Ledger state, do not remove". A hook Ledger installs in the project's Claude Code settings, before every shell command, refuses each of the ways a session could lose it: unlocking or removing the worktree, deleting the folder, deleting the branch locally or on the remote, force-pushing it, committing in the state worktree by hand, and writing by shell to a file only the engine writes, such as a manifest or the ledger. Reading any of them passes. A second hook, before every file write, refuses an edit to those files, and any write under `.ledger/` outside the layout. Both hold whether or not Ledger's Claude Code mod runs.

The ledger itself is checked on every read: on disk it must begin, byte for byte, with what the state branch last committed. Anything changed, removed or reordered stops the engine, showing the line it found.

On GitHub, setup offers a rule on the repository refusing the state branch's deletion and any push to it that isn't a fast-forward, for anything run outside Claude Code, and sets it only on your yes. Without a remote, the lock and the hooks are the protection.

Every git call the engine makes in the state worktree runs with hooks off and git's inherited environment cleared, so a hook in your code repository never fires on a state commit.

## Boot keeps it whole

Boot runs at the start of every Ledger conversation, and checks the state worktree and branch each time:

- **A fresh clone.** The remote has `ledger-state` and this clone has no worktree: boot adds it, locked. Nothing is asked.
- **A lost worktree or lock.** Boot re-adds the worktree, or locks it again.
- **A lost local branch.** Boot restores it from the remote.
- **A branch missing from the remote.** Boot pushes it back.
- **Gone everywhere.** The branch is in neither this clone nor the remote, in a repository that shows Ledger was set up — its hooks in `.claude/settings.json`, or its `.gitignore` line. Boot stops and says so, with two ways on. If another clone still has the branch, run Ledger there: its boot pushes it back, and this clone restores it next time. Otherwise, on your yes, boot starts a fresh state branch, and the project is met as one whose code predates Ledger: you are offered a read of the code to rebuild what it can. The earlier decisions, logs and ledger are gone; your code and its history are not.

A new project is told apart from a lost one by that same trace: boot commits its hooks and the `.gitignore` line only after the state branch exists, so a setup cut short never reads as lost state. Ledger runs only inside a git repository; in a folder in none, boot stops before writing anything, and never offers to make one.

## A second machine

Work on one machine at a time and the state branch never diverges: every commit is pushed, and the next machine's boot fast-forwards to it. It diverges only where a push failed, and then boot merges it before anything writes the state, without asking you to run anything.

The merge is the engine's, never git's, so nothing is installed per clone. It takes one new commit on top of the remote's tip, so nothing pushed is ever rewritten. The ledger is unioned by id, this machine's entries after the remote's, keeping it append-only. Manifests merge field by field against their common ancestor: a field one side changed takes that side's value, and a field both set alike takes it. The tracker's store merges by its own records the same way. A few fields never stop it: the project's id, where the remote's stands, among them. Where both machines changed any other field to different values — say, which horizon a roadmap item sits on — the merge stops and shows the field with each machine's value as a row, and your pick finishes it.

Your record of answers for the [ask rule](trust.md) is per machine, kept at user level rather than on the branch, so each machine counts and judges its own calls.

## What is kept, and where

The state branch holds what the work is built from and what it leaves behind:

- the project manifest: the work units, the roadmap, the drivers, the environment setup;
- the ledger, `.ledger.jsonl`, one entry a line;
- each work unit's manifest, its topics' briefs and logs, its experiments, mail, spikes and the files you shared;
- each work unit's one spec;
- the build's log and notes for later, each task's account with its review rounds' reports, each phase review's reports and the verification runs;
- the review phase's rounds and its report;
- a quick-fix's short record after the work;
- the inbox, and the product's conversation: its logs, the roadmap items' notes, its files;
- the tracker's own store, kept by its driver.

Off the branch, ignored: `.ledger/.cache/`, each session's scratch and presence, and `.ledger/.knowledge/`, the knowledge base's store, rebuilt from the records, and its config, kept per copy of the project. At user level, in `~/.config/ledger/`: your system config, credentials, the trust log, the record of you, and each conversation's own folder.

## Moving a project across

A project from before Ledger, kept in a `.workflows/` folder on its code branch, is moved onto the state branch by the migration the first time Ledger runs there. It runs as one sequence, and where a step needs judgment the session carries it out while you wait it out, answering only what it asks: splitting each old document into its decisions and its conversation, writing each topic's record, and cutting the plan of a piece of work whose building had started into phases. A decision whose old documents do not show who made it is carried over, never yours. The migration never reads the code for its records: a record says what its documents decided, and the code is the truth of what is built. Where later work finds the code doing something else than any decision the migration brought across, it records that as a finding on the decision, and asks you which stands only when the work in hand turns on it, always before a build would undo what the code does. Code that does not yet do what was decided, in a part the build has not reached, is work still to do, not drift; code that no longer does it, in a part built and changed since, counts as built otherwise. At the end you review what it did, and your yes makes the migration's commit: the state branch's first commit, then one on your code branch that takes `.workflows/` out. Files the migration found no place for are kept as they were, under a work unit's `assets/legacy/` or the product's, and a row of the start menu, right after the work in flight, sorts them with you: what holds knowledge joins the record, the rest is kept or discarded as you choose. Nothing is committed on your code branch before your yes, and the commit your yes makes there is not pushed: pushing it is yours. Your settings and credentials from before, in `~/.config/workflows/`, are copied into `~/.config/ledger/`, and the old folder is left as it was, so a project not yet migrated keeps reading it. Ledger's own settings and credentials are never overwritten: a later project's migration copies only what Ledger's folder still lacks.
