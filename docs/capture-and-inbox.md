# Capture and the inbox

Not every thought arrives ready to become a project. Mid-way through building one thing you notice another that is broken, or an idea worth exploring later, or a small change that ought to happen sometime. Stopping to start a whole pipeline for it would derail what you are doing; forgetting it is worse. So the system gives you a place to put such thoughts down safely and keep working: the inbox.

## Capturing without stopping

You capture something simply by asking — "log that as an idea," "log this bug," "log a quick-fix" — and the system writes it down as a small note without pulling you out of your current work. There are three kinds. An **idea** is something you might want to build or explore. A **bug** is something broken — its symptoms, the conditions, the impact. A **quick-fix** is a small mechanical change — what needs changing, where, and why. If you are already talking about the thing, it just writes it up; if you are starting cold, it draws the shape out in a short back-and-forth and confirms in a line.

What makes capture lightweight is as much what it refuses to do as what it does. It is capture-only: it will not read your code, search the web, judge whether the idea is feasible, diagnose the bug, or suggest an approach. It carries none of the machinery of real work — no project record, no phases, no bookkeeping — just your thought, written down faithfully. The point is speed and honesty of capture. The thinking comes later, when you decide the thought is worth pursuing.

Each note lands in the inbox, a holding area that sits entirely outside the pipeline, sorted by kind into ideas, bugs, and quick-fixes.

## Triaging the backlog

An inbox note does nothing until you decide it should. That decision happens at the top of `/workflow-start`, which shows you the inbox and lets you act on it. You select one or more items to build a **working set**, and every action you choose applies to the whole set. You can add more items to the set, drop items out of it, view the full text of everything in it, promote it into real work, or archive it out of the way.

Promoting the set is how a captured thought becomes real work: it carries the items into [discovery](discovery.md) as the origin of a new work unit, where they become its **seeds** — the recorded reason the work exists and part of the early context its first phases draw on. Promotion is offered only when every item in the set is the same kind, because a work unit is one type with one pipeline shape, and you cannot hand a mixed bag of ideas and bugs to a single pipeline. Archiving has no such restriction — you can archive any mix, because declining items commits to nothing.

Archived items are not gone. The archive is a live store you can return to: restore an item back to the inbox when it becomes relevant again, or delete it for good once you are sure. It holds the thoughts you have set aside, never the ones you have promoted — a promoted note moves on into its work unit and lives there as a seed.

## Seeds and imports

Two kinds of early material feed a new piece of work, and it is worth keeping them distinct. **Seeds** are the work's origin — the inbox notes it was promoted from, moved into the work unit when it is created. They answer "why does this work exist?" **Imports** are reference material you share during discovery's opener — notes, design docs, error reports, prior research — that help shape the work but did not trigger it. They answer "what should inform this work?" Both are read early and both are remembered, but one is the spark and the other is fuel. The distinction is why a bug you logged and later promoted shows up as the work's seed, while the stack trace you pasted in during discovery shows up as an import.
