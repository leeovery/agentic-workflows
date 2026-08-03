# Discussion: Behavioural Ranking

## Context

Click and purchase events land in the events pipeline but nothing
feeds them back into ranking. This discussion settles what signals
feed the ranker and how they get there.

---

## Signal Ingestion

### Context
How click and purchase signals reach ranking features.

### Options Considered

**Batch nightly aggregation**
- Pros: simple, replayable, fits the existing warehouse jobs
- Cons: a day stale

**Live event stream**
- Pros: fresh within minutes
- Cons: a new always-on consumer nobody owns yet

### Journey
The live stream was attractive until ownership came up — nobody
owns an always-on consumer, and staleness turned out not to matter
for ranking features that move slowly. Batch won on both counts,
and the live stream was dropped rather than deferred.

### Decision
Signals reach ranking by nightly batch aggregation over the
warehouse. Ingestion is batch-only; a live stream may be revisited
if freshness ever becomes a ranking requirement.

---

## Summary

### Current State
- Signal ingestion decided — nightly batch, never a live stream.

## Triage

(none)
