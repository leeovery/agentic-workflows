# Commentary Worked Into Engine-Rendered Gates

## The Idea

When the person answers a gate with commentary that changes what happens
next, the gate is presented again with that commentary worked into its
own engine-rendered display — a "Your comments" section — and a yes then
carries the original instruction plus the commentary onward.

The framework rule (a reply that changes what happens next is confirmed
before anything acts on it; the gate's own branches own how) makes the
confirmation happen everywhere. This idea gives the engine-rendered gates
a real mechanism for it, so the confirmation shows the same prescribed
display the person already knows, with their words in it.

## Shape

- The session writes the commentary (as it understood it after any
  conversation) into the gate's payload or cache file.
- The same render call runs again; the engine draws the gate's usual
  display plus a "Your comments" section, then the gate.
- On yes, the next step takes the original instruction plus the comments
  — e.g. the task loop re-invokes the executor with the review's changes
  and the person's direction.

## First Target

The implementation task loop's review gate: the reviewer requests
changes; the person answers "yes, but do it this way …". Today the
Comment branch folds the comment in directly; with this, the gate comes
back with the review as rendered plus the person's comments, for an
explicit yes.

Then sweep the other gates for where the pattern fits — every gate is a
little different, so each gets its own explicit handling in its prose
rather than one prescription from the framework.

## Where It Came From

Lee, 2026-09-24, settling how a question or comment at a gate is handled
in the function-hook gates review. Wanted back soon after release.
