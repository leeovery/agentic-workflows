# Discussion Review — review-001

## Summary

One correction the document already determines, and two concerns
whose home is a sibling topic.

## Gaps Identified

### F1: The Decision reopens a live stream the Journey dropped

**Lane:** apply

Signal Ingestion § Journey records the live stream was dropped
rather than deferred. The Decision beneath it ends "a live stream
may be revisited if freshness ever becomes a ranking requirement",
which reopens what the Journey closed. Strike the clause.

### F2: Query-time expansion needs signals this topic made batch-only

**Lane:** route — synonym-handling

Ingestion being batch-only bounds what any consumer of these signals
can assume. Whether expansions can be derived from day-stale
reformulation-and-click pairs is that topic's call, not this one's,
but it inherits the constraint decided here.

### F3: Nothing says how a ranking change is judged better or worse

**Lane:** route — relevance-measurement

This topic decides what feeds the ranker and stops there. Whether a
change helped is the measurement topic's ground, and it has not
started.

## Observations

- The Options blocks would read faster as a table. Style only.

STATUS: gaps_found
FINDINGS: F1,F2,F3
GAPS_COUNT: 3
QUESTIONS_COUNT: 0
SUMMARY: One determined correction; two concerns owned by sibling topics.
