# The engine

Underneath the conversation sits a deterministic core Ledger calls the engine. You never operate it and rarely see it named, but almost every guarantee in [how it stays reliable](reliability.md) traces back to it, so it is worth knowing what it is and why it was built.

Ledger splits control three ways. The engine owns what you see and what gets recorded: the stages and gates, the menus and screens, where every artifact lands, its shape, and every event on the ledger. Claude owns how the work gets done: how it reasons, which agents it sends, the order it builds in. You own the product, and the calls the [ask rule](trust.md#the-ask-rule) sends you. Anything fully determined by data is computed once, in code, and handed to Claude to act on, never re-derived in prose. Judgment decides; code records.

## Why it exists

Ask a language model to hold a project's state in its head, work out what phase things are in by reading around, or draw a status screen from written instructions, and the result is usually right, which is another way of saying occasionally wrong, unpredictably, and worse each time the reasoning is rebuilt from scratch. The engine ends that.

**It saves the conversation for your problem.** Before the engine, every session paid to rebuild the same facts: reading directories to infer progress, redrawing the same screens turn after turn. Handing the whole orchestration to plain code was considered and rejected, since it would reduce the model to a hired hand. So the design inverted instead: Claude stays the driver, and the engine is the reliable thing it consults. One call returns a finished snapshot, and Claude reads it rather than rebuilding it.

**It makes what you see trustworthy.** The same state always draws the same screen, down to the byte. The engine's output comes in labelled sections: what is for Claude to reason from is never shown to you, and what is for you — a screen, a menu — is passed through untouched, never reinterpreted. Where a gate depends on state — whether every topic is decided, how much of a review remains — the answer is computed from the record at the moment of asking, never recalled.

**It keeps months of work safe.** Every change to the state is a transaction: checked completely before anything is written, applied whole or not at all, under one lock, so a crash in the middle never leaves a half-written record. A refusal names what blocked the change and the way to what you wanted, rather than failing quietly or bending the state to fit.

## The verbs are the only doors

Everything Claude records goes through one of the engine's verbs, and each verb is the only door for what it covers: it picks the path, writes the shape, records the event, commits, and refuses what is wrong. A decision goes on the ledger through `ledger`; a call that may reach you goes through `raise`, which asks the decision point; your answer at any gate goes through `gate`, which logs it and returns what happens next, so the flow at a gate follows the engine rather than Claude's reading of your answer. The prose that guides Claude names verbs, never the fields they write.

Behind the verbs, what Claude could do around them is closed off:

- **The layout hook.** A Claude Code hook before every file write refuses any path under `.ledger/` the layout has no place for, and any file only the engine writes: the manifests, the ledger, a verification run.
- **The shell hook.** Before every shell command, a hook refuses what would lose the state or go round a door: removing or unlocking the state worktree, deleting or force-pushing the state branch, writing an engine-only file by shell, and committing in the state worktree by hand. While a task of work still in progress is in flight, it also refuses a raw `git commit` anywhere, and any other git command that would land a commit on a task's branch past the commit door; and from any conversation, a raw `git commit` in a quick-fix's worktree while the quick-fix is in progress. [State and git](state-and-git.md#what-protects-it) has the state's side.
- **The commit door.** Every commit is the engine's. A state commit holds each path against the layout, and refuses a file the hooks missed. A code commit names its task, runs the project's tests and linters first, and is refused without a task, or, in a bugfix, before the bug is proven.
- **The checklists.** A required procedure — a topic's close, ready to build, a build phase's start and close, finish — is a checklist the engine holds. Claude works its items in any order, each ending done or skipped with a recorded reason, and the closing verb refuses while any is open. A skipped item shows, with its reason, on the next screen you sign off.
- **The briefs.** Every brief Ledger gives its own agents comes from a template the engine fills from the records, and a hook before every dispatch refuses a Ledger agent sent anything but the pointer to a brief issued in this conversation. A refusal is recorded, so a template that keeps getting in the way is improved rather than worked around.

All of these hooks are installed in the project's Claude Code settings by boot, so they hold whether or not Ledger's Claude Code mod runs. What a door cannot refuse — a question asked in plain prose in the build, an extra review round — stays in the skills' prose, and is watched in use.

## Boot

Boot runs first on every entry into Ledger, your command and Claude's alike. It checks the git it runs on, puts the state worktree in place and catches it up from the remote, runs any migration an update brought, brings the knowledge base in line with the records, installs the hooks, and tidies what ended sessions left. Then it stamps the conversation as booted for this project and version, and every verb that touches work refuses until that stamp exists. It stops only where it needs you.

## Every surface is the engine's

The screens you see — the menus, the gates, a raised question, the matrix, the board's views — are drawn by the engine and relayed exactly as drawn, never written afresh by Claude from a template it was trying to follow. Each menu has its help beside it. Where Ledger's Claude Code mod runs, it draws the same menus as buttons; without it, the engine's text is the menu.

## What it changed

The engine did not change what Ledger is for: the record still drives the work, and the conversation is still the driver. What it changed is who keeps the books. Everything that could be answered by data moved out of the model's prose and into code the model consults; everything that needs judgment stayed with the conversation and with you. [History](history.md) tells how that happened.
