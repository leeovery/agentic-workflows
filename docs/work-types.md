# The kinds of work

Not every piece of work deserves the same process. A tweak to a settled feature and a months-long initiative both benefit from some structure, but forcing the tweak through weeks of discussion would be absurd, and letting the initiative skip straight to code would be reckless. So Ledger has four kinds of work, each with a route sized to fit, and the kind is settled for you at the start from how you describe what you want.

You never have to choose. You describe the work in your own words and [discovery](discovery.md) works out the kind in conversation, tells you its read and the signals behind it, and asks whether it is right before anything is created. A kind you name yourself is a hint it trusts, reconsidered only on a clear signal the other way.

## The kinds

| Kind | What it is | Its route |
|---|---|---|
| **Epic** | Several distinct things wearing one name, each needing decisions of its own. | Discovery → Discussion per topic (Experiment) → Specification → Build → Review |
| **Feature** | One coherent thing to build, whose shape takes decisions. | Discovery → Discussion (Experiment) → Specification → Build → Review |
| **Bugfix** | Something that used to work and now fails, its cause still to find. | Discovery → Investigation → Specification → Build → Review |
| **Quick-fix** | Work of any size that takes no deciding beyond a quick call. | Discovery → its fixes → its close (Review, if you ask) |

An experiment is in brackets because it is never a phase you enter on purpose: a discussion spawns one when a decision is about to rest on a number nobody has measured, and its result goes back to the conversation that asked ([experiments](experiments.md)).

The differences are not cosmetic.

- **A feature** runs the full journey: a [discussion](discussion.md) that decides it, a [specification](specification.md) that turns the decisions into a contract, [the build](the-build.md), and a [review phase](review.md) that holds the change to the contract. Discovery leans to a feature over an epic when in doubt, since a feature that grows can become an epic later.
- **An epic** is a feature's journey run once per topic up to the decision, then one specification, one build and one review for the whole. Its topics are talked through in conversations of their own, held together by the epic's map and lived through its menu.
- **A bugfix** swaps discussion for an [investigation](investigation.md), because you cannot decide how to fix something until you know why it broke. Its build opens with a task that proves the bug with a failing test before anything is fixed.
- **A quick-fix** has no discussion, no specification and no plan before the work. A known cause with a known fix is a quick-fix, not a bugfix, and so is an update to an existing feature or a very small new one, logic changes included, where nothing takes deciding. Work whose shape you and Claude had to decide is a feature, however much of it you settled before it started. Its fixes are built and reviewed one at a time, from the first to its close, in one conversation; it has a review phase only if you ask for one at the close.

Something that is a pattern or principle for the whole project, rather than a piece of work, is none of these. It belongs to the product's conversation, and it is decided in the first topic it bears on, where it becomes part of the product record.

## The three stages

Whatever the kind, its phases group into three stages:

- **Discovery** — explore and decide: discovery, discussion, experiment, investigation.
- **Definition** — specify: the specification, cut into the phases the build will follow.
- **Delivery** — build and verify: the build, then the review phase.

The stage tells you how much a phase will ask of you. Discovery-stage phases are conversations, the specification is yours to approve, and delivery runs largely on its own, stopping only for what needs you.

## Work units and topics

A **work unit** is one named piece of work of one kind, such as a feature called `saved-filters` or an epic called `billing-overhaul`. Each has its own folder in `.ledger/` and its own record. "A piece of work" is the plain phrase; work unit is the formal one.

A **topic** is one part of an epic, with its own name, its own brief and its own conversation. For a feature or a bugfix there is only ever one topic and it is the work itself, so the word never comes up. For an epic, the topics are the distinct parts it breaks into, each travelling the discussion on its own until every one is decided, cancelled or postponed, and then the epic is specified and built as one.

## When the kind turns out wrong

Getting the kind wrong at the start costs little, because the kind was a reading made before the work had shown its size.

- A feature that turns out to be several things **pivots** into an epic in place, its discussion becoming the epic's first topic.
- A feature that belongs inside a larger effort is **absorbed** into an epic as one of its topics.
- A quick-fix that turns out to need a real decision **moves** to a feature, or to a bugfix where a cause is still to find, within its own conversation, before any of its fixes has landed.
- A bugfix whose cause sits in the design can be reworked as a feature, once its root cause has been validated.

Pivot and absorb work until the specification is written. [Lifecycle operations](lifecycle-operations.md) covers all of them, and the cancels, postpones and returns beside them.
