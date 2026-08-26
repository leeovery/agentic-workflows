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

Lessons from the topic-spawning implementation (2026-08-26): the spawn
mechanism itself was removed before release — the review pass ruled
**triage everywhere**: whether the target exists is irrelevant, and
knowledge moves one way, as a rich concern into the target's triage
queue, with `reroute:{origin}` provenance carrying the parent
read-in-full at the target's discussion. If a discussion-side split is
ever built, that ruling narrows it further: no content partition and no
spawn analogue — the shape would be rerouting the divergent subtopics'
asks into sibling topics via the same queue, letting the grouping
analysis place the results. That is close to what exists already, which
strengthens the case for deleting this idea once one real epic has
exercised the grouping over a disjoint discussion.
