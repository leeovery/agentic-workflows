# State and git

Ledger keeps everything it records — the ledger, each unit's manifest, the logs, the specs, the build's accounts, the tracker's tasks — in git, so the history of every decision is as real and recoverable as the history of your code. But it keeps it apart from your code. This page is where that state lives, how it reaches your remote, how it survives a lost branch, and how two machines share it.

## The state branch

Ledger's state lives on a branch of its own in your repository, `ledger-state`: an orphan branch, sharing no history with your code, checked out as a git worktree at `.ledger/` inside the project's main checkout. Every code branch ignores `.ledger/` — boot keeps the line in the repository's own exclude file, which is never committed, so even a branch cut before Ledger was set up ignores it — and so code branches and pull requests never carry state, and nothing ever merges it.

There is one copy of the state. Every session writes that one copy, whichever worktree it runs in: a builder working in a worktree of its own finds the same `.ledger/` through the repository's shared git directory, and no code worktree ever holds a `.ledger/` of its own. What is local to one machine stays off the branch: the knowledge base's store, the session caches, the recordings a verification run keeps by hash.

A project inside a larger repository works the same way, its state in the repository's main checkout. Code can also live in repositories nested inside the project's folder, clones of their own: Ledger finds them every time, with nothing to configure, and a code commit lands in each one it touches. The state stays in the project's own repository.

## Every action commits

Every change to the state goes through the engine, and every engine action commits what it wrote, together with any log written since, on `ledger-state` alone. A state commit is built from a private index, so nothing staged in your checkout is ever swept into it, and it holds each path against the layout Ledger owns: a file the layout has no place for refuses the commit, naming it. Writes take turns under one lock, so the ledger stays one line of appends on one straight branch.

After every commit the engine pushes the state branch, wherever the project has a remote. A push that fails is a warning, never a stop: the commit stands, and the next boot pushes what was left behind.

Your code is committed through the same engine, by a different door: a code commit names its task, runs the project's tests and linters first, and lands on the task's branch, never on `ledger-state`. [The build](the-build.md) has how code lands as pull requests.

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
- **Gone everywhere.** The branch is in neither this clone nor the remote, in a repository that shows Ledger was set up — its hooks in `.claude/settings.json`, or its `.gitignore` line. Boot stops and says so, with two ways on. If another clone still has the branch, run Ledger there: its boot pushes it back, and this clone restores it next time. Otherwise, on your yes, boot starts a fresh state branch and the product's conversation opens with a read of the code, as for a project that predates Ledger. The earlier decisions, logs and ledger are gone; your code and its history are not.

A new project is told apart from a lost one by that same trace: boot writes its hooks and the `.gitignore` line only after the state branch exists, so a setup cut short never reads as lost state. Ledger runs only inside a git repository; in a folder in none, boot stops before writing anything, and never offers to make one.

## A second machine

Work on one machine at a time and the state branch never diverges: every commit is pushed, and the next machine's boot fast-forwards to it. It diverges only where a push failed, and then boot merges it before anything writes the state, without asking you to run anything.

The merge is the engine's, never git's, so nothing is installed per clone. It takes one new commit on top of the remote's tip, so nothing pushed is ever rewritten. The ledger is unioned by id, this machine's entries after the remote's, keeping it append-only. Manifests merge field by field against their common ancestor: a field one side changed takes that side's value, and a field both set alike takes it. The tracker's store merges by its own records the same way. Where both machines changed one field to different values, the merge stops and shows both, and your pick finishes it:

```text
⚑ The state merge stopped: one field changed on both machines
> In Fumi's project manifest, the roadmap item "A lifetime tier"
> was moved on each machine since they last agreed:
>   this machine:  next
>   the remote:    someday

◆ Which horizon does "A lifetime tier" keep?

1 → next — this machine's
2 → someday — the remote's
```

Your record of answers for the [ask rule](trust.md) is per machine, kept at user level rather than on the branch, so each machine counts and judges its own calls.

## What is kept, and where

The state branch holds what the work is built from and what it leaves behind:

- the project manifest: the units, the roadmap, the drivers, the environment setup;
- the ledger, `.ledger.jsonl`, one entry a line;
- each unit's manifest, its topics' briefs and logs, its experiments, mail, spikes and the files you shared;
- the unit's one spec;
- the build's log and notes for later, each task's account with its review rounds' reports, each phase review's reports and the verification runs;
- the review phase's rounds and its report;
- a quick-fix's short record after the work;
- the inbox, and the product's conversation: its logs, the roadmap items' notes, its files;
- the tracker's own store, kept by its driver.

Off the branch, ignored: `.ledger/.cache/`, each session's scratch and presence, and `.ledger/.knowledge/`, the knowledge base's store and its config, rebuilt from the records. At user level, in `~/.config/ledger/`: your system config, credentials, the trust log, the record of you, and each conversation's own folder.

## Moving a project across

A project from before Ledger, kept in a `.workflows/` folder on its code branch, is moved onto the state branch by the migration the first time Ledger runs there. It runs as one sequence and stops where it needs judgment, for the session to carry it out: splitting each old document into its decisions and its conversation, writing each topic's record, and cutting a building unit's plan into phases. At the end you review what it did, and your yes makes the migration's commit: the state branch's first commit, then one on your code branch that takes `.workflows/` out. Files the migration found no place for are kept as they were, under a unit's `assets/legacy/` or the product's, and the start menu's last row sorts them with you: what holds knowledge joins the record, the rest is kept or discarded as you choose. Nothing is pushed or committed on your code branch before your yes.
