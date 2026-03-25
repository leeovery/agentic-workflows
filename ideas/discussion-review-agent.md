# Discussion Review Agent

## The Idea

Add a review agent at the end of the discussion phase that evaluates discussion quality before allowing progression to specification.

## Why This Matters

Discussion is the only phase without a quality gate. Research has no gate (exploratory by nature), but discussion feeds directly into specification — a weak discussion produces a weak spec, and the spec reviewers may not catch gaps that were never discussed in the first place.

Currently the user signals "I'm done" and the system accepts it. There's no check for: unresolved debates, missing edge cases, unexplored alternatives, decisions made without rationale, or topics that were raised but never concluded.

## What the Agent Would Do

A `workflow-discussion-review` agent would:

1. Read the full discussion file
2. Check each decision point has: options considered, rationale for choice, trade-offs acknowledged
3. Flag unresolved threads (questions raised but never answered)
4. Identify missing edge case coverage (based on the domain/topic)
5. Check that "why" is captured, not just "what"
6. Assess if the discussion is sufficient to produce a meaningful spec

Output: structured findings, presented to user before proceeding. User can address findings or acknowledge and proceed anyway (advisory, not blocking).

## Key Motivation

Currently, edge cases and gaps often get caught at the specification review stage. But by then there's less opportunity to properly discuss them — spec is about synthesis, not discovery. The spec review agents end up compensating for gaps that should have been caught in discussion. Moving that discovery earlier means spec can focus on what it's actually for: synthesising and validating decisions that were already thoroughly explored.

## Design Consideration

This should feel like a helpful second opinion, not a gatekeeper. The tone matters — "you might want to consider X before moving on" rather than "discussion incomplete, cannot proceed." The user is always in control. The review should stay within the scope of discussion (discovery, debate, edge cases) and not drift into specification territory (synthesis, structure, completeness as a document).
