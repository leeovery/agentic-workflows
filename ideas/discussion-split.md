# Discussion Split — one discussion feeding two spec groups

## Problem

A discussion's material may turn out to serve two different
specifications — decisions so divergent they belong in different spec
groups. Today a discussion is extracted wholesale into the spec(s) that
declare it as a source; there is no mechanism to split a discussion, and
the grouping analysis can only place the whole discussion into groups,
not partition its substance.

## Why it's parked

Rated unlikely (2026-08-25, during the topic-spawning design): the
grouping analysis already lets one discussion source multiple specs,
which covers most of the shape — both specs read the discussion, each
extracts what it needs, consult references handle the narrow cross-
reads. The un-covered residue is a discussion whose *subtopics* are so
disjoint that wholesale extraction into either group drags foreign
material along.

## Feed-forward

The research side of the same problem was settled by the spawn model
(`design/topic-spawning.md`): content never moves; children spawn with
provenance and read the parent by reference. If a discussion-side
mechanism is ever built, start from that shape — spawn a sibling
discussion topic with provenance rather than extracting content — and
from the observation that discussion subtopics (`pending` →
`decided`/`deferred`) already give the partition boundaries a split
would use.

Append lessons from the topic-spawning implementation here as they
land. Keep or delete at the end of that work.
