# Discussion: Behavioural Ranking

## Context

Click and purchase events land in the events pipeline but nothing
feeds them back into ranking. This discussion settles what signals
feed the ranker and how they get there.

---

## Signal Ingestion

### Context
The events pipeline reliably captures clicks and purchases. The open
question was how those signals reach ranking features.

### Options Considered

**Batch nightly aggregation**
- Pros: simple, replayable, fits the existing warehouse jobs
- Cons: signals lag up to a day

**Real-time streaming**
- Pros: fresh signals
- Cons: new infrastructure and operational burden nobody has asked for

### Journey
We started assuming fresher is better, then worked through what any
consumer actually does with sub-day freshness — nothing today. A
streaming layer would be new infrastructure for a benefit nobody
could name, so we rejected it as over-engineering.

### Decision
Signal ingestion is a batch nightly aggregation job from the events
pipeline into ranking features. Real-time streaming is rejected as
over-engineering.

---

## Signal Weighting

### Context
Once clicks and purchases reach the ranker as per-query aggregates,
how much should each count for?

### Options Considered

**Purchases only**
- Pros: the strongest intent signal, hard to game
- Cons: sparse — most queries see no purchase in a month

**Clicks and purchases, purchase-weighted**
- Pros: coverage from clicks, conviction from purchases
- Cons: click position bias leaks into the feature

### Journey
Purchases alone would leave most queries without a signal at all.
Blending them, with a purchase counting for several clicks, keeps
coverage while letting conviction dominate where it exists. Position
bias is a known correction the aggregation job can apply.

### Decision
The ranking feature blends clicks and purchases per query, a purchase
weighted as five clicks, with a position-bias correction applied in
the nightly job.

---

## Summary

### Key Insights
1. Freshness has no consumer today — batch wins on simplicity.
2. Purchases carry conviction, clicks carry coverage; the blend keeps
   both.

### Current State
- Signal ingestion decided: batch nightly aggregation, no streaming.
- Signal weighting decided: purchase-weighted blend with position-bias
  correction.

## Triage

(none)
