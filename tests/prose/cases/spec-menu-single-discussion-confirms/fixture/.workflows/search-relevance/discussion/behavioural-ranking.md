# Discussion: Behavioural Ranking

## Context

Click and purchase events land in the events pipeline but nothing
feeds them back into ranking. This discussion settles what signals
feed the ranker and how they get there.

---

## Signal Ingestion

### Decision
Signal ingestion is a batch nightly aggregation job from the events
pipeline into ranking features. Real-time streaming is rejected as
over-engineering.
