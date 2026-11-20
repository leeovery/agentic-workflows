# Review

The review phase is the last phase: the whole change held up against the specification's intent, with the product run, once every phase of [the build](the-build.md) has closed. It is the third kind of review the work meets, after each task's review and each phase's review, and the only one that reads the change as a whole against what was agreed.

The build runs straight into it in the same conversation, with no stop between them. After a break, the menus move back into it where it stood. A quick-fix has one only when you ask for one at its close.

## A round

The review works in rounds. Each round reads, lands what it finds, and reports to you.

**The readers.** For each of the specification's areas, a reviewer pair, two independent agents fresh to the code, reads its area: the code against what the area specifies, where it meets the other areas, and the calls made for the work as a whole. They run the project's tests, and each of the area's scenarios through the project's [verify setup](verification.md), since proven means performed on the running product. A scenario left not proven is a finding, and what could not be run is reported not proven, never assumed to work. Beside them, one more reader goes over every test file of the change: whether the tests test what they claim. Each report is kept whole in its own file.

**The findings.** Every item of every report is answered by exactly one finding, and every finding lands somewhere:

- **In the change**, in what this work delivered: a fix task, however small, since no code changes outside a task. One too slight to be worth a fix, or not real, is dropped with its reason.
- **Beside the change**: what is not worth doing is dropped, related findings are grouped into one item, and the rest are filed to the inbox, to be triaged like anything else. Nothing out of scope is put to you as a decision.
- **Notes for later**, from the readers or from the builders of a round's fixes, lie beyond the change by definition: each is filed or dropped, never fixed here.

Each call to file or drop a finding, and each serious finding or bug dropped in scope, is a call on the ledger with its reason, so you can see later what was set aside and why.

**The fix tasks.** A round's fix tasks are one more phase of the build, its own, each task's acceptance scenario the user scenario of the finding it fixes. They are built in the build's own task loop, each passed by its reviewers, in the build's position. A fix phase has no phase review: the areas its tasks changed are read again instead.

**The report.** Each round's report is drawn for you: what was read, what was found, where each finding went, and what goes to the inbox. It is not a gate. The review carries on.

## Reading again

Once a round's fix tasks are done, the next round reads again, whole, every area whose code they changed. An area nothing changed is not read again, and the whole change is never read against the specification a second time. The rounds go on until one passes, with nothing serious and no bug left in the change. No count of rounds stops them.

A round that fails again on findings its fixes already addressed is Claude's to settle, as a stuck task is: where a fix missed, a new fix task carries what it missed, and the finding says so; where the findings were fixed in an earlier round, or are rightly dropped, the round makes no fix task and its report says how it was settled. Settling one stops for you only where the answer needs you.

## You during the review

The review runs without you but for its reports and finish. A question that needs you goes through the [ask rule](trust.md), and one that waits parks only the fix tasks that depend on it, as in the build. Ask "what did you decide for me?" and you get the calls made along the way. You can ask for any task's account, the build's or a fix's, and for the phases and tasks, the fix phases among them.

The review takes its turn in the project's checkout and leaves the working tree as it found it. Where something in the working tree changed while a round ran, you are asked what becomes of it; whatever is put back is kept aside where you can find it, until you remove it.

## Finish

Once a round has passed, or been settled, and its fix tasks are done, finish is drawn. Before it, Claude checks the inbox against what was built and archives each item the work resolved, as closed by this work.

**Finish** is the gate that ends the work. It shows the finish report, asks a verdict on each call you changed during the build and the review, and names each inbox item the work resolved and archived, so nothing is silently discarded. An item closed wrongly can be asked back to the inbox.

Your yes lands what is left to land, the review's fix phases last, and a work unit with a branch of its own lands it on the default branch. A refusal names the way on, such as a conflict with the default branch to settle with you first. Then the work is complete: it leaves the start menu for the list behind its `v/view` row, its decisions stay current in the [knowledge base](knowledge-base.md), and it stays finished. A later change to it is new work. No menu follows: a line says it is done and what waits on you, with the menu one `/ledger` away.

## A quick-fix's review

A quick-fix has no specification, so its review holds the whole change against its fixes' acceptance, in their own words, and their short records. Its one area is the change, read by one pair beside the test reader. Its fix tasks are more fixes of the quick-fix, landing in its one pull request. When the review is over, it hands back to the quick-fix's close, where your yes finishes the work.
