# Trust

A piece of work throws up hundreds of small calls: a name, an error message, what happens when a field is left empty, whether a list is paged. Asking you every one of them buries you; deciding all of them without you builds the product a model's habits would build, not the one you want. Ledger aims between the two. The goal is Claude making the calls you would have made had you been asked, so the product comes out your way. Being asked less follows from that and is never the aim: Ledger never trades a question you should see for a quieter session.

This page is how that works: the ledger every call lands on, the arithmetic that decides whether a call reaches you, the verdicts it learns from, and the matrix where you can see and correct it all. It is the other half of [verification](verification.md): verification is how you come to trust Claude's work, this is how you come to trust Claude's calls.

## How much of you a phase needs

The amount of you the work needs is a cone: widest on a blank page, narrowing as the product takes shape. Early on nearly every turn is yours: [discovery](discovery.md) and [discussion](discussion.md) are conversations, because a wrong turn caught there costs a sentence to put right, and the same wrong turn caught in [review](review.md) costs a rebuild. Each decided topic constrains the next, so the first topics of an epic are the widest, and a new epic's first topic starts narrower once the product's character is known. By the [specification](specification.md) the decisions are on record and your part is approving them; [the build](the-build.md) and the review phase run largely on their own.

Nothing computes where in the cone the work is. The cone comes from the work itself: a decided topic leaves fewer open questions for the next, and the ask rule below learns your taste as you answer, so less needs asking.

## The ledger

Every question, finding and decision in the project, by either side, is an entry on the ledger: one thing per entry, shown by a short id the way git shows a short hash. A decision names the question it answers, why, what it rules out and what it relies on. Beside each it keeps who made it and what the other side would have said: Claude's sealed answer beside yours, or Claude's alternatives and evidence beside its own call.

The ledger only grows. Nothing on it is edited; a change of mind is a new entry replacing the old one, giving one of four reasons — a new fact, another topic's decision, a changed mind, or it was wrong — and everything that relied on the old answer is flagged until it is confirmed or replaced itself. Everything you read about the work's decisions is drawn from it: a topic's record, its map, the product record. So is the answer to "what have you decided without me?", which is one question to the engine rather than something for Claude to piece together.

Whether an entry holds one decision or several is judged as it is written, by a separate Claude call rather than the one writing it, and an entry holding several is split before it lands. The ledger's lines are checked on every read against what the state branch last committed, so a line changed outside the engine stops the work rather than passing unnoticed; [state and git](state-and-git.md) has where it lives.

## Facts are checked, intent is asked

A question that reading the code, reading the record or running something can answer never reaches you: Claude checks it. Where there is more than one way and evidence can tell them apart, Claude finds out before it leans — a spike, research, the source of a library, how open-source products do it — and records the evidence beside the call.

Only questions of intent and taste are yours, and only those go through the ask rule. A fact only you hold — a deadline, an outside constraint, an account Claude cannot reach — is asked plainly, with no lean, and counts for nothing in what Ledger learns about you.

## The ask rule

Whether Claude asks you is arithmetic the engine does over your own answers, never Claude's judgement and never its stated confidence. Claude supplies the question and its own answer, sealed before you answer so it cannot change; the engine decides whether to ask; your answer becomes evidence.

Every question has a **kind** — process, danger, contract, scope, look, words, behaviour or internals — composed in code from a separate Claude call's answers to twelve narrow yes-or-no questions about what was asked. For each kind the engine keeps a rate of real loss — how often Claude's answer, had it been built, would have cost the product something — and takes the pessimistic end of it: the upper end of a one-sided 95% range. Few answers leave that range wide, so a kind keeps asking until your answers narrow it.

- **The threshold.** A kind asks while its pessimistic rate is above your threshold, 20% unless you pick another. With no losses, 13 answers bring it under 20%. One loss among 20 answers puts it at 21%.
- **Going quiet, and asking again.** Under the threshold a kind goes quiet: its calls land on the ledger as Claude's. It asks again only once its rate rises a quarter above the threshold, 25% at the default, so one bad call makes a kind ask again while its evidence is thin and leaves it quiet once its record is long.
- **Hard to undo.** A question whose answer a later change would have to reach beyond the piece to undo halves the threshold, so it needs about 28 clean answers before it goes quiet.
- **Calls with one sensible answer.** Where Claude judges there is only one defensible answer, the call goes ahead as Claude's, on a count of its own, and asks you only once you have overruled such calls often enough to lift that count's rate past the threshold.
- **Mid-build.** A question that blocks build work takes the same threshold until the build's own answers show by how much to raise it; raising it is your pick, from a replay.

A new project starts from your answers across your other projects, capped at ten answers' worth a kind, so it begins from your general taste and moves as its own answers come in. Evidence ages: an answer counts half once it is six months old, so a change of taste shows. A new model starts from its predecessor's answers at half weight and earns the rest.

Everyone starts with an empty record of answers, the person who designed Ledger included, so in the first weeks every question of taste or intent asks. What ships is the method, never anyone's counts.

## What always asks

Some calls reach you whatever the counts say:

- **Danger**: an option that could destroy, overwrite or expose your data or secrets, or weaken permissions or security. No count loosens it, and it is the fixed point the rest of the arithmetic cannot drift past.
- **A care entry**: a kind you have said always asks in one project, written like "Aircon: look". What you care about depends on what the project is for, so an entry never covers every project. Your answers under it still count, so dropping it later leaves the counts knowing how Claude does on that kind.
- **Replacing your own decision**: a call that would change an answer you gave comes back to you.
- **The authority gates**: start this work, approve the map, decided, ready to build and finish. They are not calls at all, and stop in both of the build's positions.

## How a question reaches you

A question arrives cold and product first: what is being decided, Claude's lean, what you would notice either way, and, where a rule always brings it to you, that reason. The mechanism sits behind `t/technical`, beside how Claude's calls of its kind have gone where those sent it to you. `e/explain` says you don't follow: it counts as no answer, Claude explains again, and the question stays open.

Questions come one at a time. In a discussion each is slotted into the conversation at a natural pause; where several wait at once they come back to back, each answered before the next shows. In the build a question parks only the tasks that depend on it, and the rest carry on.

**Blind questions** keep the quiet kinds honest. Now and then the engine holds back a call Claude would have made alone and puts it to you cold, Claude's answer sealed; once you have answered, it shows what Claude would have picked. The engine draws them, one call in ten and one in five while a kind has little history, and Claude never chooses which. In the build, a call cheap to undo goes ahead while its blind question waits, and your different answer replaces it.

**Convergence** is the other end. After eight agreements in a row in a topic, or when you say so, Claude offers to settle the rest: how many points are open, how many it would settle, and which still come to you by the rule, by kind — "12 open: I'd settle 9; 3 come to you". On yes it settles its points on the ledger and asks the rest one at a time; the rule stays in force throughout.

## Verdicts

A departure is an answer of yours that changes Claude's lean. Each one gets a **verdict**: what the product would have lost had Claude built its own answer — nothing, a fix later, or a real loss. Verdicts are what the ask rule learns from, and they are asked where you already sign off, so none is left to a page you would have to remember to open: a topic's decided screen, ready to build, finish, and a quick-fix's close. Where you changed nothing, nothing is added.

A verdict you can't call yet can be skipped. It waits in the **verdict queue**, reached from the Verdicts row on the start menu or an epic's menu while any wait, one at a time, oldest first. Until judged, a departure counts as a real loss, so a backlog only makes Claude ask more. A blind answer that differs from Claude's is a departure too, and so is a later reversal: an "I agree" given in fatigue and overturned later counts as an overturn.

## Routine gates are learned

Beyond the questions, some of Ledger's own stops are routine: what to do with a file you shared that could not be found, whether to wait for a topic's review agents at its close, an investigation's plan, whether to run an experiment now or later. Each asks until your answers show you pick the same row nearly every time; then it runs on its own with a one-line report in its place, such as "Analysis plan approved [auto]. Checking the hypotheses in this order." It asks again once your answers start to vary, and a blind ask still shows it now and then. No gate ships automatic, the authority gates never learn, and in the build's step position every one of them stops.

## The matrix

The matrix is where you see and correct all of this, reached from manage's `m/matrix` and whenever you ask for it. For each kind it shows how often you changed Claude's lean, the real-loss rate the rule runs on, and whether the kind is asking or has gone quiet, with Claude's one-answer calls on a row of their own; below, the threshold mid-build and how the reviews' findings split between what you were asked, what Claude settled and what went elsewhere.

You correct it through your own settings:

- **The threshold**: name a number, and a replay of your history shows first what it would have changed — "last month this would have skipped 40 questions; you'd have overruled 2 of them".
- **The threshold mid-build**, picked the same way.
- **Care entries**: add a kind that always asks in this project, or drop one.

A question's kind or a verdict you find wrong is corrected in your own words; the engine records the correction and the counts follow. Trust stays your decision throughout.

## The record of you

Alongside the counts, Ledger keeps your preferences in words, each with its reason and examples, across all your projects — never a decision tree, which breaks on the first case it did not foresee. Claude proposes an entry when it sees a pattern or you state a preference outright, and an entry steers nothing until you say yes on the screen that proposes it. The record shapes what Claude picks, whether it decides or gives its lean as it asks; it never shapes whether Claude asks, save through the care entries it holds. If you keep saying "don't care" to a kind under a care entry, Claude proposes dropping the entry.

## Where it lives

Your answers live in the trust log, `trust.jsonl`, and your preferences in `person.md`, both in your own Ledger folder (`~/.config/ledger/`, or `LEDGER_CONFIG_DIR`), never in a project and never in Claude Code's memory, which is keyed to one project. The log holds what the arithmetic needs — the gate or the question's kind, the row recommended and picked, the verdict — and no decision's content, which stays in the project's ledger. Only the engine writes either file; Claude cannot edit them, and no session searches your decisions in other projects. The log is per machine: a call made on another machine is counted and judged there. Your threshold sits beside the knowledge base's settings in `config.json`.

The labelling, the one-decision check and the reading of a typed gate answer are each a raw Claude call the engine makes itself, in an empty folder with no tools, hooks, memory or settings of yours, so nothing of the session reaches it but the question. Where the labelling cannot run — no login, a rate limit — the question asks you. No decision model ships with Ledger.
