# Investigation

An investigation is a bugfix's one topic: the product does something wrong and nobody yet knows why. It finds the cause, from the symptoms you report, through the code, to a root cause the evidence proves, and agrees what the fix should do. Claude leads the hunt as an expert debugger, tracing the code itself, testing each hypothesis against the evidence and ruling causes in or out. You steer it at its gates and own what the product should do. Nothing here builds the fix: the [specification](specification.md) is written from what the investigation settles.

The order is fixed where it matters: the symptoms, then the code, and the root cause settled before any fix is set out. Within that, the work is Claude's to order.

## Symptoms

The investigation opens on your own account of the bug: the brief written when the work started, the discovery log and the inbox items it came from. Claude also searches the [knowledge base](knowledge-base.md) for earlier work on the code the bug touches. It confirms what your account already answers rather than asking again, and asks what it leaves open: what should happen and what happens instead, the exact steps, how often, where, since when, and what you have tried. It starts with what matters most and follows your answers down, never a barrage of questions. Each symptom is logged in your words. What you don't know stays unknown, never guessed.

## The plan

Before tracing deep, Claude does a bounded survey: the symptoms, the code they point at and what surrounds it, and whatever the knowledge base turned up. From it come the hypotheses, H1, H2 and so on, each with what points at it rather than proof. A cause your account already pinpoints is a plan of one.

The **plan** gate shows the hypotheses in the order they will be checked, and how each is checked, for you to agree or reorder. If a finding later invalidates the plan, because the cause is clearly elsewhere, a new suspect dominates or the remaining checks are moot, the revised plan comes back to the same gate, saying what the finding changed, before the analysis goes on.

## The analysis

Claude traces from where you meet the bug back to its source: the data's path, the control flow and the state that reach it, what it depends on, and what changed lately, through the history, blame and bisect, in the project's repository and any repository nested inside it. As it reads it checks whether that code was fixed before and whether the cause sits in the design.

What the code or a run shows lands on the ledger as a finding saying how it is known: read in the code, documented with its source, or exploratory, with the command and its result. A check run to test a hypothesis is logged with what it showed. Each hypothesis's state follows the evidence: confirmed, or ruled out, a dead end kept and never deleted, or intended, where you say the behaviour is meant. A new suspect joins as a hypothesis of its own.

Whenever hypotheses resolve, a **check-in** shows what was resolved and what is checked next, and the trace moves on without waiting for you.

## What only you can say

Some things block the trace until you answer them, and each is a question saying what was tried and why it blocks:

- **A fact only you hold** — whether a behaviour is intended, what the environment is, a reproduction that fails here but not for you — is always asked.
- **What the product should do** is a call, raised as any call is.
- **Running anything against a live server** is your call, every time, before it runs. It is a permission for the hunt, never a rule the fix keeps. Where the project has a [verify setup](verification.md), it says how to run the product safely.

## The root cause

Once the evidence settles it, the root cause is Claude's decision on the findings that prove it, its reason the chain from the cause to every symptom. Beside it the log records what lets it happen, why nothing caught it, and what else shares the code or the pattern.

## Validations

Two independent checks always run, each in the background while the work goes on: one over the root cause once it is logged, one over the fix once it is decided. A root cause or a fix that is replaced is validated again. Each agent reads what it validates as it stands, and Claude checks each of its findings against the code:

- one that breaks the root cause replaces it;
- one that changes what the fix does for you reaches you as a question, replacing the fix;
- one that puts to you what the product should do, before any fix stands, is asked;
- any other stands as a finding of the hunt.

A finding that does not hold up is declined, with why in the log.

## The step back and the fix direction

Before any fix is set out, Claude steps back from the bug. Was the implementation wrong, or was it right and an edge case has turned up? Is there another way to do it, a different abstraction or mechanism, that thinking higher up reveals?

The **fix direction** is then a question, each answer a way to fix it said as what you would notice, with what the step back found beside it. Where the cause sits in the design, or the code it lives in keeps breaking, it carries one way more: rework that code as a feature. Where the root cause is a design problem, the fix direction always comes to you; any other goes through the [ask rule](trust.md) like any call. The direction says what the fix does, never how it is written; that is the specification's.

## Reworking it as a feature

When you decide the right fix is to rework the code, the bugfix moves to a feature, once its root cause has been validated. Its brief carries the symptoms, the root cause and why it is the design's, the ways ruled out and why, and the open questions. The [start this work](discovery.md#starting-a-piece-of-work) screen asks your yes, and the work hands off into the feature's discussion, which reads the investigation as its earlier log. Keep shaping instead keeps it a bugfix, and the fix is settled afresh.

## The conclusion

The investigation closes once the root cause and the fix stand, both validated since, nothing of yours open and no mail waiting; it has no checklist. Its recap tells the hunt short, in the product's terms: what was suspected, what ruled each out, what proved the cause. It also names what the bug is in, for the bugs found after a review: the piece of work whose code the bug is in, where one built it, and where the project has a verify setup, the part of its feature map the bug sits in. Bugs found after a review are grouped by those parts, which steers the checks there.

The investigation has no gate of its own: once it closes, the work moves into its specification, and the recap is shown at [ready to build](specification.md#ready-to-build), with a verdict asked on each call you changed along the way: what Claude's answer would have cost, nothing, a fix later, or a real loss. That yes concludes the investigation with the spec. Until the spec is written, opening the investigation again, a message reaching it, a question asked there, a decision replaced there or a new line in its log takes it back, and it closes again once it can; taken back while the spec is being written, it holds the spec back until it closes again. Once the spec is written the investigation is set: a change to the root cause or the fix, asked for at ready to build or found in the spec's review, is made in the spec, and the recap is told again over it.

From there a bugfix runs as a feature does, with two differences. [The build](the-build.md)'s first task writes the test that reproduces the bug, and it lands only once that test has failed on the unfixed code, five times in a row. And before its first round, the [review phase](review.md) runs that test on the unfixed code again: a pass there is a finding, since the test no longer proves the bug.

## Setting aside and cancelling

Once the investigation has concluded, nothing comes back to it from the phases after it: a gap the specification meets in the fix is decided at the specification, as any gap is. A message waiting in the investigation's mail, such as one carried over from before Ledger, is raised as a question when the investigation next opens, and it cannot conclude while one waits.

A bug or an idea that surfaces along the way is put aside to the roadmap or the inbox in a line. A bugfix's topic is the work itself, so there is nothing to postpone: its "not now" is a cancel, which keeps its record.

## The log

The topic's log is the investigation itself: the symptoms, the hypotheses and where each stands, the checks and what they showed, the root cause, the validations and the fix direction, kept as lists the engine writes, and beside them Claude's account of the hunt, the paths traced, the dead ends and why, and what changed its mind. It is appended and never rewritten, enough for a fresh session to carry on alone.
