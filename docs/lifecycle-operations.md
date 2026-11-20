# Lifecycle operations

Work does not always run cleanly from start to finish in the shape it began. A feature outgrows itself; another turns out to belong inside a larger effort; something is shelved and later revived; a topic proves not worth doing. Ledger treats all of this as normal and gives you a small set of deliberate moves for it. Each is something you ask for, never something done behind your back, and each says what it will do before it does anything that cannot be undone.

You reach them in two places. **Manage**, the start menu's `m/manage`, opens any piece of work with what can be done to it as it stands. An epic's topics are changed through its **discovery** row, `d/discovery` on the epic's menu, or in your own words in any of the epic's conversations. Each menu's `h/help` says what its rows do.

## Where a piece of work stands

Every piece of work is **in progress**, **completed** or **cancelled**. Work in progress is what the start menu shows. Completed and cancelled work sits behind the start menu's `v/view` row, so it does not clutter the day-to-day, and each opens in manage from there.

A piece of work completes at finish's yes, or for a quick-fix at its close. A finished piece of work, of any kind, stays finished. Nothing reopens it, reactivates it or pivots it: manage lists it with nothing to do to it, and its record stands as what was decided and built at the time. A later change to it is new work, started like any other; in that work's discussion the decision it changes is replaced, and every entry that relied on the old decision is flagged in the new work. The finished work is never written to.

## Changing a piece of work's kind

- **Pivot** turns a feature into an epic in place, when what looked like one thing keeps fanning out into parts that each need decisions of their own. The feature's discussion becomes the epic's first topic, under the feature's own name, with a summary and description drawn from its record and its log, and everything already done is kept. A feature's discussion offers it when a point needs decisions of its own; manage offers it too.
- **Absorb** makes a feature a topic of an epic already under way, when it turns out to be one facet of a bigger effort. Its discussion, its experiments and its files move with it, a discussion waiting on an experiment still waiting inside the epic, and the feature itself is gone; its history remains as the record of where the topic came from.
- **Moving a quick-fix** to a feature, or to a bugfix where a cause is still to find, happens inside its own conversation when it turns out to need a real decision, before any of its fixes has landed. The work it had not committed is set aside and kept, and the new piece of work's first conversation names what was kept and how to use it.
- **Reworking a bugfix as a feature** happens in its investigation, once the root cause is validated, when the right fix is to rework the area rather than patch it. The feature's discussion reads the investigation as its earlier log.

Pivot and absorb are open only while the feature is before its specification, and absorb only into an epic before its own. From the specification on, the work's shape is set: a decision that has to change is settled in the phase the work is in, and only cancel stays.

## Cancelling and bringing back

**Cancel** takes a piece of work out of active work while keeping its record, once you confirm. The confirm says what the cancel calls off before you say yes, and the receipt after it says what it did:

- its decisions leave the [knowledge base](knowledge-base.md), so an abandoned decision never resurfaces as advice;
- any experiment still open under it ends as abandoned;
- a message waiting for one of its topics goes to the inbox, as an idea;
- each roadmap item it was started from goes back to waiting;
- every pull request open on its branches is closed, in every repository it touched, and every branch is kept under its own name;
- for a quick-fix, the work its fix in hand had not committed is set aside, and the checkout is taken back off its branch.

A quick-fix cancelled carries on in the conversation, as its close does; any other piece of work cancelled from inside goes to the start menu.

Nothing is lost. The branches and the work set aside wait for you, and the receipt says how to see each, bring it back or drop it. A cancel that stops part way, with the code host out of reach, keeps a record of what it did: say yes to it again once the host answers.

**Reactivate** brings cancelled work back from manage, in progress again where it stood. Its decisions return to the knowledge base, and each roadmap item its cancel put back is taken again where it still waits; the receipt says where one stays. An experiment the cancel ended stays abandoned. The pull requests it closed stay closed: the next landing opens again what it needs, and a quick-fix's next fix puts the checkout back on its branch and brings back the work its cancel set aside.

## An epic's topics

Inside an epic, topics have their own lifecycle, apart from the epic's. Each move is asked for in your own words. In the epic's discovery it is made as you asked and reported in a line, and only a cancel asks first; a postpone asked in a topic's discussion, or in the split at the specification, asks first too.

- **Cancel** a topic that turns out not worth pursuing, started or not, without touching the rest of the epic. It stays listed as the record that it was raised and declined, drops out of the epic's counts, and stops holding up the specification. Any experiment open under it ends as abandoned, and the question each was measuring is open again, raised when the topic comes back. **Reactivate** brings it back as it was.
- **Postpone** a topic that is wanted but belongs to a later release. It goes to the [roadmap](tracking.md) on a horizon you name, whole: nothing is deleted and nothing moves, and a message sent to it waits in its mail for its return. It comes back when it is **pulled forward** into an epic whose map is still open: its own, where it returns as it was, in its old place in the order where that is still free; or another, where it opens as a fresh topic that reads the earlier record in full and decides again, never changing it.
- **Remove** a topic that should never have been on the map, a mistake or a duplicate, while nothing has started under it. Its name is struck from the map, so a later pass does not propose it again unasked; asking for it back by name brings it back.
- **Reopen** a decided topic by sending it a message carrying why. It goes back to in progress, its row on the epic's menu shows *mail waiting*, and it closes again through a fresh closing pass.

Adding, removing, cancelling, reactivating and reopening a topic close when the epic's specification is first written. From then the map is closed, and a decision that must change is settled in the phase the epic is in. Postponing stays open until ready to build's yes, because it is how an epic is split: a whole decided topic moved to a next epic on the roadmap ([specification](specification.md#splitting-an-epic)). Abandoning the whole effort is the epic's own cancel.

A single-topic piece of work has nothing to postpone or cancel apart from itself: its topic is the work, so its "not now" is a cancel of the work.

## What holds work back

Most moves are open whenever you want them. A few wait on something, by design, because work built on moving ground would be a false contract:

- **An epic's specification** waits until every topic is decided, cancelled or postponed; the epic's menu offers it only then.
- **A topic cannot close while mail waits**: a message another topic sent it is raised first.
- **An investigation concludes** only once its root cause and its fix both stand validated.
- **A build phase** waits for every phase it relies on to merge, and the build's first phase cannot close until the product can be run and driven.
- **Code takes turns.** A build, the review phase and a quick-fix run one at a time in the project's checkout, whichever piece of work each belongs to; entering one while another session holds the code names that session and asks before going on.
- **A driver never changes under a build**, so manage changes one only while no build is in flight.

A refusal always says what holds the move and the way on.

## When a decision changes

A decision is never edited. A changed mind, a new fact, another topic's decision, or a decision found wrong replaces it with a new entry that says why. Everything on the ledger that relied on the old answer, but the replacement's own cause, is then **affected**: flagged until it is confirmed as still holding, or replaced in turn. A decided topic holding an affected entry shows among what waits on you, as "a decision it relies on changed", and entering it is for those entries alone. In the build, whatever was built on the old answer is reworked by tasks. Nothing that rests on a replaced answer is trusted by mistake, and nothing is silently overwritten.

## The legacy files

A project moved across from before Ledger can hold files the move found no place for: notes left beside the work, references, images, research. They are kept as **legacy files**, with their piece of work or with the product, until each is sorted. While any wait, the start menu shows a row for them, *Sort the legacy files from the migration*, and an epic's menu shows its own.

Sorting is a short pass, at your pace:

- **Finished work kept whole.** A completed piece of work's reports, and every folder something already links to, can be kept all at once, in one step.
- **Keep it.** A file or folder is kept among the work's assets, and everything that names it follows it to its new place.
- **Bring it in.** Claude reads the file, keeps it, and records what it holds that the work will want as findings on the ledger, each citing the file. A question it leaves open for a topic still in discussion goes to that topic as a message.
- **Discard it**, on your word. The state's history keeps it, and Claude says first if anything still points at it.

The pass ends when nothing is left, or wherever you stop; what is left waits on the same row.
