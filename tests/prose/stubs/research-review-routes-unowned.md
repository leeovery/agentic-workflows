# stub: research-review-routes-unowned

A background review agent's report at a research topic's conclusion: one
route-laned finding whose ground no topic on the map owns, carrying the
kebab-case name the report proposes for it. The content below is written
to the path the dispatch response returned; the STATUS block is also what
the agent returns to its caller.

---

# Research Review

## Summary

The offline-metric threads are followed to conclusions and the judgment
question is answered within its own scope. One thread the file opens is
not this topic's to close, and no topic on the map covers it.

## Unexplored Areas

### F1: Nothing owns how a ranking change reaches live traffic

**Lane:** route
**Proposed topic:** experiment-assignment

The file settles on interleaving win-rate as what decides a head-to-head
change, and interleaving is a live-traffic method: it needs users
assigned to arms, assignments held stable across a session, and a
guardrail that stops a bad arm. None of that exists today and none of it
belongs to this topic — measurement asks what to score, not how a change
is exposed to traffic.

Nor does it belong to either of the other two topics on the map:
behavioural ranking settles what signals feed the ranker, synonym
handling settles what produces expansions, and neither has any reason to
own an assignment layer. It is unexplored ground of its own: what the
platform already has (the feature-flag service may or may not hold
stable assignment), what a search-specific arm needs beyond that, and
what the guardrail costs.

Route it to a topic of its own — `experiment-assignment` — as an open
question to explore, not a decision to take.

## Shallow Coverage

None identified.

## Unvalidated Assumptions

None identified.

## Observations

- The eval-set-size question is open and the file says so — not a gap.

STATUS: gaps_found
FINDINGS: F1
GAPS_COUNT: 1
ASSUMPTIONS_COUNT: 0
SUMMARY: One thread belongs to ground no map topic owns; proposed as its own topic, experiment-assignment.
