# Capture and the inbox

Not every thought arrives ready to become a project. Mid-way through building one thing you notice another that is broken, or an idea worth exploring later, or a small change that ought to happen sometime. Stopping to start a whole pipeline for it would derail what you are doing; forgetting it is worse. So the system gives you a place to put such thoughts down safely and keep working: the inbox.

## Capturing without stopping

You capture something simply by asking — "log that as an idea," "log this bug," "log a quick-fix" — and the system writes it down as a small note without pulling you out of your current work. There are three kinds. An **idea** is something you might want to build or explore. A **bug** is something broken — its symptoms, the conditions, the impact. A **quick-fix** is a small mechanical change — what needs changing, where, and why. If you are already talking about the thing, it just writes it up; if you are starting cold, it draws the shape out in a short back-and-forth and confirms in a line.

What makes capture lightweight is as much what it refuses to do as what it does. It is capture-only: it will not read your code, search the web, judge whether the idea is feasible, diagnose the bug, or suggest an approach. It carries none of the machinery of real work — no project record, no phases, no bookkeeping — just your thought, written down faithfully. The point is speed and honesty of capture. The thinking comes later, when you decide the thought is worth pursuing.

Each note lands in the inbox, a holding area that sits entirely outside the pipeline, sorted by kind into ideas, bugs, and quick-fixes.

The inbox is one of two places to put something aside, and the somedays are its half: things that get picked up when they get picked up. The other is the [roadmap](roadmap.md), for what you place in the near term — "that's a v2 thing", "on the roadmap under Next". Your own words decide it, from inside any phase, and where they leave it open — "backlog that" — you are asked which of the two rather than guessed at.

## Triaging the inbox

An inbox note does nothing until you decide it should, and triaging the inbox is making that decision: start the work now, put it on the roadmap for later, or decline it. That happens at the top of `/workflow-start`, which shows you the inbox and lets you act on it. You select one or more items, of any mix of kinds, to build a **working set**, and every action you choose applies to the whole set. You can add more items to the set, drop items out of it, view the full text of everything in it, start work on it, put it on the roadmap, or archive it out of the way.

Starting work on the set is how a captured thought becomes real work: it carries the items into [discovery](discovery.md) as the origin of a new work unit, where they become its **seeds** — the recorded reason the work exists and part of the early context its first phases draw on. The set takes the largest shape among its items. With ideas in it, discovery shapes the work from the ideas, and any bugs and quick-fixes ride along as seeds that never add size — a feature with a bug beside it stays a feature, and discovery tells you the bug skips the investigation it would get on its own. Bugs with no idea become a bugfix; quick-fixes alone become a quick-fix. Urgent work starts here directly; it never needs to pass through the roadmap.

Putting the set on the [roadmap](roadmap.md) is for work you have decided on but not for now. You name one horizon for the whole set, confirm the items as the system words them, and each note moves out of the inbox with its item, kept beside it on the roadmap until the item is pulled.

Archived items are the ones you declined, and they are not gone. The archive is a live store you can return to: restore an item back to the inbox when it becomes relevant again, or delete it for good once you are sure. It never holds a note that went on to the roadmap or into a work unit — though removing a waiting roadmap item that came from the inbox sends its note here, declined like the rest.

## Seeds and imports

Two kinds of early material feed a new piece of work, and it is worth keeping them distinct. **Seeds** are the work's origin — the inbox notes it was started from, moved into the work unit when it is created. They answer "why does this work exist?" **Imports** are reference material you share — notes, design docs, screenshots, error reports, prior research — that help shape the work but did not trigger it. They answer "what should inform this work?" You can share them at discovery's opener or at any point in a research, discussion, investigation, or discovery session: the session lands the file in the work unit's `imports/` and links it from the document it is discussed in. Both are read early and both are remembered, but one is the spark and the other is fuel. The distinction is why a bug you logged and later started work on shows up as the work's seed, while the stack trace you pasted in during discovery shows up as an import.
