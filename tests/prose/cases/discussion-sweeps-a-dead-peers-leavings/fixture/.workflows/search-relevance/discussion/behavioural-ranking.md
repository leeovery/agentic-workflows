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
Clicks are plentiful and noisy; purchases are scarce and decisive.
The question was how much each is worth to the ranker.

### Journey
Weighting the two equally lets a curiosity click count as much as a
sale. Dropping clicks entirely leaves the long tail with no signal
at all. A purchase carrying materially more weight than a click
keeps both, without letting browsing behaviour dominate.

### Decision
A purchase weighs ten times a click. Both decay over a rolling
ninety-day window, so a product that stops selling stops ranking on
last year's sales.

---

## Summary

### Key Insights
1. Freshness has no consumer today — batch wins on simplicity.
2. Purchases and clicks are different evidence, not different
   volumes of the same evidence.

### Current State
- Signal ingestion decided: batch nightly aggregation, no streaming.
- Signal weighting decided: purchases at ten times clicks, ninety-day decay.

## Triage

(none)
