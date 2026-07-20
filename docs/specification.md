# Specification

The specification is where decisions become a contract. Everything upstream of it was a conversation — a discussion, an investigation — held in documents that ramble, backtrack, and hold competing options open. Everything downstream of it — the plan, the tasks, the code, the review — reads *only* the specification and never looks back at those conversations. So the spec has one job: to absorb everything that was decided into a single document that stands entirely on its own.

This is why the phase treats the spec as the golden document. If a detail does not make it into the spec, it does not get built — and worse, a downstream agent working from an incomplete spec may invent something plausible to fill the gap. The integrity of the whole delivery half rests on the spec being complete and faithful. Almost every behaviour in this phase follows from protecting that.

## Where it starts

Specification refuses to begin until its source material is finished. A feature, bugfix, or cross-cutting concern has exactly one upstream source — a completed discussion or investigation — so the phase proceeds straight into it. An epic is different: it may have many completed discussions, so the phase shows you what is available and how it might be grouped, and lets you decide whether each discussion becomes its own spec or several are consolidated into one unified specification. If a spec for the topic already exists, you choose whether to continue it or restart from scratch.

At this point the phase declares two kinds of input, and the distinction between them runs through everything that follows.

A **source** is a document the spec swallows whole. The spec is built by extracting its sources exhaustively — re-reading each one in full rather than from memory, hunting for the topic under every synonym, gathering decisions scattered across the document, discarding the rejected and the "maybe," and keeping only what you actually decided to build. A source stays marked pending until that extraction is genuinely done, then flips to incorporated.

A **consult reference** is different. It is a *sibling* discussion that decided something this spec must respect but should not re-tell — a decision made elsewhere that owes this spec one narrow correction. The spec reads only the relevant slice of it, applies or cites that single correction, notes what was reconciled, and marks the reference addressed. The principle is cite, don't restate: the correction lands, but the sibling's content stays in the sibling. This keeps each decision living in exactly one home, so nothing gets duplicated and then drifts out of sync.

## The refusal to complete

Here is the phase's signature guard. Specification will not let you sign off while any source is still pending or any consult reference is still unaddressed. This is a hard refusal, not a warning you can wave past. At conclusion the phase re-checks every source and every reference, and if any is still open, it stops and works it before offering sign-off.

The reason is that a spec which *looks* finished but silently dropped a source is more dangerous than one that is obviously unfinished. The obviously-unfinished spec gets completed; the silently-incomplete one ships a gap into the plan, where it becomes missing code or invented behaviour that nobody decided on. Refusing to complete is how the phase guarantees that "the spec is done" actually means "everything decided is in the spec."

## How the document gets built

Content is written one topic at a time, never in a single pass. For each topic the cycle is the same: extract it exhaustively from the sources, present the exact text that will be written — rendered as it will appear in the document — refine it with you if needed, get explicit approval, write it verbatim, commit, and move to the next. Presenting the text is not approval; nor is silence, nor "continue," nor a follow-up question. Only an explicit yes writes anything. You approve each topic as it is built, or opt into auto to approve the rest at once.

One gate never yields to auto. If, while extracting a later topic, the phase discovers something that changes a topic you already approved, it resurfaces that topic immediately — shows you a small diff of what would change and asks whether to record it. Because this edits content you already blessed, it stops and asks even if you have switched everything else to automatic. Blessed content is never quietly rewritten underneath you.

Near the end, an automated two-pass review runs: one pass compares the spec against its source material to catch anything missed, and a second reads the spec as a standalone document looking for gaps a fresh reader would hit. You approve or dismiss what it finds.

## What you are left with

The finished specification is a single self-contained document per topic — no pointers back to the discussions, because it has absorbed them. On completion it is filed into the [knowledge base](knowledge-base.md), where it is the highest-confidence kind of memory the system keeps: a decision that was validated and written down. If the spec consolidated existing specs, those older ones are marked superseded. For a cross-cutting concern the specification is the end of the line — the pipeline terminates here, because you were defining a standard, not shipping a unit of work. For everything else, the spec hands off to [planning](planning.md), which will turn it into the how.
