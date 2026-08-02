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
over-engineering — the events pipeline exposes batch aggregates
only, and no live signal stream will be built.

---

## Summary

### Key Insights
1. Freshness has no consumer today — batch wins on simplicity.

### Current State
- Signal ingestion decided: batch nightly aggregation, no streaming.

## Triage

(none)
