# The knowledge base

The knowledge base is the system's memory. As each piece of thinking work finishes, its document is quietly added to a searchable store that any future session can draw on — searched by meaning, not just by exact words. Nothing leaves your machine; the store lives inside the project alongside the work. And it keeps the real text of what was written, not a summary of it, with a note of where each piece came from: which work unit, which phase, which topic, and when. When something resurfaces, you get the actual sentence someone reasoned their way to, and a citation for it.

Its reason for existing is to stop knowledge from evaporating — both between different pieces of work and within a single long one. A specification written months ago, a discussion that argued its way to rejecting an approach, an investigation that ruled out a suspected cause — all stay findable, instead of being rediscovered the hard way.

## What it remembers, and what it deliberately forgets

The knowledge base indexes the thinking artifacts: research, discussion, investigation, and specification. Alongside those it keeps a little early-stage context so new work starts warm — the reference material you attached when a piece of work began, the original captured note it grew out of, and an epic's running discovery record.

It never indexes planning, implementation, or review. This omission is deliberate, and it is the sharpest line the design draws. Those phases describe *how the work got done* — task breakdowns, code, verification steps — not *what was learned or decided*. Indexing them would flood every future search with task IDs and diffs instead of insight. The rule is simply: the knowledge base stores knowledge, not execution. If it is a decision, a rationale, or a discovery, it is remembered; if it is a to-do list or a diff, it is not. That is what keeps recall sharp instead of noisy.

Each remembered piece carries an honest confidence label, so you know how much weight to put on it. A specification is high-confidence — a decision that was validated and written down. An investigation is medium — a trustworthy diagnosis, though worth checking the symptom is still current. A discussion is lower, because it is a conversation that may contain an assumption corrected later in the very same file. Research and the early seed material are lowest. But low confidence is not low value: a research note that killed a bad approach is exactly the thing that stops the next person re-exploring the same dead end.

## How the past resurfaces

You do not go looking for the memory; it comes to you. As you work through the early, thinking-heavy phases — research, discussion, investigation, quick-fix scoping — the system checks the memory on your behalf: at the start of a phase, and again whenever the conversation drifts toward the edge of the current topic, brushes an upstream or downstream dependency, or wanders into ground that might have been covered before. You can also just ask — "have we discussed this?", "what did we decide about X?"

When something relevant turns up, you get a brief, unintrusive line noting the one or two things that actually bear on what you are doing — not a wall of old material — and that context folds into the phase. It pulls up a full original document only when a snippet looks genuinely load-bearing. If nothing relevant exists, you see nothing at all and the session simply continues.

There is deliberate restraint about *when* it looks. During the phases meant to stay faithful to a single source — writing the specification, and planning against it — the system does not rummage through the wider memory, because that would pull the document away from its own agreed source material. The memory is for widening context early, not for second-guessing a decision that has already been captured.

## Why old material fades

Left alone, the memory would grow forever and stale thinking would crowd the results. So material decays and eventually gets pruned — but the important nuance is *how* staleness is judged. It is not a wall-clock timer. A note does not fade because six months passed; it fades based on how much later work has since completed. As the project moves on and more work lands past an old unit, that unit's material sinks in the rankings, and once it has effectively sunk out of reach it becomes eligible to be pruned. Staleness is measured by the project's progress, not by the calendar.

Two protections sit on top of this. Specifications are exempt — validated decisions of record are never auto-pruned. And the behaviour can be dialled down or switched off entirely. The intent is a memory that keeps recent, still-relevant thinking near the surface and quietly lets the distant past recede, without ever discarding the decisions the project was built on.

## Turning it on

The memory needs to be switched on once per project, and this is the single moment where you may be asked to do something by name. If it has not been set up, you will be guided to run `knowledge setup`. This step is human-only and interactive by design — it walks you through choosing how the memory should work, and if a cloud embedding service is involved it collects the API key through a private terminal prompt that never travels through the chat. The assistant genuinely cannot do this part for you.

You have a real choice here, including a no-dependencies option. If you would rather not wire up an embedding service, the memory runs in keyword-only mode — a fully supported, deliberately-degraded mode, not a broken one. You lose search-by-meaning (it will not know that "sign-in" and "authentication" are related), but exact-term search still works and everything else behaves normally; results carry a small note that configuring a provider would unlock semantic search.

Every entry into the workflow checks that this memory is initialised before any real phase runs. When things are fine, the check is silent. You only notice it when the memory is not ready: rather than letting you start work against a memory that does not exist, the system stops cleanly and points you at setup. It is a gate, not a nag — it guarantees that by the time you are doing thinking work, there is somewhere for that thinking to be remembered, and somewhere for prior thinking to be recalled from.
